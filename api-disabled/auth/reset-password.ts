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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  if (!isServerSupabaseConfigured) {
    return res.status(503).json({ error: 'Supabase não configurado' });
  }

  try {
    const { email, newPassword, accountId } = req.body || {};

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'E-mail e nova senha são obrigatórios' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Atualizar no account_users
    let query = supabaseAdmin.from('account_users').update({
      updated_at: new Date().toISOString(),
    }).eq('email', cleanEmail);

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data: updatedUsers, error: userUpdateErr } = await query.select();

    if (userUpdateErr) {
      return res.status(400).json({ error: `Erro ao localizar usuário: ${userUpdateErr.message}` });
    }

    // 2. Atualizar ou criar senha no Supabase Auth
    if (hasServiceRoleKey) {
      try {
        const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
        const existingInAuth = (authList?.users as any[])?.find(
          (u: any) => u.email?.toLowerCase() === cleanEmail
        );

        if (existingInAuth) {
          await supabaseAdmin.auth.admin.updateUserById(existingInAuth.id, {
            password: newPassword,
          });
        } else {
          await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: newPassword,
            email_confirm: true,
          });
        }
      } catch (authErr) {
        console.warn('Aviso ao sincronizar auth.admin:', authErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Senha atualizada com sucesso!',
      usersUpdated: updatedUsers?.length || 0,
    });
  } catch (err: any) {
    console.error('Erro na rota /api/auth/reset-password:', err);
    return res.status(500).json({ error: err?.message || 'Falha ao redefinir senha' });
  }
}
