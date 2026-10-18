import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Store,
  BarChart3,
  CreditCard,
  Receipt,
  PlusCircle,
  Activity,
  Bot,
  User,
  Users,
  MessageSquare,
  Radio,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Account } from '../types';
import { supabase, isSupabaseConfigured, ensureSupabaseConfig } from '../lib/supabase';

interface ToolsViewProps {
  darkMode: boolean;
  onBackToChats: () => void;
  currentAccount?: Account | null;
  onOpenChannels?: () => void;
  onOpenProfile?: () => void;
}

type ToolsSection = 'overview' | 'reports' | 'subscription' | 'billing' | 'addons';

interface UsageMetrics {
  totalMessages: number;
  aiMessages: number;
  agentMessages: number;
  customerMessages: number;
  totalConversations: number;
  totalChannels: number;
  activeChannels: number;
  extraUsersCount: number;
  accountPlan: string;
  accountCreatedAt?: string;
  isLoading: boolean;
  error?: string | null;
}

export const ToolsView: React.FC<ToolsViewProps> = ({
  darkMode,
  onBackToChats,
  currentAccount,
  onOpenChannels,
  onOpenProfile,
}) => {
  const [activeSection, setActiveSection] = useState<ToolsSection>('overview');
  const [metrics, setMetrics] = useState<UsageMetrics>({
    totalMessages: 0,
    aiMessages: 0,
    agentMessages: 0,
    customerMessages: 0,
    totalConversations: 0,
    totalChannels: 0,
    activeChannels: 0,
    extraUsersCount: 0,
    accountPlan: currentAccount?.plan || 'pro',
    accountCreatedAt: currentAccount?.createdAt,
    isLoading: true,
    error: null,
  });

  const loadRealMetrics = async () => {
    if (!currentAccount?.id) {
      setMetrics((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    setMetrics((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await ensureSupabaseConfig();

      let totalMsgs = 0;
      let aiMsgs = 0;
      let agentMsgs = 0;
      let customerMsgs = 0;
      let totalConvs = 0;
      let totalChs = 0;
      let activeChs = 0;
      let extraUsers = 0;
      let planName = currentAccount.plan || 'pro';
      let createdAt = currentAccount.createdAt;

      // 1. Consulta Direta ao Supabase
      if (isSupabaseConfigured) {
        // Consultar contagem exata de mensagens
        const { count: msgsCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', currentAccount.id);
        totalMsgs = msgsCount || 0;

        // Mensagens IA
        const { count: aiCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', currentAccount.id)
          .in('sender_type', ['ai', 'bot']);
        aiMsgs = aiCount || 0;

        // Mensagens de Atendentes
        const { count: agentCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', currentAccount.id)
          .in('sender_type', ['agent', 'coexistence_mobile']);
        agentMsgs = agentCount || 0;

        // Mensagens de Clientes
        const { count: customerCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', currentAccount.id)
          .in('sender_type', ['contact', 'customer']);
        customerMsgs = customerCount || 0;

        // Total de conversas
        const { count: convsCount } = await supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('account_id', currentAccount.id);
        totalConvs = convsCount || 0;

        // Canais
        const { data: channelsData } = await supabase
          .from('channels')
          .select('id, is_active')
          .eq('account_id', currentAccount.id);
        if (channelsData) {
          totalChs = channelsData.length;
          activeChs = channelsData.filter((c) => c.is_active !== false).length;
        }

        // Cérebro IA (licenças extras)
        const { data: cerebroData } = await supabase
          .from('cerebro_ia')
          .select('extra_users_count')
          .eq('account_id', currentAccount.id)
          .maybeSingle();
        if (cerebroData?.extra_users_count !== undefined) {
          extraUsers = cerebroData.extra_users_count;
        }

        // Dados da conta
        const { data: accData } = await supabase
          .from('accounts')
          .select('plan, created_at')
          .eq('id', currentAccount.id)
          .maybeSingle();
        if (accData) {
          if (accData.plan) planName = accData.plan;
          if (accData.created_at) createdAt = accData.created_at;
        }
      }

      // 2. Fallback de API se direct supabase não tiver retornado
      if (totalMsgs === 0 && totalChs === 0) {
        try {
          const res = await fetch(`/api/tools/overview?account_id=${currentAccount.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.metrics) {
              totalMsgs = data.metrics.totalMessages ?? totalMsgs;
              aiMsgs = data.metrics.aiMessages ?? aiMsgs;
              agentMsgs = data.metrics.agentMessages ?? agentMsgs;
              customerMsgs = data.metrics.customerMessages ?? customerMsgs;
              totalConvs = data.metrics.totalConversations ?? totalConvs;
              totalChs = data.metrics.totalChannels ?? totalChs;
              activeChs = data.metrics.activeChannels ?? activeChs;
              extraUsers = data.metrics.extraUsersCount ?? extraUsers;
              planName = data.metrics.plan || planName;
              createdAt = data.metrics.createdAt || createdAt;
            }
          }
        } catch {
          // Keep supabase data
        }
      }

      setMetrics({
        totalMessages: totalMsgs,
        aiMessages: aiMsgs,
        agentMessages: agentMsgs,
        customerMessages: customerMsgs,
        totalConversations: totalConvs,
        totalChannels: totalChs,
        activeChannels: activeChs,
        extraUsersCount: extraUsers,
        accountPlan: planName,
        accountCreatedAt: createdAt,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      console.warn('Erro ao carregar métricas de consumo:', err);
      setMetrics((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Não foi possível carregar algumas métricas no momento.',
      }));
    }
  };

  useEffect(() => {
    loadRealMetrics();
  }, [currentAccount?.id]);

  // Formatar data de criação
  const formattedCreationDate = metrics.accountCreatedAt
    ? new Date(metrics.accountCreatedAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Data não informada';

  // Seções da interface
  const navItems = [
    { id: 'overview' as ToolsSection, label: 'Visão Geral', icon: Activity },
    { id: 'reports' as ToolsSection, label: 'Relatórios', icon: BarChart3 },
    { id: 'subscription' as ToolsSection, label: 'Minha Assinatura', icon: CreditCard },
    { id: 'billing' as ToolsSection, label: 'Faturamento', icon: Receipt },
    { id: 'addons' as ToolsSection, label: 'Adicionais', icon: PlusCircle },
  ];

  return (
    <div
      className={`h-full flex flex-col overflow-hidden select-none transition-colors ${
        darkMode ? 'bg-[#111b21] text-[#e9edef]' : 'bg-[#f0f2f5] text-[#111b21]'
      }`}
    >
      {/* Top Header */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${
          darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-[#ffffff] border-[#e9edef]'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToChats}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-gray-200 text-[#54656f]'
            }`}
            title="Voltar para Conversas"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-[#00a884]" />
              <h1 className={`font-bold text-base ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                Ferramentas
              </h1>
            </div>
            <p className="text-[11px] text-[#8696a0]">
              Visão geral de consumo, relatórios e gestão de plano de {currentAccount?.name || 'sua empresa'}
            </p>
          </div>
        </div>

        <button
          onClick={loadRealMetrics}
          disabled={metrics.isLoading}
          className={`p-2 rounded-full transition-colors cursor-pointer ${
            darkMode ? 'hover:bg-[#374248] text-[#8696a0]' : 'hover:bg-gray-200 text-[#54656f]'
          } ${metrics.isLoading ? 'animate-spin' : ''}`}
          title="Atualizar dados reais"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Sub-navigation tabs */}
      <div
        className={`px-3 pt-2 border-b flex gap-1 overflow-x-auto no-scrollbar shrink-0 ${
          darkMode ? 'bg-[#182229] border-[#222e35]' : 'bg-[#ffffff] border-[#e9edef]'
        }`}
      >
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? darkMode
                    ? 'border-[#00a884] text-[#00a884] bg-[#202c33]'
                    : 'border-[#00a884] text-[#00a884] bg-[#f0f2f5]'
                  : darkMode
                  ? 'border-transparent text-[#8696a0] hover:text-[#d1d7db]'
                  : 'border-transparent text-[#54656f] hover:text-[#111b21]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
        {/* Banner de Isolamento Multi-empresa */}
        <div
          className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
            darkMode ? 'bg-[#202c33]/80 border-[#2f3b43] text-[#aebac1]' : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-[#00a884]">Ambiente Isolado por Empresa:</span>{' '}
            <span>
              Todos os dados e métricas apresentados são estritamente auditados e vinculados à empresa{' '}
              <strong className="text-white font-semibold">{currentAccount?.name}</strong>.
            </span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* SEÇÃO 1: VISÃO GERAL DE CONSUMO                                     */}
        {/* =================================================================== */}
        {activeSection === 'overview' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Cards de Métricas Reais */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Total de Mensagens */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
                }`}
              >
                <div className="flex items-center justify-between text-[#8696a0] mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Total Mensagens</span>
                  <MessageSquare className="w-4 h-4 text-[#00a884]" />
                </div>
                <div className="text-2xl font-bold">{metrics.totalMessages}</div>
                <span className="text-[10px] text-[#8696a0] mt-1">Registradas no banco</span>
              </div>

              {/* Mensagens IA */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
                }`}
              >
                <div className="flex items-center justify-between text-[#8696a0] mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Respostas da IA</span>
                  <Bot className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-purple-400">{metrics.aiMessages}</div>
                <span className="text-[10px] text-[#8696a0] mt-1">Atendimentos autônomos</span>
              </div>

              {/* Mensagens Atendentes Humanos */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
                }`}
              >
                <div className="flex items-center justify-between text-[#8696a0] mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Atendentes Humanos</span>
                  <User className="w-4 h-4 text-[#53bdeb]" />
                </div>
                <div className="text-2xl font-bold text-[#53bdeb]">{metrics.agentMessages}</div>
                <span className="text-[10px] text-[#8696a0] mt-1">Intervenções manuais</span>
              </div>

              {/* Canais Conectados */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
                }`}
              >
                <div className="flex items-center justify-between text-[#8696a0] mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Canais Conectados</span>
                  <Radio className="w-4 h-4 text-[#25d366]" />
                </div>
                <div className="text-2xl font-bold text-[#25d366]">
                  {metrics.activeChannels}
                  <span className="text-xs font-normal text-[#8696a0] ml-1">/ {metrics.totalChannels}</span>
                </div>
                <span className="text-[10px] text-[#8696a0] mt-1">Instâncias ativas</span>
              </div>

              {/* Total Conversas */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
                }`}
              >
                <div className="flex items-center justify-between text-[#8696a0] mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Conversas</span>
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold">{metrics.totalConversations}</div>
                <span className="text-[10px] text-[#8696a0] mt-1">Clientes cadastrados</span>
              </div>

              {/* Mensagens de Clientes */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                  darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
                }`}
              >
                <div className="flex items-center justify-between text-[#8696a0] mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">Clientes (Inbound)</span>
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-400">{metrics.customerMessages}</div>
                <span className="text-[10px] text-[#8696a0] mt-1">Mensagens recebidas</span>
              </div>
            </div>

            {/* Explicação da Franquia Comercial do ChatsApp */}
            <div
              className={`p-4 rounded-xl border ${
                darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-[#00a884]" />
                <h3 className="font-bold text-sm">Política de Franquia Comercial & Mensagens</h3>
              </div>
              <p className="text-xs text-[#8696a0] leading-relaxed">
                As franquias de mensagens (ex: 500 mensagens de IA) e limites de canais são regras do{' '}
                <strong className="text-white">ChatsApp Web AI</strong> com base no plano selecionado. Não representam
                alegações enganosas da Meta. O processamento de IA e canais não-oficiais não incorrem em taxas por
                conversa da Meta.
              </p>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SEÇÃO 2: RELATÓRIOS                                                 */}
        {/* =================================================================== */}
        {activeSection === 'reports' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Distribuição Real de Mensagens */}
            <div
              className={`p-4 rounded-xl border ${
                darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
              }`}
            >
              <h3 className="font-bold text-sm mb-3">Distribuição Real de Mensagens por Remetente</h3>
              {metrics.totalMessages === 0 ? (
                <p className="text-xs text-[#8696a0]">Nenhuma mensagem registrada ainda para gerar a distribuição.</p>
              ) : (
                <div className="space-y-3">
                  {/* Barra consolidada */}
                  <div className="h-3 rounded-full overflow-hidden flex bg-black/30">
                    <div
                      style={{
                        width: `${Math.round((metrics.aiMessages / metrics.totalMessages) * 100)}%`,
                      }}
                      className="bg-purple-500 h-full transition-all"
                      title={`IA: ${metrics.aiMessages}`}
                    />
                    <div
                      style={{
                        width: `${Math.round((metrics.agentMessages / metrics.totalMessages) * 100)}%`,
                      }}
                      className="bg-[#53bdeb] h-full transition-all"
                      title={`Atendentes: ${metrics.agentMessages}`}
                    />
                    <div
                      style={{
                        width: `${Math.round((metrics.customerMessages / metrics.totalMessages) * 100)}%`,
                      }}
                      className="bg-amber-500 h-full transition-all"
                      title={`Clientes: ${metrics.customerMessages}`}
                    />
                  </div>

                  {/* Legenda com percentuais calculados reais */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
                      <span>
                        IA:{' '}
                        <strong>
                          {metrics.aiMessages} ({Math.round((metrics.aiMessages / metrics.totalMessages) * 100)}%)
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#53bdeb] shrink-0" />
                      <span>
                        Atendentes:{' '}
                        <strong>
                          {metrics.agentMessages} ({Math.round((metrics.agentMessages / metrics.totalMessages) * 100)}%)
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                      <span>
                        Clientes:{' '}
                        <strong>
                          {metrics.customerMessages} (
                          {Math.round((metrics.customerMessages / metrics.totalMessages) * 100)}%)
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Módulos Analíticos Futuros */}
            <div
              className={`p-4 rounded-xl border border-dashed ${
                darkMode ? 'bg-[#202c33]/50 border-[#2f3b43]' : 'bg-white/50 border-[#e9edef]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#8696a0]" />
                  <h4 className="font-bold text-xs">Relatórios Analíticos Avançados & Exportação CSV</h4>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#374248] text-[#8696a0]">
                  Em breve
                </span>
              </div>
              <p className="text-xs text-[#8696a0] leading-relaxed">
                Em implantação: tempo médio de resposta (TMR), taxa de resolução automática por IA, exportação de conversas
                com filtros por tags e período.
              </p>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SEÇÃO 3: MINHA ASSINATURA                                           */}
        {/* =================================================================== */}
        {activeSection === 'subscription' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Card do Plano Atual */}
            <div
              className={`p-5 rounded-2xl border relative overflow-hidden ${
                darkMode
                  ? 'bg-gradient-to-br from-[#202c33] to-[#182229] border-[#00a884]/40'
                  : 'bg-gradient-to-br from-white to-gray-50 border-[#00a884]/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30 inline-block mb-1.5">
                    Plano Ativo
                  </span>
                  <h3 className="text-xl font-bold">Plano {metrics.accountPlan.toUpperCase()}</h3>
                  <p className="text-xs text-[#8696a0]">Empresa: {currentAccount?.name}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Regular</span>
                </span>
              </div>

              {/* Detalhes da conta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-3 border-t border-gray-700/30">
                <div>
                  <span className="text-[#8696a0] block">Início da Conta:</span>
                  <span className="font-semibold">{formattedCreationDate}</span>
                </div>
                <div>
                  <span className="text-[#8696a0] block">Canais Vinculados:</span>
                  <span className="font-semibold">
                    {metrics.activeChannels} de {metrics.totalChannels} ativos
                  </span>
                </div>
              </div>
            </div>

            {/* Estrutura Preparada para Período de Avaliação (7 dias) e Franquias */}
            <div
              className={`p-4 rounded-xl border ${
                darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#00a884]" />
                  <h4 className="font-bold text-xs">Estrutura de Avaliação & Planos Futuros</h4>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#374248] text-[#8696a0]">
                  Preparado
                </span>
              </div>
              <ul className="text-xs text-[#8696a0] space-y-1.5 list-disc list-inside">
                <li>Período de avaliação de 7 dias para novas contas</li>
                <li>Limite de 1 canal conectado durante o trial</li>
                <li>Franquia comercial de 500 mensagens de IA</li>
                <li>Sem bloqueios automáticos ou cobranças nesta versão</li>
              </ul>
            </div>

            {/* Upgrade de Plano */}
            <div
              className={`p-4 rounded-xl border border-dashed flex items-center justify-between gap-3 ${
                darkMode ? 'bg-[#202c33]/40 border-[#2f3b43]' : 'bg-white/40 border-[#e9edef]'
              }`}
            >
              <div>
                <h4 className="font-bold text-xs mb-0.5">Deseja alterar limites ou fazer upgrade?</h4>
                <p className="text-[11px] text-[#8696a0]">
                  Contate o suporte comercial para ajustes de plano e capacidade da sua empresa.
                </p>
              </div>
              <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#374248] text-[#8696a0] shrink-0">
                Em breve
              </span>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SEÇÃO 4: FATURAMENTO                                                */}
        {/* =================================================================== */}
        {activeSection === 'billing' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Dados Cadastrais Reais */}
            <div
              className={`p-4 rounded-xl border ${
                darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
              }`}
            >
              <h3 className="font-bold text-sm mb-3">Dados Cadastrais da Empresa</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#8696a0] block">Razão / Nome:</span>
                  <span className="font-semibold text-white">{currentAccount?.name || 'Não informado'}</span>
                </div>
                <div>
                  <span className="text-[#8696a0] block">Segmento:</span>
                  <span className="font-semibold">{currentAccount?.segment || 'Geral'}</span>
                </div>
                <div>
                  <span className="text-[#8696a0] block">Telefone Oficial:</span>
                  <span className="font-semibold font-mono">{currentAccount?.whatsappPhone || 'Não configurado'}</span>
                </div>
                <div>
                  <span className="text-[#8696a0] block">ID da Conta (UUID):</span>
                  <span className="font-mono text-[11px] text-[#8696a0] truncate block">
                    {currentAccount?.id}
                  </span>
                </div>
              </div>
            </div>

            {/* Histórico de Faturas */}
            <div
              className={`p-4 rounded-xl border ${
                darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm">Histórico de Faturas & Recibos</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#374248] text-[#8696a0]">
                  Em breve
                </span>
              </div>
              <p className="text-xs text-[#8696a0] leading-relaxed">
                Nenhum gateway de pagamento ou cobrança automática está ativo nesta etapa. O módulo de faturamento fiscal
                e boletos/PIX automáticos será integrado futuramente sem impacto nos usuários atuais.
              </p>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* SEÇÃO 5: ADICIONAIS                                                 */}
        {/* =================================================================== */}
        {activeSection === 'addons' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Canais Extras */}
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#00a884]" />
                  <h4 className="font-bold text-xs">Canais & Instâncias Adicionais</h4>
                </div>
                <p className="text-xs text-[#8696a0]">
                  Atualmente sua empresa possui <strong>{metrics.totalChannels}</strong> canais cadastrados.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenChannels}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00a884] hover:bg-[#02906f] text-white shrink-0 cursor-pointer"
              >
                Gerenciar Conexões
              </button>
            </div>

            {/* Atendentes Extras */}
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                darkMode ? 'bg-[#202c33] border-[#2f3b43]' : 'bg-white border-[#e9edef]'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#53bdeb]" />
                  <h4 className="font-bold text-xs">Licenças de Atendentes Adicionais</h4>
                </div>
                <p className="text-xs text-[#8696a0]">
                  Atendentes extras configurados no cérebro: <strong>{metrics.extraUsersCount}</strong> licenças.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#374248] text-[#8696a0] shrink-0">
                Em breve
              </span>
            </div>

            {/* Franquia Adicional de IA */}
            <div
              className={`p-4 rounded-xl border border-dashed flex items-start justify-between gap-3 ${
                darkMode ? 'bg-[#202c33]/40 border-[#2f3b43]' : 'bg-white/40 border-[#e9edef]'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-400" />
                  <h4 className="font-bold text-xs">Pacotes Adicionais de Mensagens IA</h4>
                </div>
                <p className="text-xs text-[#8696a0]">
                  Ampliação de capacidade de atendimento autônomo com pacotes sob demanda.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#374248] text-[#8696a0] shrink-0">
                Em breve
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
