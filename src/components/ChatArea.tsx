import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  Video,
  PanelRight,
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  Send,
  CheckCheck,
  Bot,
  UserCheck,
  CheckCircle2,
  Play,
  Pause,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Lock,
  Globe,
  Instagram,
  MessageSquare,
  X,
  Check,
  Copy,
  Trash2,
  Heart,
  Clock,
  Tag as TagIcon,
  Shield,
  Download,
  AlertTriangle,
  BellOff,
  Link2,
  CornerUpLeft,
  Star,
  Pin,
  Share2,
  Info,
  StickyNote,
  Image as ImageIcon,
  Archive,
  ArchiveRestore,
  FileText,
  Headphones,
  Loader2,
} from 'lucide-react';
import { Conversation, Message, ConversationStatus, Tag, MessageContentType } from '../types';
import { WhatsAppWallpaper } from './WhatsAppWallpaper';
import { formatSaoPauloTime, formatSaoPauloDate } from '../utils/dateFormat';
import { ChatMenuDropdown } from './ChatMenuDropdown';
import { AudioPlayer } from './AudioPlayer';
import { WhatsAppFormattedText, applyWhatsAppFormatting } from '../utils/whatsappFormatter';
import { WhatsAppFormatToolbar } from './WhatsAppFormatToolbar';
import { TelegramIcon } from './TelegramIcon';

interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (
    text: string,
    contentType?: MessageContentType,
    mediaUrl?: string,
    metadata?: Record<string, any>
  ) => void;
  onToggleRightPanel: () => void;
  isRightPanelOpen: boolean;
  onBackToConversations: () => void;
  darkMode: boolean;
  onUpdateStatus?: (conversationId: string, status: ConversationStatus) => void;
  isMobileMode?: boolean;
  onClearMessages?: (conversationId: string) => void;
  onDeleteConversation?: (conversationId: string) => void;
  onDeleteSelectedMessages?: (conversationId: string, messageIds: string[]) => void;
  onToggleFavorite?: (conversationId: string) => void;
  onToggleArchive?: (conversationId: string) => void;
  availableTags?: Tag[];
  onAddTag?: (tag) => void;
  onRemoveTag?: (tagId: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  messages,
  onSendMessage,
  onToggleRightPanel,
  isRightPanelOpen,
  onBackToConversations,
  darkMode,
  onUpdateStatus,
  isMobileMode = false,
  onClearMessages,
  onDeleteConversation,
  onDeleteSelectedMessages,
  onToggleFavorite,
  onToggleArchive,
  availableTags = [],
  onAddTag,
  onRemoveTag,
}) => {
  const [inputText, setInputText] = useState('');
  const [textSelection, setTextSelection] = useState<{ start: number; end: number } | null>(null);
  const [showTranscriptionMap, setShowTranscriptionMap] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Rolagem suave e controlada estritamente dentro da caixa de mensagens (sem mover a janela do navegador)
  const scrollToBottom = useCallback((smooth = false) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  // Suporte a Seleção de Mensagens por Toque Prolongado (Long Press / Pressionar na área da mensagem)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);

  const startLongPress = (msgId: string, clientX: number, clientY: number) => {
    touchStartPosRef.current = { x: clientX, y: clientY };
    didLongPressRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      try {
        navigator.vibrate?.([40]);
      } catch (_) {}
      setIsSelectionMode(true);
      setSelectedMessageIds((prev) => (prev.includes(msgId) ? prev : [...prev, msgId]));
    }, 400); // 400ms padrão de toque prolongado no mobile
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    // Se o usuário estiver deslizando o dedo para rolar o chat, cancela o timer
    if (dx > 8 || dy > 8) {
      cancelLongPress();
    }
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Monitora seleção de texto no textarea para exibir toolbar de formatação do WhatsApp
  const updateSelectionState = () => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      if (start !== end && textareaRef.current.value.slice(start, end).trim().length > 0) {
        setTextSelection({ start, end });
      } else {
        setTextSelection(null);
      }
    }
  };

  // Fecha toolbar ao clicar fora do input ou da barra
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[role="toolbar"]') || target === textareaRef.current) {
        return;
      }
      setTextSelection(null);
    };

    window.addEventListener('mousedown', handleGlobalClick);
    return () => window.removeEventListener('mousedown', handleGlobalClick);
  }, []);

  // Expansão responsiva automática da caixa de texto conforme quebra de linha (sem barra de rolagem)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(40, scrollHeight)}px`;
    }
  }, [inputText]);

  // 3-dots Menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // In-chat search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Message selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);

  // Disappearing messages state
  const [isDisappearingModalOpen, setIsDisappearingModalOpen] = useState(false);
  const [disappearingDuration, setDisappearingDuration] = useState('off');

  // Change lists/tags modal
  const [isChangeListModalOpen, setIsChangeListModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'report' | 'block' | 'clear' | 'delete' | 'delete_single_message' | null;
    title: string;
    description: string;
    confirmText: string;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    type: null,
    title: '',
    description: '',
    confirmText: '',
  });

  // Target message for single deletion
  const [targetMessageToDelete, setTargetMessageToDelete] = useState<Message | null>(null);

  // Message menu, reply, reactions, pin, star, details, and media preview states
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [messageDetailsModal, setMessageDetailsModal] = useState<Message | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [starredMessages, setStarredMessages] = useState<Record<string, boolean>>({});
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null);

  // Floating Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Attachment menu and modals (Imagem, Documento, Áudio)
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Attachment preview modals
  const [imagePreviewModal, setImagePreviewModal] = useState<{
    file: File;
    previewUrl: string;
    caption: string;
    isUploading?: boolean;
  } | null>(null);

  const [documentPreviewModal, setDocumentPreviewModal] = useState<{
    file: File;
    previewUrl: string;
    caption: string;
    formattedSize: string;
    isUploading?: boolean;
  } | null>(null);

  const [audioPreviewModal, setAudioPreviewModal] = useState<{
    file: File;
    previewUrl: string;
    formattedSize: string;
    isUploading?: boolean;
  } | null>(null);

  // Fecha menu de anexos ao clicar fora
  useEffect(() => {
    if (!isAttachmentMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        attachmentMenuRef.current &&
        !attachmentMenuRef.current.contains(e.target as Node)
      ) {
        setIsAttachmentMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAttachmentMenuOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  useEffect(() => {
    if (!isSearchOpen && !isSelectionMode) {
      // Rola apenas a div interna de mensagens, sem disparar scroll da janela do navegador no mobile
      scrollToBottom(true);
    }
  }, [messages, isSearchOpen, isSelectionMode, scrollToBottom]);

  // Reset states when conversation changes
  useEffect(() => {
    setIsMenuOpen(false);
    setIsAttachmentMenuOpen(false);
    setImagePreviewModal(null);
    setDocumentPreviewModal(null);
    setAudioPreviewModal(null);
    setIsSearchOpen(false);
    setSearchQuery('');
    setIsSelectionMode(false);
    setSelectedMessageIds([]);

    // Trava e reseta a janela do navegador no topo absoluto ao abrir conversa
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }

    // Posiciona instantaneamente no final das mensagens da nova conversa
    setTimeout(() => {
      scrollToBottom(false);
    }, 10);
  }, [conversation?.id, scrollToBottom]);

  // Handlers para seleção de arquivos de anexo
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreviewModal({
        file,
        previewUrl: dataUrl,
        caption: '',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDocumentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const formattedSize =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setDocumentPreviewModal({
        file,
        previewUrl: dataUrl,
        caption: '',
        formattedSize,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const formattedSize =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAudioPreviewModal({
        file,
        previewUrl: dataUrl,
        formattedSize,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmSendImage = async () => {
    if (!imagePreviewModal || imagePreviewModal.isUploading) return;
    const { file, previewUrl, caption } = imagePreviewModal;
    setImagePreviewModal((prev) => (prev ? { ...prev, isUploading: true } : null));

    let finalMediaUrl = previewUrl;
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: previewUrl,
          name: file.name,
          type: file.type,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.url) {
          finalMediaUrl = json.url;
        }
      }
    } catch (err) {
      console.warn('Upload fallback to dataUrl:', err);
    }

    onSendMessage(caption.trim() || 'Foto', 'image', finalMediaUrl, {
      fileName: file.name,
      fileSize:
        file.size > 1024 * 1024
          ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(file.size / 1024)} KB`,
      mimeType: file.type,
    });

    setImagePreviewModal(null);
    showToast('Imagem enviada com sucesso!');
  };

  const handleConfirmSendDocument = async () => {
    if (!documentPreviewModal || documentPreviewModal.isUploading) return;
    const { file, previewUrl, caption, formattedSize } = documentPreviewModal;
    setDocumentPreviewModal((prev) => (prev ? { ...prev, isUploading: true } : null));

    let finalMediaUrl = previewUrl;
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: previewUrl,
          name: file.name,
          type: file.type,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.url) {
          finalMediaUrl = json.url;
        }
      }
    } catch (err) {
      console.warn('Upload fallback to dataUrl:', err);
    }

    onSendMessage(
      caption.trim() || file.name || 'Documento',
      'document',
      finalMediaUrl,
      {
        fileName: file.name,
        fileSize: formattedSize,
        mimeType: file.type,
      }
    );

    setDocumentPreviewModal(null);
    showToast('Documento enviado com sucesso!');
  };

  const handleConfirmSendAudio = async () => {
    if (!audioPreviewModal || audioPreviewModal.isUploading) return;
    const { file, previewUrl, formattedSize } = audioPreviewModal;
    setAudioPreviewModal((prev) => (prev ? { ...prev, isUploading: true } : null));

    let finalMediaUrl = previewUrl;
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: previewUrl,
          name: file.name,
          type: file.type,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.url) {
          finalMediaUrl = json.url;
        }
      }
    } catch (err) {
      console.warn('Upload fallback to dataUrl:', err);
    }

    onSendMessage(file.name || 'Mensagem de áudio', 'audio', finalMediaUrl, {
      fileName: file.name,
      fileSize: formattedSize,
      mimeType: file.type,
      audioDuration: '0:15',
    });

    setAudioPreviewModal(null);
    showToast('Áudio enviado com sucesso!');
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), 'text');
    setInputText('');
    setTextSelection(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Atalho: Ctrl+B ou Cmd+B para Negrito (*texto*)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      const start = textareaRef.current?.selectionStart ?? 0;
      const end = textareaRef.current?.selectionEnd ?? 0;
      const res = applyWhatsAppFormatting(inputText, start, end, 'bold');
      setInputText(res.text);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(res.newStart, res.newEnd);
          if (res.newStart !== res.newEnd) {
            setTextSelection({ start: res.newStart, end: res.newEnd });
          }
        }
      }, 10);
      return;
    }

    // Atalho: Ctrl+I ou Cmd+I para Itálico (_texto_)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      const start = textareaRef.current?.selectionStart ?? 0;
      const end = textareaRef.current?.selectionEnd ?? 0;
      const res = applyWhatsAppFormatting(inputText, start, end, 'italic');
      setInputText(res.text);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(res.newStart, res.newEnd);
          if (res.newStart !== res.newEnd) {
            setTextSelection({ start: res.newStart, end: res.newEnd });
          }
        }
      }, 10);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSendAudioSimulated = () => {
    onSendMessage('Mensagem de voz (0:06)', 'audio');
  };

  // Filter messages for in-chat search
  const matchingMessageIds = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    return messages
      .filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      .map((m) => m.id);
  }, [messages, searchQuery]);

  // Actions from the 3-dots Menu
  const handleToggleFavorite = () => {
    if (!conversation) return;
    onToggleFavorite?.(conversation.id);
    showToast(
      conversation.isFavorite
        ? 'Conversa removida dos Favoritos'
        : 'Conversa adicionada aos Favoritos'
    );
  };

  const handleMuteNotifications = (duration: string) => {
    showToast(`Notificações silenciadas por ${duration}`);
  };

  const handleLockChat = () => {
    showToast('Conversa trancada. Esta conversa foi movida para conversas protegidas.');
  };

  const handleExportChat = () => {
    if (!conversation) return;
    const header = `======================================================\nChatsApp Web Omnichannel - Histórico de Atendimento\nContato: ${conversation.contact.name} (${conversation.contact.phone || conversation.contact.instagramUsername || 'Cliente'})\nCanal: ${conversation.contact.channel.toUpperCase()}\nStatus: ${conversation.status?.toUpperCase() || 'AI'}\nExportado em: ${new Date().toLocaleString('pt-BR')}\n======================================================\n\n`;

    const body = messages
      .map((m) => {
        const sender =
          m.senderType === 'agent'
            ? 'Atendente'
            : m.senderType === 'ai'
            ? 'Assistente IA'
            : conversation.contact.name;
        const time = formatSaoPauloTime(m.createdAt || m.timestamp);
        return `[${time}] ${sender}: ${m.content}`;
      })
      .join('\n');

    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversa-${conversation.contact.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Conversa exportada com sucesso!');
  };

  const handleCloseChat = () => {
    if (!conversation) return;
    onUpdateStatus?.(conversation.id, 'closed');
    showToast('Conversa finalizada.');
  };

  const handleSendCallLink = () => {
    if (!conversation) return;
    const callUrl = `https://meet.jit.si/chatsapp-call-${conversation.id}-${Math.random().toString(36).substring(2, 7)}`;
    navigator.clipboard?.writeText(callUrl);
    showToast('Link de chamada copiado para a área de transferência!');
    setInputText((prev) => (prev ? `${prev} ${callUrl}` : `Link de chamada: ${callUrl}`));
  };

  const handleConfirmModalAction = () => {
    if (!conversation) return;
    if (confirmModal.type === 'report') {
      showToast('Denúncia enviada com sucesso.');
    } else if (confirmModal.type === 'block') {
      showToast('Contato bloqueado.');
    } else if (confirmModal.type === 'clear') {
      onClearMessages?.(conversation.id);
      showToast('Todas as mensagens desta conversa foram limpas.');
    } else if (confirmModal.type === 'delete') {
      onDeleteConversation?.(conversation.id);
    } else if (confirmModal.type === 'delete_single_message') {
      if (targetMessageToDelete) {
        onDeleteSelectedMessages?.(conversation.id, [targetMessageToDelete.id]);
        showToast('Mensagem apagada com sucesso.');
        setTargetMessageToDelete(null);
      }
    }
    setConfirmModal({ ...confirmModal, isOpen: false });
  };

  const promptDeleteSingleMessage = (msg: Message) => {
    setTargetMessageToDelete(msg);
    setConfirmModal({
      isOpen: true,
      type: 'delete_single_message',
      title: 'Apagar mensagem?',
      description: 'Deseja apagar esta mensagem da conversa? Ela será excluída sem apagar nenhuma outra mensagem.',
      confirmText: 'Apagar',
      isDestructive: true,
    });
  };

  const handleCopyMessage = (msg: Message) => {
    const textToCopy = msg.content || msg.mediaUrl || '';
    if (textToCopy) {
      navigator.clipboard?.writeText(textToCopy);
      showToast('Mensagem copiada para a área de transferência.');
    }
  };

  const handleReaction = (msg: Message, emoji: string) => {
    setMessageReactions((prev) => {
      const current = prev[msg.id];
      if (current === emoji) {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      }
      return { ...prev, [msg.id]: emoji };
    });
    setActiveMenuMessageId(null);
    showToast(`Reagiu com ${emoji}`);
  };

  const handleToggleStarMessage = (msg: Message) => {
    setStarredMessages((prev) => {
      const isStarred = !prev[msg.id];
      showToast(isStarred ? 'Mensagem favoritada.' : 'Mensagem desfavoritada.');
      return { ...prev, [msg.id]: isStarred };
    });
    setActiveMenuMessageId(null);
  };

  const handlePinMessage = (msg: Message) => {
    setPinnedMessageId((prev) => (prev === msg.id ? null : msg.id));
    showToast(pinnedMessageId === msg.id ? 'Mensagem desafixada.' : 'Mensagem fixada no topo.');
    setActiveMenuMessageId(null);
  };

  const handleForwardMessage = (msg: Message) => {
    const text = msg.content || msg.mediaUrl || '';
    setInputText((prev) => (prev ? `${prev} ${text}` : text));
    showToast('Mensagem pronta para encaminhar no campo de texto.');
    setActiveMenuMessageId(null);
  };

  const handleAddTextToNotes = (msg: Message) => {
    const text = msg.content || (msg.contentType === 'audio' ? 'Áudio' : 'Mídia');
    navigator.clipboard?.writeText(text);
    showToast('Texto copiado para adicionar às notas do contato.');
    setActiveMenuMessageId(null);
  };

  // Selection mode helpers
  const handleToggleSelectMessage = (id: string) => {
    setSelectedMessageIds((prev) => {
      const next = prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id];
      if (next.length === 0) {
        setIsSelectionMode(false);
      }
      return next;
    });
  };

  const handleSelectAllMessages = () => {
    if (selectedMessageIds.length === messages.length) {
      setSelectedMessageIds([]);
    } else {
      setSelectedMessageIds(messages.map((m) => m.id));
    }
  };

  const handleDeleteSelected = () => {
    if (!conversation || selectedMessageIds.length === 0) return;
    onDeleteSelectedMessages?.(conversation.id, selectedMessageIds);
    showToast(`${selectedMessageIds.length} mensagem(ns) apagada(s).`);
    setSelectedMessageIds([]);
    setIsSelectionMode(false);
  };

  const handleCopySelected = () => {
    const selectedMsgs = messages.filter((m) => selectedMessageIds.includes(m.id));
    const text = selectedMsgs.map((m) => m.content).join('\n');
    navigator.clipboard?.writeText(text);
    showToast(`${selectedMessageIds.length} mensagem(ns) copiada(s).`);
    setSelectedMessageIds([]);
    setIsSelectionMode(false);
  };

  if (!conversation) {
    return (
      <div
        className={`flex-1 flex flex-col items-center justify-center relative p-8 text-center border-r ${
          darkMode ? 'bg-[#222e35] border-[#222e35] text-[#8696a0]' : 'bg-[#f0f2f5] border-[#e9edef] text-[#54656f]'
        }`}
      >
        <WhatsAppWallpaper darkMode={darkMode} />
        <div className="z-10 max-w-md flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[#00a884]/15 flex items-center justify-center text-[#00a884] mb-3">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className={`text-xl font-bold mb-1.5 ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
            ChatsApp Web Omnichannel
          </h2>
          <p className="text-xs leading-relaxed mb-4 text-[#8696a0]">
            Central de atendimento unificada (WhatsApp, Instagram e Chat do Site) com sincronização em nuvem e controle total de Human Takeover.
          </p>
          <div className="text-xs text-[#8696a0] flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Selecione uma conversa à esquerda para iniciar o atendimento</span>
          </div>
        </div>
      </div>
    );
  }

  const { contact } = conversation;
  const convStatus: ConversationStatus = conversation.status || 'ai';

  // Canal de origem
  const getChannelBadge = () => {
    const ringClass = darkMode ? 'ring-[#202c33]' : 'ring-[#f0f2f5]';
    switch (contact.channel) {
      case 'telegram':
        return (
          <span
            className={`w-4 h-4 rounded-full bg-[#0088cc] text-white flex items-center justify-center shadow-xs ring-2 ${ringClass} shrink-0`}
            title="Telegram"
          >
            <TelegramIcon className="w-2.5 h-2.5" />
          </span>
        );
      case 'instagram':
        return (
          <span
            className={`w-4 h-4 rounded-full bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] text-white flex items-center justify-center shadow-xs ring-2 ${ringClass} shrink-0`}
            title="Instagram Direct"
          >
            <Instagram className="w-2.5 h-2.5" />
          </span>
        );
      case 'webchat':
        return (
          <span
            className={`w-4 h-4 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-xs ring-2 ${ringClass} shrink-0`}
            title="Chat do Site"
          >
            <Globe className="w-2.5 h-2.5" />
          </span>
        );
      case 'whatsapp':
      default:
        return (
          <span
            className={`w-4 h-4 rounded-full bg-[#25d366] text-white flex items-center justify-center shadow-xs ring-2 ${ringClass} shrink-0`}
            title="WhatsApp Oficial"
          >
            <MessageSquare className="w-2.5 h-2.5 fill-current" />
          </span>
        );
    }
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full relative overflow-hidden transition-colors duration-150 ${
        darkMode ? 'bg-[#0b141a]' : 'bg-[#e5ddd5]'
      }`}
    >
      <WhatsAppWallpaper darkMode={darkMode} />

      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-[#233138] text-[#e9edef] text-xs sm:text-sm rounded-lg shadow-2xl border border-[#2a3942] flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-[#00a884] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Chat Top Header */}
      <div
        className={`px-3 sm:px-4 pt-[max(env(safe-area-inset-top),0.625rem)] pb-2 sm:py-2.5 flex items-center justify-between border-b z-30 shrink-0 select-none min-h-[58px] sm:min-h-[60px] sticky top-0 ${
          darkMode ? 'bg-[#202c33] border-[#222e35] text-[#e9edef]' : 'bg-[#f0f2f5] border-[#e9edef] text-[#111b21]'
        }`}
      >
        {/* SELECTION MODE HEADER */}
        {isSelectionMode ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedMessageIds([]);
                }}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  darkMode ? 'text-[#aebac1] hover:bg-[#374248]' : 'text-[#54656f] hover:bg-[#e9edef]'
                }`}
                title="Cancelar seleção"
              >
                <X className="w-5 h-5" />
              </button>
              <span className="font-medium text-sm">
                {selectedMessageIds.length} selecionada{selectedMessageIds.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAllMessages}
                className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                  darkMode ? 'text-[#aebac1] hover:bg-[#374248]' : 'text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                {selectedMessageIds.length === messages.length ? 'Desmarcar todas' : 'Selecionar todas'}
              </button>

              {selectedMessageIds.length > 0 && (
                <>
                  <button
                    onClick={handleCopySelected}
                    className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                      darkMode ? 'text-[#aebac1] hover:bg-[#374248]' : 'text-[#54656f] hover:bg-[#e9edef]'
                    }`}
                    title="Copiar mensagens"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleDeleteSelected}
                    className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-full transition-colors cursor-pointer"
                    title="Apagar selecionadas"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* STANDARD WHATSAPP HEADER */
          <>
            {/* Left: Voltar (mobile) + Foto + Nome */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                id="btn-chat-back"
                onClick={onBackToConversations}
                className={`p-1.5 rounded-full items-center justify-center transition-colors ${
                  darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
                } ${isMobileMode ? 'flex' : 'flex md:hidden'}`}
                title="Voltar para conversas"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div
                onClick={onToggleRightPanel}
                className="flex items-center gap-2.5 cursor-pointer group min-w-0 py-0.5"
                title="Ver dados do contato e CRM"
              >
                <div className="relative shrink-0 w-10 h-10">
                  <img
                    src={contact.avatarUrl}
                    alt={contact.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 pointer-events-none flex items-center justify-center">
                    {getChannelBadge()}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="font-semibold text-sm sm:text-base truncate flex items-center gap-1.5">
                    <span>{contact.name}</span>
                    {conversation.isFavorite && (
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline shrink-0" />
                    )}
                    {conversation.isArchived && (
                      <span
                        id="badge-chat-archived"
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30 inline-flex items-center gap-1 shrink-0"
                        title="Esta conversa está arquivada"
                      >
                        <Archive className="w-3 h-3" />
                        <span>Arquivada</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#53bdeb] hover:underline cursor-pointer flex items-center gap-1">
                    <span>
                      {isMobileMode ? (
                        'Ver CRM'
                      ) : (
                        <>
                          <span className="md:hidden">Ver CRM</span>
                          <span className="hidden md:inline">Clique para ver dados do CRM</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Controles Human Takeover + Ações Desktop */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* STATUS HUMAN TAKEOVER */}
              <div className="flex items-center gap-1 sm:gap-1.5 mr-1">
                {convStatus === 'ai' && (
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <div
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-[#064e3b] text-[#34d399] border border-[#34d399]/40 shadow-sm"
                      title="A IA está respondendo as mensagens deste contato"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
                      <span className="hidden sm:inline">IA Respondendo</span>
                      <span className="sm:hidden">IA</span>
                    </div>
                    {onUpdateStatus && (
                      <button
                        id="btn-takeover-human"
                        onClick={() => onUpdateStatus(conversation.id, 'human')}
                        className="px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Assumir conversa: a IA para de responder"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Assumir</span>
                      </button>
                    )}
                  </div>
                )}

                {convStatus === 'human' && (
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <div
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-500/40 shadow-sm"
                      title="Atendente humano no controle. IA pausada."
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="hidden sm:inline">Atendente</span>
                    </div>
                    {onUpdateStatus && (
                      <button
                        id="btn-return-ai"
                        onClick={() => onUpdateStatus(conversation.id, 'ai')}
                        className="px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#064e3b]/80 hover:bg-[#064e3b] text-[#34d399] border border-[#34d399]/40 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Devolver o atendimento para a IA"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Pra IA</span>
                      </button>
                    )}
                  </div>
                )}

                {convStatus === 'closed' && (
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold bg-gray-800 text-gray-400 border border-gray-700 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-gray-500" />
                      <span>Finalizada</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Botão de Chamada de Vídeo (com dropdown arrow como no WhatsApp Business) */}
              <button
                id="btn-chat-video-call"
                onClick={handleSendCallLink}
                className={`p-1.5 rounded-full transition-colors hidden sm:flex items-center gap-0.5 cursor-pointer ${
                  darkMode ? 'text-[#aebac1] hover:bg-[#374248]' : 'text-[#54656f] hover:bg-[#e9edef]'
                }`}
                title="Chamada de vídeo / Enviar link de chamada"
              >
                <Video className="w-5 h-5" />
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {/* Botão de Pesquisar no Chat */}
              <button
                id="btn-chat-search"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isSearchOpen
                    ? 'text-[#00a884] bg-[#374248]/50'
                    : darkMode
                    ? 'text-[#aebac1] hover:bg-[#374248]'
                    : 'text-[#54656f] hover:bg-[#e9edef]'
                }`}
                title="Pesquisar nesta conversa"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Botão de Arquivar / Desarquivar conversa diretamente no Chat */}
              {onToggleArchive && (
                <button
                  id="btn-chat-archive-header"
                  onClick={() => onToggleArchive(conversation.id)}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    conversation.isArchived
                      ? 'text-[#00a884] bg-[#00a884]/15 hover:bg-[#00a884]/25'
                      : darkMode
                      ? 'text-[#aebac1] hover:bg-[#374248]'
                      : 'text-[#54656f] hover:bg-[#e9edef]'
                  }`}
                  title={conversation.isArchived ? 'Desarquivar conversa' : 'Arquivar conversa'}
                >
                  {conversation.isArchived ? (
                    <ArchiveRestore className="w-5 h-5 text-[#00a884]" />
                  ) : (
                    <Archive className="w-5 h-5" />
                  )}
                </button>
              )}

              {/* Botão para abrir o Painel CRM / Informações */}
              <button
                id="btn-panel-info"
                onClick={onToggleRightPanel}
                className={`flex items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  isRightPanelOpen
                    ? darkMode
                      ? 'bg-[#374248] text-[#00a884]'
                      : 'bg-[#e9edef] text-[#00a884]'
                    : darkMode
                    ? 'text-[#aebac1] hover:bg-[#374248]'
                    : 'text-[#54656f] hover:bg-[#e9edef]'
                }`}
                title="Painel de Informações & CRM"
              >
                <PanelRight className="w-5 h-5" />
              </button>

              {/* Botão dos 3 Pontinhos (Menu de Mais Opções do WhatsApp Business) */}
              <div className="relative">
                <button
                  id="btn-chat-menu"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    isMenuOpen
                      ? darkMode
                        ? 'bg-[#374248] text-[#e9edef]'
                        : 'bg-[#e9edef] text-[#111b21]'
                      : darkMode
                      ? 'text-[#aebac1] hover:bg-[#374248]'
                      : 'text-[#54656f] hover:bg-[#e9edef]'
                  }`}
                  title="Mais opções"
                  aria-expanded={isMenuOpen}
                  aria-haspopup="true"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {/* Dropdown Exato do WhatsApp Business Desktop */}
                <ChatMenuDropdown
                  isOpen={isMenuOpen}
                  onClose={() => setIsMenuOpen(false)}
                  conversation={conversation}
                  darkMode={darkMode}
                  onContactInfo={onToggleRightPanel}
                  onSearch={() => setIsSearchOpen(true)}
                  onSelectMessages={() => setIsSelectionMode(true)}
                  onMuteNotifications={handleMuteNotifications}
                  onDisappearingMessages={() => setIsDisappearingModalOpen(true)}
                  onLockChat={handleLockChat}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleArchive={onToggleArchive ? () => onToggleArchive(conversation.id) : undefined}
                  onChangeList={() => setIsChangeListModalOpen(true)}
                  onExportChat={handleExportChat}
                  onCloseChat={handleCloseChat}
                  onSendCallLink={handleSendCallLink}
                  onReport={() =>
                    setConfirmModal({
                      isOpen: true,
                      type: 'report',
                      title: `Denunciar ${contact.name}?`,
                      description:
                        'As últimas 5 mensagens desta conversa serão encaminhadas para análise e o contato não será notificado.',
                      confirmText: 'Denunciar',
                      isDestructive: true,
                    })
                  }
                  onBlock={() =>
                    setConfirmModal({
                      isOpen: true,
                      type: 'block',
                      title: `Bloquear ${contact.name}?`,
                      description:
                        'Os contatos bloqueados não poderão ligar nem enviar mensagens para você. O atendimento será arquivado.',
                      confirmText: 'Bloquear',
                      isDestructive: true,
                    })
                  }
                  onClearChat={() =>
                    setConfirmModal({
                      isOpen: true,
                      type: 'clear',
                      title: 'Limpar esta conversa?',
                      description:
                        'As mensagens serão apagadas apenas do histórico deste atendimento. Esta ação não pode ser desfeita.',
                      confirmText: 'Limpar mensagens',
                      isDestructive: true,
                    })
                  }
                  onDeleteChat={() =>
                    setConfirmModal({
                      isOpen: true,
                      type: 'delete',
                      title: 'Apagar esta conversa?',
                      description:
                        'Todo o histórico de mensagens e dados vinculados a este chat serão permanentemente excluídos.',
                      confirmText: 'Apagar conversa',
                      isDestructive: true,
                    })
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* In-Chat Search Bar Overlay */}
      {isSearchOpen && (
        <div
          className={`px-4 py-2 border-b flex items-center gap-2 z-20 transition-all ${
            darkMode ? 'bg-[#111b21] border-[#222e35]' : 'bg-white border-[#e9edef]'
          }`}
        >
          <Search className="w-4 h-4 text-[#8696a0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar mensagens..."
            autoFocus
            className={`flex-1 bg-transparent text-sm outline-none ${
              darkMode ? 'text-[#e9edef] placeholder-[#8696a0]' : 'text-[#111b21] placeholder-[#54656f]'
            }`}
          />
          {searchQuery && (
            <span className="text-xs text-[#8696a0]">
              {matchingMessageIds.length} {matchingMessageIds.length === 1 ? 'resultado' : 'resultados'}
            </span>
          )}
          <button
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
            }}
            className="p-1 text-[#8696a0] hover:text-[#e9edef] rounded-full transition-colors cursor-pointer"
            title="Fechar pesquisa"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Banner de Conversa Arquivada no Chat */}
      {conversation?.isArchived && (
        <div
          id="chat-archived-banner"
          className={`px-4 py-2.5 flex items-center justify-between gap-3 text-xs border-b select-none transition-colors z-20 ${
            darkMode
              ? 'bg-[#182229] border-[#222e35] text-[#e9edef]'
              : 'bg-[#e7fce3] border-[#d1f4cc] text-[#111b21]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-[#00a884]/20 text-[#00a884] flex items-center justify-center shrink-0">
              <Archive className="w-4 h-4" />
            </div>
            <span className="truncate">
              Esta conversa está na pasta <strong>Arquivadas</strong>.
            </span>
          </div>
          {onToggleArchive && (
            <button
              type="button"
              id="btn-unarchive-from-banner"
              onClick={() => onToggleArchive(conversation.id)}
              className="text-[#00a884] font-semibold hover:underline shrink-0 cursor-pointer flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-[#00a884]/10 hover:bg-[#00a884]/20 transition-colors"
            >
              <ArchiveRestore className="w-3.5 h-3.5" />
              <span>Desarquivar conversa</span>
            </button>
          )}
        </div>
      )}

      {/* Chat Messages List (Histórico ao centro) */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2 z-10 custom-scrollbar overscroll-contain"
      >
        {/* Banner de Criptografia e Informação Omnichannel */}
        <div className="flex justify-center my-2">
          <div
            className={`text-[11px] px-3 py-1 rounded-lg shadow-sm max-w-md text-center flex items-center gap-1.5 font-medium ${
              darkMode ? 'bg-[#182229] text-[#ffd279]' : 'bg-[#fff] text-[#54656f]'
            }`}
          >
            <Lock className="w-3 h-3 text-[#ffd279] shrink-0" />
            <span>
              As mensagens são protegidas com criptografia de ponta a ponta e sincronizadas em tempo real.
            </span>
          </div>
        </div>

        {/* Histórico das Mensagens */}
        {messages.map((msg) => {
          // REGRA DE ALINHAMENTO DO CHATSAPP:
          // Toda mensagem com sender_type diferente de 'customer' ('agent', 'bot', 'coexistence_mobile', etc.)
          // DEVE ficar no LADO DIREITO (outgoing / verde WhatsApp).
          // As mensagens do cliente ('customer' / 'contact') ficam no LADO ESQUERDO (incoming / branca WhatsApp).
          const rawSender = String((msg as any).sender_type || msg.senderType || '').toLowerCase().trim();
          const isCustomer =
            rawSender === 'customer' ||
            rawSender === 'contact' ||
            rawSender === 'client' ||
            rawSender === 'lead' ||
            msg.senderType === 'contact' ||
            msg.senderType === 'customer';

          // Mensagens do lado direito (qualquer uma que NÃO seja customer)
          const isRightSide = !isCustomer && msg.senderType !== 'system';

          const isAI =
            rawSender === 'ai' ||
            rawSender === 'bot' ||
            rawSender === 'ia' ||
            rawSender === 'assistant' ||
            msg.senderType === 'ai' ||
            msg.senderType === 'bot';

          const isMobileCoexistence =
            rawSender === 'coexistence_mobile' ||
            rawSender === 'mobile' ||
            rawSender === 'device' ||
            rawSender === 'celular' ||
            msg.senderType === 'coexistence_mobile' ||
            msg.metadata?.viaCoexistence === true;

          const isMe = isRightSide;
          const isSelected = selectedMessageIds.includes(msg.id);

          // Horário formatado no fuso de Brasília (America/Sao_Paulo)
          const formattedTime = formatSaoPauloTime(msg.createdAt || msg.timestamp);

          // Verifica se a mensagem bate com a busca
          const isMatched =
            searchQuery.trim().length > 0 &&
            msg.content.toLowerCase().includes(searchQuery.toLowerCase());

          return (
            <div
              key={msg.id}
              onTouchStart={(e) => {
                if (!isSelectionMode) {
                  const touch = e.touches[0];
                  startLongPress(msg.id, touch.clientX, touch.clientY);
                }
              }}
              onTouchMove={handleTouchMove}
              onTouchEnd={(e) => {
                cancelLongPress();
                if (didLongPressRef.current) {
                  e.preventDefault();
                  setTimeout(() => {
                    didLongPressRef.current = false;
                  }, 50);
                }
              }}
              onTouchCancel={cancelLongPress}
              onMouseDown={(e) => {
                if (e.button === 0 && !isSelectionMode) {
                  startLongPress(msg.id, e.clientX, e.clientY);
                }
              }}
              onMouseMove={(e) => {
                if (touchStartPosRef.current) {
                  const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
                  const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
                  if (dx > 8 || dy > 8) cancelLongPress();
                }
              }}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onContextMenu={(e) => {
                if (!isSelectionMode) {
                  e.preventDefault();
                  setIsSelectionMode(true);
                  setSelectedMessageIds([msg.id]);
                }
              }}
              onClick={() => {
                if (didLongPressRef.current) {
                  didLongPressRef.current = false;
                  return;
                }
                if (isSelectionMode) {
                  handleToggleSelectMessage(msg.id);
                }
              }}
              className={`flex items-center gap-2 transition-all select-none ${
                isSelectionMode ? 'cursor-pointer active:scale-[0.99]' : ''
              } ${isRightSide ? 'justify-end' : 'justify-start'}`}
            >
              {/* Checkbox no modo de seleção */}
              {isSelectionMode && (
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-[#00a884] border-[#00a884] text-white'
                      : darkMode
                      ? 'border-[#8696a0] hover:border-[#00a884]'
                      : 'border-[#54656f] hover:border-[#00a884]'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </div>
              )}

              <div
                className={`max-w-[85%] md:max-w-[65%] rounded-lg px-3 py-1.5 text-sm shadow-sm relative group transition-all ${
                  isSelected ? 'ring-2 ring-[#00a884]' : ''
                } ${
                  isMatched ? 'ring-2 ring-amber-400 bg-amber-500/10' : ''
                } ${
                  isRightSide
                    ? isAI
                      ? darkMode
                        ? 'bg-[#064e3b] text-[#e9edef] border border-[#34d399]/30 rounded-tr-none'
                        : 'bg-[#d9fdd3] text-[#111b21] border border-[#34d399]/40 rounded-tr-none'
                      : darkMode
                      ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                      : 'bg-[#d9fdd3] text-[#111b21] rounded-tr-none'
                    : darkMode
                    ? 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                    : 'bg-white text-[#111b21] rounded-tl-none'
                }`}
              >
                {/* Indicador de envio via Celular Físico da empresa (Modo Coexistência Meta) */}
                {isMobileCoexistence && (
                  <div className="text-[10px] text-[#53bdeb] font-semibold flex items-center gap-1 mb-1">
                    <Smartphone className="w-3 h-3" />
                    <span>Enviado via Celular Físico</span>
                  </div>
                )}

                {/* Badge de IA se a mensagem foi gerada pelo assistente autônomo */}
                {isAI && (
                  <div className="text-[10px] text-[#34d399] font-semibold flex items-center gap-1 mb-1">
                    <Bot className="w-3 h-3" />
                    <span>Assistente de IA</span>
                  </div>
                )}

                {/* Indicador de Mensagem Fixada */}
                {pinnedMessageId === msg.id && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-500 font-medium mb-1">
                    <Pin className="w-3 h-3 fill-amber-500" />
                    <span>Fixada</span>
                  </div>
                )}

                {/* Botão de Setinha / Menu da Mensagem (visível no hover como no WhatsApp Web) */}
                {!isSelectionMode && (
                  <button
                    id={`msg-menu-btn-${msg.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuMessageId((prev) => (prev === msg.id ? null : msg.id));
                    }}
                    className={`absolute top-1.5 right-1.5 p-0.5 rounded-full transition-all z-20 ${
                      activeMenuMessageId === msg.id
                        ? 'opacity-100 bg-black/20 dark:bg-black/40 text-white'
                        : 'opacity-0 group-hover:opacity-100 hover:bg-black/20 text-[#8696a0] dark:text-[#8696a0]'
                    }`}
                    title="Opções da mensagem"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}

                {/* Menu Suspenso estilo WhatsApp Web */}
                {activeMenuMessageId === msg.id && (
                  <>
                    {/* Backdrop para fechar ao clicar em qualquer lugar da tela */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuMessageId(null);
                      }}
                    />

                    <div
                      className={`absolute ${
                        isRightSide ? 'right-0' : 'left-0'
                      } top-8 z-50 w-64 rounded-2xl shadow-2xl py-2 border backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${
                        darkMode
                          ? 'bg-[#233138] border-[#374248] text-[#e9edef]'
                          : 'bg-white border-gray-200 text-[#111b21]'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Barra de Reação Rápida com Emojis */}
                      <div
                        className={`px-3 py-1.5 mb-1.5 flex items-center justify-between border-b ${
                          darkMode ? 'border-[#374248]' : 'border-gray-100'
                        }`}
                      >
                        {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg, emoji)}
                            className="w-7 h-7 flex items-center justify-center text-lg rounded-full hover:scale-125 transition-transform hover:bg-black/10 dark:hover:bg-white/10"
                            title={`Reagir com ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {/* Dados da Mensagem */}
                      <button
                        onClick={() => {
                          setActiveMenuMessageId(null);
                          setMessageDetailsModal(msg);
                        }}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-[13px] text-left transition-colors ${
                          darkMode ? 'hover:bg-[#182229]' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Info className="w-4 h-4 text-[#8696a0]" />
                        <span>Dados da mensagem</span>
                      </button>

                      {/* Responder */}
                      <button
                        onClick={() => {
                          setActiveMenuMessageId(null);
                          setReplyingToMessage(msg);
                        }}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-[13px] text-left transition-colors ${
                          darkMode ? 'hover:bg-[#182229]' : 'hover:bg-gray-100'
                        }`}
                      >
                        <CornerUpLeft className="w-4 h-4 text-[#8696a0]" />
                        <span>Responder</span>
                      </button>

                      {/* Copiar */}
                      <button
                        onClick={() => {
                          setActiveMenuMessageId(null);
                          handleCopyMessage(msg);
                        }}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-[13px] text-left transition-colors ${
                          darkMode ? 'hover:bg-[#182229]' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Copy className="w-4 h-4 text-[#8696a0]" />
                        <span>Copiar</span>
                      </button>

                      {/* Reagir */}
                      <button
                        onClick={() => {
                          setActiveMenuMessageId(null);
                          handleReaction(msg, '❤️');
                        }}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-[13px] text-left transition-colors ${
                          darkMode ? 'hover:bg-[#182229]' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Smile className="w-4 h-4 text-[#8696a0]" />
                        <span>Reagir</span>
                      </button>

                      {/* Encaminhar */}
                      <button
                        onClick={() => {
                          setActiveMenuMessageId(null);
                          handleForwardMessage(msg);
                        }}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-[13px] text-left transition-colors ${
                          darkMode ? 'hover:bg-[#182229]' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Share2 className="w-4 h-4 text-[#8696a0]" />
                        <span>Encaminhar</span>
                      </button>

                      {/* Fixar */}
                      <button
                        onClick={() => {
                          setActiveMenuMessageId(null);
                          handlePinMessage(msg);
                        }}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-[13px] text-left transition-colors ${
                          darkMode ? 'hover:bg-[#182229]' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Pin className="w-4 h-4 text-[#8696a0]" />
                        <span>{pinnedMessageId === msg.id ? 'Desafixar' : 'Fixar'}</span>
                      </button>

                      {/* Favoritar */}
                      <button
                        onClick={() => {
                          setActiveMenuMessageId(null);
                          handleToggleStarMessage(msg);
                        }}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-[13px] text-left transition-colors ${
                          darkMode ? 'hover:bg-[#182229]' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Star
                          className={`w-4 h-4 ${
                            starredMessages[msg.id] || msg.isStarred
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-[#8696a0]'
                          }`}
                        />
                        <span>{starredMessages[msg.id] || msg.isStarred ? 'Desfavoritar' : 'Favoritar'}</span>
                      </button>

                      {/* Adicionar texto às notas */}
                      <button
                        onClick={() => {
                          setActiveMenuMessageId(null);
                          handleAddTextToNotes(msg);
                        }}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-[13px] text-left transition-colors ${
                          darkMode ? 'hover:bg-[#182229]' : 'hover:bg-gray-100'
                        }`}
                      >
                        <StickyNote className="w-4 h-4 text-[#8696a0]" />
                        <span>Adicionar texto às notas</span>
                      </button>

                      {/* Selecionar mensagem */}
                      <button
                        onClick={() => {
                          setActiveMenuMessageId(null);
                          setIsSelectionMode(true);
                          setSelectedMessageIds((prev) => (prev.includes(msg.id) ? prev : [...prev, msg.id]));
                        }}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-[13px] text-left transition-colors cursor-pointer ${
                          darkMode ? 'hover:bg-[#182229]' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Check className="w-4 h-4 text-[#8696a0]" />
                        <span>Selecionar mensagem</span>
                      </button>

                      <div className={`my-1 border-t ${darkMode ? 'border-[#374248]' : 'border-gray-100'}`} />

                      {/* Apagar (Destaque fiel ao WhatsApp) */}
                      <button
                        onClick={() => {
                          setActiveMenuMessageId(null);
                          promptDeleteSingleMessage(msg);
                        }}
                        className={`w-full px-4 py-2 flex items-center gap-3 text-[13px] text-left text-[#ea4335] transition-colors cursor-pointer ${
                          darkMode ? 'hover:bg-[#182229]' : 'hover:bg-red-50'
                        }`}
                      >
                        <Trash2 className="w-4 h-4 text-[#ea4335]" />
                        <span className="font-medium">Apagar</span>
                      </button>
                    </div>
                  </>
                )}

                {/* Renderização de Conteúdo: Áudio, Figurinha (Sticker), GIF, Imagem ou Texto */}
                {(() => {
                  const rawContent = typeof msg.content === 'string' ? msg.content : '';
                  const mediaUrl =
                    msg.mediaUrl ||
                    msg.metadata?.mediaUrl ||
                    msg.metadata?.media_url ||
                    msg.metadata?.audioUrl ||
                    msg.metadata?.stickerUrl ||
                    msg.metadata?.url ||
                    (rawContent.startsWith('http') ||
                    rawContent.startsWith('data:') ||
                    rawContent.startsWith('blob:') ||
                    rawContent.startsWith('/uploads/')
                      ? rawContent.trim().replace(/[.,;:)\]>]+$/, '')
                      : '');

                  // Detecção de link de mídia embutido no texto
                  const mediaLinkMatch = rawContent.match(
                    /https?:\/\/[^\s"'<>]+\.(ogg|opus|mp3|wav|m4a|aac|webm|webp|gif|jpg|jpeg|png|avif|bmp|mp4)(\?[^\s"'<>]*)?/i
                  );
                  const matchedMediaUrl = mediaLinkMatch ? mediaLinkMatch[0].replace(/[.,;:)\]>]+$/, '') : null;
                  const effectiveMediaUrl = (mediaUrl || matchedMediaUrl || '').trim();

                  const isAudio =
                    msg.contentType === 'audio' ||
                    Boolean(effectiveMediaUrl && /\.(ogg|opus|mp3|wav|m4a|aac)(\?[^\s]*)?$/i.test(effectiveMediaUrl));

                  const isSticker =
                    !isAudio &&
                    (msg.contentType === 'sticker' ||
                      msg.metadata?.isSticker === true ||
                      msg.metadata?.type === 'sticker' ||
                      Boolean(effectiveMediaUrl && /\.(webp)(\?[^\s]*)?$/i.test(effectiveMediaUrl)) ||
                      rawContent.trim() === '[sticker]' ||
                      rawContent.trim() === 'figurinha');

                  const isGif =
                    !isAudio &&
                    !isSticker &&
                    (msg.contentType === 'gif' ||
                      msg.metadata?.isGif === true ||
                      msg.metadata?.type === 'gif' ||
                      msg.metadata?.gifPlayback === true ||
                      Boolean(effectiveMediaUrl && /\.(gif)(\?[^\s]*)?$/i.test(effectiveMediaUrl)));

                  const isImage =
                    !isAudio &&
                    !isSticker &&
                    !isGif &&
                    (msg.contentType === 'image' ||
                      effectiveMediaUrl.startsWith('data:image/') ||
                      Boolean(
                        effectiveMediaUrl &&
                          /\.(jpg|jpeg|png|avif|bmp|webp)(\?[^\s]*)?$/i.test(effectiveMediaUrl)
                      ));

                  const isDocument =
                    !isAudio &&
                    !isSticker &&
                    !isGif &&
                    !isImage &&
                    (msg.contentType === 'document' ||
                      effectiveMediaUrl.startsWith('data:application/') ||
                      effectiveMediaUrl.startsWith('data:text/') ||
                      Boolean(
                        effectiveMediaUrl &&
                          /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar)(\?[^\s]*)?$/i.test(
                            effectiveMediaUrl
                          )
                      ));

                  // 1. Áudio (PTT / Voice Note)
                  if (isAudio) {
                    const isTranscribed = Boolean(showTranscriptionMap[msg.id]);
                    // Puxar o que estiver na coluna "content" da tabela messages
                    const contentText =
                      rawContent && !rawContent.startsWith('http') && rawContent.trim() !== '[audio]' && rawContent.trim() !== 'audio'
                        ? rawContent
                        : msg.metadata?.transcription || msg.metadata?.text || rawContent || '';

                    return (
                      <div className="flex flex-col gap-1 w-full max-w-full">
                        <AudioPlayer
                          src={effectiveMediaUrl}
                          duration={msg.mediaDuration || '0:06'}
                          senderType={msg.senderType}
                          isMe={isRightSide}
                          darkMode={darkMode}
                          messageId={msg.id}
                        />

                        {/* Opção para transcrever mensagem de áudio (fontes pequenas) */}
                        <div className="pt-0.5 px-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTranscriptionMap((prev) => ({
                                ...prev,
                                [msg.id]: !prev[msg.id],
                              }));
                            }}
                            className={`text-[10px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer select-none ${
                              isRightSide
                                ? 'text-white/85 hover:text-white underline underline-offset-2'
                                : darkMode
                                ? 'text-[#00a884] hover:text-[#25d366]'
                                : 'text-[#008069] hover:text-[#00a884]'
                            }`}
                          >
                            <FileText className="w-2.5 h-2.5" />
                            <span>{isTranscribed ? 'Ocultar transcrição' : 'Transcrever áudio'}</span>
                          </button>

                          {isTranscribed && (
                            <div
                              className={`mt-1 p-2 rounded-lg text-[11px] leading-relaxed break-words whitespace-pre-wrap border animate-in fade-in duration-150 ${
                                isRightSide
                                  ? 'bg-black/15 border-white/10 text-white/95'
                                  : darkMode
                                  ? 'bg-[#111b21]/70 border-[#313d45]/50 text-[#d1d7db]'
                                  : 'bg-white/80 border-[#e9edef] text-[#3b4a54]'
                              }`}
                            >
                              <div className="text-[9px] uppercase tracking-wider font-semibold opacity-60 mb-0.5">
                                Transcrição
                              </div>
                              {contentText.trim() ? (
                                contentText
                              ) : (
                                <span className="italic opacity-60">
                                  Nenhum texto de transcrição disponível na coluna content.
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // 2. Figurinha (Sticker / WebP)
                  if (isSticker && effectiveMediaUrl) {
                    return (
                      <div className="py-1">
                        <img
                          src={effectiveMediaUrl}
                          alt="Figurinha"
                          className="w-36 h-36 object-contain select-none cursor-pointer hover:scale-105 transition-transform drop-shadow"
                          loading="lazy"
                          onClick={() => setPreviewImageUrl(effectiveMediaUrl)}
                          onError={(e) => {
                            // Se falhar o carregamento, esconde
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    );
                  }

                  // 3. GIF animado (.gif ou vídeo mp4 looping)
                  if (isGif && effectiveMediaUrl) {
                    return (
                      <div className="relative rounded-lg overflow-hidden my-1 max-w-[280px] bg-black/10">
                        {/\.(mp4|webm)(\?[^\s]*)?$/i.test(effectiveMediaUrl) ? (
                          <video
                            src={effectiveMediaUrl}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full max-h-[300px] object-cover rounded-lg"
                          />
                        ) : (
                          <img
                            src={effectiveMediaUrl}
                            alt="GIF"
                            className="w-full max-h-[300px] object-cover rounded-lg cursor-pointer"
                            loading="lazy"
                            onClick={() => setPreviewImageUrl(effectiveMediaUrl)}
                          />
                        )}
                        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold tracking-wider uppercase">
                          GIF
                        </div>
                      </div>
                    );
                  }

                  // 4. Imagem / Foto
                  if (isImage && effectiveMediaUrl) {
                    const caption =
                      rawContent &&
                      rawContent !== effectiveMediaUrl &&
                      rawContent !== 'Foto' &&
                      rawContent !== '📷 Imagem'
                        ? rawContent
                        : '';
                    return (
                      <div className="relative rounded-lg overflow-hidden my-1 max-w-[300px] bg-black/5 dark:bg-black/20">
                        <img
                          src={effectiveMediaUrl}
                          alt="Foto"
                          className="w-full max-h-[320px] object-cover rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                          loading="lazy"
                          onClick={() => setPreviewImageUrl(effectiveMediaUrl)}
                        />
                        {caption && (
                          <div className="mt-1.5 px-0.5 text-[13.5px]">
                            <WhatsAppFormattedText text={caption} />
                          </div>
                        )}
                      </div>
                    );
                  }

                  // 4.1 Documento (PDF, DOCX, Planilha, TXT, etc.)
                  if (isDocument) {
                    const fileName =
                      msg.metadata?.fileName ||
                      (rawContent &&
                      rawContent !== effectiveMediaUrl &&
                      rawContent !== 'Documento' &&
                      !rawContent.startsWith('http') &&
                      !rawContent.startsWith('data:') &&
                      !rawContent.startsWith('/uploads/')
                        ? rawContent
                        : 'Documento');
                    const fileSize = msg.metadata?.fileSize || '';
                    const isPdf = /\.pdf$/i.test(fileName) || effectiveMediaUrl.includes('pdf');
                    return (
                      <div className="flex flex-col gap-1.5 my-1 max-w-[320px]">
                        <div
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                            isRightSide
                              ? 'bg-black/10 border-white/10 text-white'
                              : darkMode
                              ? 'bg-[#1f2c34] border-[#2a3942] text-[#d1d7db]'
                              : 'bg-[#f0f2f5] border-[#e9edef] text-[#111b21]'
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                              isPdf ? 'bg-red-500/20 text-red-500' : 'bg-[#00a884]/20 text-[#00a884]'
                            }`}
                          >
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="text-sm font-medium truncate" title={fileName}>
                              {fileName}
                            </p>
                            <p
                              className={`text-[11px] ${
                                isRightSide ? 'text-white/70' : darkMode ? 'text-[#8696a0]' : 'text-[#667781]'
                              }`}
                            >
                              {fileSize || 'Documento'}
                            </p>
                          </div>
                          {effectiveMediaUrl && (
                            <a
                              href={effectiveMediaUrl}
                              download={fileName}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={`p-2 rounded-full hover:bg-black/10 transition-colors shrink-0 ${
                                isRightSide
                                  ? 'text-white hover:text-white'
                                  : darkMode
                                  ? 'text-[#aebac1] hover:text-white'
                                  : 'text-[#54656f] hover:text-[#111b21]'
                              }`}
                              title="Baixar documento"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                        {rawContent &&
                          rawContent !== fileName &&
                          rawContent !== effectiveMediaUrl &&
                          rawContent !== 'Documento' && (
                            <div className="px-1 text-[13.5px]">
                              <WhatsAppFormattedText text={rawContent} />
                            </div>
                          )}
                      </div>
                    );
                  }

                  // 5. Mensagem de texto normal com links e formatação Markdown do WhatsApp
                  return (
                    <div className="flex flex-col gap-2 pr-4">
                      <WhatsAppFormattedText
                        text={rawContent}
                        className="text-[13.5px]"
                      />
                      {matchedMediaUrl && (
                        <div className="rounded-lg bg-black/5 dark:bg-black/20 p-1 mt-1 border border-black/5 dark:border-white/5">
                          <AudioPlayer
                            src={matchedMediaUrl}
                            duration={msg.mediaDuration || '0:06'}
                            senderType={msg.senderType}
                            isMe={isRightSide}
                            darkMode={darkMode}
                            messageId={msg.id}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Rodapé da Bolha: Horário (Brasília UTC-3), Estrela de Favorito e Double Check azul */}
                <div
                  className={`flex items-center justify-end gap-1 text-[11px] mt-0.5 float-right ml-2.5 ${
                    darkMode ? 'text-[#8696a0]' : 'text-[#667781]'
                  }`}
                >
                  {(starredMessages[msg.id] || msg.isStarred) && (
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                  )}
                  <span>{formattedTime}</span>
                  {isRightSide && (
                    <span
                      title={
                        msg.status === 'read'
                          ? 'Lida'
                          : msg.status === 'delivered'
                          ? 'Entregue'
                          : 'Enviada'
                      }
                    >
                      <CheckCheck
                        className={`w-4 h-4 ${
                          msg.status === 'read'
                            ? 'text-[#53bdeb]' // Azul oficial do WhatsApp lido
                            : darkMode
                            ? 'text-[#8696a0]'
                            : 'text-[#667781]'
                        }`}
                      />
                    </span>
                  )}
                </div>

                {/* Badge de Reação com Emoji no canto inferior da bolha */}
                {(messageReactions[msg.id] || msg.reaction) && (
                  <div
                    className={`absolute -bottom-2.5 ${
                      isRightSide ? 'right-2' : 'left-2'
                    } px-1.5 py-0.5 rounded-full text-xs shadow-md border flex items-center gap-0.5 z-10 ${
                      darkMode ? 'bg-[#202c33] border-[#374248]' : 'bg-white border-gray-200'
                    }`}
                  >
                    <span>{messageReactions[msg.id] || msg.reaction}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Barra de Resposta Citada (WhatsApp Reply preview) */}
      {replyingToMessage && (
        <div
          className={`px-4 py-2 border-t flex items-center justify-between transition-all shrink-0 ${
            darkMode ? 'bg-[#1f2c34] border-[#222e35]' : 'bg-[#e9edef] border-[#d1d7db]'
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-1 h-9 bg-[#00a884] rounded-full shrink-0" />
            <div className="text-xs overflow-hidden">
              <span className="font-semibold text-[#00a884] block truncate">
                {replyingToMessage.senderType === 'contact' ? conversation.contact.name : 'Você'}
              </span>
              <span className={`block truncate ${darkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>
                {replyingToMessage.contentType === 'audio'
                  ? '🎤 Mensagem de voz'
                  : replyingToMessage.contentType === 'sticker'
                  ? '💟 Figurinha'
                  : replyingToMessage.contentType === 'gif'
                  ? '🎬 GIF'
                  : replyingToMessage.contentType === 'image'
                  ? '📷 Foto'
                  : replyingToMessage.content}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyingToMessage(null)}
            className={`p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${
              darkMode ? 'text-[#8696a0]' : 'text-[#667781]'
            }`}
            title="Cancelar resposta"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chat Input Bar */}
      <div
        className={`px-3 sm:px-4 py-2 flex items-end gap-2 border-t z-20 shrink-0 ${
          darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-[#f0f2f5] border-[#e9edef]'
        }`}
      >
        <div className="flex items-center gap-1 text-[#8696a0] pb-1 relative">
          <button
            type="button"
            className={`p-1.5 rounded-full transition-colors ${
              darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
            title="Emojis"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setIsAttachmentMenuOpen((prev) => !prev)}
            className={`p-1.5 rounded-full transition-all cursor-pointer ${
              isAttachmentMenuOpen
                ? 'bg-[#00a884]/20 text-[#00a884]'
                : darkMode
                ? 'hover:bg-[#374248] text-[#aebac1]'
                : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
            title="Anexar (Imagem, Documento, Áudio)"
          >
            <Paperclip
              className={`w-5 h-5 transition-transform duration-200 ${
                isAttachmentMenuOpen ? 'rotate-45 text-[#00a884]' : ''
              }`}
            />
          </button>

          {/* Hidden File Inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,video/mp4"
            className="hidden"
            onChange={handleImageFileChange}
          />
          <input
            ref={documentInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,application/pdf"
            className="hidden"
            onChange={handleDocumentFileChange}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.opus,.m4a,.aac"
            className="hidden"
            onChange={handleAudioFileChange}
          />

          {/* Attachment Popup Menu - ONLY Imagem, Documento and Áudio as requested */}
          {isAttachmentMenuOpen && (
            <div
              ref={attachmentMenuRef}
              className={`absolute bottom-12 left-0 mb-2 z-50 rounded-2xl shadow-2xl border p-2 flex flex-col gap-1 w-52 animate-in fade-in slide-in-from-bottom-2 duration-150 ${
                darkMode
                  ? 'bg-[#233138] border-[#2e3b43] text-[#e9edef] shadow-black/60'
                  : 'bg-white border-[#e9edef] text-[#111b21] shadow-2xl'
              }`}
            >
              {/* Option 1: Imagem */}
              <button
                type="button"
                onClick={() => {
                  setIsAttachmentMenuOpen(false);
                  imageInputRef.current?.click();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group text-left ${
                  darkMode ? 'hover:bg-[#182229]' : 'hover:bg-[#f5f6f6]'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#ac44cf] to-[#d66bf6] shadow-sm flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold leading-tight">Imagem</div>
                  <div className="text-[11px] text-[#8696a0]">Fotos e imagens</div>
                </div>
              </button>

              {/* Option 2: Documento */}
              <button
                type="button"
                onClick={() => {
                  setIsAttachmentMenuOpen(false);
                  documentInputRef.current?.click();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group text-left ${
                  darkMode ? 'hover:bg-[#182229]' : 'hover:bg-[#f5f6f6]'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#5f66cd] to-[#888efc] shadow-sm flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold leading-tight">Documento</div>
                  <div className="text-[11px] text-[#8696a0]">PDF, DOCX, arquivos</div>
                </div>
              </button>

              {/* Option 3: Áudio */}
              <button
                type="button"
                onClick={() => {
                  setIsAttachmentMenuOpen(false);
                  audioInputRef.current?.click();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer group text-left ${
                  darkMode ? 'hover:bg-[#182229]' : 'hover:bg-[#f5f6f6]'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#e542a3] to-[#f368be] shadow-sm flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold leading-tight">Áudio</div>
                  <div className="text-[11px] text-[#8696a0]">Arquivos de áudio</div>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 relative flex items-center min-h-[40px]">
          {textSelection && (
            <WhatsAppFormatToolbar
              textareaRef={textareaRef}
              inputText={inputText}
              selection={textSelection}
              onUpdateText={(newText, newStart, newEnd) => {
                setInputText(newText);
                if (newStart !== undefined && newEnd !== undefined && newStart !== newEnd) {
                  setTextSelection({ start: newStart, end: newEnd });
                } else {
                  setTextSelection(null);
                }
              }}
              darkMode={darkMode}
            />
          )}

          <textarea
            ref={textareaRef}
            id="chat-input-textarea"
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              updateSelectionState();
            }}
            onSelect={updateSelectionState}
            onKeyUp={updateSelectionState}
            onMouseUp={updateSelectionState}
            onKeyDown={handleKeyDown}
            placeholder={
              convStatus === 'ai'
                ? 'Digite uma mensagem (Você assumirá o atendimento automaticamente)...'
                : 'Digite uma mensagem...'
            }
            rows={1}
            className={`w-full py-2.5 px-3.5 rounded-lg text-sm outline-none resize-none leading-relaxed transition-[height] duration-75 overflow-y-auto max-h-[220px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
              darkMode
                ? 'bg-[#2a3942] text-[#d1d7db] placeholder-[#8696a0]'
                : 'bg-white text-[#111b21] placeholder-[#54656f]'
            }`}
          />
        </div>

        <div className="flex items-center text-[#8696a0] pb-0.5">
          {inputText.trim() ? (
            <button
              id="btn-send-message"
              onClick={handleSend}
              className="p-2 rounded-full bg-[#00a884] text-white hover:bg-[#02906f] transition-colors shadow-sm cursor-pointer"
              title="Enviar mensagem"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              id="btn-send-voice-note"
              onClick={handleSendAudioSimulated}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
              }`}
              title="Gravar áudio (PTT) simulado"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* MODAL: Mensagens Temporárias */}
      {isDisappearingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 ${
              darkMode ? 'bg-[#222e35] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#00a884]" />
                <h3 className="font-semibold text-base">Mensagens temporárias</h3>
              </div>
              <button
                onClick={() => setIsDisappearingModalOpen(false)}
                className="p-1 rounded-full text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8696a0] mb-5 leading-relaxed">
              Para mais privacidade e espaço de armazenamento, todas as novas mensagens desaparecerão desta conversa após o período selecionado.
            </p>

            <div className="space-y-3 mb-6">
              {[
                { id: '24h', label: '24 horas' },
                { id: '7d', label: '7 dias' },
                { id: '90d', label: '90 dias' },
                { id: 'off', label: 'Desativadas' },
              ].map((opt) => (
                <label
                  key={opt.id}
                  onClick={() => setDisappearingDuration(opt.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    disappearingDuration === opt.id
                      ? 'border-[#00a884] bg-[#00a884]/10'
                      : darkMode
                      ? 'border-[#2a3942] hover:bg-[#182229]'
                      : 'border-[#e9edef] hover:bg-[#f5f6f6]'
                  }`}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      disappearingDuration === opt.id
                        ? 'border-[#00a884] bg-[#00a884]'
                        : 'border-[#8696a0]'
                    }`}
                  >
                    {disappearingDuration === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDisappearingModalOpen(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  darkMode ? 'hover:bg-[#182229] text-[#8696a0]' : 'hover:bg-[#f5f6f6] text-[#54656f]'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setIsDisappearingModalOpen(false);
                  showToast(
                    disappearingDuration === 'off'
                      ? 'Mensagens temporárias desativadas'
                      : `Mensagens temporárias ativadas (${disappearingDuration})`
                  );
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00a884] hover:bg-[#02906f] text-white transition-colors cursor-pointer"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Mudar Lista / Etiquetas CRM */}
      {isChangeListModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 ${
              darkMode ? 'bg-[#222e35] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TagIcon className="w-5 h-5 text-[#00a884]" />
                <h3 className="font-semibold text-base">Mudar lista / Etiquetas</h3>
              </div>
              <button
                onClick={() => setIsChangeListModalOpen(false)}
                className="p-1 rounded-full text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#8696a0] mb-4">
              Selecione as listas de transmissão ou etiquetas de funil para o contato <strong>{contact.name}</strong>:
            </p>

            <div className="space-y-2 mb-6 max-h-56 overflow-y-auto pr-1">
              {availableTags.map((tag) => {
                const isSelected = (contact.tags || []).some((t) => t.id === tag.id);
                return (
                  <label
                    key={tag.id}
                    onClick={() => {
                      if (isSelected) {
                        onRemoveTag?.(tag.id);
                      } else {
                        onAddTag?.(tag);
                      }
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#00a884] bg-[#00a884]/10'
                        : darkMode
                        ? 'border-[#2a3942] hover:bg-[#182229]'
                        : 'border-[#e9edef] hover:bg-[#f5f6f6]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: tag.textColor || '#00a884' }}
                      />
                      <span className="text-xs font-semibold">{tag.name}</span>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-[#00a884] border-[#00a884] text-white' : 'border-[#8696a0]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsChangeListModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00a884] hover:bg-[#02906f] text-white transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirmação Genérica (Denunciar, Bloquear, Limpar, Apagar) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 ${
              darkMode ? 'bg-[#222e35] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <AlertTriangle
                className={`w-5 h-5 shrink-0 ${
                  confirmModal.isDestructive ? 'text-rose-500' : 'text-amber-500'
                }`}
              />
              <h3 className="font-semibold text-base">{confirmModal.title}</h3>
            </div>

            <p className="text-xs text-[#8696a0] mb-6 leading-relaxed">
              {confirmModal.description}
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  darkMode ? 'hover:bg-[#182229] text-[#8696a0]' : 'hover:bg-[#f5f6f6] text-[#54656f]'
                }`}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmModalAction}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer ${
                  confirmModal.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#00a884] hover:bg-[#02906f]'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: Dados da Mensagem */}
      {messageDetailsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-in zoom-in-95 ${
              darkMode ? 'bg-[#222e35] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-[#00a884]" />
                <h3 className="font-semibold text-base">Dados da mensagem</h3>
              </div>
              <button
                onClick={() => setMessageDetailsModal(null)}
                className="p-1 rounded-full text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs mb-6">
              <div
                className={`p-3 rounded-lg border ${
                  darkMode ? 'bg-[#111b21] border-[#222e35]' : 'bg-[#f0f2f5] border-[#e9edef]'
                }`}
              >
                <span className="text-[#8696a0] block mb-1 font-medium">Conteúdo</span>
                <p className="text-sm font-normal break-words whitespace-pre-wrap">
                  {messageDetailsModal.content || messageDetailsModal.mediaUrl || '(Mídia)'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div
                  className={`p-3 rounded-lg border ${
                    darkMode ? 'bg-[#111b21] border-[#222e35]' : 'bg-[#f0f2f5] border-[#e9edef]'
                  }`}
                >
                  <span className="text-[#8696a0] block mb-1">Remetente</span>
                  <span className="font-medium text-sm">
                    {messageDetailsModal.senderType === 'contact' ? conversation.contact.name : 'Você'}
                  </span>
                </div>
                <div
                  className={`p-3 rounded-lg border ${
                    darkMode ? 'bg-[#111b21] border-[#222e35]' : 'bg-[#f0f2f5] border-[#e9edef]'
                  }`}
                >
                  <span className="text-[#8696a0] block mb-1">Status</span>
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    <CheckCheck className="w-4 h-4 text-[#53bdeb]" />
                    <span className="capitalize">
                      {messageDetailsModal.status === 'read'
                        ? 'Lida'
                        : messageDetailsModal.status === 'delivered'
                        ? 'Entregue'
                        : 'Enviada'}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className={`p-3 rounded-lg border ${
                  darkMode ? 'bg-[#111b21] border-[#222e35]' : 'bg-[#f0f2f5] border-[#e9edef]'
                }`}
              >
                <span className="text-[#8696a0] block mb-1">Data e Hora (Horário de Brasília)</span>
                <span className="font-medium text-sm">
                  {formatSaoPauloDate(messageDetailsModal.timestamp)} às {formatSaoPauloTime(messageDetailsModal.timestamp)}
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setMessageDetailsModal(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00a884] text-white hover:bg-[#02906f] transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX: Visualizador de Figurinha / GIF / Foto em tela cheia */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
            <a
              href={previewImageUrl}
              target="_blank"
              rel="noreferrer"
              download
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Baixar imagem original"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={() => setPreviewImageUrl(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Fechar visualizador"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div
            className="max-w-4xl max-h-[85vh] flex items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/\.(mp4|webm)(\?[^\s]*)?$/i.test(previewImageUrl) ? (
              <video
                src={previewImageUrl}
                controls
                autoPlay
                loop
                className="max-h-[80vh] max-w-full rounded-lg shadow-2xl object-contain"
              />
            ) : (
              <img
                src={previewImageUrl}
                alt="Visualização de Mídia"
                className="max-h-[80vh] max-w-full rounded-lg shadow-2xl object-contain"
              />
            )}
          </div>
        </div>
      )}

      {/* MODAL: Enviar Imagem com Legenda (Estilo WhatsApp) */}
      {imagePreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-between p-4 backdrop-blur-sm animate-in fade-in duration-200">
          {/* Header */}
          <div className="w-full max-w-4xl flex items-center justify-between text-white py-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setImagePreviewModal(null)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h3 className="font-semibold text-sm">Enviar imagem</h3>
                <p className="text-xs text-white/60 truncate max-w-xs">{imagePreviewModal.file.name}</p>
              </div>
            </div>
            <div className="text-xs text-white/60">
              {imagePreviewModal.file.size > 1024 * 1024
                ? `${(imagePreviewModal.file.size / (1024 * 1024)).toFixed(1)} MB`
                : `${Math.round(imagePreviewModal.file.size / 1024)} KB`}
            </div>
          </div>

          {/* Imagem Central */}
          <div className="flex-1 flex items-center justify-center p-2 max-w-4xl max-h-[65vh] w-full">
            <img
              src={imagePreviewModal.previewUrl}
              alt="Prévia"
              className="max-h-[62vh] max-w-full rounded-xl shadow-2xl object-contain"
            />
          </div>

          {/* Barra de Legenda e Envio */}
          <div className="w-full max-w-2xl pb-4">
            <div
              className={`flex items-center gap-3 p-2 rounded-2xl border shadow-xl ${
                darkMode ? 'bg-[#202c33] border-[#2e3b43]' : 'bg-white border-[#e9edef]'
              }`}
            >
              <input
                type="text"
                autoFocus
                value={imagePreviewModal.caption}
                onChange={(e) =>
                  setImagePreviewModal((prev) => (prev ? { ...prev, caption: e.target.value } : null))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmSendImage();
                  }
                }}
                placeholder="Adicionar uma legenda..."
                className={`flex-1 px-3 py-2 text-sm bg-transparent outline-none ${
                  darkMode ? 'text-white placeholder-[#8696a0]' : 'text-[#111b21] placeholder-[#667781]'
                }`}
              />
              <button
                type="button"
                onClick={handleConfirmSendImage}
                disabled={imagePreviewModal.isUploading}
                className="p-3 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white transition-colors cursor-pointer disabled:opacity-50 shrink-0 shadow-md"
                title="Enviar imagem"
              >
                {imagePreviewModal.isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Enviar Documento */}
      {documentPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
              darkMode ? 'bg-[#222e35] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base">Enviar Documento</h3>
              <button
                type="button"
                onClick={() => setDocumentPreviewModal(null)}
                className="p-1 rounded-full text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className={`flex items-center gap-3.5 p-4 rounded-xl border mb-4 ${
                darkMode ? 'bg-[#182229] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#e9edef]'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#5f66cd] to-[#888efc] flex items-center justify-center text-white shrink-0 shadow-sm">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" title={documentPreviewModal.file.name}>
                  {documentPreviewModal.file.name}
                </p>
                <p className="text-xs text-[#8696a0] mt-0.5">
                  {documentPreviewModal.formattedSize}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-[#8696a0] mb-1 font-medium">Legenda (opcional):</label>
              <input
                type="text"
                autoFocus
                value={documentPreviewModal.caption}
                onChange={(e) =>
                  setDocumentPreviewModal((prev) => (prev ? { ...prev, caption: e.target.value } : null))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmSendDocument();
                  }
                }}
                placeholder="Ex: Segue a proposta comercial em anexo..."
                className={`w-full px-3 py-2 text-sm rounded-lg border outline-none ${
                  darkMode
                    ? 'bg-[#2a3942] border-[#374248] text-white placeholder-[#8696a0] focus:border-[#00a884]'
                    : 'bg-white border-[#d1d7db] text-[#111b21] placeholder-[#8696a0] focus:border-[#00a884]'
                }`}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDocumentPreviewModal(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  darkMode ? 'bg-[#111b21] text-[#8696a0] hover:text-white' : 'bg-gray-100 text-[#54656f] hover:bg-gray-200'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSendDocument}
                disabled={documentPreviewModal.isUploading}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#00a884] hover:bg-[#02906f] text-white flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {documentPreviewModal.isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Documento</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Enviar Arquivo de Áudio */}
      {audioPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border ${
              darkMode ? 'bg-[#222e35] border-[#2a3942] text-[#e9edef]' : 'bg-white border-[#e9edef] text-[#111b21]'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base">Enviar Áudio</h3>
              <button
                type="button"
                onClick={() => setAudioPreviewModal(null)}
                className="p-1 rounded-full text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className={`flex items-center gap-3.5 p-4 rounded-xl border mb-4 ${
                darkMode ? 'bg-[#182229] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#e9edef]'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#e542a3] to-[#f368be] flex items-center justify-center text-white shrink-0 shadow-sm">
                <Headphones className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" title={audioPreviewModal.file.name}>
                  {audioPreviewModal.file.name}
                </p>
                <p className="text-xs text-[#8696a0] mt-0.5">
                  {audioPreviewModal.formattedSize}
                </p>
              </div>
            </div>

            <div className="mb-5">
              <audio controls src={audioPreviewModal.previewUrl} className="w-full h-10 rounded-lg" />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAudioPreviewModal(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  darkMode ? 'bg-[#111b21] text-[#8696a0] hover:text-white' : 'bg-gray-100 text-[#54656f] hover:bg-gray-200'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSendAudio}
                disabled={audioPreviewModal.isUploading}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#00a884] hover:bg-[#02906f] text-white flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {audioPreviewModal.isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar Áudio</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
