import express from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Extrai porta dos argumentos de linha de comando (--port 3000) ou padrão 3000
// Evita conflito com a porta 8080 usada pelo NGINX no ambiente Cloud Run
const args = process.argv.slice(2);
const portArgIndex = args.indexOf('--port');
const cliPort = portArgIndex !== -1 && args[portArgIndex + 1] ? parseInt(args[portArgIndex + 1], 10) : null;
const envPort = process.env.PORT && process.env.PORT !== '8080' ? parseInt(process.env.PORT, 10) : null;
const PORT = cliPort || envPort || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Diretório estático para anexos de mídia (imagens, documentos e áudios)
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Configuração do Supabase com service_role para operações seguras de backend
const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const cleanSupabaseUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseAdmin = cleanSupabaseUrl && serviceRoleKey
  ? createClient(cleanSupabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
  : null;

// =========================================================================
// ROTAS DE API DO CHATSAPP
// =========================================================================

// Fornece configuração do Supabase para o frontend dinamicamente
app.get('/api/config', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  res.json({
    supabaseUrl,
    supabaseAnonKey,
    isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  });
});
// =========================================================================

// Endpoint para upload de anexos de mensagens (imagens, documentos e áudios)
app.post('/api/upload', (req, res) => {
  try {
    const { data, name, type } = req.body;
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Dados do arquivo ausentes' });
    }

    const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;
    let extension = 'bin';

    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], 'base64');
      const mime = matches[1].toLowerCase();
      if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
      else if (mime.includes('png')) extension = 'png';
      else if (mime.includes('webp')) extension = 'webp';
      else if (mime.includes('gif')) extension = 'gif';
      else if (mime.includes('pdf')) extension = 'pdf';
      else if (mime.includes('audio/ogg') || mime.includes('opus')) extension = 'ogg';
      else if (mime.includes('audio/mpeg') || mime.includes('audio/mp3') || mime.includes('mp3')) extension = 'mp3';
      else if (mime.includes('audio/wav') || mime.includes('wav')) extension = 'wav';
      else if (mime.includes('audio/m4a') || mime.includes('m4a')) extension = 'm4a';
      else if (mime.includes('audio/aac') || mime.includes('aac')) extension = 'aac';
      else if (name && name.includes('.')) extension = name.split('.').pop() || 'bin';
    } else {
      buffer = Buffer.from(data, 'base64');
      if (name && name.includes('.')) extension = name.split('.').pop() || 'bin';
    }

    const safeTimestamp = Date.now();
    const safeRandom = Math.random().toString(36).substring(2, 9);
    const cleanFileName = name ? name.replace(/[^a-zA-Z0-9._-]/g, '_') : `file_${safeTimestamp}.${extension}`;
    const storedFileName = `${safeTimestamp}_${safeRandom}_${cleanFileName}`;
    const targetFilePath = path.join(UPLOADS_DIR, storedFileName);

    fs.writeFileSync(targetFilePath, buffer);

    const fileUrl = `/uploads/${storedFileName}`;
    res.json({
      success: true,
      url: fileUrl,
      fileName: name || cleanFileName,
      fileSize: buffer.length,
      mimeType: type || 'application/octet-stream',
    });
  } catch (err: any) {
    console.error('[Upload] Erro ao processar anexo:', err);
    res.status(500).json({ error: err.message || 'Falha ao salvar anexo' });
  }
});

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    supabaseConnected: Boolean(supabaseAdmin),
    supabaseUrl: cleanSupabaseUrl ? 'configured' : 'missing',
  });
});

// Listar contas cadastradas no Supabase
app.get('/api/accounts', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ accounts: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao buscar contas' });
  }
});

// Cadastrar nova empresa e usuário gestor + Agente IA com senha segura
app.post('/api/auth/register', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  try {
    const { companyName, companySegment, adminName, email, password } = req.body;

    if (!companyName || !email) {
      return res.status(400).json({ error: 'Nome da empresa e e-mail são obrigatórios' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'A senha é obrigatória e deve ter pelo menos 6 caracteres' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Criar ou atualizar usuário no Supabase Auth com a senha digitada
    let authUserId: string | null = null;
    try {
      const { data: createdAuth, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: { name: adminName || 'Administrador' },
      });

      if (createdAuth?.user) {
        authUserId = createdAuth.user.id;
      } else if (authError) {
        // Se já existir no auth.users, atualiza a senha dele
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
        const existing = (userList?.users as any[])?.find((u: any) => u.email?.toLowerCase() === cleanEmail);
        if (existing) {
          await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password,
            user_metadata: { name: adminName || 'Administrador' },
          });
          authUserId = existing.id;
        }
      }
    } catch (authErr) {
      console.warn('Aviso ao sincronizar Supabase Auth:', authErr);
    }

    // 2. Gera um slug seguro para a empresa
    const baseSlug = companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'empresa';
    const slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 3. Inserir a nova empresa na tabela accounts
    const { data: newAcc, error: accError } = await supabaseAdmin
      .from('accounts')
      .insert({
        name: companyName,
        slug,
        segment: companySegment || 'Serviços & Atendimento',
        plan: 'pro',
      })
      .select()
      .single();

    if (accError) {
      return res.status(400).json({ error: `Erro ao criar empresa: ${accError.message}` });
    }

    // 4. Inserir o Administrador Humano e o Agente IA na tabela account_users
    const usersToInsert = [
      {
        account_id: newAcc.id,
        user_id: authUserId || null,
        name: adminName || 'Administrador',
        email: cleanEmail,
        role: 'admin',
        is_ai_agent: false,
      },
      {
        account_id: newAcc.id,
        name: `Agente IA ${newAcc.name}`,
        email: `ia@${newAcc.slug}.com`,
        role: 'ai_agent',
        is_ai_agent: true,
      },
    ];

    const { data: insertedUsers, error: usersError } = await supabaseAdmin
      .from('account_users')
      .insert(usersToInsert)
      .select();

    if (usersError) {
      console.error('Aviso ao registrar operadores:', usersError);
    }

    const adminUser = insertedUsers?.find((u) => !u.is_ai_agent) || {
      id: `usr-${Date.now()}`,
      account_id: newAcc.id,
      name: adminName || 'Administrador',
      email: cleanEmail,
      role: 'admin',
    };

    res.status(201).json({
      success: true,
      account: {
        id: newAcc.id,
        name: newAcc.name,
        slug: newAcc.slug,
        segment: newAcc.segment,
        whatsappPhone: newAcc.whatsapp_phone || '',
        plan: newAcc.plan,
        createdAt: newAcc.created_at,
      },
      user: {
        id: adminUser.id,
        accountId: newAcc.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao registrar' });
  }
});

// Login com verificação rigorosa de e-mail e senha no Supabase Auth
app.post('/api/auth/login', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-mail obrigatório' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Senha obrigatória' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Encontrar todas as contas vinculadas a este e-mail na tabela account_users
    const { data: allUserAccounts } = await supabaseAdmin
      .from('account_users')
      .select('*, accounts(*)')
      .eq('email', cleanEmail);

    if (!allUserAccounts || allUserAccounts.length === 0) {
      return res.status(404).json({ error: 'Nenhum cadastro encontrado com este e-mail. Cadastre sua empresa na aba ao lado.' });
    }

    const validAccounts = allUserAccounts.filter((u: any) => u.accounts);
    if (validAccounts.length === 0) {
      return res.status(404).json({ error: 'Nenhuma empresa ativa associada a este usuário.' });
    }

    // Prefere conta com canais ativos, por exemplo GridPlay F1 ou a primeira vinculada
    const userData = validAccounts.find((u: any) => u.accounts?.name?.includes('GridPlay')) || validAccounts[0];

    // 2. Validação da senha no Supabase Auth
    const anonClient = createClient(cleanSupabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || serviceRoleKey);
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    });

    if (signInError) {
      // Caso de transição: conta criada anteriormente sem cadastro em auth.users
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
      const existingInAuth = (authList?.users as any[])?.find((u: any) => u.email?.toLowerCase() === cleanEmail);

      if (!existingInAuth) {
        // Cria a credencial no Supabase Auth usando a senha fornecida pelo usuário agora
        const { data: newAuthUser } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: password,
          email_confirm: true,
          user_metadata: { name: userData.name },
        });

        if (newAuthUser?.user) {
          await supabaseAdmin
            .from('account_users')
            .update({ user_id: newAuthUser.user.id })
            .eq('id', userData.id);
        }
      } else {
        // Usuário já existe no Auth e a senha digitada não confere
        return res.status(401).json({ error: 'Senha incorreta. Por favor verifique sua senha e tente novamente.' });
      }
    }

    const availableAccounts = validAccounts.map((u: any) => ({
      id: u.accounts.id,
      name: u.accounts.name,
      slug: u.accounts.slug,
      segment: u.accounts.segment,
      whatsappPhone: u.accounts.whatsapp_phone || '',
      plan: u.accounts.plan,
      createdAt: u.accounts.created_at,
    }));

    if (availableAccounts.length > 1) {
      availableAccounts.push({
        id: 'all',
        name: 'Todas as Minhas Empresas (Consolidado)',
        slug: 'todas-minhas-empresas',
        segment: 'Visão Geral Multi-Tenant',
        whatsappPhone: '',
        plan: 'Consolidado',
        createdAt: new Date().toISOString(),
      });
    }

    const acc = userData.accounts;
    return res.json({
      success: true,
      account: {
        id: acc.id,
        name: acc.name,
        slug: acc.slug,
        segment: acc.segment,
        whatsappPhone: acc.whatsapp_phone || '',
        plan: acc.plan,
        createdAt: acc.created_at,
      },
      availableAccounts,
      user: {
        id: userData.id,
        accountId: acc.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha no login' });
  }
});

// Buscar canais reais da empresa logada
app.get('/api/channels', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  try {
    const rawAccountId = req.query.account_id as string;
    const accountIdsParam = req.query.account_ids as string;

    // Se account_id estiver vazio, indefinido ou nulo, NUNCA expõe canais de outras empresas!
    if (!rawAccountId || rawAccountId === '' || rawAccountId === 'undefined' || rawAccountId === 'null') {
      return res.json({ channels: [] });
    }

    let query = supabaseAdmin.from('channels').select('*').order('created_at', { ascending: false });

    if (rawAccountId === 'all') {
      if (accountIdsParam) {
        const ids = accountIdsParam.split(',').map((s) => s.trim()).filter(Boolean);
        if (ids.length > 0) {
          query = query.in('account_id', ids);
        } else {
          return res.json({ channels: [] });
        }
      } else {
        // Visão consolidada sem IDs explícitos de contas não deve vazar canais de outros tenants
        return res.json({ channels: [] });
      }
    } else {
      query = query.eq('account_id', rawAccountId);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ channels: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao buscar canais' });
  }
});

// Excluir / desconectar canal da empresa
app.delete('/api/channels/:id', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  try {
    const channelId = req.params.id;
    const accountId = req.query.account_id as string;

    if (!channelId) {
      return res.status(400).json({ error: 'ID do canal é obrigatório' });
    }

    let query = supabaseAdmin.from('channels').delete().eq('id', channelId);
    if (accountId && accountId !== 'all') {
      query = query.eq('account_id', accountId);
    }

    const { error } = await query;
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, message: 'Canal desconectado com sucesso' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao excluir canal' });
  }
});

// Atualizar dados/nome do canal da empresa (tabela channels)
app.patch('/api/channels/:id', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  try {
    const channelId = req.params.id;
    const { name } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'ID do canal é obrigatório' });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'O nome do canal não pode ser vazio' });
    }

    const { data, error } = await supabaseAdmin
      .from('channels')
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, message: 'Canal atualizado com sucesso', channel: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao atualizar canal' });
  }
});

app.put('/api/channels/:id', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  try {
    const channelId = req.params.id;
    const { name } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'ID do canal é obrigatório' });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'O nome do canal não pode ser vazio' });
    }

    const { data, error } = await supabaseAdmin
      .from('channels')
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, message: 'Canal atualizado com sucesso', channel: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao atualizar canal' });
  }
});

// Conectar novo canal para a empresa
app.post('/api/channels', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  try {
    let { account_id, name, type, config } = req.body;
    if (!account_id || !name || !type) {
      return res.status(400).json({ error: 'account_id, name e type são obrigatórios' });
    }

    if (account_id === 'all') {
      const { data: firstAcc } = await supabaseAdmin.from('accounts').select('id').limit(1).maybeSingle();
      if (firstAcc?.id) {
        account_id = firstAcc.id;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('channels')
      .insert({
        account_id,
        name,
        type,
        is_active: true,
        config: config || {},
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ success: true, channel: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao criar canal' });
  }
});

// Proxy para o gerenciador da Evolution API (suporta ações: create, qr, status, restart, logout)
app.post('/api/evolution/action', async (req, res) => {
  try {
    const { action, instanceName, instance } = req.body;
    if (!action || !instanceName) {
      return res.status(400).json({ error: 'action e instanceName são obrigatórios' });
    }

    const response = await fetch('https://webhook.monarcahub.com/webhook/evo-manager-v4all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        instanceName,
        instance: instance || { state: action },
      }),
    });

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      res.status(response.status).json(data);
    } catch {
      res.status(response.status).send(text);
    }
  } catch (err: any) {
    console.error('Erro no proxy da Evolution:', err);
    res.status(500).json({ error: err?.message || 'Erro ao comunicar com Evolution API' });
  }
});

// Listar mensagens de uma conversa com garantia de service_role e ordenação
app.get('/api/messages', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  const conversationId = String(req.query.conversation_id || '').trim();
  if (!conversationId) {
    return res.status(400).json({ error: 'conversation_id é obrigatório' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ messages: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao buscar mensagens' });
  }
});

// =========================================================================
// HELPERS DE SINCRONIZAÇÃO DE STATUS E COEXISTÊNCIA (EVOLUTION / META / N8N)
// =========================================================================
type StandardMessageStatus = 'sent' | 'delivered' | 'read';

function normalizeWebhookStatus(
  rawStatus: unknown,
  isFromMe: boolean,
  isViewed: boolean = false
): StandardMessageStatus {
  if (isViewed) return 'read';
  const normalized = String(rawStatus ?? '').toLowerCase().trim();
  if (
    normalized === 'read' ||
    normalized === 'played' ||
    normalized === 'seen' ||
    normalized === 'viewed' ||
    normalized === '3' ||
    normalized === '4' ||
    normalized === '5'
  ) {
    return 'read';
  }
  if (
    normalized === 'delivered' ||
    normalized === 'delivery_ack' ||
    normalized === '2'
  ) {
    return 'delivered';
  }
  if (
    normalized === 'sent' ||
    normalized === 'server_ack' ||
    normalized === 'pending' ||
    normalized === '1' ||
    normalized === '0'
  ) {
    return 'sent';
  }
  return isFromMe ? 'sent' : 'delivered';
}

function shouldUpgradeMessageStatus(
  currentStatus: unknown,
  nextStatus: StandardMessageStatus
): boolean {
  const rank: Record<string, number> = {
    pending: 0,
    sent: 1,
    delivered: 2,
    read: 3,
  };
  const currRank = rank[String(currentStatus || '').toLowerCase()] ?? 0;
  const nextRank = rank[nextStatus] ?? 1;
  return nextRank >= currRank;
}

function normalizePhoneDigits(raw: string): string {
  return String(raw || '').split('@')[0].replace(/\D/g, '');
}

async function resolveOrCreateConversationForWebhook(params: {
  conversationId?: string;
  phone: string;
  contactName: string;
  accountId?: string | null;
  channelId?: string | null;
  isFromMe: boolean;
  senderType: string;
  lastMessageText: string;
  nowIso: string;
}): Promise<{ conversationId: string; accountId: string | null; currentUnreadCount: number; currentStatus: string; created: boolean } | null> {
  if (!supabaseAdmin) return null;

  if (params.conversationId) {
    const { data: convById } = await supabaseAdmin
      .from('conversations')
      .select('id, account_id, unread_count, status')
      .eq('id', params.conversationId)
      .maybeSingle();

    if (convById) {
      return {
        conversationId: convById.id,
        accountId: convById.account_id || params.accountId || null,
        currentUnreadCount: Number(convById.unread_count || 0),
        currentStatus: convById.status || 'ai',
        created: false,
      };
    }
  }

  const digits = normalizePhoneDigits(params.phone);
  if (!digits) return null;

  // 1. Tenta localizar o contato pelo telefone na tabela contacts
  let contactsQuery = supabaseAdmin.from('contacts').select('id, account_id, phone');
  if (params.accountId) {
    contactsQuery = contactsQuery.eq('account_id', params.accountId);
  }
  const { data: candidateContacts } = await contactsQuery.limit(500);

  const matchedContact = (candidateContacts || []).find((c: any) => {
    const cDigits = normalizePhoneDigits(c.phone || '');
    return (
      cDigits &&
      (cDigits === digits ||
        (digits.length >= 8 && cDigits.endsWith(digits.slice(-8))) ||
        (cDigits.length >= 8 && digits.endsWith(cDigits.slice(-8))))
    );
  });

  if (matchedContact) {
    let convQuery = supabaseAdmin
      .from('conversations')
      .select('id, account_id, unread_count, status')
      .eq('contact_id', matchedContact.id)
      .order('last_message_at', { ascending: false })
      .limit(1);

    if (params.channelId) {
      convQuery = convQuery.eq('channel_id', params.channelId);
    }

    const { data: existingConvList } = await convQuery;
    const existingConv = existingConvList?.[0];
    if (existingConv) {
      return {
        conversationId: existingConv.id,
        accountId: existingConv.account_id || matchedContact.account_id || params.accountId || null,
        currentUnreadCount: Number(existingConv.unread_count || 0),
        currentStatus: existingConv.status || 'ai',
        created: false,
      };
    }
  }

  // 2. Descobre account_id e channel_id válidos caso não tenham sido enviados
  let targetAccountId = params.accountId || matchedContact?.account_id || null;
  let targetChannelId = params.channelId || null;

  if (!targetChannelId) {
    let chQuery = supabaseAdmin
      .from('channels')
      .select('id, account_id')
      .eq('type', 'whatsapp')
      .limit(1);
    if (targetAccountId) {
      chQuery = chQuery.eq('account_id', targetAccountId);
    }
    const { data: chList } = await chQuery;
    if (chList?.[0]) {
      targetChannelId = chList[0].id;
      if (!targetAccountId) targetAccountId = chList[0].account_id;
    }
  }

  if (!targetAccountId || !targetChannelId) {
    return null;
  }

  let targetContactId = matchedContact?.id || null;
  if (!targetContactId) {
    const { data: newContact, error: contactErr } = await supabaseAdmin
      .from('contacts')
      .insert({
        account_id: targetAccountId,
        name: params.contactName || params.phone,
        phone: params.phone,
      })
      .select('id')
      .single();

    if (contactErr || !newContact) return null;
    targetContactId = newContact.id;
  }

  const initialStatus =
    params.isFromMe && params.senderType !== 'ai' && params.senderType !== 'bot'
      ? 'human'
      : 'ai';

  const { data: newConv, error: convErr } = await supabaseAdmin
    .from('conversations')
    .insert({
      account_id: targetAccountId,
      contact_id: targetContactId,
      channel_id: targetChannelId,
      status: initialStatus,
      crm_stage: 'novo_lead',
      unread_count: params.isFromMe ? 0 : 1,
      last_message_text: params.lastMessageText,
      last_message_at: params.nowIso,
    })
    .select('id, account_id, unread_count, status')
    .single();

  if (convErr || !newConv) return null;

  return {
    conversationId: newConv.id,
    accountId: newConv.account_id || targetAccountId,
    currentUnreadCount: Number(newConv.unread_count || 0),
    currentStatus: newConv.status || initialStatus,
    created: true,
  };
}

async function applyMessageStatusUpdate(params: {
  externalMessageId?: string | null;
  internalMessageId?: string | null;
  conversationId?: string | null;
  status: StandardMessageStatus;
  isFromMe?: boolean;
  clearUnreadOnRead?: boolean;
}): Promise<{ updatedCount: number; conversationId: string | null }> {
  if (!supabaseAdmin) return { updatedCount: 0, conversationId: params.conversationId || null };

  const nowIso = new Date().toISOString();
  const matchedRows: any[] = [];

  if (params.internalMessageId) {
    const { data } = await supabaseAdmin
      .from('messages')
      .select('id, conversation_id, status, sender_type, metadata')
      .eq('id', params.internalMessageId)
      .maybeSingle();
    if (data) matchedRows.push(data);
  }

  if (matchedRows.length === 0 && params.externalMessageId) {
    const extId = String(params.externalMessageId).trim();
    const { data: byWamid } = await supabaseAdmin
      .from('messages')
      .select('id, conversation_id, status, sender_type, metadata')
      .eq('metadata->>wamid', extId)
      .limit(5);
    if (byWamid && byWamid.length > 0) {
      matchedRows.push(...byWamid);
    } else {
      const { data: byMetaId } = await supabaseAdmin
        .from('messages')
        .select('id, conversation_id, status, sender_type, metadata')
        .eq('metadata->>metaMessageId', extId)
        .limit(5);
      if (byMetaId && byMetaId.length > 0) {
        matchedRows.push(...byMetaId);
      }
    }
  }

  let updatedCount = 0;
  let resolvedConvId = params.conversationId || null;

  for (const row of matchedRows) {
    resolvedConvId = resolvedConvId || row.conversation_id;
    if (!shouldUpgradeMessageStatus(row.status, params.status)) {
      continue;
    }

    const updatedMeta = {
      ...(typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {}),
      ...(params.status === 'delivered' ? { delivered_at: nowIso } : {}),
      ...(params.status === 'read' ? { read_at: nowIso } : {}),
    };

    const { error: upErr } = await supabaseAdmin
      .from('messages')
      .update({
        status: params.status,
        metadata: updatedMeta,
      })
      .eq('id', row.id);

    if (!upErr) {
      updatedCount++;
    }
  }

  if (
    resolvedConvId &&
    params.status === 'read' &&
    (params.clearUnreadOnRead !== false || params.isFromMe)
  ) {
    await supabaseAdmin
      .from('conversations')
      .update({
        unread_count: 0,
        updated_at: nowIso,
      })
      .eq('id', resolvedConvId);
  }

  return { updatedCount, conversationId: resolvedConvId };
}

// =========================================================================
// ROTA DO WEBHOOK DE ENTRADA (WHATSAPP CLOUD API / EVOLUTION API / N8N -> CHATSAPP)
// Processa mensagens de clientes, mensagens enviadas pelo celular físico (fromMe / Coexistência),
// sincronização de leitura e atualizações de status ('sent', 'delivered', 'read') em tempo real.
// =========================================================================
app.post(['/api/messages/incoming', '/api/webhooks/incoming', '/api/webhooks/status'], async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  try {
    const body = req.body || {};
    const nowIso = new Date().toISOString();

    // -----------------------------------------------------------------------
    // 1. EVENTOS DE STATUS DA META CLOUD API (value.statuses[])
    // -----------------------------------------------------------------------
    if (body.object === 'whatsapp_business_account') {
      const change = body.entry?.[0]?.changes?.[0];
      const field = String(change?.field || '');
      const value = change?.value || {};

      if (Array.isArray(value.statuses) && value.statuses.length > 0) {
        const results = [];
        for (const st of value.statuses) {
          const normalized = normalizeWebhookStatus(st.status, true);
          const convLookup = st.recipient_id
            ? await resolveOrCreateConversationForWebhook({
                phone: st.recipient_id,
                contactName: st.recipient_id,
                accountId: body.account_id || null,
                channelId: body.channel_id || null,
                isFromMe: true,
                senderType: 'coexistence_mobile',
                lastMessageText: '',
                nowIso,
              }).catch(() => null)
            : null;

          const updateRes = await applyMessageStatusUpdate({
            externalMessageId: st.id,
            conversationId: convLookup?.conversationId || body.conversation_id || null,
            status: normalized,
            isFromMe: true,
            clearUnreadOnRead: true,
          });
          results.push({ id: st.id, status: normalized, ...updateRes });
        }
        return res.status(200).json({ success: true, event: 'meta_statuses', results });
      }

      // Coexistência Meta: smb_message_echoes / message_echoes (mensagens enviadas pelo app no celular)
      const isMetaEcho =
        field === 'smb_message_echoes' ||
        field === 'message_echoes' ||
        Array.isArray(value.message_echoes);

      if (isMetaEcho || Array.isArray(value.messages)) {
        const metaMsg = (isMetaEcho ? value.message_echoes?.[0] : value.messages?.[0]) || value.messages?.[0];
        if (!metaMsg) {
          return res.status(200).json({ success: true, ignored: true, reason: 'Payload Meta sem mensagem' });
        }

        const isFromMe = isMetaEcho || metaMsg.fromMe === true;
        const contactInfo = value.contacts?.[0];
        const rawPhone = isFromMe
          ? metaMsg.to || contactInfo?.wa_id || body.contact_phone || body.phone || ''
          : contactInfo?.wa_id || metaMsg.from || body.contact_phone || body.phone || '';
        const rawName = contactInfo?.profile?.name || body.contact_name || body.sender_name || rawPhone || 'Cliente';

        let parsedContent = '';
        let parsedType = metaMsg.type || 'text';
        let parsedMediaUrl: string | null = null;
        if (metaMsg.type === 'text') parsedContent = metaMsg.text?.body || '';
        else if (metaMsg.type === 'image') {
          parsedContent = metaMsg.image?.caption || 'Foto';
          parsedMediaUrl = metaMsg.image?.link || null;
        } else if (metaMsg.type === 'audio') {
          parsedContent = 'audio';
          parsedMediaUrl = metaMsg.audio?.link || null;
        } else if (metaMsg.type === 'document') {
          parsedContent = metaMsg.document?.filename || 'Documento';
          parsedMediaUrl = metaMsg.document?.link || null;
        } else {
          parsedContent = metaMsg.text?.body || body.content || body.text || `[${parsedType}]`;
        }

        const senderType = isFromMe ? 'coexistence_mobile' : 'contact';
        const messageStatus = normalizeWebhookStatus(
          metaMsg.status || body.status,
          isFromMe,
          Boolean(body.viewed || body.is_read || body.read === true)
        );

        const convInfo = await resolveOrCreateConversationForWebhook({
          conversationId: body.conversation_id,
          phone: rawPhone,
          contactName: rawName,
          accountId: body.account_id || null,
          channelId: body.channel_id || null,
          isFromMe,
          senderType,
          lastMessageText: parsedContent,
          nowIso,
        });

        if (!convInfo) {
          return res.status(400).json({ error: 'Não foi possível localizar ou criar a conversa para este contato' });
        }

        const wamid = metaMsg.id || body.meta_message_id || body.wamid || null;
        if (wamid) {
          const { data: existingByWamid } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('metadata->>wamid', wamid)
            .maybeSingle();

          if (existingByWamid) {
            await applyMessageStatusUpdate({
              internalMessageId: existingByWamid.id,
              conversationId: convInfo.conversationId,
              status: messageStatus,
              isFromMe,
              clearUnreadOnRead: true,
            });
            return res.status(200).json({
              success: true,
              deduplicated: true,
              conversation_id: convInfo.conversationId,
              message: existingByWamid,
            });
          }
        }

        const { data: insertedMsg, error: msgErr } = await supabaseAdmin
          .from('messages')
          .insert({
            account_id: convInfo.accountId,
            conversation_id: convInfo.conversationId,
            sender_type: senderType,
            sender_name: isFromMe ? 'Dispositivo Móvel' : rawName,
            content: parsedContent,
            content_type: parsedType,
            media_url: parsedMediaUrl,
            status: messageStatus,
            created_at: nowIso,
            metadata: {
              channel: 'whatsapp',
              wamid,
              metaMessageId: wamid,
              fromMe: isFromMe,
              viaCoexistence: isFromMe,
              source: isMetaEcho ? 'meta_smb_message_echoes' : 'meta_cloud_api',
            },
          })
          .select('*')
          .single();

        if (msgErr) {
          return res.status(400).json({ error: msgErr.message });
        }

        if (isFromMe) {
          await supabaseAdmin
            .from('messages')
            .update({ status: 'read' })
            .eq('conversation_id', convInfo.conversationId)
            .in('sender_type', ['contact', 'customer'])
            .neq('status', 'read');
        }

        await supabaseAdmin
          .from('conversations')
          .update({
            last_message_text: parsedContent,
            last_message_at: nowIso,
            unread_count: isFromMe ? 0 : convInfo.currentUnreadCount + (convInfo.created ? 0 : 1),
            ...(isFromMe ? { status: 'human' } : {}),
            updated_at: nowIso,
          })
          .eq('id', convInfo.conversationId);

        return res.status(201).json({
          success: true,
          conversation_id: convInfo.conversationId,
          message: insertedMsg,
        });
      }
    }

    // -----------------------------------------------------------------------
    // 2. EVENTOS EVOLUTION API: messages.update (ACK) & chats.update (LEITURA NO CELULAR)
    // -----------------------------------------------------------------------
    const evoEvent = String(body.event || '').toLowerCase().trim();
    if (
      evoEvent === 'messages.update' ||
      body.type === 'status_update' ||
      (body.status && (body.meta_message_id || body.wamid || body.message_id) && !body.content && !body.text && !body.message)
    ) {
      const updateData = Array.isArray(body.data) ? body.data[0] : body.data || body;
      const rawSt =
        updateData?.update?.status ??
        updateData?.status ??
        body.status;
      const extMsgId =
        updateData?.keyId ||
        updateData?.key?.id ||
        updateData?.id ||
        body.meta_message_id ||
        body.wamid ||
        body.message_id;
      const isFromMeUpdate = Boolean(
        updateData?.fromMe ??
          updateData?.key?.fromMe ??
          body.fromMe ??
          body.from_me
      );
      const nextStatus = normalizeWebhookStatus(rawSt, isFromMeUpdate);

      let convId = body.conversation_id || null;
      const remotePhone = updateData?.remoteJid || updateData?.key?.remoteJid || body.phone || body.contact_phone || '';
      if (!convId && remotePhone) {
        const convLookup = await resolveOrCreateConversationForWebhook({
          phone: remotePhone,
          contactName: remotePhone,
          accountId: body.account_id || null,
          channelId: body.channel_id || null,
          isFromMe: true,
          senderType: 'coexistence_mobile',
          lastMessageText: '',
          nowIso,
        }).catch(() => null);
        convId = convLookup?.conversationId || null;
      }

      const result = await applyMessageStatusUpdate({
        externalMessageId: extMsgId,
        internalMessageId: body.message_id && !String(body.message_id).startsWith('wamid') ? body.message_id : null,
        conversationId: convId,
        status: nextStatus,
        isFromMe: isFromMeUpdate,
        clearUnreadOnRead: true,
      });

      return res.status(200).json({
        success: true,
        event: 'status_update',
        status: nextStatus,
        ...result,
      });
    }

    if (
      evoEvent === 'chats.update' ||
      evoEvent === 'chats.upsert' ||
      body.action === 'mark_read' ||
      body.mark_read === true
    ) {
      const chatData = Array.isArray(body.data) ? body.data[0] : body.data || body;
      const unreadVal = chatData?.unreadCount ?? chatData?.unread_count ?? body.unread_count;
      const chatPhone = chatData?.id || chatData?.remoteJid || body.phone || body.contact_phone || '';
      if (unreadVal === 0 || body.action === 'mark_read' || body.mark_read === true) {
        const convLookup = await resolveOrCreateConversationForWebhook({
          conversationId: body.conversation_id,
          phone: chatPhone,
          contactName: chatPhone,
          accountId: body.account_id || null,
          channelId: body.channel_id || null,
          isFromMe: true,
          senderType: 'coexistence_mobile',
          lastMessageText: '',
          nowIso,
        }).catch(() => null);

        if (convLookup?.conversationId) {
          await supabaseAdmin
            .from('conversations')
            .update({ unread_count: 0, updated_at: nowIso })
            .eq('id', convLookup.conversationId);

          await supabaseAdmin
            .from('messages')
            .update({ status: 'read' })
            .eq('conversation_id', convLookup.conversationId)
            .in('sender_type', ['contact', 'customer'])
            .neq('status', 'read');

          return res.status(200).json({
            success: true,
            event: 'chat_read_sync',
            conversation_id: convLookup.conversationId,
            unread_count: 0,
          });
        }
      }
      return res.status(200).json({ success: true, ignored: true, event: evoEvent });
    }

    // -----------------------------------------------------------------------
    // 3. MENSAGEM NORMALIZADA (N8N / EVOLUTION API messages.upsert / COEXISTÊNCIA)
    // -----------------------------------------------------------------------
    const {
      conversation_id,
      phone,
      contact_phone,
      contact_name,
      sender_name,
      content,
      text,
      content_type = 'text',
      media_url,
      account_id,
      channel_id,
      sender_type: rawSenderType,
      status: rawStatus,
      fromMe,
      from_me,
      is_from_me,
      wamid: rawWamid,
      meta_message_id,
      message_id,
      viewed,
      is_read,
      read,
    } = body;

    const evoKey = body.data?.key || body.key || {};
    const evoMsg = body.data?.message || {};

    const detectedFromMe = Boolean(
      fromMe === true ||
        from_me === true ||
        is_from_me === true ||
        evoKey?.fromMe === true ||
        body.data?.fromMe === true ||
        body.metadata?.fromMe === true ||
        body.metadata?.viaCoexistence === true ||
        ['coexistence_mobile', 'agent', 'ai', 'bot', 'mobile', 'device', 'celular'].includes(
          String(rawSenderType || '').toLowerCase().trim()
        )
    );

    const normalizedRawSender = String(rawSenderType || '').toLowerCase().trim();
    const resolvedSenderType = detectedFromMe
      ? normalizedRawSender === 'ai' || normalizedRawSender === 'bot'
        ? normalizedRawSender
        : normalizedRawSender === 'agent'
        ? 'agent'
        : 'coexistence_mobile'
      : 'contact';

    const actualPhone =
      phone ||
      contact_phone ||
      (evoKey?.remoteJid ? String(evoKey.remoteJid).split('@')[0] : '') ||
      body.sender ||
      '';
    const actualName =
      contact_name ||
      sender_name ||
      body.data?.pushName ||
      (detectedFromMe ? 'Dispositivo Móvel' : 'Cliente');
    const actualContent =
      content ||
      text ||
      evoMsg?.conversation ||
      evoMsg?.extendedTextMessage?.text ||
      evoMsg?.imageMessage?.caption ||
      (evoMsg?.audioMessage ? 'audio' : '') ||
      '';
    const actualContentType =
      content_type ||
      (evoMsg?.audioMessage ? 'audio' : evoMsg?.imageMessage ? 'image' : evoMsg?.documentMessage ? 'document' : 'text');

    const resolvedStatus = normalizeWebhookStatus(
      rawStatus ?? body.data?.status ?? body.data?.update?.status,
      detectedFromMe,
      Boolean(viewed || is_read || read === true)
    );

    const externalId = meta_message_id || rawWamid || evoKey?.id || message_id || null;

    const convInfo = await resolveOrCreateConversationForWebhook({
      conversationId: conversation_id,
      phone: actualPhone,
      contactName: actualName,
      accountId: account_id || null,
      channelId: channel_id || null,
      isFromMe: detectedFromMe,
      senderType: resolvedSenderType,
      lastMessageText: actualContent,
      nowIso,
    });

    if (!convInfo) {
      return res.status(400).json({ error: 'conversation_id ou phone é obrigatório' });
    }

    // Idempotência por wamid / meta_message_id para não duplicar em reenvios do webhook
    if (externalId) {
      const { data: existingMsg } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('metadata->>wamid', String(externalId))
        .maybeSingle();

      if (existingMsg) {
        await applyMessageStatusUpdate({
          internalMessageId: existingMsg.id,
          conversationId: convInfo.conversationId,
          status: resolvedStatus,
          isFromMe: detectedFromMe,
          clearUnreadOnRead: true,
        });
        if (detectedFromMe) {
          await supabaseAdmin
            .from('conversations')
            .update({ unread_count: 0, updated_at: nowIso })
            .eq('id', convInfo.conversationId);
        }
        return res.status(200).json({
          success: true,
          deduplicated: true,
          conversation_id: convInfo.conversationId,
          message: existingMsg,
        });
      }
    }

    // Insere a mensagem na tabela messages já com sender_type e status corretos
    const { data: insertedMsg, error: msgErr } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: convInfo.conversationId,
        content: actualContent,
        content_type: actualContentType,
        media_url: media_url || null,
        sender_type: resolvedSenderType,
        sender_name: actualName,
        status: resolvedStatus,
        account_id: convInfo.accountId,
        created_at: nowIso,
        metadata: {
          ...(typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {}),
          wamid: externalId,
          metaMessageId: externalId,
          fromMe: detectedFromMe,
          viaCoexistence: resolvedSenderType === 'coexistence_mobile',
          source: detectedFromMe ? 'coexistence_webhook' : 'incoming_webhook',
        },
      })
      .select('*')
      .single();

    if (msgErr) {
      return res.status(400).json({ error: msgErr.message });
    }

    // Se a interação veio do celular físico / atendente, marca mensagens anteriores do cliente como lidas
    if (detectedFromMe && resolvedSenderType !== 'ai' && resolvedSenderType !== 'bot') {
      await supabaseAdmin
        .from('messages')
        .update({ status: 'read' })
        .eq('conversation_id', convInfo.conversationId)
        .in('sender_type', ['contact', 'customer'])
        .neq('status', 'read');
    }

    // Atualiza a conversa: zera unread_count se fromMe/celular físico/IA, ou incrementa se cliente
    const nextUnreadCount = detectedFromMe
      ? 0
      : convInfo.created
      ? 1
      : convInfo.currentUnreadCount + 1;

    const convPatch: Record<string, any> = {
      last_message_text: actualContent,
      last_message_at: nowIso,
      unread_count: nextUnreadCount,
      updated_at: nowIso,
    };

    if (detectedFromMe && resolvedSenderType !== 'ai' && resolvedSenderType !== 'bot') {
      convPatch.status = 'human';
    }

    await supabaseAdmin
      .from('conversations')
      .update(convPatch)
      .eq('id', convInfo.conversationId);

    res.status(201).json({
      success: true,
      conversation_id: convInfo.conversationId,
      fromMe: detectedFromMe,
      unread_count: nextUnreadCount,
      message: insertedMsg,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao processar mensagem recebida' });
  }
});

// =========================================================================
// ROTAS DO CÉREBRO DA IA (cerebro_ia)
// =========================================================================
app.get('/api/ai-brain', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  const accountId = String(req.query.account_id || '').trim();
  if (!accountId) {
    return res.status(400).json({ error: 'account_id é obrigatório' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('cerebro_ia')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return res.status(400).json({ error: error.message });
    }

    res.json({ config: data || null });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao consultar cérebro da IA' });
  }
});

app.post('/api/ai-brain', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  const { account_id, ...configData } = req.body;
  if (!account_id) {
    return res.status(400).json({ error: 'account_id é obrigatório' });
  }

  try {
    const payload = {
      account_id,
      ...configData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('cerebro_ia')
      .upsert(payload, { onConflict: 'account_id' })
      .select('*')
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ success: true, config: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao salvar cérebro da IA' });
  }
});

// Alteração rápida de status da IA (Geral ou por Empresa)
// =========================================================================
// STATUS GERAL DA IA DA EMPRESA (PAUSAR / ATIVAR EM TODOS OS CANAIS)
// =========================================================================
app.post('/api/ai-brain/toggle-status', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  const { is_active, account_id } = req.body;
  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active (boolean) é obrigatório' });
  }

  try {
    let targetAccId = account_id;
    if (!targetAccId) {
      // Se não veio account_id, obtém a primeira empresa
      const { data: firstAcc } = await supabaseAdmin.from('accounts').select('id').limit(1).maybeSingle();
      targetAccId = firstAcc?.id;
    }

    if (!targetAccId) {
      return res.status(400).json({ error: 'account_id é obrigatório para alterar status da IA' });
    }

    // 1. Atualiza na tabela cerebro_ia para esta empresa
    const { data: brainData, error: brainError } = await supabaseAdmin
      .from('cerebro_ia')
      .update({
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', targetAccId)
      .select('*');

    if (brainError) {
      console.warn('Aviso ao atualizar cerebro_ia:', brainError.message);
    }

    // 2. Atualiza todos os canais conectados desta empresa (config.ai_enabled = is_active)
    const { data: channelRows } = await supabaseAdmin
      .from('channels')
      .select('id, config')
      .eq('account_id', targetAccId);

    if (channelRows && channelRows.length > 0) {
      for (const ch of channelRows) {
        const updatedConfig = { ...(ch.config || {}), ai_enabled: is_active };
        await supabaseAdmin
          .from('channels')
          .update({
            config: updatedConfig,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ch.id);
      }
    }

    return res.json({
      success: true,
      account_id: targetAccId,
      is_active,
      updated_channels_count: channelRows?.length || 0,
      config: brainData?.[0] || null,
    });
  } catch (err: any) {
    console.error('Erro em toggle-status:', err);
    res.status(500).json({ error: err?.message || 'Erro ao alterar status da IA' });
  }
});

// =========================================================================
// ROTA DE FERRAMENTAS & CONSUMO REAL (MULTI-EMPRESA)
// =========================================================================
app.get('/api/tools/overview', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  const accountId = String(req.query.account_id || '').trim();
  if (!accountId) {
    return res.status(400).json({ error: 'account_id é obrigatório' });
  }

  try {
    // 1. Mensagens reais
    const { count: totalMessages } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId);

    const { count: aiMessages } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .in('sender_type', ['ai', 'bot']);

    const { count: agentMessages } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .in('sender_type', ['agent', 'coexistence_mobile']);

    const { count: customerMessages } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .in('sender_type', ['contact', 'customer']);

    // 2. Total de conversas
    const { count: totalConversations } = await supabaseAdmin
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId);

    // 3. Canais
    const { data: channels } = await supabaseAdmin
      .from('channels')
      .select('id, is_active')
      .eq('account_id', accountId);

    const totalChannels = channels?.length || 0;
    const activeChannels = channels?.filter((c: any) => c.is_active !== false).length || 0;

    // 4. Cérebro & Usuários Extras
    const { data: cerebro } = await supabaseAdmin
      .from('cerebro_ia')
      .select('extra_users_count, is_active')
      .eq('account_id', accountId)
      .maybeSingle();

    // 5. Conta
    const { data: account } = await supabaseAdmin
      .from('accounts')
      .select('id, name, plan, created_at, segment, whatsapp_phone')
      .eq('id', accountId)
      .maybeSingle();

    res.json({
      metrics: {
        totalMessages: totalMessages || 0,
        aiMessages: aiMessages || 0,
        agentMessages: agentMessages || 0,
        customerMessages: customerMessages || 0,
        totalConversations: totalConversations || 0,
        totalChannels,
        activeChannels,
        extraUsersCount: cerebro?.extra_users_count || 0,
        isAIActive: cerebro?.is_active ?? true,
        plan: account?.plan || 'pro',
        createdAt: account?.created_at,
        accountName: account?.name,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao carregar dados de consumo' });
  }
});

// =========================================================================
// PAUSAR OU ATIVAR A IA EM UM CANAL CONECTADO ESPECÍFICO
// =========================================================================
app.post('/api/channels/toggle-ai', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  const { channel_id, ai_enabled, account_id } = req.body;
  if (!channel_id) {
    return res.status(400).json({ error: 'channel_id é obrigatório' });
  }
  if (typeof ai_enabled !== 'boolean') {
    return res.status(400).json({ error: 'ai_enabled (boolean) é obrigatório' });
  }

  try {
    // 1. Busca o canal
    const { data: channel, error: fetchErr } = await supabaseAdmin
      .from('channels')
      .select('*')
      .eq('id', channel_id)
      .single();

    if (fetchErr || !channel) {
      return res.status(404).json({ error: 'Canal não encontrado' });
    }

    const currentAccountId = account_id || channel.account_id;
    const newConfig = { ...(channel.config || {}), ai_enabled };

    // 2. Atualiza o canal com o novo status de IA
    const { data: updatedChannel, error: updateErr } = await supabaseAdmin
      .from('channels')
      .update({
        config: newConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channel_id)
      .select('*')
      .single();

    if (updateErr) {
      return res.status(400).json({ error: updateErr.message });
    }

    // 3. Verifica o status consolidado de todos os canais da empresa para manter cerebro_ia em sincronia
    let hasAnyActive = ai_enabled;
    let allActive = ai_enabled;
    if (currentAccountId) {
      const { data: allChannels } = await supabaseAdmin
        .from('channels')
        .select('id, config')
        .eq('account_id', currentAccountId);

      if (allChannels && allChannels.length > 0) {
        hasAnyActive = allChannels.some((c) => c.config?.ai_enabled !== false);
        allActive = allChannels.every((c) => c.config?.ai_enabled !== false);
      }

      await supabaseAdmin
        .from('cerebro_ia')
        .update({
          is_active: hasAnyActive,
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', currentAccountId);
    }

    return res.json({
      success: true,
      channel: updatedChannel,
      hasAnyActive,
      allActive,
    });
  } catch (err: any) {
    console.error('Erro em toggle-ai do canal:', err);
    res.status(500).json({ error: err?.message || 'Erro ao alterar IA do canal' });
  }
});

// =========================================================================
// ROTA DE SUCESSO DO EMBEDDED SIGNUP (META WHATSAPP COEXISTÊNCIA)
// Envia e sincroniza dados com https://webhook.monarcahub.com/webhook/whatsapp-setup
// =========================================================================
app.post('/api/meta/whatsapp-setup', async (req, res) => {
  const WEBHOOK_URL = 'https://webhook.monarcahub.com/webhook/whatsapp-setup';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const webhookRes = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ChatsApp-Meta-Embedded-Signup/1.0',
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const resText = await webhookRes.text();
    return res.json({
      success: webhookRes.ok,
      status: webhookRes.status,
      response: resText,
    });
  } catch (err: any) {
    console.error('Erro ao repassar webhook da Meta:', err);
    return res.status(500).json({ error: err?.message || 'Erro ao repassar webhook da Meta' });
  }
});


// =========================================================================
// ROTA DO WEBHOOK DE SAÍDA (CHATSAPP -> N8N / WHATSAPP CLOUD API)
// URL oficial: https://webhook.monarcahub.com/webhook/chatsapp_saidas
// Retorna o wamid (ID oficial da Meta retornado pelo responseNode do n8n)
// =========================================================================
const DEFAULT_OUTGOING_WEBHOOK = 'https://webhook.monarcahub.com/webhook/chatsapp_saidas';

app.post('/api/messages/send-outgoing', async (req, res) => {
  const {
    webhookUrl = DEFAULT_OUTGOING_WEBHOOK,
    conversation_id,
    channel_id,
    contact_id,
    contact_name,
    contact_phone,
    phone,
    content,
    message,
    content_type = 'text',
    sender_type = 'agent',
    sender_name = 'Atendente Humano',
    account_id,
    message_id,
  } = req.body;

  const actualContent = typeof content === 'string' && content.trim() ? content : (typeof message === 'string' ? message : '');
  const actualContentType = content_type || 'text';
  const actualPhone = contact_phone || phone || '';

  // Formata o payload conforme especificação do n8n / ChatsApp
  const payload: any = {
    conversation_id,
    channel_id: channel_id || '',
    contact_name: contact_name || 'Cliente',
    contact_phone: actualPhone,
    content: actualContent,
    message: Array.isArray(message)
      ? message
      : [
          {
            content: actualContent,
            content_type: actualContentType,
          },
        ],
    content_type: actualContentType,
    sender_type: sender_type || 'agent',
    sender_name: sender_name || 'Atendente Humano',
    account_id,
    message_id,
    timestamp: req.body.timestamp || new Date().toISOString(),
  };

  if (contact_id) {
    payload.contact_id = contact_id;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const targetUrl = webhookUrl || DEFAULT_OUTGOING_WEBHOOK;
    const webhookRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ChatsApp-Web-Client/2.0',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const resText = await webhookRes.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch {
      resJson = { raw: resText };
    }

    // Extrai o wamid retornado pelo responseNode do n8n em múltiplos formatos aceitos
    let wamid = '';
    if (typeof resJson === 'object' && resJson !== null) {
      if (typeof resJson.wamid === 'string') {
        wamid = resJson.wamid;
      } else if (typeof resJson.id === 'string' && (resJson.id.startsWith('wamid') || resJson.id.length > 15)) {
        wamid = resJson.id;
      } else if (resJson.messages && Array.isArray(resJson.messages) && resJson.messages[0]?.id) {
        wamid = resJson.messages[0].id;
      } else if (resJson.data?.wamid) {
        wamid = resJson.data.wamid;
      } else if (resJson.data?.id) {
        wamid = String(resJson.data.id);
      } else if (resJson.meta_message_id) {
        wamid = resJson.meta_message_id;
      }
    } else if (typeof resJson === 'string' && resJson.startsWith('wamid')) {
      wamid = resJson;
    }

    return res.json({
      success: webhookRes.ok,
      status: webhookRes.status,
      wamid: wamid || null,
      data: resJson,
    });
  } catch (err: any) {
    console.warn('[Webhook Outgoing Exception]:', err.message);
    return res.status(502).json({
      success: false,
      error: err?.message || 'Falha na comunicação com webhook n8n',
      wamid: null,
    });
  }
});

// =========================================================================
// ROTA DE PROXY E TRANSCODIFICAÇÃO DE ÁUDIO (.OGG / .OPUS / .MP3 / .WAV)
// Resolve problemas de CORS, Range requests e incompatibilidade com navegadores como Safari
// =========================================================================
app.options('/api/audio-proxy', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.sendStatus(204);
});

app.get('/api/audio-proxy', async (req, res) => {
  const audioUrl = req.query.url as string;
  const requestedFormat = (req.query.format as string) || 'auto';

  if (!audioUrl) {
    return res.status(400).json({ error: 'URL do áudio é obrigatória' });
  }

  try {
    // Se o cliente explicitamente solicitou MP3 (ou se for fallback de compatibilidade para Safari)
    if (requestedFormat === 'mp3') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const ffmpeg = spawn('ffmpeg', [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', audioUrl,
        '-vn',
        '-acodec', 'libmp3lame',
        '-b:a', '128k',
        '-f', 'mp3',
        'pipe:1',
      ]);

      ffmpeg.stdout.pipe(res);

      ffmpeg.stderr.on('data', () => {
        // suprime logs verbosos de progresso
      });

      ffmpeg.on('error', (err) => {
        console.warn('[Audio Transcode Error]:', err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Falha na transcodificação do áudio' });
        }
      });

      req.on('close', () => {
        try {
          ffmpeg.kill();
        } catch {}
      });

      return;
    }

    // Modo direto com suporte a range e headers de streaming
    const rangeHeader = req.headers.range;
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
    };
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    let audioResponse = await fetch(audioUrl, {
      method: 'GET',
      headers: fetchHeaders,
      redirect: 'follow',
    });

    // Se falhou ao buscar com Range (ex: 416 Range Not Satisfiable), tenta sem o cabeçalho Range
    if (!audioResponse.ok && audioResponse.status !== 206 && rangeHeader) {
      delete fetchHeaders['Range'];
      audioResponse = await fetch(audioUrl, {
        method: 'GET',
        headers: fetchHeaders,
        redirect: 'follow',
      });
    }

    if (!audioResponse.ok && audioResponse.status !== 206) {
      return res.status(audioResponse.status).json({ error: 'Falha ao buscar áudio na origem' });
    }

    let contentType = audioResponse.headers.get('content-type') || '';
    if (!contentType || contentType.includes('application/octet-stream') || contentType.includes('text/plain')) {
      if (audioUrl.toLowerCase().includes('.ogg') || audioUrl.toLowerCase().includes('.opus')) {
        contentType = 'audio/ogg';
      } else if (audioUrl.toLowerCase().includes('.mp3')) {
        contentType = 'audio/mpeg';
      } else if (audioUrl.toLowerCase().includes('.wav')) {
        contentType = 'audio/wav';
      } else if (audioUrl.toLowerCase().includes('.m4a')) {
        contentType = 'audio/mp4';
      } else {
        contentType = 'audio/ogg';
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');

    const contentLength = audioResponse.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    const contentRange = audioResponse.headers.get('content-range');
    if (contentRange) {
      res.status(206);
      res.setHeader('Content-Range', contentRange);
    } else {
      res.status(audioResponse.status);
    }

    if (audioResponse.body) {
      const stream = Readable.fromWeb(audioResponse.body as any);
      stream.pipe(res);
    } else {
      const arrayBuffer = await audioResponse.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    }
    return;
  } catch (err: any) {
    console.error('[Audio Proxy Error]:', err.message);
    return res.status(500).json({ error: 'Erro ao processar áudio: ' + err.message });
  }
});

// =========================================================================
// ATUALIZAÇÃO DE CREDENCIAIS (LOGIN & SENHA) DO USUÁRIO
// =========================================================================
app.post('/api/auth/update-credentials', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  try {
    const { userId, email, newPassword, name } = req.body;
    if (!userId && !email) {
      return res.status(400).json({ error: 'Identificador do usuário ou e-mail é obrigatório' });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : undefined;

    // 1. Atualizar registro em account_users
    let query = supabaseAdmin.from('account_users').update({
      ...(name ? { name } : {}),
      ...(cleanEmail ? { email: cleanEmail } : {}),
    });

    if (userId) {
      query = query.eq('id', userId);
    } else if (cleanEmail) {
      query = query.eq('email', cleanEmail);
    }
    const { error: userTableErr } = await query;
    if (userTableErr) {
      console.warn('Aviso ao atualizar account_users:', userTableErr.message);
    }

    // 2. Atualizar senha no Supabase Auth caso fornecida
    if (newPassword && typeof newPassword === 'string' && newPassword.length >= 6) {
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
      const existingInAuth = (authList?.users as any[])?.find(
        (u: any) => u.id === userId || (cleanEmail && u.email?.toLowerCase() === cleanEmail)
      );

      if (existingInAuth) {
        await supabaseAdmin.auth.admin.updateUserById(existingInAuth.id, {
          password: newPassword,
          ...(cleanEmail ? { email: cleanEmail } : {}),
          ...(name ? { user_metadata: { name } } : {}),
        });
      } else if (cleanEmail) {
        await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: newPassword,
          email_confirm: true,
          user_metadata: { name: name || 'Administrador' },
        });
      }
    }

    return res.json({
      success: true,
      message: 'Credenciais atualizadas com sucesso!',
      user: {
        name,
        email: cleanEmail,
      },
    });
  } catch (err: any) {
    console.error('Erro ao atualizar credenciais:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao atualizar credenciais' });
  }
});

// =========================================================================
// SETUP DO VITE (DEV vs PROD)
// =========================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ChatsApp Server running on port ${PORT}`);
  });

  const gracefulShutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

startServer();
