import React, { useEffect, useRef, useState } from 'react';
import {
  Info,
  Search,
  CheckSquare,
  BellOff,
  Clock,
  Lock,
  Heart,
  Contact,
  Download,
  XCircle,
  Link2,
  ThumbsDown,
  Ban,
  MinusCircle,
  Trash2,
  ChevronRight,
  Check,
  Archive,
} from 'lucide-react';
import { Conversation } from '../types';

interface ChatMenuDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  darkMode: boolean;
  onContactInfo: () => void;
  onSearch: () => void;
  onSelectMessages: () => void;
  onMuteNotifications: (duration: string) => void;
  onDisappearingMessages: () => void;
  onLockChat: () => void;
  onToggleFavorite: () => void;
  onToggleArchive?: () => void;
  onChangeList: () => void;
  onExportChat: () => void;
  onCloseChat: () => void;
  onSendCallLink: () => void;
  onReport: () => void;
  onBlock: () => void;
  onClearChat: () => void;
  onDeleteChat: () => void;
}

export const ChatMenuDropdown: React.FC<ChatMenuDropdownProps> = ({
  isOpen,
  onClose,
  conversation,
  darkMode,
  onContactInfo,
  onSearch,
  onSelectMessages,
  onMuteNotifications,
  onDisappearingMessages,
  onLockChat,
  onToggleFavorite,
  onToggleArchive,
  onChangeList,
  onExportChat,
  onCloseChat,
  onSendCallLink,
  onReport,
  onBlock,
  onClearChat,
  onDeleteChat,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMuteSubmenu, setShowMuteSubmenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
        setShowMuteSubmenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        setShowMuteSubmenu(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const bgClasses = darkMode
    ? 'bg-[#233138] border-[#2a3942] text-[#d1d7db] shadow-2xl'
    : 'bg-white border-[#e9edef] text-[#3b4a54] shadow-xl';

  const hoverClasses = darkMode ? 'hover:bg-[#182229] hover:text-[#e9edef]' : 'hover:bg-[#f5f6f6] hover:text-[#111b21]';
  const iconColor = darkMode ? 'text-[#8696a0]' : 'text-[#54656f]';
  const dividerColor = darkMode ? 'border-[#313d45]' : 'border-[#e9edef]';

  return (
    <div
      ref={menuRef}
      id="chat-more-options-menu"
      className={`absolute right-2 top-14 z-50 w-64 md:w-68 rounded-xl border py-1.5 text-[14px] transition-all duration-150 animate-in fade-in zoom-in-95 ${bgClasses}`}
      role="menu"
    >
      {/* 1. Dados do contato */}
      <button
        id="menu-item-contact-info"
        onClick={() => {
          onContactInfo();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <Info className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
          <span>Dados do contato</span>
        </div>
      </button>

      {/* 2. Pesquisar */}
      <button
        id="menu-item-search"
        onClick={() => {
          onSearch();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <Search className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
          <span>Pesquisar</span>
        </div>
      </button>

      {/* 3. Selecionar mensagens */}
      <button
        id="menu-item-select-messages"
        onClick={() => {
          onSelectMessages();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <CheckSquare className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
          <span>Selecionar mensagens</span>
        </div>
      </button>

      {/* 4. Silenciar notificações (com submenu) */}
      <div className="relative">
        <button
          id="menu-item-mute-notifications"
          onClick={() => setShowMuteSubmenu(!showMuteSubmenu)}
          onMouseEnter={() => setShowMuteSubmenu(true)}
          className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
          role="menuitem"
        >
          <div className="flex items-center gap-3">
            <BellOff className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
            <span>Silenciar notificações</span>
          </div>
          <ChevronRight className={`w-4 h-4 shrink-0 ${iconColor}`} />
        </button>

        {showMuteSubmenu && (
          <div
            className={`absolute right-full top-0 mr-1 w-44 rounded-xl border py-1.5 text-[13.5px] z-50 shadow-2xl ${bgClasses}`}
            onMouseLeave={() => setShowMuteSubmenu(false)}
          >
            {['8 horas', '1 semana', 'Sempre'].map((period) => (
              <button
                key={period}
                onClick={() => {
                  onMuteNotifications(period);
                  setShowMuteSubmenu(false);
                  onClose();
                }}
                className={`w-full px-4 py-2 flex items-center justify-between text-left cursor-pointer ${hoverClasses}`}
              >
                <span>{period}</span>
                <Check className="w-3.5 h-3.5 opacity-0 hover:opacity-100" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 5. Mensagens temporárias */}
      <button
        id="menu-item-disappearing-messages"
        onClick={() => {
          onDisappearingMessages();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <Clock className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
          <span>Mensagens temporárias</span>
        </div>
      </button>

      {/* 6. Trancar conversa */}
      <button
        id="menu-item-lock-chat"
        onClick={() => {
          onLockChat();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <Lock className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
          <span>Trancar conversa</span>
        </div>
      </button>

      {/* 7. Adicionar aos Favoritos */}
      <button
        id="menu-item-toggle-favorite"
        onClick={() => {
          onToggleFavorite();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <Heart
            className={`w-[18px] h-[18px] shrink-0 ${
              conversation.isFavorite ? 'text-rose-500 fill-rose-500' : iconColor
            }`}
          />
          <span>{conversation.isFavorite ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}</span>
        </div>
      </button>

      {/* 8. Arquivar / Desarquivar conversa */}
      {onToggleArchive && (
        <button
          id="menu-item-archive-chat"
          onClick={() => {
            onToggleArchive();
            onClose();
          }}
          className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
          role="menuitem"
        >
          <div className="flex items-center gap-3">
            <Archive
              className={`w-[18px] h-[18px] shrink-0 ${
                conversation.isArchived ? 'text-[#00a884]' : iconColor
              }`}
            />
            <span>{conversation.isArchived ? 'Desarquivar conversa' : 'Arquivar conversa'}</span>
          </div>
        </button>
      )}

      {/* 9. Mudar lista */}
      <button
        id="menu-item-change-list"
        onClick={() => {
          onChangeList();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <Contact className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
          <span>Mudar lista</span>
        </div>
      </button>

      {/* 9. Exportar conversa */}
      <button
        id="menu-item-export-chat"
        onClick={() => {
          onExportChat();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <Download className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
          <span>Exportar conversa</span>
        </div>
      </button>

      {/* 10. Fechar conversa */}
      <button
        id="menu-item-close-conversation"
        onClick={() => {
          onCloseChat();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <XCircle className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
          <span>Fechar conversa</span>
        </div>
      </button>

      {/* Divider 1 */}
      <hr className={`my-1 border-t ${dividerColor}`} />

      {/* 11. Enviar link de ligação */}
      <button
        id="menu-item-send-call-link"
        onClick={() => {
          onSendCallLink();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <Link2 className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
          <span>Enviar link de ligação</span>
        </div>
      </button>

      {/* Divider 2 */}
      <hr className={`my-1 border-t ${dividerColor}`} />

      {/* 12. Denunciar */}
      <button
        id="menu-item-report"
        onClick={() => {
          onReport();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <ThumbsDown className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
          <span>Denunciar</span>
        </div>
      </button>

      {/* 13. Bloquear */}
      <button
        id="menu-item-block"
        onClick={() => {
          onBlock();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <Ban className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
          <span>Bloquear</span>
        </div>
      </button>

      {/* 14. Limpar conversa */}
      <button
        id="menu-item-clear-chat"
        onClick={() => {
          onClearChat();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer ${hoverClasses}`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <MinusCircle className={`w-[18px] h-[18px] shrink-0 ${iconColor}`} />
          <span>Limpar conversa</span>
        </div>
      </button>

      {/* 15. Apagar conversa */}
      <button
        id="menu-item-delete-chat"
        onClick={() => {
          onDeleteChat();
          onClose();
        }}
        className={`w-full px-4 py-2.5 flex items-center justify-between transition-colors text-left cursor-pointer text-rose-400 hover:text-rose-300 ${
          darkMode ? 'hover:bg-[#182229]' : 'hover:bg-[#fef2f2]'
        }`}
        role="menuitem"
      >
        <div className="flex items-center gap-3">
          <Trash2 className="w-[18px] h-[18px] shrink-0 text-rose-400" />
          <span>Apagar conversa</span>
        </div>
      </button>
    </div>
  );
};
