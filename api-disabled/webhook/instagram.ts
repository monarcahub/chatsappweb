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
    throw new Error('Falha ao registrar canal ou contato');
  }

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
  if (req.method === 'GET') {
    const challenge = req.query?.['hub.challenge'];
    if (challenge) {
      return res.status(200).send(challenge);
    }
    return res.status(200).json({ status: 'instagram_webhook_active' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const body = req.body || {};
    const supabase = getSupabaseClient();

    let igUsername = '';
    let senderName = '';
    let messageText = '';
    let mediaUrl: string | undefined = undefined;
    let messageId = `ig-${Date.now()}`;

    if (body.entry?.[0]?.messaging?.[0]) {
      const messaging = body.entry[0].messaging[0];
      igUsername = messaging.sender?.id ? `ig_user_${messaging.sender.id}` : 'cliente.instagram';
      senderName = `@${igUsername}`;
      messageText = messaging.message?.text || '[Mídia do Instagram]';
      mediaUrl = messaging.message?.attachments?.[0]?.payload?.url;
      messageId = messaging.message?.mid || messageId;
    } else {
      igUsername = body.username || body.instagram_username || body.sender || 'cliente.insta';
      senderName = body.name || `@${igUsername}`;
      messageText = body.content || body.message || body.text || 'Olá! Vi o produto no Instagram.';
      mediaUrl = body.media_url;
      messageId = body.id || messageId;
    }

    const channelName = body.channel_name || 'instagram_comercial';

    const { conversationId, status, unreadCount, isMock } = await getOrCreateConversation(supabase, {
      channelName,
      channelType: 'instagram',
      contactName: senderName,
      instagramUsername: igUsername,
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
          channel: 'instagram',
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

    return res.status(200).json({
      success: true,
      message: 'Mensagem do Instagram processada com sucesso',
      conversation_id: conversationId,
      message_id: messageId,
      status,
      ai_suppressed: isHumanHandling,
      ai_eligible: !isHumanHandling,
    });
  } catch (error: any) {
    console.error('Erro no webhook de Instagram:', error);
    return res.status(500).json({
      error: 'Falha ao processar webhook do Instagram',
      details: error?.message,
    });
  }
}
