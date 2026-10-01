import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function getOrCreateConversation(supabase: any, params: {
  channelName: string;
  channelType: 'whatsapp' | 'instagram' | 'webchat';
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  instagramUsername?: string;
  avatarUrl?: string;
}) {
  if (!supabase) {
    return {
      conversationId: `sim-conv-${Date.now()}`,
      contactId: `sim-cont-${Date.now()}`,
      status: 'ai',
      isMock: true,
    };
  }

  // 1. Localizar ou registrar o canal
  let channelId: string | null = null;
  const { data: channelData } = await supabase
    .from('channels')
    .select('id')
    .eq('name', params.channelName)
    .maybeSingle();

  if (channelData?.id) {
    channelId = channelData.id;
  } else {
    const { data: newChan } = await supabase
      .from('channels')
      .insert({
        name: params.channelName,
        type: params.channelType,
        is_active: true,
      })
      .select('id')
      .single();
    channelId = newChan?.id || null;
  }

  // 2. Localizar ou registrar o contato
  let contactId: string | null = null;
  let contactQuery = supabase.from('contacts').select('id');

  if (params.contactPhone) {
    contactQuery = contactQuery.eq('phone', params.contactPhone);
  } else if (params.instagramUsername) {
    contactQuery = contactQuery.eq('instagram_username', params.instagramUsername);
  } else if (params.contactEmail) {
    contactQuery = contactQuery.eq('email', params.contactEmail);
  } else {
    contactQuery = contactQuery.eq('name', params.contactName);
  }

  const { data: existingContact } = await contactQuery.maybeSingle();

  if (existingContact?.id) {
    contactId = existingContact.id;
  } else {
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({
        name: params.contactName,
        phone: params.contactPhone,
        email: params.contactEmail,
        instagram_username: params.instagramUsername,
        avatar_url: params.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        deal_stage: 'lead',
      })
      .select('id')
      .single();
    contactId = newContact?.id || null;
  }

  if (!channelId || !contactId) {
    throw new Error('Falha ao registrar canal ou contato no banco de dados');
  }

  // 3. Localizar ou criar a conversa (Thread de Atendimento)
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id, status, unread_count')
    .eq('channel_id', channelId)
    .eq('contact_id', contactId)
    .maybeSingle();

  if (existingConv) {
    return {
      conversationId: existingConv.id,
      contactId,
      status: existingConv.status || 'ai',
      unreadCount: existingConv.unread_count || 0,
      isMock: false,
    };
  }

  const { data: newConv, error: createConvErr } = await supabase
    .from('conversations')
    .insert({
      channel_id: channelId,
      contact_id: contactId,
      status: 'ai',
      crm_stage: 'novo_lead',
      unread_count: 1,
    })
    .select('id, status')
    .single();

  if (createConvErr) throw createConvErr;

  return {
    conversationId: newConv.id,
    contactId,
    status: newConv.status || 'ai',
    unreadCount: 1,
    isMock: false,
  };
}

export default async function handler(req: any, res: any) {
  // 1. Suporte a verificação de Webhook da Meta (GET hub.challenge)
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'];
    const challenge = req.query?.['hub.challenge'];

    if (mode === 'subscribe') {
      return res.status(200).send(challenge || 'VERIFIED');
    }
    return res.status(200).json({ status: 'whatsapp_webhook_active' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = req.body || {};
    const supabase = getSupabaseClient();

    // Normalização de payload (Meta Cloud API, Evolution API ou Z-API)
    let senderPhone = '';
    let senderName = '';
    let messageText = '';
    let messageId = `msg-${Date.now()}`;
    let mediaUrl: string | undefined = undefined;
    let channelName = 'WhatsApp Oficial';

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const contact = change?.contacts?.[0];
      const message = change?.messages?.[0];

      if (message) {
        senderPhone = contact?.wa_id || message.from || '';
        senderName = contact?.profile?.name || `WhatsApp ${senderPhone}`;
        messageId = message.id || messageId;

        if (message.type === 'text') {
          messageText = message.text?.body || '';
        } else if (message.type === 'audio') {
          messageText = '[Áudio]';
          mediaUrl = message.audio?.link || undefined;
        } else if (message.type === 'image') {
          messageText = message.image?.caption || '[Imagem]';
          mediaUrl = message.image?.link || undefined;
        }
      }
    } else if (body.data?.key?.remoteJid || body.sender || body.phone) {
      senderPhone = body.data?.key?.remoteJid?.split('@')[0] || body.sender || body.phone || '';
      senderName = body.data?.pushName || body.senderName || `WhatsApp ${senderPhone}`;
      messageText = body.data?.message?.conversation || body.message?.text || body.text || body.content || '';
      messageId = body.data?.key?.id || messageId;
    } else {
      senderPhone = body.phone || body.from || '+55 51 99999-9999';
      senderName = body.name || body.sender_name || 'Cliente WhatsApp';
      messageText = body.text || body.content || body.message || 'Olá';
    }

    if (!senderPhone || !messageText) {
      return res.status(200).json({ status: 'ignored', reason: 'Payload sem telefone ou texto legível' });
    }

    const { conversationId, status, unreadCount, isMock } = await getOrCreateConversation(supabase, {
      channelName,
      channelType: 'whatsapp',
      contactName: senderName,
      contactPhone: senderPhone,
    });

    const nowIso = new Date().toISOString();

    if (supabase && !isMock) {
      await supabase.from('messages').insert({
        id: messageId,
        conversation_id: conversationId,
        sender_type: 'contact',
        sender_name: senderName,
        content: messageText,
        media_url: mediaUrl,
        created_at: nowIso,
        status: 'delivered',
        metadata: {
          channel: 'whatsapp',
          source: 'webhook',
        },
      });

      await supabase
        .from('conversations')
        .update({
          last_message_text: messageText,
          last_message_at: nowIso,
          unread_count: (unreadCount || 0) + 1,
          updated_at: nowIso,
        })
        .eq('id', conversationId);
    }

    const isHumanHandling = status === 'human';
    const isAiEligible = status === 'ai';

    return res.status(200).json({
      success: true,
      message: 'Mensagem do WhatsApp processada com sucesso',
      conversation_id: conversationId,
      message_id: messageId,
      status,
      ai_suppressed: isHumanHandling,
      ai_eligible: isAiEligible,
      takeover_reason: isHumanHandling
        ? 'Atendente humano assumiu o controle. Disparo de IA bloqueado.'
        : 'Conversa sob gerência da IA.',
    });
  } catch (error: any) {
    console.error('Erro no webhook de WhatsApp:', error);
    return res.status(500).json({
      error: 'Falha ao processar webhook do WhatsApp',
      details: error?.message,
    });
  }
}
