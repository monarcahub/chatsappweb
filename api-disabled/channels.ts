import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase não configurado nas variáveis de ambiente da Vercel' });
  }

  // GET: Listar canais
  if (req.method === 'GET') {
    try {
      const accountId = req.query.account_id as string;
      let query = supabase.from('channels').select('*').order('created_at', { ascending: false });

      if (accountId && accountId !== 'all') {
        query = query.eq('account_id', accountId);
      }

      const { data, error } = await query;
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ channels: data || [] });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao buscar canais' });
    }
  }

  // POST: Conectar novo canal
  if (req.method === 'POST') {
    try {
      const { account_id, name, type, config } = req.body || {};
      if (!account_id || !name || !type) {
        return res.status(400).json({ error: 'account_id, name e type são obrigatórios' });
      }

      const { data, error } = await supabase
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

      return res.status(201).json({ success: true, channel: data });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao criar canal' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
