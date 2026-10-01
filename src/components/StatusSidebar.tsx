import React, { useState, useRef } from 'react';
import {
  MoreVertical,
  Plus,
  Image as ImageIcon,
  Pencil,
  ArrowLeft,
  X,
  Send,
  CheckCircle2,
  Smile,
  Palette,
  Eye,
  Clock
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { useAuth } from '../context/AuthContext';

interface StatusSidebarProps {
  darkMode: boolean;
  onBackToChats: () => void;
}

interface StatusItem {
  id: string;
  authorName: string;
  authorAvatar: string;
  timestamp: string;
  type: 'text' | 'media';
  content: string; // text or image url
  caption?: string;
  bgColor?: string;
  isMyStatus?: boolean;
}

const INITIAL_STATUSES: StatusItem[] = [
  {
    id: 'status_mariana',
    authorName: 'Mariana Souza',
    authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    timestamp: 'Hoje às 10:45',
    type: 'media',
    content: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&auto=format&fit=crop&q=80',
    caption: 'Reunião de alinhamento com a equipe MonarcaHub! 🚀',
  },
  {
    id: 'status_carlos',
    authorName: 'Carlos Henrique',
    authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    timestamp: 'Hoje às 09:12',
    type: 'text',
    content: 'Novas automações rodando a 100%! Atendimento ao cliente voando. ⚡',
    bgColor: '#005c4b',
  },
  {
    id: 'status_juliana',
    authorName: 'Dra. Juliana Mendes',
    authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    timestamp: 'Ontem às 21:30',
    type: 'media',
    content: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
    caption: 'Plantão finalizado com sucesso. Amanhã seguimos com os agendamentos.',
  },
];

const BG_COLORS = ['#005c4b', '#1f2c34', '#7c2d12', '#4c1d95', '#065f46', '#831843', '#1e3a8a'];

export const StatusSidebar: React.FC<StatusSidebarProps> = ({ darkMode, onBackToChats }) => {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'none' | 'media' | 'text'>('none');
  const [activeViewingStatus, setActiveViewingStatus] = useState<StatusItem | null>(null);
  const [myStatuses, setMyStatuses] = useState<StatusItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states for text status
  const [textContent, setTextContent] = useState('');
  const [textBgColor, setTextBgColor] = useState(BG_COLORS[0]);

  // Form states for media status
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handlePostTextStatus = () => {
    if (!textContent.trim()) return;

    const newStatus: StatusItem = {
      id: `status_my_${Date.now()}`,
      authorName: user?.name || 'Meu status',
      authorAvatar: user?.avatarUrl || '',
      timestamp: 'Agora mesmo',
      type: 'text',
      content: textContent.trim(),
      bgColor: textBgColor,
      isMyStatus: true,
    };

    setMyStatuses([newStatus, ...myStatuses]);
    setComposerMode('none');
    setTextContent('');
    showToast('Status publicado no WhatsApp com sucesso!');
  };

  const handlePostMediaStatus = () => {
    const finalUrl = mediaUrl.trim() || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80';

    const newStatus: StatusItem = {
      id: `status_my_${Date.now()}`,
      authorName: user?.name || 'Meu status',
      authorAvatar: user?.avatarUrl || '',
      timestamp: 'Agora mesmo',
      type: 'media',
      content: finalUrl,
      caption: mediaCaption.trim(),
      isMyStatus: true,
    };

    setMyStatuses([newStatus, ...myStatuses]);
    setComposerMode('none');
    setMediaUrl('');
    setMediaCaption('');
    showToast('Status com foto/vídeo enviado com sucesso!');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMediaUrl(url);
    }
  };

  return (
    <div
      className={`h-full flex flex-col relative select-none border-r ${
        darkMode ? 'bg-[#111b21] border-[#222e35]' : 'bg-white border-[#e9edef]'
      }`}
    >
      {/* Toast notification */}
      {toastMessage && (
        <div className="absolute top-16 left-4 right-4 z-50 p-3 rounded-xl bg-[#00a884] text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header matching user screenshot */}
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
            Status
          </h1>
        </div>

        <div className="flex items-center gap-1">
          {/* Plus icon from screenshot */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-2 rounded-full transition-colors relative ${
              darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-gray-200 text-[#54656f]'
            }`}
            title="Adicionar status"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* More Vertical Options */}
          <button
            className={`p-2 rounded-full transition-colors ${
              darkMode ? 'hover:bg-[#374248] text-[#aebac1]' : 'hover:bg-gray-200 text-[#54656f]'
            }`}
            title="Privacidade do status"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Meu status row (exactly as shown in screenshot) */}
        <div className="relative">
          <div
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex items-center gap-3.5 p-2 rounded-xl cursor-pointer transition-colors ${
              darkMode ? 'hover:bg-[#202c33]' : 'hover:bg-gray-100'
            }`}
          >
            {/* Avatar with + icon badge */}
            <div className="relative shrink-0">
              <UserAvatar
                name={user?.name || 'Você'}
                avatarUrl={user?.avatarUrl}
                size="lg"
                className={myStatuses.length > 0 ? 'ring-2 ring-[#00a884]' : ''}
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-md ring-2 ring-[#111b21]">
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className={`font-semibold text-sm ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                Meu status
              </div>
              <div className="text-xs text-[#8696a0] truncate">
                {myStatuses.length > 0 ? `${myStatuses[0].timestamp} • ${myStatuses.length} postado(s)` : 'Clique para atualizar seu status'}
              </div>
            </div>
          </div>

          {/* Screenshot Dropdown Popover: "Fotos e vídeos" & "Texto" */}
          {isMenuOpen && (
            <div
              className={`absolute top-16 left-12 z-40 w-52 rounded-2xl p-1.5 shadow-2xl border backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${
                darkMode ? 'bg-[#233138] border-[#2f3b43] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
              }`}
            >
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setComposerMode('media');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  darkMode ? 'hover:bg-[#182229] text-[#e9edef]' : 'hover:bg-gray-100 text-gray-800'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <span>Fotos e vídeos</span>
              </button>

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setComposerMode('text');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  darkMode ? 'hover:bg-[#182229] text-[#e9edef]' : 'hover:bg-gray-100 text-gray-800'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <span>Texto</span>
              </button>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className={`border-b ${darkMode ? 'border-[#222e35]' : 'border-gray-200'}`} />

        {/* Status Recentes section */}
        <div>
          <h2 className="text-xs font-semibold text-[#8696a0] px-2 py-1 uppercase tracking-wider">
            Recentes
          </h2>

          <div className="mt-1 space-y-1">
            {INITIAL_STATUSES.map((status) => (
              <div
                key={status.id}
                onClick={() => setActiveViewingStatus(status)}
                className={`flex items-center gap-3.5 p-2 rounded-xl cursor-pointer transition-colors ${
                  darkMode ? 'hover:bg-[#202c33]' : 'hover:bg-gray-100'
                }`}
              >
                {/* Circular Status Ring (Green for unseen) */}
                <div className="p-0.5 rounded-full border-2 border-[#00a884] shrink-0">
                  <img
                    src={status.authorAvatar}
                    alt={status.authorName}
                    className="w-11 h-11 rounded-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${darkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                    {status.authorName}
                  </div>
                  <div className="text-xs text-[#8696a0] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{status.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info card for Status Publishing */}
        <div
          className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
            darkMode ? 'bg-[#182229] border-[#222e35] text-[#8696a0]' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="font-semibold text-[#00a884] flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" />
            <span>Sincronização de Status</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Ao postar novos status aqui, os dados são sincronizados automaticamente com o seu canal conectado do WhatsApp.
          </p>
        </div>
      </div>

      {/* Composer Modal: Text Status */}
      {composerMode === 'text' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-gray-700">
            {/* Top Toolbar */}
            <div className="p-4 bg-black/40 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#00a884]" />
                <span className="font-bold text-sm">Atualizar Status de Texto</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Color pickers */}
                <div className="flex items-center gap-1.5 bg-black/50 p-1.5 rounded-full">
                  {BG_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setTextBgColor(c)}
                      className={`w-5 h-5 rounded-full transition-transform ${
                        textBgColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setComposerMode('none')}
                  className="p-1 rounded-full hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div
              className="min-h-[260px] p-8 flex items-center justify-center transition-colors"
              style={{ backgroundColor: textBgColor }}
            >
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Digite seu status aqui..."
                rows={4}
                maxLength={400}
                className="w-full text-center bg-transparent border-none text-white text-2xl font-semibold placeholder:text-white/50 focus:outline-none resize-none font-sans"
              />
            </div>

            {/* Bottom actions */}
            <div className="p-4 bg-[#111b21] flex items-center justify-between text-xs">
              <span className="text-gray-400">{textContent.length} / 400 caracteres</span>
              <button
                onClick={handlePostTextStatus}
                disabled={!textContent.trim()}
                className="px-5 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#02906f] disabled:opacity-50 text-white font-bold flex items-center gap-2 transition-all shadow-lg cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Postar Status no WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Composer Modal: Media Status */}
      {composerMode === 'media' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl bg-[#202c33] border border-[#2f3b43] text-[#e9edef] flex flex-col">
            <div className="p-4 border-b border-[#2f3b43] flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-[#00a884]">
                <ImageIcon className="w-5 h-5" />
                <span>Postar Foto ou Vídeo no Status</span>
              </div>
              <button
                onClick={() => setComposerMode('none')}
                className="p-1 rounded-full hover:bg-[#374248] text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Media preview or selector */}
              {mediaUrl ? (
                <div className="relative rounded-xl overflow-hidden max-h-64 bg-black flex items-center justify-center border border-gray-700">
                  <img src={mediaUrl} alt="Preview" className="max-h-64 object-contain" />
                  <button
                    onClick={() => setMediaUrl('')}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-8 rounded-xl border-2 border-dashed border-[#2f3b43] hover:border-[#00a884] bg-[#111b21] flex flex-col items-center justify-center cursor-pointer transition-colors text-center"
                >
                  <ImageIcon className="w-10 h-10 text-[#00a884] mb-2" />
                  <span className="font-semibold text-sm">Clique para carregar uma foto ou vídeo</span>
                  <span className="text-xs text-gray-400 mt-1">Formatos suportados: PNG, JPG, MP4</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Or paste image URL */}
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Ou cole uma URL direta da imagem:</label>
                <input
                  type="text"
                  placeholder="https://exemplo.com/minha-imagem.jpg"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#111b21] border border-[#2f3b43] text-sm text-white focus:outline-none focus:border-[#00a884]"
                />
              </div>

              {/* Caption */}
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Legenda do status (opcional):</label>
                <input
                  type="text"
                  placeholder="Adicione uma legenda..."
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#111b21] border border-[#2f3b43] text-sm text-white focus:outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            <div className="p-4 border-t border-[#2f3b43] bg-[#182229] flex items-center justify-between">
              <span className="text-[11px] text-gray-400">Sincronização Instantânea</span>
              <button
                onClick={handlePostMediaStatus}
                className="px-5 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Postar Status no WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Status Viewer (WhatsApp Style) */}
      {activeViewingStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-in fade-in">
          <div className="w-full max-w-md h-[90vh] flex flex-col justify-between p-4 relative">
            {/* Top progress bar */}
            <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden mb-4">
              <div className="h-full bg-white animate-[progress_5s_linear]" />
            </div>

            {/* Author info & close button */}
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <img
                  src={activeViewingStatus.authorAvatar}
                  alt={activeViewingStatus.authorName}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white/60"
                />
                <div>
                  <div className="font-bold text-sm text-white">{activeViewingStatus.authorName}</div>
                  <div className="text-xs text-white/70">{activeViewingStatus.timestamp}</div>
                </div>
              </div>
              <button
                onClick={() => setActiveViewingStatus(null)}
                className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center my-auto p-4">
              {activeViewingStatus.type === 'media' ? (
                <div className="text-center space-y-3">
                  <img
                    src={activeViewingStatus.content}
                    alt="Status Content"
                    className="max-h-[60vh] max-w-full rounded-2xl object-contain mx-auto shadow-2xl"
                  />
                  {activeViewingStatus.caption && (
                    <p className="text-white text-base font-medium px-4 py-2 bg-black/50 rounded-xl max-w-sm mx-auto">
                      {activeViewingStatus.caption}
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="w-full h-80 rounded-2xl p-6 flex items-center justify-center text-center shadow-2xl"
                  style={{ backgroundColor: activeViewingStatus.bgColor || '#005c4b' }}
                >
                  <p className="text-white text-2xl font-bold leading-relaxed">
                    {activeViewingStatus.content}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom info */}
            <div className="text-center text-white/50 text-xs pb-2">
              Toque para fechar ou aguarde o término
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
