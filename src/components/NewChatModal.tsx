import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Phone,
  Instagram,
  Globe,
  Send,
  Check,
  Search,
  User,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FileText,
  MessageSquare,
  Loader2,
  Plus
} from 'lucide-react';
import { ChannelType, Conversation } from '../types';
import { TelegramIcon } from './TelegramIcon';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Modelos de template padrão comuns aprovados pela Meta
export interface MetaTemplateOption {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  title: string;
  body: string;
  description: string;
}

export const APPROVED_META_TEMPLATES: MetaTemplateOption[] = [
  {
    id: 'hello_world',
    name: 'hello_world',
    category: 'UTILITY',
    title: 'Boas-vindas / Primeiro Contato',
    body: 'Olá, {{nome}}! Tudo bem? Estamos entrando em contato a respeito da sua solicitação. Como podemos te ajudar hoje?',
    description: 'Template oficial padrão da Meta para primeiro contato com o lead.',
  },
  {
    id: 'appointment_confirmation',
    name: 'appointment_confirmation',
    category: 'UTILITY',
    title: 'Confirmação de Agendamento',
    body: 'Olá, {{nome}}! Confirmamos o seu horário agendado com a nossa equipe. Por favor, responda com SIM para confirmar ou NÃO para reagendar.',
    description: 'Confirmação e lembrete de horários agendados.',
  },
  {
    id: 'customer_followup',
    name: 'customer_followup',
    category: 'UTILITY',
    title: 'Retorno de Atendimento (Follow-up)',
    body: 'Olá, {{nome}}! Gostaríamos de dar continuidade ao seu atendimento em nossa empresa. Estamos à disposição para tirar qualquer dúvida.',
    description: 'Retomada de atendimento após expiração da janela de 24h.',
  },
  {
    id: 'order_status_update',
    name: 'order_status_update',
    category: 'UTILITY',
    title: 'Atualização de Pedido / Solicitação',
    body: 'Olá, {{nome}}! Identificamos uma atualização importante na sua solicitação. Deseja conferir os detalhes agora?',
    description: 'Notificação operacional sobre status de pedidos ou solicitações.',
  },
  {
    id: 'meeting_reminder',
    name: 'meeting_reminder',
    category: 'UTILITY',
    title: 'Lembrete de Compromisso / Reunião',
    body: 'Olá, {{nome}}! Passando para lembrar da nossa conversa agendada para hoje. Qualquer dúvida, estamos por aqui!',
    description: 'Lembrete prévio de reuniões e consultas comerciais.',
  },
];

interface ConnectedChannelItem {
  id?: string;
  name?: string;
  type: ChannelType;
  is_active?: boolean;
  config?: any;
}

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateIncoming?: (data: {
    name: string;
    channel: ChannelType;
    messageText: string;
    isAudio?: boolean;
    phone?: string;
  }) => void;
  onStartNewChat?: (data: {
    contactId?: string;
    name: string;
    phone?: string;
    email?: string;
    channelId: string;
    channelType: ChannelType;
    messageText: string;
    isTemplate?: boolean;
    templateName?: string;
  }) => Promise<any> | any;
  connectedChannels?: ConnectedChannelItem[];
  existingConversations?: Conversation[];
  currentAccountId?: string;
  allowedAccountIds?: string[];
  darkMode: boolean;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onStartNewChat,
  connectedChannels = [],
  existingConversations = [],
  currentAccountId,
  allowedAccountIds = [],
  darkMode,
}) => {
  // Contact Selection / Creation mode
  const [contactMode, setContactMode] = useState<'search' | 'create'>('search');
  const [searchContactTerm, setSearchContactTerm] = useState('');
  const [searchedContacts, setSearchedContacts] = useState<any[]>([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  // New Contact Fields
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Channel Selection
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

  // 24h Window Check State
  const [isChecking24h, setIsChecking24h] = useState(false);
  const [lastMessageAt, setLastMessageAt] = useState<string | null>(null);
  const [isWindowClosed, setIsWindowClosed] = useState(false);
  const [hoursSinceLastMessage, setHoursSinceLastMessage] = useState<number | null>(null);

  // Message & Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(APPROVED_META_TEMPLATES[0].id);
  const [isCustomTemplate, setIsCustomTemplate] = useState(false);
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [customTemplateBody, setCustomTemplateBody] = useState('');
  const [customMessageText, setCustomMessageText] = useState('Olá! Como posso ajudar você hoje?');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Normaliza lista de canais disponíveis
  const availableChannels = useMemo(() => {
    if (connectedChannels && connectedChannels.length > 0) {
      return connectedChannels;
    }
    // Fallback caso não haja canais salvos ainda
    return [
      {
        id: 'whatsapp_padrao_default',
        name: 'WhatsApp Comercial',
        type: 'whatsapp' as ChannelType,
        is_active: true,
        config: { api_type: 'monarcahub_standard', api_name: 'Api Padrão' },
      },
      {
        id: 'meta_official_default',
        name: 'WhatsApp Oficial Meta Business',
        type: 'whatsapp' as ChannelType,
        is_active: true,
        config: { api_type: 'meta_official', api_name: 'Api Oficial Meta Business' },
      },
    ];
  }, [connectedChannels]);

  // Define canal selecionado inicial
  useEffect(() => {
    if (availableChannels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(availableChannels[0].id || availableChannels[0].name || 'default');
    }
  }, [availableChannels, selectedChannelId]);

  // Identifica o canal ativo e se é Meta Oficial
  const activeChannelItem = useMemo(() => {
    return availableChannels.find(
      (c) => c.id === selectedChannelId || c.name === selectedChannelId
    ) || availableChannels[0];
  }, [availableChannels, selectedChannelId]);

  const isMetaOfficialChannel = useMemo(() => {
    if (!activeChannelItem) return false;
    const rawApiType = activeChannelItem.config?.api_type;
    const nameLower = (activeChannelItem.name || '').toLowerCase();
    const configName = (activeChannelItem.config?.api_name || '').toLowerCase();
    return (
      rawApiType === 'meta_official' ||
      nameLower.includes('oficial meta') ||
      nameLower.includes('meta oficial') ||
      configName.includes('meta')
    );
  }, [activeChannelItem]);

  // Busca contatos no Supabase e em conversas existentes com debounce
  useEffect(() => {
    if (!isOpen || contactMode !== 'search') return;

    let isMounted = true;
    const query = searchContactTerm.trim().toLowerCase();

    const doSearch = async () => {
      setIsSearchingContacts(true);
      const resultsMap = new Map<string, any>();

      // 1. Instantâneo: Contatos das conversas ativas na memória
      for (const conv of existingConversations) {
        const c = conv.contact;
        if (!c) continue;
        const matchName = c.name?.toLowerCase().includes(query);
        const matchPhone = c.phone?.toLowerCase().includes(query);
        const matchEmail = c.email?.toLowerCase().includes(query);
        if (!query || matchName || matchPhone || matchEmail) {
          resultsMap.set(c.id || c.phone || c.name, {
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            avatar_url: c.avatarUrl,
            lastMessageAt: conv.lastMessageAt || conv.updatedAt,
            hasActiveConversation: true,
            conversationId: conv.id,
            channel: c.channel,
          });
        }
      }

      // 2. Consulta tabela 'contacts' no Supabase
      if (isSupabaseConfigured) {
        try {
          let contactsQuery = supabase
            .from('contacts')
            .select('id, name, phone, email, avatar_url, created_at, account_id')
            .limit(20);

          if (currentAccountId && currentAccountId !== 'all') {
            contactsQuery = contactsQuery.eq('account_id', currentAccountId);
          } else if (allowedAccountIds.length > 0) {
            contactsQuery = contactsQuery.in('account_id', allowedAccountIds);
          }

          if (query) {
            contactsQuery = contactsQuery.or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`);
          }

          const { data: dbContacts, error: dbErr } = await contactsQuery;
          if (!dbErr && Array.isArray(dbContacts)) {
            for (const dc of dbContacts) {
              const existing = resultsMap.get(dc.id);
              if (!existing) {
                const matchedConv = existingConversations.find(
                  (cv) => cv.contactId === dc.id || cv.contact?.id === dc.id
                );
                resultsMap.set(dc.id, {
                  id: dc.id,
                  name: dc.name,
                  phone: dc.phone,
                  email: dc.email,
                  avatar_url: dc.avatar_url,
                  lastMessageAt: matchedConv?.lastMessageAt || matchedConv?.updatedAt || null,
                  hasActiveConversation: Boolean(matchedConv),
                  conversationId: matchedConv?.id,
                  channel: matchedConv?.contact?.channel || 'whatsapp',
                });
              }
            }
          }
        } catch (err) {
          console.warn('Erro ao consultar contatos do Supabase:', err);
        }
      }

      if (isMounted) {
        setSearchedContacts(Array.from(resultsMap.values()));
        setIsSearchingContacts(false);
      }
    };

    const timer = setTimeout(doSearch, 200);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    contactMode,
    searchContactTerm,
    existingConversations,
    currentAccountId,
    allowedAccountIds,
  ]);

  // Alvo atual de contato (seja selecionado da busca ou digitado manualmente)
  const currentContactTarget = useMemo(() => {
    if (contactMode === 'search' && selectedContact) {
      return {
        id: selectedContact.id,
        name: selectedContact.name,
        phone: selectedContact.phone,
        email: selectedContact.email,
        lastMessageAt: selectedContact.lastMessageAt,
      };
    }
    if (contactMode === 'create' && newName.trim()) {
      return {
        id: undefined,
        name: newName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || undefined,
        lastMessageAt: null,
      };
    }
    return null;
  }, [contactMode, selectedContact, newName, newPhone, newEmail]);

  // Verifica a janela de 24 horas quando o canal for Meta Oficial e um contato estiver selecionado
  useEffect(() => {
    if (!isMetaOfficialChannel || !currentContactTarget) {
      setIsChecking24h(false);
      setIsWindowClosed(false);
      setHoursSinceLastMessage(null);
      setLastMessageAt(null);
      return;
    }

    let isMounted = true;
    setIsChecking24h(true);

    const checkWindow = async () => {
      let resolvedLastAt: string | null = currentContactTarget.lastMessageAt || null;

      // Se ainda não temos lastMessageAt no objeto em memória, busca na tabela conversations do Supabase
      if (!resolvedLastAt && isSupabaseConfigured) {
        try {
          let q = supabase
            .from('conversations')
            .select('last_message_at, updated_at')
            .order('last_message_at', { ascending: false })
            .limit(1);

          if (currentContactTarget.id) {
            q = q.eq('contact_id', currentContactTarget.id);
          } else if (currentContactTarget.phone) {
            const cleanPhone = currentContactTarget.phone.replace(/\D/g, '');
            const { data: cData } = await supabase
              .from('contacts')
              .select('id')
              .ilike('phone', `%${cleanPhone}%`)
              .limit(1);
            if (cData && cData[0]) {
              q = q.eq('contact_id', cData[0].id);
            }
          }

          const { data: convData } = await q;
          if (convData && convData[0]) {
            resolvedLastAt = convData[0].last_message_at || convData[0].updated_at || null;
          }
        } catch (e) {
          console.warn('Erro ao verificar janela de 24h no Supabase:', e);
        }
      }

      if (!isMounted) return;

      setLastMessageAt(resolvedLastAt);

      if (!resolvedLastAt) {
        // Nunca interagiu: Janela fechada, exige template aprovado da Meta
        setIsWindowClosed(true);
        setHoursSinceLastMessage(null);
      } else {
        const lastTime = new Date(resolvedLastAt).getTime();
        const diffMs = Date.now() - lastTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        setHoursSinceLastMessage(diffHours);

        if (diffHours >= 24) {
          setIsWindowClosed(true);
        } else {
          setIsWindowClosed(false);
        }
      }

      setIsChecking24h(false);
    };

    checkWindow();

    return () => {
      isMounted = false;
    };
  }, [isMetaOfficialChannel, currentContactTarget, existingConversations]);

  // Mensagem calculada do Template com interpolação de variáveis
  const currentTemplate = useMemo(() => {
    return (
      APPROVED_META_TEMPLATES.find((t) => t.id === selectedTemplateId) ||
      APPROVED_META_TEMPLATES[0]
    );
  }, [selectedTemplateId]);

  const compiledTemplateMessage = useMemo(() => {
    const contactName = currentContactTarget?.name || 'Cliente';
    if (isCustomTemplate) {
      return (customTemplateBody || '').replace(/\{\{nome\}\}|\{\{1\}\}/g, contactName);
    }
    return currentTemplate.body.replace(/\{\{nome\}\}|\{\{1\}\}/g, contactName);
  }, [isCustomTemplate, customTemplateBody, currentTemplate, currentContactTarget]);

  if (!isOpen) return null;

  // Reset modal state ao fechar
  const handleModalClose = () => {
    setSelectedContact(null);
    setSearchContactTerm('');
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setIsSending(false);
    setSendSuccess(false);
    onClose();
  };

  // Enviar Nova Conversa Ativa
  const handleStartConversationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentContactTarget || !currentContactTarget.name.trim()) {
      return;
    }

    if (!selectedChannelId) {
      return;
    }

    const messageToSend =
      isMetaOfficialChannel && isWindowClosed
        ? compiledTemplateMessage
        : customMessageText.trim();

    if (!messageToSend) return;

    setIsSending(true);

    try {
      if (onStartNewChat) {
        await onStartNewChat({
          contactId: currentContactTarget.id,
          name: currentContactTarget.name,
          phone: currentContactTarget.phone || undefined,
          email: currentContactTarget.email || undefined,
          channelId: activeChannelItem.id || selectedChannelId,
          channelType: activeChannelItem.type || 'whatsapp',
          messageText: messageToSend,
          isTemplate: isMetaOfficialChannel && isWindowClosed,
          templateName:
            isMetaOfficialChannel && isWindowClosed
              ? isCustomTemplate
                ? customTemplateName.trim() || 'custom_template'
                : currentTemplate.name
              : undefined,
        });
      }

      setSendSuccess(true);
      setTimeout(() => {
        handleModalClose();
      }, 700);
    } catch (err) {
      console.error('Erro ao iniciar nova conversa:', err);
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
          darkMode ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
        }`}
      >
        {/* Header Limpo */}
        <div
          className={`px-5 py-3.5 flex items-center justify-between border-b shrink-0 ${
            darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-[#f0f2f5] border-[#e9edef]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#00a884]/15 text-[#00a884]">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base leading-tight">Nova Conversa</h2>
              <p className="text-[11px] text-[#8696a0]">
                Buscar ou cadastrar contato, escolher canal e iniciar atendimento
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className={`p-1.5 rounded-full transition-colors ${
              darkMode ? 'hover:bg-[#374248] text-[#8696a0]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          <form onSubmit={handleStartConversationSubmit} className="space-y-4 text-xs">
            {/* ETAPA 1: Selecionar ou Cadastrar Contato */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`font-bold flex items-center gap-1.5 text-xs ${darkMode ? 'text-[#d1d7db]' : 'text-gray-800'}`}>
                  <User className="w-4 h-4 text-[#00a884]" />
                  <span>1. Contato do Cliente</span>
                </label>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/10 dark:bg-white/5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setContactMode('search');
                      setSelectedContact(null);
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      contactMode === 'search'
                        ? 'bg-[#00a884] text-white font-bold shadow-xs'
                        : 'text-[#8696a0] hover:text-[#e9edef]'
                    }`}
                  >
                    Buscar Existente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContactMode('create');
                      setSelectedContact(null);
                    }}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      contactMode === 'create'
                        ? 'bg-[#00a884] text-white font-bold shadow-xs'
                        : 'text-[#8696a0] hover:text-[#e9edef]'
                    }`}
                  >
                    + Novo Contato
                  </button>
                </div>
              </div>

              {contactMode === 'search' ? (
                <div className="space-y-2">
                  {/* Se já selecionou um contato, exibe o card selecionado */}
                  {selectedContact ? (
                    <div
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        darkMode ? 'bg-[#202c33] border-[#00a884]/40' : 'bg-emerald-50/70 border-[#00a884]/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            selectedContact.avatar_url ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedContact.name)}&background=00a884&color=fff`
                          }
                          alt={selectedContact.name}
                          className="w-10 h-10 rounded-full object-cover border border-emerald-500/30"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-sm">
                            <span>{selectedContact.name}</span>
                            <CheckCircle2 className="w-4 h-4 text-[#00a884]" />
                          </div>
                          <div className="text-[11px] text-[#8696a0] flex items-center gap-2">
                            {selectedContact.phone && <span>{selectedContact.phone}</span>}
                            {selectedContact.email && <span>• {selectedContact.email}</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedContact(null)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                          darkMode
                            ? 'border-[#374248] text-[#8696a0] hover:bg-[#374248] hover:text-white'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        Trocar Contato
                      </button>
                    </div>
                  ) : (
                    /* Campo de busca de contatos */
                    <div className="space-y-2">
                      <div
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${
                          darkMode ? 'bg-[#202c33] border-[#222e35] text-[#e9edef]' : 'bg-gray-50 border-gray-300 text-[#111b21]'
                        }`}
                      >
                        <Search className="w-4 h-4 text-[#8696a0] shrink-0" />
                        <input
                          type="text"
                          value={searchContactTerm}
                          onChange={(e) => setSearchContactTerm(e.target.value)}
                          placeholder="Buscar por nome, telefone ou e-mail..."
                          className="w-full bg-transparent text-xs focus:outline-none placeholder:text-[#8696a0]"
                          autoFocus
                        />
                        {isSearchingContacts && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00a884]" />}
                      </div>

                      {/* Lista de contatos encontrados */}
                      <div
                        className={`max-h-48 overflow-y-auto rounded-xl border divide-y ${
                          darkMode ? 'bg-[#182229] border-[#222e35] divide-[#222e35]' : 'bg-white border-gray-200 divide-gray-100'
                        }`}
                      >
                        {searchedContacts.length === 0 ? (
                          <div className="p-4 text-center text-[#8696a0]">
                            {searchContactTerm
                              ? 'Nenhum contato encontrado com esse termo.'
                              : 'Digite para pesquisar contatos cadastrados ou conversas anteriores.'}
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setContactMode('create');
                                  setNewName(searchContactTerm);
                                }}
                                className="text-[#00a884] hover:underline font-semibold text-xs"
                              >
                                + Criar novo contato "{searchContactTerm || 'Nome'}"
                              </button>
                            </div>
                          </div>
                        ) : (
                          searchedContacts.map((c) => (
                            <div
                              key={c.id || c.phone || c.name}
                              onClick={() => setSelectedContact(c)}
                              className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                                darkMode ? 'hover:bg-[#202c33]' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={
                                    c.avatar_url ||
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=00a884&color=fff`
                                  }
                                  alt={c.name}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                                <div>
                                  <div className="font-semibold text-xs flex items-center gap-1.5">
                                    <span>{c.name}</span>
                                    {c.hasActiveConversation && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-[#00a884] font-medium">
                                        Conversa Existente
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#8696a0]">
                                    {c.phone || c.email || 'Sem telefone registrado'}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="px-2.5 py-1 rounded-md bg-[#00a884]/15 hover:bg-[#00a884] text-[#00a884] hover:text-white font-semibold text-[11px] transition-colors"
                              >
                                Selecionar
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Form para criação de Novo Contato */
                <div
                  className={`p-3.5 rounded-xl border space-y-3 ${
                    darkMode ? 'bg-[#202c33]/50 border-[#222e35]' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div>
                    <label className={`block font-semibold mb-1 ${darkMode ? 'text-[#8696a0]' : 'text-[#54656f]'}`}>
                      Nome Completo do Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ex: Amanda Carvalho"
                      className={`w-full p-2.5 rounded-lg border focus:outline-none focus:border-[#00a884] ${
                        darkMode ? 'bg-[#202c33] border-[#222e35] text-[#e9edef]' : 'bg-white border-gray-300 text-[#111b21]'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block font-semibold mb-1 ${darkMode ? 'text-[#8696a0]' : 'text-[#54656f]'}`}>
                        Número de Telefone (WhatsApp) *
                      </label>
                      <input
                        type="tel"
                        required
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="+55 11 99999-8888"
                        className={`w-full p-2.5 rounded-lg border focus:outline-none focus:border-[#00a884] ${
                          darkMode ? 'bg-[#202c33] border-[#222e35] text-[#e9edef]' : 'bg-white border-gray-300 text-[#111b21]'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block font-semibold mb-1 ${darkMode ? 'text-[#8696a0]' : 'text-[#54656f]'}`}>
                        E-mail (Opcional)
                      </label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="cliente@email.com"
                        className={`w-full p-2.5 rounded-lg border focus:outline-none focus:border-[#00a884] ${
                          darkMode ? 'bg-[#202c33] border-[#222e35] text-[#e9edef]' : 'bg-white border-gray-300 text-[#111b21]'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ETAPA 2: Escolher Canal de Envio */}
            <div>
              <label className={`block font-bold mb-1.5 flex items-center justify-between text-xs ${darkMode ? 'text-[#d1d7db]' : 'text-gray-800'}`}>
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-[#00a884]" />
                  <span>2. Canal de Saída / Conexão</span>
                </span>
                <span className="text-[11px] font-normal text-[#8696a0]">
                  {availableChannels.length} canal(is) configurado(s)
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableChannels.map((ch) => {
                  const isSelected = (ch.id || ch.name) === selectedChannelId;
                  const isOfficial =
                    ch.config?.api_type === 'meta_official' ||
                    (ch.name || '').toLowerCase().includes('oficial meta') ||
                    (ch.config?.api_name || '').toLowerCase().includes('meta');

                  return (
                    <button
                      key={ch.id || ch.name}
                      type="button"
                      onClick={() => setSelectedChannelId(ch.id || ch.name || '')}
                      className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? isOfficial
                            ? 'bg-[#1877F2]/10 border-[#1877F2] ring-1 ring-[#1877F2]'
                            : 'bg-[#00a884]/10 border-[#00a884] ring-1 ring-[#00a884]'
                          : darkMode
                          ? 'bg-[#202c33] border-[#222e35] hover:border-gray-600'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          {ch.type === 'whatsapp' ? (
                            <Phone className="w-4 h-4 text-[#25d366]" />
                          ) : ch.type === 'instagram' ? (
                            <Instagram className="w-4 h-4 text-pink-500" />
                          ) : ch.type === 'telegram' ? (
                            <TelegramIcon className="w-4 h-4 text-[#0088cc]" />
                          ) : (
                            <Globe className="w-4 h-4 text-[#00a884]" />
                          )}
                          <span className="font-bold text-xs truncate max-w-[170px]">
                            {ch.name || 'WhatsApp'}
                          </span>
                        </div>

                        {isSelected && (
                          <span className="p-0.5 rounded-full bg-[#00a884] text-white">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ch.type === 'whatsapp' && isOfficial ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1877F2]/20 text-[#1877F2] border border-[#1877F2]/30">
                            <ShieldCheck className="w-3 h-3" /> Meta Cloud API Oficial
                          </span>
                        ) : ch.type === 'whatsapp' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-[#00a884] border border-emerald-500/20">
                            Api Padrão
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#8696a0] capitalize">{ch.type}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ETAPA 3: Validação da Janela de 24 horas da Meta (se Meta Oficial selecionado) */}
            {isMetaOfficialChannel && (
              <div className="space-y-3 pt-1">
                {isChecking24h ? (
                  <div
                    className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                      darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Loader2 className="w-4 h-4 animate-spin text-[#1877F2]" />
                    <span className="text-xs text-[#8696a0]">
                      Consultando histórico e janela de 24h na Meta WhatsApp Cloud API...
                    </span>
                  </div>
                ) : isWindowClosed ? (
                  /* JANELA FECHADA (>= 24h ou primeiro contato): Exige Template Aprovado */
                  <div
                    className={`p-3.5 rounded-xl border space-y-2.5 ${
                      darkMode
                        ? 'bg-[#182229] border-amber-500/40 text-amber-200'
                        : 'bg-amber-50/90 border-amber-300 text-amber-900'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-xs flex items-center gap-2">
                          <span>Janela de 24h Fechada (Diretriz Meta WhatsApp API Oficial)</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/20 text-amber-600 dark:text-amber-300">
                            Exige Template
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5 leading-relaxed opacity-90">
                          {hoursSinceLastMessage !== null
                            ? `A última interação com este cliente ocorreu há ${Math.floor(
                                hoursSinceLastMessage
                              )}h (mais de 24h).`
                            : 'Este é o primeiro contato ou não há mensagens registradas nas últimas 24h.'}{' '}
                          Para abrir a conversa ativa via WhatsApp Business API Oficial,{' '}
                          <strong>é obrigatório o uso de uma Mensagem Modelo (Template Aprovado pela Meta)</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Seletor de Templates Aprovados */}
                    <div className="pt-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className={`block font-semibold text-[11px] ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Escolha a Mensagem Modelo (Template Aprovado):
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCustomTemplate(!isCustomTemplate)}
                          className="text-[11px] text-[#00a884] hover:underline font-semibold"
                        >
                          {isCustomTemplate ? '← Usar Modelos Padrão' : '+ Inserir Outro Template'}
                        </button>
                      </div>

                      {!isCustomTemplate ? (
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => setSelectedTemplateId(e.target.value)}
                          className={`w-full p-2 rounded-lg border text-xs font-medium focus:outline-none focus:border-[#1877F2] ${
                            darkMode
                              ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]'
                              : 'bg-white border-gray-300 text-gray-900'
                          }`}
                        >
                          {APPROVED_META_TEMPLATES.map((tmpl) => (
                            <option key={tmpl.id} value={tmpl.id}>
                              {tmpl.title} ({tmpl.name})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            required
                            value={customTemplateName}
                            onChange={(e) => setCustomTemplateName(e.target.value)}
                            placeholder="Nome exato do template aprovado na Meta (ex: aviso_cliente)"
                            className={`w-full p-2 rounded-lg border text-xs focus:outline-none focus:border-[#1877F2] ${
                              darkMode ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]' : 'bg-white border-gray-300 text-[#111b21]'
                            }`}
                          />
                          <textarea
                            rows={2}
                            required
                            value={customTemplateBody}
                            onChange={(e) => setCustomTemplateBody(e.target.value)}
                            placeholder="Texto aprovado do template (use {{nome}} para o nome do cliente)"
                            className={`w-full p-2 rounded-lg border text-xs focus:outline-none focus:border-[#1877F2] resize-none ${
                              darkMode ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]' : 'bg-white border-gray-300 text-[#111b21]'
                            }`}
                          />
                        </div>
                      )}
                    </div>

                    {/* Preview do Template interpolado */}
                    <div
                      className={`p-3 rounded-lg border font-mono text-[11px] leading-relaxed relative ${
                        darkMode ? 'bg-[#111b21] border-[#222e35] text-emerald-400' : 'bg-white border-gray-200 text-emerald-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-sans font-bold text-[10px] text-[#8696a0] mb-1">
                        <FileText className="w-3.5 h-3.5" />
                        <span>Pré-visualização do Template enviado ao cliente:</span>
                      </div>
                      <p className="whitespace-pre-wrap">{compiledTemplateMessage || '(Preencha o modelo acima)'}</p>
                    </div>
                  </div>
                ) : (
                  /* JANELA ABERTA (< 24h): Envio Livre Liberado */
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      darkMode
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0" />
                      <div>
                        <div className="font-bold text-xs">Janela de 24h Aberta!</div>
                        <div className="text-[11px] opacity-90">
                          Última mensagem do cliente registrada há{' '}
                          {hoursSinceLastMessage !== null && hoursSinceLastMessage < 1
                            ? `${Math.round(hoursSinceLastMessage * 60)} minutos`
                            : `${Math.floor(hoursSinceLastMessage || 0)} horas`}
                          . Envio livre de texto liberado.
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00a884] text-white">
                      Ativa
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ETAPA 4: Mensagem Inicial */}
            {(!isMetaOfficialChannel || !isWindowClosed) && (
              <div>
                <label className={`block font-bold mb-1 flex items-center justify-between text-xs ${darkMode ? 'text-[#d1d7db]' : 'text-gray-800'}`}>
                  <span>3. Primeira Mensagem</span>
                  <span className="text-[11px] font-normal text-[#8696a0]">
                    {isMetaOfficialChannel ? 'Texto livre dentro da janela de 24h' : 'Envio sem restrição de janela'}
                  </span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={customMessageText}
                  onChange={(e) => setCustomMessageText(e.target.value)}
                  placeholder="Digite a mensagem que o cliente irá receber..."
                  className={`w-full p-2.5 rounded-lg border focus:outline-none focus:border-[#00a884] resize-none ${
                    darkMode ? 'bg-[#202c33] border-[#222e35] text-[#e9edef]' : 'bg-gray-50 border-gray-300 text-[#111b21]'
                  }`}
                />
              </div>
            )}

            {/* Botões de Ação */}
            <div className="pt-2 flex items-center justify-between border-t border-gray-700/20">
              <div className="text-[11px] text-[#8696a0]">
                {currentContactTarget ? (
                  <span>
                    Enviando para: <strong>{currentContactTarget.name}</strong>
                  </span>
                ) : (
                  <span>Selecione ou crie um contato acima para continuar</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className={`px-3 py-2 rounded-lg font-semibold ${
                    darkMode ? 'text-[#8696a0] hover:bg-[#202c33]' : 'text-[#54656f] hover:bg-gray-100'
                  }`}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSending || !currentContactTarget || !currentContactTarget.name.trim()}
                  className={`px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow transition-all ${
                    sendSuccess
                      ? 'bg-emerald-600 text-white'
                      : isSending || !currentContactTarget || !currentContactTarget.name.trim()
                      ? 'bg-gray-500/50 text-gray-300 cursor-not-allowed'
                      : isMetaOfficialChannel && isWindowClosed
                      ? 'bg-[#1877F2] hover:bg-[#1877F2]/90 text-white'
                      : 'bg-[#00a884] hover:bg-[#00a884]/90 text-white'
                  }`}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Iniciando...</span>
                    </>
                  ) : sendSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Conversa Iniciada!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        {isMetaOfficialChannel && isWindowClosed
                          ? 'Enviar Template Aprovado'
                          : 'Iniciar Conversa & Enviar'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
