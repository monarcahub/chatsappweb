import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  Lightbulb,
  X,
  Store,
  Key,
  Lock,
  MessageSquare,
  Bell,
  Keyboard,
  HelpCircle,
  LogOut,
  Sun,
  Moon,
  Check,
  Shield,
  Smartphone,
  ExternalLink,
  ChevronRight,
  Building2,
  Camera,
  Trash2,
  MoreVertical,
  Volume2,
} from 'lucide-react';
import { Account, AuthUser } from '../types';
import { UserAvatar } from './UserAvatar';
import { useAuth } from '../context/AuthContext';
import {
  isSoundNotificationEnabled,
  setSoundNotificationEnabled,
  isDesktopNotificationPrefEnabled,
  setDesktopNotificationPrefEnabled,
  testNotificationSystem,
} from '../utils/notifications';

interface SettingsSidebarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onBackToChats: () => void;
  onOpenCRM?: () => void;
  currentAccount?: Account | null;
  user?: AuthUser | null;
  availableAccounts?: Account[];
  onSwitchAccount?: (id: string) => void;
  onLogout?: () => void;
  onOpenProfile?: () => void;
}

type SettingModalType =
  | 'none'
  | 'commercial_tools'
  | 'account'
  | 'tenants'
  | 'privacy'
  | 'chats'
  | 'notifications'
  | 'shortcuts'
  | 'help'
  | 'logout';

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  darkMode,
  onToggleDarkMode,
  onBackToChats,
  onOpenCRM,
  currentAccount,
  user,
  availableAccounts = [],
  onSwitchAccount,
  onLogout,
  onOpenProfile,
}) => {
  const { updateUserProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotificationBanner, setShowNotificationBanner] = useState(true);
  const [activeModal, setActiveModal] = useState<SettingModalType>('none');
  const [notificationSound, setNotificationSound] = useState(() => isSoundNotificationEnabled());
  const [desktopAlerts, setDesktopAlerts] = useState(() => isDesktopNotificationPrefEnabled());
  const [readReceipts, setReadReceipts] = useState(true);
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');

  // Settings items matching the screenshot
  const settingsItems = [
    {
      id: 'tenants' as SettingModalType,
      title: 'Empresas & Clientes (Multi-Tenant)',
      description: currentAccount ? `${currentAccount.name} • ${currentAccount.segment || 'Ativo'}` : 'Gerenciar clientes',
      icon: Building2,
      onClick: () => setActiveModal('tenants'),
    },
    {
      id: 'commercial_tools' as SettingModalType,
      title: 'Ferramentas comerciais',
      description: 'Respostas rápidas, etiquetas, catálogo',
      icon: Store,
      onClick: () => {
        if (onOpenCRM) onOpenCRM();
        setActiveModal('commercial_tools');
      },
    },
    {
      id: 'account' as SettingModalType,
      title: 'Conta',
      description: 'Notificações de segurança, dados da conta',
      icon: Key,
      onClick: () => setActiveModal('account'),
    },
    {
      id: 'privacy' as SettingModalType,
      title: 'Privacidade',
      description: 'Contatos bloqueados, mensagens temporárias',
      icon: Lock,
      onClick: () => setActiveModal('privacy'),
    },
    {
      id: 'chats' as SettingModalType,
      title: 'Conversas',
      description: 'Tema, papel de parede, configurações de conversas',
      icon: MessageSquare,
      onClick: () => setActiveModal('chats'),
    },
    {
      id: 'notifications' as SettingModalType,
      title: 'Notificações',
      description: 'Mensagens, grupos, sons',
      icon: Bell,
      onClick: () => setActiveModal('notifications'),
    },
    {
      id: 'shortcuts' as SettingModalType,
      title: 'Atalhos do teclado',
      description: 'Ações rápidas',
      icon: Keyboard,
      onClick: () => setActiveModal('shortcuts'),
    },
    {
      id: 'help' as SettingModalType,
      title: 'Ajuda e feedback',
      description: 'Central de Ajuda, fale conosco, Política de Privacidade',
      icon: HelpCircle,
      onClick: () => setActiveModal('help'),
    },
  ];

  const filteredItems = settingsItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
  });

  return (
    <div
      className={`h-full flex flex-col relative select-none border-r ${
        darkMode ? 'bg-[#111b21] border-[#222e35]' : 'bg-white border-[#e9edef]'
      }`}
    >
      {/* Top Header matching WhatsApp Web with close and toggle buttons */}
      <div
        className={`h-16 px-4 flex items-center justify-between border-b shrink-0 ${
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
          <h1 className={`font-bold text-lg ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
            Configurações
          </h1>
        </div>

        {/* Top-right actions: DarkMode, 3 dots toggle (closes settings on click) and Close X */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleDarkMode}
            className={`p-2 rounded-full transition-colors ${
              darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
            title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Três pontinhos: com as configurações abertas, clicar nele fecha o menu e volta para as conversas */}
          <button
            id="btn-settings-header-more-toggle"
            onClick={onBackToChats}
            className={`p-2 rounded-full transition-colors ${
              darkMode
                ? 'bg-[#374248] text-[#00a884] hover:bg-[#2a3942]'
                : 'bg-[#d1d7db] text-[#00a884] hover:bg-[#c4cacc]'
            }`}
            title="Fechar configurações e voltar para as conversas"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Botão de Fechar X */}
          <button
            onClick={onBackToChats}
            className={`p-2 rounded-full transition-colors ${
              darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
            title="Fechar menu de configurações"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search bar matching screenshot */}
      <div className="p-3">
        <div
          className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
            darkMode ? 'bg-[#202c33] border-[#222e35] text-[#d1d7db]' : 'bg-[#f0f2f5] border-transparent text-[#111b21]'
          }`}
        >
          <Search className="w-4 h-4 text-[#8696a0] shrink-0" />
          <input
            type="text"
            placeholder="Pesquisar configurações"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none text-xs focus:outline-none placeholder:text-[#8696a0]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[#8696a0] hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto px-2 pb-6 space-y-1">
        {/* Banner: "Escolha suas notificações" matching screenshot */}
        {showNotificationBanner && !searchQuery && (
          <div
            className={`mx-1 mb-3 p-3.5 rounded-xl border flex items-start gap-3 relative transition-all ${
              darkMode ? 'bg-[#182229] border-[#222e35]' : 'bg-[#f0f2f5] border-gray-200'
            }`}
          >
            <div className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 pr-5">
              <h3 className={`font-bold text-xs ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                Escolha suas notificações
              </h3>
              <p className="text-[11px] text-[#8696a0] leading-snug mt-0.5">
                Receba notificações de mensagens, grupos ou atualizações de status.{' '}
                <button
                  onClick={() => setActiveModal('notifications')}
                  className="font-bold text-[#00a884] hover:underline inline"
                >
                  Escolher agora
                </button>
              </p>
            </div>

            <button
              onClick={() => setShowNotificationBanner(false)}
              className="absolute top-2.5 right-2.5 text-[#8696a0] hover:text-white transition-colors"
              title="Dispensar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* User Profile Card matching screenshot */}
        {!searchQuery && (
          <div
            onClick={() => {
              if (onOpenProfile) {
                onOpenProfile();
              } else {
                setActiveModal('account');
              }
            }}
            className={`flex items-center gap-3.5 p-2.5 rounded-xl cursor-pointer transition-colors mb-2 ${
              darkMode ? 'hover:bg-[#202c33]' : 'hover:bg-gray-100'
            }`}
          >
            <div className="relative shrink-0">
              <UserAvatar
                name={user?.name || 'Administrador'}
                avatarUrl={user?.avatarUrl}
                size="md"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-sm ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                {user?.name || 'Administrador'}
              </div>
              <div className="text-xs text-[#8696a0] truncate">
                {currentAccount ? `${currentAccount.name} • ${user?.role === 'admin' ? 'Administrador' : 'Atendente'}` : 'Workspace Ativo'}
              </div>
            </div>
          </div>
        )}

        {/* List of Settings Items */}
        <div className="space-y-0.5">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={item.onClick}
                className={`flex items-center gap-4 px-3 py-3 rounded-xl cursor-pointer transition-colors ${
                  darkMode ? 'hover:bg-[#202c33]' : 'hover:bg-gray-100'
                }`}
              >
                <div className={`shrink-0 ${darkMode ? 'text-[#8696a0]' : 'text-[#54656f]'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm leading-tight ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                    {item.title}
                  </div>
                  <div className="text-xs text-[#8696a0] truncate mt-0.5">
                    {item.description}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Desconectar Item (in Red) matching screenshot */}
          {(!searchQuery || 'desconectar'.includes(searchQuery.toLowerCase())) && (
            <div
              onClick={() => setActiveModal('logout')}
              className={`flex items-center gap-4 px-3 py-3 rounded-xl cursor-pointer transition-colors ${
                darkMode ? 'hover:bg-red-950/20' : 'hover:bg-red-50'
              }`}
            >
              <div className="text-rose-500 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-rose-500">
                  Desconectar
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL / SUB-VIEW: Conversas (Tema, Papel de Parede) */}
      {activeModal === 'chats' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
              darkMode ? 'bg-[#202c33] border-[#2f3b43] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 font-bold text-base">
                <MessageSquare className="w-5 h-5 text-[#00a884]" />
                <span>Configurações de Conversas</span>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-2 text-gray-300">Tema do ChatsApp</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      if (darkMode) onToggleDarkMode();
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-medium transition-all ${
                      !darkMode
                        ? 'border-[#00a884] bg-[#00a884]/15 text-[#00a884]'
                        : 'border-gray-700 hover:bg-[#182229] text-gray-400'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>Claro</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!darkMode) onToggleDarkMode();
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-medium transition-all ${
                      darkMode
                        ? 'border-[#00a884] bg-[#00a884]/20 text-[#00a884]'
                        : 'border-gray-700 hover:bg-[#182229] text-gray-400'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span>Escuro</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-700/30">
                <label className="block font-semibold mb-1 text-gray-300">Enter para enviar</label>
                <p className="text-[#8696a0] text-[11px] mb-2">
                  A tecla Enter enviará sua mensagem no chat central.
                </p>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#111b21]">
                  <span>Enviar com Enter</span>
                  <span className="text-[#00a884] font-bold">Ativado</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 rounded-lg bg-[#00a884] hover:bg-[#02906f] text-white font-bold text-xs"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / SUB-VIEW: Conta */}
      {activeModal === 'account' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
              darkMode ? 'bg-[#202c33] border-[#2f3b43] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 font-bold text-base">
                <Key className="w-5 h-5 text-[#00a884]" />
                <span>Dados da Conta</span>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-[#111b21] border border-[#222e35]">
                <div className="flex items-center gap-3.5">
                  <div className="relative group">
                    <UserAvatar
                      name={user?.name || 'Administrador'}
                      avatarUrl={user?.avatarUrl}
                      size="lg"
                    />
                    <button
                      onClick={() => setIsEditingAvatar(!isEditingAvatar)}
                      className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#00a884] text-white shadow-md hover:bg-[#009374] transition-colors"
                      title="Editar foto de perfil"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{user?.name || 'Administrador'}</div>
                    <div className="text-gray-400 text-[11px] truncate">{user?.email || 'admin@empresa.com'}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#00a884]/20 text-[#00a884]">
                        {currentAccount?.name || 'Workspace Conectado'}
                      </span>
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#374248] text-gray-300 capitalize">
                        {user?.role === 'admin' ? 'Administrador' : 'Atendente'}
                      </span>
                    </div>
                  </div>
                </div>

                {isEditingAvatar && (
                  <div className="pt-3 border-t border-[#222e35] space-y-2">
                    <label className="text-[11px] text-gray-400 block font-medium">
                      Personalizar Foto de Perfil (URL da imagem ou inicial padrão):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        placeholder="https://exemplo.com/sua-foto.jpg"
                        value={avatarUrlInput}
                        onChange={(e) => setAvatarUrlInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[#202c33] border border-[#313d45] text-xs text-white focus:outline-none focus:border-[#00a884]"
                      />
                      <button
                        onClick={() => {
                          if (avatarUrlInput.trim()) {
                            updateUserProfile({ avatarUrl: avatarUrlInput.trim() });
                            setIsEditingAvatar(false);
                            setAvatarUrlInput('');
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#00a884] text-white font-bold text-xs hover:bg-[#009374]"
                      >
                        Salvar
                      </button>
                      {user?.avatarUrl && (
                        <button
                          onClick={() => {
                            updateUserProfile({ avatarUrl: undefined });
                            setIsEditingAvatar(false);
                            setAvatarUrlInput('');
                          }}
                          className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          title="Remover foto e usar iniciais padrão"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400">
                      Por padrão, o sistema exibe suas iniciais elegantes no tom verde WhatsApp, sem fotos de estranhos.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-[#111b21] border border-[#222e35] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Segurança de Autenticação</span>
                  <span className="text-[#00a884] font-bold">Autenticação ChatsApp (Criptografada)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Isolamento Multi-tenant</span>
                  <span className="text-gray-300 font-mono">Restrito à empresa</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Servidor em Nuvem</span>
                  <span className="text-gray-300 font-mono">Conectado e Seguro</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 rounded-lg bg-[#00a884] hover:bg-[#02906f] text-white font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / SUB-VIEW: Notificações */}
      {activeModal === 'notifications' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
              darkMode ? 'bg-[#202c33] border-[#2f3b43] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 font-bold text-base">
                <Bell className="w-5 h-5 text-[#00a884]" />
                <span>Configurar Notificações</span>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 rounded-xl bg-[#111b21] border border-[#222e35] cursor-pointer">
                <div>
                  <div className="font-semibold">Sons de Mensagem</div>
                  <div className="text-[11px] text-gray-400">Reproduzir som ao receber nova mensagem</div>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSound}
                  onChange={(e) => setNotificationSound(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884]"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-[#111b21] border border-[#222e35] cursor-pointer">
                <div>
                  <div className="font-semibold">Alertas na Área de Trabalho</div>
                  <div className="text-[11px] text-gray-400">Exibir pop-up ao receber novas mensagens</div>
                </div>
                <input
                  type="checkbox"
                  checked={desktopAlerts}
                  onChange={(e) => setDesktopAlerts(e.target.checked)}
                  className="w-4 h-4 accent-[#00a884]"
                />
              </label>

              {/* Botão de Testar Notificações */}
              <div className="pt-2">
                <button
                  type="button"
                  id="btn-test-notification"
                  onClick={() => {
                    testNotificationSystem();
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-colors cursor-pointer ${
                    darkMode
                      ? 'bg-[#111b21] hover:bg-[#182229] border-[#222e35] text-[#00a884]'
                      : 'bg-[#f0f2f5] hover:bg-[#e9edef] border-[#e9edef] text-[#00a884]'
                  }`}
                >
                  <Volume2 className="w-4 h-4 text-[#00a884]" />
                  <span>Testar Som e Notificação Agora</span>
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                  darkMode ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-save-notification-prefs"
                onClick={() => {
                  setSoundNotificationEnabled(notificationSound);
                  setDesktopNotificationPrefEnabled(desktopAlerts);
                  setActiveModal('none');
                }}
                className="px-4 py-2 rounded-lg bg-[#00a884] hover:bg-[#02906f] text-white font-bold text-xs cursor-pointer"
              >
                Salvar Preferências
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / SUB-VIEW: Atalhos do Teclado */}
      {activeModal === 'shortcuts' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-lg rounded-2xl p-6 shadow-2xl border ${
              darkMode ? 'bg-[#202c33] border-[#2f3b43] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 font-bold text-base">
                <Keyboard className="w-5 h-5 text-[#00a884]" />
                <span>Atalhos do Teclado (ChatsApp Web)</span>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs max-h-72 overflow-y-auto pr-1">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#111b21]">
                <span>Nova conversa</span>
                <kbd className="px-2 py-1 rounded bg-[#202c33] border border-gray-700 font-mono text-[11px]">Ctrl + Alt + N</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#111b21]">
                <span>Próxima conversa</span>
                <kbd className="px-2 py-1 rounded bg-[#202c33] border border-gray-700 font-mono text-[11px]">Ctrl + Alt + Tab</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#111b21]">
                <span>Pesquisar conversas</span>
                <kbd className="px-2 py-1 rounded bg-[#202c33] border border-gray-700 font-mono text-[11px]">Ctrl + Alt + /</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#111b21]">
                <span>Painel CRM / Cliente</span>
                <kbd className="px-2 py-1 rounded bg-[#202c33] border border-gray-700 font-mono text-[11px]">Ctrl + Alt + P</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#111b21]">
                <span>Fechar chat atual</span>
                <kbd className="px-2 py-1 rounded bg-[#202c33] border border-gray-700 font-mono text-[11px]">Escape</kbd>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 rounded-lg bg-[#00a884] hover:bg-[#02906f] text-white font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / SUB-VIEW: Ajuda e feedback */}
      {activeModal === 'help' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
              darkMode ? 'bg-[#202c33] border-[#2f3b43] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5 font-bold text-base">
                <HelpCircle className="w-5 h-5 text-[#00a884]" />
                <span>Ajuda e Feedback</span>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-gray-300">
              <div className="p-3 rounded-xl bg-[#111b21] border border-[#222e35]">
                <div className="font-bold text-sm text-[#00a884] mb-1">Central de Ajuda MonarcaHub</div>
                <p className="text-[11px] text-gray-400">
                  Documentação oficial de conexão, regras de negócio e integrações de atendimento.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#111b21] border border-[#222e35] flex items-center justify-between">
                <div>
                  <div className="font-semibold">Suporte Técnico</div>
                  <div className="text-[11px] text-gray-400">suporte@monarcahub.com</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00a884]/20 text-[#00a884]">
                  Online
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 rounded-lg bg-[#00a884] hover:bg-[#02906f] text-white font-bold text-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / SUB-VIEW: Empresas & Clientes Multi-Tenant */}
      {activeModal === 'tenants' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
              darkMode ? 'bg-[#202c33] border-[#2f3b43] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between mb-4 border-b border-[#313d45]/50 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00a884]/20 text-[#00a884] flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Empresas & Clientes</h3>
                  <p className="text-xs text-[#8696a0]">Ambientes isolados por account_id</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal('none')}
                className="p-1 rounded-full text-[#8696a0] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8696a0] mb-4 leading-relaxed">
              Alterne entre as empresas cadastradas para gerenciar as conversas correspondentes com isolamento de dados garantido:
            </p>

            <div className="space-y-2 mb-6">
              {availableAccounts.map((acc) => {
                const isCurrent = currentAccount?.id === acc.id;
                return (
                  <div
                    key={acc.id}
                    onClick={() => {
                      if (onSwitchAccount) onSwitchAccount(acc.id);
                      setActiveModal('none');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isCurrent
                        ? 'bg-[#00a884]/15 border-[#00a884] text-white'
                        : darkMode
                        ? 'bg-[#111b21] border-[#222e35] hover:border-[#313d45] text-[#d1d7db]'
                        : 'bg-[#f7f9fa] border-gray-200 hover:border-gray-300 text-[#111b21]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          isCurrent ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#8696a0]'
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold flex items-center gap-1.5">
                          {acc.name}
                          {isCurrent && (
                            <span className="text-[10px] bg-[#00a884] text-white px-1.5 py-0.2 rounded font-normal">
                              Ativo
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#8696a0]">
                          {acc.segment} • {acc.whatsappPhone}
                        </p>
                      </div>
                    </div>

                    {isCurrent && <Check className="w-4 h-4 text-[#00a884]" />}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#009374] text-white font-semibold text-xs transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / SUB-VIEW: Desconectar */}
      {activeModal === 'logout' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl border ${
              darkMode ? 'bg-[#202c33] border-[#2f3b43] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
            }`}
          >
            <div className="flex items-center gap-3 mb-3 text-rose-500 font-bold text-base">
              <LogOut className="w-5 h-5" />
              <span>Deseja desconectar?</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-6">
              Você será desconectado da sessão local do ChatsApp Web. Suas mensagens e dados em nuvem continuarão sincronizados normalmente.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setActiveModal('none')}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setActiveModal('none');
                  if (onLogout) {
                    onLogout();
                  } else {
                    onBackToChats();
                  }
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
              >
                Desconectar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
