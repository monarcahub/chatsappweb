import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type StandardMsgStatus = 'sent' | 'delivered' | 'read';

function normalizeStatus(rawStatus: unknown, isFromMe: boolean, isViewed: boolean = false): StandardMsgStatus {
  if (isViewed) return 'read';
  const s = String(rawStatus ?? '').toLowerCase().trim();
  if (s === 'read' || s === 'played' || s === 'seen' || s === 'viewed' || s === '3' || s === '4' || s === '5') {
    return 'read';
  }
  if (s === 'delivered' || s === 'delivery_ack' || s === '2') {
    return 'delivered';
  }
  if (s === 'sent' || s === 'server_ack' || s === 'pending' || s === '1' || s === '0') {
    return 'sent';
  }
  return isFromMe ? 'sent' : 'delivered';
}

async function getOrCreateConversation(supabase: any, params: {
  channelName: string;
  channelType: 'whatsapp' | 'instagram' | 'webchat';
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  instagramUsername?: string;
  avatarUrl?: string;
  isFromMe?: boolean;
}) {
  if (!supabase) {
    return {
      conversationId: `sim-conv-${Date.now()}`,
      contactId: `sim-cont-${Date.now()}`,
      status: params.isFromMe ? 'human' : 'ai',
      unreadCount: 0,
      created: true,
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
      created: false,
      isMock: false,
    };
  }

  const initialConvStatus = params.isFromMe ? 'human' : 'ai';
  const { data: newConv, error: createConvErr } = await supabase
    .from('conversations')
    .insert({
      channel_id: channelId,
      contact_id: contactId,
      status: initialConvStatus,
      crm_stage: 'novo_lead',
      unread_count: params.isFromMe ? 0 : 1,
    })
    .select('id, status')
    .single();

  if (createConvErr) throw createConvErr;

  return {
    conversationId: newConv.id,
    contactId,
    status: newConv.status || initialConvStatus,
    unreadCount: params.isFromMe ? 0 : 1,
    created: true,
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
    const nowIso = new Date().toISOString();

    // 1.1 Atualização de status (Meta statuses[] ou Evolution messages.update)
    const metaStatuses = body.object === 'whatsapp_business_account'
      ? body.entry?.[0]?.changes?.[0]?.value?.statuses
      : null;

    if (Array.isArray(metaStatuses) && metaStatuses.length > 0 && supabase) {
      for (const st of metaStatuses) {
        const nextStatus = normalizeStatus(st.status, true);
        await supabase
          .from('messages')
          .update({ status: nextStatus })
          .eq('metadata->>wamid', st.id);
      }
      return res.status(200).json({ success: true, event: 'meta_statuses', count: metaStatuses.length });
    }

    const evoEvent = String(body.event || '').toLowerCase().trim();
    if (evoEvent === 'messages.update' && supabase) {
      const upd = Array.isArray(body.data) ? body.data[0] : body.data || {};
      const extId = upd?.keyId || upd?.key?.id || upd?.id;
      const nextStatus = normalizeStatus(upd?.update?.status ?? upd?.status, Boolean(upd?.fromMe ?? upd?.key?.fromMe));
      if (extId) {
        await supabase
          .from('messages')
          .update({ status: nextStatus })
          .eq('metadata->>wamid', String(extId));
      }
      return res.status(200).json({ success: true, event: 'messages.update', status: nextStatus });
    }

    // Normalização de payload (Meta Cloud API, Coexistência smb_message_echoes, Evolution API)
    let senderPhone = '';
    let senderName = '';
    let messageText = '';
    let messageId = `msg-${Date.now()}`;
    let mediaUrl: string | undefined = undefined;
    let channelName = 'WhatsApp Oficial';
    let isFromMe = Boolean(
      body.fromMe === true ||
      body.from_me === true ||
      body.is_from_me === true ||
      body.data?.key?.fromMe === true ||
      body.key?.fromMe === true
    );
    let rawStatus: unknown = body.status ?? body.data?.status;

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const field = String(change?.field || '');
      const value = change?.value || {};
      const contact = value?.contacts?.[0];
      const isEcho = field === 'smb_message_echoes' || field === 'message_echoes' || Array.isArray(value?.message_echoes);
      const message = (isEcho ? value?.message_echoes?.[0] : value?.messages?.[0]) || value?.messages?.[0];

      if (message) {
        if (isEcho || message.fromMe === true) isFromMe = true;
        senderPhone = isFromMe
          ? message.to || contact?.wa_id || ''
          : contact?.wa_id || message.from || '';
        senderName = isFromMe
          ? 'Dispositivo Móvel'
          : contact?.profile?.name || `WhatsApp ${senderPhone}`;
        messageId = message.id || messageId;
        rawStatus = message.status ?? rawStatus;

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
      senderName = isFromMe
        ? 'Dispositivo Móvel'
        : body.data?.pushName || body.senderName || `WhatsApp ${senderPhone}`;
      messageText = body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text || body.message?.text || body.text || body.content || '';
      messageId = body.data?.key?.id || messageId;
    } else {
      senderPhone = body.phone || body.from || '+55 51 99999-9999';
      senderName = isFromMe ? 'Dispositivo Móvel' : (body.name || body.sender_name || 'Cliente WhatsApp');
      messageText = body.text || body.content || body.message || 'Olá';
    }

    if (!senderPhone || !messageText) {
      return res.status(200).json({ status: 'ignored', reason: 'Payload sem telefone ou texto legível' });
    }

    const resolvedSenderType = isFromMe ? 'coexistence_mobile' : 'contact';
    const resolvedMessageStatus = normalizeStatus(
      rawStatus,
      isFromMe,
      Boolean(body.viewed || body.is_read || body.read === true)
    );

    const { conversationId, status, unreadCount, created, isMock } = await getOrCreateConversation(supabase, {
      channelName,
      channelType: 'whatsapp',
      contactName: senderName,
      contactPhone: senderPhone,
      isFromMe,
    });

    if (supabase && !isMock) {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_type: resolvedSenderType,
        sender_name: senderName,
        content: messageText,
        media_url: mediaUrl,
        created_at: nowIso,
        status: resolvedMessageStatus,
        metadata: {
          channel: 'whatsapp',
          wamid: messageId,
          metaMessageId: messageId,
          fromMe: isFromMe,
          viaCoexistence: isFromMe,
          source: isFromMe ? 'coexistence_webhook' : 'webhook',
        },
      });

      if (isFromMe) {
        await supabase
          .from('messages')
          .update({ status: 'read' })
          .eq('conversation_id', conversationId)
          .in('sender_type', ['contact', 'customer'])
          .neq('status', 'read');
      }

      const nextUnreadCount = isFromMe ? 0 : created ? 1 : (unreadCount || 0) + 1;

      await supabase
        .from('conversations')
        .update({
          last_message_text: messageText,
          last_message_at: nowIso,
          unread_count: nextUnreadCount,
          ...(isFromMe ? { status: 'human' } : {}),
          updated_at: nowIso,
        })
        .eq('id', conversationId);
    }

    const effectiveStatus = isFromMe ? 'human' : status;
    const isHumanHandling = effectiveStatus === 'human';
    const isAiEligible = effectiveStatus === 'ai';

    return res.status(200).json({
      success: true,
      message: 'Mensagem do WhatsApp processada com sucesso',
      conversation_id: conversationId,
      message_id: messageId,
      fromMe: isFromMe,
      message_status: resolvedMessageStatus,
      status: effectiveStatus,
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
