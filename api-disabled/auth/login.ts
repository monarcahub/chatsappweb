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

const supabaseAnon: SupabaseClient = (hasSupabaseUrl && hasAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })
  : supabaseAdmin;

export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  if (!isServerSupabaseConfigured) {
    return res.status(503).json({
      error:
        'Supabase não configurado nas variáveis de ambiente da Vercel. Certifique-se de configurar VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_ANON_KEY).',
      debug: {
        hasSupabaseUrl,
        hasServiceRoleKey,
        hasAnonKey,
      },
    });
  }

  try {
    const { email, password } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'E-mail obrigatório' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Senha obrigatória' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Tentar encontrar na tabela account_users
    let { data: userData } = await supabaseAdmin
      .from('account_users')
      .select('*, accounts(*)')
      .eq('email', cleanEmail)
      .limit(1)
      .maybeSingle();

    // Se for o gestor principal e ainda não tiver registro em account_users, vincula à primeira empresa
    if (!userData || !userData.accounts) {
      const { data: defaultCompany } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (defaultCompany) {
        const { data: newUser } = await supabaseAdmin
          .from('account_users')
          .insert({
            account_id: defaultCompany.id,
            name: cleanEmail.split('@')[0],
            email: cleanEmail,
            role: 'admin',
            is_ai_agent: false,
          })
          .select('*, accounts(*)')
          .single();

        userData = newUser;
      }
    }

    if (!userData || !userData.accounts) {
      return res.status(404).json({
        error: 'Nenhum cadastro encontrado com este e-mail. Cadastre sua empresa na aba ao lado.',
      });
    }

    // 2. Validação da senha no Supabase Auth
    let authValid = false;
    let authErrorMessage = '';

    // Tentar login com senha no Supabase Auth
    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email: cleanEmail,
      password: String(password),
    });

    if (signInData?.user) {
      authValid = true;
    } else if (signInError) {
      authErrorMessage = signInError.message;

      // Caso de transição: conta criada anteriormente no account_users sem credencial em auth.users
      if (hasServiceRoleKey) {
        try {
          const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
          const existingInAuth = (authList?.users as any[])?.find(
            (u: any) => u.email?.toLowerCase() === cleanEmail
          );

          if (!existingInAuth) {
            // Cria a credencial no Supabase Auth usando a senha fornecida pelo usuário agora
            const { data: newAuthUser, error: createAuthErr } =
              await supabaseAdmin.auth.admin.createUser({
                email: cleanEmail,
                password: String(password),
                email_confirm: true,
                user_metadata: { name: userData.name },
              });

            if (newAuthUser?.user) {
              await supabaseAdmin
                .from('account_users')
                .update({ user_id: newAuthUser.user.id })
                .eq('id', userData.id);
              authValid = true;
            } else if (createAuthErr) {
              console.warn('Erro ao criar usuário no auth.admin:', createAuthErr.message);
            }
          } else {
            // Usuário existe no Auth mas a senha não confere
            return res.status(401).json({
              error: 'Senha incorreta. Por favor verifique sua senha e tente novamente.',
              supabaseError: signInError.message,
            });
          }
        } catch (adminErr: any) {
          console.error('Erro ao verificar auth.admin:', adminErr);
        }
      } else {
        return res.status(401).json({
          error:
            signInError.message.includes('Invalid login credentials')
              ? 'Senha incorreta. Por favor verifique sua senha e tente novamente.'
              : `Erro de autenticação: ${signInError.message}`,
        });
      }
    }

    if (!authValid) {
      return res.status(401).json({
        error: 'Senha incorreta ou erro de autenticação.',
        supabaseError: authErrorMessage,
      });
    }

    // Busca todas as empresas disponíveis no banco para permitir alternância (Multi-Tenant)
    const { data: allAccountsData } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .order('name', { ascending: true });

    const availableAccounts = (allAccountsData || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      segment: a.segment,
      whatsappPhone: a.whatsapp_phone || '',
      plan: a.plan || 'Plano Pro Omnichannel',
      createdAt: a.created_at,
    }));

    // Opção de visão consolidada para gestores
    availableAccounts.push({
      id: 'all',
      name: 'Todas as Empresas (Visão Consolidada)',
      slug: 'todas',
      segment: 'Visão Geral Multi-Tenant',
      whatsappPhone: '',
      plan: 'Enterprise Multi-Canal',
      createdAt: new Date().toISOString(),
    });

    const acc = userData.accounts;

    return res.status(200).json({
      success: true,
      account: {
        id: acc.id,
        name: acc.name,
        slug: acc.slug,
        segment: acc.segment,
        whatsappPhone: acc.whatsapp_phone || '',
        plan: acc.plan || 'Plano Pro Omnichannel',
        createdAt: acc.created_at,
      },
      availableAccounts,
      user: {
        id: userData.id,
        accountId: acc.id,
        name: userData.name,
        email: userData.email,
        role: userData.role || 'admin',
        avatarUrl: userData.avatar_url,
      },
    });
  } catch (err: any) {
    console.error('Erro na rota /api/auth/login:', err);
    return res.status(500).json({ error: err?.message || 'Falha interna no login' });
  }
}
