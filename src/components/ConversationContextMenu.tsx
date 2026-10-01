import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  BellOff,
  Bell,
  Pin,
  PinOff,
  CheckCheck,
  Mail,
  Heart,
  Tag,
  MinusCircle,
  Trash2,
  ChevronRight,
  AlertTriangle,
  X,
  UserPlus,
  UserCheck,
  Pencil,
  Phone,
  User,
  Check,
} from 'lucide-react';
import { Conversation } from '../types';

export interface ConversationContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  position: { x: number; y: number } | null;
  darkMode?: boolean;
  onArchive: (id: string) => void;
  onMute: (id: string, duration?: string) => void;
  onPin: (id: string) => void;
  onToggleUnread: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onAddTag?: (id: string) => void;
  onClearChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onUpdateContact?: (id: string, data: { name: string; phone?: string }) => void;
}

export const ConversationContextMenu: React.FC<ConversationContextMenuProps> = ({
  isOpen,
  onClose,
  conversation,
  position,
  darkMode = true,
  onArchive,
  onMute,
  onPin,
  onToggleUnread,
  onToggleFavorite,
  onAddTag,
  onClearChat,
  onDeleteChat,
  onUpdateContact,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showMuteSubmenu, setShowMuteSubmenu] = useState(false);
  const [confirmModal, setConfirmModal] = useState<'clear' | 'delete' | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  // Determina se o contato já possui um nome salvo ou se é apenas um número de telefone não salvo
  const isContactSaved = React.useMemo(() => {
    const name = conversation.contact.name?.trim() || '';
    const phone = conversation.contact.phone?.trim() || '';
    if (!name) return false;
    if (name === phone) return false;
    // Se o nome é puramente um número com +, dígitos, hífens ou parênteses
    if (/^\+?[\d\s\-().]{7,}$/.test(name)) return false;
    return true;
  }, [conversation.contact.name, conversation.contact.phone]);

  // Estados para edição do contato
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  // Sincroniza campos quando o modal abre
  useEffect(() => {
    if (showContactModal) {
      const rawName = conversation.contact.name || '';
      const rawPhone = conversation.contact.phone || (/^\+?[\d\s\-().]{7,}$/.test(rawName) ? rawName : '');
      
      if (isContactSaved) {
        const parts = rawName.trim().split(' ');
        if (parts.length > 1) {
          setFirstName(parts[0]);
          setLastName(parts.slice(1).join(' '));
        } else {
          setFirstName(rawName);
          setLastName('');
        }
      } else {
        setFirstName('');
        setLastName('');
      }
      setPhoneInput(rawPhone);
    }
  }, [showContactModal, conversation, isContactSaved]);

  // Fecha no clique externo ou ESC
  useEffect(() => {
    if (!isOpen) {
      setShowMuteSubmenu(false);
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (confirmModal || showContactModal) return; // Não fecha se modal estiver ativo
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmModal) {
          setConfirmModal(null);
        } else if (showContactModal) {
          setShowContactModal(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, confirmModal, showContactModal]);

  if (!isOpen || !position) return null;

  // Ajusta posicionamento na tela para nunca estourar para fora da viewport
  const menuWidth = 230;
  const menuHeight = 400;
  const padding = 12;

  let posX = position.x;
  let posY = position.y;

  if (typeof window !== 'undefined') {
    if (posX + menuWidth > window.innerWidth - padding) {
      posX = Math.max(padding, position.x - menuWidth);
    }
    if (posY + menuHeight > window.innerHeight - padding) {
      posY = Math.max(padding, window.innerHeight - menuHeight - padding);
    }
  }

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const handleSaveContact = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const full = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    if (!full) return;

    if (onUpdateContact) {
      onUpdateContact(conversation.id, {
        name: full,
        phone: phoneInput.trim() || undefined,
      });
    }
    setShowContactModal(false);
    onClose();
  };

  return (
    <>
      {/* Menu Contextual Dropdown */}
      {!showContactModal && !confirmModal && (
        <div
          ref={menuRef}
          id={`conversation-context-menu-${conversation.id}`}
          style={{
            top: `${posY}px`,
            left: `${posX}px`,
          }}
          className={`fixed z-50 w-[230px] rounded-xl shadow-2xl py-1.5 border select-none animate-in fade-in zoom-in-95 duration-100 ${
            darkMode
              ? 'bg-[#233138] border-[#2a3942] text-[#d1d7db]'
              : 'bg-white border-[#e9edef] text-[#111b21] shadow-xl'
          }`}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 0. Adicionar aos contatos (se ainda não salvo) OU Editar contato (se já salvo) */}
          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors cursor-pointer ${
              darkMode ? 'hover:bg-[#182229] hover:text-[#e9edef]' : 'hover:bg-[#f5f6f6]'
            }`}
          >
            {isContactSaved ? (
              <UserCheck className="w-4 h-4 text-[#8696a0]" />
            ) : (
              <UserPlus className="w-4 h-4 text-[#8696a0]" />
            )}
            <span>{isContactSaved ? 'Editar contato' : 'Adicionar aos contatos'}</span>
          </button>

          {/* 1. Arquivar conversa */}
          <button
            type="button"
            onClick={() => handleAction(() => onArchive(conversation.id))}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors cursor-pointer ${
              darkMode ? 'hover:bg-[#182229] hover:text-[#e9edef]' : 'hover:bg-[#f5f6f6]'
            }`}
          >
            {conversation.isArchived ? (
              <ArchiveRestore className="w-4 h-4 text-[#8696a0]" />
            ) : (
              <Archive className="w-4 h-4 text-[#8696a0]" />
            )}
            <span>{conversation.isArchived ? 'Desarquivar conversa' : 'Arquivar conversa'}</span>
          </button>

          {/* 2. Silenciar notificações (com submenu) */}
          <div
            className="relative"
            onMouseEnter={() => setShowMuteSubmenu(true)}
            onMouseLeave={() => setShowMuteSubmenu(false)}
          >
            <button
              type="button"
              onClick={() => handleAction(() => onMute(conversation.id))}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-xs text-left transition-colors cursor-pointer ${
                darkMode ? 'hover:bg-[#182229] hover:text-[#e9edef]' : 'hover:bg-[#f5f6f6]'
              }`}
            >
              <div className="flex items-center gap-3">
                {conversation.isMuted ? (
                  <Bell className="w-4 h-4 text-[#8696a0]" />
                ) : (
                  <BellOff className="w-4 h-4 text-[#8696a0]" />
                )}
                <span>{conversation.isMuted ? 'Reativar notificações' : 'Silenciar notificações'}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#8696a0]" />
            </button>

            {/* Submenu de duração do silenciamento */}
            {showMuteSubmenu && !conversation.isMuted && (
              <div
                className={`absolute top-0 left-full ml-1 w-44 rounded-xl shadow-2xl py-1.5 border z-50 ${
                  darkMode ? 'bg-[#233138] border-[#2a3942] text-[#d1d7db]' : 'bg-white border-[#e9edef] text-[#111b21]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleAction(() => onMute(conversation.id, '8_hours'))}
                  className={`w-full flex items-center px-4 py-2 text-xs text-left transition-colors cursor-pointer ${
                    darkMode ? 'hover:bg-[#182229]' : 'hover:bg-[#f5f6f6]'
                  }`}
                >
                  8 horas
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(() => onMute(conversation.id, '1_week'))}
                  className={`w-full flex items-center px-4 py-2 text-xs text-left transition-colors cursor-pointer ${
                    darkMode ? 'hover:bg-[#182229]' : 'hover:bg-[#f5f6f6]'
                  }`}
                >
                  1 semana
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(() => onMute(conversation.id, 'always'))}
                  className={`w-full flex items-center px-4 py-2 text-xs text-left transition-colors cursor-pointer ${
                    darkMode ? 'hover:bg-[#182229]' : 'hover:bg-[#f5f6f6]'
                  }`}
                >
                  Sempre
                </button>
              </div>
            )}
          </div>

          {/* 3. Fixar conversa */}
          <button
            type="button"
            onClick={() => handleAction(() => onPin(conversation.id))}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors cursor-pointer ${
              darkMode ? 'hover:bg-[#182229] hover:text-[#e9edef]' : 'hover:bg-[#f5f6f6]'
            }`}
          >
            {conversation.isPinned ? (
              <PinOff className="w-4 h-4 text-[#8696a0]" />
            ) : (
              <Pin className="w-4 h-4 text-[#8696a0] rotate-45" />
            )}
            <span>{conversation.isPinned ? 'Desafixar conversa' : 'Fixar conversa'}</span>
          </button>

          {/* 4. Marcar como lida / não lida */}
          <button
            type="button"
            onClick={() => handleAction(() => onToggleUnread(conversation.id))}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors cursor-pointer ${
              darkMode ? 'hover:bg-[#182229] hover:text-[#e9edef]' : 'hover:bg-[#f5f6f6]'
            }`}
          >
            {conversation.unreadCount > 0 ? (
              <CheckCheck className="w-4 h-4 text-[#8696a0]" />
            ) : (
              <Mail className="w-4 h-4 text-[#8696a0]" />
            )}
            <span>{conversation.unreadCount > 0 ? 'Marcar como lida' : 'Marcar como não lida'}</span>
          </button>

          {/* 5. Adicionar aos Favoritos */}
          <button
            type="button"
            onClick={() => handleAction(() => onToggleFavorite(conversation.id))}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors cursor-pointer ${
              darkMode ? 'hover:bg-[#182229] hover:text-[#e9edef]' : 'hover:bg-[#f5f6f6]'
            }`}
          >
            <Heart
              className={`w-4 h-4 ${
                conversation.isFavorite ? 'text-red-500 fill-red-500' : 'text-[#8696a0]'
              }`}
            />
            <span>{conversation.isFavorite ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}</span>
          </button>

          {/* 6. Adicionar à lista / Etiquetas */}
          <button
            type="button"
            onClick={() => {
              if (onAddTag) {
                handleAction(() => onAddTag(conversation.id));
              } else {
                onClose();
              }
            }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors cursor-pointer ${
              darkMode ? 'hover:bg-[#182229] hover:text-[#e9edef]' : 'hover:bg-[#f5f6f6]'
            }`}
          >
            <Tag className="w-4 h-4 text-[#8696a0]" />
            <span>Adicionar à lista</span>
          </button>

          {/* Divisória sutil */}
          <div
            className={`h-[1px] my-1.5 ${
              darkMode ? 'bg-[#2a3942]' : 'bg-[#e9edef]'
            }`}
          />

          {/* 7. Limpar conversa */}
          <button
            type="button"
            onClick={() => setConfirmModal('clear')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors cursor-pointer ${
              darkMode ? 'hover:bg-[#182229] hover:text-[#e9edef]' : 'hover:bg-[#f5f6f6]'
            }`}
          >
            <MinusCircle className="w-4 h-4 text-[#8696a0]" />
            <span>Limpar conversa</span>
          </button>

          {/* 8. Apagar conversa */}
          <button
            type="button"
            onClick={() => setConfirmModal('delete')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors cursor-pointer text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>Apagar conversa</span>
          </button>
        </div>
      )}

      {/* Modal: Adicionar aos Contatos / Editar Contato */}
      {showContactModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setShowContactModal(false);
            onClose();
          }}
        >
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 duration-150 ${
              darkMode ? 'bg-[#202c33] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do modal */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#00a884]/15 text-[#00a884] flex items-center justify-center shrink-0">
                  {isContactSaved ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-semibold">
                    {isContactSaved ? 'Editar contato' : 'Adicionar aos contatos'}
                  </h3>
                  <p className={`text-xs ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                    {conversation.contact.phone || (conversation.contact.channel === 'whatsapp' ? 'WhatsApp' : 'Conversa Omnichannel')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowContactModal(false);
                  onClose();
                }}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  darkMode ? 'hover:bg-white/10 text-[#8696a0]' : 'hover:bg-black/5 text-[#54656f]'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Foto e pré-visualização */}
            <div className="flex items-center gap-4 py-4">
              <div className="relative">
                <img
                  src={conversation.contact.avatarUrl}
                  alt={conversation.contact.name}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-[#00a884]/30"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-[#e9edef]">
                  {[firstName, lastName].filter(Boolean).join(' ') || conversation.contact.name}
                </p>
                <p className={`text-xs truncate ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                  {phoneInput || conversation.contact.phone || 'Sem número cadastrado'}
                </p>
              </div>
            </div>

            {/* Formulário de edição */}
            <form onSubmit={handleSaveContact} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-[#8696a0]' : 'text-[#54656f]'}`}>
                  Nome <span className="text-[#00a884]">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder={isContactSaved ? 'Nome do contato' : 'Ex: Alex'}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition-all outline-hidden ${
                    darkMode
                      ? 'bg-[#111b21] border-[#2a3942] text-[#e9edef] focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]'
                      : 'bg-[#f0f2f5] border-[#d1d7db] text-[#111b21] focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-[#8696a0]' : 'text-[#54656f]'}`}>
                  Sobrenome / Empresa (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: MonarcaHub ou Silva"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm border transition-all outline-hidden ${
                    darkMode
                      ? 'bg-[#111b21] border-[#2a3942] text-[#e9edef] focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]'
                      : 'bg-[#f0f2f5] border-[#d1d7db] text-[#111b21] focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1.5 ${darkMode ? 'text-[#8696a0]' : 'text-[#54656f]'}`}>
                  Número de telefone
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="+55 (XX) XXXXX-XXXX"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm border transition-all outline-hidden ${
                      darkMode
                        ? 'bg-[#111b21] border-[#2a3942] text-[#e9edef] focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]'
                        : 'bg-[#f0f2f5] border-[#d1d7db] text-[#111b21] focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]'
                    }`}
                  />
                  <Phone className="w-4 h-4 text-[#8696a0] absolute left-3 top-3" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-500/20">
                <button
                  type="button"
                  onClick={() => {
                    setShowContactModal(false);
                    onClose();
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    darkMode ? 'hover:bg-white/10 text-[#d1d7db]' : 'hover:bg-black/5 text-[#54656f]'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!firstName.trim()}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                    firstName.trim()
                      ? 'bg-[#00a884] hover:bg-[#02906f] text-white shadow-[#00a884]/20'
                      : 'bg-gray-500/30 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{isContactSaved ? 'Salvar alterações' : 'Salvar contato'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação: Limpar Conversa */}
      {confirmModal === 'clear' && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmModal(null);
            onClose();
          }}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 duration-150 ${
              darkMode ? 'bg-[#233138] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4 text-[#e9edef]">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                <MinusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Limpar esta conversa?</h3>
                <p className={`text-xs ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                  {conversation.contact.name}
                </p>
              </div>
            </div>

            <p className={`text-xs mb-6 leading-relaxed ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
              Todas as mensagens desta conversa serão apagadas permanentemente. O contato continuará na sua lista.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmModal(null);
                  onClose();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  darkMode ? 'hover:bg-white/10 text-[#d1d7db]' : 'hover:bg-black/5 text-[#54656f]'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearChat(conversation.id);
                  setConfirmModal(null);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-black transition-colors cursor-pointer"
              >
                Limpar mensagens
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação: Apagar Conversa */}
      {confirmModal === 'delete' && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmModal(null);
            onClose();
          }}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 duration-150 ${
              darkMode ? 'bg-[#233138] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4 text-[#e9edef]">
              <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-red-400">Apagar conversa?</h3>
                <p className={`text-xs ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                  {conversation.contact.name}
                </p>
              </div>
            </div>

            <p className={`text-xs mb-6 leading-relaxed ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
              Tem certeza de que deseja apagar esta conversa? O histórico e o contato serão removidos da lista. Esta ação não pode ser desfeita.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmModal(null);
                  onClose();
                }}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  darkMode ? 'hover:bg-white/10 text-[#d1d7db]' : 'hover:bg-black/5 text-[#54656f]'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteChat(conversation.id);
                  setConfirmModal(null);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors cursor-pointer shadow-lg shadow-red-500/25"
              >
                Apagar conversa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
