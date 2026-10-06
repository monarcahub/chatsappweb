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
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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

    // 1. Tentar encontrar na tabela account_users
    const { data: userData, error: userErr } = await supabaseAdmin
      .from('account_users')
      .select('*, accounts(*)')
      .eq('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    if (!userData || !userData.accounts) {
      return res.status(404).json({ error: 'Nenhum cadastro encontrado com este e-mail. Cadastre sua empresa na aba ao lado.' });
    }

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
    const accountId = req.query.account_id as string;
    let query = supabaseAdmin.from('channels').select('*').order('created_at', { ascending: false });

    if (accountId) {
      query = query.eq('account_id', accountId);
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

// Conectar novo canal para a empresa
app.post('/api/channels', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  try {
    const { account_id, name, type, config } = req.body;
    if (!account_id || !name || !type) {
      return res.status(400).json({ error: 'account_id, name e type são obrigatórios' });
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
// ROTA DO WEBHOOK DE ENTRADA (WHATSAPP CLOUD API / N8N -> CHATSAPP)
// Recebe mensagens recebidas de clientes e grava no Supabase com disparo em Realtime
// =========================================================================
app.post(['/api/messages/incoming', '/api/webhooks/incoming'], async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Supabase admin não configurado' });
  }

  try {
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
    } = req.body;

    const actualPhone = phone || contact_phone || '';
    const actualName = contact_name || sender_name || 'Cliente';
    const actualContent = content || text || '';
    const actualContentType = content_type || 'text';

    let targetConvId = conversation_id;

    // Se conversation_id não foi passado mas veio o telefone, busca ou cria a conversa
    if (!targetConvId && actualPhone) {
      const { data: existingConv } = await supabaseAdmin
        .from('conversations')
        .select('id, unread_count')
        .eq('contact_phone', actualPhone)
        .maybeSingle();

      if (existingConv) {
        targetConvId = existingConv.id;
      } else {
        const { data: newConv, error: convErr } = await supabaseAdmin
          .from('conversations')
          .insert({
            contact_name: actualName,
            contact_phone: actualPhone,
            channel: 'whatsapp',
            status: 'ai',
            unread_count: 1,
            account_id: account_id || null,
            last_message_text: actualContent,
            last_message_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (convErr) {
          return res.status(400).json({ error: convErr.message });
        }
        targetConvId = newConv.id;
      }
    }

    if (!targetConvId) {
      return res.status(400).json({ error: 'conversation_id ou phone é obrigatório' });
    }

    // Insere a mensagem na tabela messages
    const { data: insertedMsg, error: msgErr } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: targetConvId,
        content: actualContent,
        content_type: actualContentType,
        media_url: media_url || null,
        sender_type: 'contact',
        sender_name: actualName,
        status: 'delivered',
        account_id: account_id || null,
      })
      .select('*')
      .single();

    if (msgErr) {
      return res.status(400).json({ error: msgErr.message });
    }

    // Atualiza a conversa com a última mensagem e incrementa o contador
    await supabaseAdmin
      .from('conversations')
      .update({
        last_message_text: actualContent,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', targetConvId);

    res.status(201).json({
      success: true,
      conversation_id: targetConvId,
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
      server: { middlewareMode: true, hmr: false },
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
