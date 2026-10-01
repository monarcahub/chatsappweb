import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase não configurado nas variáveis de ambiente da Vercel' });
  }

  const conversationId = String(req.query.conversation_id || '').trim();
  if (!conversationId) {
    return res.status(400).json({ error: 'conversation_id é obrigatório' });
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ messages: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao buscar mensagens' });
  }
}
