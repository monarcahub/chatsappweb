import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Bell, X, ExternalLink, Instagram, Globe } from 'lucide-react';
import { LeftNavRail } from './components/LeftNavRail';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { RightPanel } from './components/RightPanel';
import { ArchitectureModal } from './components/ArchitectureModal';
import { NewChatModal } from './components/NewChatModal';
import { CallsNoticeModal } from './components/CallsNoticeModal';
import { StatusSidebar } from './components/StatusSidebar';
import { ChannelsSidebar } from './components/ChannelsSidebar';
import { AIBrainModal } from './components/AIBrainModal';
import { SettingsSidebar } from './components/SettingsSidebar';
import { ProfileScreen } from './components/ProfileScreen';
import { AppLockModal } from './components/AppLockModal';
import { LoginScreen } from './components/LoginScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useSupabaseChat } from './hooks/useSupabaseChat';
import { ChannelType, Tag } from './types';
import { INITIAL_TAGS } from './data/mockData';

function AppContent() {
  const {
    isAuthenticated,
    currentAccount,
    user,
    availableAccounts,
    switchAccount,
    logout,
  } = useAuth();

  const [darkMode, setDarkMode] = useState(true);

  // When not logged in or no company selected, show WhatsApp-style multi-tenant LoginScreen
  if (!isAuthenticated || !currentAccount) {
    return <LoginScreen darkMode={darkMode} />;
  }

  return (
    <AuthenticatedApp
      key={currentAccount.id}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
      currentAccount={currentAccount}
      user={user}
      availableAccounts={availableAccounts}
      onSwitchAccount={switchAccount}
      onLogout={logout}
    />
  );
}

interface AuthenticatedAppProps {
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  currentAccount: any;
  user: any;
  availableAccounts: any[];
  onSwitchAccount: (id: string) => void;
  onLogout: () => void;
}

const AuthenticatedApp: React.FC<AuthenticatedAppProps> = ({
  darkMode,
  setDarkMode,
  currentAccount,
  user,
  availableAccounts,
  onSwitchAccount,
  onLogout,
}) => {
  const {
    conversations,
    messages,
    selectedId,
    setSelectedId,
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
    isConnectedToSupabase,
    realtimeLatencyMs,
  } = useSupabaseChat(null, currentAccount?.id || '', user, availableAccounts);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all');
  const [activeRailTab, setActiveRailTab] = useState<'chats' | 'status' | 'channels' | 'settings'>('chats');
  const [selectedChannel, setSelectedChannel] = useState<'all' | ChannelType>('all');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isMobileMode, setIsMobileMode] = useState(false);
  const [isArchitectureModalOpen, setIsArchitectureModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isCallsNoticeOpen, setIsCallsNoticeOpen] = useState(false);
  const [isAIBrainOpen, setIsAIBrainOpen] = useState(false);
  const [isAIActiveGlobal, setIsAIActiveGlobal] = useState<boolean>(() => {
    const saved = localStorage.getItem('chatsapp_ai_global_active');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleAIGlobal = (newStatus: boolean) => {
    setIsAIActiveGlobal(newStatus);
    localStorage.setItem('chatsapp_ai_global_active', String(newStatus));
  };

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [allTags] = useState<Tag[]>(INITIAL_TAGS);
  const [channelsCount, setChannelsCount] = useState<number | null>(null);
  const [hasDismissedOnboarding, setHasDismissedOnboarding] = useState(false);

  // Consulta canais reais vinculados à empresa no Supabase
  const refreshChannelsCount = async () => {
    if (!currentAccount?.id) return;
    try {
      const res = await fetch(`/api/channels?account_id=${currentAccount.id}`);
      if (res.ok) {
        const data = await res.json();
        setChannelsCount(data.channels ? data.channels.length : 0);
      }
    } catch (e) {
      console.warn('Erro ao consultar canais:', e);
    }
  };

  useEffect(() => {
    refreshChannelsCount();
  }, [currentAccount?.id]);

  // 1. Carregamento do SDK JavaScript da Meta
  const META_APP_ID = '1322580525486349';

  useEffect(() => {
    if (!window.FB) {
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        window.FB.init({
          appId: META_APP_ID,
          autoLogAppEvents: true,
          xfbml: true,
          version: 'v21.0',
        });
      };
      document.head.appendChild(script);
    }
  }, []);

  // 2. Ouvinte de Mensagens para o Embedded Signup (sessionInfoListener)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Origem segura da Meta
      if (!event.origin.includes('facebook.com')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          console.log('Evento do Embedded Signup recebido:', data);
          // data.event pode ser 'FINISH', 'CANCEL', etc.
          // data.data contém waba_id, phone_number_id, etc.
        }
      } catch (e) {
        // Ignora mensagens que não sejam JSON
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-detect small screens for responsive mobile navigation
  const [isSmallScreen, setIsSmallScreen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = isMobileMode || isSmallScreen;

  const selectedConversation = conversations.find((c) => c.id === selectedId) || null;
  const currentMessages = selectedId && messages[selectedId] ? messages[selectedId] : [];
  const totalUnreadCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  // Sistema de Notificações Visuais Flutuantes In-App (WhatsApp Web Style)
  const [inAppNotification, setInAppNotification] = useState<{
    id: string;
    conversationId?: string;
    title: string;
    body: string;
    icon?: string;
    channel?: string;
    timestamp: string;
  } | null>(null);

  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleNewMessage = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      if (!detail) return;

      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }

      setInAppNotification({
        id: `${Date.now()}-${Math.random()}`,
        conversationId: detail.conversationId,
        title: detail.title || 'Nova mensagem',
        body: detail.body || '',
        icon: detail.icon,
        channel: detail.channel || 'whatsapp',
        timestamp: detail.timestamp || new Date().toISOString(),
      });

      notificationTimeoutRef.current = setTimeout(() => {
        setInAppNotification(null);
      }, 7000);
    };

    window.addEventListener('chatsapp:new_incoming_message', handleNewMessage);
    return () => {
      window.removeEventListener('chatsapp:new_incoming_message', handleNewMessage);
      if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    };
  }, []);

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    if (inAppNotification?.conversationId === id) {
      setInAppNotification(null);
    }
  };

  const handleToggleCRM = () => {
    setIsRightPanelOpen((prev) => !prev);
  };

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col ${
        darkMode ? 'bg-[#0c1317] text-[#e9edef]' : 'bg-[#d1d7db] text-[#111b21]'
      }`}
    >
      {/* ChatsApp Web Desktop Layout Container */}
      <div
        className={`flex-1 flex overflow-hidden ${
          isMobileMode
            ? 'max-w-md mx-auto my-auto h-[95vh] rounded-3xl shadow-2xl border-4 border-[#222e35] relative w-full'
            : 'w-full h-full flex-row'
        }`}
      >
        {/* ChatsApp Web Left Navigation Rail (Dock bar from desktop screenshot) */}
        {!isMobileMode && (
          <div className="hidden md:flex h-full">
            <LeftNavRail
              activeTab={activeRailTab}
              onSelectTab={(tab) => {
                setActiveRailTab(tab);
              }}
              unreadChatsCount={totalUnreadCount}
              onOpenCallsNotice={() => setIsCallsNoticeOpen(true)}
              onOpenAIBrain={() => setIsAIBrainOpen(true)}
              isAIActive={isAIActiveGlobal}
              onToggleCRM={handleToggleCRM}
              isCRMOpen={isRightPanelOpen}
              darkMode={darkMode}
              userName={user?.name}
              userAvatar={user?.avatarUrl}
              companyName={currentAccount?.name}
              onOpenProfile={() => setIsProfileOpen(true)}
            />
          </div>
        )}

        {/* Left Sidebar: Conversations list / Status / Channels */}
        <div
          className={`${
            selectedId ? (isMobile ? 'hidden' : 'hidden md:flex') : 'flex'
          } flex-col w-full md:w-[380px] lg:w-[430px] shrink-0 h-full`}
        >
          {activeRailTab === 'status' ? (
            <StatusSidebar
              darkMode={darkMode}
              onBackToChats={() => setActiveRailTab('chats')}
            />
          ) : activeRailTab === 'channels' ? (
            <ChannelsSidebar
              darkMode={darkMode}
              onBackToChats={() => {
                setActiveRailTab('chats');
                refreshChannelsCount();
              }}
              onFilterByChannel={(ch) => setSelectedChannel(ch)}
              currentChannelFilter={selectedChannel}
              currentAccount={currentAccount}
            />
          ) : activeRailTab === 'settings' ? (
            <SettingsSidebar
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode(!darkMode)}
              onBackToChats={() => setActiveRailTab('chats')}
              onOpenCRM={handleToggleCRM}
              currentAccount={currentAccount}
              user={user}
              availableAccounts={availableAccounts}
              onSwitchAccount={onSwitchAccount}
              onLogout={onLogout}
              onOpenProfile={() => setIsProfileOpen(true)}
            />
          ) : (
            <Sidebar
              conversations={conversations}
              selectedId={selectedId}
              onSelectConversation={handleSelectConversation}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedFilter={selectedFilter}
              onFilterChange={setSelectedFilter}
              selectedChannel={selectedChannel}
              onChannelChange={setSelectedChannel}
              isMobileMode={isMobile}
              onToggleMobileMode={() => setIsMobileMode(!isMobileMode)}
              darkMode={darkMode}
              onToggleDarkMode={() => setDarkMode(!darkMode)}
              onOpenArchitectureModal={() => setIsArchitectureModalOpen(true)}
              onOpenNewChatModal={() => setIsNewChatModalOpen(true)}
              isConnectedToSupabase={isConnectedToSupabase}
              realtimeLatencyMs={realtimeLatencyMs}
              currentAccount={currentAccount}
              availableAccounts={availableAccounts}
              onSwitchAccount={onSwitchAccount}
              onLogout={onLogout}
              onOpenSettings={() =>
                setActiveRailTab(activeRailTab === 'settings' ? 'chats' : 'settings')
              }
              isSettingsOpen={activeRailTab === 'settings'}
              onOpenProfile={() => setIsProfileOpen(true)}
              onOpenCRM={handleToggleCRM}
              onMarkAllAsRead={markAllAsRead}
              onLockApp={() => setIsAppLocked(true)}
              onDeleteConversation={deleteConversation}
              onClearMessages={clearMessages}
              onToggleFavorite={toggleFavorite}
              onToggleArchive={toggleArchive}
              onTogglePin={togglePin}
              onToggleMute={toggleMute}
              onToggleMarkUnread={toggleMarkUnread}
              onUpdateContact={updateContact}
            />
          )}
        </div>

        {/* Central Area: Chat History & Input */}
        <div
          className={`${
            !selectedId ? (isMobile ? 'hidden' : 'hidden md:flex') : 'flex'
          } flex-1 flex flex-col h-full min-w-0`}
        >
          {channelsCount === 0 && !hasDismissedOnboarding && !selectedId ? (
            <OnboardingScreen
              darkMode={darkMode}
              account={currentAccount}
              user={user}
              onOpenChannels={() => setActiveRailTab('channels')}
              onOpenAIBrain={() => setIsAIBrainOpen(true)}
              onOpenNewChat={() => setIsNewChatModalOpen(true)}
              onSkipToDashboard={() => setHasDismissedOnboarding(true)}
            />
          ) : (
            <ChatArea
              conversation={selectedConversation}
              messages={currentMessages}
              onSendMessage={(text, contentType) => {
                if (selectedConversation) {
                  sendMessage(selectedConversation.id, text, contentType);
                }
              }}
              onToggleRightPanel={handleToggleCRM}
              isRightPanelOpen={isRightPanelOpen}
              onBackToConversations={() => setSelectedId(null)}
              darkMode={darkMode}
              onUpdateStatus={updateConversationStatus}
              isMobileMode={isMobile}
              onClearMessages={clearMessages}
              onDeleteConversation={deleteConversation}
              onDeleteSelectedMessages={deleteSelectedMessages}
              onToggleFavorite={toggleFavorite}
              onToggleArchive={toggleArchive}
              availableTags={allTags}
              onAddTag={(tag) => selectedConversation && addTag(selectedConversation.id, tag)}
              onRemoveTag={(tagId) => selectedConversation && removeTag(selectedConversation.id, tagId)}
            />
          )}
        </div>

        {/* Right Panel: CRM, Coexistence Mode, AI Controls */}
        {selectedConversation && isRightPanelOpen && (
          <div
            className={`${
              isMobile
                ? 'absolute inset-0 z-50 bg-[#111b21] flex flex-col'
                : 'w-full md:w-[360px] lg:w-[400px] shrink-0 h-full border-l z-30'
            }`}
          >
            <RightPanel
              contact={selectedConversation.contact}
              onClose={() => setIsRightPanelOpen(false)}
              onUpdateAIStatus={(aiStatus) =>
                updateConversationStatus(selectedConversation.id, aiStatus === 'active' ? 'ai' : 'human')
              }
              onToggleCoexistence={() => {}}
              onUpdateDealStage={(stage) => updateCRMStage(selectedConversation.id, stage)}
              onUpdateDealValue={() => {}}
              onAddTag={(tag) => addTag(selectedConversation.id, tag)}
              onRemoveTag={(tagId) => removeTag(selectedConversation.id, tagId)}
              onAddNote={(noteText) => addNote(selectedConversation.id, noteText)}
              availableTags={allTags}
              darkMode={darkMode}
              onUpdateContactName={(newName) => updateContact(selectedConversation.id, { name: newName })}
            />
          </div>
        )}
      </div>

      {/* Architecture & DDL Modal */}
      <ArchitectureModal
        isOpen={isArchitectureModalOpen}
        onClose={() => setIsArchitectureModalOpen(false)}
        darkMode={darkMode}
      />

      {/* Webhook Simulator Modal */}
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onSimulateIncoming={simulateWebhookIncoming}
        darkMode={darkMode}
      />

      {/* Calls Notice Warning Modal */}
      <CallsNoticeModal
        isOpen={isCallsNoticeOpen}
        onClose={() => setIsCallsNoticeOpen(false)}
        darkMode={darkMode}
      />

      {/* AI Brain & Knowledge Base Modal */}
      <AIBrainModal
        isOpen={isAIBrainOpen}
        onClose={() => setIsAIBrainOpen(false)}
        darkMode={darkMode}
        account={currentAccount}
        isAIActiveGlobal={isAIActiveGlobal}
        onToggleAIGlobal={handleToggleAIGlobal}
      />

      {/* WhatsApp Business Profile Screen (Screenshot Replica) */}
      {isProfileOpen && (
        <ProfileScreen
          darkMode={darkMode}
          onClose={() => setIsProfileOpen(false)}
          user={user}
        />
      )}

      {/* WhatsApp Web App Lock Modal */}
      <AppLockModal
        isOpen={isAppLocked}
        onUnlock={() => setIsAppLocked(false)}
        onLogout={onLogout}
        darkMode={darkMode}
      />

      {/* Floating In-App New Message Notification Popup (WhatsApp Web Style) */}
      {inAppNotification && (
        <div
          id="in-app-notification-popup"
          className="fixed top-4 right-4 z-50 max-w-sm sm:max-w-md w-full animate-in fade-in slide-in-from-top-4 duration-200 select-none shadow-2xl drop-shadow-2xl"
        >
          <div
            onClick={() => {
              if (inAppNotification.conversationId) {
                handleSelectConversation(inAppNotification.conversationId);
              }
            }}
            className={`p-3.5 rounded-2xl border flex items-start gap-3 cursor-pointer transition-all hover:scale-[1.02] ${
              darkMode
                ? 'bg-[#202c33] border-[#00a884]/40 text-[#e9edef] shadow-[#00000080]'
                : 'bg-white border-[#00a884]/30 text-[#111b21] shadow-xl'
            }`}
          >
            {/* Avatar / Icon */}
            <div className="relative shrink-0">
              <img
                src={inAppNotification.icon || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120'}
                alt={inAppNotification.title}
                className="w-11 h-11 rounded-full object-cover ring-2 ring-[#00a884]/50"
              />
              <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#25d366] text-white shadow-xs">
                <MessageSquare className="w-2.5 h-2.5" />
              </div>
            </div>

            {/* Notification Text */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-bold text-sm truncate text-[#00a884]">
                    {inAppNotification.title}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] animate-ping shrink-0" />
                </div>
                <span className="text-[10px] text-[#8696a0] shrink-0 font-medium">Agora</span>
              </div>
              <p
                className={`text-xs line-clamp-2 leading-relaxed ${
                  darkMode ? 'text-[#d1d7db]' : 'text-[#3b4a54]'
                }`}
              >
                {inAppNotification.body || 'Nova mensagem recebida'}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-[#53bdeb] font-semibold">
                <ExternalLink className="w-3 h-3" />
                <span>Clique para abrir conversa</span>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              id="btn-close-notification-popup"
              onClick={(e) => {
                e.stopPropagation();
                setInAppNotification(null);
              }}
              className={`p-1 rounded-full transition-colors shrink-0 cursor-pointer ${
                darkMode ? 'hover:bg-white/10 text-[#8696a0]' : 'hover:bg-black/5 text-[#54656f]'
              }`}
              title="Fechar notificação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
