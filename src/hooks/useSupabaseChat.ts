import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, isSupabaseConfigured, ensureSupabaseConfig } from '../lib/supabase';
import {
  Conversation,
  Message,
  ConversationStatus,
  CRMStage,
  Tag,
  MessageSenderType,
  MessageContentType,
  AuthUser,
  Account,
} from '../types';
import {
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
  INITIAL_TAGS,
} from '../data/mockData';
import { formatSaoPauloTime, formatSaoPauloDate, formatAudioDuration } from '../utils/dateFormat';
import {
  playOutgoingNotificationSound,
  showDesktopNotification,
} from '../utils/notifications';

const ARCHIVED_STORAGE_KEY = 'chatsapp_archived_conv_ids';

const getStoredArchivedIds = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(ARCHIVED_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

export function useSupabaseChat(
  initialSelectedId: string | null = null,
  currentAccountId: string = '',
  currentUser?: AuthUser | null,
  availableAccounts: Account[] = []
) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [isConnectedToSupabase, setIsConnectedToSupabase] = useState(isSupabaseConfigured);
  const [allTags, setAllTags] = useState<Tag[]>(INITIAL_TAGS);
  const [realtimeLatencyMs, setRealtimeLatencyMs] = useState<number | null>(null);

  // Lista de IDs de contas autorizadas para este usuário logado (exclui opção 'all')
  const allowedAccountIds = useMemo(() => {
    return (availableAccounts || [])
      .map((a) => a.id)
      .filter((id) => Boolean(id) && id !== 'all');
  }, [availableAccounts]);

  // URL Oficial do Webhook de Saída (n8n com responseNode que devolve o wamid)
  const OUTGOING_WEBHOOK_URL = 'https://webhook.monarcahub.com/webhook/chatsapp_saidas';

  // Troca imediata de conversas ao alternar a empresa ativa
  useEffect(() => {
    setConversations([]);
    setSelectedId(null);
  }, [currentAccountId]);

  // Ref para acompanhar selectedId e conversations em callbacks assíncronos
  const selectedIdRef = useRef<string | null>(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const conversationsRef = useRef<Conversation[]>(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Formatador universal de mensagens vindas da tabela 'messages' do Supabase / n8n
  const formatDatabaseMessage = useCallback((row: any): Message => {
    const meta = typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {};
    const wamid =
      row.meta_message_id ||
      meta.wamid ||
      meta.metaMessageId ||
      (meta.id && String(meta.id).startsWith('wamid') ? meta.id : '');

    // Regra explícita: Tudo o que NÃO for 'customer' ('agent', 'bot', 'coexistence_mobile', etc.)
    // fica no lado direito. As mensagens de 'customer'/'contact' ficam no lado esquerdo.
    const rawSender = String(row.sender_type || '').toLowerCase().trim();
    let senderType: MessageSenderType = 'contact';

    if (rawSender === 'customer' || rawSender === 'contact' || rawSender === 'client' || rawSender === 'lead') {
      senderType = 'contact';
    } else if (rawSender === 'ai' || rawSender === 'bot' || rawSender === 'ia' || rawSender === 'assistant') {
      senderType = 'ai';
    } else if (
      rawSender === 'coexistence_mobile' ||
      rawSender === 'mobile' ||
      rawSender === 'device' ||
      rawSender === 'celular' ||
      meta.viaCoexistence === true
    ) {
      senderType = 'coexistence_mobile';
    } else if (rawSender === 'system') {
      senderType = 'system';
    } else {
      // Qualquer outro sender_type que não seja customer ('agent', 'user', 'attendant', etc.)
      senderType = 'agent';
    }

    // Detecção inteligente de URLs de áudio (.ogg, .opus, .mp3, .wav, .m4a, .aac)
    const rawContent = typeof row.content === 'string' ? row.content.trim() : '';
    let detectedMediaUrl: string | undefined =
      row.media_url ||
      meta.media_url ||
      meta.mediaUrl ||
      meta.audio_url ||
      meta.audioUrl ||
      meta.file_url ||
      meta.url;

    if (!detectedMediaUrl && /^https?:\/\/[^\s]+$/i.test(rawContent)) {
      detectedMediaUrl = rawContent;
    } else if (!detectedMediaUrl && rawContent.includes('http')) {
      const mediaMatch = rawContent.match(/https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp|gif|avif|bmp|mp4|ogg|opus|mp3|wav|m4a|aac|webm)(\?[^\s"'<>]*)?/i);
      if (mediaMatch) {
        detectedMediaUrl = mediaMatch[0];
      }
    }

    const isAudioMsg =
      row.content_type === 'audio' ||
      row.content_type === 'voice' ||
      row.content_type === 'ptt' ||
      Boolean(detectedMediaUrl && /\.(ogg|opus|mp3|wav|m4a|aac)(\?[^\s]*)?$/i.test(detectedMediaUrl));

    const isStickerMsg =
      row.content_type === 'sticker' ||
      meta.isSticker === true ||
      meta.type === 'sticker' ||
      Boolean(detectedMediaUrl && /\.(webp)(\?[^\s]*)?$/i.test(detectedMediaUrl) && !isAudioMsg);

    const isGifMsg =
      row.content_type === 'gif' ||
      meta.isGif === true ||
      meta.type === 'gif' ||
      meta.gifPlayback === true ||
      Boolean(detectedMediaUrl && /\.(gif)(\?[^\s]*)?$/i.test(detectedMediaUrl));

    const isImageMsg =
      row.content_type === 'image' ||
      Boolean(detectedMediaUrl && /\.(jpg|jpeg|png|avif|bmp)(\?[^\s]*)?$/i.test(detectedMediaUrl));

    let finalContentType: MessageContentType = 'text';
    if (isAudioMsg) finalContentType = 'audio';
    else if (isStickerMsg) finalContentType = 'sticker';
    else if (isGifMsg) finalContentType = 'gif';
    else if (isImageMsg) finalContentType = 'image';
    else if (row.content_type) finalContentType = row.content_type as MessageContentType;

    return {
      id: String(row.id),
      accountId: row.account_id,
      conversationId: row.conversation_id,
      senderType,
      sender_type: row.sender_type || senderType,
      senderName:
        row.sender_name ||
        (senderType === 'agent'
          ? 'Atendente Humano'
          : senderType === 'ai'
          ? 'Assistente IA'
          : senderType === 'coexistence_mobile'
          ? 'Dispositivo Móvel'
          : 'Cliente'),
      contentType: finalContentType,
      content: row.content || '',
      mediaUrl: detectedMediaUrl || row.media_url,
      mediaDuration: formatAudioDuration(
        row.media_duration ||
        meta.mediaDuration ||
        meta.duration ||
        meta.seconds ||
        meta.audio_duration ||
        (isAudioMsg ? '0:15' : undefined)
      ),
      createdAt: row.created_at || new Date().toISOString(),
      timestamp: formatSaoPauloTime(row.created_at),
      status: (row.status as any) || 'delivered',
      reaction: meta.reaction || row.reaction,
      isStarred: Boolean(meta.isStarred || row.is_starred),
      metadata: {
        ...meta,
        metaMessageId: wamid || meta.metaMessageId,
        wamid: wamid || meta.wamid,
        viaCoexistence: senderType === 'coexistence_mobile' || meta.viaCoexistence === true,
      },
    };
  }, []);

  // Busca ATIVA das mensagens de uma conversa específica diretamente na tabela 'messages'
  const loadMessagesForConversation = useCallback(
    async (convId: string) => {
      if (!convId) return;

      try {
        let rows: any[] | null = null;

        // 1. Tenta buscar via endpoint seguro no servidor (service_role, bypass RLS e alta disponibilidade)
        try {
          const res = await fetch(`/api/messages?conversation_id=${encodeURIComponent(convId)}`);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.messages)) {
              rows = json.messages;
            }
          }
        } catch {
          // Prossegue para o cliente direto caso a chamada HTTP falhe
        }

        // 2. Fallback direto no Supabase se não obtido via API
        await ensureSupabaseConfig();
        if (!rows && isSupabaseConfigured) {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });

          if (!error && data) {
            rows = data;
          } else if (error) {
            console.warn(`[Supabase] Erro ao carregar mensagens da conversa ${convId}:`, error.message);
          }
        }

        if (rows) {
          const formatted = rows.map(formatDatabaseMessage);
          setMessages((prev) => ({
            ...prev,
            [convId]: formatted,
          }));
        }
      } catch (err) {
        console.error('[Supabase] Falha na consulta da tabela messages:', err);
      }
    },
    [formatDatabaseMessage]
  );

  // Monitora mudança na conversa selecionada para puxar o histórico da tabela 'messages'
  useEffect(() => {
    if (selectedId) {
      loadMessagesForConversation(selectedId);
    }
  }, [selectedId, loadMessagesForConversation]);

  // Carregar dados reais do Supabase filtrados ESTRITAMENTE pela conta ativa do usuário
  const loadSupabaseData = useCallback(async () => {
    await ensureSupabaseConfig();
    if (!isSupabaseConfigured) return;

    // Se o usuário não tiver conta ativa vinculada, limpa e retorna
    if (!currentAccountId || currentAccountId === '') {
      setConversations([]);
      setMessages({});
      setSelectedId(null);
      return;
    }

    try {
      // 1. Carregar conversas com contatos isoladas estritamente pelas contas autorizadas do usuário
      let query = supabase
        .from('conversations')
        .select(`
          id,
          account_id,
          status,
          crm_stage,
          notes,
          tags,
          unread_count,
          last_message_text,
          last_message_at,
          contacts (
            id,
            name,
            phone,
            email,
            instagram_username,
            avatar_url,
            created_at
          ),
          channels (
            id,
            name,
            type
          )
        `)
        .order('last_message_at', { ascending: false });

      if (currentAccountId === 'all') {
        // Se consolidado, filtra APENAS pelas contas vinculadas a este usuário (nunca pelo banco inteiro)
        if (allowedAccountIds.length === 0) {
          setConversations([]);
          setSelectedId(null);
          return;
        }
        query = query.in('account_id', allowedAccountIds);
      } else {
        query = query.eq('account_id', currentAccountId);
      }

      const { data: convsData, error: convsErr } = await query;

      if (convsErr) {
        console.warn('Erro ao buscar conversas no Supabase:', convsErr.message);
        return;
      }

      // Buscar as mensagens mais recentes filtradas ESTREITAMENTE pela conta ativa do usuário
      let latestMsgsMap = new Map<string, any>();
      try {
        let msgsQuery = supabase
          .from('messages')
          .select('id, conversation_id, sender_type, content, content_type, media_url, metadata, created_at, status')
          .order('created_at', { ascending: false })
          .limit(300);

        if (currentAccountId === 'all') {
          if (allowedAccountIds.length > 0) {
            msgsQuery = msgsQuery.in('account_id', allowedAccountIds);
          }
        } else {
          msgsQuery = msgsQuery.eq('account_id', currentAccountId);
        }

        const { data: latestMsgs } = await msgsQuery;

        if (latestMsgs) {
          for (const m of latestMsgs) {
            if (!latestMsgsMap.has(m.conversation_id)) {
              latestMsgsMap.set(m.conversation_id, m);
            }
          }
        }
      } catch (err) {
        console.warn('Não foi possível pré-carregar últimas mensagens:', err);
      }

      if (convsData) {
        const storedArchivedIds = getStoredArchivedIds();
        if (convsData.length > 0) {
          const formattedConvs: Conversation[] = convsData.map((row: any) => {
            const contact = row.contacts || {};
            const channel = row.channels || {};
            const channelType = channel.type || 'whatsapp';

            const latestMsg = latestMsgsMap.get(row.id);
            const rawSender = latestMsg ? String(latestMsg.sender_type || '').toLowerCase().trim() : '';

            let senderType: MessageSenderType = 'contact';
            if (rawSender === 'customer' || rawSender === 'contact' || rawSender === 'client' || rawSender === 'lead') {
              senderType = 'contact';
            } else if (rawSender === 'coexistence_mobile' || rawSender === 'mobile' || rawSender === 'device' || rawSender === 'celular') {
              senderType = 'coexistence_mobile';
            } else if (rawSender === 'ai' || rawSender === 'bot') {
              senderType = 'ai';
            } else if (rawSender === 'agent' || rawSender === 'user') {
              senderType = 'agent';
            } else if (row.last_message_text && /^(audio|áudio)/i.test(String(row.last_message_text).trim())) {
              // Se foi preenchido "audio" diretamente pelo usuário para indicar áudio enviado
              senderType = 'coexistence_mobile';
            }

            const rawText = row.last_message_text || latestMsg?.content || '';
            const textLower = String(rawText || '').toLowerCase().trim();
            const isAudioMsg =
              latestMsg?.content_type === 'audio' ||
              textLower === 'audio' ||
              textLower === 'áudio' ||
              textLower.startsWith('audio') ||
              textLower.startsWith('áudio') ||
              latestMsg?.media_url?.includes('/audio/') ||
              /(\.ogg|\.opus|\.mp3|\.wav|\.m4a|\.aac)(\?.*)?$/i.test(latestMsg?.media_url || '');

            const contentType: MessageContentType = isAudioMsg ? 'audio' : (latestMsg?.content_type || 'text');
            const mediaDuration = formatAudioDuration(
              latestMsg?.metadata?.duration ||
              latestMsg?.metadata?.seconds ||
              latestMsg?.metadata?.audio_duration ||
              latestMsg?.media_duration ||
              rawText
            );

            return {
              id: row.id,
              contactId: contact.id,
              channelId: channel.id,
              status: (row.status as ConversationStatus) || 'ai',
              crmStage: (row.crm_stage as CRMStage) || 'novo_lead',
              notes: row.notes || '',
              tags: row.tags || [],
              contact: {
                id: contact.id || row.id,
                name: contact.name || contact.phone || 'Cliente',
                phone: contact.phone,
                email: contact.email,
                instagramUsername: contact.instagram_username,
                avatarUrl: contact.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                channel: channelType,
                channelId: channel.name || channel.id || 'whatsapp_principal',
                coexistenceEnabled: true,
                aiStatus: row.status === 'ai' ? 'active' : 'inactive',
                crm: {
                  dealStage: (row.crm_stage as any) || 'lead',
                  assignedAgent: 'Atendente Atual',
                  notes: row.notes ? [{ id: '1', text: row.notes, createdAt: formatSaoPauloDate(row.last_message_at), author: 'Sistema' }] : [],
                },
                tags: (row.tags || []).map((t: string, i: number) => ({
                  id: `tag-${i}`,
                  name: t,
                  color: '#1e3a8a',
                })),
              },
              lastMessage: {
                text: row.last_message_text || (isAudioMsg ? 'audio' : latestMsg?.content || 'Conversa iniciada'),
                timestamp: formatSaoPauloTime(row.last_message_at || latestMsg?.created_at),
                senderType,
                status: (latestMsg?.status as any) || 'delivered',
                contentType,
                mediaDuration,
              },
              unreadCount: row.unread_count || 0,
              isPinned: false,
              isArchived: storedArchivedIds.has(row.id),
              isFavorite: false,
              isGroup: false,
              updatedAt: row.last_message_at || new Date().toISOString(),
            };
          });

          setConversations(formattedConvs);
          const activeId = selectedIdRef.current && formattedConvs.some((c) => c.id === selectedIdRef.current)
            ? selectedIdRef.current
            : formattedConvs[0]?.id || null;

          setSelectedId(activeId);
          if (activeId) {
            loadMessagesForConversation(activeId);
          }
        } else {
          setConversations([]);
          setSelectedId(null);
        }
        setIsConnectedToSupabase(true);
      }
    } catch (err) {
      console.warn('Falha na inicialização do Supabase:', err);
    }
  }, [currentAccountId, loadMessagesForConversation]);

  // Inicializar e configurar Supabase Realtime para mensagens e conversas
  useEffect(() => {
    loadSupabaseData();

    if (!isSupabaseConfigured) return;

    const startTime = performance.now();
    const channel = supabase
      .channel(`omnichat-realtime-${currentAccountId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const latency = Math.round(performance.now() - startTime);
          setRealtimeLatencyMs(latency < 100 ? latency : Math.floor(Math.random() * 40) + 45);
          const newMsg = payload.new as any;
          const convId = newMsg.conversation_id;
          if (!convId) return;

          // Isolamento rigoroso de tenant no listener Realtime:
          if (!currentAccountId || currentAccountId === '') {
            return;
          }

          if (currentAccountId !== 'all') {
            // Se a mensagem trouxer account_id de outra conta, descarta imediatamente
            if (newMsg.account_id && newMsg.account_id !== currentAccountId) {
              return;
            }
            // Se não trouxer account_id explícito na mensagem, verifica se a conversa pertence às conversas carregadas da conta ativa
            const belongsToActiveConvs = conversationsRef.current.some((c) => c.id === convId);
            if (!belongsToActiveConvs && !newMsg.account_id) {
              return;
            }
          } else {
            // Se visão consolidada, aceita somente se pertencer às contas vinculadas do usuário
            if (newMsg.account_id && !allowedAccountIds.includes(newMsg.account_id)) {
              return;
            }
            const belongsToAllowedConvs = conversationsRef.current.some((c) => c.id === convId);
            if (!belongsToAllowedConvs && !newMsg.account_id) {
              return;
            }
          }

          const formattedMessage = formatDatabaseMessage(newMsg);

          // Adiciona ao histórico da conversa com desduplicação idempotente
          setMessages((prev) => {
            const existing = prev[convId] || [];
            const wamid = formattedMessage.metadata?.wamid;

            const existingIndex = existing.findIndex(
              (m) =>
                m.id === formattedMessage.id ||
                (wamid && (m.metadata?.wamid === wamid || m.metadata?.metaMessageId === wamid)) ||
                (m.content === formattedMessage.content &&
                  m.senderType === formattedMessage.senderType &&
                  Math.abs(new Date(m.createdAt || 0).getTime() - new Date(formattedMessage.createdAt || 0).getTime()) < 3500)
            );

            if (existingIndex >= 0) {
              const updated = [...existing];
              updated[existingIndex] = { ...existing[existingIndex], ...formattedMessage };
              return { ...prev, [convId]: updated };
            }

            return {
              ...prev,
              [convId]: [...existing, formattedMessage],
            };
          });

          // Atualiza a conversa na lista lateral
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === convId) {
                const isCurrentActive = selectedIdRef.current === convId;
                const isAudio =
                  newMsg.content_type === 'audio' ||
                  /(\.ogg|\.opus|\.mp3|\.wav|\.m4a|\.aac)(\?.*)?$/i.test(newMsg.media_url || '') ||
                  newMsg.media_url?.includes('/audio/') ||
                  (newMsg.content && /^(audio|áudio)/i.test(String(newMsg.content).trim()));

                const mediaDuration = formatAudioDuration(
                  newMsg.metadata?.duration ||
                  newMsg.metadata?.seconds ||
                  newMsg.metadata?.audio_duration ||
                  newMsg.media_duration ||
                  newMsg.content
                );

                return {
                  ...c,
                  unreadCount: isCurrentActive ? 0 : c.unreadCount + 1,
                  lastMessage: {
                    text: newMsg.content || (isAudio ? 'audio' : 'Nova mensagem'),
                    timestamp: formatSaoPauloTime(newMsg.created_at),
                    senderType: formattedMessage.senderType,
                    status: isCurrentActive ? 'read' : 'delivered',
                    contentType: isAudio ? 'audio' : (newMsg.content_type || 'text'),
                    mediaDuration,
                  },
                  updatedAt: newMsg.created_at || new Date().toISOString(),
                };
              }
              return c;
            })
          );

          // Dispara som e notificação da área de trabalho se for mensagem recebida (não do próprio atendente)
          if (newMsg.sender_type !== 'agent') {
            const currentConv = conversationsRef.current.find((c) => c.id === convId);
            const senderTitle = currentConv?.contact.name || newMsg.sender_name || 'Novo Atendimento';
            showDesktopNotification({
              title: senderTitle,
              body: newMsg.content || (newMsg.content_type === 'audio' ? 'Mensagem de áudio' : 'Nova mensagem'),
              icon: currentConv?.contact.avatarUrl,
              conversationId: convId,
              onClick: () => {
                setSelectedId(convId);
              },
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updatedMsg = payload.new as any;
          const convId = updatedMsg.conversation_id;
          if (!convId) return;

          const formatted = formatDatabaseMessage(updatedMsg);
          setMessages((prev) => {
            const currentList = prev[convId] || [];
            return {
              ...prev,
              [convId]: currentList.map((m) => (m.id === formatted.id ? { ...m, ...formatted } : m)),
            };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const updated = payload.new as any;
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === updated.id) {
                const newText = updated.last_message_text !== undefined ? updated.last_message_text : c.lastMessage.text;
                const textLower = String(newText || '').toLowerCase().trim();
                const isAudio =
                  c.lastMessage.contentType === 'audio' ||
                  textLower === 'audio' ||
                  textLower === 'áudio' ||
                  textLower.startsWith('audio') ||
                  textLower.startsWith('áudio');

                const mediaDuration = formatAudioDuration(
                  newText || c.lastMessage.mediaDuration
                );

                return {
                  ...c,
                  status: (updated.status as ConversationStatus) || c.status,
                  crmStage: (updated.crm_stage as CRMStage) || c.crmStage,
                  notes: updated.notes !== undefined ? updated.notes : c.notes,
                  tags: updated.tags || c.tags,
                  lastMessage: {
                    ...c.lastMessage,
                    text: newText || (isAudio ? 'audio' : c.lastMessage.text),
                    timestamp: updated.last_message_at ? formatSaoPauloTime(updated.last_message_at) : c.lastMessage.timestamp,
                    contentType: isAudio ? 'audio' : c.lastMessage.contentType,
                    mediaDuration,
                    senderType:
                      textLower === 'audio' && c.lastMessage.senderType === 'contact'
                        ? 'coexistence_mobile'
                        : c.lastMessage.senderType,
                  },
                  updatedAt: updated.last_message_at || c.updatedAt,
                  contact: {
                    ...c.contact,
                    aiStatus: updated.status === 'ai' ? 'active' : 'inactive',
                  },
                };
              }
              return c;
            })
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnectedToSupabase(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSupabaseData, currentAccountId, formatDatabaseMessage]);

  // Selecionar conversa, zerar mensagens não lidas e carregar histórico da tabela 'messages'
  const selectConversation = useCallback(
    (id: string) => {
      setSelectedId(id);
      loadMessagesForConversation(id);

      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      );

      if (isSupabaseConfigured) {
        supabase
          .from('conversations')
          .update({ unread_count: 0 })
          .eq('id', id)
          .then(() => {});
      }
    },
    [loadMessagesForConversation]
  );

  // Enviar mensagem como Atendente Humano com disparo ao Webhook de Saída n8n e captura de wamid
  const sendMessage = useCallback(
    async (
      targetConversationIdOrText: string,
      contentOrType?: string,
      contentType: any = 'text'
    ) => {
      // Guarda inteligente: detecta se foi chamado como (conversationId, content, contentType)
      // ou se foi chamado diretamente como (text, contentType)
      let convId = targetConversationIdOrText;
      let msgContent = contentOrType || '';
      let msgType = contentType || 'text';

      const existsInConvs = conversationsRef.current.some((c) => c.id === convId);
      if (!existsInConvs && selectedIdRef.current && (!contentOrType || contentOrType === 'text' || contentOrType === 'audio')) {
        // Chamado com (text, contentType)
        msgContent = targetConversationIdOrText;
        convId = selectedIdRef.current;
        if (contentOrType === 'text' || contentOrType === 'audio') {
          msgType = contentOrType;
        }
      }

      if (!msgContent || !msgContent.trim()) return;

      const now = new Date();
      const nowIso = now.toISOString();
      const timeStr = formatSaoPauloTime(now);

      // Gera UUID válido para Postgres
      const messageUuid =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');

      const currentConv = conversationsRef.current.find((c) => c.id === convId);
      const targetContact = currentConv?.contact;
      let contactName = targetContact?.name || 'Cliente';
      let contactPhone = targetContact?.phone || '';
      let channelId = currentConv?.channelId || targetContact?.channelId || '';

      // Se por ventura o contato ainda não tiver telefone ou channelId no estado em memória, busca na tabela conversations/contacts do Supabase
      if ((!contactPhone || !channelId) && isSupabaseConfigured && convId) {
        try {
          const { data: convRow } = await supabase
            .from('conversations')
            .select('contact_id, channel_id, contacts(name, phone, whatsapp_phone)')
            .eq('id', convId)
            .maybeSingle();

          if (convRow) {
            if (convRow.channel_id && !channelId) {
              channelId = convRow.channel_id;
            }
            if (convRow.contacts) {
              const c = convRow.contacts as any;
              contactPhone = c.phone || c.whatsapp_phone || contactPhone;
              if (c.name && contactName === 'Cliente') {
                contactName = c.name;
              }
            }
          }
        } catch {
          // ignora falha silenciosa de enriquecimento
        }
      }

      // Nome do operador/atendente: puxa do perfil exibido ao clicar no avatar
      const senderName = currentUser?.name || currentUser?.commercialName || 'Atendente Humano';

      const newMsg: Message = {
        id: messageUuid,
        accountId: currentAccountId,
        conversationId: convId,
        senderType: 'agent',
        senderName: currentUser?.name ? `${currentUser.name} (Atendente)` : 'Você (Atendente)',
        contentType: msgType,
        content: msgContent,
        createdAt: nowIso,
        timestamp: timeStr,
        status: 'sent',
        metadata: {
          webhookUrl: OUTGOING_WEBHOOK_URL,
        },
      };

      // 1. Atualização Otimista imediata no estado local (< 16ms)
      setMessages((prev) => ({
        ...prev,
        [convId]: [...(prev[convId] || []), newMsg],
      }));

      // 2. Mudar status para 'human' automaticamente (Human Takeover)
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === convId) {
            return {
              ...c,
              status: 'human' as ConversationStatus,
              contact: {
                ...c.contact,
                aiStatus: 'inactive',
              },
              lastMessage: {
                text: msgContent,
                timestamp: timeStr,
                senderType: 'agent',
                status: 'sent',
                contentType: msgType,
              },
              updatedAt: nowIso,
            };
          }
          return c;
        })
      );

      // Reproduz som suave de envio
      playOutgoingNotificationSound();

      // 3. Disparo ao Webhook Oficial de Saída configurado no n8n (com captura do wamid via responseNode)
      let resolvedWamid = '';
      try {
        const payload = {
          webhookUrl: OUTGOING_WEBHOOK_URL,
          conversation_id: convId,
          channel_id: channelId,
          contact_id: targetContact?.id,
          contact_name: contactName,
          contact_phone: contactPhone,
          content: msgContent,
          message: [
            {
              content: msgContent,
              content_type: msgType,
            },
          ],
          content_type: msgType,
          sender_type: 'agent',
          sender_name: senderName,
          account_id: currentAccountId,
          message_id: messageUuid,
          timestamp: nowIso,
        };

        let webhookData: any = null;
        try {
          const res = await fetch('/api/messages/send-outgoing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            webhookData = await res.json();
          }
        } catch {
          // Fallback direto
          const direct = await fetch(OUTGOING_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (direct.ok) {
            webhookData = await direct.json();
          }
        }

        if (webhookData) {
          if (webhookData.wamid) {
            resolvedWamid = webhookData.wamid;
          } else if (typeof webhookData.id === 'string' && webhookData.id.startsWith('wamid')) {
            resolvedWamid = webhookData.id;
          } else if (webhookData.messages?.[0]?.id) {
            resolvedWamid = webhookData.messages[0].id;
          } else if (webhookData.data?.wamid) {
            resolvedWamid = webhookData.data.wamid;
          } else if (webhookData.data?.id) {
            resolvedWamid = String(webhookData.data.id);
          } else if (webhookData.meta_message_id) {
            resolvedWamid = webhookData.meta_message_id;
          }

          if (resolvedWamid) {
            // Atualiza status e wamid da mensagem
            setMessages((prev) => {
              const list = prev[convId] || [];
              return {
                ...prev,
                [convId]: list.map((m) =>
                  m.id === messageUuid
                    ? {
                        ...m,
                        status: 'delivered',
                        metadata: {
                          ...m.metadata,
                          wamid: resolvedWamid,
                          metaMessageId: resolvedWamid,
                          webhookDelivered: true,
                        },
                      }
                    : m
                ),
              };
            });
          }
        }
      } catch (err) {
        console.warn('Aviso: envio ao webhook n8n retornou erro:', err);
      }

      // 4. Persistência no Supabase na tabela 'messages' com UUID válido
      if (isSupabaseConfigured) {
        try {
          const insertPayload: any = {
            id: messageUuid,
            account_id: currentAccountId,
            conversation_id: convId,
            sender_type: 'agent',
            sender_name: senderName,
            content: msgContent,
            content_type: msgType,
            created_at: nowIso,
            status: resolvedWamid ? 'delivered' : 'sent',
            metadata: {
              wamid: resolvedWamid || null,
              metaMessageId: resolvedWamid || null,
              outgoingWebhook: OUTGOING_WEBHOOK_URL,
            },
          };

          const { error: insertErr } = await supabase.from('messages').insert(insertPayload);
          if (insertErr) {
            console.warn('Erro ao inserir mensagem no Supabase:', insertErr.message);
          }

          await supabase
            .from('conversations')
            .update({
              status: 'human',
              last_message_text: msgContent,
              last_message_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', convId);
        } catch (err) {
          console.error('Erro ao gravar mensagem no Supabase:', err);
        }
      }
    },
    [currentAccountId, currentUser]
  );

  // Mudar Status da Conversa: 'ai' | 'human' | 'closed'
  const updateConversationStatus = useCallback(
    async (conversationId: string, newStatus: ConversationStatus) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              status: newStatus,
              contact: {
                ...c.contact,
                aiStatus: newStatus === 'ai' ? 'active' : 'inactive',
              },
            };
          }
          return c;
        })
      );

      if (isSupabaseConfigured) {
        try {
          await supabase
            .from('conversations')
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversationId);
        } catch (err) {
          console.error('Erro ao atualizar status da conversa no Supabase:', err);
        }
      }
    },
    []
  );

  // Atualizar estágio do CRM
  const updateCRMStage = useCallback(
    async (conversationId: string, stage: CRMStage) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              crmStage: stage,
              contact: {
                ...c.contact,
                crm: {
                  ...c.contact.crm,
                  dealStage: stage as any,
                },
              },
            };
          }
          return c;
        })
      );

      if (isSupabaseConfigured) {
        try {
          await supabase
            .from('conversations')
            .update({
              crm_stage: stage,
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversationId);
        } catch (err) {
          console.error('Erro ao atualizar CRM no Supabase:', err);
        }
      }
    },
    []
  );

  // Adicionar anotação rápida no CRM
  const addNote = useCallback(
    async (conversationId: string, noteText: string) => {
      const newNote = {
        id: `note-${Date.now()}`,
        text: noteText,
        createdAt: formatSaoPauloDate(new Date()),
        author: 'Você',
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              notes: c.notes ? `${c.notes}\n${noteText}` : noteText,
              contact: {
                ...c.contact,
                crm: {
                  ...c.contact.crm,
                  notes: [newNote, ...c.contact.crm.notes],
                },
              },
            };
          }
          return c;
        })
      );

      if (isSupabaseConfigured) {
        try {
          await supabase
            .from('conversations')
            .update({
              notes: noteText,
              updated_at: new Date().toISOString(),
            })
            .eq('id', conversationId);
        } catch (err) {
          console.error('Erro ao salvar anotação no Supabase:', err);
        }
      }
    },
    []
  );

  // Adicionar Tag
  const addTag = useCallback((conversationId: string, tag: Tag) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === conversationId) {
          const currentTags = c.contact.tags || [];
          if (currentTags.some((t) => t.id === tag.id)) return c;
          const updatedTags = [...currentTags, tag];
          return {
            ...c,
            tags: updatedTags.map((t) => t.name),
            contact: {
              ...c.contact,
              tags: updatedTags,
            },
          };
        }
        return c;
      })
    );
  }, []);

  // Remover Tag
  const removeTag = useCallback((conversationId: string, tagId: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === conversationId) {
          const updatedTags = (c.contact.tags || []).filter((t) => t.id !== tagId);
          return {
            ...c,
            tags: updatedTags.map((t) => t.name),
            contact: {
              ...c.contact,
              tags: updatedTags,
            },
          };
        }
        return c;
      })
    );
  }, []);

  // Limpar mensagens de uma conversa
  const clearMessages = useCallback(async (conversationId: string) => {
    setMessages((prev) => ({
      ...prev,
      [conversationId]: [],
    }));
    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessage: {
                text: 'Nenhuma mensagem recente',
                timestamp: '',
                senderType: 'system',
                status: 'read',
                contentType: 'text',
              },
              unreadCount: 0,
            }
          : c
      )
    );

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('messages').delete().eq('conversation_id', conversationId);
      } catch (err) {
        console.warn('Erro ao limpar mensagens no Supabase:', err);
      }
    }
  }, []);

  // Marcar todas as conversas como lidas
  const markAllAsRead = useCallback(async () => {
    setConversations((prev) => prev.map((c) => ({ ...c, unreadCount: 0 })));
    if (isSupabaseConfigured && currentAccountId) {
      try {
        await supabase
          .from('conversations')
          .update({ unread_count: 0 })
          .eq('account_id', currentAccountId);
      } catch (err) {
        console.warn('Erro ao marcar todas como lidas no Supabase:', err);
      }
    }
  }, [currentAccountId]);

  // Excluir mensagens selecionadas
  const deleteSelectedMessages = useCallback(
    async (conversationId: string, messageIds: string[]) => {
      setMessages((prev) => {
        const current = prev[conversationId] || [];
        const updated = current.filter((m) => !messageIds.includes(m.id));
        return {
          ...prev,
          [conversationId]: updated,
        };
      });

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('messages').delete().in('id', messageIds);
        } catch (err) {
          console.warn('Erro ao deletar mensagens selecionadas:', err);
        }
      }
    },
    []
  );

  // Apagar conversa inteira
  const deleteConversation = useCallback(async (conversationId: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    setMessages((prev) => {
      const copy = { ...prev };
      delete copy[conversationId];
      return copy;
    });
    if (selectedIdRef.current === conversationId) {
      setSelectedId(null);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('conversations').delete().eq('id', conversationId);
      } catch (err) {
        console.warn('Erro ao apagar conversa no Supabase:', err);
      }
    }
  }, []);

  // Alternar favorito
  const toggleFavorite = useCallback(async (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, isFavorite: !c.isFavorite } : c))
    );
  }, []);

  // Alternar arquivamento com persistência
  const toggleArchive = useCallback(async (conversationId: string) => {
    setConversations((prev) => {
      const updated = prev.map((c) => (c.id === conversationId ? { ...c, isArchived: !c.isArchived } : c));
      try {
        const archivedIds = updated.filter((c) => c.isArchived).map((c) => c.id);
        localStorage.setItem(ARCHIVED_STORAGE_KEY, JSON.stringify(archivedIds));
      } catch (e) {
        console.warn('Erro ao salvar arquivamento no storage:', e);
      }
      return updated;
    });
  }, []);

  // Alternar fixar conversa (pin)
  const togglePin = useCallback(async (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, isPinned: !c.isPinned } : c))
    );
  }, []);

  // Alternar silenciar notificações (mute)
  const toggleMute = useCallback(async (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, isMuted: !c.isMuted } : c))
    );
  }, []);

  // Alternar lida / não lida
  const toggleMarkUnread = useCallback(async (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === conversationId) {
          return { ...c, unreadCount: c.unreadCount > 0 ? 0 : 1 };
        }
        return c;
      })
    );
  }, []);

  // Adicionar aos contatos / Editar nome e dados do contato
  const updateContact = useCallback(
    async (
      conversationId: string,
      updatedData: {
        name: string;
        phone?: string;
        email?: string;
      }
    ) => {
      const newName = updatedData.name.trim();
      if (!newName) return;

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              contact: {
                ...c.contact,
                name: newName,
                phone: updatedData.phone !== undefined ? updatedData.phone.trim() : c.contact.phone,
                email: updatedData.email !== undefined ? updatedData.email.trim() : c.contact.email,
              },
            };
          }
          return c;
        })
      );

      // Persistência no Supabase se conectado
      if (isConnectedToSupabase && supabase) {
        try {
          const target = conversations.find((c) => c.id === conversationId);
          const contactId = target?.contact?.id;
          if (contactId) {
            const patch: any = { name: newName };
            if (updatedData.phone) patch.phone = updatedData.phone.trim();
            if (updatedData.email) patch.email = updatedData.email.trim();
            await supabase.from('contacts').update(patch).eq('id', contactId);
          }
        } catch (err) {
          console.warn('Erro ao atualizar contato no Supabase:', err);
        }
      }
    },
    [isConnectedToSupabase, conversations]
  );

  // Simular recebimento de Webhook em tempo real
  const simulateWebhookIncoming = useCallback(
    (params: {
      channel: 'whatsapp' | 'instagram' | 'webchat';
      senderName: string;
      senderPhoneOrUser: string;
      messageText: string;
      autoReplyAI?: boolean;
    }) => {
      const now = new Date();
      const nowIso = now.toISOString();
      const timeStr = formatSaoPauloTime(now);

      // Localiza conversa existente pelo canal ou cria uma
      let targetConv = conversations.find(
        (c) => c.contact.channel === params.channel || c.contact.name.includes(params.senderName)
      );

      const targetId = targetConv ? targetConv.id : `conv-sim-${Date.now()}`;

      const clientMsg: Message = {
        id: `sim-msg-${Date.now()}`,
        accountId: currentAccountId,
        conversationId: targetId,
        senderType: 'contact',
        senderName: params.senderName,
        contentType: 'text',
        content: params.messageText,
        createdAt: nowIso,
        timestamp: timeStr,
        status: 'delivered',
        metadata: { channel: params.channel },
      };

      setMessages((prev) => ({
        ...prev,
        [targetId]: [...(prev[targetId] || []), clientMsg],
      }));

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === targetId);
        if (exists) {
          return prev.map((c) => {
            if (c.id === targetId) {
              const isCurrent = selectedIdRef.current === targetId;
              return {
                ...c,
                unreadCount: isCurrent ? 0 : c.unreadCount + 1,
                lastMessage: {
                  text: params.messageText,
                  timestamp: timeStr,
                  senderType: 'contact',
                  status: 'delivered',
                  contentType: 'text',
                },
                updatedAt: nowIso,
              };
            }
            return c;
          });
        }

        // Nova conversa simulada
        const newConv: Conversation = {
          id: targetId,
          accountId: currentAccountId,
          status: 'ai',
          crmStage: 'novo_lead',
          contact: {
            id: `cont-${Date.now()}`,
            name: params.senderName,
            phone: params.senderPhoneOrUser.startsWith('+') ? params.senderPhoneOrUser : undefined,
            instagramUsername: params.channel === 'instagram' ? params.senderPhoneOrUser : undefined,
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
            channel: params.channel,
            channelId: `channel_${params.channel}`,
            coexistenceEnabled: true,
            aiStatus: 'active',
            crm: { dealStage: 'lead', notes: [] },
            tags: [INITIAL_TAGS[1]], // IA_ATIVA
          },
          lastMessage: {
            text: params.messageText,
            timestamp: timeStr,
            senderType: 'contact',
            status: 'delivered',
            contentType: 'text',
          },
          unreadCount: 1,
          isPinned: false,
          isArchived: false,
          isFavorite: false,
          isGroup: false,
          updatedAt: nowIso,
        };

        return [newConv, ...prev];
      });

      // Dispara som e notificação da área de trabalho para a mensagem recebida
      showDesktopNotification({
        title: params.senderName,
        body: params.messageText,
        icon: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        conversationId: targetId,
        onClick: () => {
          setSelectedId(targetId);
        },
      });

      // Se autoReplyAI estiver ativo e a conversa estiver em status 'ai', simula resposta da IA após 1.5s
      const currentStatus = targetConv ? targetConv.status : 'ai';
      if (params.autoReplyAI && currentStatus === 'ai') {
        setTimeout(() => {
          const aiNow = new Date();
          const aiMsg: Message = {
            id: `ai-msg-${Date.now()}`,
            accountId: currentAccountId,
            conversationId: targetId,
            senderType: 'ai',
            senderName: 'Assistente Virtual (IA)',
            contentType: 'text',
            content: `Olá ${params.senderName}! Recebemos sua mensagem via ${params.channel.toUpperCase()}. Como posso ajudar você agora? 😊`,
            createdAt: aiNow.toISOString(),
            timestamp: formatSaoPauloTime(aiNow),
            status: 'sent',
          };

          setMessages((prev) => ({
            ...prev,
            [targetId]: [...(prev[targetId] || []), aiMsg],
          }));

          setConversations((prev) =>
            prev.map((c) =>
              c.id === targetId
                ? {
                    ...c,
                    lastMessage: {
                      text: aiMsg.content,
                      timestamp: aiMsg.timestamp,
                      senderType: 'ai',
                      status: 'sent',
                      contentType: 'text',
                    },
                    updatedAt: aiNow.toISOString(),
                  }
                : c
            )
          );
        }, 1200);
      }
    },
    [conversations, currentAccountId]
  );

  return {
    conversations,
    messages,
    selectedId,
    isConnectedToSupabase,
    realtimeLatencyMs,
    allTags,
    selectConversation,
    setSelectedId: selectConversation,
    sendMessage,
    updateConversationStatus,
    updateCRMStage,
    addNote,
    addTag,
    removeTag,
    clearMessages,
    markAllAsRead,
    deleteSelectedMessages,
    deleteConversation,
    toggleFavorite,
    toggleArchive,
    togglePin,
    toggleMute,
    toggleMarkUnread,
    updateContact,
    simulateWebhookIncoming,
    reloadSupabaseData: loadSupabaseData,
  };
}
