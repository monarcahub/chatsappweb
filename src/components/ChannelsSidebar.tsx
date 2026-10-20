import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Send,
  Sparkles,
  Trash2,
  Power,
  PowerOff,
  Check,
  Pencil,
  AlertCircle,
  Building2,
  MapPin,
  Phone,
} from 'lucide-react';
import { ChannelType, Account } from '../types';
import { useAuth } from '../context/AuthContext';
import { useMetaWhatsAppSignup } from '../hooks/useMetaWhatsAppSignup';
import { useEvolutionWhatsApp, sanitizeEvolutionInstanceName } from '../hooks/useEvolutionWhatsApp';
import { EvolutionQRModal } from './EvolutionQRModal';
import { TelegramIcon } from './TelegramIcon';
import { BranchItem } from './AIBrainModal';
import { supabase, isSupabaseConfigured, ensureSupabaseConfig } from '../lib/supabase';

interface ChannelsSidebarProps {
  darkMode: boolean;
  onBackToChats: () => void;
  onFilterByChannel: (channel: ChannelType | 'all' | string) => void;
  currentChannelFilter: ChannelType | 'all' | string;
  currentAccount?: Account | null;
  isAIActiveGlobal?: boolean;
  onToggleAIGlobal?: (newStatus: boolean) => void;
  onOpenBrain?: () => void;
}

interface ConnectedChannelItem {
  id: string;
  name: string;
  type: ChannelType;
  identifier: string;
  provider: string;
  apiType?: 'meta_official' | 'monarcahub_standard' | 'evolution_qr';
  instanceName?: string;
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
  isAIActiveGlobal = true,
  onToggleAIGlobal,
  onOpenBrain,
}) => {
  const { user, availableAccounts } = useAuth();
  const [channels, setChannels] = useState<ConnectedChannelItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Lista de IDs autorizados da empresa do usuário logado
  const allowedAccountIds = useMemo(() => {
    return (availableAccounts || [])
      .map((a) => a.id)
      .filter((id) => Boolean(id) && id !== 'all');
  }, [availableAccounts]);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<ChannelType | null>(null);
  const [whatsAppApiChoice, setWhatsAppApiChoice] = useState<'meta_official' | 'monarcahub_standard' | null>(null);

  // Lista de Países e DDI para conexão internacional ou nacional
  const COUNTRY_OPTIONS = [
    { code: 'BR', name: 'Brasil', ddi: '+55', flag: '🇧🇷', placeholder: '(11) 99999-9999' },
    { code: 'US', name: 'Estados Unidos', ddi: '+1', flag: '🇺🇸', placeholder: '555-883-6346' },
    { code: 'PT', name: 'Portugal', ddi: '+351', flag: '🇵🇹', placeholder: '912 345 678' },
    { code: 'ES', name: 'Espanha', ddi: '+34', flag: '🇪🇸', placeholder: '612 345 678' },
    { code: 'AR', name: 'Argentina', ddi: '+54', flag: '🇦🇷', placeholder: '9 11 1234-5678' },
    { code: 'MX', name: 'México', ddi: '+52', flag: '🇲🇽', placeholder: '55 1234 5678' },
    { code: 'GB', name: 'Reino Unido', ddi: '+44', flag: '🇬🇧', placeholder: '7911 123456' },
    { code: 'FR', name: 'França', ddi: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78' },
    { code: 'DE', name: 'Alemanha', ddi: '+49', flag: '🇩🇪', placeholder: '151 23456789' },
    { code: 'IT', name: 'Itália', ddi: '+39', flag: '🇮🇹', placeholder: '312 345 6789' },
    { code: 'CL', name: 'Chile', ddi: '+56', flag: '🇨🇱', placeholder: '9 1234 5678' },
    { code: 'UY', name: 'Uruguai', ddi: '+598', flag: '🇺🇾', placeholder: '91 234 567' },
    { code: 'PY', name: 'Paraguai', ddi: '+595', flag: '🇵🇾', placeholder: '981 123456' },
    { code: 'CO', name: 'Colômbia', ddi: '+57', flag: '🇨🇴', placeholder: '300 123 4567' },
    { code: 'PE', name: 'Peru', ddi: '+51', flag: '🇵🇪', placeholder: '912 345 678' },
    { code: 'OTHER', name: 'Outro País', ddi: '+', flag: '🌐', placeholder: 'Ex: +1 555-883-6346' },
  ];
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_OPTIONS[0]);

  // Formatação flexível para telefone
  const formatPhone = (val: string, countryCode: string = 'BR') => {
    if (countryCode !== 'BR') {
      return val.replace(/[^\d\s\-()+]/g, '');
    }
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  // Campos de WhatsApp
  const [newChannelPhone, setNewChannelPhone] = useState('');
  const [newChannelName, setNewChannelName] = useState('');
  const [selectedApiOption, setSelectedApiOption] = useState<'meta_official' | 'monarcahub_standard'>('meta_official');
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [metaToken, setMetaToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showManualMetaConfig, setShowManualMetaConfig] = useState(false);

  // Campos para outros canais
  const [instagramUsername, setInstagramUsername] = useState('');
  const [telegramBotUsername, setTelegramBotUsername] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [webchatDomain, setWebchatDomain] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Estados para edição do nome do canal na tabela channels do Supabase
  const [editingChannel, setEditingChannel] = useState<ConnectedChannelItem | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isTogglingGlobalAI, setIsTogglingGlobalAI] = useState(false);

  // Recomendar configuração do Cérebro antes de conectar canais (para nova empresa)
  const [showBrainRecommendationModal, setShowBrainRecommendationModal] = useState(false);

  // Múltiplas Unidades / Filiais (cerebro_ia.branches)
  const [availableBranches, setAvailableBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (!successToast) return;
    const timer = setTimeout(() => setSuccessToast(null), 3500);
    return () => clearTimeout(timer);
  }, [successToast]);

  // Carrega unidades da empresa selecionada (cerebro_ia.branches)
  const fetchAccountBranches = useCallback(async () => {
    if (!currentAccount?.id || currentAccount.id === 'all') {
      setAvailableBranches([]);
      return;
    }
    try {
      await ensureSupabaseConfig();
      const { data, error } = await supabase
        .from('cerebro_ia')
        .select('branches')
        .eq('account_id', currentAccount.id)
        .maybeSingle();

      if (!error && data?.branches && Array.isArray(data.branches)) {
        setAvailableBranches(data.branches);
      } else {
        setAvailableBranches([]);
      }
    } catch (err) {
      console.warn('Erro ao buscar unidades cadastradas:', err);
      setAvailableBranches([]);
    }
  }, [currentAccount?.id]);

  useEffect(() => {
    fetchAccountBranches();
  }, [fetchAccountBranches]);

  // Associa o channel_id real da tabela channels à unidade correspondente em cerebro_ia.branches
  const associateChannelToBranch = async (channelId: string, branchId: string | null) => {
    if (!branchId || !currentAccount?.id || currentAccount.id === 'all') return;
    try {
      await ensureSupabaseConfig();
      const targetAccId = currentAccount.id;

      const { data: cfg, error: getErr } = await supabase
        .from('cerebro_ia')
        .select('branches')
        .eq('account_id', targetAccId)
        .maybeSingle();

      if (!getErr && cfg && Array.isArray(cfg.branches)) {
        const updatedBranches = cfg.branches.map((b: BranchItem) => {
          if (b.unidade_id === branchId) {
            return { ...b, channel_id: channelId };
          }
          return b;
        });

        await supabase
          .from('cerebro_ia')
          .update({
            branches: updatedBranches,
            updated_at: new Date().toISOString(),
          })
          .eq('account_id', targetAccId);

        setAvailableBranches(updatedBranches);
        setSuccessToast('Canal vinculado à unidade com sucesso!');
      }
    } catch (err) {
      console.warn('Erro ao associar canal à unidade no Cérebro:', err);
    }
  };

  // Helper para resetar e fechar modal
  const resetConnectModal = () => {
    setIsConnectModalOpen(false);
    setSelectedPlatform(null);
    setWhatsAppApiChoice(null);
    setSelectedBranchId(null);
    setNewChannelName('');
    setNewChannelPhone('');
    setSelectedCountry(COUNTRY_OPTIONS[0]);
    setInstagramUsername('');
    setTelegramBotUsername('');
    setTelegramBotToken('');
    setWebchatDomain('');
    setMetaPhoneNumberId('');
    setMetaToken('');
    setSelectedApiOption('meta_official');
    setShowManualMetaConfig(false);
  };

  // Handler inteligente para abrir conexão de canal respeitando a recomendação do Cérebro
  const handleOpenConnectModal = () => {
    const sessionKey = `chatsapp_ignore_brain_rec_${currentAccount?.id || 'default'}`;
    const isIgnored = typeof window !== 'undefined' && sessionStorage.getItem(sessionKey) === 'true';

    // Regra: Mostrar aviso apenas se a empresa não tiver canais cadastrados e não tiver ignorado na sessão
    if (channels.length === 0 && !isIgnored) {
      setShowBrainRecommendationModal(true);
      return;
    }

    setSelectedPlatform(null);
    setWhatsAppApiChoice(null);
    setSelectedBranchId(null);
    setIsConnectModalOpen(true);
  };

  const handleIgnoreBrainRecommendation = () => {
    const sessionKey = `chatsapp_ignore_brain_rec_${currentAccount?.id || 'default'}`;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(sessionKey, 'true');
    }
    setShowBrainRecommendationModal(false);
    setSelectedPlatform(null);
    setWhatsAppApiChoice(null);
    setSelectedBranchId(null);
    setIsConnectModalOpen(true);
  };

  const handleGoToBrainFromRecommendation = () => {
    setShowBrainRecommendationModal(false);
    if (onOpenBrain) {
      onOpenBrain();
    }
  };

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
    onSuccess: async (newChan: any) => {
      const createdChanId = newChan?.channel?.id || newChan?.id;
      if (selectedBranchId && createdChanId) {
        await associateChannelToBranch(createdChanId, selectedBranchId);
      }
      fetchChannels();
      fetchAccountBranches();
      resetConnectModal();
    },
  });

  // Hook Oficial da Evolution API (WhatsApp QR Code / API Não Oficial)
  const {
    instanceName: evoInstanceName,
    setInstanceName: setEvoInstanceName,
    channelName: evoChannelName,
    setChannelName: setEvoChannelName,
    branchSuffix: evoBranchSuffix,
    setBranchSuffix: setEvoBranchSuffix,
    isQrModalOpen,
    isLoadingQr,
    qrCodeSrc,
    whatsappUnofficialStatus,
    statusMessage: evoStatusMessage,
    actionSuccessMessage: evoActionSuccessMessage,
    isActionLoading: isEvoActionLoading,
    startConnectionFlow: startEvolutionConnectionFlow,
    refreshQrCode: refreshEvolutionQrCode,
    checkStatus: checkEvolutionStatus,
    restartInstance: restartEvolutionInstance,
    logoutInstance: logoutEvolutionInstance,
    closeQrModal: closeEvolutionQrModal,
  } = useEvolutionWhatsApp({
    userEmail: user?.email,
    accountId: currentAccount?.id,
    accountName: currentAccount?.name,
    onSuccess: async (data?: any) => {
      const createdChanId = data?.channelId || data?.id;
      if (selectedBranchId && createdChanId) {
        await associateChannelToBranch(createdChanId, selectedBranchId);
      }
      fetchChannels();
      fetchAccountBranches();
      resetConnectModal();
    },
  });

  // Sanitização e cálculo automático do nome da instância Evolution WhatsApp
  const calculatedInstanceName = useMemo(() => {
    const base = sanitizeEvolutionInstanceName(user?.email || 'instancia');
    const cleanPhoneDigits = newChannelPhone.replace(/\D/g, '');
    const hasExistingSameInstance = channels.some(
      (c) => c.instanceName === base || c.identifier?.includes(base)
    );
    if (hasExistingSameInstance && cleanPhoneDigits) {
      return `${base}_${cleanPhoneDigits.slice(-4)}`;
    }
    return base;
  }, [user?.email, newChannelPhone, channels]);

  const handleConnectWithQrCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    let phoneToSave = newChannelPhone.trim();
    if (phoneToSave && !phoneToSave.startsWith('+')) {
      phoneToSave = `${selectedCountry.ddi} ${phoneToSave}`;
    }

    const channelNameToConnect = newChannelName.trim();
    const instanceToConnect = calculatedInstanceName;

    // Fecha o modal de configuração de plataforma e inicia o fluxo de QR Code
    resetConnectModal();

    // Dispara fluxo Evolution QR Code
    startEvolutionConnectionFlow(instanceToConnect, channelNameToConnect, phoneToSave);
  };

  const mapChannelRow = (ch: any): ConnectedChannelItem => {
    const rawApiType = ch.config?.api_type;
    const instanceName = ch.config?.instance_name || ch.config?.instanceName;
    const apiType: 'meta_official' | 'monarcahub_standard' | 'evolution_qr' =
      rawApiType === 'meta_official'
        ? 'meta_official'
        : rawApiType === 'evolution_qr' || instanceName || rawApiType === 'monarcahub_standard'
        ? 'evolution_qr'
        : 'meta_official';

    const identifier =
      ch.type === 'whatsapp'
        ? instanceName
          ? `Instância: ${instanceName}`
          : ch.config?.waba_phone || ch.config?.phone || currentAccount?.whatsappPhone || 'Ativo'
        : ch.type === 'instagram'
        ? ch.config?.username || `@${ch.name.toLowerCase().replace(/\s+/g, '')}`
        : ch.type === 'telegram'
        ? ch.config?.bot_username || `@${ch.name.toLowerCase().replace(/\s+/g, '')}bot`
        : ch.config?.domain || 'Widget Ativo';

    const provider =
      ch.type === 'whatsapp'
        ? apiType === 'meta_official'
          ? 'Api Oficial Meta Business'
          : 'Api Padrão'
        : ch.type === 'instagram'
        ? 'Instagram Direct'
        : ch.type === 'telegram'
        ? 'Telegram Bot'
        : 'Site Chat (Webchat)';

    return {
      id: ch.id,
      name: ch.name || 'Canal de Atendimento',
      type: ch.type || 'whatsapp',
      identifier,
      provider,
      apiType: ch.type === 'whatsapp' ? apiType : undefined,
      instanceName,
      status: ch.is_active ? 'online' : 'offline',
      latency: '28ms',
      ai_enabled: ch.config?.ai_enabled !== false,
    };
  };

  const fetchChannels = async () => {
    if (!currentAccount || !currentAccount.id) {
      setChannels([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      await ensureSupabaseConfig();

      let channelsData: any[] | null = null;

      // 1. Consulta direta ao Supabase com anon key (funciona no Vercel/Produção e Preview)
      if (isSupabaseConfigured) {
        let query = supabase
          .from('channels')
          .select('*')
          .order('created_at', { ascending: false });

        if (currentAccount.id === 'all') {
          if (allowedAccountIds.length > 0) {
            query = query.in('account_id', allowedAccountIds);
          } else {
            setChannels([]);
            setIsLoading(false);
            return;
          }
        } else {
          query = query.eq('account_id', currentAccount.id);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          channelsData = data;
        }
      }

      // 2. Fallback para rota /api/channels
      if (!channelsData) {
        const queryParams = new URLSearchParams();
        queryParams.set('account_id', currentAccount.id);
        if (allowedAccountIds.length > 0) {
          queryParams.set('account_ids', allowedAccountIds.join(','));
        }
        const res = await fetch(`/api/channels?${queryParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.channels && Array.isArray(json.channels)) {
            channelsData = json.channels;
          }
        }
      }

      if (channelsData) {
        setChannels(channelsData.map(mapChannelRow));
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
      await ensureSupabaseConfig();
      let updated = false;

      if (isSupabaseConfigured) {
        const currentChannel = channels.find((c) => c.id === channelId);
        const { error } = await supabase
          .from('channels')
          .update({
            config: {
              ...(currentChannel ? { ai_enabled: newStatus } : {}),
              ai_enabled: newStatus,
            },
          })
          .eq('id', channelId);
        if (!error) updated = true;
      }

      if (!updated) {
        await fetch('/api/channels/toggle-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel_id: channelId,
            ai_enabled: newStatus,
            account_id: currentAccount?.id,
          }),
        });
      }

      setChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, ai_enabled: newStatus } : c))
      );
    } catch (err) {
      console.warn('Erro ao alternar IA do canal:', err);
    }
  };

  // Ativar ou pausar a IA globalmente para TODOS os canais da empresa selecionada
  const handleToggleCompanyAIGlobal = async (newStatus: boolean) => {
    if (!currentAccount?.id) return;
    setIsTogglingGlobalAI(true);
    try {
      await ensureSupabaseConfig();

      if (isSupabaseConfigured) {
        // 1. Atualizar cerebro_ia
        await supabase
          .from('cerebro_ia')
          .upsert(
            {
              account_id: currentAccount.id,
              is_active: newStatus,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'account_id' }
          );

        // 2. Atualizar todos os canais da empresa
        for (const ch of channels) {
          const { data: existingCh } = await supabase
            .from('channels')
            .select('config')
            .eq('id', ch.id)
            .single();
          const currentCfg = existingCh?.config || {};
          await supabase
            .from('channels')
            .update({
              config: { ...currentCfg, ai_enabled: newStatus },
              updated_at: new Date().toISOString(),
            })
            .eq('id', ch.id);
        }
      }

      // Notificar callback global do App
      if (onToggleAIGlobal) {
        onToggleAIGlobal(newStatus);
      }

      // Atualizar lista local de canais
      setChannels((prev) => prev.map((ch) => ({ ...ch, ai_enabled: newStatus })));

      setSuccessToast(
        newStatus
          ? `🚀 Automação ativada em todos os canais de ${currentAccount.name}!`
          : `⏸️ Automação pausada em todos os canais de ${currentAccount.name} (Atendimento 100% Humano)!`
      );
    } catch (err: any) {
      console.warn('Erro ao alternar IA global da empresa:', err);
    } finally {
      setIsTogglingGlobalAI(false);
    }
  };

  const handleDeleteChannel = (channelId: string, channelName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Desconectar Canal',
      message: `Deseja realmente desconectar o canal "${channelName}"? Os atendimentos vinculados continuarão no histórico.`,
      confirmText: 'Desconectar',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await ensureSupabaseConfig();
          let deleted = false;

          if (isSupabaseConfigured) {
            const { error } = await supabase
              .from('channels')
              .delete()
              .eq('id', channelId);
            if (!error) deleted = true;
          }

          if (!deleted) {
            await fetch(`/api/channels/${channelId}?account_id=${currentAccount?.id}`, {
              method: 'DELETE',
            });
          }

          setChannels((prev) => prev.filter((c) => c.id !== channelId));
        } catch (err) {
          console.warn('Erro ao excluir canal:', err);
        }
      },
    });
  };

  const handleOpenEditChannelModal = (channel: ConnectedChannelItem) => {
    setEditingChannel(channel);
    setEditingName(channel.name);
    setEditNameError(null);
  };

  const handleCloseEditChannelModal = () => {
    if (isSavingName) return;
    setEditingChannel(null);
    setEditingName('');
    setEditNameError(null);
  };

  const handleSaveChannelName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingChannel) return;

    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditNameError('O nome do canal não pode ficar em branco.');
      return;
    }

    setIsSavingName(true);
    setEditNameError(null);

    try {
      await ensureSupabaseConfig();
      let updated = false;

      // 1. Atualizar diretamente na tabela 'channels' do Supabase
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('channels')
          .update({
            name: trimmed,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingChannel.id);

        if (!error) {
          updated = true;
        } else {
          console.warn('Erro ao atualizar na tabela channels do Supabase:', error);
          if (
            error.message?.includes('duplicate') ||
            error.message?.includes('unique') ||
            error.code === '23505'
          ) {
            throw new Error('Já existe um canal com este nome nesta empresa. Escolha outro nome.');
          }
        }
      }

      // 2. Fallback via backend endpoint PATCH /api/channels/:id
      if (!updated) {
        const res = await fetch(`/api/channels/${editingChannel.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });

        if (res.ok) {
          updated = true;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Erro ao persistir novo nome do canal.');
        }
      }

      // Atualiza o estado da lista local imediatamente
      setChannels((prev) =>
        prev.map((c) => (c.id === editingChannel.id ? { ...c, name: trimmed } : c))
      );

      setSuccessToast(`Nome do canal atualizado para "${trimmed}" com sucesso no Supabase!`);
      setEditingChannel(null);
      setEditingName('');
    } catch (err: any) {
      console.error('Falha ao atualizar nome do canal:', err);
      setEditNameError(err?.message || 'Erro ao salvar alterações no Supabase.');
    } finally {
      setIsSavingName(false);
    }
  };

  // Carrega canais e escuta alterações em tempo real no Supabase
  useEffect(() => {
    fetchChannels();

    if (!isSupabaseConfigured || !currentAccount?.id) return;

    const channelSubscription = supabase
      .channel(`channels-realtime-${currentAccount.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channels' },
        () => {
          fetchChannels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelSubscription);
    };
  }, [currentAccount?.id, allowedAccountIds]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAccount || !currentAccount.id || !newChannelName.trim()) return;

    let targetType: ChannelType = selectedPlatform || 'whatsapp';
    let channelConfig: Record<string, any> = {};

    if (targetType === 'whatsapp') {
      let phoneToSave = newChannelPhone.trim();
      if (phoneToSave && !phoneToSave.startsWith('+')) {
        phoneToSave = `${selectedCountry.ddi} ${phoneToSave}`;
      }
      if (!phoneToSave) {
        phoneToSave = currentAccount.whatsappPhone || '';
      }

      channelConfig =
        selectedApiOption === 'meta_official'
          ? {
              phone: phoneToSave,
              api_name: 'Api Oficial Meta Business',
              api_type: 'meta_official',
              waba_phone: phoneToSave,
              phone_number_id: metaPhoneNumberId.trim() || (phoneToSave ? `pn_${phoneToSave.replace(/\D/g, '')}` : ''),
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
    } else if (targetType === 'instagram') {
      const cleanInsta = instagramUsername.trim().replace(/^@/, '');
      channelConfig = {
        username: cleanInsta ? `@${cleanInsta}` : '',
        provider: 'Instagram Direct',
        api_name: 'Meta Graph API Instagram',
        status: 'configured',
      };
    } else if (targetType === 'telegram') {
      const cleanBot = telegramBotUsername.trim().replace(/^@/, '');
      channelConfig = {
        bot_username: cleanBot ? `@${cleanBot}` : '',
        bot_token: telegramBotToken.trim(),
        provider: 'Telegram Bot API',
        status: 'configured',
      };
    } else if (targetType === 'webchat') {
      channelConfig = {
        domain: webchatDomain.trim(),
        provider: 'ChatsApp Webchat Widget',
        status: 'configured',
      };
    }

    setIsSaving(true);
    try {
      await ensureSupabaseConfig();
      let created = false;

      const targetAccountId =
        currentAccount.id === 'all' ? (allowedAccountIds[0] || currentAccount.id) : currentAccount.id;

      // 1. Tenta salvar diretamente no Supabase
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('channels')
          .insert({
            account_id: targetAccountId,
            name: newChannelName.trim(),
            type: targetType,
            is_active: true,
            config: channelConfig,
          })
          .select()
          .single();

        if (!error && data) {
          created = true;
          if (selectedBranchId && data.id) {
            await associateChannelToBranch(data.id, selectedBranchId);
          }
          resetConnectModal();
          await fetchChannels();
          await fetchAccountBranches();
        }
      }

      // 2. Fallback para rota /api/channels
      if (!created) {
        const res = await fetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account_id: targetAccountId,
            name: newChannelName.trim(),
            type: targetType,
            config: channelConfig,
          }),
        });

        if (res.ok) {
          const resJson = await res.json().catch(() => null);
          const fallbackChanId = resJson?.channel?.id || resJson?.id;
          if (selectedBranchId && fallbackChanId) {
            await associateChannelToBranch(fallbackChanId, selectedBranchId);
          }
          resetConnectModal();
          await fetchChannels();
          await fetchAccountBranches();
        }
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
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Instagram className="w-5 h-5" />
          </div>
        );
      case 'telegram':
        return (
          <div className="w-10 h-10 rounded-full bg-[#0088cc] text-white flex items-center justify-center shrink-0 shadow-sm">
            <TelegramIcon className="w-5 h-5" />
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
              Conexões
            </h1>
            <span className="text-[11px] text-[#00a884] font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse" />
              {channels.length} {channels.length === 1 ? 'Canal Ativo' : 'Canais Ativos'} • {currentAccount?.name}
            </span>
          </div>
        </div>

        <button
          onClick={handleOpenConnectModal}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00a884] hover:bg-[#02906f] text-white flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Conectar Canal</span>
        </button>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-24">
        {/* Card Master de Controle da IA da Empresa */}
        <div
          className={`p-3.5 rounded-2xl border shadow-sm transition-all ${
            isAIActiveGlobal
              ? darkMode
                ? 'bg-gradient-to-r from-[#182229] to-[#1f2c34] border-[#00a884]/40'
                : 'bg-emerald-50/80 border-emerald-300'
              : darkMode
              ? 'bg-[#182229] border-amber-500/40'
              : 'bg-amber-50/80 border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Brain
                className={`w-4 h-4 ${
                  isAIActiveGlobal ? 'text-[#00a884]' : 'text-amber-500'
                }`}
              />
              <span className="font-bold text-xs">
                Status Geral da IA ({currentAccount?.name || 'Empresa'})
              </span>
            </div>

            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                isAIActiveGlobal
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isAIActiveGlobal ? 'bg-[#25d366] animate-pulse' : 'bg-amber-500'
                }`}
              />
              {isAIActiveGlobal ? 'IA ATIVA' : 'IA PAUSADA'}
            </span>
          </div>

          <p className="text-[11px] text-[#8696a0] leading-relaxed mb-3">
            {isAIActiveGlobal
              ? 'A Inteligência Artificial atende automaticamente nos canais ativados abaixo. Respostas rápidas e suporte autônomo ativos.'
              : 'Atendimento 100% HUMANO em todos os canais da empresa. Nenhuma mensagem automática será disparada enquanto estiver pausada.'}
          </p>

          <button
            type="button"
            disabled={isTogglingGlobalAI}
            onClick={() => handleToggleCompanyAIGlobal(!isAIActiveGlobal)}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 ${
              isAIActiveGlobal
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600 hover:text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-900/30'
            }`}
          >
            {isAIActiveGlobal ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
            <span>
              {isTogglingGlobalAI
                ? 'Salvando no Supabase...'
                : isAIActiveGlobal
                ? 'Pausar IA Geral (Atendimento 100% Humano)'
                : 'Ativar IA Geral em Todos os Canais'}
            </span>
          </button>
        </div>

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
              onClick={handleOpenConnectModal}
              className="px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#009374] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Conectar Canais
            </button>
          </div>
        )}

        {/* List of Channels */}
        <div className="space-y-2.5">
          {channels.map((channel) => {
            const isSelected = currentChannelFilter === channel.id || currentChannelFilter === channel.type;
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
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                        <h3 className={`font-bold text-xs truncate ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`} title={channel.name}>
                          {channel.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleOpenEditChannelModal(channel)}
                          className="p-1 rounded text-[#8696a0] hover:text-[#00a884] hover:bg-[#00a884]/10 transition-colors cursor-pointer shrink-0"
                          title="Editar nome do canal no Supabase"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shrink-0 ${
                        channel.status === 'online'
                          ? 'bg-[#064e3b] text-[#34d399] border border-[#34d399]/30'
                          : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${channel.status === 'online' ? 'bg-[#34d399] animate-pulse' : 'bg-gray-500'}`} />
                        {channel.status === 'online' ? 'Online' : 'Desconectado'}
                      </span>
                    </div>

                    <div className="text-xs font-mono font-semibold text-[#00a884] flex items-center justify-between gap-1 flex-wrap">
                      <span>{channel.identifier}</span>
                      {(() => {
                        const linkedBranch = availableBranches.find((b) => b.channel_id === channel.id);
                        if (!linkedBranch) return null;
                        return (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-md"
                            title={`Unidade vinculada: ${linkedBranch.name}`}
                          >
                            <Building2 className="w-3 h-3" />
                            <span>Unidade: {linkedBranch.name}</span>
                          </span>
                        );
                      })()}
                    </div>

                    <div className="mt-1 text-[11px] text-[#8696a0] flex flex-wrap items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>Provedor: <strong className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{channel.provider?.toLowerCase().includes('evolution') ? 'Api Padrão' : channel.provider}</strong></span>
                        {channel.type === 'whatsapp' && channel.apiType === 'meta_official' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1877F2]/15 text-[#1877F2] border border-[#1877F2]/30 shadow-xs">
                            <ShieldCheck className="w-3 h-3" /> Mais Segura
                          </span>
                        )}
                        {channel.type === 'whatsapp' && (channel.apiType === 'evolution_qr' || channel.apiType === 'monarcahub_standard') && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30">
                            <QrCode className="w-3 h-3" /> MonarcaHub QR
                          </span>
                        )}
                      </div>
                      <span>Latência: {channel.latency}</span>
                    </div>

                    {/* Botões de Gerenciamento da Conexão Evolution API (Conectado / Online) */}
                    {channel.type === 'whatsapp' && (channel.apiType === 'evolution_qr' || channel.apiType === 'monarcahub_standard' || channel.instanceName) && (
                      <div className="mt-2 pt-2 border-t border-gray-700/20 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => checkEvolutionStatus(channel.instanceName)}
                          disabled={isEvoActionLoading}
                          className={`px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                            darkMode
                              ? 'bg-[#182229] border-[#313d45] hover:bg-[#253238] text-gray-200'
                              : 'bg-white border-gray-200 hover:bg-gray-100 text-gray-700'
                          }`}
                          title="Verificar status da conexão (action: status)"
                        >
                          <Radio className="w-3 h-3 text-emerald-400" />
                          <span>Verificar Conexão</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => restartEvolutionInstance(channel.instanceName)}
                          disabled={isEvoActionLoading}
                          className={`px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                            darkMode
                              ? 'bg-[#182229] border-[#313d45] hover:bg-[#253238] text-gray-200'
                              : 'bg-white border-gray-200 hover:bg-gray-100 text-gray-700'
                          }`}
                          title="Reiniciar a instância do WhatsApp (action: restart)"
                        >
                          <RefreshCw className={`w-3 h-3 text-cyan-400 ${isEvoActionLoading ? 'animate-spin' : ''}`} />
                          <span>Reiniciar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setConfirmModal({
                              isOpen: true,
                              title: 'Desconectar WhatsApp',
                              message: `Deseja realmente desconectar o WhatsApp da instância "${channel.instanceName || channel.name}"? Será necessário escanear o QR Code novamente para reconectar.`,
                              confirmText: 'Desconectar Instância',
                              onConfirm: () => {
                                setConfirmModal(null);
                                logoutEvolutionInstance(channel.instanceName);
                              },
                            });
                          }}
                          disabled={isEvoActionLoading}
                          className="px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Desconectar instância do WhatsApp (action: logout)"
                        >
                          <PowerOff className="w-3 h-3" />
                          <span>Desconectar</span>
                        </button>

                        {channel.status !== 'online' && (
                          <button
                            type="button"
                            onClick={() => startEvolutionConnectionFlow(channel.instanceName, channel.name)}
                            className="px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 bg-[#00a884] hover:bg-[#009374] text-white transition-colors cursor-pointer ml-auto"
                          >
                            <QrCode className="w-3 h-3" />
                            <span>Escanear QR</span>
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-gray-700/20 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
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

                        <button
                          type="button"
                          onClick={() => handleOpenEditChannelModal(channel)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                            darkMode
                              ? 'border-[#313d45] hover:border-[#00a884] text-gray-300 hover:text-[#00a884] hover:bg-[#00a884]/10'
                              : 'border-gray-200 hover:border-[#00a884] text-gray-700 hover:text-[#00a884] hover:bg-[#00a884]/10'
                          }`}
                          title="Editar nome do canal na tabela channels do Supabase"
                        >
                          <Pencil className="w-3 h-3 text-[#00a884]" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteChannel(channel.id, channel.name)}
                          className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Desconectar este canal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          onFilterByChannel(channel.id);
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
            className={`w-full max-w-lg rounded-2xl p-6 border shadow-2xl max-h-[90vh] overflow-y-auto ${
              darkMode ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
          >
            {/* ETAPA 1: Seleção da Plataforma (WhatsApp, Instagram, Telegram, Site Chat) */}
            {selectedPlatform === null ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-700/20">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Conectar Canais</h3>
                      <p className="text-[11px] text-[#8696a0]">
                        Escolha a plataforma para integrar ao workspace da <strong>{currentAccount?.name}</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetConnectModal}
                    className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#313d45] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Card 1: WhatsApp */}
                  <div
                    onClick={() => {
                      setSelectedPlatform('whatsapp');
                      setWhatsAppApiChoice(null);
                      setNewChannelName('WhatsApp Comercial');
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between hover:scale-[1.01] ${
                      darkMode
                        ? 'bg-[#111b21] border-[#313d45] hover:border-[#25d366]/60 hover:bg-[#182229]'
                        : 'bg-gray-50 border-gray-200 hover:border-[#25d366] hover:bg-emerald-50/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#25d366]/20 text-[#25d366] flex items-center justify-center group-hover:scale-105 transition-transform">
                          <MessageSquare className="w-5 h-5 fill-current" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30">
                          Mais utilizado
                        </span>
                      </div>
                      <h4 className="font-bold text-sm mb-1 group-hover:text-[#25d366] transition-colors">
                        WhatsApp
                      </h4>
                      <p className={`text-xs leading-relaxed ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                        API Oficial Meta Business ou API Padrão MonarcaHub com suporte a Coexistência e IA.
                      </p>
                    </div>
                    <div className="pt-3 flex items-center text-xs font-semibold text-[#00a884] group-hover:translate-x-0.5 transition-transform">
                      <span>Configurar WhatsApp →</span>
                    </div>
                  </div>

                  {/* Card 2: Instagram Direct */}
                  <div
                    onClick={() => {
                      setSelectedPlatform('instagram');
                      setNewChannelName('Instagram Oficial');
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between hover:scale-[1.01] ${
                      darkMode
                        ? 'bg-[#111b21] border-[#313d45] hover:border-pink-500/60 hover:bg-[#182229]'
                        : 'bg-gray-50 border-gray-200 hover:border-pink-400 hover:bg-pink-50/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                          <Instagram className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-400 border border-pink-500/30">
                          Meta Direct
                        </span>
                      </div>
                      <h4 className="font-bold text-sm mb-1 group-hover:text-pink-400 transition-colors">
                        Instagram Direct
                      </h4>
                      <p className={`text-xs leading-relaxed ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                        Receba e responda mensagens diretas (DMs) da conta comercial do Instagram da sua marca.
                      </p>
                    </div>
                    <div className="pt-3 flex items-center text-xs font-semibold text-pink-400 group-hover:translate-x-0.5 transition-transform">
                      <span>Configurar Instagram →</span>
                    </div>
                  </div>

                  {/* Card 3: Telegram */}
                  <div
                    onClick={() => {
                      setSelectedPlatform('telegram');
                      setNewChannelName('Telegram Suporte');
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between hover:scale-[1.01] ${
                      darkMode
                        ? 'bg-[#111b21] border-[#313d45] hover:border-[#0088cc]/60 hover:bg-[#182229]'
                        : 'bg-gray-50 border-gray-200 hover:border-[#0088cc] hover:bg-sky-50/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#0088cc]/20 text-[#0088cc] flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Send className="w-5 h-5 ml-0.5" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0088cc]/15 text-[#0088cc] border border-[#0088cc]/30">
                          BotFather
                        </span>
                      </div>
                      <h4 className="font-bold text-sm mb-1 group-hover:text-[#0088cc] transition-colors">
                        Telegram
                      </h4>
                      <p className={`text-xs leading-relaxed ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                        Conecte bots corporativos para grupos e atendimento direto com respostas automáticas.
                      </p>
                    </div>
                    <div className="pt-3 flex items-center text-xs font-semibold text-[#0088cc] group-hover:translate-x-0.5 transition-transform">
                      <span>Configurar Telegram →</span>
                    </div>
                  </div>

                  {/* Card 4: Site Chat (Webchat) */}
                  <div
                    onClick={() => {
                      setSelectedPlatform('webchat');
                      setNewChannelName('Chat do Site Oficial');
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between hover:scale-[1.01] ${
                      darkMode
                        ? 'bg-[#111b21] border-[#313d45] hover:border-[#00a884]/60 hover:bg-[#182229]'
                        : 'bg-gray-50 border-gray-200 hover:border-[#00a884] hover:bg-emerald-50/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Globe className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30">
                          Widget Web
                        </span>
                      </div>
                      <h4 className="font-bold text-sm mb-1 group-hover:text-[#00a884] transition-colors">
                        Site Chat (Webchat)
                      </h4>
                      <p className={`text-xs leading-relaxed ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                        Widget flutuante com IA para instalar no rodapé do seu site, landing page ou loja virtual.
                      </p>
                    </div>
                    <div className="pt-3 flex items-center text-xs font-semibold text-[#00a884] group-hover:translate-x-0.5 transition-transform">
                      <span>Configurar Site Chat →</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 text-center">
                  <button
                    type="button"
                    onClick={resetConnectModal}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      darkMode ? 'border-[#313d45] hover:bg-[#313d45] text-[#8696a0]' : 'border-gray-300 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : selectedPlatform === 'instagram' ? (
              /* ETAPA 2: Configuração do Instagram Direct */
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-gray-700/20">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPlatform(null)}
                      className="p-1 rounded-lg hover:bg-white/10 text-[#8696a0] hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer mr-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Instagram className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Conectar Instagram Direct</h3>
                      <p className="text-[11px] text-[#8696a0]">Integre a conta comercial do Instagram da empresa</p>
                    </div>
                  </div>
                  <button
                    onClick={resetConnectModal}
                    className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#313d45] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateChannel} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                      Nome da Conexão / Canal
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Instagram Oficial"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-pink-500 ${
                        darkMode ? 'bg-[#111b21] border-[#313d45] text-white' : 'bg-[#f7f9fa] border-[#d1d7db]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                      @ Nome de Usuário no Instagram
                    </label>
                    <div
                      className={`flex items-center px-3.5 py-2.5 rounded-xl border transition-colors ${
                        darkMode ? 'bg-[#111b21] border-[#313d45] focus-within:border-pink-500' : 'bg-[#f7f9fa] border-[#d1d7db] focus-within:border-pink-500'
                      }`}
                    >
                      <span className="text-[#8696a0] text-sm font-semibold mr-1">@</span>
                      <input
                        type="text"
                        required
                        placeholder="sua_empresa"
                        value={instagramUsername}
                        onChange={(e) => setInstagramUsername(e.target.value.replace(/^@/, ''))}
                        className="w-full bg-transparent text-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                      darkMode
                        ? 'bg-purple-950/20 border-purple-500/30 text-purple-200'
                        : 'bg-purple-50 border-purple-200 text-purple-900'
                    }`}
                  >
                    <Instagram className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-xs mb-0.5">Sincronização com Meta Graph API</p>
                      <p className="text-[11px] opacity-90">
                        O canal será registrado no workspace. As conversas de direct do Instagram aparecerão na lista unificada ao lado das do WhatsApp com roteamento de IA.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPlatform(null)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-[#313d45] hover:bg-[#313d45] cursor-pointer transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-95 text-white disabled:opacity-50 cursor-pointer shadow-md transition-all"
                    >
                      {isSaving ? 'Salvando...' : 'Salvar Canal Instagram'}
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedPlatform === 'telegram' ? (
              /* ETAPA 2: Configuração do Telegram */
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-gray-700/20">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPlatform(null)}
                      className="p-1 rounded-lg hover:bg-white/10 text-[#8696a0] hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer mr-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <div className="w-8 h-8 rounded-full bg-[#0088cc]/20 text-[#0088cc] flex items-center justify-center">
                      <Send className="w-4 h-4 ml-0.5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Conectar Telegram</h3>
                      <p className="text-[11px] text-[#8696a0]">Integre o bot do Telegram da empresa</p>
                    </div>
                  </div>
                  <button
                    onClick={resetConnectModal}
                    className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#313d45] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateChannel} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                      Nome da Conexão / Canal
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Suporte Telegram"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-[#0088cc] ${
                        darkMode ? 'bg-[#111b21] border-[#313d45] text-white' : 'bg-[#f7f9fa] border-[#d1d7db]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                      @ Nome do Bot no Telegram
                    </label>
                    <div
                      className={`flex items-center px-3.5 py-2.5 rounded-xl border transition-colors ${
                        darkMode ? 'bg-[#111b21] border-[#313d45] focus-within:border-[#0088cc]' : 'bg-[#f7f9fa] border-[#d1d7db] focus-within:border-[#0088cc]'
                      }`}
                    >
                      <span className="text-[#8696a0] text-sm font-semibold mr-1">@</span>
                      <input
                        type="text"
                        required
                        placeholder="MinhaEmpresaBot"
                        value={telegramBotUsername}
                        onChange={(e) => setTelegramBotUsername(e.target.value.replace(/^@/, ''))}
                        className="w-full bg-transparent text-sm focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                      Token do Bot (BotFather) <span className="font-normal opacity-70">(opcional)</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Ex: 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:border-[#0088cc] ${
                        darkMode ? 'bg-[#111b21] border-[#313d45] text-white' : 'bg-white border-[#d1d7db]'
                      }`}
                    />
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                      darkMode
                        ? 'bg-sky-950/20 border-sky-500/30 text-sky-200'
                        : 'bg-sky-50 border-sky-200 text-sky-900'
                    }`}
                  >
                    <Send className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-xs mb-0.5">Integração via Telegram Bot API</p>
                      <p className="text-[11px] opacity-90">
                        Permite receber mensagens de clientes pelo Telegram diretamente na central unificada, mantendo histórico e respostas da IA.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPlatform(null)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-[#313d45] hover:bg-[#313d45] cursor-pointer transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-[#0088cc] hover:bg-[#0077b3] text-white disabled:opacity-50 cursor-pointer shadow-md transition-all"
                    >
                      {isSaving ? 'Salvando...' : 'Salvar Canal Telegram'}
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedPlatform === 'webchat' ? (
              /* ETAPA 2: Configuração do Site Chat */
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-gray-700/20">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPlatform(null)}
                      className="p-1 rounded-lg hover:bg-white/10 text-[#8696a0] hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer mr-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <div className="w-8 h-8 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Conectar Site Chat</h3>
                      <p className="text-[11px] text-[#8696a0]">Widget de chat em tempo real para seu website</p>
                    </div>
                  </div>
                  <button
                    onClick={resetConnectModal}
                    className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#313d45] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateChannel} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                      Nome do Widget
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Chat do Site Oficial"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-[#00a884] ${
                        darkMode ? 'bg-[#111b21] border-[#313d45] text-white' : 'bg-[#f7f9fa] border-[#d1d7db]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                      Domínio / URL do Website
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: https://minhaempresa.com.br"
                      value={webchatDomain}
                      onChange={(e) => setWebchatDomain(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-[#00a884] ${
                        darkMode ? 'bg-[#111b21] border-[#313d45] text-white' : 'bg-[#f7f9fa] border-[#d1d7db]'
                      }`}
                    />
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                      darkMode
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-xs mb-0.5">Widget Flutuante no seu Site</p>
                      <p className="text-[11px] opacity-90">
                        Um widget de atendimento será provisionado para sua empresa, permitindo aos visitantes do site conversarem com atendentes humanos ou com a IA em tempo real.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPlatform(null)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-[#313d45] hover:bg-[#313d45] cursor-pointer transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-[#00a884] hover:bg-[#009374] text-white disabled:opacity-50 cursor-pointer shadow-md transition-all"
                    >
                      {isSaving ? 'Salvando...' : 'Criar Canal Site Chat'}
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedPlatform === 'whatsapp' && whatsAppApiChoice === null ? (
              /* ETAPA 2 (WhatsApp): Escolha entre API Oficial Meta e API Padrão MonarcaHub */
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-gray-700/20">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPlatform(null)}
                      className="p-1 rounded-lg hover:bg-white/10 text-[#8696a0] hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer mr-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <div className="w-8 h-8 rounded-full bg-[#25d366]/20 text-[#25d366] flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 fill-current" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">Conectar WhatsApp</h3>
                      <p className="text-[11px] text-[#8696a0]">
                        Como você deseja conectar o WhatsApp da sua empresa?
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetConnectModal}
                    className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#313d45] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 pt-1">
                  {/* Opção 1: API Oficial Meta Business */}
                  <div
                    onClick={() => {
                      setWhatsAppApiChoice('meta_official');
                      setSelectedApiOption('meta_official');
                      setNewChannelName('WhatsApp Oficial Meta');
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between hover:scale-[1.01] ${
                      darkMode
                        ? 'bg-[#111b21] border-[#313d45] hover:border-[#1877F2] hover:bg-[#182229]'
                        : 'bg-blue-50/50 border-blue-200 hover:border-[#1877F2] hover:bg-blue-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#1877F2]/15 text-[#1877F2] flex items-center justify-center font-bold">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-[#1877F2]">1. API Oficial Meta Business</span>
                            <span className="block text-[10px] text-[#8696a0]">Cloud API Oficial da Meta</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1877F2] text-white shadow-xs">
                          Recomendado
                        </span>
                      </div>

                      <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#1877F2]/15 text-[#1877F2] border border-[#1877F2]/30">
                          <ShieldCheck className="w-3 h-3" /> Mais Segura (Zero Bloqueios)
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                          <Smartphone className="w-3 h-3" /> Modo Coexistência (Celular + PC)
                        </span>
                      </div>

                      <p className={`text-xs leading-relaxed ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                        Homologada pela Meta. Seu WhatsApp Business continuará funcionando normalmente no celular da empresa, enquanto a IA e atendentes operam no ChatsApp.
                      </p>
                    </div>

                    <div className="pt-3 flex items-center text-xs font-semibold text-[#1877F2] group-hover:translate-x-0.5 transition-transform">
                      <span>Prosseguir com API Oficial Meta →</span>
                    </div>
                  </div>

                  {/* Opção 2: API Padrão MonarcaHub */}
                  <div
                    onClick={() => {
                      setWhatsAppApiChoice('monarcahub_standard');
                      setSelectedApiOption('monarcahub_standard');
                      setNewChannelName('WhatsApp Comercial');
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between hover:scale-[1.01] ${
                      darkMode
                        ? 'bg-[#111b21] border-[#313d45] hover:border-[#00a884] hover:bg-[#182229]'
                        : 'bg-emerald-50/50 border-emerald-200 hover:border-[#00a884] hover:bg-emerald-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#00a884]/15 text-[#00a884] flex items-center justify-center font-bold">
                            <QrCode className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-[#00a884]">2. API Padrão MonarcaHub</span>
                            <span className="block text-[10px] text-[#8696a0]">Conexão via QR Code / Web</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#2a3942] text-gray-300 border border-gray-600/40">
                          Sem Burocracia
                        </span>
                      </div>

                      <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <QrCode className="w-3 h-3" /> Leitura Rápida de QR Code
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Qualquer Número
                        </span>
                      </div>

                      <p className={`text-xs leading-relaxed ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                        Conexão padrão direta via escaneamento de QR Code pelo aplicativo de WhatsApp do celular. Rápida e dispensa aprovação prévia da Meta.
                      </p>
                    </div>

                    <div className="pt-3 flex items-center text-xs font-semibold text-[#00a884] group-hover:translate-x-0.5 transition-transform">
                      <span>Prosseguir com API Padrão →</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform(null)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-[#313d45] hover:bg-[#313d45] cursor-pointer transition-colors"
                  >
                    Voltar aos Canais
                  </button>
                  <button
                    type="button"
                    onClick={resetConnectModal}
                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-[#313d45] hover:bg-[#313d45] cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : selectedPlatform === 'whatsapp' && whatsAppApiChoice === 'meta_official' ? (
              /* ETAPA 3A: WhatsApp Oficial Meta Business (Embedded Signup) */
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-gray-700/20">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWhatsAppApiChoice(null)}
                      className="p-1 rounded-lg hover:bg-white/10 text-[#8696a0] hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer mr-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <div className="w-8 h-8 rounded-full bg-[#1877F2]/20 text-[#1877F2] flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">API Oficial Meta Business</h3>
                      <p className="text-[11px] text-[#8696a0]">
                        Conexão Oficial com Modo Coexistência ativo
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetConnectModal}
                    className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#313d45] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateChannel} className="space-y-4">
                  {/* Bloco Oficial Meta Embedded Signup */}
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
                          Conecte a API Oficial em segundos pelo popup oficial da Meta sem precisar copiar tokens ou IDs!
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

                    {/* Seleção de Unidade Cadastrada (Cérebro da IA) */}
                    {availableBranches.length > 0 && (
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-[#8696a0] flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-[#1877F2]" />
                            <span>Vincular a uma Unidade Cadastrada (Opcional)</span>
                          </span>
                          <span className="text-[10px] text-gray-500 font-normal">
                            {availableBranches.length} unidade(s)
                          </span>
                        </label>
                        <select
                          value={selectedBranchId || ''}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            setSelectedBranchId(val);
                            if (val) {
                              const b = availableBranches.find((x) => x.unidade_id === val);
                              if (b && (!newChannelName || newChannelName === 'WhatsApp Comercial')) {
                                setNewChannelName(`WhatsApp Oficial ${b.name}`);
                              }
                            }
                          }}
                          className={`w-full px-3 py-2.5 rounded-xl border text-xs outline-none cursor-pointer ${
                            darkMode ? 'bg-[#111b21] border-[#313d45] text-white focus:border-[#1877F2]' : 'bg-white border-[#d1d7db] text-black focus:border-[#1877F2]'
                          }`}
                        >
                          <option value="">Nenhuma unidade (Conectar canal sem vincular)</option>
                          {availableBranches.map((b) => (
                            <option key={b.unidade_id} value={b.unidade_id}>
                              {b.name} {b.phone ? `(${b.phone})` : ''} {b.channel_id ? '• [Já possui canal]' : ''}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-[#8696a0] block">
                          Ao concluir a conexão oficial, este canal será vinculado à unidade selecionada no Cérebro.
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

                  {/* Campos Manuais opcionais da Meta */}
                  {showManualMetaConfig && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                          Nome do Canal / Departamento
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: WhatsApp Oficial Vendas"
                          value={newChannelName}
                          onChange={(e) => setNewChannelName(e.target.value)}
                          className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-[#1877F2] ${
                            darkMode ? 'bg-[#111b21] border-[#313d45] text-white' : 'bg-[#f0f2f5] border-[#d1d7db]'
                          }`}
                        />
                      </div>

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

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setWhatsAppApiChoice(null)}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-[#313d45] hover:bg-[#313d45] cursor-pointer transition-colors"
                        >
                          Voltar
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-[#1877F2] hover:bg-[#166fe5] text-white disabled:opacity-50 cursor-pointer shadow-md transition-colors"
                        >
                          {isSaving ? 'Salvando...' : 'Salvar Canal Oficial'}
                        </button>
                      </div>
                    </div>
                  )}

                  {!showManualMetaConfig && (
                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setWhatsAppApiChoice(null)}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-[#313d45] hover:bg-[#313d45] cursor-pointer transition-colors"
                      >
                        Voltar para Escolha de API
                      </button>
                      <button
                        type="button"
                        onClick={resetConnectModal}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-[#313d45] hover:bg-[#313d45] cursor-pointer transition-colors"
                      >
                        Fechar
                      </button>
                    </div>
                  )}
                </form>
              </div>
            ) : selectedPlatform === 'whatsapp' && whatsAppApiChoice === 'monarcahub_standard' ? (
              /* ETAPA 3B: WhatsApp API Padrão MonarcaHub (QR Code / Web) */
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-gray-700/20">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWhatsAppApiChoice(null)}
                      className="p-1 rounded-lg hover:bg-white/10 text-[#8696a0] hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer mr-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <div className="w-8 h-8 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">API Padrão MonarcaHub</h3>
                      <p className="text-[11px] text-[#8696a0]">
                        Conexão rápida de WhatsApp via leitura de QR Code
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetConnectModal}
                    className="p-1 rounded-lg text-[#8696a0] hover:text-white hover:bg-[#313d45] cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleConnectWithQrCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                      Nome do Canal / Departamento
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: WhatsApp Comercial"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:border-[#00a884] ${
                        darkMode ? 'bg-[#111b21] border-[#313d45] text-white' : 'bg-[#f0f2f5] border-[#d1d7db]'
                      }`}
                    />
                  </div>

                  {/* Telefone Comercial com Seletor de País / DDI */}
                  <div>
                    <label className="block text-xs font-semibold text-[#8696a0] mb-1">
                      Número do Telefone com DDI e DDD
                    </label>
                    <div
                      className={`flex items-center px-3 py-1.5 rounded-xl border transition-colors ${
                        darkMode
                          ? 'bg-[#111b21] border-[#313d45] focus-within:border-[#00a884]'
                          : 'bg-[#f0f2f5] border-[#d1d7db] focus-within:border-[#00a884]'
                      }`}
                    >
                      <div className="flex items-center gap-1 border-r pr-2 mr-2 border-gray-600/30">
                        <span className="text-base select-none">{selectedCountry.flag}</span>
                        <select
                          value={selectedCountry.code}
                          onChange={(e) => {
                            const found = COUNTRY_OPTIONS.find((c) => c.code === e.target.value);
                            if (found) {
                              setSelectedCountry(found);
                              setNewChannelPhone('');
                            }
                          }}
                          className={`bg-transparent text-xs font-semibold focus:outline-none cursor-pointer pr-1 py-1 ${
                            darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'
                          }`}
                          aria-label="Código DDI do País"
                        >
                          {COUNTRY_OPTIONS.map((c) => (
                            <option
                              key={c.code}
                              value={c.code}
                              className={darkMode ? 'bg-[#202c33] text-[#e9edef]' : 'bg-white text-[#111b21]'}
                            >
                              {c.flag} {c.ddi} ({c.name})
                            </option>
                          ))}
                        </select>
                      </div>

                      <input
                        type="tel"
                        required
                        placeholder={selectedCountry.placeholder}
                        value={newChannelPhone}
                        onChange={(e) => {
                          setNewChannelPhone(formatPhone(e.target.value, selectedCountry.code));
                        }}
                        className="w-full bg-transparent text-sm font-mono focus:outline-none"
                      />
                    </div>
                    <span className="text-[10px] text-[#8696a0] mt-1 block">
                      Permite números nacionais e internacionais (ex: EUA +1 555-883-6346, Brasil, Portugal, etc.)
                    </span>
                  </div>

                  {/* Seleção de Unidade Cadastrada (Cérebro da IA) */}
                  {availableBranches.length > 0 && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-[#8696a0] flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#00a884]" />
                          <span>Vincular a uma Unidade Cadastrada (Opcional)</span>
                        </span>
                        <span className="text-[10px] text-gray-500 font-normal">
                          {availableBranches.length} unidade(s)
                        </span>
                      </label>
                      <select
                        value={selectedBranchId || ''}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          setSelectedBranchId(val);
                          if (val) {
                            const b = availableBranches.find((x) => x.unidade_id === val);
                            if (b) {
                              if (!newChannelName || newChannelName === 'WhatsApp Comercial') {
                                setNewChannelName(`WhatsApp ${b.name}`);
                              }
                              if (b.phone && !newChannelPhone) {
                                setNewChannelPhone(formatPhone(b.phone, selectedCountry.code));
                              }
                            }
                          }
                        }}
                        className={`w-full px-3 py-2.5 rounded-xl border text-xs outline-none cursor-pointer ${
                          darkMode ? 'bg-[#111b21] border-[#313d45] text-white focus:border-[#00a884]' : 'bg-[#f0f2f5] border-[#d1d7db] text-black focus:border-[#00a884]'
                        }`}
                      >
                        <option value="">Nenhuma unidade (Conectar canal sem vincular)</option>
                        {availableBranches.map((b) => (
                          <option key={b.unidade_id} value={b.unidade_id}>
                            {b.name} {b.phone ? `(${b.phone})` : ''} {b.channel_id ? '• [Já possui canal]' : ''}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-[#8696a0] block">
                        Ao conectar, este canal será associado automaticamente à unidade selecionada.
                      </span>
                    </div>
                  )}

                  <div
                    className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                      darkMode ? 'bg-[#111b21] border-[#313d45] text-[#8696a0]' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold text-[#00a884]">
                      <QrCode className="w-4 h-4 shrink-0" />
                      <span>Conexão Imediata por QR Code</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Ao clicar em <strong>Conectar com QR Code</strong>, a instância será criada no servidor e o QR Code será exibido para leitura no seu celular.
                    </p>
                    <div className="pt-1 flex items-center gap-1.5 text-[10px] font-mono opacity-85">
                      <span>Instância gerada:</span>
                      <span className="font-bold text-[#00a884] bg-[#00a884]/10 px-1.5 py-0.5 rounded">
                        {calculatedInstanceName}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setWhatsAppApiChoice(null)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-[#313d45] hover:bg-[#313d45] cursor-pointer transition-colors"
                    >
                      Voltar para Escolha de API
                    </button>
                    <button
                      type="submit"
                      disabled={isEvoActionLoading}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-[#00a884] hover:bg-[#009374] text-white disabled:opacity-50 cursor-pointer shadow-md transition-colors flex items-center justify-center gap-2"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>{isEvoActionLoading ? 'Gerando QR Code...' : 'Conectar com QR Code'}</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal para Editar Nome do Canal (Tabela channels do Supabase) */}
      {editingChannel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md rounded-2xl p-5 border shadow-2xl space-y-4 ${
              darkMode ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-700/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Editar Nome do Canal</h3>
                  <p className="text-[11px] text-[#8696a0]">
                    Atualização em tempo real na tabela <code className="text-[#00a884] font-mono">channels</code> do Supabase
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseEditChannelModal}
                disabled={isSavingName}
                className="p-1 rounded-lg text-[#8696a0] hover:text-white cursor-pointer transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Canal Info Badge */}
            <div
              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                darkMode ? 'bg-[#111b21] border-[#2a3942]' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {getChannelIcon(editingChannel.type)}
                <div className="min-w-0">
                  <span className="font-semibold block truncate">{editingChannel.provider}</span>
                  <span className="text-[11px] font-mono text-[#00a884] block truncate">
                    {editingChannel.identifier}
                  </span>
                </div>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  editingChannel.status === 'online'
                    ? 'bg-[#064e3b] text-[#34d399]'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                {editingChannel.status === 'online' ? 'Online' : 'Desconectado'}
              </span>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveChannelName} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  Nome do Canal
                </label>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => {
                    setEditingName(e.target.value);
                    if (editNameError) setEditNameError(null);
                  }}
                  autoFocus
                  disabled={isSavingName}
                  placeholder="Ex: WhatsApp Comercial, Suporte, etc."
                  maxLength={100}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none transition-all ${
                    darkMode
                      ? 'bg-[#111b21] border-[#313d45] focus:border-[#00a884] text-[#e9edef]'
                      : 'bg-gray-50 border-gray-200 focus:border-[#00a884] text-[#111b21]'
                  } disabled:opacity-60`}
                />
                <div className="flex items-center justify-between mt-1 text-[11px] text-[#8696a0]">
                  <span>Este nome identifica o canal na caixa de entrada e filtros.</span>
                  <span>{editingName.length}/100</span>
                </div>
              </div>

              {editNameError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editNameError}</span>
                </div>
              )}

              {/* Botões */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-700/20">
                <button
                  type="button"
                  onClick={handleCloseEditChannelModal}
                  disabled={isSavingName}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-gray-600/40 hover:bg-gray-500/10 cursor-pointer transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingName || !editingName.trim() || editingName.trim() === editingChannel.name}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#00a884] hover:bg-[#009374] text-white cursor-pointer shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingName ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando no Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast de Sucesso para ações em Canais */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#00a884] text-white text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successToast}</span>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="ml-2 p-0.5 rounded hover:bg-black/10 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Modal de Confirmação In-App (Seguro para iframes e navegadores restritos) */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl space-y-4 ${
              darkMode ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
          >
            <div className="flex items-start justify-between">
              <h4 className="font-bold text-sm">{confirmModal.title}</h4>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="p-1 rounded-lg text-[#8696a0] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[#8696a0] leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-600/40 hover:bg-gray-500/10 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-md transition-colors"
              >
                {confirmModal.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Recomendar Configuração do Cérebro da IA antes de Conectar Canal */}
      {showBrainRecommendationModal && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 ${
              darkMode ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
          >
            <div className="flex items-start gap-3.5 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-[#00a884]/20 border border-[#00a884]/30 text-[#00a884] flex items-center justify-center shrink-0">
                <Brain className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00a884]/20 text-[#00a884] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Recomendação
                  </span>
                </div>
                <h3 className="font-bold text-sm sm:text-base leading-snug">
                  Recomendamos preparar sua IA antes de conectar um canal.
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBrainRecommendationModal(false)}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                  darkMode ? 'text-gray-400 hover:text-white hover:bg-[#313d45]' : 'text-gray-500 hover:text-black hover:bg-gray-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className={`text-xs sm:text-sm leading-relaxed mb-6 italic ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
              "Cadastre as informações básicas da sua empresa no Cérebro da IA para que ela conheça seu negócio e esteja preparada para atender seus clientes."
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleGoToBrainFromRecommendation}
                className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold bg-[#00a884] hover:bg-[#02906f] text-white flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Brain className="w-4 h-4" />
                <span>Acessar Cérebro da IA</span>
              </button>

              <button
                type="button"
                onClick={handleIgnoreBrainRecommendation}
                className={`w-full py-2 px-4 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  darkMode
                    ? 'border-gray-700 text-gray-300 hover:bg-[#313d45] hover:text-white'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-black'
                }`}
              >
                Ignorar e continuar
              </button>
            </div>

            <p className="text-[10px] text-center text-gray-500 mt-3">
              Você pode conectar normalmente agora (incluindo apenas para atendimento humano/omnichannel) e configurar o cérebro a qualquer momento.
            </p>
          </div>
        </div>
      )}

      {/* Modal Oficial de Conexão WhatsApp via Evolution API (QR Code) */}
      <EvolutionQRModal
        isOpen={isQrModalOpen}
        onClose={closeEvolutionQrModal}
        isLoading={isLoadingQr}
        qrCodeSrc={qrCodeSrc}
        status={whatsappUnofficialStatus}
        statusMessage={evoStatusMessage}
        instanceName={evoInstanceName}
        channelName={evoChannelName}
        onRefreshQr={refreshEvolutionQrCode}
        darkMode={darkMode}
      />
    </div>
  );
};
