import React, { useEffect, useRef } from 'react';
import {
  Settings,
  User,
  Briefcase,
  Building2,
  CheckCheck,
  Lock,
  LogOut,
  Sparkles,
} from 'lucide-react';

interface TopMoreMenuDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenCRM?: () => void;
  onMarkAllAsRead: () => void;
  onLockApp: () => void;
  onLogout?: () => void;
  currentAccountName?: string;
  onOpenTenants?: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  isSettingsOpen?: boolean;
}

export const TopMoreMenuDropdown: React.FC<TopMoreMenuDropdownProps> = ({
  isOpen,
  onClose,
  darkMode,
  onOpenSettings,
  onOpenProfile,
  onOpenCRM,
  onMarkAllAsRead,
  onLockApp,
  onLogout,
  currentAccountName,
  onOpenTenants,
  triggerRef,
  isSettingsOpen = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Se o clique ocorreu dentro do botão acionador dos 3 pontinhos,
      // não fechamos aqui para permitir que o onClick do botão faça o toggle natural.
      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
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
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const bgClasses = darkMode
    ? 'bg-[#233138] border-[#2a3942] text-[#d1d7db] shadow-2xl'
    : 'bg-white border-[#e9edef] text-[#3b4a54] shadow-2xl';

  const hoverClasses = darkMode
    ? 'hover:bg-[#182229] hover:text-[#e9edef]'
    : 'hover:bg-[#f5f6f6] hover:text-[#111b21]';

  const iconColor = darkMode ? 'text-[#8696a0]' : 'text-[#54656f]';
  const dividerColor = darkMode ? 'border-[#2a3942]' : 'border-[#e9edef]';

  return (
    <div
      ref={menuRef}
      id="top-more-options-dropdown"
      className={`absolute right-1 top-11 z-50 w-64 rounded-2xl border py-2 text-[14px] transition-all duration-150 animate-in fade-in zoom-in-95 ${bgClasses}`}
      role="menu"
    >
      {/* 1. Configurações (Abre ou fecha o menu de configurações) */}
      <button
        id="dropdown-item-settings"
        onClick={() => {
          onClose();
          onOpenSettings();
        }}
        className={`w-full px-4 py-2.5 flex items-center gap-3.5 transition-colors text-left cursor-pointer group ${hoverClasses} ${
          isSettingsOpen ? (darkMode ? 'bg-[#182229]' : 'bg-[#f0f2f5]') : ''
        }`}
        role="menuitem"
      >
        <Settings
          className={`w-5 h-5 shrink-0 transition-colors ${
            isSettingsOpen
              ? 'text-[#00a884]'
              : `${iconColor} group-hover:text-[#00a884]`
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-medium block leading-tight">
              {isSettingsOpen ? 'Fechar configurações' : 'Configurações'}
            </span>
            {isSettingsOpen && (
              <span className="text-[10px] text-[#00a884] font-semibold bg-[#00a884]/15 px-1.5 py-0.5 rounded">
                Aberto
              </span>
            )}
          </div>
          <span className="text-[11px] text-[#8696a0] block truncate">
            {isSettingsOpen ? 'Voltar para as conversas' : 'Preferências, temas e conta'}
          </span>
        </div>
      </button>

      {/* 2. Perfil da empresa */}
      <button
        id="dropdown-item-profile"
        onClick={() => {
          onClose();
          onOpenProfile();
        }}
        className={`w-full px-4 py-2.5 flex items-center gap-3.5 transition-colors text-left cursor-pointer group ${hoverClasses}`}
        role="menuitem"
      >
        <User className={`w-5 h-5 shrink-0 ${iconColor} group-hover:text-[#00a884] transition-colors`} />
        <div className="flex-1 min-w-0">
          <span className="font-medium block leading-tight">Perfil da empresa</span>
          <span className="text-[11px] text-[#8696a0] block truncate">
            {currentAccountName || 'Dados comerciais & catálogo'}
          </span>
        </div>
      </button>

      {/* 3. Ferramentas comerciais & CRM */}
      {onOpenCRM && (
        <button
          id="dropdown-item-crm"
          onClick={() => {
            onClose();
            onOpenCRM();
          }}
          className={`w-full px-4 py-2.5 flex items-center gap-3.5 transition-colors text-left cursor-pointer group ${hoverClasses}`}
          role="menuitem"
        >
          <Briefcase className={`w-5 h-5 shrink-0 ${iconColor} group-hover:text-[#00a884] transition-colors`} />
          <div className="flex-1 min-w-0">
            <span className="font-medium block leading-tight">Ferramentas comerciais</span>
            <span className="text-[11px] text-[#8696a0] block truncate">
              Funil CRM, etiquetas e respostas
            </span>
          </div>
        </button>
      )}

      {/* 4. Empresas & Multi-Tenant (se fornecido) */}
      {onOpenTenants && (
        <button
          id="dropdown-item-tenants"
          onClick={() => {
            onClose();
            onOpenTenants();
          }}
          className={`w-full px-4 py-2.5 flex items-center gap-3.5 transition-colors text-left cursor-pointer group ${hoverClasses}`}
          role="menuitem"
        >
          <Building2 className={`w-5 h-5 shrink-0 ${iconColor} group-hover:text-[#00a884] transition-colors`} />
          <div className="flex-1 min-w-0">
            <span className="font-medium block leading-tight">Empresas & Clientes</span>
            <span className="text-[11px] text-[#8696a0] block truncate">
              Trocar ou cadastrar contas
            </span>
          </div>
        </button>
      )}

      {/* Divisor idêntico ao WhatsApp Web */}
      <div className={`my-1 border-t ${dividerColor}`} />

      {/* 5. Marcar todas como lidas (Exatamente como no print) */}
      <button
        id="dropdown-item-mark-all-read"
        onClick={() => {
          onClose();
          onMarkAllAsRead();
        }}
        className={`w-full px-4 py-3 flex items-center gap-3.5 transition-colors text-left cursor-pointer group ${hoverClasses}`}
        role="menuitem"
      >
        <CheckCheck className={`w-5 h-5 shrink-0 ${iconColor} group-hover:text-[#00a884] transition-colors`} />
        <span className="font-medium flex-1">Marcar todas como lidas</span>
      </button>

      {/* 6. Bloqueio do app (Exatamente como no print) */}
      <button
        id="dropdown-item-app-lock"
        onClick={() => {
          onClose();
          onLockApp();
        }}
        className={`w-full px-4 py-3 flex items-center gap-3.5 transition-colors text-left cursor-pointer group ${hoverClasses}`}
        role="menuitem"
      >
        <Lock className={`w-5 h-5 shrink-0 ${iconColor} group-hover:text-amber-400 transition-colors`} />
        <span className="font-medium flex-1">Bloqueio do app</span>
      </button>

      {/* 7. Desconectar (Exatamente como no print) */}
      {onLogout && (
        <button
          id="dropdown-item-logout"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className={`w-full px-4 py-3 flex items-center gap-3.5 transition-colors text-left cursor-pointer group ${hoverClasses} text-rose-400 hover:text-rose-300`}
          role="menuitem"
        >
          <LogOut className="w-5 h-5 shrink-0 text-rose-400 group-hover:text-rose-300 transition-colors" />
          <span className="font-medium flex-1">Desconectar</span>
        </button>
      )}
    </div>
  );
};
