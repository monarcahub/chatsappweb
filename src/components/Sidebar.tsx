import React, { useState, useRef } from 'react';
import { 
  Search, 
  Pin, 
  BellOff, 
  Bell,
  MessageSquare, 
  Instagram, 
  Globe, 
  Sun, 
  Moon, 
  Plus, 
  CheckCheck, 
  Camera, 
  ChevronDown, 
  MoreVertical, 
  X,
  UserCheck,
  Bot,
  Building2,
  Check,
  LogOut,
  ShieldCheck,
  Mic,
  Archive,
  ArchiveRestore,
  FolderArchive,
  ArrowLeft
} from 'lucide-react';
import { Conversation, ChannelType, ConversationStatus, Account } from '../types';
import { formatSaoPauloDate, formatAudioDuration } from '../utils/dateFormat';
import { TopMoreMenuDropdown } from './TopMoreMenuDropdown';
import { ConversationContextMenu } from './ConversationContextMenu';
import {
  requestBrowserNotificationPermission,
  playIncomingNotificationSound,
  getBrowserNotificationPermission,
} from '../utils/notifications';

interface SidebarProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelectConversation: (id: string) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  selectedFilter: 'all' | 'unread' | 'favorites' | 'groups';
  onFilterChange: (filter: 'all' | 'unread' | 'favorites' | 'groups') => void;
  selectedChannel: 'all' | ChannelType;
  onChannelChange: (channel: 'all' | ChannelType) => void;
  isMobileMode: boolean;
  onToggleMobileMode: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenArchitectureModal: () => void;
  onOpenNewChatModal: () => void;
  isConnectedToSupabase?: boolean;
  realtimeLatencyMs?: number | null;
  currentAccount?: Account | null;
  availableAccounts?: Account[];
  onSwitchAccount?: (id: string) => void;
  onLogout?: () => void;
  onOpenSettings?: () => void;
  onOpenProfile?: () => void;
  onOpenCRM?: () => void;
  onMarkAllAsRead?: () => void;
  onLockApp?: () => void;
  isSettingsOpen?: boolean;
  onDeleteConversation?: (id: string) => void;
  onClearMessages?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onToggleArchive?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onToggleMute?: (id: string, duration?: string) => void;
  onToggleMarkUnread?: (id: string) => void;
  onUpdateContact?: (id: string, data: { name: string; phone?: string }) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  selectedId,
  onSelectConversation,
  searchTerm,
  onSearchChange,
  selectedFilter,
  onFilterChange,
  selectedChannel,
  onChannelChange,
  darkMode,
  onToggleDarkMode,
  onOpenArchitectureModal,
  onOpenNewChatModal,
  isConnectedToSupabase = false,
  realtimeLatencyMs = null,
  currentAccount,
  availableAccounts = [],
  onSwitchAccount,
  onLogout,
  onOpenSettings,
  onOpenProfile,
  onOpenCRM,
  onMarkAllAsRead,
  onLockApp,
  isSettingsOpen = false,
  onDeleteConversation,
  onClearMessages,
  onToggleFavorite,
  onToggleArchive,
  onTogglePin,
  onToggleMute,
  onToggleMarkUnread,
  onUpdateContact,
}) => {
  const [isViewingArchived, setIsViewingArchived] = useState(false);
  const [showNotificationBanner, setShowNotificationBanner] = useState(() => {
    if (typeof window === 'undefined') return false;
    const dismissed = localStorage.getItem('chatsapp_banner_dismissed') === 'true';
    if (dismissed) return false;
    const permission = getBrowserNotificationPermission();
    return permission !== 'granted';
  });

  const handleEnableDesktopNotifications = async () => {
    const permission = await requestBrowserNotificationPermission();
    playIncomingNotificationSound();
    setShowNotificationBanner(false);
    try {
      localStorage.setItem('chatsapp_banner_dismissed', 'true');
    } catch {}

    if (permission === 'granted') {
      showToast('Notificações ativadas na área de trabalho e no aplicativo!');
    } else {
      showToast('Notificações ativadas no aplicativo (som e avisos visuais)!');
    }
  };

  const handleDismissNotificationBanner = () => {
    setShowNotificationBanner(false);
    try {
      localStorage.setItem('chatsapp_banner_dismissed', 'true');
    } catch {}
  };

  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);
  const [contextMenu, setContextMenu] = useState<{
    conversation: Conversation;
    position: { x: number; y: number };
  } | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Separação de conversas arquivadas vs ativas
  const archivedConversations = conversations.filter((c) => c.isArchived);
  const activeConversations = conversations.filter((c) => !c.isArchived);
  const archivedCount = archivedConversations.length;
  const archivedUnreadCount = archivedConversations.reduce((acc, c) => acc + c.unreadCount, 0);

  // Lista base a ser filtrada
  const baseConversations = isViewingArchived ? archivedConversations : activeConversations;

  // Counters for filter chips (apenas conversas ativas normais)
  const totalUnread = activeConversations.reduce((acc, c) => acc + c.unreadCount, 0);

  // Filter conversations
  const filteredConversations = baseConversations.filter((conv) => {
    if (!isViewingArchived) {
      // Channel filter
      if (selectedChannel !== 'all' && conv.contact.channel !== selectedChannel) {
        return false;
      }

      // Status / Category filter
      if (selectedFilter === 'unread' && conv.unreadCount === 0) return false;
      if (selectedFilter === 'favorites' && !conv.isFavorite) return false;
      if (selectedFilter === 'groups' && !conv.isGroup) return false;
    }

    // Search query filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = conv.contact.name.toLowerCase().includes(term);
      const matchPhone = conv.contact.phone?.toLowerCase().includes(term);
      const matchMessage = conv.lastMessage.text.toLowerCase().includes(term);
      const matchTags = (conv.contact.tags || []).some((t) => t.name.toLowerCase().includes(term));
      return matchName || matchPhone || matchMessage || matchTags;
    }

    return true;
  });

  // Ordena conversas: fixadas (isPinned) sempre no topo, como no WhatsApp Web
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  const renderChannelBadge = (channel: ChannelType) => {
    switch (channel) {
      case 'instagram':
        return (
          <div className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 text-white shadow-sm ring-1 ring-[#111b21]">
            <Instagram className="w-2.5 h-2.5" />
          </div>
        );
      case 'webchat':
        return (
          <div className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-[#00a884] text-white shadow-sm ring-1 ring-[#111b21]">
            <Globe className="w-2.5 h-2.5" />
          </div>
        );
      case 'whatsapp':
      default:
        return (
          <div className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-[#25d366] text-white shadow-sm ring-1 ring-[#111b21]">
            <MessageSquare className="w-2.5 h-2.5" />
          </div>
        );
    }
  };

  const renderStatusPill = (status?: ConversationStatus) => {
    switch (status) {
      case 'human':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Humano</span>
          </span>
        );
      case 'closed':
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-gray-700/40 text-gray-400 border border-gray-600 flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            <span>Fechada</span>
          </span>
        );
      case 'ai':
      default:
        return (
          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-950/60 text-[#34d399] border border-[#34d399]/30 flex items-center gap-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
            <span>IA</span>
          </span>
        );
    }
  };

  return (
    <div
      className={`flex flex-col h-full select-none border-r transition-colors duration-150 ${
        darkMode ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
      }`}
    >
      {/* Sidebar Header (Matches WhatsApp Web screenshot) */}
      <div
        className={`px-4 py-2.5 flex items-center justify-between border-b ${
          darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-[#f0f2f5] border-[#e9edef]'
        }`}
      >
        {isViewingArchived ? (
          <div className="flex items-center gap-3">
            <button
              id="btn-back-from-archived"
              onClick={() => setIsViewingArchived(false)}
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
              }`}
              title="Voltar para todas as conversas"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className={`font-bold text-base ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                Arquivadas
              </h1>
              <span className="text-[11px] text-[#00a884] font-medium">
                {archivedCount} {archivedCount === 1 ? 'conversa arquivada' : 'conversas arquivadas'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 relative">
            <h1 className={`font-bold text-lg tracking-tight ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
              ChatsApp
            </h1>

            {/* Tenant / Company Switcher Pill */}
            {currentAccount && (
              <div className="relative">
                <button
                  id="btn-switch-tenant"
                  onClick={() => {
                    if (availableAccounts.length > 1) {
                      setIsAccountDropdownOpen(!isAccountDropdownOpen);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                    isAccountDropdownOpen
                      ? 'bg-[#00a884] text-white border-[#00a884]'
                      : darkMode
                      ? 'bg-[#111b21] hover:bg-[#2a3942] text-[#00a884] border-[#00a884]/40'
                      : 'bg-white hover:bg-gray-100 text-[#00a884] border-[#00a884]/40 shadow-xs'
                  }`}
                  title={`Empresa: ${currentAccount.name}`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="max-w-[110px] truncate">{currentAccount.name}</span>
                  {availableAccounts.length > 1 && (
                    <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
                  )}
                </button>

              {/* Dropdown Menu de Empresas */}
              {isAccountDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsAccountDropdownOpen(false)}
                  />
                  <div
                    className={`absolute left-0 top-full mt-2 w-72 rounded-2xl shadow-2xl border p-2 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                      darkMode ? 'bg-[#202c33] border-[#313d45] text-[#e9edef]' : 'bg-white border-[#d1d7db] text-[#111b21]'
                    }`}
                  >
                    <div className="px-3 py-2 border-b border-[#313d45]/40 mb-1.5 flex items-center justify-between">
                      <span className="text-[11px] uppercase font-bold text-[#8696a0] tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#00a884]" />
                        Isolamento Multi-Tenant
                      </span>
                      <span className="text-[10px] text-[#00a884] font-medium bg-[#00a884]/15 px-1.5 py-0.5 rounded">
                        RLS Ativo
                      </span>
                    </div>

                    <div className="space-y-1">
                      {availableAccounts.map((acc) => {
                        const isCurrent = acc.id === currentAccount.id;
                        return (
                          <div
                            key={acc.id}
                            onClick={() => {
                              if (onSwitchAccount) onSwitchAccount(acc.id);
                              setIsAccountDropdownOpen(false);
                            }}
                            className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                              isCurrent
                                ? 'bg-[#00a884]/15 text-[#00a884] font-semibold border border-[#00a884]/30'
                                : darkMode
                                ? 'hover:bg-[#111b21] text-[#d1d7db]'
                                : 'hover:bg-gray-100 text-[#111b21]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  isCurrent
                                    ? 'bg-[#00a884] text-white'
                                    : darkMode
                                    ? 'bg-[#2a3942] text-[#8696a0]'
                                    : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                <Building2 className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate leading-tight">
                                  {acc.name}
                                </p>
                                <p className="text-[10px] text-[#8696a0] truncate">
                                  {acc.segment}
                                </p>
                              </div>
                            </div>

                            {isCurrent && (
                              <Check className="w-4 h-4 text-[#00a884] shrink-0 ml-1.5" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {onLogout && (
                      <div className="pt-1.5 mt-1.5 border-t border-[#313d45]/50">
                        <button
                          onClick={() => {
                            setIsAccountDropdownOpen(false);
                            onLogout();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Desconectar desta empresa</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        )}

        {/* Right Header Action Icons */}
        <div className="flex items-center gap-1">
          {/* New Chat Button */}
          <button
            id="btn-open-new-chat-modal"
            onClick={onOpenNewChatModal}
            className={`p-2 rounded-full transition-colors ${
              darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
            title="Nova Conversa"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* Theme Toggle Button */}
          <button
            id="btn-toggle-theme"
            onClick={onToggleDarkMode}
            className={`p-2 rounded-full transition-colors ${
              darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
            title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* More options menu (Atalhos e Configurações) */}
          <div className="relative">
            <button
              ref={moreButtonRef}
              id="btn-top-more-options"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className={`p-2 rounded-full transition-colors ${
                isMoreMenuOpen
                  ? darkMode
                    ? 'bg-[#374248] text-[#e9edef]'
                    : 'bg-[#d1d7db] text-[#111b21]'
                  : darkMode
                  ? 'hover:bg-[#374248] text-[#aebac1]'
                  : 'hover:bg-[#e9edef] text-[#54656f]'
              }`}
              title={isMoreMenuOpen ? 'Fechar menu de opções' : 'Mais opções e configurações'}
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Dropdown Menu matching WhatsApp Web with icons and solution shortcuts */}
            <TopMoreMenuDropdown
              isOpen={isMoreMenuOpen}
              onClose={() => setIsMoreMenuOpen(false)}
              triggerRef={moreButtonRef}
              isSettingsOpen={isSettingsOpen}
              darkMode={darkMode}
              onOpenSettings={() => {
                if (onOpenSettings) onOpenSettings();
              }}
              onOpenProfile={() => {
                if (onOpenProfile) onOpenProfile();
              }}
              onOpenCRM={onOpenCRM}
              onMarkAllAsRead={() => {
                if (onMarkAllAsRead) onMarkAllAsRead();
                setToastMessage('Todas as conversas foram marcadas como lidas');
                setTimeout(() => setToastMessage(null), 3000);
              }}
              onLockApp={() => {
                if (onLockApp) onLockApp();
              }}
              onLogout={onLogout}
              currentAccountName={currentAccount?.name}
              onOpenTenants={
                availableAccounts && availableAccounts.length > 0
                  ? () => setIsAccountDropdownOpen(true)
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* Floating toast notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#00a884] text-white text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCheck className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Omnichannel Channel Filter Tabs */}
      <div
        className={`px-3 py-1.5 flex items-center gap-1.5 border-b overflow-x-auto no-scrollbar ${
          darkMode ? 'bg-[#111b21] border-[#222e35]' : 'bg-white border-[#e9edef]'
        }`}
      >
        <button
          id="channel-all"
          onClick={() => onChannelChange('all')}
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap ${
            selectedChannel === 'all'
              ? 'bg-[#00a884] text-white font-semibold'
              : darkMode
              ? 'bg-[#202c33] text-[#8696a0] hover:text-[#e9edef]'
              : 'bg-[#e9edef] text-[#54656f]'
          }`}
        >
          Todos Canais
        </button>

        <button
          id="channel-whatsapp"
          onClick={() => onChannelChange('whatsapp')}
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all whitespace-nowrap ${
            selectedChannel === 'whatsapp'
              ? 'bg-[#25d366] text-white font-semibold'
              : darkMode
              ? 'bg-[#202c33] text-[#8696a0] hover:text-[#e9edef]'
              : 'bg-[#e9edef] text-[#54656f]'
          }`}
        >
          <MessageSquare className="w-3 h-3" />
          <span>WhatsApp</span>
        </button>

        <button
          id="channel-instagram"
          onClick={() => onChannelChange('instagram')}
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all whitespace-nowrap ${
            selectedChannel === 'instagram'
              ? 'bg-gradient-to-r from-purple-600 to-rose-600 text-white font-semibold'
              : darkMode
              ? 'bg-[#202c33] text-[#8696a0] hover:text-[#e9edef]'
              : 'bg-[#e9edef] text-[#54656f]'
          }`}
        >
          <Instagram className="w-3 h-3" />
          <span>Instagram</span>
        </button>

        <button
          id="channel-webchat"
          onClick={() => onChannelChange('webchat')}
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 transition-all whitespace-nowrap ${
            selectedChannel === 'webchat'
              ? 'bg-blue-600 text-white font-semibold'
              : darkMode
              ? 'bg-[#202c33] text-[#8696a0] hover:text-[#e9edef]'
              : 'bg-[#e9edef] text-[#54656f]'
          }`}
        >
          <Globe className="w-3 h-3" />
          <span>Chat Site</span>
        </button>
      </div>

      {/* Search Input Box */}
      <div className="px-3 pt-2 pb-1.5">
        <div
          className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border ${
            darkMode ? 'bg-[#202c33] border-transparent text-[#e9edef]' : 'bg-[#f0f2f5] border-transparent text-[#111b21]'
          }`}
        >
          <Search className={`w-4 h-4 shrink-0 ${darkMode ? 'text-[#8696a0]' : 'text-[#54656f]'}`} />
          <input
            id="input-search-conversations"
            type="text"
            placeholder="Pesquisar ou começar uma nova conversa"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-transparent text-xs sm:text-sm focus:outline-none placeholder:text-[#8696a0]"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className={`text-xs ${darkMode ? 'text-[#8696a0] hover:text-[#e9edef]' : 'text-[#54656f] hover:text-black'}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips ("Tudo", "Não lidas", "Favoritas", "Grupos", "Arquivadas") */}
      <div className="px-3 py-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <button
          id="filter-all"
          onClick={() => {
            setIsViewingArchived(false);
            onFilterChange('all');
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer ${
            selectedFilter === 'all' && !isViewingArchived
              ? 'bg-[#00a884] text-white font-semibold'
              : darkMode
              ? 'bg-[#202c33] text-[#8696a0] hover:bg-[#374248]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          Tudo
        </button>

        <button
          id="filter-unread"
          onClick={() => {
            setIsViewingArchived(false);
            onFilterChange('unread');
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 shrink-0 cursor-pointer ${
            selectedFilter === 'unread' && !isViewingArchived
              ? 'bg-[#00a884] text-white font-semibold'
              : darkMode
              ? 'bg-[#202c33] text-[#8696a0] hover:bg-[#374248]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          <span>Não lidas</span>
          {totalUnread > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedFilter === 'unread' && !isViewingArchived ? 'bg-white text-[#00a884]' : 'bg-[#25d366] text-black'
              }`}
            >
              {totalUnread}
            </span>
          )}
        </button>

        <button
          id="filter-favorites"
          onClick={() => {
            setIsViewingArchived(false);
            onFilterChange('favorites');
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer ${
            selectedFilter === 'favorites' && !isViewingArchived
              ? 'bg-[#00a884] text-white font-semibold'
              : darkMode
              ? 'bg-[#202c33] text-[#8696a0] hover:bg-[#374248]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          Favoritas
        </button>

        <button
          id="filter-groups"
          onClick={() => {
            setIsViewingArchived(false);
            onFilterChange('groups');
          }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer ${
            selectedFilter === 'groups' && !isViewingArchived
              ? 'bg-[#00a884] text-white font-semibold'
              : darkMode
              ? 'bg-[#202c33] text-[#8696a0] hover:bg-[#374248]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          Grupos
        </button>

        {/* Chip para acesso rápido à pasta Arquivadas */}
        <button
          id="filter-archived"
          onClick={() => setIsViewingArchived(true)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
            isViewingArchived
              ? 'bg-[#00a884] text-white font-semibold shadow-xs'
              : darkMode
              ? 'bg-[#202c33] text-[#8696a0] hover:bg-[#374248]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
          title="Ver pasta de conversas arquivadas"
        >
          <FolderArchive className="w-3.5 h-3.5" />
          <span>Arquivadas</span>
          {archivedCount > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                isViewingArchived ? 'bg-white text-[#00a884]' : 'bg-[#00a884]/20 text-[#00a884]'
              }`}
            >
              {archivedCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification Banner */}
      {showNotificationBanner && !isViewingArchived && (
        <div
          className={`px-3 py-2.5 mx-2 my-1 rounded-xl flex items-center justify-between gap-3 text-xs border ${
            darkMode ? 'bg-[#182229] border-[#222e35]' : 'bg-[#e7fce3] border-[#d1f4cc]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1e90ff] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className={`font-medium ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                Receba notificações de novas mensagens
              </p>
              <button
                type="button"
                onClick={handleEnableDesktopNotifications}
                className="text-[#53bdeb] text-[11px] hover:underline font-semibold cursor-pointer text-left"
              >
                Ativar notificações da área de trabalho
              </button>
            </div>
          </div>
          <button
            onClick={handleDismissNotificationBanner}
            className={`p-1 rounded-full cursor-pointer ${
              darkMode ? 'text-[#8696a0] hover:text-[#e9edef]' : 'text-[#54656f] hover:text-black'
            }`}
            title="Fechar banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto divide-y divide-transparent custom-scrollbar">
        {/* Pasta com o título "Arquivadas" (Exibida com destaque no topo da lista quando há conversas arquivadas) */}
        {!isViewingArchived && archivedCount > 0 && (
          <div
            id="folder-archived"
            onClick={() => setIsViewingArchived(true)}
            className={`px-4 py-3 flex items-center justify-between cursor-pointer border-b transition-all group select-none ${
              darkMode
                ? 'hover:bg-[#202c33] bg-[#111b21] border-[#222e35] text-[#e9edef]'
                : 'hover:bg-[#f5f6f6] bg-white border-[#f0f2f5] text-[#111b21]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#00a884]/15 text-[#00a884] flex items-center justify-center shrink-0 ring-1 ring-[#00a884]/30 shadow-xs group-hover:scale-105 transition-transform">
                <FolderArchive className="w-5 h-5 text-[#00a884]" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm leading-tight tracking-tight">Arquivadas</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-[#00a884]/15 text-[#00a884]">
                    Pasta
                  </span>
                </div>
                <span className="text-[11px] text-[#8696a0] mt-0.5">
                  {archivedCount} {archivedCount === 1 ? 'conversa arquivada' : 'conversas arquivadas'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {archivedUnreadCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse" />
              )}
              <span className="text-xs font-bold text-[#00a884] px-2.5 py-0.5 rounded-full bg-[#00a884]/15 border border-[#00a884]/25">
                {archivedCount}
              </span>
            </div>
          </div>
        )}

        {/* Informative Header Banner inside Pasta Arquivadas */}
        {isViewingArchived && (
          <div
            className={`mx-3 my-2.5 px-3.5 py-2.5 rounded-xl text-xs flex items-start gap-2.5 border select-none ${
              darkMode ? 'bg-[#182229] border-[#222e35] text-[#8696a0]' : 'bg-[#f0f2f5] border-[#e9edef] text-[#54656f]'
            }`}
          >
            <Archive className="w-4 h-4 text-[#00a884] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Estas conversas permanecem arquivadas quando você recebe novas mensagens, a menos que você as desarquive.
            </p>
          </div>
        )}

        {sortedConversations.length === 0 ? (
          isViewingArchived ? (
            <div className="p-8 text-center text-xs text-[#8696a0] flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-gray-500/10 flex items-center justify-center text-[#8696a0]">
                <Archive className="w-6 h-6" />
              </div>
              <p className="font-medium">Nenhuma conversa arquivada.</p>
              <button
                type="button"
                onClick={() => setIsViewingArchived(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[#00a884] hover:bg-[#009374] text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Voltar para Conversas
              </button>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-[#8696a0] space-y-3">
              <div className="w-10 h-10 rounded-full bg-gray-500/10 flex items-center justify-center text-[#8696a0] mx-auto">
                <MessageSquare className="w-5 h-5 text-[#00a884]" />
              </div>
              <div>
                <p className="font-semibold text-gray-200">
                  Nenhuma conversa encontrada
                </p>
                <p className="text-[11px] text-[#8696a0] mt-0.5">
                  Empresa ativa: <span className="text-[#00a884] font-medium">{currentAccount?.name}</span>
                </p>
              </div>
              {availableAccounts && availableAccounts.length > 1 && (
                <div className="pt-2 border-t border-[#313d45]/40 space-y-2">
                  <p className="text-[11px] text-[#8696a0]">
                    Alternar empresa:
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {availableAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => onSwitchAccount?.(acc.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          acc.id === currentAccount?.id
                            ? 'bg-[#00a884] text-white shadow-xs'
                            : 'bg-[#111b21] hover:bg-[#202c33] text-[#00a884] border border-[#00a884]/30'
                        }`}
                      >
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          sortedConversations.map((conv) => {
            const isSelected = selectedId === conv.id;
            const convDate = formatSaoPauloDate(conv.updatedAt || conv.lastMessage.timestamp);

            return (
              <div
                key={conv.id}
                id={`conversation-item-${conv.id}`}
                onClick={() => onSelectConversation(conv.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({
                    conversation: conv,
                    position: { x: e.clientX, y: e.clientY },
                  });
                }}
                className={`group relative flex items-center gap-3 px-3 py-3 cursor-pointer transition-all border-b ${
                  darkMode ? 'border-[#222e35]/50' : 'border-[#f0f2f5]'
                } ${
                  isSelected
                    ? darkMode
                      ? 'bg-[#2a3942] rounded-xl mx-2 shadow-sm'
                      : 'bg-[#f0f2f5] rounded-xl mx-2 shadow-sm'
                    : darkMode
                    ? 'hover:bg-[#202c33]/70'
                    : 'hover:bg-[#f5f6f6]'
                }`}
              >
                {/* Avatar with Channel Badge */}
                <div className="relative shrink-0">
                  <img
                    src={conv.contact.avatarUrl}
                    alt={conv.contact.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  {renderChannelBadge(conv.contact.channel)}
                </div>

                {/* Conversation Details */}
                <div className="flex-1 min-w-0">
                  {/* Line 1: Name + Status Pill + Date/Time */}
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className={`font-semibold text-sm truncate ${
                          darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'
                        }`}
                      >
                        {conv.contact.name}
                      </span>
                      {renderStatusPill(conv.status)}
                    </div>
                    <span
                      className={`text-[11px] shrink-0 ${
                        conv.unreadCount > 0 ? 'text-[#25d366] font-semibold' : darkMode ? 'text-[#8696a0]' : 'text-[#667781]'
                      }`}
                    >
                      {convDate}
                    </span>
                  </div>

                  {/* Line 2: Message preview with tick or camera/mic icon */}
                  {(() => {
                    const rawText = conv.lastMessage?.text || '';
                    const textLower = rawText.toLowerCase().trim();

                    // Identificação de mensagens de áudio
                    const isAudio =
                      conv.lastMessage?.contentType === 'audio' ||
                      textLower === 'audio' ||
                      textLower === 'áudio' ||
                      textLower === '[audio]' ||
                      textLower === '[áudio]' ||
                      textLower.startsWith('audio') ||
                      textLower.startsWith('áudio') ||
                      textLower === 'mensagem de voz' ||
                      /(\.ogg|\.opus|\.mp3|\.wav|\.m4a|\.aac)(\?.*)?$/i.test(rawText);

                    // Extração ou definição da duração do áudio (suporta formato MM:SS, segundos numéricos ou texto)
                    const audioDuration = formatAudioDuration(
                      conv.lastMessage?.mediaDuration || rawText
                    );

                    // Mensagem de saída / enviada (mostra os dois ticks de status do WhatsApp)
                    const isOutgoing =
                      conv.lastMessage?.senderType === 'agent' ||
                      conv.lastMessage?.senderType === 'coexistence_mobile' ||
                      conv.lastMessage?.senderType === 'ai' ||
                      (conv.lastMessage?.senderType !== 'contact' && conv.lastMessage?.senderType !== 'customer') ||
                      (isAudio && (textLower === 'audio' || textLower === 'áudio' || textLower.includes('enviado')));

                    // Identificação de mensagens de mídia
                    const isSticker =
                      conv.lastMessage?.contentType === 'sticker' ||
                      textLower === 'sticker' ||
                      textLower === 'figurinha' ||
                      textLower === '[sticker]' ||
                      /\.webp(\?.*)?$/i.test(rawText);

                    const isGif =
                      conv.lastMessage?.contentType === 'gif' ||
                      textLower === 'gif' ||
                      textLower === '[gif]' ||
                      /\.gif(\?.*)?$/i.test(rawText);

                    const isImage =
                      conv.lastMessage?.contentType === 'image' ||
                      textLower === 'foto' ||
                      textLower === 'imagem' ||
                      /\.(jpg|jpeg|png|avif|bmp)(\?.*)?$/i.test(rawText);

                    return (
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className={`flex items-center gap-1 text-xs truncate ${
                            darkMode ? 'text-[#8696a0]' : 'text-[#667781]'
                          }`}
                        >
                          {isOutgoing && (
                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] inline shrink-0" />
                          )}

                          {isAudio ? (
                            <span className="flex items-center gap-1 truncate font-normal">
                              <Mic className={`w-3.5 h-3.5 shrink-0 ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`} />
                              <span>{audioDuration}</span>
                            </span>
                          ) : isSticker ? (
                            <span className="truncate flex items-center gap-1">
                              <span>💟</span>
                              <span>Figurinha</span>
                            </span>
                          ) : isGif ? (
                            <span className="truncate flex items-center gap-1">
                              <span>🎬</span>
                              <span>GIF</span>
                            </span>
                          ) : isImage ? (
                            <span className="flex items-center gap-1 truncate">
                              <Camera className="w-3.5 h-3.5 text-[#8696a0] inline shrink-0" />
                              <span>{rawText && !rawText.startsWith('http') ? rawText : 'Foto'}</span>
                            </span>
                          ) : (
                            <span className="truncate">{conv.lastMessage?.text}</span>
                          )}
                        </div>

                        {/* Pin, Mute, Unread Badges e Setinha de Opções do WhatsApp Web */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {conv.isMuted && (
                            <span title="Notificações silenciadas">
                              <BellOff className="w-3.5 h-3.5 text-[#8696a0]" />
                            </span>
                          )}
                          {conv.isPinned && (
                            <span title="Conversa fixada">
                              <Pin className="w-3.5 h-3.5 rotate-45 text-[#8696a0]" />
                            </span>
                          )}
                          {conv.unreadCount > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#25d366] text-black text-[10px] font-bold flex items-center justify-center leading-none shadow-sm">
                              {conv.unreadCount}
                            </span>
                          )}

                          {/* Setinha de opções (estilo WhatsApp Web - aparece ao passar o mouse no card ou com menu aberto) */}
                          <button
                            type="button"
                            id={`btn-conv-options-${conv.id}`}
                            title="Menu da conversa"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setContextMenu({
                                conversation: conv,
                                position: {
                                  x: Math.max(12, rect.right - 230),
                                  y: rect.bottom + 4,
                                },
                              });
                            }}
                            className={`p-0.5 rounded-full transition-all cursor-pointer ${
                              contextMenu?.conversation.id === conv.id
                                ? 'opacity-100 bg-black/10 dark:bg-white/15 text-[#00a884]'
                                : 'opacity-0 group-hover:opacity-100 text-[#8696a0] hover:text-[#00a884] hover:bg-black/5 dark:hover:bg-white/10'
                            }`}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Tags (IA_INATIVA / IA_ATIVA / CRM) */}
                  {conv.contact.tags && conv.contact.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {conv.contact.tags.map((tag) => (
                        <span
                          key={tag.id}
                          style={{
                            backgroundColor: tag.color,
                            color: tag.textColor || '#ffffff',
                          }}
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase border border-white/10"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Menu Contextual do WhatsApp Web (ao clicar na setinha ou botão direito) */}
      {contextMenu && (
        <ConversationContextMenu
          isOpen={Boolean(contextMenu)}
          onClose={() => setContextMenu(null)}
          conversation={contextMenu.conversation}
          position={contextMenu.position}
          darkMode={darkMode}
          onArchive={(id) => {
            const isArchived = contextMenu.conversation.isArchived;
            onToggleArchive?.(id);
            showToast(isArchived ? 'Conversa desarquivada' : 'Conversa movida para Arquivadas');
          }}
          onMute={(id, duration) => {
            const isMuted = contextMenu.conversation.isMuted;
            onToggleMute?.(id, duration);
            showToast(isMuted ? 'Notificações reativadas' : 'Notificações silenciadas');
          }}
          onPin={(id) => {
            const isPinned = contextMenu.conversation.isPinned;
            onTogglePin?.(id);
            showToast(isPinned ? 'Conversa desafixada' : 'Conversa fixada');
          }}
          onToggleUnread={(id) => {
            const isUnread = contextMenu.conversation.unreadCount > 0;
            onToggleMarkUnread?.(id);
            showToast(isUnread ? 'Conversa marcada como lida' : 'Conversa marcada como não lida');
          }}
          onToggleFavorite={(id) => {
            const isFav = contextMenu.conversation.isFavorite;
            onToggleFavorite?.(id);
            showToast(isFav ? 'Removida dos favoritos' : 'Adicionada aos favoritos');
          }}
          onAddTag={(_id) => {
            showToast('Abra a conversa para gerenciar etiquetas');
          }}
          onClearChat={(id) => {
            onClearMessages?.(id);
            showToast('Mensagens apagadas com sucesso');
          }}
          onDeleteChat={(id) => {
            onDeleteConversation?.(id);
            showToast('Conversa apagada com sucesso');
          }}
          onUpdateContact={(id, data) => {
            onUpdateContact?.(id, data);
            showToast('Contato salvo com sucesso');
          }}
        />
      )}
    </div>
  );
};
