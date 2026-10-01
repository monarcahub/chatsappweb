import React from 'react';
import {
  MessageSquare,
  Phone,
  CircleDashed,
  Layers,
  Brain,
  Briefcase,
  Settings
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';

interface LeftNavRailProps {
  activeTab: 'chats' | 'status' | 'channels' | 'settings';
  onSelectTab: (tab: 'chats' | 'status' | 'channels' | 'settings') => void;
  unreadChatsCount: number;
  onOpenCallsNotice: () => void;
  onOpenAIBrain: () => void;
  onToggleCRM: () => void;
  isCRMOpen: boolean;
  darkMode: boolean;
  isAIActive?: boolean;
  userName?: string;
  userAvatar?: string;
  companyName?: string;
  onOpenProfile?: () => void;
}

export const LeftNavRail: React.FC<LeftNavRailProps> = ({
  activeTab,
  onSelectTab,
  unreadChatsCount,
  onOpenCallsNotice,
  onOpenAIBrain,
  onToggleCRM,
  isCRMOpen,
  darkMode,
  isAIActive = true,
  userName = 'Usuário',
  userAvatar,
  companyName = 'Workspace',
  onOpenProfile,
}) => {
  return (
    <div
      className={`w-14 flex flex-col items-center justify-between py-3 border-r select-none shrink-0 z-30 transition-colors ${
        darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-[#f0f2f5] border-[#e9edef]'
      }`}
    >
      {/* Top icons stack */}
      <div className="flex flex-col items-center gap-2.5 w-full">
        {/* 1. Conversas (Chats) with green unread badge */}
        <button
          id="rail-btn-chats"
          onClick={() => onSelectTab('chats')}
          className={`relative p-2.5 rounded-full transition-colors ${
            activeTab === 'chats'
              ? darkMode
                ? 'bg-[#374248] text-white'
                : 'bg-[#e9edef] text-[#111b21]'
              : darkMode
              ? 'text-[#aebac1] hover:bg-[#374248]'
              : 'text-[#54656f] hover:bg-[#e9edef]'
          }`}
          title="Conversas"
        >
          <MessageSquare className="w-5 h-5 fill-current" />
          {unreadChatsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#25d366] text-black text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
              {unreadChatsCount}
            </span>
          )}
        </button>

        {/* 2. Ligações (Trigger aviso popup conforme solicitado) */}
        <button
          id="rail-btn-calls"
          onClick={onOpenCallsNotice}
          className={`p-2.5 rounded-full transition-colors ${
            darkMode ? 'text-[#aebac1] hover:bg-[#374248]' : 'text-[#54656f] hover:bg-[#e9edef]'
          }`}
          title="Ligações"
        >
          <Phone className="w-5 h-5" />
        </button>

        {/* 3. Status */}
        <button
          id="rail-btn-status"
          onClick={() => onSelectTab('status')}
          className={`p-2.5 rounded-full transition-colors ${
            activeTab === 'status'
              ? darkMode
                ? 'bg-[#374248] text-white'
                : 'bg-[#e9edef] text-[#111b21]'
              : darkMode
              ? 'text-[#aebac1] hover:bg-[#374248]'
              : 'text-[#54656f] hover:bg-[#e9edef]'
          }`}
          title="Status do WhatsApp"
        >
          <CircleDashed className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* 4. Canais Conectados ("Chats") */}
        <button
          id="rail-btn-channels"
          onClick={() => onSelectTab('channels')}
          className={`p-2.5 rounded-full transition-colors ${
            activeTab === 'channels'
              ? darkMode
                ? 'bg-[#374248] text-white'
                : 'bg-[#e9edef] text-[#111b21]'
              : darkMode
              ? 'text-[#aebac1] hover:bg-[#374248]'
              : 'text-[#54656f] hover:bg-[#e9edef]'
          }`}
          title="Chats (Canais Conectados: WhatsApp 1, Whats 2, Instagram, Webchat)"
        >
          <Layers className="w-5 h-5" />
        </button>

        {/* 5. Cérebro da IA (Aprendizado, Regras e Exclusões) */}
        <button
          id="rail-btn-ai-brain"
          onClick={onOpenAIBrain}
          className={`relative p-2.5 rounded-full transition-all cursor-pointer ${
            isAIActive
              ? darkMode
                ? 'text-purple-400 hover:bg-purple-950/50 hover:text-purple-300 ring-1 ring-purple-500/30'
                : 'text-purple-600 hover:bg-purple-100 ring-1 ring-purple-400/40'
              : darkMode
              ? 'text-amber-400 hover:bg-amber-950/40 ring-1 ring-amber-500/40'
              : 'text-amber-600 hover:bg-amber-100 ring-1 ring-amber-400/40'
          }`}
          title={
            isAIActive
              ? 'Cérebro da IA [ATIVA EM TUDO] - Clique para gerenciar ou pausar'
              : 'Cérebro da IA [PAUSADA GERAL] - Atendimento 100% humano. Clique para ativar'
          }
        >
          <Brain className="w-5 h-5" />
          {/* Status Indicator Dot */}
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
            {isAIActive ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 bg-[#25d366] border-2 ${
                    darkMode ? 'border-[#202c33]' : 'border-[#f0f2f5]'
                  }`}
                />
              </>
            ) : (
              <span
                className={`relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 ${
                  darkMode ? 'border-[#202c33]' : 'border-[#f0f2f5]'
                }`}
              />
            )}
          </span>
        </button>

        {/* 6. Ferramentas Comerciais & CRM Omnichannel */}
        <button
          id="rail-btn-crm"
          onClick={onToggleCRM}
          className={`relative p-2.5 rounded-full transition-colors ${
            isCRMOpen
              ? 'bg-[#00a884]/20 text-[#00a884]'
              : darkMode
              ? 'text-[#aebac1] hover:bg-[#374248]'
              : 'text-[#54656f] hover:bg-[#e9edef]'
          }`}
          title="Ferramentas Comerciais & CRM"
        >
          <Briefcase className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#25d366]" />
        </button>
      </div>

      {/* Bottom icons stack (Configurações e Perfil) */}
      <div className="flex flex-col items-center gap-3 w-full">
        {/* Settings (Toggle: se já estiver aberto, fecha e volta para chats) */}
        <button
          id="rail-btn-settings"
          onClick={() => onSelectTab(activeTab === 'settings' ? 'chats' : 'settings')}
          className={`p-2 rounded-full transition-colors ${
            activeTab === 'settings'
              ? darkMode
                ? 'bg-[#374248] text-[#00a884]'
                : 'bg-[#e9edef] text-[#00a884]'
              : darkMode
              ? 'text-[#aebac1] hover:bg-[#374248]'
              : 'text-[#54656f] hover:bg-[#e9edef]'
          }`}
          title={activeTab === 'settings' ? 'Fechar configurações' : 'Configurações'}
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* User profile avatar (bottom) */}
        <div className="pt-1">
          <UserAvatar
            name={userName}
            avatarUrl={userAvatar}
            size="sm"
            onClick={onOpenProfile || (() => onSelectTab('settings'))}
            title={`${userName} (${companyName}) - Ver e alterar perfil`}
          />
        </div>
      </div>
    </div>
  );
};
