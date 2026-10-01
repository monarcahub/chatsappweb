import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey || '').trim();

const hasSupabaseUrl = Boolean(supabaseUrl && supabaseUrl.startsWith('https://'));
const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 10);
const hasAnonKey = Boolean(supabaseAnonKey && supabaseAnonKey.length > 10);
const isServerSupabaseConfigured = Boolean(hasSupabaseUrl && (hasServiceRoleKey || hasAnonKey));

const supabaseAdmin: SupabaseClient = isServerSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-key', { auth: { persistSession: false } });

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  if (!isServerSupabaseConfigured) {
    return res.status(503).json({ error: 'Supabase não configurado nas variáveis de ambiente da Vercel.' });
  }

  try {
    const { companyName, companySegment, adminName, email, password } = req.body || {};

    if (!companyName || !email) {
      return res.status(400).json({ error: 'Nome da empresa e e-mail são obrigatórios' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'A senha é obrigatória e deve ter pelo menos 6 caracteres' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Criar ou atualizar usuário no Supabase Auth com a senha digitada
    let authUserId: string | null = null;
    if (hasServiceRoleKey) {
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
    }

    // 2. Slug único
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
        name: `Agente IA - ${companyName}`,
        email: `ia.${slug}@monarcahub.com`,
        role: 'ai_agent',
        is_ai_agent: true,
      },
    ];

    const { data: insertedUsers, error: usersError } = await supabaseAdmin
      .from('account_users')
      .insert(usersToInsert)
      .select();

    if (usersError) {
      console.warn('Erro ao inserir account_users:', usersError);
    }

    const adminUser = insertedUsers?.find((u) => !u.is_ai_agent) || {
      id: `usr-${Date.now()}`,
      name: adminName || 'Administrador',
      email: cleanEmail,
      role: 'admin',
    };

    // 5. Inicializar o Cérebro da IA para a nova empresa
    try {
      await supabaseAdmin.from('cerebro_ia').upsert(
        {
          account_id: newAcc.id,
          business_name: companyName,
          tone_of_voice: 'Amigável, consultiva e profissional',
          is_active: true,
          faq_text: 'Olá! Sou a assistente inteligente do atendimento. Como posso te ajudar hoje?',
          knowledge_base: [],
        },
        { onConflict: 'account_id' }
      );
    } catch (brainErr) {
      console.warn('Aviso ao inicializar cerebro_ia:', brainErr);
    }

    return res.status(200).json({
      success: true,
      account: {
        id: newAcc.id,
        name: newAcc.name,
        slug: newAcc.slug,
        segment: newAcc.segment,
        whatsappPhone: newAcc.whatsapp_phone || '',
        plan: newAcc.plan || 'Plano Pro Omnichannel',
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
    console.error('Erro na rota /api/auth/register:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao registrar' });
  }
}
