import React, { useState, useEffect } from 'react';
import {
  Brain,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  BookOpen,
  Search,
  Save,
  Sliders,
  Building2,
  Bot,
  Volume2,
  CreditCard,
  Calendar,
  Camera,
  MessageSquare,
  Instagram,
  Clock,
  MapPin,
  Sparkles,
  Zap,
  Users,
  ShieldCheck,
  Radio,
  PhoneCall,
  Power,
  Play,
  Pause,
  Globe,
  Eye,
  Maximize2,
  FileText,
  Edit3,
  Phone,
  AlertTriangle,
  Bell,
  Lock,
  Crown,
  UserPlus,
  Smartphone,
  Send,
  Check,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { Account } from '../types';
import { supabase, ensureSupabaseConfig } from '../lib/supabase';
import { MarkdownTextBox } from './MarkdownTextBox';
import { MarkdownViewerModal } from './MarkdownViewerModal';
import { MarkdownRenderer } from './MarkdownRenderer';

export interface BranchItem {
  unidade_id: string;
  name: string;
  phone: string;
  channel_id: string | null;
  address: string;
}

interface KnowledgeItem {
  id: string;
  title: string;
  category: 'regras' | 'produtos' | 'faq' | 'proibicoes';
  content: string;
  priority: 'alta' | 'media' | 'restricao';
  createdAt: string;
  status: 'active' | 'pending_removal';
}

interface CerebroIaConfig {
  business_name: string;
  address: string;
  opening_hours: string;
  pricing_info: string;
  faq_text: string;
  tone_of_voice: string;
  pix_key: string;
  observations: string;
  is_active: boolean;
  allow_calls: boolean;
  reply_groups: boolean;
  reply_audio: boolean;
  send_images: boolean;
  integrate_agenda: boolean;
  recognize_payments: boolean;
  ai_active_all: boolean;
  omnichannel: boolean;
  ai_active_instagram: boolean;
  repost_instagram_stories?: boolean;
  instagram_status: string;
  use_official_api_coexistencia: boolean;
  test_number: string;
  extra_users_count: number;
  notify_human_handoff?: boolean;
  human_handoff_phone?: string;
  human_handoff_message?: string;
  scheduled_messages_enabled?: boolean;
}

interface ConnectedChannelItem {
  id: string;
  name: string;
  type: string;
  identifier: string;
  provider: string;
  apiType?: string;
  is_active: boolean;
  ai_enabled: boolean;
}

interface AIBrainModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  account?: Account | null;
  isAIActiveGlobal?: boolean;
  onToggleAIGlobal?: (newStatus: boolean) => void;
  onOpenConnections?: () => void;
}

const INITIAL_KNOWLEDGE: KnowledgeItem[] = [
  {
    id: 'k1',
    title: 'Tom de Voz Humanizado & Identidade da Marca',
    category: 'regras',
    content: 'Apresente-se como assistente virtual da empresa. Use linguagem acolhedora, objetiva e profissional. Utilize emojis moderadamente (1 por mensagem). Nunca seja prolixo.',
    priority: 'alta',
    createdAt: '10/09/2026',
    status: 'active',
  },
  {
    id: 'k2',
    title: 'Transbordo Imediato para Atendente Humano',
    category: 'regras',
    content: 'Se o cliente pedir "falar com atendente", "humano", "pessoa real" ou demonstrar irritação, responda que está transferindo imediatamente e altere o status da conversa para Atendente Humano.',
    priority: 'alta',
    createdAt: '11/09/2026',
    status: 'active',
  },
  {
    id: 'k3',
    title: 'Planos de Atendimento & Proposta Comercial',
    category: 'produtos',
    content: 'Apresente as opções de serviços e produtos com clareza. Destaque formas de pagamento, garantia e facilidades de contratação.',
    priority: 'media',
    createdAt: '11/09/2026',
    status: 'active',
  },
  {
    id: 'k4',
    title: 'PROIBIÇÃO ESTRITA: Dados Sensíveis & Senhas',
    category: 'proibicoes',
    content: 'NUNCA solicite senhas de e-mail, redes sociais, senhas bancárias ou códigos de verificação recebidos por SMS. Para pagamentos, envie exclusivamente o link ou chave PIX oficial.',
    priority: 'restricao',
    createdAt: '12/09/2026',
    status: 'active',
  },
  {
    id: 'k5',
    title: 'FAQ Modular: Formas de Pagamento & PIX',
    category: 'faq',
    content: '**Quais são as formas de pagamento aceitas?**\n- Chave PIX oficial com aprovação imediata;\n- Cartão de crédito em até 12x;\n- Boleto bancário (compensação em até 48h úteis).',
    priority: 'media',
    createdAt: '14/09/2026',
    status: 'active',
  },
];

export const AIBrainModal: React.FC<AIBrainModalProps> = ({
  isOpen,
  onClose,
  darkMode,
  account,
  isAIActiveGlobal,
  onToggleAIGlobal,
  onOpenConnections,
}) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'knowledge' | 'behavior'>('identity');
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [togglingChannelId, setTogglingChannelId] = useState<string | null>(null);
  const [channels, setChannels] = useState<ConnectedChannelItem[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);

  // Configurações do Cérebro da IA (tabela cerebro_ia)
  const [brainConfig, setBrainConfig] = useState<CerebroIaConfig>({
    business_name: account?.name || '',
    address: account?.address || '',
    opening_hours: '',
    pricing_info: '',
    faq_text: '',
    tone_of_voice: 'Amigável, acolhedor e consultivo',
    pix_key: '',
    observations: '',
    is_active: isAIActiveGlobal !== undefined ? isAIActiveGlobal : true,
    allow_calls: false, // Desativado por padrão
    reply_groups: false, // Não disponível
    reply_audio: true,
    send_images: false, // Desativado por padrão (Upgrade)
    integrate_agenda: false, // Desativado por padrão (Upgrade)
    recognize_payments: false, // Desativado por padrão (Upgrade)
    ai_active_all: false,
    omnichannel: true,
    ai_active_instagram: false, // Desativado por padrão (Upgrade)
    repost_instagram_stories: false, // Desativado por padrão (Upgrade)
    instagram_status: 'connected',
    use_official_api_coexistencia: false,
    test_number: '',
    extra_users_count: 1, // Padrão: 1 atendente simultâneo
    notify_human_handoff: false,
    human_handoff_phone: '',
    human_handoff_message: '🚨 *Solicitação de Atendimento Humano*: O cliente {cliente} ({telefone}) solicitou atendimento humano no canal {canal}. Acesse a plataforma ChatsApp para assumir a conversa.',
    scheduled_messages_enabled: false,
  });

  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Modal Informativo de Upgrade
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean;
    featureTitle: string;
    description: string;
  }>({
    isOpen: false,
    featureTitle: '',
    description: '',
  });

  // Gestão de Atendentes Simultâneos (1 padrão, aviso de upgrade ao adicionar mais)
  const [showAddSimultaneousUser, setShowAddSimultaneousUser] = useState(false);
  const [additionalUserEmail, setAdditionalUserEmail] = useState('');

  // Base de Conhecimento Modular
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>(INITIAL_KNOWLEDGE);
  const [activeCategory, setActiveCategory] = useState<'all' | 'regras' | 'produtos' | 'faq' | 'proibicoes'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Cadastro de Múltiplas Unidades / Filiais (coluna branches em cerebro_ia)
  const [branchesList, setBranchesList] = useState<BranchItem[]>([]);
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchForm, setBranchForm] = useState<{
    unidade_id: string;
    name: string;
    address: string;
    phone: string;
    channel_id: string | null;
  }>({
    unidade_id: '',
    name: '',
    address: '',
    phone: '',
    channel_id: null,
  });
  const [branchDeleteConfirm, setBranchDeleteConfirm] = useState<{
    isOpen: boolean;
    branch: BranchItem | null;
    linkedChannelName?: string;
  }>({ isOpen: false, branch: null });

  // Estado do Visualizador / Editor Modal de Markdown
  const [markdownModal, setMarkdownModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    content: string;
    onSave?: (newVal: string) => void;
    readOnly?: boolean;
  }>({
    isOpen: false,
    title: '',
    content: '',
  });

  // Controle de itens da base com prévia markdown ativada no card
  const [previewModeIds, setPreviewModeIds] = useState<Record<string, boolean>>({});

  // Modo de exibição do card oficial do FAQ (faq_text) na aba de conhecimento
  const [faqCardMode, setFaqCardMode] = useState<'preview' | 'edit'>('preview');

  const handleUpdateItemContent = (id: string, newContent: string) => {
    setKnowledgeList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, content: newContent } : item))
    );
    showToast('Instrução atualizada com sucesso.');
  };

  const openMarkdownModal = (
    title: string,
    content: string,
    onSave?: (newVal: string) => void,
    subtitle?: string,
    readOnly?: boolean
  ) => {
    setMarkdownModal({
      isOpen: true,
      title,
      content,
      onSave,
      subtitle,
      readOnly,
    });
  };

  // New item form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'regras' | 'produtos' | 'faq' | 'proibicoes'>('regras');
  const [newContent, setNewContent] = useState('');
  const [newPriority, setNewPriority] = useState<'alta' | 'media' | 'restricao'>('alta');

  // Carrega os canais conectados da empresa selecionada
  const fetchChannels = async () => {
    if (!account?.id) return;
    setIsLoadingChannels(true);
    try {
      const { data: channelsData, error: chErr } = await supabase
        .from('channels')
        .select('*')
        .eq('account_id', account.id);

      if (!chErr && Array.isArray(channelsData)) {
        const mapped: ConnectedChannelItem[] = channelsData.map((ch: any) => {
          const apiType = ch.config?.api_type || 'meta_official';
          return {
            id: ch.id,
            name: ch.name || 'WhatsApp Principal',
            type: ch.type || 'whatsapp',
            identifier:
              ch.config?.waba_phone ||
              ch.config?.phone ||
              ch.config?.username ||
              account.whatsappPhone ||
              '+55',
            provider:
              ch.type === 'whatsapp'
                ? apiType === 'monarcahub_standard'
                  ? 'Api Padrão MonarcaHub'
                  : 'Api Oficial Meta Business'
                : ch.type === 'instagram'
                ? 'Instagram Direct'
                : 'Webchat',
            apiType,
            is_active: ch.is_active !== false,
            ai_enabled: ch.config?.ai_enabled !== false,
          };
        });
        setChannels(mapped);
      }
    } catch (err) {
      console.warn('Erro ao carregar canais da empresa no cérebro:', err);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  // Funções de Gestão de Unidades & Filiais (armazenadas em cerebro_ia.branches)
  const handleOpenAddBranch = () => {
    const newId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'unit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
    setBranchForm({
      unidade_id: newId,
      name: '',
      address: '',
      phone: '',
      channel_id: null,
    });
    setEditingBranch(null);
    setIsBranchModalOpen(true);
  };

  const handleOpenEditBranch = (branch: BranchItem) => {
    setBranchForm({
      unidade_id: branch.unidade_id,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      channel_id: branch.channel_id,
    });
    setEditingBranch(branch);
    setIsBranchModalOpen(true);
  };

  const persistBranchesToDb = async (newBranches: BranchItem[]) => {
    if (!account?.id) return;
    try {
      await ensureSupabaseConfig();
      const { error } = await supabase
        .from('cerebro_ia')
        .update({
          branches: newBranches,
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', account.id);

      if (error) {
        await supabase
          .from('cerebro_ia')
          .upsert(
            {
              account_id: account.id,
              business_name: brainConfig.business_name || account.name || 'Empresa',
              branches: newBranches,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'account_id' }
          );
      }
    } catch (err) {
      console.warn('Erro ao persistir filiais no Supabase:', err);
    }
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name.trim()) {
      showToast('Por favor, informe o nome ou identificação da unidade.');
      return;
    }

    // Normalizar telefone para somente dígitos conforme regra
    const cleanPhone = branchForm.phone.replace(/\D/g, '');

    const branchToSave: BranchItem = {
      unidade_id: branchForm.unidade_id,
      name: branchForm.name.trim(),
      address: branchForm.address.trim(),
      phone: cleanPhone,
      channel_id: branchForm.channel_id || null,
    };

    let updatedList: BranchItem[];
    if (editingBranch) {
      // Edição: preserva o identificador estável unidade_id
      updatedList = branchesList.map((b) =>
        b.unidade_id === editingBranch.unidade_id ? branchToSave : b
      );
      showToast(`Unidade "${branchToSave.name}" atualizada com sucesso!`);
    } else {
      // Adição: adiciona sem apagar as existentes
      updatedList = [...branchesList, branchToSave];
      showToast(`Unidade "${branchToSave.name}" adicionada com sucesso!`);
    }

    setBranchesList(updatedList);
    setIsBranchModalOpen(false);
    setEditingBranch(null);

    await persistBranchesToDb(updatedList);
  };

  const handleRequestDeleteBranch = (branch: BranchItem) => {
    if (branch.channel_id) {
      const linked = channels.find((c) => c.id === branch.channel_id);
      setBranchDeleteConfirm({
        isOpen: true,
        branch,
        linkedChannelName: linked ? linked.name : 'Canal Vinculado',
      });
      return;
    }

    executeDeleteBranch(branch.unidade_id);
  };

  const executeDeleteBranch = async (unidadeId: string) => {
    const updated = branchesList.filter((b) => b.unidade_id !== unidadeId);
    setBranchesList(updated);
    setBranchDeleteConfirm({ isOpen: false, branch: null });
    showToast('Unidade removida com sucesso.');
    await persistBranchesToDb(updated);
  };

  // Carrega configurações reais da tabela cerebro_ia no Supabase ao abrir
  useEffect(() => {
    if (!isOpen || !account?.id) return;

    let isMounted = true;
    setIsLoadingConfig(true);

    fetchChannels();

    const loadCerebroConfig = async () => {
      try {
        await ensureSupabaseConfig();
        const { data: cfg, error } = await supabase
          .from('cerebro_ia')
          .select('*')
          .eq('account_id', account.id)
          .maybeSingle();

        if (!isMounted) return;

        if (cfg) {
          setBrainConfig((prev) => ({
            ...prev,
            business_name: cfg.business_name || prev.business_name,
            address: cfg.address || prev.address,
            opening_hours: cfg.opening_hours || prev.opening_hours,
            pricing_info: cfg.pricing_info || prev.pricing_info,
            faq_text: cfg.faq_text || prev.faq_text,
            tone_of_voice: cfg.tone_of_voice || prev.tone_of_voice,
            pix_key: cfg.pix_key || prev.pix_key,
            observations: cfg.observations || prev.observations,
            is_active: cfg.is_active !== undefined ? cfg.is_active : prev.is_active,
            allow_calls: Boolean(cfg.allow_calls),
            reply_groups: false, // Desativado/Não disponível
            reply_audio: cfg.reply_audio !== undefined ? cfg.reply_audio : prev.reply_audio,
            send_images: Boolean(cfg.send_images),
            integrate_agenda: Boolean(cfg.integrate_agenda),
            recognize_payments: Boolean(cfg.recognize_payments),
            ai_active_all: cfg.ai_active_all !== undefined ? cfg.ai_active_all : prev.ai_active_all,
            omnichannel: cfg.omnichannel !== undefined ? cfg.omnichannel : prev.omnichannel,
            ai_active_instagram: Boolean(cfg.ai_active_instagram),
            repost_instagram_stories: Boolean(cfg.repost_instagram_stories),
            instagram_status: cfg.instagram_status || prev.instagram_status,
            use_official_api_coexistencia: false,
            test_number: cfg.test_number || prev.test_number,
            extra_users_count: cfg.extra_users_count !== undefined ? Number(cfg.extra_users_count) : 1,
            notify_human_handoff: Boolean(cfg.notify_human_handoff),
            human_handoff_phone: cfg.human_handoff_phone || prev.human_handoff_phone,
            human_handoff_message: cfg.human_handoff_message || prev.human_handoff_message,
            scheduled_messages_enabled: Boolean(cfg.scheduled_messages_enabled),
          }));

          if (Array.isArray(cfg.branches)) {
            setBranchesList(cfg.branches);
          } else {
            setBranchesList([]);
          }

          if (Array.isArray(cfg.knowledge_base) && cfg.knowledge_base.length > 0) {
            setKnowledgeList(cfg.knowledge_base);
          }
        } else {
          // Atualiza o nome e endereço do negócio com os dados da empresa selecionada
          setBrainConfig((prev) => ({
            ...prev,
            business_name: account.name || prev.business_name,
            address: account.address || prev.address,
          }));
          setBranchesList([]);
        }
      } catch (err) {
        console.warn('Erro ao carregar configurações do cérebro:', err);
      } finally {
        if (isMounted) setIsLoadingConfig(false);
      }
    };

    loadCerebroConfig();

    return () => {
      isMounted = false;
    };
  }, [isOpen, account?.id, account?.name]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Estatísticas de canais da empresa
  const totalChannels = channels.length;
  const activeChannelsCount = channels.filter((c) => c.ai_enabled).length;
  const pausedChannelsCount = totalChannels - activeChannelsCount;

  // Status consolidado de canais
  const allChannelsActive = totalChannels > 0 ? activeChannelsCount === totalChannels : brainConfig.is_active;
  const allChannelsPaused = totalChannels > 0 ? activeChannelsCount === 0 : !brainConfig.is_active;
  const isPartialActive = totalChannels > 1 && activeChannelsCount > 0 && activeChannelsCount < totalChannels;
  const hasAnyActiveChannel = totalChannels > 0 ? activeChannelsCount > 0 : brainConfig.is_active;

  const handleSaveBrainConfig = async () => {
    if (!account?.id) {
      showToast('Nenhuma empresa ativa selecionada para salvar o cérebro.');
      return;
    }

    setIsSavingConfig(true);
    try {
      await ensureSupabaseConfig();
      const payload: Record<string, any> = {
        account_id: account.id,
        business_name: brainConfig.business_name,
        address: brainConfig.address,
        opening_hours: brainConfig.opening_hours,
        pricing_info: brainConfig.pricing_info,
        faq_text: brainConfig.faq_text,
        tone_of_voice: brainConfig.tone_of_voice,
        pix_key: brainConfig.pix_key,
        observations: brainConfig.observations,
        is_active: brainConfig.is_active,
        allow_calls: brainConfig.allow_calls,
        reply_groups: false, // Não disponível
        reply_audio: brainConfig.reply_audio,
        send_images: brainConfig.send_images,
        integrate_agenda: brainConfig.integrate_agenda,
        recognize_payments: brainConfig.recognize_payments,
        ai_active_all: brainConfig.ai_active_all,
        omnichannel: brainConfig.omnichannel,
        ai_active_instagram: brainConfig.ai_active_instagram,
        repost_instagram_stories: brainConfig.repost_instagram_stories,
        instagram_status: brainConfig.instagram_status,
        use_official_api_coexistencia: false,
        test_number: brainConfig.test_number,
        extra_users_count: brainConfig.extra_users_count || 1,
        notify_human_handoff: brainConfig.notify_human_handoff,
        human_handoff_phone: brainConfig.human_handoff_phone?.replace(/\D/g, '') || '',
        human_handoff_message: brainConfig.human_handoff_message,
        scheduled_messages_enabled: brainConfig.scheduled_messages_enabled,
        knowledge_base: knowledgeList,
        branches: branchesList,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from('cerebro_ia')
        .upsert(payload, { onConflict: 'account_id' });

      if (upsertErr) {
        // Fallback defensivo caso colunas novas ainda não tenham sido migradas via SQL no Supabase
        if (upsertErr.message?.includes('column') || upsertErr.code === '42703') {
          console.warn('Salvando com payload essencial devido a colunas pendentes no Supabase:', upsertErr.message);
          const fallbackPayload = { ...payload };
          delete fallbackPayload.notify_human_handoff;
          delete fallbackPayload.human_handoff_phone;
          delete fallbackPayload.human_handoff_message;
          delete fallbackPayload.scheduled_messages_enabled;
          delete fallbackPayload.repost_instagram_stories;

          const { error: fbErr } = await supabase
            .from('cerebro_ia')
            .upsert(fallbackPayload, { onConflict: 'account_id' });

          if (fbErr) throw fbErr;
        } else {
          throw upsertErr;
        }
      }

      showToast('Configurações salvas com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar cérebro:', err);
      showToast(`Erro ao salvar: ${err?.message || 'Tente novamente'}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Pausar ou Ativar a IA em TODOS os canais da empresa
  const handleToggleAllChannels = async (newStatus: boolean) => {
    if (!account?.id) {
      showToast('Nenhuma empresa selecionada');
      return;
    }

    setIsTogglingStatus(true);
    try {
      // 1. Atualizar cerebro_ia diretamente
      await supabase
        .from('cerebro_ia')
        .upsert({
          account_id: account.id,
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'account_id' });

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

      setBrainConfig((prev) => ({ ...prev, is_active: newStatus }));
      setChannels((prev) => prev.map((ch) => ({ ...ch, ai_enabled: newStatus })));
      if (onToggleAIGlobal) {
        onToggleAIGlobal(newStatus);
      }
      showToast(
        newStatus
          ? `🚀 Automação ativada em todos os canais de ${account.name}!`
          : `⏸️ Automação pausada em todos os canais de ${account.name} (Atendimento 100% Humano)!`
      );
    } catch (err: any) {
      showToast(`Falha de conexão: ${err?.message || 'Tente novamente'}`);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Pausar ou Ativar a IA em um canal conectado individual
  const handleToggleSingleChannel = async (channelId: string, currentAiEnabled: boolean) => {
    if (!account?.id) return;
    const newStatus = !currentAiEnabled;
    setTogglingChannelId(channelId);
    try {
      const { data: chData } = await supabase
        .from('channels')
        .select('config')
        .eq('id', channelId)
        .single();

      const updatedCfg = { ...(chData?.config || {}), ai_enabled: newStatus };
      await supabase
        .from('channels')
        .update({
          config: updatedCfg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', channelId);

      setChannels((prev) =>
        prev.map((ch) => (ch.id === channelId ? { ...ch, ai_enabled: newStatus } : ch))
      );

      // Atualiza status consolidado da empresa
      const nextActiveCount = channels.reduce((acc, c) => {
        if (c.id === channelId) return acc + (newStatus ? 1 : 0);
        return acc + (c.ai_enabled ? 1 : 0);
      }, 0);
      const anyActive = nextActiveCount > 0;
      setBrainConfig((prev) => ({ ...prev, is_active: anyActive }));
      if (onToggleAIGlobal) {
        onToggleAIGlobal(anyActive);
      }

      const target = channels.find((c) => c.id === channelId);
      showToast(
        newStatus
          ? `🚀 IA Ativada no canal "${target?.name || 'Canal'}"!`
          : `⏸️ IA Pausada no canal "${target?.name || 'Canal'}" (Humano neste número)!`
      );
    } catch (err: any) {
      showToast(`Erro ao alterar canal: ${err?.message || 'Tente novamente'}`);
    } finally {
      setTogglingChannelId(null);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newItem: KnowledgeItem = {
      id: `k_${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      content: newContent.trim(),
      priority: newPriority,
      createdAt: new Date().toLocaleDateString('pt-BR'),
      status: 'active',
    };

    setKnowledgeList([newItem, ...knowledgeList]);
    setNewTitle('');
    setNewContent('');
    setShowAddForm(false);
    showToast('Instrução adicionada à base de conhecimento!');
  };

  const handleRemoveItem = (id: string) => {
    setKnowledgeList(knowledgeList.filter((item) => item.id !== id));
    showToast('Instrução removida da base.');
  };

  const filteredItems = knowledgeList.filter((item) => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q);
    }
    return true;
  });

  const getCategoryBadge = (cat: KnowledgeItem['category']) => {
    switch (cat) {
      case 'regras':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">Regra de Atendimento</span>;
      case 'produtos':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400">Produtos & Preços</span>;
      case 'faq':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">FAQ & Dúvidas</span>;
      case 'proibicoes':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">Restrição / Proibição</span>;
    }
  };

  const getChannelTypeIcon = (type: string) => {
    switch (type) {
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4 text-[#25d366]" />;
      case 'instagram':
        return <Instagram className="w-4 h-4 text-pink-500" />;
      case 'webchat':
        return <Globe className="w-4 h-4 text-blue-400" />;
      default:
        return <Radio className="w-4 h-4 text-purple-400" />;
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in select-none">
      <div
        className={`w-full max-w-4xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl border overflow-hidden transition-all ${
          darkMode ? 'bg-[#182229] border-[#2a3942] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
        }`}
      >
        {/* Toast Alert */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[#00a884] text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Modal Header */}
        <div
          className={`px-5 py-3.5 flex items-center justify-between border-b shrink-0 ${
            darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-base">Cérebro da IA & Aprendizado</h2>
                {allChannelsActive ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/50 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    IA Ativa (Todos os Canais)
                  </span>
                ) : allChannelsPaused ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-900/50 text-amber-300 border border-amber-500/40">
                    ⏸️ IA Pausada (Todos os Canais)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-900/50 text-indigo-300 border border-indigo-500/40">
                    ⚡ IA Parcial ({activeChannelsCount}/{totalChannels} canais)
                  </span>
                )}
                {account && (
                  <span className="text-xs text-gray-400 font-medium hidden sm:inline">
                    • Empresa: <strong className="text-[#00a884]">{account.name}</strong>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Personalidade, diretrizes de atendimento e base de conhecimento da empresa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenConnections && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenConnections();
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00a884]/20 hover:bg-[#00a884]/30 text-[#00a884] border border-[#00a884]/30 transition-colors cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Ver Conexões</span>
              </button>
            )}

            <button
              onClick={onClose}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                darkMode ? 'hover:bg-[#374248] text-gray-400' : 'hover:bg-gray-200 text-gray-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>



        {/* Navigation Tabs */}
        <div
          className={`px-5 py-2 flex items-center gap-2 border-b shrink-0 overflow-x-auto text-xs font-semibold ${
            darkMode ? 'bg-[#111b21] border-[#222e35]' : 'bg-gray-100/60 border-gray-200'
          }`}
        >
          <button
            onClick={() => setActiveTab('identity')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'identity'
                ? 'bg-[#00a884] text-white shadow-xs'
                : darkMode
                ? 'text-[#8696a0] hover:bg-[#202c33] hover:text-[#e9edef]'
                : 'text-[#54656f] hover:bg-gray-200 hover:text-black'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>1. Identidade & Dados do Negócio</span>
          </button>

          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'knowledge'
                ? 'bg-[#00a884] text-white shadow-xs'
                : darkMode
                ? 'text-[#8696a0] hover:bg-[#202c33] hover:text-[#e9edef]'
                : 'text-[#54656f] hover:bg-gray-200 hover:text-black'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>2. Base de Conhecimento & Regras ({knowledgeList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('behavior')}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'behavior'
                ? 'bg-[#00a884] text-white shadow-xs'
                : darkMode
                ? 'text-[#8696a0] hover:bg-[#202c33] hover:text-[#e9edef]'
                : 'text-[#54656f] hover:bg-gray-200 hover:text-black'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>3. Comportamento & Automações da IA</span>
          </button>
        </div>

        {/* Tab 1: Identidade e Dados do Negócio */}
        {activeTab === 'identity' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            {isLoadingConfig && (
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                <span>Carregando dados da empresa...</span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#00a884]" />
                  <h3 className="text-sm font-bold">Identidade da Empresa</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#00a884]" />
                    <span>Nome da Empresa / Estabelecimento</span>
                  </label>
                  <input
                    type="text"
                    value={brainConfig.business_name}
                    onChange={(e) => setBrainConfig({ ...brainConfig, business_name: e.target.value })}
                    placeholder="Ex: MonarcaHub, Clínica Saúde, Agência Digital, Loja Express"
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      darkMode ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]' : 'bg-gray-50 border-gray-200 text-[#111b21]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#00a884]" />
                    <span>Endereço Físico ou Região de Atendimento</span>
                  </label>
                  <input
                    type="text"
                    value={brainConfig.address}
                    onChange={(e) => setBrainConfig({ ...brainConfig, address: e.target.value })}
                    placeholder="Ex: Av. Paulista, 1000 - São Paulo, SP / Atendimento Online em todo Brasil"
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      darkMode ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]' : 'bg-gray-50 border-gray-200 text-[#111b21]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-[#00a884]" />
                    <span>Chave PIX Oficial (para Vendas/Recebimentos)</span>
                  </label>
                  <input
                    type="text"
                    value={brainConfig.pix_key}
                    onChange={(e) => setBrainConfig({ ...brainConfig, pix_key: e.target.value })}
                    placeholder="CNPJ, e-mail, celular ou chave aleatória"
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      darkMode ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]' : 'bg-gray-50 border-gray-200 text-[#111b21]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-[#00a884]" />
                    <span>Telefone de Testes / Sandbox</span>
                  </label>
                  <input
                    type="text"
                    value={brainConfig.test_number}
                    onChange={(e) => setBrainConfig({ ...brainConfig, test_number: e.target.value })}
                    placeholder="+55 51 9999-9999"
                    className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                      darkMode ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]' : 'bg-gray-50 border-gray-200 text-[#111b21]'
                    }`}
                  />
                </div>
              </div>

              {/* Seção: Unidades & Filiais da Empresa (coluna branches em cerebro_ia) */}
              <div
                className={`mt-6 p-4 rounded-2xl border transition-all ${
                  darkMode ? 'bg-[#111b21]/70 border-[#222e35]' : 'bg-gray-50/90 border-gray-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-gray-700/20">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold flex items-center gap-2">
                        <span>Unidades & Filiais da Empresa</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#00a884]/20 text-[#00a884]">
                          {branchesList.length} cadastrada{branchesList.length === 1 ? '' : 's'}
                        </span>
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        Cadastre a matriz e filiais com endereço, telefone e canal de atendimento vinculado.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenAddBranch}
                    className="px-3.5 py-1.5 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Adicionar unidade</span>
                  </button>
                </div>

                {branchesList.length === 0 ? (
                  <div
                    className={`p-5 rounded-xl border border-dashed text-center ${
                      darkMode ? 'border-gray-700/50 text-[#8696a0]' : 'border-gray-300 text-gray-500'
                    }`}
                  >
                    <Building2 className="w-8 h-8 mx-auto mb-1.5 opacity-40 text-[#00a884]" />
                    <p className="text-xs font-semibold mb-1">Nenhuma unidade cadastrada ainda</p>
                    <p className="text-[11px] max-w-md mx-auto mb-3 opacity-80">
                      Cadastre a Matriz ou filiais da sua empresa para que a IA conheça os endereços, telefones e vincule os canais dedicados de atendimento.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenAddBranch}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#00a884]/20 hover:bg-[#00a884]/30 text-[#00a884] border border-[#00a884]/40 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Cadastrar Primeira Unidade</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {branchesList.map((branch) => {
                      const linkedChannel = channels.find((c) => c.id === branch.channel_id);
                      return (
                        <div
                          key={branch.unidade_id}
                          className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                            darkMode
                              ? 'bg-[#182229] border-[#222e35] hover:border-[#00a884]/50'
                              : 'bg-white border-gray-200 hover:border-[#00a884]/50 shadow-xs'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-[#00a884] shrink-0" />
                                <h5 className="font-bold text-xs truncate text-[#00a884]">
                                  {branch.name}
                                </h5>
                              </div>
                              <span
                                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-500/15 text-gray-400 shrink-0"
                                title={`Identificador estável: ${branch.unidade_id}`}
                              >
                                ID: {branch.unidade_id.length > 12 ? `${branch.unidade_id.slice(0, 10)}...` : branch.unidade_id}
                              </span>
                            </div>

                            <div className="space-y-1 text-[11px]">
                              {branch.address ? (
                                <div className="flex items-start gap-1.5 text-gray-300">
                                  <MapPin className="w-3 h-3 text-[#00a884] shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">{branch.address}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-gray-500 italic">
                                  <MapPin className="w-3 h-3 opacity-40 shrink-0" />
                                  <span>Endereço não informado</span>
                                </div>
                              )}

                              {branch.phone ? (
                                <div className="flex items-center gap-1.5 text-gray-300 font-mono">
                                  <Phone className="w-3 h-3 text-[#00a884] shrink-0" />
                                  <span>+{branch.phone}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-gray-500 italic">
                                  <Phone className="w-3 h-3 opacity-40 shrink-0" />
                                  <span>Sem telefone cadastrado</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-gray-700/20 flex items-center justify-between gap-2">
                            {/* Canal Vinculado */}
                            <div className="min-w-0">
                              {linkedChannel ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 truncate max-w-[190px]">
                                  <Radio className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{linkedChannel.name}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                                  <Radio className="w-2.5 h-2.5 opacity-40" />
                                  <span>Sem canal vinculado</span>
                                </span>
                              )}
                            </div>

                            {/* Botões de Ação */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEditBranch(branch)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  darkMode
                                    ? 'hover:bg-[#202c33] text-gray-400 hover:text-white'
                                    : 'hover:bg-gray-100 text-gray-600 hover:text-black'
                                }`}
                                title="Editar unidade"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteBranch(branch)}
                                className="p-1.5 rounded-lg hover:bg-rose-500/15 text-gray-400 hover:text-rose-400 transition-colors cursor-pointer"
                                title="Excluir unidade"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <MarkdownTextBox
                    label="Tom de Voz da IA & Diretrizes de Linguagem"
                    icon={<Bot className="w-3.5 h-3.5 text-[#00a884]" />}
                    value={brainConfig.tone_of_voice}
                    onChange={(val) => setBrainConfig({ ...brainConfig, tone_of_voice: val })}
                    placeholder="Ex: Amigável, acolhedor e consultivo. Use emojis com moderação..."
                    rows={3}
                    darkMode={darkMode}
                    helperText="Suporta formatação Markdown (ex: - tópicos, **destaques**, etc.)"
                    onExpand={(title, val, onSave) =>
                      openMarkdownModal(title, val, onSave, 'Tom de voz e regras de comunicação da IA')
                    }
                  />
                </div>

                <div>
                  <MarkdownTextBox
                    label="Horário de Atendimento Humano & Funcionamento"
                    icon={<Clock className="w-3.5 h-3.5 text-[#00a884]" />}
                    value={brainConfig.opening_hours}
                    onChange={(val) => setBrainConfig({ ...brainConfig, opening_hours: val })}
                    placeholder="Ex: Seg a Sex das 08h às 19h. Sábados das 09h às 14h."
                    rows={3}
                    darkMode={darkMode}
                    helperText="Suporta tabelas e escalas de plantão em Markdown."
                    onExpand={(title, val, onSave) =>
                      openMarkdownModal(title, val, onSave, 'Horários de atendimento e escala de plantão')
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <MarkdownTextBox
                    label="Tabela de Preços, Planos ou Serviços"
                    icon={<CreditCard className="w-3.5 h-3.5 text-[#00a884]" />}
                    value={brainConfig.pricing_info}
                    onChange={(val) => setBrainConfig({ ...brainConfig, pricing_info: val })}
                    placeholder="Descreva seus pacotes, mensalidades, taxas ou política de orçamentos..."
                    rows={4}
                    darkMode={darkMode}
                    helperText="Dica: clique no ícone de olho para ver prévia ou em Ampliar para tela cheia."
                    onExpand={(title, val, onSave) =>
                      openMarkdownModal(title, val, onSave, 'Tabela de preços, planos e regras de contratação')
                    }
                  />
                </div>

                <div>
                  <MarkdownTextBox
                    label="FAQ & Dúvidas Rápidas (Texto Geral)"
                    icon={<MessageSquare className="w-3.5 h-3.5 text-[#00a884]" />}
                    value={brainConfig.faq_text}
                    onChange={(val) => setBrainConfig({ ...brainConfig, faq_text: val })}
                    placeholder="Perguntas mais frequentes e respostas diretas para os clientes..."
                    rows={4}
                    darkMode={darkMode}
                    helperText="Dica: use # Pergunta e parágrafos para respostas bem formatadas."
                    onExpand={(title, val, onSave) =>
                      openMarkdownModal(title, val, onSave, 'Perguntas frequentes e respostas automáticas')
                    }
                  />
                </div>
              </div>

              <div className="mt-4">
                <MarkdownTextBox
                  label="Observações & Diretrizes Especiais do Estabelecimento"
                  icon={<Sparkles className="w-3.5 h-3.5 text-[#00a884]" />}
                  value={brainConfig.observations}
                  onChange={(val) => setBrainConfig({ ...brainConfig, observations: val })}
                  placeholder="Orientações e alertas que a IA deve respeitar para esta empresa..."
                  rows={3}
                  darkMode={darkMode}
                  helperText="Instruções críticas e regras gerais para o atendimento inteligente."
                  onExpand={(title, val, onSave) =>
                    openMarkdownModal(title, val, onSave, 'Diretrizes especiais para a inteligência artificial')
                  }
                />
              </div>
            </div>

            {/* Salvar Botão */}
            <div className="pt-3 border-t border-gray-700/20 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                Os dados são sincronizados e vinculados à empresa <strong className="text-white">{account?.name || 'Matriz'}</strong>.
              </span>

              <button
                type="button"
                onClick={handleSaveBrainConfig}
                disabled={isSavingConfig}
                className="px-5 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingConfig ? 'Salvando...' : 'Salvar Dados do Negócio'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Base de Conhecimento & Regras Modulares */}
        {activeTab === 'knowledge' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Top Controls: Search + Add Button */}
            <div className="p-4 border-b border-gray-700/20 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
              <div
                className={`relative flex-1 w-full flex items-center px-3 py-2 rounded-xl border ${
                  darkMode ? 'bg-[#111b21] border-[#222e35]' : 'bg-gray-100 border-gray-200'
                }`}
              >
                <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar instrução ou regra na base de conhecimento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none text-xs w-full focus:outline-none placeholder:text-gray-500"
                />
              </div>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{showAddForm ? 'Fechar Formulário' : 'Nova Instrução'}</span>
              </button>
            </div>

            {/* Categories Bar */}
            <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto border-b border-gray-700/20 text-xs shrink-0">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium cursor-pointer ${
                  activeCategory === 'all'
                    ? 'bg-[#00a884] text-white font-bold'
                    : darkMode
                    ? 'bg-[#111b21] text-gray-400 hover:text-white'
                    : 'bg-gray-100 text-gray-600 hover:text-black'
                }`}
              >
                Todas ({knowledgeList.length + (brainConfig.faq_text?.trim() ? 1 : 0)})
              </button>
              <button
                onClick={() => setActiveCategory('regras')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium cursor-pointer ${
                  activeCategory === 'regras'
                    ? 'bg-[#00a884] text-white font-bold'
                    : darkMode
                    ? 'bg-[#111b21] text-gray-400 hover:text-white'
                    : 'bg-gray-100 text-gray-600 hover:text-black'
                }`}
              >
                Regras de Atendimento
              </button>
              <button
                onClick={() => setActiveCategory('produtos')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium cursor-pointer ${
                  activeCategory === 'produtos'
                    ? 'bg-[#00a884] text-white font-bold'
                    : darkMode
                    ? 'bg-[#111b21] text-gray-400 hover:text-white'
                    : 'bg-gray-100 text-gray-600 hover:text-black'
                }`}
              >
                Produtos & Preços
              </button>
              <button
                onClick={() => setActiveCategory('proibicoes')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium cursor-pointer ${
                  activeCategory === 'proibicoes'
                    ? 'bg-[#00a884] text-white font-bold'
                    : darkMode
                    ? 'bg-[#111b21] text-gray-400 hover:text-white'
                    : 'bg-gray-100 text-gray-600 hover:text-black'
                }`}
              >
                Restrições / Proibições
              </button>
              <button
                onClick={() => setActiveCategory('faq')}
                className={`px-3 py-1 rounded-lg transition-colors font-medium cursor-pointer flex items-center gap-1.5 ${
                  activeCategory === 'faq'
                    ? 'bg-[#00a884] text-white font-bold'
                    : darkMode
                    ? 'bg-[#111b21] text-gray-400 hover:text-white'
                    : 'bg-gray-100 text-gray-600 hover:text-black'
                }`}
              >
                <span>FAQ Modular</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-bold">
                  {knowledgeList.filter((k) => k.category === 'faq').length + (brainConfig.faq_text?.trim() ? 1 : 0)}
                </span>
              </button>
            </div>

            {/* Add Form Accordion */}
            {showAddForm && (
              <form
                onSubmit={handleAddItem}
                className={`p-4 border-b border-gray-700/30 animate-in slide-in-from-top-3 ${
                  darkMode ? 'bg-[#111b21]' : 'bg-gray-50'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-400 mb-1">
                      Título da Instrução / Regra
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Não dar descontos acima de 10%..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                      className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                        darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-gray-300'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">
                      Categoria
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                        darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-gray-300'
                      }`}
                    >
                      <option value="regras">Regra de Atendimento</option>
                      <option value="produtos">Produtos & Planos</option>
                      <option value="faq">FAQ & Dúvidas</option>
                      <option value="proibicoes">Restrição / Proibição</option>
                    </select>
                  </div>
                </div>

                <div className="mb-3">
                  <MarkdownTextBox
                    label="Conteúdo / Texto Exato da Instrução para a IA"
                    icon={<FileText className="w-3.5 h-3.5 text-[#00a884]" />}
                    value={newContent}
                    onChange={setNewContent}
                    placeholder="Instrua exatamente como a IA deve proceder quando este tema surgir (suporta formatação Markdown: # títulos, **negrito**, listas -, tabelas, etc.)..."
                    rows={3}
                    darkMode={darkMode}
                    helperText="Clique no ícone de olho para ver a prévia formatada ou em Ampliar para abrir o editor em tela ampla."
                    onExpand={(title, val, onSave) =>
                      openMarkdownModal(
                        newTitle || 'Nova Instrução do Cérebro da IA',
                        val,
                        onSave,
                        'Edição e visualização formatada em Markdown'
                      )
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Prioridade:</span>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as any)}
                      className={`px-2 py-1 rounded-lg text-xs border outline-none ${
                        darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-gray-300'
                      }`}
                    >
                      <option value="alta">Alta (Obrigatória)</option>
                      <option value="media">Média (Recomendada)</option>
                      <option value="restricao">Restrição Crítica</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-bold"
                    >
                      Salvar na Base
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Knowledge List Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {/* Card Oficial do FAQ Central da Empresa (Coluna faq_text no Supabase) */}
              {(activeCategory === 'faq' || (activeCategory === 'all' && Boolean(brainConfig.faq_text?.trim()))) && (
                (!searchTerm.trim() ||
                  brainConfig.faq_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  'faq'.includes(searchTerm.toLowerCase()) ||
                  'dúvidas'.includes(searchTerm.toLowerCase()) ||
                  'perguntas'.includes(searchTerm.toLowerCase())) && (
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      activeCategory === 'faq'
                        ? 'border-[#00a884]/40 bg-[#00a884]/5 shadow-sm'
                        : darkMode
                        ? 'bg-[#111b21] border-[#222e35]'
                        : 'bg-emerald-50/40 border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          <span>FAQ Oficial da Empresa</span>
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30">
                          Base Central
                        </span>
                        <span className="font-bold text-xs">Perguntas & Respostas Frequentes</span>
                      </div>

                      {/* Ações do Card de FAQ */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setFaqCardMode(faqCardMode === 'preview' ? 'edit' : 'preview')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                            faqCardMode === 'preview'
                              ? 'bg-[#00a884] text-white border-[#00a884]'
                              : darkMode
                              ? 'bg-[#202c33] border-gray-700 text-gray-300 hover:text-white'
                              : 'bg-white border-gray-300 text-gray-700 hover:text-black'
                          }`}
                          title="Alternar entre modo de visualização formatada e edição"
                        >
                          {faqCardMode === 'preview' ? (
                            <>
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>Editar</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-2.5 h-2.5" />
                              <span>Ver Formatado</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openMarkdownModal(
                              'FAQ & Dúvidas Rápidas',
                              brainConfig.faq_text,
                              (newVal) => {
                                setBrainConfig((prev) => ({ ...prev, faq_text: newVal }));
                                showToast('FAQ atualizado. Clique em Salvar para salvar as alterações.');
                              },
                              'Instrução oficial do FAQ da empresa'
                            )
                          }
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                            darkMode
                              ? 'bg-[#202c33] border-gray-700 text-[#00a884] hover:bg-[#2a3942]'
                              : 'bg-white border-gray-300 text-[#00a884] hover:bg-emerald-50'
                          }`}
                          title="Abrir no Visualizador Markdown em tela cheia com edição e cópia"
                        >
                          <Maximize2 className="w-2.5 h-2.5" />
                          <span>Ampliar</span>
                        </button>
                      </div>
                    </div>

                    {/* Conteúdo do FAQ: Modo Prévia ou Edição */}
                    {faqCardMode === 'preview' ? (
                      <div
                        className={`p-3 rounded-xl border text-xs leading-relaxed transition-all ${
                          darkMode
                            ? 'bg-black/30 border-[#00a884]/30 text-[#e9edef]'
                            : 'bg-white/80 border-[#00a884]/30 text-[#111b21]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-[#00a884] font-bold mb-1.5 pb-1 border-b border-[#00a884]/20">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Visualização Formatada (Markdown)</span>
                          </span>
                          <span className="text-[10px] text-gray-400 font-normal">
                            Sincronizado com a base de conhecimento
                          </span>
                        </div>

                        <MarkdownRenderer
                          content={brainConfig.faq_text}
                          emptyText="Nenhum FAQ cadastrado ainda. Clique em Editar para adicionar."
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          rows={5}
                          value={brainConfig.faq_text}
                          onChange={(e) => setBrainConfig({ ...brainConfig, faq_text: e.target.value })}
                          placeholder="Escreva perguntas e respostas que a IA deve utilizar (suporta formatação Markdown: # Título, **negrito**, listas, etc.)..."
                          className={`w-full p-3 rounded-xl text-xs font-mono border outline-none resize-none leading-relaxed ${
                            darkMode
                              ? 'bg-[#111b21] border-[#222e35] text-[#e9edef] focus:border-[#00a884]'
                              : 'bg-white border-gray-300 text-[#111b21] focus:border-[#00a884]'
                          }`}
                        />
                        <div className="flex items-center justify-between text-[10px] text-gray-400">
                          <span>Sincronizado na base de conhecimento oficial da empresa.</span>
                          <button
                            type="button"
                            onClick={handleSaveBrainConfig}
                            disabled={isSavingConfig}
                            className="px-3 py-1 rounded-lg bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Save className="w-3 h-3" />
                            <span>{isSavingConfig ? 'Salvando...' : 'Salvar Configurações'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-2 text-[10px] text-gray-400 flex items-center justify-between">
                      <span>Origem: <strong>Base Central da Empresa</strong></span>
                      <span>{brainConfig.faq_text?.length || 0} caracteres</span>
                    </div>
                  </div>
                )
              )}

              {filteredItems.length === 0 && !(activeCategory === 'faq' || (activeCategory === 'all' && Boolean(brainConfig.faq_text?.trim()))) ? (
                <div className="p-8 text-center text-xs text-gray-400 flex flex-col items-center justify-center space-y-2">
                  <Brain className="w-8 h-8 opacity-30" />
                  <p>Nenhuma instrução encontrada nesta categoria.</p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border flex flex-col items-start justify-between gap-3 transition-colors ${
                      darkMode
                        ? 'bg-[#111b21] border-[#222e35] hover:border-gray-600'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="space-y-2 flex-1 w-full min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          {getCategoryBadge(item.category)}
                          <span className="font-bold text-xs truncate max-w-xs sm:max-w-md">{item.title}</span>
                          {item.priority === 'restricao' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                              Crítica
                            </span>
                          )}
                        </div>

                        {/* Controles de Markdown e Ações da Instrução */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Botão de Alternar Prévia Markdown Formatada no Box */}
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewModeIds((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))
                            }
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 transition-all cursor-pointer ${
                              previewModeIds[item.id]
                                ? 'bg-[#00a884] text-white border-[#00a884] shadow-xs'
                                : darkMode
                                ? 'bg-[#202c33] border-gray-700 text-gray-300 hover:text-white hover:border-gray-500'
                                : 'bg-white border-gray-300 text-gray-600 hover:text-black hover:border-gray-400'
                            }`}
                            title="Alternar entre texto puro e visualização Markdown formatada"
                          >
                            <Eye className="w-2.5 h-2.5" />
                            <span>{previewModeIds[item.id] ? 'Formatado (MD)' : 'Ver MD'}</span>
                          </button>

                          {/* Botão de Expandir no Visualizador Markdown Completo */}
                          <button
                            type="button"
                            onClick={() =>
                              openMarkdownModal(
                                item.title,
                                item.content,
                                (newVal) => handleUpdateItemContent(item.id, newVal),
                                `Categoria: ${item.category} • Criada em: ${item.createdAt}`
                              )
                            }
                            className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                              darkMode
                                ? 'bg-[#202c33] border-gray-700 text-[#00a884] hover:bg-[#2a3942]'
                                : 'bg-white border-gray-300 text-[#00a884] hover:bg-emerald-50'
                            }`}
                            title="Abrir no Visualizador Markdown em tela cheia com edição e cópia"
                          >
                            <Maximize2 className="w-2.5 h-2.5" />
                            <span>Ampliar</span>
                          </button>

                          {/* Botão de Excluir */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 rounded-md text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Excluir instrução"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Exibição do Conteúdo: Formatado em Markdown ou Texto Puro */}
                      {previewModeIds[item.id] ? (
                        <div
                          className={`p-3 rounded-xl border text-xs leading-relaxed transition-all ${
                            darkMode
                              ? 'bg-black/30 border-[#00a884]/30 text-[#e9edef]'
                              : 'bg-emerald-50/50 border-[#00a884]/30 text-[#111b21]'
                          }`}
                        >
                          <div className="flex items-center gap-1 text-[10px] text-[#00a884] font-bold mb-1.5 pb-1 border-b border-[#00a884]/20">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>Visualização Markdown Formatada</span>
                          </div>
                          <MarkdownRenderer content={item.content} />
                        </div>
                      ) : (
                        <p className="text-xs text-gray-300 leading-relaxed font-mono text-[11px] bg-black/10 dark:bg-black/30 p-2.5 rounded-xl break-words whitespace-pre-wrap">
                          {item.content}
                        </p>
                      )}

                      <div className="text-[10px] text-gray-500 flex items-center justify-between">
                        <span>Adicionada em: {item.createdAt}</span>
                        <span className="text-gray-400">
                          {item.content.length} caracteres
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-gray-700/20 flex items-center justify-between text-xs">
              <span className="text-gray-400 text-[11px]">
                {knowledgeList.length} instruções ativas no Cérebro da IA.
              </span>
              <button
                type="button"
                onClick={handleSaveBrainConfig}
                disabled={isSavingConfig}
                className="px-4 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Tudo</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Comportamento & Automações da IA */}
        {activeTab === 'behavior' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar text-xs">
            {/* Header explicativo da aba */}
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-purple-300">
                  Comportamento Operacional & Automações em Tempo Real
                </h4>
                <p className="text-gray-300 leading-relaxed text-[11px]">
                  Controle a autonomia da IA, suporte a áudio, leitura de pagamentos PIX, agendamento de consultas e integração com canais.
                  Todas as alterações entram em vigor instantaneamente no atendimento.
                </p>
              </div>
            </div>

            {/* Grupo 1: Piloto Automático & Status Central */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#00a884]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">
                  Piloto Automático & Status Central
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Programar Mensagens (ocupa o espaco de Cerebro Ativo + Novos Leads) */}
                <div
                  className={`md:col-span-2 flex flex-col justify-between p-4 rounded-xl border transition-all ${
                    darkMode ? 'border-[#222e35] bg-[#111b21]' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#00a884]" />
                        <span>Programar mensagens</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        (Em breve)
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Envie templates da Meta de forma programada e automática, ou mensagens grátis na API padrão.
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-700/20 text-[11px]">
                    {channels.some((c) => c.apiType === 'meta_official' || c.provider === 'meta_official') ? (
                      <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>Canal Meta Oficial conectado detectado. A criação e visualização de templates estará disponível em breve com a nova sincronização de banco de dados.</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400 bg-black/20 p-2 rounded-lg border border-gray-700/30">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Em breve: Crie templates oficiais da Meta e agende campanhas ou disparos gratuitos na API padrão.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mesma IA em tudo (Omnichannel Total mais explicativo) */}
                <label
                  className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    brainConfig.omnichannel
                      ? 'border-[#00a884]/40 bg-[#00a884]/5'
                      : darkMode
                      ? 'border-[#222e35] bg-[#111b21]'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-purple-400" />
                      <span>Mesma IA em tudo</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={brainConfig.omnichannel}
                      onChange={(e) => setBrainConfig({ ...brainConfig, omnichannel: e.target.checked })}
                      className="w-4 h-4 accent-[#00a884]"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Sistema da IA em omnichannel (mesmo padrão de respostas em WhatsApp, Instagram, etc.)
                  </p>
                </label>
              </div>
            </div>

            {/* Grupo 2: Mídia, Áudio & Interações Humanizadas */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#00a884]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">
                  Mídia, Voz & Processamento Avançado
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label
                  className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    brainConfig.reply_audio
                      ? 'border-[#00a884]/40 bg-[#00a884]/5'
                      : darkMode
                      ? 'border-[#222e35] bg-[#111b21]'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-blue-400" />
                      <span>Transcrever e Responder Áudios</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={brainConfig.reply_audio}
                      onChange={(e) => setBrainConfig({ ...brainConfig, reply_audio: e.target.checked })}
                      className="w-4 h-4 accent-[#00a884]"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Transcreve notas de voz recebidas no WhatsApp e responde com agilidade mantendo o contexto.
                  </p>
                </label>

                {/* Enviar Imagens & Catálogos (Necessário Upgrade) */}
                <div
                  onClick={() =>
                    setUpgradeModal({
                      isOpen: true,
                      featureTitle: 'Enviar Imagens & Catálogos',
                      description:
                        'O envio automático de fotos de produtos, tabelas de planos e material de catálogo pela IA é exclusivo para planos avançados. Faça o upgrade para liberar esta funcionalidade.',
                    })
                  }
                  className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    darkMode ? 'border-[#222e35] bg-[#111b21]' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-gray-300">
                      <Camera className="w-4 h-4 text-teal-400" />
                      <span>Enviar Imagens & Catálogos</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5" />
                      Faça upgrade
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Permite que a IA envie fotos de produtos, tabelas de planos ou material explicativo.
                  </p>
                </div>

                {/* Atendimento para Chamadas (Necessário Upgrade) */}
                <div
                  onClick={() =>
                    setUpgradeModal({
                      isOpen: true,
                      featureTitle: 'Atendimento para Chamadas',
                      description:
                        'O atendimento automatizado e transbordo para chamadas de voz recebidas é exclusivo para planos avançados. Faça o upgrade para liberar esta funcionalidade.',
                    })
                  }
                  className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    darkMode ? 'border-[#222e35] bg-[#111b21]' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-gray-300">
                      <PhoneCall className="w-4 h-4 text-emerald-400" />
                      <span>Atendimento para Chamadas</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5" />
                      Faça upgrade
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Avisa e encaminha chamadas de voz recebidas diretamente para atendimento receptivo.
                  </p>
                </div>
              </div>
            </div>

            {/* Grupo 3: Operações Comerciais & Agenda (Desativados por padrão / Necessário Upgrade) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#00a884]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">
                  Operações Comerciais & Agenda
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  onClick={() =>
                    setUpgradeModal({
                      isOpen: true,
                      featureTitle: 'Reconhecer Pagamentos & Comprovantes PIX',
                      description:
                        'A leitura inteligente de comprovantes PIX em PDF/imagem com validação autônoma de valores é exclusiva para planos avançados. Faça o upgrade para liberar esta funcionalidade.',
                    })
                  }
                  className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    darkMode ? 'border-[#222e35] bg-[#111b21]' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-gray-300">
                      <CreditCard className="w-4 h-4 text-green-400" />
                      <span>Reconhecer Pagamentos & Comprovantes PIX</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5" />
                      Faça upgrade
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Identifica comprovantes enviados em PDF ou imagem, confere o valor e valida a transação automaticamente.
                  </p>
                </div>

                <div
                  onClick={() =>
                    setUpgradeModal({
                      isOpen: true,
                      featureTitle: 'Integração de Agenda & Horários',
                      description:
                        'A integração autônoma com Google Calendar e marcação de visitas/consultas na conversa é exclusiva para planos avançados. Faça o upgrade para liberar esta funcionalidade.',
                    })
                  }
                  className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    darkMode ? 'border-[#222e35] bg-[#111b21]' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-gray-300">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span>Integração de Agenda & Horários</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5" />
                      Faça upgrade
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Permite checar slots disponíveis no Google Calendar / Agenda e marcar consultas ou visitas direto na conversa.
                  </p>
                </div>
              </div>
            </div>

            {/* Grupo 4: Canais Especiais (Sem "& Coexistência") */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-500" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">
                  Canais Especiais
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Repostar marcações no stories do Instagram (Necessário Upgrade / Desativado por padrão) */}
                <div
                  onClick={() =>
                    setUpgradeModal({
                      isOpen: true,
                      featureTitle: 'Repostar marcações no stories do Instagram',
                      description:
                        'O monitoramento automático de menções e repostagem de stories de clientes no Instagram é exclusivo para planos avançados. Faça o upgrade para liberar esta funcionalidade.',
                    })
                  }
                  className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                    darkMode ? 'border-[#222e35] bg-[#111b21]' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-gray-300">
                      <Instagram className="w-4 h-4 text-pink-400" />
                      <span>Repostar marcações no stories do Instagram</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                      <Crown className="w-2.5 h-2.5" />
                      Faça upgrade
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Identifica quando um cliente marca o perfil da sua empresa nos stories e realiza o repost automático.
                  </p>
                </div>

                {/* Responder em grupos (Não disponível) */}
                <div
                  className={`flex flex-col justify-between p-3.5 rounded-xl border opacity-60 cursor-not-allowed ${
                    darkMode ? 'border-[#222e35] bg-[#111b21]' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs flex items-center gap-1.5 text-gray-400">
                      <MessageSquare className="w-4 h-4 text-gray-500" />
                      <span>Responder em grupos</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-700 text-gray-300 border border-gray-600">
                      não disponível
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Recurso não disponível. O atendimento da IA é focado em conversas individuais privadas para garantir o sigilo dos dados.
                  </p>
                </div>
              </div>
            </div>

            {/* NOVO Grupo: Notificação de Transbordo & Atendimento Humano */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">
                  Notificação de Transbordo & Atendimento Humano
                </h3>
              </div>

              <div
                className={`p-4 rounded-xl border space-y-4 transition-all ${
                  brainConfig.notify_human_handoff
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : darkMode
                    ? 'border-[#222e35] bg-[#111b21]'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <label className="flex items-start justify-between gap-3 cursor-pointer">
                  <div className="space-y-1">
                    <div className="font-bold text-xs flex items-center gap-2 text-[#e9edef]">
                      <span>Avisar quando cliente solicitar atendimento humano</span>
                      {brainConfig.notify_human_handoff && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Envia uma notificação imediata via WhatsApp ou SMS quando um cliente final pedir para falar com atendente humano ou quando a IA transferir a conversa.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={brainConfig.notify_human_handoff}
                    onChange={(e) =>
                      setBrainConfig({
                        ...brainConfig,
                        notify_human_handoff: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-amber-500 shrink-0 mt-0.5"
                  />
                </label>

                {brainConfig.notify_human_handoff && (
                  <div className="pt-3 border-t border-gray-700/30 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-300 mb-1">
                        Número para envio de notificação (WhatsApp com DDD):
                      </label>
                      <div className="relative">
                        <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-500" />
                        <input
                          type="text"
                          value={brainConfig.human_handoff_phone || ''}
                          onChange={(e) =>
                            setBrainConfig({
                              ...brainConfig,
                              human_handoff_phone: e.target.value,
                            })
                          }
                          placeholder="Ex: 5511999999999"
                          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-600 bg-black/40 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-400"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Digite somente números com o código do país e DDD (ex: 5511999999999).
                      </p>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-300 mb-1">
                        Modelo de aviso de transferência (opcional):
                      </label>
                      <input
                        type="text"
                        value={brainConfig.human_handoff_message || ''}
                        onChange={(e) =>
                          setBrainConfig({
                            ...brainConfig,
                            human_handoff_message: e.target.value,
                          })
                        }
                        placeholder="Solicitação de Atendimento humano: {cliente} solicitou atendimento..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-black/40 text-xs text-white placeholder-gray-500 outline-none focus:border-amber-400"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        Tags suportadas: <code className="text-amber-400">{'{cliente}'}</code>, <code className="text-amber-400">{'{telefone}'}</code>, <code className="text-amber-400">{'{canal}'}</code>.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Grupo 5: Capacidade de Atendentes Simultâneos */}
            <div className="p-4 rounded-xl border border-gray-700/30 bg-[#111b21] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#00a884]/20 text-[#00a884] shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs flex items-center gap-2">
                      <span>Capacidade de Atendentes Simultâneos</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00a884]/20 text-[#00a884]">
                        1 Atendente Ativo (Padrão)
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400">
                      Quantidade de usuários ou dispositivos que podem utilizar o ChatsApp simultaneamente nesta empresa. O plano padrão contempla 1 acesso simultâneo. Se houver mais de um dispositivo conectado, a plataforma fica limitada.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddSimultaneousUser(!showAddSimultaneousUser)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00a884]/20 hover:bg-[#00a884]/30 text-[#00a884] border border-[#00a884]/30 flex items-center gap-1.5 cursor-pointer self-start sm:self-center transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Adicionar Usuário Adicional</span>
                </button>
              </div>

              {/* Formulário de adicionar usuário adicional (solicita e-mail e avisa necessidade de upgrade) */}
              {showAddSimultaneousUser && (
                <div className="pt-3 border-t border-gray-700/30 space-y-2.5 animate-in fade-in">
                  <div className="text-[11px] font-bold text-gray-300">
                    Informe o e-mail do usuário adicional que terá acesso simultâneo:
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="email"
                      value={additionalUserEmail}
                      onChange={(e) => setAdditionalUserEmail(e.target.value)}
                      placeholder="atendente.adicional@empresa.com"
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-600 bg-black/40 text-xs text-white placeholder-gray-500 outline-none focus:border-[#00a884]"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        if (!additionalUserEmail.trim()) {
                          showToast('Por favor, informe o e-mail do usuário adicional.');
                          return;
                        }
                        setUpgradeModal({
                          isOpen: true,
                          featureTitle: 'Adicionar Atendente Simultâneo',
                          description: `É necessário fazer upgrade do plano da sua empresa para adicionar ${additionalUserEmail} e liberar acessos simultâneos em múltiplos dispositivos. O plano padrão contempla 1 usuário ativo por vez.`,
                        });
                      }}
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-[#00a884] hover:bg-[#02906f] text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Salvar Usuário Adicional</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-gray-400">
                    Nota: Essa configuração diz respeito ao acesso simultâneo à plataforma na mesma empresa, e não à transferência de atendimentos.
                  </p>
                </div>
              )}
            </div>

            {/* Salvar Botão */}
            <div className="pt-3 border-t border-gray-700/20 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">
                Os comportamentos e automações são sincronizados com a sua empresa.
              </span>

              <button
                type="button"
                onClick={handleSaveBrainConfig}
                disabled={isSavingConfig}
                className="px-5 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingConfig ? 'Salvando...' : 'Salvar Comportamentos & Automações'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Adicionar ou Editar Unidade / Filial */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-lg rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 ${
              darkMode ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-700/20 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {editingBranch ? 'Editar Unidade / Filial' : 'Nova Unidade / Filial'}
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Cadastre os dados locais e vincule ao canal correspondente
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBranchModalOpen(false);
                  setEditingBranch(null);
                }}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  darkMode ? 'text-gray-400 hover:text-white hover:bg-[#313d45]' : 'text-gray-500 hover:text-black hover:bg-gray-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-[#00a884]" />
                  <span>Nome ou Identificação da Unidade *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Matriz, Filial Centro, Unidade Zona Sul"
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    darkMode ? 'bg-[#111b21] border-[#313d45] text-white focus:border-[#00a884]' : 'bg-gray-50 border-gray-200 text-black focus:border-[#00a884]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#00a884]" />
                  <span>Endereço Completo</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Rua XYZ, 123 - Centro, Cidade - UF, CEP 00000-000"
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none ${
                    darkMode ? 'bg-[#111b21] border-[#313d45] text-white focus:border-[#00a884]' : 'bg-gray-50 border-gray-200 text-black focus:border-[#00a884]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-[#00a884]" />
                  <span>Telefone / WhatsApp Comercial (somente dígitos)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: 554788139420 (com DDI e DDD)"
                  value={branchForm.phone}
                  onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none ${
                    darkMode ? 'bg-[#111b21] border-[#313d45] text-white focus:border-[#00a884]' : 'bg-gray-50 border-gray-200 text-black focus:border-[#00a884]'
                  }`}
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Os números são normalizados automaticamente para salvar apenas dígitos.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5 text-[#00a884]" />
                  <span>Canal de Atendimento Vinculado (Opcional)</span>
                </label>
                <select
                  value={branchForm.channel_id || ''}
                  onChange={(e) => setBranchForm({ ...branchForm, channel_id: e.target.value || null })}
                  className={`w-full px-3 py-2 rounded-xl text-xs border outline-none cursor-pointer ${
                    darkMode ? 'bg-[#111b21] border-[#313d45] text-white' : 'bg-gray-50 border-gray-200 text-black'
                  }`}
                >
                  <option value="">Nenhum canal vinculado</option>
                  {channels
                    .filter((c) => !c.accountId || c.accountId === account?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type}) {c.identifier ? `• ${c.identifier}` : ''}
                      </option>
                    ))}
                </select>
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Apenas canais pertencentes a esta empresa são listados.
                </span>
              </div>

              {/* Identificador Único e Estável */}
              <div className="pt-2 flex items-center justify-between text-[11px] text-gray-400">
                <span>Identificador Único (Estável):</span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/30 border border-gray-700/40 text-gray-300">
                  {branchForm.unidade_id}
                </span>
              </div>

              <div className="pt-3 border-t border-gray-700/20 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsBranchModalOpen(false);
                    setEditingBranch(null);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                    darkMode ? 'border-gray-700 text-gray-300 hover:bg-[#313d45]' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#00a884] hover:bg-[#02906f] text-white shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editingBranch ? 'Atualizar Unidade' : 'Salvar Unidade'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Exclusão de Unidade com Canal Vinculado */}
      {branchDeleteConfirm.isOpen && branchDeleteConfirm.branch && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 ${
              darkMode ? 'bg-[#202c33] border-rose-500/40 text-[#e9edef]' : 'bg-white border-rose-200 text-[#111b21]'
            }`}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-rose-500/15 text-rose-500 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-rose-400 mb-1">
                  Excluir Unidade com Canal Vinculado?
                </h3>
                <p className={`text-xs leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  A unidade <strong>"{branchDeleteConfirm.branch.name}"</strong> está vinculada ao canal{' '}
                  <strong className="text-[#00a884]">{branchDeleteConfirm.linkedChannelName}</strong>.
                  <br />
                  <br />
                  Tem certeza que deseja remover esta unidade? O canal de atendimento{' '}
                  <strong>NÃO será excluído</strong>, mas o vínculo com esta unidade será desfeito.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-gray-700/20">
              <button
                type="button"
                onClick={() => setBranchDeleteConfirm({ isOpen: false, branch: null })}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                  darkMode ? 'border-gray-700 text-gray-300 hover:bg-[#313d45]' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => executeDeleteBranch(branchDeleteConfirm.branch!.unidade_id)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Informativo: É Necessário Upgrade */}
      {upgradeModal.isOpen && (
        <div className="fixed inset-0 z-70 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-5 animate-in zoom-in-95 ${
              darkMode ? 'bg-[#182229] border-amber-500/30 text-[#e9edef]' : 'bg-white border-amber-200 text-gray-900'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Plano Avançado
                  </span>
                  <h3 className="font-bold text-base text-white">É necessário upgrade</h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setUpgradeModal({ isOpen: false, featureTitle: '', description: '' })}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
              <div className="font-bold text-xs text-amber-300">
                {upgradeModal.featureTitle}
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {upgradeModal.description}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-gray-700/20">
              <button
                type="button"
                onClick={() => {
                  setUpgradeModal({ isOpen: false, featureTitle: '', description: '' });
                  showToast('Solicitação de upgrade enviada! Nossa equipe entrará em contato.');
                }}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-colors"
              >
                <Crown className="w-4 h-4" />
                <span>Fazer Upgrade do Plano</span>
              </button>

              <button
                type="button"
                onClick={() => setUpgradeModal({ isOpen: false, featureTitle: '', description: '' })}
                className={`w-full sm:w-auto py-2.5 px-4 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
                  darkMode ? 'border-gray-700 text-gray-300 hover:bg-[#313d45]' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visualizador & Editor Modal de Markdown Dedicado */}
      <MarkdownViewerModal
        isOpen={markdownModal.isOpen}
        onClose={() => setMarkdownModal((prev) => ({ ...prev, isOpen: false }))}
        title={markdownModal.title}
        subtitle={markdownModal.subtitle}
        initialContent={markdownModal.content}
        onSave={markdownModal.onSave}
        darkMode={darkMode}
        readOnly={markdownModal.readOnly}
      />
    </div>
  );
};
