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
    return res.status(503).json({ error: 'Supabase não configurado' });
  }

  if (req.method === 'GET') {
    const accountId = String(req.query.account_id || '').trim();
    if (!accountId) {
      return res.status(400).json({ error: 'account_id é obrigatório' });
    }

    try {
      const { data, error } = await supabase
        .from('cerebro_ia')
        .select('*')
        .eq('account_id', accountId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ config: data || null });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao consultar cérebro da IA' });
    }
  }

  if (req.method === 'POST') {
    const { account_id, ...configData } = req.body || {};
    if (!account_id) {
      return res.status(400).json({ error: 'account_id é obrigatório' });
    }

    try {
      const payload = {
        account_id,
        ...configData,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('cerebro_ia')
        .upsert(payload, { onConflict: 'account_id' })
        .select('*')
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json({ success: true, config: data });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Erro ao salvar cérebro da IA' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
