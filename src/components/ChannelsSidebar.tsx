import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MessageSquare,
  Instagram,
  Globe,
  CheckCircle2,
  RefreshCw,
  Plus,
  Radio,
  ExternalLink,
  ShieldCheck,
  Zap,
  Smartphone,
  QrCode,
  X,
  Brain,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ChannelType, Account } from '../types';
import { useAuth } from '../context/AuthContext';
import { useMetaWhatsAppSignup } from '../hooks/useMetaWhatsAppSignup';

interface ChannelsSidebarProps {
  darkMode: boolean;
  onBackToChats: () => void;
  onFilterByChannel: (channel: ChannelType | 'all') => void;
  currentChannelFilter: ChannelType | 'all';
  currentAccount?: Account | null;
}

interface ConnectedChannelItem {
  id: string;
  name: string;
  type: ChannelType;
  identifier: string;
  provider: string;
  apiType?: 'meta_official' | 'monarcahub_standard';
  status: 'online' | 'syncing' | 'offline';
  latency: string;
  ai_enabled?: boolean;
}

export const ChannelsSidebar: React.FC<ChannelsSidebarProps> = ({
  darkMode,
  onBackToChats,
  onFilterByChannel,
  currentChannelFilter,
  currentAccount,
}) => {
  const { user } = useAuth();
  const [channels, setChannels] = useState<ConnectedChannelItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [newChannelPhone, setNewChannelPhone] = useState('+55 ');
  const [newChannelName, setNewChannelName] = useState('');
  const [selectedApiOption, setSelectedApiOption] = useState<'meta_official' | 'monarcahub_standard'>('meta_official');
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showManualMetaConfig, setShowManualMetaConfig] = useState(false);

  // Hook Oficial do Embedded Signup da Meta com Suporte a Modo Coexistência
  const {
    isSdkLoaded,
    isConnecting: isMetaConnecting,
    statusMessage: metaStatusMessage,
    lastEmbeddedEvent,
    sessionData: metaSessionData,
    handleConnectWhatsAppOfficial,
  } = useMetaWhatsAppSignup({
    currentUser: user,
    currentAccountId: currentAccount?.id,
    onSuccess: () => {
      fetchChannels();
      setIsConnectModalOpen(false);
    },
  });

  const fetchChannels = async () => {
    if (!currentAccount) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/channels?account_id=${currentAccount.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.channels) {
          const mapped: ConnectedChannelItem[] = data.channels.map((ch: any) => {
            const apiType = ch.config?.api_type || 'meta_official';
            return {
              id: ch.id,
              name: ch.name || 'WhatsApp Principal',
              type: ch.type || 'whatsapp',
              identifier: ch.config?.waba_phone || ch.config?.phone || ch.config?.username || currentAccount.whatsappPhone || 'Ativo',
              provider: ch.type === 'whatsapp'
                ? (apiType === 'monarcahub_standard' ? 'Api Padrão MonarcaHub' : 'Api Oficial Meta Business')
                : ch.type === 'instagram' ? 'Instagram Direct' : 'Webchat',
              apiType: ch.type === 'whatsapp' ? apiType : undefined,
              status: ch.is_active ? 'online' : 'offline',
              latency: '32ms',
              ai_enabled: ch.config?.ai_enabled !== false,
            };
          });
          setChannels(mapped);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar canais:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleChannelAI = async (channelId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    try {
      const res = await fetch('/api/channels/toggle-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channelId,
          ai_enabled: newStatus,
          account_id: currentAccount?.id,
        }),
      });
      if (res.ok) {
        setChannels((prev) =>
          prev.map((c) => (c.id === channelId ? { ...c, ai_enabled: newStatus } : c))
        );
      }
    } catch (err) {
      console.warn('Erro ao alternar IA do canal:', err);
    }
  };


  useEffect(() => {
    fetchChannels();
  }, [currentAccount?.id]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount || !newChannelName.trim()) return;

    const rawPhoneDigits = newChannelPhone.replace(/\D/g, '');
    const phoneToSave = rawPhoneDigits || newChannelPhone.trim();

    const channelConfig =
      selectedApiOption === 'meta_official'
        ? {
            phone: phoneToSave,
            api_name: 'Api Oficial Meta Business',
            api_type: 'meta_official',
            waba_phone: phoneToSave,
            phone_number_id: metaPhoneNumberId.trim() || (phoneToSave ? `pn_${phoneToSave}` : ''),
            token: metaToken.trim(),
            coexistence_enabled: true,
          }
        : {
            phone: phoneToSave,
            api_name: 'Api Padrão MonarcaHub',
            api_type: 'monarcahub_standard',
            waba_phone: phoneToSave,
            coexistence_enabled: false,
          };

    setIsSaving(true);
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: currentAccount.id,
          name: newChannelName.trim(),
          type: 'whatsapp',
          config: channelConfig,
        }),
      });

      if (res.ok) {
        setIsConnectModalOpen(false);
        setNewChannelName('');
        setNewChannelPhone('+55 ');
        setMetaPhoneNumberId('');
        setMetaToken('');
        setSelectedApiOption('meta_official');
        await fetchChannels();
      }
    } catch (err) {
      console.warn('Erro ao criar canal:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getChannelIcon = (type: ChannelType) => {
    switch (type) {
      case 'whatsapp':
        return (
          <div className="w-10 h-10 rounded-full bg-[#25d366] text-white flex items-center justify-center shrink-0 shadow-sm">
            <MessageSquare className="w-5 h-5 fill-current" />
          </div>
        );
      case 'instagram':
        return (
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Instagram className="w-5 h-5" />
          </div>
        );
      case 'webchat':
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-[#00a884] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Globe className="w-5 h-5" />
          </div>
        );
    }
  };

  return (
    <div
      className={`h-full flex flex-col border-r ${
        darkMode ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
      }`}
    >
      {/* Header */}
      <div
        className={`px-4 py-3 flex items-center justify-between border-b ${
          darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-[#f0f2f5] border-[#e9edef]'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToChats}
            className={`p-1.5 rounded-full transition-colors ${
              darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-gray-200 text-[#54656f]'
            }`}
            title="Voltar para Conversas"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className={`font-bold text-base ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
              Canais Conectados
            </h1>
            <span className="text-[11px] text-[#00a884] font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse" />
              {channels.length} {channels.length === 1 ? 'Canal Ativo' : 'Canais Ativos'}
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsConnectModalOpen(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00a884] hover:bg-[#02906f] text-white flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Conectar Canal</span>
        </button>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div
          className={`p-3 rounded-xl border text-xs leading-relaxed ${
            darkMode ? 'bg-[#182229] border-[#222e35] text-[#8696a0]' : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold text-[#00a884] mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Isolamento Seguro Multi-empresa</span>
          </div>
          <p className="text-[11px]">
            Empresa ativa: <strong>{currentAccount?.name}</strong>. Os canais abaixo estão vinculados diretamente à sua empresa.
          </p>
        </div>

        {/* Empty State */}
        {channels.length === 0 && !isLoading && (
          <div
            className={`p-8 rounded-2xl border text-center my-4 ${
              darkMode ? 'bg-[#202c33] border-[#313d45]' : 'bg-white border-[#e9edef]'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-[#00a884]/15 text-[#00a884] flex items-center justify-center mx-auto mb-3">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm mb-1">Nenhum canal conectado ainda</h3>
            <p className="text-xs text-[#8696a0] mb-4 max-w-xs mx-auto">
              Conecte sua primeira instância de WhatsApp para que os atendentes humanos e a IA possam responder clientes.
            </p>
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#009374] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Conectar WhatsApp Agora
            </button>
          </div>
        )}

        {/* List of Channels */}
        <div className="space-y-2.5">
          {channels.map((channel) => {
            const isSelected = currentChannelFilter === channel.type;
            return (
              <div
                key={channel.id}
                className={`p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-[#00a884] bg-[#00a884]/10 shadow-sm'
                    : darkMode
                    ? 'bg-[#202c33] border-[#2a3942] hover:border-[#374248]'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {getChannelIcon(channel.type)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3 className={`font-bold text-xs truncate ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                        {channel.name}
                      </h3>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#064e3b] text-[#34d399] border border-[#34d399]/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
                        Online
                      </span>
                    </div>

                    <div className="text-xs font-mono font-semibold text-[#00a884]">
                      {channel.identifier}
                    </div>

                    <div className="mt-1 text-[11px] text-[#8696a0] flex flex-wrap items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>Provedor: <strong className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{channel.provider}</strong></span>
                        {channel.type === 'whatsapp' && channel.apiType === 'meta_official' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1877F2]/15 text-[#1877F2] border border-[#1877F2]/30 shadow-xs">
                            <ShieldCheck className="w-3 h-3" /> Mais Segura
                          </span>
                        )}
                        {channel.type === 'whatsapp' && channel.apiType === 'monarcahub_standard' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Padrão MonarcaHub
                          </span>
                        )}
                      </div>
                      <span>Latência: {channel.latency}</span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-gray-700/20 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleChannelAI(channel.id, channel.ai_enabled !== false)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            channel.ai_enabled !== false
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                          }`}
                          title={channel.ai_enabled !== false ? 'Clique para pausar a IA neste canal' : 'Clique para ativar a IA neste canal'}
                        >
                          <Brain className="w-3 h-3" />
                          <span>{channel.ai_enabled !== false ? 'IA Ativa' : 'IA Pausada'}</span>
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          onFilterByChannel(channel.type);
                          onBackToChats();
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#00a884] text-white'
                            : 'bg-[#233138] hover:bg-[#00a884] text-gray-300 hover:text-white'
                        }`}
                      >
                        Filtrar Conversas
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Conectar Novo Canal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div
            className={`w-full max-w-lg rounded-2xl p-6 border shadow-2xl ${
              darkMode ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Conectar WhatsApp</h3>
                  <p className="text-[11px] text-[#8696a0]">Selecione a tecnologia de conexão do canal</p>
                </div>
              </div>
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#313d45] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-4">
              {/* Opções de WhatsApp: Meta Business vs MonarcaHub */}
              <div>
                <label className="block text-xs font-semibold text-[#8696a0] mb-2">
                  Escolha o Modelo de Integração WhatsApp:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Opção 1: Api Oficial Meta Business com Selo Azul */}
                  <div
                    onClick={() => setSelectedApiOption('meta_official')}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      selectedApiOption === 'meta_official'
                        ? 'border-[#1877F2] bg-[#1877F2]/10 ring-1 ring-[#1877F2]'
                        : darkMode
                        ? 'border-[#313d45] bg-[#111b21] hover:border-[#404e57]'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="font-bold text-xs">1 - Api Oficial Meta Business</span>
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            selectedApiOption === 'meta_official'
                              ? 'border-[#1877F2] bg-[#1877F2]'
                              : 'border-gray-500'
                          }`}
                        >
                          {selectedApiOption === 'meta_official' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>

                      {/* Selo azul de Mais Segura e Coexistência */}
                      <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1877F2] text-white shadow-xs">
                          <ShieldCheck className="w-3 h-3 text-white" />
                          <span>Mais Segura</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          <Smartphone className="w-3 h-3" />
                          <span>Modo Coexistência</span>
                        </span>
                      </div>

                      <p className={`text-[11px] leading-snug ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                        Oficial Meta (Cloud API). Alta estabilidade, sem banimentos e com suporte a Coexistência no celular.
                      </p>
                    </div>
                  </div>

                  {/* Opção 2: Api Padrão MonarcaHub */}
                  <div
                    onClick={() => setSelectedApiOption('monarcahub_standard')}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                      selectedApiOption === 'monarcahub_standard'
                        ? 'border-[#00a884] bg-[#00a884]/10 ring-1 ring-[#00a884]'
                        : darkMode
                        ? 'border-[#313d45] bg-[#111b21] hover:border-[#404e57]'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="font-bold text-xs">2 - Api Padrão MonarcaHub</span>
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            selectedApiOption === 'monarcahub_standard'
                              ? 'border-[#00a884] bg-[#00a884]'
                              : 'border-gray-500'
                          }`}
                        >
                          {selectedApiOption === 'monarcahub_standard' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>

                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#2a3942] text-gray-300 border border-gray-600/40">
                          Padrão MonarcaHub
                        </span>
                      </div>

                      <p className={`text-[11px] leading-snug ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                        Conexão padrão MonarcaHub via QR Code / Web. Rápida e prática para conectar qualquer número.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Destaque: Embedded Signup Oficial da Meta com Modo Coexistência */}
              {selectedApiOption === 'meta_official' && (
                <div className={`p-4 rounded-xl border space-y-3 ${
                  darkMode ? 'bg-[#182229] border-[#1877F2]/40' : 'bg-blue-50/80 border-blue-200'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-[#1877F2]">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Login Incorporado da Meta (Embedded Signup)</span>
                      </div>
                      <p className="text-[11px] text-[#8696a0] leading-relaxed">
                        Conecte a API Oficial em segundos pelo popup da Meta sem precisar copiar tokens ou IDs!
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1877F2] text-white shrink-0 shadow-xs">
                      Recomendado
                    </span>
                  </div>

                  {/* Informações do Modo Coexistência */}
                  <div className={`p-2.5 rounded-lg border text-[11px] flex items-center gap-2 ${
                    darkMode ? 'bg-indigo-950/30 border-indigo-500/30 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  }`}>
                    <Smartphone className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>
                      <strong>Modo Coexistência Ativo:</strong> Seu <strong>WhatsApp Business continuará funcionando normalmente no celular</strong> enquanto a API Cloud e a IA operam simultaneamente.
                    </span>
                  </div>

                  {/* Live Feedback do sessionInfoListener */}
                  {metaSessionData?.phone_number_id && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 animate-in fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        Sessão Meta Concluída! Phone ID: {metaSessionData.phone_number_id} {metaSessionData.waba_id && `• WABA: ${metaSessionData.waba_id}`}
                      </span>
                    </div>
                  )}

                  {/* Botão de Ação Oficial Meta FB.login */}
                  <button
                    type="button"
                    onClick={handleConnectWhatsAppOfficial}
                    disabled={isMetaConnecting}
                    className="w-full py-3 px-4 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>
                      {isMetaConnecting
                        ? (metaStatusMessage || 'Aguardando autorização na Meta...')
                        : 'Conectar WhatsApp Oficial (Embedded Signup)'}
                    </span>
                  </button>

                  {/* Alternador para campos manuais */}
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setShowManualMetaConfig(!showManualMetaConfig)}
                      className="text-[11px] text-gray-400 hover:text-white flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
                    >
                      <span>{showManualMetaConfig ? 'Ocultar campos manuais' : 'Ou inserir Phone Number ID e Token manualmente'}</span>
                      {showManualMetaConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Formulário de Canais: Exibido para MonarcaHub Standard ou se usuário abrir o manual na Meta */}
              {(selectedApiOption === 'monarcahub_standard' || showManualMetaConfig) && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                      Nome do Canal / Departamento
                    </label>
                    <input
                      type="text"
                      required={selectedApiOption === 'monarcahub_standard' || showManualMetaConfig}
                      placeholder="Ex: WhatsApp Vendas ou Suporte Geral"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-[#00a884] ${
                        darkMode ? 'bg-[#111b21] border-[#313d45] text-white' : 'bg-[#f0f2f5] border-[#d1d7db]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                      Número do Telefone com DDI e DDD
                    </label>
                    <input
                      type="text"
                      required={selectedApiOption === 'monarcahub_standard' || showManualMetaConfig}
                      placeholder="+55 11 99999-8888"
                      value={newChannelPhone}
                      onChange={(e) => setNewChannelPhone(e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm font-mono focus:outline-none focus:border-[#00a884] ${
                        darkMode ? 'bg-[#111b21] border-[#313d45] text-white' : 'bg-[#f0f2f5] border-[#d1d7db]'
                      }`}
                    />
                  </div>

                  {/* Campos manuais da Meta */}
                  {selectedApiOption === 'meta_official' && (
                    <div className={`space-y-3 p-3.5 rounded-xl border ${
                      darkMode ? 'bg-[#182229] border-[#1877F2]/30' : 'bg-blue-50/70 border-blue-200'
                    }`}>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1877F2]">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Credenciais Meta Cloud API (Manual)</span>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                          Phone Number ID <span className="text-[10px] opacity-75 font-normal">(phone_number_id na Meta)</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 104829381029384"
                          value={metaPhoneNumberId}
                          onChange={(e) => setMetaPhoneNumberId(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:border-[#1877F2] ${
                            darkMode ? 'bg-[#111b21] border-[#313d45] text-white' : 'bg-white border-[#d1d7db]'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                          Token de Acesso <span className="text-[10px] opacity-75 font-normal">(token do System User / Bearer)</span>
                        </label>
                        <input
                          type="password"
                          placeholder="Ex: EAAG..."
                          value={metaToken}
                          onChange={(e) => setMetaToken(e.target.value)}
                          className={`w-full px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:border-[#1877F2] ${
                            darkMode ? 'bg-[#111b21] border-[#313d45] text-white' : 'bg-white border-[#d1d7db]'
                          }`}
                        />
                      </div>
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                      selectedApiOption === 'meta_official'
                        ? 'bg-[#1877F2]/10 border-[#1877F2]/30 text-blue-300'
                        : darkMode
                        ? 'bg-[#111b21] border-[#313d45] text-[#8696a0]'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    {selectedApiOption === 'meta_official' ? (
                      <ShieldCheck className="w-5 h-5 text-[#1877F2] shrink-0" />
                    ) : (
                      <QrCode className="w-5 h-5 text-[#00a884] shrink-0" />
                    )}
                    <span>
                      {selectedApiOption === 'meta_official'
                        ? 'Canal com API Oficial Meta Business selecionado. Os dados serão registrados e vinculados com isolamento à sua empresa.'
                        : 'Canal com API Padrão MonarcaHub selecionado. Os dados serão registrados e vinculados com segurança à sua empresa.'}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsConnectModalOpen(false)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-[#313d45] hover:bg-[#313d45] cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-[#00a884] hover:bg-[#009374] text-white disabled:opacity-50 cursor-pointer shadow-md transition-colors"
                    >
                      {isSaving ? 'Salvando...' : 'Salvar Canal'}
                    </button>
                  </div>
                </div>
              )}

              {/* Botão Fechar quando os campos manuais estiverem ocultos */}
              {selectedApiOption === 'meta_official' && !showManualMetaConfig && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsConnectModalOpen(false)}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold border border-[#313d45] hover:bg-[#313d45] cursor-pointer transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
