import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  try {
    const body = req.body || {};
    const {
      conversation_id,
      content,
      sender_type = 'ai',
      sender_name,
      media_url,
      force_override = false,
    } = body;

    if (!conversation_id || !content) {
      return res.status(400).json({
        error: 'Campos obrigatórios: conversation_id e content',
      });
    }

    const nowIso = new Date().toISOString();
    const messageId = body.id || `agent-msg-${Date.now()}`;
    const supabase = getSupabaseClient();

    // 1. Verificar se a conversa está no modo 'human'
    let currentStatus = 'ai';
    if (supabase) {
      const { data: convData } = await supabase
        .from('conversations')
        .select('status')
        .eq('id', conversation_id)
        .maybeSingle();

      if (convData?.status) {
        currentStatus = convData.status;
      }
    }

    // Regra crítica: Se a IA tentar responder enquanto o atendente humano está ativo
    if (sender_type === 'ai' && currentStatus === 'human' && !force_override) {
      return res.status(409).json({
        success: false,
        blocked: true,
        reason:
          'Conversa em modo Atendimento Humano (status = human). O envio de IA foi bloqueado para respeitar a decisão do operador.',
        conversation_id,
      });
    }

    const resolvedSenderName =
      sender_name || (sender_type === 'ai' ? 'Agente de IA' : 'Atendente do Sistema');

    // 2. Gravar no Supabase
    if (supabase) {
      const { error: msgErr } = await supabase.from('messages').insert({
        id: messageId,
        conversation_id,
        sender_type,
        sender_name: resolvedSenderName,
        content,
        media_url,
        created_at: nowIso,
        status: 'sent',
        metadata: {
          injected_by: 'agent-send-api',
          source: body.source || 'n8n_or_ai',
        },
      });

      if (msgErr) throw msgErr;

      await supabase
        .from('conversations')
        .update({
          last_message_text: content,
          last_message_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', conversation_id);
    }

    return res.status(200).json({
      success: true,
      message: 'Mensagem injetada com sucesso',
      conversation_id,
      message_id: messageId,
      sender_type,
      sender_name: resolvedSenderName,
      timestamp_utc: nowIso,
    });
  } catch (error: any) {
    console.error('Erro em /api/webhook/agent-send:', error);
    return res.status(500).json({
      error: 'Falha ao processar envio do agente',
      details: error?.message,
    });
  }
}
