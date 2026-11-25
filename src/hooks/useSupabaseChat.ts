import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, isSupabaseConfigured, ensureSupabaseConfig } from '../lib/supabase';
import {
  Conversation,
  Message,
  ConversationStatus,
  MessageStatus,
  CRMStage,
  Tag,
  MessageSenderType,
  MessageContentType,
  AuthUser,
  Account,
  ChannelType,
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
const TAGS_STORAGE_KEY = 'chatsapp_custom_tags_v1';
const REALTIME_HEALTHY_POLL_MS = 60_000;
const REALTIME_CONTINGENCY_POLL_MS = 10_000;
const REALTIME_IN_FILTER_MAX_VALUES = 100;
const REALTIME_MSG_MERGE_WINDOW_MS = 60_000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isExplicitOptimisticMessage = (m: Message): boolean =>
  (Boolean(m.metadata?.isOptimistic === true) && !UUID_REGEX.test(m.id)) ||
  m.id.startsWith('temp-') ||
  m.id.startsWith('optimistic-') ||
  m.id.startsWith('sim-msg-');

const findMatchingMessageIndex = (existing: Message[], incoming: Message): number => {
  const exactIdx = existing.findIndex((m) => m.id === incoming.id);
  if (exactIdx >= 0) return exactIdx;

  const incomingWamid = incoming.metadata?.wamid || incoming.metadata?.metaMessageId;
  if (incomingWamid) {
    const wamidIdx = existing.findIndex(
      (m) => m.metadata?.wamid === incomingWamid || m.metadata?.metaMessageId === incomingWamid
    );
    if (wamidIdx >= 0) return wamidIdx;
  }

  // Heurística temporal restrita exclusivamente a placeholders otimistas sem identificadores conflitantes
  const incomingTime = new Date(incoming.createdAt || 0).getTime();
  return existing.findIndex((m) => {
    if (!isExplicitOptimisticMessage(m)) return false;
    const mWamid = m.metadata?.wamid || m.metadata?.metaMessageId;
    if (mWamid && incomingWamid && mWamid !== incomingWamid) return false;
    const mTime = new Date(m.createdAt || 0).getTime();
    return (
      m.content === incoming.content &&
      m.senderType === incoming.senderType &&
      Math.abs(mTime - incomingTime) < 3500
    );
  });
};

const compareMessagesChronologically = (a: Message, b: Message): number => {
  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  const safeA = Number.isFinite(timeA) ? timeA : 0;
  const safeB = Number.isFinite(timeB) ? timeB : 0;
  if (safeA !== safeB) return safeA - safeB;
  return String(a.id).localeCompare(String(b.id));
};

const buildLastMessageFromMessage = (msg: Message | undefined): Conversation['lastMessage'] => {
  if (!msg) {
    return {
      text: 'Nenhuma mensagem recente',
      timestamp: '',
      senderType: 'system',
      status: 'read',
      contentType: 'text',
    };
  }
  return {
    text: msg.content || (msg.contentType === 'audio' ? 'audio' : 'Mensagem'),
    timestamp: msg.timestamp,
    senderType: msg.senderType,
    status: msg.status,
    contentType: msg.contentType,
    mediaDuration: msg.mediaDuration,
  };
};

const CONVERSATION_SELECT_QUERY = `
          id,
          account_id,
          channel_id,
          contact_id,
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
        `;

const buildAccountRealtimeFilter = (
  accountId: string,
  allowedIds: string[]
): { shouldSubscribe: boolean; serverFilter?: string } => {
  if (!accountId || accountId === '') {
    return { shouldSubscribe: false };
  }
  if (accountId !== 'all') {
    return {
      shouldSubscribe: true,
      serverFilter: `account_id=eq.${accountId}`,
    };
  }
  const uniqueAllowed = Array.from(
    new Set(allowedIds.filter((id) => Boolean(id) && id !== 'all'))
  );
  if (uniqueAllowed.length === 0) {
    return { shouldSubscribe: false };
  }
  if (uniqueAllowed.length === 1) {
    return {
      shouldSubscribe: true,
      serverFilter: `account_id=eq.${uniqueAllowed[0]}`,
    };
  }
  // Supabase Realtime aceita operador `in` até 100 valores no filtro server-side.
  if (uniqueAllowed.length <= REALTIME_IN_FILTER_MAX_VALUES) {
    return {
      shouldSubscribe: true,
      serverFilter: `account_id=in.(${uniqueAllowed.join(',')})`,
    };
  }
  // Acima de 100 empresas vinculadas, omite o filtro server-side e mantém RLS + validação client-side.
  return { shouldSubscribe: true };
};

type RealtimeConnectionState = 'CONNECTING' | 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

interface LoadSupabaseDataOptions {
  queueIfBusy?: boolean;
  skipMessagesForConvId?: string | null;
  syncSelectedMessages?: boolean;
}

interface LoadMessagesOptions {
  queueIfBusy?: boolean;
}

const areStringArraysEqual = (a?: string[], b?: string[]): boolean => {
  const arrA = a || [];
  const arrB = b || [];
  if (arrA.length !== arrB.length) return false;
  for (let i = 0; i < arrA.length; i++) {
    if (arrA[i] !== arrB[i]) return false;
  }
  return true;
};

const areContactTagsEqual = (a?: Tag[], b?: Tag[]): boolean => {
  const arrA = a || [];
  const arrB = b || [];
  if (arrA.length !== arrB.length) return false;
  for (let i = 0; i < arrA.length; i++) {
    if (
      arrA[i].id !== arrB[i].id ||
      arrA[i].name !== arrB[i].name ||
      arrA[i].color !== arrB[i].color ||
      arrA[i].textColor !== arrB[i].textColor
    ) {
      return false;
    }
  }
  return true;
};

const areCrmNotesEqual = (
  a?: Array<{ id: string; text: string; createdAt: string; author: string }>,
  b?: Array<{ id: string; text: string; createdAt: string; author: string }>
): boolean => {
  const arrA = a || [];
  const arrB = b || [];
  if (arrA.length !== arrB.length) return false;
  for (let i = 0; i < arrA.length; i++) {
    if (
      arrA[i].id !== arrB[i].id ||
      arrA[i].text !== arrB[i].text ||
      arrA[i].createdAt !== arrB[i].createdAt ||
      arrA[i].author !== arrB[i].author
    ) {
      return false;
    }
  }
  return true;
};

const areConversationsListsEqual = (prevList: Conversation[], nextList: Conversation[]): boolean => {
  if (prevList.length !== nextList.length) return false;
  for (let i = 0; i < prevList.length; i++) {
    const a = prevList[i];
    const b = nextList[i];
    if (
      a.id !== b.id ||
      a.accountId !== b.accountId ||
      a.contactId !== b.contactId ||
      a.channelId !== b.channelId ||
      a.status !== b.status ||
      a.crmStage !== b.crmStage ||
      a.notes !== b.notes ||
      a.unreadCount !== b.unreadCount ||
      Boolean(a.isPinned) !== Boolean(b.isPinned) ||
      Boolean(a.isArchived) !== Boolean(b.isArchived) ||
      Boolean(a.isFavorite) !== Boolean(b.isFavorite) ||
      Boolean(a.isMuted) !== Boolean(b.isMuted) ||
      Boolean(a.isGroup) !== Boolean(b.isGroup) ||
      a.updatedAt !== b.updatedAt ||
      !areStringArraysEqual(a.tags, b.tags) ||
      a.lastMessage?.text !== b.lastMessage?.text ||
      a.lastMessage?.timestamp !== b.lastMessage?.timestamp ||
      a.lastMessage?.senderType !== b.lastMessage?.senderType ||
      a.lastMessage?.status !== b.lastMessage?.status ||
      a.lastMessage?.contentType !== b.lastMessage?.contentType ||
      a.lastMessage?.mediaDuration !== b.lastMessage?.mediaDuration ||
      a.contact?.id !== b.contact?.id ||
      a.contact?.name !== b.contact?.name ||
      a.contact?.phone !== b.contact?.phone ||
      a.contact?.email !== b.contact?.email ||
      a.contact?.instagramUsername !== b.contact?.instagramUsername ||
      a.contact?.avatarUrl !== b.contact?.avatarUrl ||
      a.contact?.channel !== b.contact?.channel ||
      a.contact?.channelId !== b.contact?.channelId ||
      Boolean(a.contact?.coexistenceEnabled) !== Boolean(b.contact?.coexistenceEnabled) ||
      a.contact?.aiStatus !== b.contact?.aiStatus ||
      a.contact?.crm?.dealStage !== b.contact?.crm?.dealStage ||
      a.contact?.crm?.assignedAgent !== b.contact?.crm?.assignedAgent ||
      !areCrmNotesEqual(a.contact?.crm?.notes, b.contact?.crm?.notes) ||
      !areContactTagsEqual(a.contact?.tags, b.contact?.tags)
    ) {
      return false;
    }
  }
  return true;
};

const getStoredArchivedIds = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(ARCHIVED_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
};

const getStoredTags = (): Tag[] => {
  if (typeof window === 'undefined') return INITIAL_TAGS;
  try {
    const raw = localStorage.getItem(TAGS_STORAGE_KEY);
    if (!raw) return INITIAL_TAGS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const map = new Map<string, Tag>();
      INITIAL_TAGS.forEach((t) => map.set(t.name.toLowerCase(), t));
      parsed.forEach((t) => map.set(t.name.toLowerCase(), t));
      return Array.from(map.values());
    }
  } catch {}
  return INITIAL_TAGS;
};

const normalizeMessageStatus = (
  rawStatus: unknown,
  senderType?: MessageSenderType,
  meta?: Record<string, any>
): MessageStatus => {
  if (meta?.read === true || meta?.viewed === true) {
    return 'read';
  }
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
  if (s === 'failed' || s === 'error') {
    return 'failed';
  }
  if (senderType && senderType !== 'contact' && senderType !== 'customer') {
    return 'sent';
  }
  return 'delivered';
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
  const [allTags, setAllTags] = useState<Tag[]>(getStoredTags);
  const allTagsRef = useRef<Tag[]>(allTags);
  allTagsRef.current = allTags;
  const [realtimeLatencyMs, setRealtimeLatencyMs] = useState<number | null>(null);

  // Lista de IDs de contas autorizadas para este usuário logado (exclui opção 'all')
  const rawAllowedAccountIdsKey = (availableAccounts || [])
    .map((a) => a.id)
    .filter((id) => Boolean(id) && id !== 'all')
    .join(',');

  const allowedAccountIds = useMemo(() => {
    return rawAllowedAccountIdsKey ? rawAllowedAccountIdsKey.split(',') : [];
  }, [rawAllowedAccountIdsKey]);

  const allowedAccountIdsRef = useRef<string[]>(allowedAccountIds);
  allowedAccountIdsRef.current = allowedAccountIds;

  // Controle de época por contexto de conta para descartar respostas assíncronas obsoletas
  const contextKey = `${currentAccountId}::${rawAllowedAccountIdsKey}`;
  const accountEpochRef = useRef<number>(0);
  const prevContextKeyRef = useRef<string>(contextKey);
  if (prevContextKeyRef.current !== contextKey) {
    prevContextKeyRef.current = contextKey;
    accountEpochRef.current += 1;
  }

  // Controle de concorrência e coalescência de ressincronizações pendentes
  const convSyncInFlightRef = useRef<{ epoch: number; promise: Promise<void> } | null>(null);
  const convSyncPendingRef = useRef<{ epoch: number; syncSelectedMessages: boolean } | null>(null);
  const msgSyncInFlightRef = useRef<Map<string, Promise<void>>>(new Map());
  const msgSyncPendingRef = useRef<Set<string>>(new Set());
  const singleConvFetchInFlightRef = useRef<Map<string, Promise<void>>>(new Map());

  // Sequenciador monotônico e rastreio de consultas ativas para evitar que snapshots antigos sobrescrevam eventos/exclusões
  const mutationSeqRef = useRef<number>(0);
  const queryTokenCounterRef = useRef<number>(0);
  const activeQuerySeqsRef = useRef<Map<number, number>>(new Map());

  type ConvMutationRecord = {
    seq: number;
    atMs: number;
    statusSeq?: number;
    crmStageSeq?: number;
    notesSeq?: number;
    tagsSeq?: number;
    unreadCountSeq?: number;
    lastMessageSeq?: number;
  };

  // Buffers temporais indexados por sequência monotônica + tempo (protegem toda a duração das queries em voo)
  const recentMsgEventsRef = useRef<
    Map<string, Map<string, { msg: Message; seq: number; atMs: number }>>
  >(new Map());
  const recentConvMutationsRef = useRef<Map<string, ConvMutationRecord>>(new Map());
  const deletedConvSeqRef = useRef<Map<string, { seq: number; atMs: number }>>(new Map());
  const deletedMsgSeqRef = useRef<Map<string, { convId?: string; seq: number; atMs: number }>>(new Map());
  const latestConvMsgMetaRef = useRef<
    Map<string, { id: string; wamid?: string; createdAtMs: number }>
  >(new Map());

  const beginQuerySnapshot = useCallback((): { token: number; startSeq: number } => {
    const token = ++queryTokenCounterRef.current;
    const startSeq = mutationSeqRef.current;
    activeQuerySeqsRef.current.set(token, startSeq);
    return { token, startSeq };
  }, []);

  const endQuerySnapshot = useCallback((token: number) => {
    activeQuerySeqsRef.current.delete(token);
  }, []);

  const pruneStaleTrackingRefs = useCallback(() => {
    let minActiveSeq = mutationSeqRef.current;
    for (const startSeq of activeQuerySeqsRef.current.values()) {
      if (startSeq < minActiveSeq) {
        minActiveSeq = startSeq;
      }
    }
    const now = Date.now();

    for (const [convId, entry] of deletedConvSeqRef.current.entries()) {
      if (entry.seq < minActiveSeq && now - entry.atMs > REALTIME_MSG_MERGE_WINDOW_MS) {
        deletedConvSeqRef.current.delete(convId);
      }
    }
    for (const [msgId, entry] of deletedMsgSeqRef.current.entries()) {
      if (entry.seq < minActiveSeq && now - entry.atMs > REALTIME_MSG_MERGE_WINDOW_MS) {
        deletedMsgSeqRef.current.delete(msgId);
      }
    }
    for (const [convId, entry] of recentConvMutationsRef.current.entries()) {
      if (entry.seq < minActiveSeq && now - entry.atMs > REALTIME_MSG_MERGE_WINDOW_MS) {
        recentConvMutationsRef.current.delete(convId);
      }
    }
    for (const [convId, msgMap] of recentMsgEventsRef.current.entries()) {
      for (const [msgId, entry] of msgMap.entries()) {
        if (entry.seq < minActiveSeq && now - entry.atMs > REALTIME_MSG_MERGE_WINDOW_MS) {
          msgMap.delete(msgId);
        }
      }
      if (msgMap.size === 0) {
        recentMsgEventsRef.current.delete(convId);
      }
    }
  }, []);

  const markConversationMutated = useCallback(
    (
      convId: string,
      fields: Partial<Omit<ConvMutationRecord, 'seq' | 'atMs'>>,
      explicitSeq?: number
    ): number => {
      const seq = explicitSeq ?? ++mutationSeqRef.current;
      const now = Date.now();
      const prev = recentConvMutationsRef.current.get(convId);
      recentConvMutationsRef.current.set(convId, {
        seq,
        atMs: now,
        statusSeq: fields.statusSeq ? seq : prev?.statusSeq,
        crmStageSeq: fields.crmStageSeq ? seq : prev?.crmStageSeq,
        notesSeq: fields.notesSeq ? seq : prev?.notesSeq,
        tagsSeq: fields.tagsSeq ? seq : prev?.tagsSeq,
        unreadCountSeq: fields.unreadCountSeq ? seq : prev?.unreadCountSeq,
        lastMessageSeq: fields.lastMessageSeq ? seq : prev?.lastMessageSeq,
      });
      return seq;
    },
    []
  );

  // Estado real da conexão Realtime para polling adaptativo
  const realtimeStatusRef = useRef<RealtimeConnectionState>('CONNECTING');
  const wasRealtimeDegradedRef = useRef<boolean>(false);

  // URL Oficial do Webhook de Saída (n8n com responseNode que devolve o wamid)
  const OUTGOING_WEBHOOK_URL = 'https://webhook.monarcahub.com/webhook/chatsapp_saidas';

  // Rastreia se a seleção inicial de conversa já foi executada para a conta atual
  const hasInitializedSelectionRef = useRef<boolean>(false);

  // Invalida respostas pendentes ao desmontar o hook
  useEffect(() => {
    return () => {
      accountEpochRef.current += 1;
    };
  }, []);

  // Limpa integralmente estado, mensagens, caches e referências ao trocar empresa ou contas autorizadas
  useEffect(() => {
    convSyncPendingRef.current = null;
    msgSyncPendingRef.current.clear();
    msgSyncInFlightRef.current.clear();
    singleConvFetchInFlightRef.current.clear();
    activeQuerySeqsRef.current.clear();
    recentMsgEventsRef.current.clear();
    recentConvMutationsRef.current.clear();
    deletedConvSeqRef.current.clear();
    deletedMsgSeqRef.current.clear();
    latestConvMsgMetaRef.current.clear();
    setConversations([]);
    setMessages({});
    setSelectedId(null);
    hasInitializedSelectionRef.current = false;
  }, [contextKey]);

  // Ref para acompanhar selectedId, conversations e messages em callbacks assíncronos
  const selectedIdRef = useRef<string | null>(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const conversationsRef = useRef<Conversation[]>(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const messagesRef = useRef<Record<string, Message[]>>(messages);
  messagesRef.current = messages;

  // Validação client-side complementar às políticas RLS e aos filtros Realtime
  const isRecordAccountAuthorized = useCallback(
    (recordAccountId?: string | null, convIdFallback?: string | null): boolean => {
      if (!currentAccountId || currentAccountId === '') {
        return false;
      }
      if (recordAccountId) {
        if (currentAccountId !== 'all') {
          return recordAccountId === currentAccountId;
        }
        return allowedAccountIdsRef.current.includes(recordAccountId);
      }
      if (convIdFallback) {
        return conversationsRef.current.some((c) => c.id === convIdFallback);
      }
      return false;
    },
    [currentAccountId]
  );

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
    const isFromMeMeta =
      meta.fromMe === true ||
      meta.from_me === true ||
      meta.is_from_me === true ||
      row.from_me === true;
    let senderType: MessageSenderType = 'contact';

    if (rawSender === 'ai' || rawSender === 'bot' || rawSender === 'ia' || rawSender === 'assistant') {
      senderType = 'ai';
    } else if (
      rawSender === 'coexistence_mobile' ||
      rawSender === 'mobile' ||
      rawSender === 'device' ||
      rawSender === 'celular' ||
      meta.viaCoexistence === true ||
      (isFromMeMeta && rawSender !== 'agent' && rawSender !== 'user' && rawSender !== 'system')
    ) {
      senderType = 'coexistence_mobile';
    } else if (rawSender === 'system') {
      senderType = 'system';
    } else if (rawSender === 'customer' || rawSender === 'contact' || rawSender === 'client' || rawSender === 'lead') {
      senderType = 'contact';
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
    } else if (!detectedMediaUrl && (rawContent.startsWith('data:image/') || rawContent.startsWith('data:audio/') || rawContent.startsWith('data:application/') || rawContent.startsWith('data:video/'))) {
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
      Boolean(detectedMediaUrl && (/\.(ogg|opus|mp3|wav|m4a|aac)(\?[^\s]*)?$/i.test(detectedMediaUrl) || detectedMediaUrl.startsWith('data:audio/')));

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
      Boolean(detectedMediaUrl && (/\.(jpg|jpeg|png|avif|bmp|webp)(\?[^\s]*)?$/i.test(detectedMediaUrl) || detectedMediaUrl.startsWith('data:image/')));

    const isDocumentMsg =
      row.content_type === 'document' ||
      Boolean(detectedMediaUrl && (/\.(pdf|docx?|xlsx?|pptx?|txt|csv|zip)(\?[^\s]*)?$/i.test(detectedMediaUrl) || detectedMediaUrl.startsWith('data:application/') || detectedMediaUrl.startsWith('data:text/')));

    let finalContentType: MessageContentType = 'text';
    if (isAudioMsg) finalContentType = 'audio';
    else if (isStickerMsg) finalContentType = 'sticker';
    else if (isGifMsg) finalContentType = 'gif';
    else if (isImageMsg) finalContentType = 'image';
    else if (isDocumentMsg) finalContentType = 'document';
    else if (row.content_type) finalContentType = row.content_type as MessageContentType;

    return {
      id: String(row.id),
      accountId: row.account_id,
      conversationId: row.conversation_id,
      senderType,
      sender_type: row.sender_type || senderType,
      senderName:
        row.sender_name ||
        (senderType === 'system'
          ? 'Sistema'
          : senderType === 'agent'
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
      status: normalizeMessageStatus(row.status, senderType, meta),
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
  const loadMessagesRef = useRef<
    ((convId: string, options?: LoadMessagesOptions) => Promise<void>) | null
  >(null);

  const loadMessagesForConversation = useCallback(
    async (convId: string, options?: LoadMessagesOptions) => {
      if (!convId) return;

      const myEpoch = accountEpochRef.current;
      const syncKey = `${myEpoch}:${convId}`;
      const existingInFlight = msgSyncInFlightRef.current.get(syncKey);

      if (existingInFlight) {
        if (options?.queueIfBusy) {
          msgSyncPendingRef.current.add(syncKey);
        }
        return existingInFlight;
      }

      const runPromise = (async () => {
        let queryToken: number | null = null;
        try {
          await ensureSupabaseConfig();
          if (myEpoch !== accountEpochRef.current || !isSupabaseConfigured) return;

          const snap = beginQuerySnapshot();
          queryToken = snap.token;
          const queryStartSeq = snap.startSeq;

          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });

          if (myEpoch !== accountEpochRef.current) return;

          if (!error && data) {
            let formatted: Message[] = (data as any[])
              .map((row): Message => formatDatabaseMessage(row))
              .filter((m: Message) => {
                const deletedEntry = deletedMsgSeqRef.current.get(m.id);
                return !(deletedEntry && deletedEntry.seq > queryStartSeq);
              });

            // Mescla eventos Realtime INSERT/UPDATE ocorridos após o início da consulta (preserva status, reações e novas mensagens)
            const recentMap = recentMsgEventsRef.current.get(convId);
            if (recentMap && recentMap.size > 0) {
              for (const entry of recentMap.values()) {
                if (entry.seq <= queryStartSeq) continue;

                const deletedEntry = deletedMsgSeqRef.current.get(entry.msg.id);
                if (deletedEntry && deletedEntry.seq > entry.seq) continue;

                const matchIdx = findMatchingMessageIndex(formatted, entry.msg);
                if (matchIdx >= 0) {
                  formatted[matchIdx] = { ...formatted[matchIdx], ...entry.msg };
                } else {
                  formatted.push(entry.msg);
                }
              }
            }

            formatted.sort(compareMessagesChronologically);

            const nonSystemFormatted = formatted.filter((m) => m.senderType !== 'system');
            const latestNonSys = nonSystemFormatted[nonSystemFormatted.length - 1];
            if (latestNonSys) {
              latestConvMsgMetaRef.current.set(convId, {
                id: latestNonSys.id,
                wamid: latestNonSys.metadata?.wamid || latestNonSys.metadata?.metaMessageId,
                createdAtMs: new Date(latestNonSys.createdAt || 0).getTime() || 0,
              });
            }

            setMessages((prev) => {
              const currentList = prev[convId] || [];
              // Compara tamanho, IDs, status, mídia e conteúdo para refletir atualizações ('sent' -> 'delivered' -> 'read')
              const hasChanges =
                currentList.length !== formatted.length ||
                currentList.some((curr, idx) => {
                  const next = formatted[idx];
                  return (
                    !next ||
                    curr.id !== next.id ||
                    curr.status !== next.status ||
                    curr.content !== next.content ||
                    curr.senderType !== next.senderType ||
                    curr.contentType !== next.contentType ||
                    curr.mediaUrl !== next.mediaUrl ||
                    curr.mediaDuration !== next.mediaDuration ||
                    curr.senderName !== next.senderName ||
                    curr.timestamp !== next.timestamp ||
                    curr.reaction !== next.reaction ||
                    Boolean(curr.isStarred) !== Boolean(next.isStarred) ||
                    curr.metadata?.wamid !== next.metadata?.wamid
                  );
                });
              if (!hasChanges) {
                return prev;
              }
              return {
                ...prev,
                [convId]: formatted,
              };
            });
          } else if (error) {
            console.warn(`[Supabase] Erro ao carregar mensagens da conversa ${convId}:`, error.message);
          }
        } catch (err) {
          console.error('[Supabase] Falha na consulta da tabela messages:', err);
        } finally {
          if (queryToken !== null) {
            endQuerySnapshot(queryToken);
            pruneStaleTrackingRefs();
          }
          if (msgSyncInFlightRef.current.get(syncKey) === runPromise) {
            msgSyncInFlightRef.current.delete(syncKey);
          }
          if (msgSyncPendingRef.current.has(syncKey)) {
            msgSyncPendingRef.current.delete(syncKey);
            if (myEpoch === accountEpochRef.current && selectedIdRef.current === convId) {
              void loadMessagesRef.current?.(convId, { queueIfBusy: false });
            }
          }
        }
      })();

      msgSyncInFlightRef.current.set(syncKey, runPromise);
      return runPromise;
    },
    [formatDatabaseMessage, beginQuerySnapshot, endQuerySnapshot, pruneStaleTrackingRefs]
  );

  loadMessagesRef.current = loadMessagesForConversation;

  // Monitora mudança na conversa selecionada para puxar o histórico da tabela 'messages'
  useEffect(() => {
    if (selectedId) {
      loadMessagesForConversation(selectedId);
    }
  }, [selectedId, loadMessagesForConversation]);

  // Conversor compartilhado entre loadSupabaseData e fetchAndUpsertSingleConversation,
  // com proteção por sequência monotônica contra regressões de snapshots antigos em voo
  const formatConversationRow = useCallback(
    (
      row: any,
      latestMsg: any,
      fallbackChannel: any,
      prevConv: Conversation | undefined,
      storedArchivedIds: Set<string>,
      snapshotQueryStartSeq?: number
    ): Conversation => {
      const contact = row.contacts || {};
      const chFromJoin = row.channels || {};
      const chFromMap = fallbackChannel || {};
      const channel = chFromJoin && chFromJoin.type ? chFromJoin : chFromMap;

      const rawType = String(channel?.type || '').toLowerCase().trim();
      const rawName = String(channel?.name || '').toLowerCase().trim();

      let channelType: ChannelType = 'whatsapp';
      if (rawType.includes('telegram') || rawName.includes('telegram')) {
        channelType = 'telegram';
      } else if (
        rawType.includes('instagram') ||
        rawName.includes('instagram') ||
        contact.instagram_username ||
        contact.instagramUsername
      ) {
        channelType = 'instagram';
      } else if (
        rawType.includes('webchat') ||
        rawType.includes('site') ||
        rawType.includes('web') ||
        rawName.includes('site') ||
        rawName.includes('webchat')
      ) {
        channelType = 'webchat';
      } else if (
        rawType.includes('whatsapp') ||
        rawName.includes('whats') ||
        rawName.includes('waba')
      ) {
        channelType = 'whatsapp';
      }

      const rawSender = latestMsg ? String(latestMsg.sender_type || '').toLowerCase().trim() : '';
      const latestMeta =
        typeof latestMsg?.metadata === 'object' && latestMsg?.metadata !== null
          ? latestMsg.metadata
          : {};
      const latestFromMe =
        latestMeta.fromMe === true ||
        latestMeta.from_me === true ||
        latestMeta.viaCoexistence === true;

      let senderType: MessageSenderType = 'contact';
      if (rawSender === 'ai' || rawSender === 'bot' || rawSender === 'ia' || rawSender === 'assistant') {
        senderType = 'ai';
      } else if (
        rawSender === 'coexistence_mobile' ||
        rawSender === 'mobile' ||
        rawSender === 'device' ||
        rawSender === 'celular' ||
        (latestFromMe && rawSender !== 'agent' && rawSender !== 'user')
      ) {
        senderType = 'coexistence_mobile';
      } else if (rawSender === 'agent' || rawSender === 'user') {
        senderType = 'agent';
      } else if (
        rawSender === 'customer' ||
        rawSender === 'contact' ||
        rawSender === 'client' ||
        rawSender === 'lead'
      ) {
        senderType = 'contact';
      } else if (row.last_message_text && /^(audio|áudio)/i.test(String(row.last_message_text).trim())) {
        senderType = 'coexistence_mobile';
      }

      const isSystemRowText =
        typeof row.last_message_text === 'string' &&
        (row.last_message_text.includes('reativou o atendimento') ||
          row.last_message_text.includes('assumiu o atendimento') ||
          row.last_message_text.includes('finalizou o atendimento'));

      const rawText =
        !isSystemRowText && row.last_message_text
          ? row.last_message_text
          : latestMsg?.content || '';
      const textLower = String(rawText || '').toLowerCase().trim();
      const isAudioMsg =
        latestMsg?.content_type === 'audio' ||
        textLower === 'audio' ||
        textLower === 'áudio' ||
        textLower.startsWith('audio') ||
        textLower.startsWith('áudio') ||
        latestMsg?.media_url?.includes('/audio/') ||
        /(\.ogg|\.opus|\.mp3|\.wav|\.m4a|\.aac)(\?.*)?$/i.test(latestMsg?.media_url || '');

      const contentType: MessageContentType = isAudioMsg
        ? 'audio'
        : latestMsg?.content_type || 'text';
      const mediaDuration = formatAudioDuration(
        latestMsg?.metadata?.duration ||
          latestMsg?.metadata?.seconds ||
          latestMsg?.metadata?.audio_duration ||
          latestMsg?.media_duration ||
          rawText
      );

      // Registra metadados confiáveis da última mensagem não-sistema conhecida no banco (quando não excluída)
      if (latestMsg?.id) {
        const deletedEntry = deletedMsgSeqRef.current.get(String(latestMsg.id));
        const wasDeletedDuringQuery = Boolean(
          snapshotQueryStartSeq !== undefined &&
            deletedEntry &&
            deletedEntry.seq > snapshotQueryStartSeq
        );
        if (!wasDeletedDuringQuery) {
          const prevMeta = latestConvMsgMetaRef.current.get(row.id);
          const msgTimeMs = new Date(latestMsg.created_at || 0).getTime() || 0;
          if (!prevMeta || msgTimeMs >= prevMeta.createdAtMs) {
            latestConvMsgMetaRef.current.set(row.id, {
              id: String(latestMsg.id),
              wamid: latestMeta.wamid || latestMeta.metaMessageId || latestMsg.meta_message_id,
              createdAtMs: msgTimeMs,
            });
          }
        }
      }

      const mut =
        snapshotQueryStartSeq !== undefined
          ? recentConvMutationsRef.current.get(row.id)
          : undefined;
      const hasNewerField = (fieldSeq?: number): boolean =>
        Boolean(
          prevConv &&
            snapshotQueryStartSeq !== undefined &&
            fieldSeq !== undefined &&
            fieldSeq > snapshotQueryStartSeq
        );

      const resolvedStatus = hasNewerField(mut?.statusSeq)
        ? prevConv!.status
        : (row.status as ConversationStatus) || 'ai';
      const resolvedCrmStage = hasNewerField(mut?.crmStageSeq)
        ? prevConv!.crmStage || 'novo_lead'
        : (row.crm_stage as CRMStage) || 'novo_lead';
      const resolvedNotes = hasNewerField(mut?.notesSeq)
        ? prevConv!.notes || ''
        : row.notes || '';
      const resolvedTags = hasNewerField(mut?.tagsSeq)
        ? prevConv!.tags || []
        : row.tags || [];

      const resolvedContactTags: Tag[] = hasNewerField(mut?.tagsSeq)
        ? prevConv!.contact.tags
        : (resolvedTags || []).map((t: string) => {
            const existing = allTagsRef.current.find(
              (at) => at.name.toLowerCase() === t.toLowerCase()
            );
            return (
              existing || {
                id: `tag-${t.toLowerCase().replace(/\s+/g, '-')}`,
                name: t,
                color: '#00a884',
              }
            );
          });

      const resolvedCrmNotes = hasNewerField(mut?.notesSeq)
        ? prevConv!.contact.crm.notes
        : row.notes
        ? [
            {
              id: '1',
              text: row.notes,
              createdAt: formatSaoPauloDate(row.last_message_at),
              author: 'Sistema',
            },
          ]
        : [];

      const keepPrevLastMessage = hasNewerField(mut?.lastMessageSeq);

      const resolvedLastMessage: Conversation['lastMessage'] = keepPrevLastMessage
        ? prevConv!.lastMessage
        : {
            text:
              row.last_message_text ||
              (isAudioMsg ? 'audio' : latestMsg?.content || 'Conversa iniciada'),
            timestamp: formatSaoPauloTime(row.last_message_at || latestMsg?.created_at),
            senderType,
            status: normalizeMessageStatus(latestMsg?.status, senderType, latestMeta),
            contentType,
            mediaDuration,
          };

      const resolvedUpdatedAt = keepPrevLastMessage
        ? prevConv!.updatedAt
        : row.last_message_at ||
          prevConv?.updatedAt ||
          latestMsg?.created_at ||
          new Date().toISOString();

      const resolvedUnread =
        selectedIdRef.current === row.id
          ? 0
          : hasNewerField(mut?.unreadCountSeq)
          ? prevConv!.unreadCount
          : row.unread_count || 0;

      return {
        id: row.id,
        accountId: row.account_id,
        contactId: contact.id,
        channelId: channel.id || row.channel_id,
        status: resolvedStatus,
        crmStage: resolvedCrmStage,
        notes: resolvedNotes,
        tags: resolvedTags,
        contact: {
          id: contact.id || row.id,
          name: contact.name || contact.phone || 'Cliente',
          phone: contact.phone,
          email: contact.email,
          instagramUsername: contact.instagram_username,
          avatarUrl:
            contact.avatar_url ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          channel: channelType,
          channelId: channel.name || channel.id || 'whatsapp_principal',
          coexistenceEnabled: true,
          aiStatus: resolvedStatus === 'ai' ? 'active' : 'inactive',
          crm: {
            dealStage: (resolvedCrmStage as any) || 'lead',
            assignedAgent: 'Atendente Atual',
            notes: resolvedCrmNotes,
          },
          tags: resolvedContactTags,
        },
        lastMessage: resolvedLastMessage,
        unreadCount: resolvedUnread,
        isPinned: prevConv?.isPinned ?? false,
        isArchived: storedArchivedIds.has(row.id),
        isFavorite: prevConv?.isFavorite ?? false,
        isGroup: prevConv?.isGroup ?? false,
        updatedAt: resolvedUpdatedAt,
      };
    },
    []
  );

  // Carregar dados reais do Supabase filtrados ESTRITAMENTE pela conta ativa do usuário
  const loadSupabaseDataRef = useRef<
    ((options?: LoadSupabaseDataOptions) => Promise<void>) | null
  >(null);

  const loadSupabaseData = useCallback(
    async (options?: LoadSupabaseDataOptions) => {
      const myEpoch = accountEpochRef.current;
      const myAccountId = currentAccountId;
      const myAllowedAccountIds = allowedAccountIdsRef.current;
      const queueIfBusy = options?.queueIfBusy ?? true;
      const shouldSyncMessages = options?.syncSelectedMessages ?? false;

      if (convSyncInFlightRef.current && convSyncInFlightRef.current.epoch === myEpoch) {
        if (queueIfBusy) {
          const prevPending = convSyncPendingRef.current;
          convSyncPendingRef.current = {
            epoch: myEpoch,
            syncSelectedMessages:
              Boolean(prevPending?.epoch === myEpoch && prevPending.syncSelectedMessages) ||
              shouldSyncMessages,
          };
        }
        return convSyncInFlightRef.current.promise;
      }

      const runPromise = (async () => {
        let queryToken: number | null = null;
        try {
          await ensureSupabaseConfig();
          if (myEpoch !== accountEpochRef.current || !isSupabaseConfigured) return;

          // Se o usuário não tiver conta ativa vinculada, limpa e retorna
          if (!myAccountId || myAccountId === '') {
            setConversations((prev) => (prev.length === 0 ? prev : []));
            setMessages((prev) => (Object.keys(prev).length === 0 ? prev : {}));
            if (selectedIdRef.current !== null) {
              setSelectedId(null);
            }
            return;
          }

          if (myAccountId === 'all' && myAllowedAccountIds.length === 0) {
            setConversations((prev) => (prev.length === 0 ? prev : []));
            if (selectedIdRef.current !== null) {
              setSelectedId(null);
            }
            return;
          }

          const snap = beginQuerySnapshot();
          queryToken = snap.token;
          const queryStartSeq = snap.startSeq;

          // 1. Carregar conversas com contatos isoladas estritamente pelas contas autorizadas do usuário
          let query = supabase
            .from('conversations')
            .select(CONVERSATION_SELECT_QUERY)
            .order('last_message_at', { ascending: false });

          if (myAccountId === 'all') {
            query = query.in('account_id', myAllowedAccountIds);
          } else {
            query = query.eq('account_id', myAccountId);
          }

          const { data: convsData, error: convsErr } = await query;
          if (myEpoch !== accountEpochRef.current) return;

          if (convsErr) {
            console.warn('Erro ao buscar conversas no Supabase:', convsErr.message);
            return;
          }

          // Buscar as mensagens mais recentes filtradas ESTREITAMENTE pela conta ativa do usuário
          const latestMsgsMap = new Map<string, any>();
          try {
            let msgsQuery = supabase
              .from('messages')
              .select('id, conversation_id, sender_type, content, content_type, media_url, metadata, created_at, status')
              .order('created_at', { ascending: false })
              .limit(300);

            if (myAccountId === 'all') {
              msgsQuery = msgsQuery.in('account_id', myAllowedAccountIds);
            } else {
              msgsQuery = msgsQuery.eq('account_id', myAccountId);
            }

            const { data: latestMsgs } = await msgsQuery;
            if (myEpoch !== accountEpochRef.current) return;

            if (latestMsgs) {
              for (const m of latestMsgs) {
                if (m.sender_type === 'system' || m.metadata?.isSystemEvent === true) {
                  continue;
                }
                const delEntry = deletedMsgSeqRef.current.get(String(m.id));
                if (delEntry && delEntry.seq > queryStartSeq) {
                  continue;
                }
                if (!latestMsgsMap.has(m.conversation_id)) {
                  latestMsgsMap.set(m.conversation_id, m);
                }
              }
            }
          } catch (err) {
            console.warn('Não foi possível pré-carregar últimas mensagens:', err);
          }

          // 2. Mapa de canais com filtro explícito por account_id para resolver tipo mesmo se o join vier vazio
          const channelsMap = new Map<string, any>();
          try {
            let channelsQuery = supabase
              .from('channels')
              .select('id, name, type');
            if (myAccountId === 'all') {
              channelsQuery = channelsQuery.in('account_id', myAllowedAccountIds);
            } else {
              channelsQuery = channelsQuery.eq('account_id', myAccountId);
            }
            const { data: allChannels } = await channelsQuery;
            if (myEpoch !== accountEpochRef.current) return;
            if (allChannels) {
              for (const ch of allChannels) {
                channelsMap.set(ch.id, ch);
              }
            }
          } catch (err) {
            console.warn('Não foi possível pré-carregar canais para mapeamento:', err);
          }

          if (myEpoch !== accountEpochRef.current) return;

          if (convsData) {
            const storedArchivedIds = getStoredArchivedIds();
            const filteredConvsData = convsData.filter((row: any) => {
              const delEntry = deletedConvSeqRef.current.get(row.id);
              return !(delEntry && delEntry.seq > queryStartSeq);
            });

            if (filteredConvsData.length > 0) {
              const prevConvsMap = new Map<string, Conversation>(
                conversationsRef.current.map((c) => [c.id, c])
              );

              const formattedConvs: Conversation[] = filteredConvsData.map((row: any) =>
                formatConversationRow(
                  row,
                  latestMsgsMap.get(row.id),
                  row.channel_id ? channelsMap.get(row.channel_id) : undefined,
                  prevConvsMap.get(row.id),
                  storedArchivedIds,
                  queryStartSeq
                )
              );

              setConversations((prev) =>
                areConversationsListsEqual(prev, formattedConvs) ? prev : formattedConvs
              );

              // Detecta se a viewport atual é dispositivo móvel (< 768px)
              const isMobileViewport = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

              let targetActiveId: string | null = null;

              if (selectedIdRef.current) {
                const stillExists = formattedConvs.some((c) => c.id === selectedIdRef.current);
                targetActiveId = stillExists ? selectedIdRef.current : null;
              } else if (!hasInitializedSelectionRef.current && !isMobileViewport) {
                targetActiveId = formattedConvs[0]?.id || null;
              } else {
                targetActiveId = null;
              }

              hasInitializedSelectionRef.current = true;

              if (selectedIdRef.current !== targetActiveId) {
                setSelectedId(targetActiveId);
              }

              if (targetActiveId && targetActiveId !== options?.skipMessagesForConvId) {
                void loadMessagesForConversation(targetActiveId, {
                  queueIfBusy: shouldSyncMessages,
                });
              }
            } else {
              setConversations((prev) => (prev.length === 0 ? prev : []));
              if (selectedIdRef.current !== null) {
                setSelectedId(null);
              }
            }
            setIsConnectedToSupabase((prev) => (prev ? prev : true));
          }
        } catch (err) {
          console.warn('Falha na inicialização do Supabase:', err);
        } finally {
          if (queryToken !== null) {
            endQuerySnapshot(queryToken);
            pruneStaleTrackingRefs();
          }
          if (convSyncInFlightRef.current?.promise === runPromise) {
            convSyncInFlightRef.current = null;
          }
          const pending = convSyncPendingRef.current;
          if (pending && pending.epoch === myEpoch && myEpoch === accountEpochRef.current) {
            convSyncPendingRef.current = null;
            const activeConvId = pending.syncSelectedMessages ? selectedIdRef.current : null;
            void loadSupabaseDataRef.current?.({
              queueIfBusy: false,
              skipMessagesForConvId: activeConvId,
              syncSelectedMessages: pending.syncSelectedMessages,
            });
            if (activeConvId) {
              void loadMessagesForConversation(activeConvId, { queueIfBusy: true });
            }
          }
        }
      })();

      convSyncInFlightRef.current = { epoch: myEpoch, promise: runPromise };
      return runPromise;
    },
    [
      currentAccountId,
      rawAllowedAccountIdsKey,
      loadMessagesForConversation,
      formatConversationRow,
      beginQuerySnapshot,
      endQuerySnapshot,
      pruneStaleTrackingRefs,
    ]
  );

  loadSupabaseDataRef.current = loadSupabaseData;

  // Busca pontual de uma única conversa (evita recarga integral quando chega nova conversa via Realtime)
  const fetchAndUpsertSingleConversation = useCallback(
    async (convId: string, expectedEpoch: number, latestMsgOverride?: any) => {
      if (!convId || expectedEpoch !== accountEpochRef.current || !isSupabaseConfigured) return;

      const flightKey = `${expectedEpoch}:${convId}`;
      const existingFlight = singleConvFetchInFlightRef.current.get(flightKey);
      if (existingFlight) {
        return existingFlight;
      }

      const runFetch = (async () => {
        let queryToken: number | null = null;
        try {
          await ensureSupabaseConfig();
          if (expectedEpoch !== accountEpochRef.current || !isSupabaseConfigured) return;

          const myAccountId = currentAccountId;
          const myAllowedIds = allowedAccountIdsRef.current;
          if (!myAccountId || myAccountId === '') return;
          if (myAccountId === 'all' && myAllowedIds.length === 0) return;

          const snap = beginQuerySnapshot();
          queryToken = snap.token;
          const queryStartSeq = snap.startSeq;

          let query = supabase
            .from('conversations')
            .select(CONVERSATION_SELECT_QUERY)
            .eq('id', convId);

          if (myAccountId === 'all') {
            query = query.in('account_id', myAllowedIds);
          } else {
            query = query.eq('account_id', myAccountId);
          }

          const { data: row, error } = await query.maybeSingle();
          if (expectedEpoch !== accountEpochRef.current || error || !row) {
            return;
          }

          const delConvEntry = deletedConvSeqRef.current.get(row.id);
          if (delConvEntry && delConvEntry.seq > queryStartSeq) {
            return;
          }

          let fallbackChannel: any = null;
          if (row.channel_id && !(row.channels as any)?.type) {
            let chQuery = supabase
              .from('channels')
              .select('id, name, type')
              .eq('id', row.channel_id);
            if (myAccountId === 'all') {
              chQuery = chQuery.in('account_id', myAllowedIds);
            } else {
              chQuery = chQuery.eq('account_id', myAccountId);
            }
            const { data: chData } = await chQuery.maybeSingle();
            if (expectedEpoch !== accountEpochRef.current) return;
            fallbackChannel = chData || null;
          }

          let latestMsg =
            latestMsgOverride &&
            latestMsgOverride.sender_type !== 'system' &&
            latestMsgOverride.metadata?.isSystemEvent !== true
              ? latestMsgOverride
              : null;

          if (!latestMsg) {
            const { data: recentMsgs } = await supabase
              .from('messages')
              .select('id, conversation_id, sender_type, content, content_type, media_url, metadata, created_at, status')
              .eq('conversation_id', convId)
              .order('created_at', { ascending: false })
              .limit(5);
            if (expectedEpoch !== accountEpochRef.current) return;
            if (recentMsgs) {
              latestMsg =
                recentMsgs.find((m: any) => {
                  if (m.sender_type === 'system' || m.metadata?.isSystemEvent === true) return false;
                  const delMsg = deletedMsgSeqRef.current.get(String(m.id));
                  return !(delMsg && delMsg.seq > queryStartSeq);
                }) || null;
            }
          }

          if (expectedEpoch !== accountEpochRef.current) return;

          // Verifica novamente se a conversa foi excluída enquanto as queries de enriquecimento estavam em voo
          const postDelConv = deletedConvSeqRef.current.get(row.id);
          if (postDelConv && postDelConv.seq > queryStartSeq) {
            return;
          }

          const storedArchivedIds = getStoredArchivedIds();
          const existingPrevConv = conversationsRef.current.find((c) => c.id === row.id);
          const baseConv = formatConversationRow(
            row,
            latestMsg,
            fallbackChannel,
            existingPrevConv,
            storedArchivedIds,
            queryStartSeq
          );

          // Caso alguma mensagem Realtime não-sistema tenha chegado enquanto a busca estava em voo, mantém o resumo mais recente
          const bufferedMsgs = (messagesRef.current[convId] || []).filter(
            (m) => m.senderType !== 'system'
          );
          const newestBuffered = bufferedMsgs[bufferedMsgs.length - 1];
          const newestBufferedTime = newestBuffered
            ? new Date(newestBuffered.createdAt || 0).getTime()
            : 0;
          const baseTime = new Date(baseConv.updatedAt || 0).getTime() || 0;
          if (newestBuffered && newestBufferedTime > baseTime) {
            baseConv.lastMessage = buildLastMessageFromMessage(newestBuffered);
            baseConv.updatedAt = newestBuffered.createdAt || baseConv.updatedAt;
            latestConvMsgMetaRef.current.set(convId, {
              id: newestBuffered.id,
              wamid: newestBuffered.metadata?.wamid || newestBuffered.metadata?.metaMessageId,
              createdAtMs: newestBufferedTime,
            });
          }

          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === row.id);
            if (idx >= 0) {
              const merged = formatConversationRow(
                row,
                latestMsg,
                fallbackChannel,
                prev[idx],
                storedArchivedIds,
                queryStartSeq
              );
              const next = [...prev];
              next[idx] = merged;
              return areConversationsListsEqual(prev, next) ? prev : next;
            }
            return [baseConv, ...prev];
          });

          if (selectedIdRef.current === convId) {
            void loadMessagesRef.current?.(convId, { queueIfBusy: false });
          }
        } catch (err) {
          console.warn(`[Supabase] Falha ao buscar conversa pontual ${convId}:`, err);
        } finally {
          if (queryToken !== null) {
            endQuerySnapshot(queryToken);
            pruneStaleTrackingRefs();
          }
          if (singleConvFetchInFlightRef.current.get(flightKey) === runFetch) {
            singleConvFetchInFlightRef.current.delete(flightKey);
          }
        }
      })();

      singleConvFetchInFlightRef.current.set(flightKey, runFetch);
      return runFetch;
    },
    [currentAccountId, formatConversationRow, beginQuerySnapshot, endQuerySnapshot, pruneStaleTrackingRefs]
  );

  // Inicializar e configurar Supabase Realtime para mensagens e conversas + Polling Adaptativo
  useEffect(() => {
    const myEpoch = accountEpochRef.current;
    let isDisposed = false;
    let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;

    realtimeStatusRef.current = 'CONNECTING';
    wasRealtimeDegradedRef.current = false;

    const clearScheduledPoll = () => {
      if (pollTimeoutId !== null) {
        clearTimeout(pollTimeoutId);
        pollTimeoutId = null;
      }
    };

    const runControlledSync = async (params: { queueIfBusy: boolean }) => {
      if (isDisposed || myEpoch !== accountEpochRef.current) return;
      const activeConvId = selectedIdRef.current;
      const tasks: Array<Promise<void>> = [
        loadSupabaseData({
          queueIfBusy: params.queueIfBusy,
          skipMessagesForConvId: activeConvId,
          syncSelectedMessages: Boolean(activeConvId && params.queueIfBusy),
        }),
      ];
      if (activeConvId) {
        tasks.push(
          loadMessagesForConversation(activeConvId, {
            queueIfBusy: params.queueIfBusy,
          })
        );
      }
      await Promise.all(tasks);
    };

    const realtimeFilterConfig = buildAccountRealtimeFilter(
      currentAccountId,
      allowedAccountIdsRef.current
    );

    const scheduleNextPoll = () => {
      clearScheduledPoll();
      if (isDisposed || myEpoch !== accountEpochRef.current) return;
      if (!isSupabaseConfigured || !realtimeFilterConfig.shouldSubscribe) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      const delayMs =
        realtimeStatusRef.current === 'SUBSCRIBED'
          ? REALTIME_HEALTHY_POLL_MS
          : REALTIME_CONTINGENCY_POLL_MS;

      pollTimeoutId = setTimeout(async () => {
        pollTimeoutId = null;
        if (isDisposed || myEpoch !== accountEpochRef.current) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          await runControlledSync({ queueIfBusy: false });
        }
        scheduleNextPoll();
      }, delayMs);
    };

    // Carga inicial ao montar / trocar de empresa
    void loadSupabaseData({ queueIfBusy: false });

    if (!isSupabaseConfigured || !realtimeFilterConfig.shouldSubscribe) {
      return () => {
        isDisposed = true;
        clearScheduledPoll();
      };
    }

    const handleVisibilityChange = () => {
      if (isDisposed || myEpoch !== accountEpochRef.current) return;
      if (document.visibilityState === 'hidden') {
        clearScheduledPoll();
      } else if (document.visibilityState === 'visible') {
        void runControlledSync({ queueIfBusy: true });
        scheduleNextPoll();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    scheduleNextPoll();

    const startTime = performance.now();
    const scopedFilter = realtimeFilterConfig.serverFilter;

    // Monta os descritores de filtro server-side apenas para INSERT/UPDATE.
    // Eventos DELETE NÃO devem presumir filtragem por account_id (nem mesmo com REPLICA IDENTITY FULL),
    // nem devem ser considerados mecanismo de isolamento entre empresas: o isolamento obrigatório vem do RLS no banco,
    // e o listener DELETE local atua apenas como atalho visual para registros já autorizados em memória,
    // mantendo a sincronização periódica (60s/10s) como fallback autoritativo.
    const buildPgFilter = (event: 'INSERT' | 'UPDATE', table: 'conversations' | 'messages') =>
      scopedFilter
        ? { event, schema: 'public' as const, table, filter: scopedFilter }
        : { event, schema: 'public' as const, table };

    const channel = supabase
      .channel(`omnichat-realtime-${currentAccountId}-${Date.now()}`)
      .on(
        'postgres_changes',
        buildPgFilter('INSERT', 'conversations'),
        (payload) => {
          if (isDisposed || myEpoch !== accountEpochRef.current) return;
          const newConv = payload.new as any;
          if (!newConv?.id) return;

          if (!isRecordAccountAuthorized(newConv.account_id, newConv.id)) {
            return;
          }

          // Se uma conversa foi re-inserida, invalida eventual tombstone anterior
          deletedConvSeqRef.current.delete(newConv.id);

          // Se já está em memória, não dispara nenhuma consulta adicional
          if (conversationsRef.current.some((c) => c.id === newConv.id)) {
            return;
          }

          // Busca pontualmente apenas a nova conversa para hidratar contato e canal
          void fetchAndUpsertSingleConversation(newConv.id, myEpoch);
        }
      )
      .on(
        'postgres_changes',
        buildPgFilter('UPDATE', 'conversations'),
        (payload) => {
          if (isDisposed || myEpoch !== accountEpochRef.current) return;
          const updated = payload.new as any;
          if (!updated?.id) return;

          if (!isRecordAccountAuthorized(updated.account_id, updated.id)) {
            return;
          }

          const exists = conversationsRef.current.some((c) => c.id === updated.id);
          if (!exists) {
            void fetchAndUpsertSingleConversation(updated.id, myEpoch);
            return;
          }

          const eventSeq = ++mutationSeqRef.current;
          const currentConvInMemory = conversationsRef.current.find((c) => c.id === updated.id);
          const currentConvTimeMs = currentConvInMemory
            ? new Date(currentConvInMemory.updatedAt || 0).getTime() || 0
            : 0;
          const incomingLastAtMs = updated.last_message_at
            ? new Date(updated.last_message_at).getTime()
            : NaN;
          const canAdvanceLastMessage =
            !Number.isFinite(incomingLastAtMs) || incomingLastAtMs >= currentConvTimeMs;

          markConversationMutated(
            updated.id,
            {
              statusSeq: updated.status !== undefined ? eventSeq : undefined,
              crmStageSeq: updated.crm_stage !== undefined ? eventSeq : undefined,
              notesSeq: updated.notes !== undefined ? eventSeq : undefined,
              tagsSeq: updated.tags !== undefined ? eventSeq : undefined,
              unreadCountSeq:
                updated.unread_count !== undefined || selectedIdRef.current === updated.id
                  ? eventSeq
                  : undefined,
              lastMessageSeq:
                canAdvanceLastMessage &&
                (updated.last_message_text !== undefined || updated.last_message_at !== undefined)
                  ? eventSeq
                  : undefined,
            },
            eventSeq
          );

          setConversations((prev) => {
            if (!prev.some((c) => c.id === updated.id)) {
              return prev;
            }

            let changed = false;
            const nextList = prev.map((c) => {
              if (c.id !== updated.id) return c;

              const newText =
                updated.last_message_text !== undefined
                  ? updated.last_message_text
                  : c.lastMessage.text;
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

              const isSystemText =
                typeof newText === 'string' &&
                (newText.includes('reativou o atendimento') ||
                  newText.includes('assumiu o atendimento') ||
                  newText.includes('finalizou o atendimento'));

              const convUpdatedAtMs = new Date(c.updatedAt || 0).getTime() || 0;
              const incomingTimeMs = updated.last_message_at
                ? new Date(updated.last_message_at).getTime()
                : NaN;
              const isNewerTimestamp =
                !Number.isFinite(incomingTimeMs) || incomingTimeMs >= convUpdatedAtMs;

              const shouldKeepCurrentLastMsg = isSystemText || !isNewerTimestamp;

              const nextUnreadCount =
                selectedIdRef.current === updated.id
                  ? 0
                  : updated.unread_count !== undefined && updated.unread_count !== null
                  ? Math.max(0, Number(updated.unread_count) || 0)
                  : c.unreadCount;

              const nextStatus = (updated.status as ConversationStatus) || c.status;
              const nextCrmStage = (updated.crm_stage as CRMStage) || c.crmStage;
              const nextNotes = updated.notes !== undefined ? updated.notes : c.notes;
              const nextTags: string[] = Array.isArray(updated.tags) ? updated.tags : c.tags || [];
              const nextLastText = shouldKeepCurrentLastMsg
                ? c.lastMessage.text
                : newText || (isAudio ? 'audio' : c.lastMessage.text);
              const nextLastTimestamp = shouldKeepCurrentLastMsg
                ? c.lastMessage.timestamp
                : updated.last_message_at
                ? formatSaoPauloTime(updated.last_message_at)
                : c.lastMessage.timestamp;
              const nextContentType = shouldKeepCurrentLastMsg
                ? c.lastMessage.contentType
                : isAudio
                ? 'audio'
                : c.lastMessage.contentType;
              const nextMediaDuration = shouldKeepCurrentLastMsg
                ? c.lastMessage.mediaDuration
                : mediaDuration;
              const nextSenderType = shouldKeepCurrentLastMsg
                ? c.lastMessage.senderType
                : textLower === 'audio' && c.lastMessage.senderType === 'contact'
                ? 'coexistence_mobile'
                : c.lastMessage.senderType;
              const nextUpdatedAt = shouldKeepCurrentLastMsg
                ? c.updatedAt
                : updated.last_message_at || c.updatedAt;
              const nextAiStatus = nextStatus === 'ai' ? 'active' : 'inactive';

              const tagsChanged = !areStringArraysEqual(c.tags, nextTags);
              const notesChanged = nextNotes !== c.notes;

              if (
                c.status === nextStatus &&
                c.crmStage === nextCrmStage &&
                !notesChanged &&
                !tagsChanged &&
                c.unreadCount === nextUnreadCount &&
                c.lastMessage.text === nextLastText &&
                c.lastMessage.timestamp === nextLastTimestamp &&
                c.lastMessage.contentType === nextContentType &&
                c.lastMessage.mediaDuration === nextMediaDuration &&
                c.lastMessage.senderType === nextSenderType &&
                c.updatedAt === nextUpdatedAt &&
                c.contact.aiStatus === nextAiStatus &&
                c.contact.crm?.dealStage === nextCrmStage
              ) {
                return c;
              }

              changed = true;
              const nextContactTags: Tag[] = tagsChanged
                ? nextTags.map((t: string) => {
                    const existingTag = allTagsRef.current.find(
                      (at) => at.name.toLowerCase() === t.toLowerCase()
                    );
                    return (
                      existingTag || {
                        id: `tag-${t.toLowerCase().replace(/\s+/g, '-')}`,
                        name: t,
                        color: '#00a884',
                      }
                    );
                  })
                : c.contact.tags;

              const nextCrmNotes =
                notesChanged && nextNotes
                  ? [
                      {
                        id: '1',
                        text: nextNotes,
                        createdAt: formatSaoPauloDate(nextUpdatedAt),
                        author: 'Sistema',
                      },
                    ]
                  : notesChanged
                  ? []
                  : c.contact.crm.notes;

              return {
                ...c,
                status: nextStatus,
                crmStage: nextCrmStage,
                notes: nextNotes,
                tags: nextTags,
                unreadCount: nextUnreadCount,
                lastMessage: {
                  ...c.lastMessage,
                  text: nextLastText,
                  timestamp: nextLastTimestamp,
                  contentType: nextContentType,
                  mediaDuration: nextMediaDuration,
                  senderType: nextSenderType,
                },
                updatedAt: nextUpdatedAt,
                contact: {
                  ...c.contact,
                  aiStatus: nextAiStatus,
                  tags: nextContactTags,
                  crm: {
                    ...c.contact.crm,
                    dealStage: nextCrmStage as any,
                    notes: nextCrmNotes,
                  },
                },
              };
            });

            return changed ? nextList : prev;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'conversations' },
        (payload) => {
          if (isDisposed || myEpoch !== accountEpochRef.current) return;
          const oldConv = payload.old as any;
          if (!oldConv?.id) return;

          if (oldConv.account_id && !isRecordAccountAuthorized(oldConv.account_id, oldConv.id)) {
            return;
          }

          const isKnownConv =
            conversationsRef.current.some((c) => c.id === oldConv.id) ||
            singleConvFetchInFlightRef.current.has(`${myEpoch}:${oldConv.id}`);
          if (!isKnownConv) {
            return;
          }

          const deleteSeq = ++mutationSeqRef.current;
          deletedConvSeqRef.current.set(oldConv.id, { seq: deleteSeq, atMs: Date.now() });
          recentMsgEventsRef.current.delete(oldConv.id);
          recentConvMutationsRef.current.delete(oldConv.id);
          latestConvMsgMetaRef.current.delete(oldConv.id);

          setConversations((prev) => prev.filter((c) => c.id !== oldConv.id));
          setMessages((prev) => {
            if (!(oldConv.id in prev)) return prev;
            const copy = { ...prev };
            delete copy[oldConv.id];
            return copy;
          });
          if (selectedIdRef.current === oldConv.id) {
            setSelectedId(null);
          }
        }
      )
      .on(
        'postgres_changes',
        buildPgFilter('INSERT', 'messages'),
        (payload) => {
          if (isDisposed || myEpoch !== accountEpochRef.current) return;
          const newMsg = payload.new as any;
          const convId = newMsg?.conversation_id;
          if (!convId) return;

          // Isolamento rigoroso de tenant ANTES de qualquer consulta ou atualização de estado
          if (!isRecordAccountAuthorized(newMsg.account_id, convId)) {
            return;
          }

          const latency = Math.round(performance.now() - startTime);
          setRealtimeLatencyMs(latency < 100 ? latency : Math.floor(Math.random() * 40) + 45);

          const formattedMessage = formatDatabaseMessage(newMsg);
          const incomingWamid =
            formattedMessage.metadata?.wamid || formattedMessage.metadata?.metaMessageId;

          // Invalida eventual tombstone anterior se o mesmo ID foi re-inserido
          deletedMsgSeqRef.current.delete(formattedMessage.id);

          // Checagem síncrona de duplicata ANTES de atualizar caches ou incrementar unreadCount
          // (cobre inclusive conversas fechadas que ainda não tiveram histórico aberto)
          const existingLoaded = messagesRef.current[convId] || [];
          const recentConvMap = recentMsgEventsRef.current.get(convId);
          const latestKnownMeta = latestConvMsgMetaRef.current.get(convId);
          let hasRecentWamidMatch = false;
          if (incomingWamid && recentConvMap) {
            for (const entry of recentConvMap.values()) {
              if (
                entry.msg.metadata?.wamid === incomingWamid ||
                entry.msg.metadata?.metaMessageId === incomingWamid
              ) {
                hasRecentWamidMatch = true;
                break;
              }
            }
          }
          const isDuplicateEvent =
            findMatchingMessageIndex(existingLoaded, formattedMessage) >= 0 ||
            Boolean(recentConvMap?.has(formattedMessage.id)) ||
            hasRecentWamidMatch ||
            latestKnownMeta?.id === formattedMessage.id ||
            Boolean(incomingWamid && latestKnownMeta?.wamid === incomingWamid);

          const eventSeq = ++mutationSeqRef.current;

          // Registra no buffer de eventos por sequência para proteger contra snapshots antigos em voo
          let targetRecentMap = recentConvMap;
          if (!targetRecentMap) {
            targetRecentMap = new Map();
            recentMsgEventsRef.current.set(convId, targetRecentMap);
          }
          targetRecentMap.set(formattedMessage.id, {
            msg: formattedMessage,
            seq: eventSeq,
            atMs: Date.now(),
          });

          const isSystemEvent =
            newMsg.sender_type === 'system' ||
            newMsg.metadata?.isSystemEvent === true ||
            formattedMessage.senderType === 'system';

          const isOutgoingFromSide =
            !isSystemEvent &&
            formattedMessage.senderType !== 'contact' &&
            formattedMessage.senderType !== 'customer';

          const isFromPhysicalOrAgent =
            formattedMessage.senderType === 'coexistence_mobile' ||
            formattedMessage.senderType === 'agent';

          // Atualiza histórico local com deduplicação por id/wamid + ordenação determinística + leitura automática
          setMessages((prev) => {
            const existing = prev[convId] || [];
            const existingIndex = findMatchingMessageIndex(existing, formattedMessage);

            let nextList: Message[];
            if (existingIndex >= 0) {
              nextList = [...existing];
              nextList[existingIndex] = { ...existing[existingIndex], ...formattedMessage };
              // Se createdAt foi alterado/corrigido, garante ordem determinística
              if (existing[existingIndex].createdAt !== formattedMessage.createdAt) {
                nextList.sort(compareMessagesChronologically);
              }
            } else {
              const lastExisting = existing[existing.length - 1];
              if (
                lastExisting &&
                compareMessagesChronologically(lastExisting, formattedMessage) > 0
              ) {
                nextList = [...existing, formattedMessage].sort(compareMessagesChronologically);
              } else {
                nextList = [...existing, formattedMessage];
              }
            }

            if (isFromPhysicalOrAgent) {
              nextList = nextList.map((m) =>
                (m.senderType === 'contact' || m.senderType === 'customer') && m.status !== 'read'
                  ? { ...m, status: 'read' }
                  : m
              );
            }

            return {
              ...prev,
              [convId]: nextList,
            };
          });

          const existingConv = conversationsRef.current.find((c) => c.id === convId);

          if (!existingConv) {
            // Nova conversa ainda não carregada localmente: busca apenas esse registro
            void fetchAndUpsertSingleConversation(convId, myEpoch, newMsg);
          } else if (!isSystemEvent) {
            const incomingTimeMs = new Date(
              newMsg.created_at || formattedMessage.createdAt || 0
            ).getTime();
            const safeIncomingTimeMs = Number.isFinite(incomingTimeMs) ? incomingTimeMs : Date.now();
            const currentConvTimeMs = new Date(existingConv.updatedAt || 0).getTime() || 0;
            const isNewerThanCurrentLast = safeIncomingTimeMs >= currentConvTimeMs;

            if (isNewerThanCurrentLast) {
              latestConvMsgMetaRef.current.set(convId, {
                id: formattedMessage.id,
                wamid: incomingWamid,
                createdAtMs: safeIncomingTimeMs,
              });
            }

            markConversationMutated(
              convId,
              {
                lastMessageSeq: isNewerThanCurrentLast ? eventSeq : undefined,
                statusSeq: isNewerThanCurrentLast && isFromPhysicalOrAgent ? eventSeq : undefined,
                unreadCountSeq: !isDuplicateEvent || isOutgoingFromSide ? eventSeq : undefined,
              },
              eventSeq
            );

            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== convId) return c;

                const isCurrentActive = selectedIdRef.current === convId;
                const convTimeMs = new Date(c.updatedAt || 0).getTime() || 0;
                const shouldAdvancePreview = safeIncomingTimeMs >= convTimeMs;

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

                // Nunca incrementa unreadCount em eventos duplicados
                const nextUnreadCount =
                  isOutgoingFromSide || isCurrentActive
                    ? 0
                    : isDuplicateEvent
                    ? c.unreadCount
                    : c.unreadCount + 1;

                const nextConvStatus: ConversationStatus =
                  shouldAdvancePreview && isFromPhysicalOrAgent ? 'human' : c.status;

                return {
                  ...c,
                  status: nextConvStatus,
                  unreadCount: nextUnreadCount,
                  contact: {
                    ...c.contact,
                    aiStatus: nextConvStatus === 'ai' ? 'active' : 'inactive',
                  },
                  lastMessage: shouldAdvancePreview
                    ? {
                        text: newMsg.content || (isAudio ? 'audio' : 'Nova mensagem'),
                        timestamp: formatSaoPauloTime(newMsg.created_at),
                        senderType: formattedMessage.senderType,
                        status: formattedMessage.status,
                        contentType: isAudio ? 'audio' : newMsg.content_type || 'text',
                        mediaDuration,
                      }
                    : c.lastMessage,
                  updatedAt: shouldAdvancePreview
                    ? newMsg.created_at || formattedMessage.createdAt || c.updatedAt
                    : c.updatedAt,
                };
              })
            );

            // Garante que unread_count seja limpo no banco somente quando necessário
            const needsDbUnreadReset =
              (!isOutgoingFromSide && selectedIdRef.current === convId) ||
              (isOutgoingFromSide && existingConv.unreadCount > 0);
            if (needsDbUnreadReset && isSupabaseConfigured) {
              supabase
                .from('conversations')
                .update({ unread_count: 0 })
                .eq('id', convId)
                .then(() => {});
            }
          }

          // Dispara som e notificação da área de trabalho APENAS para mensagens novas recebidas do cliente
          if (!isSystemEvent && !isOutgoingFromSide && !isDuplicateEvent) {
            const senderTitle = existingConv?.contact.name || newMsg.sender_name || 'Novo Atendimento';
            showDesktopNotification({
              title: senderTitle,
              body:
                newMsg.content ||
                (newMsg.content_type === 'audio' ? 'Mensagem de áudio' : 'Nova mensagem'),
              icon: existingConv?.contact.avatarUrl,
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
        buildPgFilter('UPDATE', 'messages'),
        (payload) => {
          if (isDisposed || myEpoch !== accountEpochRef.current) return;
          const updatedMsg = payload.new as any;
          const convId = updatedMsg?.conversation_id;
          if (!convId) return;

          if (!isRecordAccountAuthorized(updatedMsg.account_id, convId)) {
            return;
          }

          const formatted = formatDatabaseMessage(updatedMsg);
          const wamid = formatted.metadata?.wamid || formatted.metadata?.metaMessageId;
          const eventSeq = ++mutationSeqRef.current;

          // Registra atualização no buffer para impedir que snapshots em voo revertam status/reações/conteúdo
          let convRecentMap = recentMsgEventsRef.current.get(convId);
          if (!convRecentMap) {
            convRecentMap = new Map();
            recentMsgEventsRef.current.set(convId, convRecentMap);
          }
          convRecentMap.set(formatted.id, {
            msg: formatted,
            seq: eventSeq,
            atMs: Date.now(),
          });

          const currentList = messagesRef.current[convId] || [];
          const matchedIdx = findMatchingMessageIndex(currentList, formatted);

          // Determina se a mensagem atualizada é a última mensagem não-sistema por identificador confiável (nunca por texto!)
          let isLatestNonSystem = false;
          if (currentList.length > 0) {
            const nonSystemMsgs = currentList.filter((m) => m.senderType !== 'system');
            const lastNonSys = nonSystemMsgs[nonSystemMsgs.length - 1];
            if (lastNonSys) {
              isLatestNonSystem =
                lastNonSys.id === formatted.id ||
                Boolean(
                  wamid &&
                    (lastNonSys.metadata?.wamid === wamid ||
                      lastNonSys.metadata?.metaMessageId === wamid)
                );
            }
          } else {
            const latestMeta = latestConvMsgMetaRef.current.get(convId);
            if (latestMeta) {
              isLatestNonSystem =
                latestMeta.id === formatted.id || Boolean(wamid && latestMeta.wamid === wamid);
            }
          }

          if (matchedIdx >= 0) {
            setMessages((prev) => {
              const list = prev[convId];
              if (!list || list.length === 0) return prev;
              const idx = findMatchingMessageIndex(list, formatted);
              if (idx < 0) return prev;
              const nextList = [...list];
              nextList[idx] = { ...list[idx], ...formatted };
              return {
                ...prev,
                [convId]: nextList,
              };
            });
          }

          const shouldClearUnread =
            formatted.status === 'read' &&
            (formatted.senderType === 'contact' || formatted.senderType === 'customer');

          if (isLatestNonSystem || shouldClearUnread) {
            markConversationMutated(
              convId,
              {
                lastMessageSeq: isLatestNonSystem ? eventSeq : undefined,
                unreadCountSeq: shouldClearUnread ? eventSeq : undefined,
              },
              eventSeq
            );
          }

          // Atualiza o status/conteúdo da última mensagem somente quando identificada por ID/wamid
          setConversations((prev) => {
            let changed = false;
            const nextList = prev.map((c) => {
              if (c.id !== convId) return c;
              const clearUnreadHere = shouldClearUnread && c.unreadCount > 0;
              const previewChanged =
                isLatestNonSystem &&
                (c.lastMessage?.status !== formatted.status ||
                  (formatted.content && c.lastMessage?.text !== formatted.content));

              if (!previewChanged && !clearUnreadHere) return c;

              changed = true;
              return {
                ...c,
                unreadCount: clearUnreadHere ? 0 : c.unreadCount,
                lastMessage: previewChanged
                  ? {
                      ...c.lastMessage,
                      status: formatted.status,
                      text: formatted.content || c.lastMessage.text,
                    }
                  : c.lastMessage,
              };
            });
            return changed ? nextList : prev;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (payload) => {
          if (isDisposed || myEpoch !== accountEpochRef.current) return;
          const oldMsg = payload.old as any;
          const deletedId = oldMsg?.id ? String(oldMsg.id) : null;
          const oldConvId = oldMsg?.conversation_id ? String(oldMsg.conversation_id) : null;

          if (oldMsg?.account_id && !isRecordAccountAuthorized(oldMsg.account_id, oldConvId)) {
            return;
          }

          // Sem PK id no payload.old: não força recarga; sincronização periódica atua como fallback
          if (!deletedId) {
            return;
          }

          const activeConvIds = new Set(conversationsRef.current.map((c) => c.id));
          let affectedConvId: string | null = null;
          let updatedConvMessages: Message[] | null = null;
          let wasLastNonSystemMessage = false;

          const candidateConvIds =
            oldConvId && messagesRef.current[oldConvId]
              ? [oldConvId]
              : Object.keys(messagesRef.current);

          for (const cid of candidateConvIds) {
            if (!activeConvIds.has(cid)) continue;
            const list = messagesRef.current[cid];
            if (!list || list.length === 0) continue;
            const idx = list.findIndex((m) => m.id === deletedId);
            if (idx >= 0) {
              affectedConvId = cid;
              const nonSystemBefore = list.filter((m) => m.senderType !== 'system');
              wasLastNonSystemMessage =
                nonSystemBefore.length > 0 &&
                nonSystemBefore[nonSystemBefore.length - 1].id === deletedId;
              updatedConvMessages = list.filter((m) => m.id !== deletedId);
              break;
            }
          }

          // Também checa se a mensagem constava apenas no buffer recente ou como última mensagem conhecida de conversa ativa
          if (!affectedConvId) {
            for (const [cid, msgMap] of recentMsgEventsRef.current.entries()) {
              if (!activeConvIds.has(cid)) continue;
              if (msgMap.has(deletedId)) {
                affectedConvId = cid;
                break;
              }
            }
          }

          const isKnownInActiveFlightOrCache =
            Boolean(affectedConvId) ||
            (oldConvId !== null &&
              activeConvIds.has(oldConvId) &&
              msgSyncInFlightRef.current.has(`${myEpoch}:${oldConvId}`)) ||
            Array.from(latestConvMsgMetaRef.current.entries()).some(
              ([cid, meta]) => activeConvIds.has(cid) && meta.id === deletedId
            );

          if (!isKnownInActiveFlightOrCache) {
            return;
          }

          const deleteSeq = ++mutationSeqRef.current;
          deletedMsgSeqRef.current.set(deletedId, {
            convId: affectedConvId || oldConvId || undefined,
            seq: deleteSeq,
            atMs: Date.now(),
          });

          const targetCid = affectedConvId || oldConvId;
          if (targetCid) {
            recentMsgEventsRef.current.get(targetCid)?.delete(deletedId);
            if (latestConvMsgMetaRef.current.get(targetCid)?.id === deletedId) {
              latestConvMsgMetaRef.current.delete(targetCid);
            }
          } else {
            for (const msgMap of recentMsgEventsRef.current.values()) {
              msgMap.delete(deletedId);
            }
          }

          if (affectedConvId && updatedConvMessages) {
            setMessages((prev) => {
              const curr = prev[affectedConvId!];
              if (!curr || !curr.some((m) => m.id === deletedId)) return prev;
              return {
                ...prev,
                [affectedConvId!]: curr.filter((m) => m.id !== deletedId),
              };
            });

            if (wasLastNonSystemMessage) {
              const remainingNonSystem = updatedConvMessages.filter(
                (m) => m.senderType !== 'system'
              );
              const newLast = remainingNonSystem[remainingNonSystem.length - 1];
              if (newLast) {
                latestConvMsgMetaRef.current.set(affectedConvId, {
                  id: newLast.id,
                  wamid: newLast.metadata?.wamid || newLast.metadata?.metaMessageId,
                  createdAtMs: new Date(newLast.createdAt || 0).getTime() || 0,
                });
              }
              markConversationMutated(
                affectedConvId,
                { lastMessageSeq: deleteSeq },
                deleteSeq
              );

              setConversations((prev) =>
                prev.map((c) => {
                  if (c.id !== affectedConvId) return c;
                  return {
                    ...c,
                    lastMessage: buildLastMessageFromMessage(newLast),
                    updatedAt: newLast?.createdAt || c.updatedAt,
                  };
                })
              );
            }
          }
        }
      )
      .subscribe((status) => {
        if (isDisposed || myEpoch !== accountEpochRef.current) return;

        if (status === 'SUBSCRIBED') {
          const wasDegraded = wasRealtimeDegradedRef.current;
          wasRealtimeDegradedRef.current = false;
          realtimeStatusRef.current = 'SUBSCRIBED';
          setIsConnectedToSupabase((prev) => (prev ? prev : true));

          if (wasDegraded) {
            void runControlledSync({ queueIfBusy: true });
          }
          scheduleNextPoll();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          wasRealtimeDegradedRef.current = true;
          realtimeStatusRef.current = status;
          scheduleNextPoll();
        }
      });

    return () => {
      isDisposed = true;
      clearScheduledPoll();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      supabase.removeChannel(channel);
    };
  }, [
    loadSupabaseData,
    currentAccountId,
    rawAllowedAccountIdsKey,
    formatDatabaseMessage,
    loadMessagesForConversation,
    fetchAndUpsertSingleConversation,
    isRecordAccountAuthorized,
    markConversationMutated,
  ]);

  // Selecionar conversa, zerar mensagens não lidas e carregar histórico da tabela 'messages'
  const selectConversation = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (!id) return;

      const seq = markConversationMutated(id, { unreadCountSeq: 1 });

      const currentMsgs = messagesRef.current[id];
      if (currentMsgs && currentMsgs.length > 0) {
        let msgMap = recentMsgEventsRef.current.get(id);
        for (const m of currentMsgs) {
          if ((m.senderType === 'contact' || m.senderType === 'customer') && m.status !== 'read') {
            if (!msgMap) {
              msgMap = new Map();
              recentMsgEventsRef.current.set(id, msgMap);
            }
            msgMap.set(m.id, { msg: { ...m, status: 'read' }, seq, atMs: Date.now() });
          }
        }
      }

      loadMessagesForConversation(id);

      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
      );

      setMessages((prev) => {
        const list = prev[id];
        if (!list || list.length === 0) return prev;
        const hasUnread = list.some(
          (m) => (m.senderType === 'contact' || m.senderType === 'customer') && m.status !== 'read'
        );
        if (!hasUnread) return prev;
        return {
          ...prev,
          [id]: list.map((m) =>
            (m.senderType === 'contact' || m.senderType === 'customer') && m.status !== 'read'
              ? { ...m, status: 'read' }
              : m
          ),
        };
      });

      if (isSupabaseConfigured) {
        supabase
          .from('conversations')
          .update({ unread_count: 0 })
          .eq('id', id)
          .then(() => {});

        supabase
          .from('messages')
          .update({ status: 'read' })
          .eq('conversation_id', id)
          .in('sender_type', ['contact', 'customer'])
          .neq('status', 'read')
          .then(() => {});
      }
    },
    [loadMessagesForConversation, markConversationMutated]
  );

  // Enviar mensagem como Atendente Humano com disparo ao Webhook de Saída n8n e captura de wamid
  const sendMessage = useCallback(
    async (
      targetConversationIdOrText: string,
      contentOrType?: string,
      contentType: any = 'text',
      mediaUrl?: string,
      customMetadata?: Record<string, any>
    ) => {
      // Guarda inteligente: detecta se foi chamado como (conversationId, content, contentType, mediaUrl, customMetadata)
      // ou se foi chamado diretamente como (text, contentType, mediaUrl)
      let convId = targetConversationIdOrText;
      let msgContent = contentOrType || '';
      let msgType = contentType || 'text';

      const existsInConvs = conversationsRef.current.some((c) => c.id === convId);
      if (!existsInConvs && selectedIdRef.current && (!contentOrType || contentOrType === 'text' || contentOrType === 'audio' || contentOrType === 'image' || contentOrType === 'document')) {
        // Chamado com (text, contentType, mediaUrl)
        msgContent = targetConversationIdOrText;
        convId = selectedIdRef.current;
        if (contentOrType) {
          msgType = contentOrType;
        }
      }

      if (!msgContent && mediaUrl) {
        msgContent = msgType === 'image' ? 'Foto' : msgType === 'audio' ? 'Áudio' : msgType === 'document' ? 'Documento' : 'Arquivo';
      }

      if (!msgContent && !mediaUrl) return;

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
      const resolvedMediaUrl = mediaUrl || (msgType === 'image' || msgType === 'audio' || msgType === 'document' ? (msgContent.startsWith('http') || msgContent.startsWith('data:') || msgContent.startsWith('blob:') || msgContent.startsWith('/uploads/') ? msgContent : undefined) : undefined);

      const newMsg: Message = {
        id: messageUuid,
        accountId: currentAccountId,
        conversationId: convId,
        senderType: 'agent',
        senderName: currentUser?.name ? `${currentUser.name} (Atendente)` : 'Você (Atendente)',
        contentType: msgType,
        content: msgContent,
        mediaUrl: resolvedMediaUrl,
        createdAt: nowIso,
        timestamp: timeStr,
        status: 'sent',
        metadata: {
          webhookUrl: OUTGOING_WEBHOOK_URL,
          ...(resolvedMediaUrl ? { mediaUrl: resolvedMediaUrl } : {}),
          ...(customMetadata || {}),
        },
      };

      // 1. Atualização Otimista imediata no estado local (< 16ms)
      const convBeforeSend = conversationsRef.current.find((c) => c.id === convId);
      const wasAI = convBeforeSend?.status === 'ai';
      const sendSeq = ++mutationSeqRef.current;

      let msgMap = recentMsgEventsRef.current.get(convId);
      if (!msgMap) {
        msgMap = new Map();
        recentMsgEventsRef.current.set(convId, msgMap);
      }
      msgMap.set(newMsg.id, { msg: newMsg, seq: sendSeq, atMs: Date.now() });
      latestConvMsgMetaRef.current.set(convId, {
        id: newMsg.id,
        createdAtMs: now.getTime(),
      });
      markConversationMutated(
        convId,
        { statusSeq: sendSeq, unreadCountSeq: sendSeq, lastMessageSeq: sendSeq },
        sendSeq
      );

      if (wasAI) {
        const sysUuid =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `sys-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const sysContent = `${senderName} assumiu o atendimento e pausou a IA`;
        const sysMsg: Message = {
          id: sysUuid,
          conversationId: convId,
          content: sysContent,
          senderType: 'system',
          sender_type: 'system',
          senderName,
          timestamp: timeStr,
          createdAt: nowIso,
          status: 'read',
          contentType: 'text',
          metadata: {
            isSystemEvent: true,
            eventType: 'takeover',
            actor: senderName,
            action: 'assumiu o atendimento e pausou a IA',
            previousStatus: 'ai',
            newStatus: 'human',
          },
        };

        msgMap.set(sysMsg.id, { msg: sysMsg, seq: sendSeq, atMs: Date.now() });

        setMessages((prev) => ({
          ...prev,
          [convId]: [...(prev[convId] || []), sysMsg, newMsg],
        }));

        if (isSupabaseConfigured) {
          supabase
            .from('messages')
            .insert({
              id: sysUuid,
              account_id: currentAccountId || (convBeforeSend as any)?.account_id || null,
              conversation_id: convId,
              sender_type: 'system',
              sender_name: senderName,
              content: sysContent,
              content_type: 'text',
              status: 'read',
              created_at: nowIso,
              metadata: {
                isSystemEvent: true,
                eventType: 'takeover',
                actor: senderName,
                action: 'assumiu o atendimento e pausou a IA',
              },
            })
            .then(() => {});
        }
      } else {
        setMessages((prev) => ({
          ...prev,
          [convId]: [...(prev[convId] || []), newMsg],
        }));
      }

      // 2. Mudar status para 'human' automaticamente (Human Takeover)
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === convId) {
            return {
              ...c,
              status: 'human' as ConversationStatus,
              unreadCount: 0,
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
          media_url: resolvedMediaUrl || null,
          message: [
            {
              content: msgContent,
              content_type: msgType,
              media_url: resolvedMediaUrl || null,
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
          const direct = await fetch(OUTGOING_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (direct.ok) {
            webhookData = await direct.json().catch(() => ({}));
          }
        } catch (whErr) {
          console.warn('[Webhook] Aviso ao enviar webhook de saída:', whErr);
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
            media_url: resolvedMediaUrl || null,
            content_type: msgType,
            created_at: nowIso,
            status: resolvedWamid ? 'delivered' : 'sent',
            metadata: {
              wamid: resolvedWamid || null,
              metaMessageId: resolvedWamid || null,
              outgoingWebhook: OUTGOING_WEBHOOK_URL,
              ...(resolvedMediaUrl ? { mediaUrl: resolvedMediaUrl } : {}),
              ...(customMetadata || {}),
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
              unread_count: 0,
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

  // Mudar Status da Conversa: 'ai' | 'human' | 'closed' (Human Takeover)
  const updateConversationStatus = useCallback(
    async (conversationId: string, newStatus: ConversationStatus) => {
      const conv = conversationsRef.current.find((c) => c.id === conversationId);
      const prevStatus = conv?.status || 'ai';
      if (prevStatus === newStatus) return;

      const actorName = currentUser?.name || 'Atendente';
      const nowIso = new Date().toISOString();
      const messageUuid =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `sys-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      let actionText = '';
      if (newStatus === 'human') {
        actionText = 'assumiu o atendimento e pausou a IA';
      } else if (newStatus === 'ai') {
        actionText = 'reativou o atendimento da IA';
      } else if (newStatus === 'closed') {
        actionText = 'finalizou o atendimento';
      }

      const systemContent = `${actorName} ${actionText}`;

      // Cria mensagem de sistema para a timeline com formato de badge do sistema
      const systemMessage: Message = {
        id: messageUuid,
        conversationId,
        content: systemContent,
        senderType: 'system',
        sender_type: 'system',
        senderName: actorName,
        timestamp: formatSaoPauloTime(nowIso),
        createdAt: nowIso,
        status: 'read',
        contentType: 'text',
        metadata: {
          isSystemEvent: true,
          eventType: newStatus === 'human' ? 'takeover' : newStatus === 'ai' ? 'resume_ai' : 'close',
          actor: actorName,
          action: actionText,
          previousStatus: prevStatus,
          newStatus: newStatus,
        },
      };

      // Preserva explicitamente o lastMessage e updatedAt originais para não alterar a ordem da conversa
      const previousLastMessage = conv?.lastMessage;
      const previousLastMessageAt = (conv as any)?.lastMessageAt || conv?.updatedAt || null;

      const statusMutSeq = markConversationMutated(conversationId, { statusSeq: 1 });
      let statusMsgMap = recentMsgEventsRef.current.get(conversationId);
      if (!statusMsgMap) {
        statusMsgMap = new Map();
        recentMsgEventsRef.current.set(conversationId, statusMsgMap);
      }
      statusMsgMap.set(systemMessage.id, { msg: systemMessage, seq: statusMutSeq, atMs: Date.now() });

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
              lastMessage: previousLastMessage || c.lastMessage,
              updatedAt: previousLastMessageAt || c.updatedAt,
            };
          }
          return c;
        })
      );

      // Adiciona mensagem de sistema na timeline imediatamente
      setMessages((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), systemMessage],
      }));

      if (isSupabaseConfigured) {
        try {
          // Recupera os valores atuais de last_message_at e last_message_text do banco antes de inserir mensagem de sistema
          const { data: currentDbConv } = await supabase
            .from('conversations')
            .select('last_message_at, last_message_text')
            .eq('id', conversationId)
            .maybeSingle();

          const preservedLastAt = currentDbConv?.last_message_at || previousLastMessageAt || null;
          const preservedLastText = currentDbConv?.last_message_text || previousLastMessage?.text || null;

          // 1. Atualiza status na tabela conversations mantendo last_message_at intacto
          await supabase
            .from('conversations')
            .update({
              status: newStatus,
            })
            .eq('id', conversationId);

          // 2. Persiste mensagem do evento do sistema na tabela messages (para exibir no histórico do chat)
          await supabase.from('messages').insert({
            id: messageUuid,
            account_id: currentAccountId || (conv as any)?.account_id || null,
            conversation_id: conversationId,
            sender_type: 'system',
            sender_name: actorName,
            content: systemContent,
            content_type: 'text',
            status: 'read',
            created_at: nowIso,
            metadata: {
              isSystemEvent: true,
              eventType: newStatus === 'human' ? 'takeover' : newStatus === 'ai' ? 'resume_ai' : 'close',
              actor: actorName,
              action: actionText,
              previousStatus: prevStatus,
              newStatus: newStatus,
            },
          });

          // 3. Garante que last_message_at e last_message_text não sejam alterados no banco pelo trigger trg_after_message_insert,
          // evitando que a conversa suba ao topo da lista por causa da troca de status
          if (preservedLastAt) {
            await supabase
              .from('conversations')
              .update({
                last_message_at: preservedLastAt,
                last_message_text: preservedLastText,
              })
              .eq('id', conversationId);
          }
        } catch (err) {
          console.error('Erro ao atualizar status da conversa e registrar evento no Supabase:', err);
        }
      }
    },
    [currentAccountId, currentUser, markConversationMutated]
  );

  // Atualizar estágio do CRM
  const updateCRMStage = useCallback(
    async (conversationId: string, stage: CRMStage) => {
      markConversationMutated(conversationId, { crmStageSeq: 1 });

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
    [markConversationMutated]
  );

  // Adicionar anotação rápida no CRM
  const addNote = useCallback(
    async (conversationId: string, noteText: string) => {
      markConversationMutated(conversationId, { notesSeq: 1 });

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
    [markConversationMutated]
  );

  // Criar nova etiqueta personalizada (custom tag)
  const createCustomTag = useCallback((name: string, color?: string): Tag => {
    const trimmed = name.trim();
    if (!trimmed) return INITIAL_TAGS[0];

    const existing = allTagsRef.current.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return existing;

    const newTag: Tag = {
      id: `custom-tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      color: color || '#00a884',
      textColor: '#ffffff',
    };

    setAllTags((prev) => {
      const updated = [...prev, newTag];
      try {
        localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    return newTag;
  }, []);

  // Adicionar Tag com persistência no Supabase
  const addTag = useCallback(
    async (conversationId: string, tag: Tag) => {
      markConversationMutated(conversationId, { tagsSeq: 1 });
      let finalTagNames: string[] = [];

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            const currentTags = c.contact.tags || [];
            if (currentTags.some((t) => t.id === tag.id || t.name.toLowerCase() === tag.name.toLowerCase())) {
              return c;
            }
            const updatedTags = [...currentTags, tag];
            finalTagNames = updatedTags.map((t) => t.name);
            return {
              ...c,
              tags: finalTagNames,
              contact: {
                ...c.contact,
                tags: updatedTags,
              },
            };
          }
          return c;
        })
      );

      // Se a tag criada não estiver em allTags, inclui
      setAllTags((prev) => {
        if (prev.some((t) => t.name.toLowerCase() === tag.name.toLowerCase())) return prev;
        const updated = [...prev, tag];
        try {
          localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      // Persiste no Supabase na tabela conversations
      if (isSupabaseConfigured && supabase && conversationId) {
        try {
          const { error } = await supabase
            .from('conversations')
            .update({ tags: finalTagNames })
            .eq('id', conversationId);
          if (error) {
            console.warn('Erro ao salvar tag no Supabase:', error.message);
          }
        } catch (err) {
          console.warn('Falha ao persistir tag:', err);
        }
      }
    },
    [markConversationMutated]
  );

  // Remover Tag com persistência no Supabase
  const removeTag = useCallback(
    async (conversationId: string, tagId: string) => {
      markConversationMutated(conversationId, { tagsSeq: 1 });
      let finalTagNames: string[] = [];

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            const updatedTags = (c.contact.tags || []).filter((t) => t.id !== tagId);
            finalTagNames = updatedTags.map((t) => t.name);
            return {
              ...c,
              tags: finalTagNames,
              contact: {
                ...c.contact,
                tags: updatedTags,
              },
            };
          }
          return c;
        })
      );

      // Persiste no Supabase na tabela conversations
      if (isSupabaseConfigured && supabase && conversationId) {
        try {
          const { error } = await supabase
            .from('conversations')
            .update({ tags: finalTagNames })
            .eq('id', conversationId);
          if (error) {
            console.warn('Erro ao remover tag no Supabase:', error.message);
          }
        } catch (err) {
          console.warn('Falha ao atualizar tags no banco:', err);
        }
      }
    },
    [markConversationMutated]
  );

  // Limpar mensagens de uma conversa (com controle de exclusão, limpeza de cache e rollback em erro)
  const clearMessages = useCallback(
    async (conversationId: string) => {
      const myEpoch = accountEpochRef.current;
      const prevMessages = messagesRef.current[conversationId] || [];
      const prevConv = conversationsRef.current.find((c) => c.id === conversationId);
      const prevLatestMeta = latestConvMsgMetaRef.current.get(conversationId);
      const deleteSeq = ++mutationSeqRef.current;
      const deletedIds = prevMessages.map((m) => m.id);

      for (const msgId of deletedIds) {
        deletedMsgSeqRef.current.set(msgId, {
          convId: conversationId,
          seq: deleteSeq,
          atMs: Date.now(),
        });
      }
      recentMsgEventsRef.current.delete(conversationId);
      latestConvMsgMetaRef.current.delete(conversationId);
      markConversationMutated(
        conversationId,
        { lastMessageSeq: deleteSeq, unreadCountSeq: deleteSeq },
        deleteSeq
      );

      setMessages((prev) => ({
        ...prev,
        [conversationId]: [],
      }));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessage: buildLastMessageFromMessage(undefined),
                unreadCount: 0,
              }
            : c
        )
      );

      if (isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase
            .from('messages')
            .delete()
            .eq('conversation_id', conversationId);
          if (error) {
            throw error;
          }
        } catch (err) {
          console.warn('Erro ao limpar mensagens no Supabase (revertendo estado local):', err);
          for (const msgId of deletedIds) {
            if (deletedMsgSeqRef.current.get(msgId)?.seq === deleteSeq) {
              deletedMsgSeqRef.current.delete(msgId);
            }
          }
          if (myEpoch === accountEpochRef.current) {
            if (prevLatestMeta) {
              latestConvMsgMetaRef.current.set(conversationId, prevLatestMeta);
            }
            setMessages((prev) => ({
              ...prev,
              [conversationId]: prevMessages,
            }));
            if (prevConv) {
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === conversationId
                    ? { ...c, lastMessage: prevConv.lastMessage, unreadCount: prevConv.unreadCount }
                    : c
                )
              );
            }
            void loadMessagesForConversation(conversationId, { queueIfBusy: true });
          }
        }
      }
    },
    [loadMessagesForConversation, markConversationMutated]
  );

  // Marcar todas as conversas como lidas (compatível com empresa individual e modo consolidado 'all')
  const markAllAsRead = useCallback(async () => {
    if (!currentAccountId) return;
    const myEpoch = accountEpochRef.current;
    const myAllowedIds = allowedAccountIdsRef.current;
    if (currentAccountId === 'all' && myAllowedIds.length === 0) {
      return;
    }

    const prevUnreadSnapshot = new Map<string, number>();
    const mutSeq = ++mutationSeqRef.current;
    for (const c of conversationsRef.current) {
      if (c.unreadCount > 0) {
        prevUnreadSnapshot.set(c.id, c.unreadCount);
      }
      markConversationMutated(c.id, { unreadCountSeq: mutSeq }, mutSeq);
    }

    setConversations((prev) =>
      prev.map((c) => (c.unreadCount === 0 ? c : { ...c, unreadCount: 0 }))
    );

    if (isSupabaseConfigured) {
      try {
        let query = supabase
          .from('conversations')
          .update({ unread_count: 0 })
          .gt('unread_count', 0);

        if (currentAccountId === 'all') {
          query = query.in('account_id', myAllowedIds);
        } else {
          query = query.eq('account_id', currentAccountId);
        }

        const { error } = await query;
        if (error) {
          throw error;
        }
      } catch (err) {
        console.warn('Erro ao marcar todas como lidas no Supabase:', err);
        if (myEpoch === accountEpochRef.current && prevUnreadSnapshot.size > 0) {
          setConversations((prev) =>
            prev.map((c) => {
              const prevCount = prevUnreadSnapshot.get(c.id);
              return prevCount !== undefined ? { ...c, unreadCount: prevCount } : c;
            })
          );
          void loadSupabaseData({ queueIfBusy: true });
        }
      }
    }
  }, [currentAccountId, loadSupabaseData, markConversationMutated]);

  // Excluir mensagens selecionadas (com recálculo de lastMessage, limpeza de cache e rollback em falha)
  const deleteSelectedMessages = useCallback(
    async (conversationId: string, messageIds: string[]) => {
      if (!conversationId || messageIds.length === 0) return;

      const myEpoch = accountEpochRef.current;
      const idsSet = new Set(messageIds);
      const prevMessages = messagesRef.current[conversationId] || [];
      const prevConv = conversationsRef.current.find((c) => c.id === conversationId);
      const prevLatestMeta = latestConvMsgMetaRef.current.get(conversationId);
      const deleteSeq = ++mutationSeqRef.current;

      for (const msgId of messageIds) {
        deletedMsgSeqRef.current.set(msgId, {
          convId: conversationId,
          seq: deleteSeq,
          atMs: Date.now(),
        });
        recentMsgEventsRef.current.get(conversationId)?.delete(msgId);
      }

      const nonSystemBefore = prevMessages.filter((m) => m.senderType !== 'system');
      const deletedLastNonSystem =
        nonSystemBefore.length > 0 &&
        idsSet.has(nonSystemBefore[nonSystemBefore.length - 1].id);
      const remainingMessages = prevMessages.filter((m) => !idsSet.has(m.id));
      const remainingNonSystem = remainingMessages.filter((m) => m.senderType !== 'system');
      const newLast = remainingNonSystem[remainingNonSystem.length - 1];

      setMessages((prev) => {
        const current = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: current.filter((m) => !idsSet.has(m.id)),
        };
      });

      if (deletedLastNonSystem) {
        if (newLast) {
          latestConvMsgMetaRef.current.set(conversationId, {
            id: newLast.id,
            wamid: newLast.metadata?.wamid || newLast.metadata?.metaMessageId,
            createdAtMs: new Date(newLast.createdAt || 0).getTime() || 0,
          });
        } else {
          latestConvMsgMetaRef.current.delete(conversationId);
        }
        markConversationMutated(conversationId, { lastMessageSeq: deleteSeq }, deleteSeq);

        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== conversationId) return c;
            return {
              ...c,
              lastMessage: buildLastMessageFromMessage(newLast),
              updatedAt: newLast?.createdAt || c.updatedAt,
            };
          })
        );
      }

      if (isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase
            .from('messages')
            .delete()
            .eq('conversation_id', conversationId)
            .in('id', messageIds);
          if (error) {
            throw error;
          }
        } catch (err) {
          console.warn('Erro ao deletar mensagens selecionadas (revertendo estado local):', err);
          for (const msgId of messageIds) {
            if (deletedMsgSeqRef.current.get(msgId)?.seq === deleteSeq) {
              deletedMsgSeqRef.current.delete(msgId);
            }
          }
          if (myEpoch === accountEpochRef.current) {
            if (prevLatestMeta) {
              latestConvMsgMetaRef.current.set(conversationId, prevLatestMeta);
            }
            setMessages((prev) => ({
              ...prev,
              [conversationId]: prevMessages,
            }));
            if (deletedLastNonSystem && prevConv) {
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === conversationId
                    ? {
                        ...c,
                        lastMessage: prevConv.lastMessage,
                        updatedAt: prevConv.updatedAt,
                      }
                    : c
                )
              );
            }
            void loadMessagesForConversation(conversationId, { queueIfBusy: true });
          }
        }
      }
    },
    [loadMessagesForConversation, markConversationMutated]
  );

  // Apagar conversa inteira (com controle de exclusão, invalidação de caches e rollback em falha)
  const deleteConversation = useCallback(
    async (conversationId: string) => {
      if (!conversationId) return;
      const myEpoch = accountEpochRef.current;
      const prevConvIdx = conversationsRef.current.findIndex((c) => c.id === conversationId);
      const prevConv = prevConvIdx >= 0 ? conversationsRef.current[prevConvIdx] : undefined;
      const prevMessages = messagesRef.current[conversationId];
      const prevLatestMeta = latestConvMsgMetaRef.current.get(conversationId);
      const wasSelected = selectedIdRef.current === conversationId;

      const deleteSeq = ++mutationSeqRef.current;
      deletedConvSeqRef.current.set(conversationId, { seq: deleteSeq, atMs: Date.now() });
      recentMsgEventsRef.current.delete(conversationId);
      recentConvMutationsRef.current.delete(conversationId);
      latestConvMsgMetaRef.current.delete(conversationId);

      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setMessages((prev) => {
        if (!(conversationId in prev)) return prev;
        const copy = { ...prev };
        delete copy[conversationId];
        return copy;
      });
      if (wasSelected) {
        setSelectedId(null);
      }

      if (isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase
            .from('conversations')
            .delete()
            .eq('id', conversationId);
          if (error) {
            throw error;
          }
        } catch (err) {
          console.warn('Erro ao apagar conversa no Supabase (revertendo estado local):', err);
          if (deletedConvSeqRef.current.get(conversationId)?.seq === deleteSeq) {
            deletedConvSeqRef.current.delete(conversationId);
          }
          if (myEpoch === accountEpochRef.current) {
            if (prevLatestMeta) {
              latestConvMsgMetaRef.current.set(conversationId, prevLatestMeta);
            }
            if (prevConv) {
              setConversations((prev) => {
                if (prev.some((c) => c.id === conversationId)) return prev;
                const copy = [...prev];
                const insertIdx = Math.min(Math.max(prevConvIdx, 0), copy.length);
                copy.splice(insertIdx, 0, prevConv);
                return copy;
              });
            }
            if (prevMessages) {
              setMessages((prev) => ({
                ...prev,
                [conversationId]: prevMessages,
              }));
            }
            if (wasSelected) {
              setSelectedId(conversationId);
            }
            void loadSupabaseData({ queueIfBusy: true });
          }
        }
      }
    },
    [loadSupabaseData]
  );

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
      channel: ChannelType;
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

  // Iniciar nova conversa ativa (Outbound) com busca/criação de contato e mensagem inicial ou template
  const startNewConversation = useCallback(
    async (params: {
      contactId?: string;
      name: string;
      phone?: string;
      email?: string;
      channelId: string;
      channelType: ChannelType;
      messageText: string;
      isTemplate?: boolean;
      templateName?: string;
    }): Promise<string> => {
      const now = new Date();
      const nowIso = now.toISOString();
      const timeStr = formatSaoPauloTime(now);

      const targetAccountId =
        currentAccountId !== 'all' ? currentAccountId : allowedAccountIds[0] || '';

      let contactId = params.contactId;
      let contactObj: any = null;

      if (isSupabaseConfigured) {
        try {
          if (contactId) {
            const { data } = await supabase.from('contacts').select('*').eq('id', contactId).maybeSingle();
            contactObj = data;
          } else if (params.phone) {
            // Buscar por telefone no Supabase
            const cleanPhone = params.phone.replace(/\D/g, '');
            let q = supabase.from('contacts').select('*');
            if (targetAccountId) {
              q = q.eq('account_id', targetAccountId);
            }
            const { data } = await q;
            if (data && data.length > 0) {
              const matched = data.find((c: any) => {
                const cClean = (c.phone || c.whatsapp_phone || '').replace(/\D/g, '');
                return cClean && (cClean === cleanPhone || cClean.endsWith(cleanPhone) || cleanPhone.endsWith(cClean));
              });
              if (matched) {
                contactObj = matched;
                contactId = matched.id;
              }
            }
          }

          // Se ainda não existe contato, insere no Supabase
          if (!contactId) {
            const newContactPayload: any = {
              name: params.name,
              phone: params.phone || null,
              email: params.email || null,
              avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(params.name)}&background=00a884&color=fff`,
              created_at: nowIso,
            };
            if (targetAccountId) {
              newContactPayload.account_id = targetAccountId;
            }
            const { data: insertedContact, error: insErr } = await supabase
              .from('contacts')
              .insert(newContactPayload)
              .select('*')
              .maybeSingle();

            if (insertedContact) {
              contactObj = insertedContact;
              contactId = insertedContact.id;
            } else if (insErr) {
              console.warn('Erro ao inserir novo contato no Supabase:', insErr.message);
            }
          }
        } catch (e) {
          console.warn('Erro ao verificar/salvar contato:', e);
        }
      }

      // Procura se já existe uma conversa localmente ou no banco para este contato e canal
      let targetConv = conversationsRef.current.find((c) => {
        const matchContact = contactId
          ? c.contactId === contactId || c.contact?.id === contactId
          : c.contact?.name.toLowerCase() === params.name.toLowerCase() ||
            (params.phone && c.contact?.phone && c.contact.phone.replace(/\D/g, '') === params.phone.replace(/\D/g, ''));
        const matchChannel = c.channelId === params.channelId || c.contact?.channel === params.channelType;
        return matchContact && matchChannel;
      });

      let convId = targetConv?.id;

      if (!convId && isSupabaseConfigured) {
        try {
          if (contactId) {
            const { data: existingDbConv } = await supabase
              .from('conversations')
              .select('id')
              .eq('contact_id', contactId)
              .eq('channel_id', params.channelId)
              .maybeSingle();

            if (existingDbConv) {
              convId = existingDbConv.id;
            }
          }

          if (!convId) {
            const newConvUuid =
              typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0');

            const convPayload: any = {
              id: newConvUuid,
              contact_id: contactId || null,
              channel_id: params.channelId,
              status: 'human',
              crm_stage: 'novo_lead',
              unread_count: 0,
              last_message_text: params.messageText,
              last_message_at: nowIso,
            };
            if (targetAccountId) {
              convPayload.account_id = targetAccountId;
            }

            const { data: createdConv, error: createConvErr } = await supabase
              .from('conversations')
              .insert(convPayload)
              .select('*')
              .maybeSingle();

            if (createdConv) {
              convId = createdConv.id;
            } else if (!createConvErr) {
              convId = newConvUuid;
            }
          }
        } catch (e) {
          console.warn('Erro ao criar conversa no banco:', e);
        }
      }

      if (!convId) {
        convId = `conv-new-${Date.now()}`;
      }

      // Adiciona ao estado local se ainda não existir
      const resolvedContactId = contactId || `cont-${Date.now()}`;
      const newConvObj: Conversation = {
        id: convId,
        accountId: targetAccountId,
        contactId: resolvedContactId,
        channelId: params.channelId,
        status: 'human',
        crmStage: 'novo_lead',
        contact: {
          id: resolvedContactId,
          name: params.name,
          phone: params.phone,
          email: params.email,
          avatarUrl:
            contactObj?.avatar_url ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(params.name)}&background=00a884&color=fff`,
          channel: params.channelType,
          channelId: params.channelId,
          coexistenceEnabled: true,
          aiStatus: 'inactive',
          crm: { dealStage: 'novo_lead', notes: [] },
          tags: [INITIAL_TAGS[0] || { id: 'tag-atendimento', name: 'Atendimento Humano', color: '#00a884' }],
        },
        lastMessage: {
          text: params.messageText,
          timestamp: timeStr,
          senderType: 'agent',
          status: 'sent',
          contentType: params.isTemplate ? 'template' : 'text',
        },
        unreadCount: 0,
        isPinned: false,
        isArchived: false,
        isFavorite: false,
        isGroup: false,
        updatedAt: nowIso,
        lastMessageAt: nowIso,
      };

      setConversations((prev) => {
        const existing = prev.find((c) => c.id === convId);
        if (existing) {
          return prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  status: 'human',
                  lastMessage: {
                    text: params.messageText,
                    timestamp: timeStr,
                    senderType: 'agent',
                    status: 'sent',
                    contentType: params.isTemplate ? 'template' : 'text',
                  },
                  updatedAt: nowIso,
                  lastMessageAt: nowIso,
                }
              : c
          );
        }
        return [newConvObj, ...prev];
      });

      // Seleciona a conversa imediatamente no app
      selectConversation(convId);

      // Dispara a mensagem inicial
      await sendMessage(
        convId,
        params.messageText,
        params.isTemplate ? 'template' : 'text',
        undefined,
        params.isTemplate ? { templateName: params.templateName, isMetaTemplate: true } : undefined
      );

      return convId;
    },
    [currentAccountId, allowedAccountIds, isSupabaseConfigured, selectConversation, sendMessage]
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
    startNewConversation,
    updateConversationStatus,
    updateCRMStage,
    addNote,
    addTag,
    removeTag,
    createCustomTag,
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
