import React, { useState } from 'react';
import {
  X,
  Plus,
  Phone,
  Instagram,
  Globe,
  Sparkles,
  Send,
  Check
} from 'lucide-react';
import { ChannelType } from '../types';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateIncoming: (data: {
    name: string;
    channel: ChannelType;
    messageText: string;
    isAudio?: boolean;
    phone?: string;
  }) => void;
  darkMode: boolean;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  isOpen,
  onClose,
  onSimulateIncoming,
  darkMode,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<ChannelType>('whatsapp');
  const [messageText, setMessageText] = useState('Olá! Gostaria de agendar uma consulta.');
  const [isAudio, setIsAudio] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !messageText.trim()) return;
    onSimulateIncoming({
      name: name.trim(),
      phone: phone.trim() || '+55 11 9' + Math.floor(10000000 + Math.random() * 90000000),
      channel,
      messageText: messageText.trim(),
      isAudio,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden ${
          darkMode ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
        }`}
      >
        <div
          className={`px-5 py-4 flex items-center justify-between border-b ${
            darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-[#f0f2f5] border-[#e9edef]'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-[#00a884]" />
            <span>Simular Webhook / Nova Conversa</span>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-full ${
              darkMode ? 'hover:bg-[#374248] text-[#8696a0]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Channel selector */}
          <div>
            <label className={`block font-semibold mb-1.5 ${darkMode ? 'text-[#8696a0]' : 'text-[#54656f]'}`}>
              Canal de Entrada
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  channel === 'whatsapp'
                    ? 'bg-[#25d366] text-white border-transparent'
                    : darkMode
                    ? 'bg-[#202c33] border-[#222e35] text-[#8696a0]'
                    : 'bg-gray-100 border-gray-200 text-[#54656f]'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel('instagram')}
                className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  channel === 'instagram'
                    ? 'bg-gradient-to-r from-purple-600 to-rose-600 text-white border-transparent'
                    : darkMode
                    ? 'bg-[#202c33] border-[#222e35] text-[#8696a0]'
                    : 'bg-gray-100 border-gray-200 text-[#54656f]'
                }`}
              >
                <Instagram className="w-3.5 h-3.5" />
                <span>Instagram</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel('webchat')}
                className={`py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  channel === 'webchat'
                    ? 'bg-[#00a884] text-white border-transparent'
                    : darkMode
                    ? 'bg-[#202c33] border-[#222e35] text-[#8696a0]'
                    : 'bg-gray-100 border-gray-200 text-[#54656f]'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Web Chat</span>
              </button>
            </div>
          </div>

          {/* Contact Name */}
          <div>
            <label className={`block font-semibold mb-1 ${darkMode ? 'text-[#8696a0]' : 'text-[#54656f]'}`}>
              Nome do Cliente
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Andrade"
              className={`w-full p-2.5 rounded-lg border focus:outline-none focus:border-[#00a884] ${
                darkMode ? 'bg-[#202c33] border-[#222e35] text-[#e9edef]' : 'bg-gray-50 border-gray-300 text-[#111b21]'
              }`}
            />
          </div>

          {/* Phone or ID */}
          <div>
            <label className={`block font-semibold mb-1 ${darkMode ? 'text-[#8696a0]' : 'text-[#54656f]'}`}>
              Número de Telefone ou Identificador
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 99999-8888"
              className={`w-full p-2.5 rounded-lg border focus:outline-none focus:border-[#00a884] ${
                darkMode ? 'bg-[#202c33] border-[#222e35] text-[#e9edef]' : 'bg-gray-50 border-gray-300 text-[#111b21]'
              }`}
            />
          </div>

          {/* Message Text */}
          <div>
            <label className={`block font-semibold mb-1 ${darkMode ? 'text-[#8696a0]' : 'text-[#54656f]'}`}>
              Primeira Mensagem Recebida
            </label>
            <textarea
              rows={2}
              required
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className={`w-full p-2.5 rounded-lg border focus:outline-none focus:border-[#00a884] resize-none ${
                darkMode ? 'bg-[#202c33] border-[#222e35] text-[#e9edef]' : 'bg-gray-50 border-gray-300 text-[#111b21]'
              }`}
            />
          </div>

          {/* Audio toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="chk-audio"
              checked={isAudio}
              onChange={(e) => setIsAudio(e.target.checked)}
              className="rounded text-[#00a884] focus:ring-[#00a884]"
            />
            <label htmlFor="chk-audio" className="cursor-pointer">
              Simular como mensagem de voz (Áudio)
            </label>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-3 py-2 rounded-lg font-semibold ${
                darkMode ? 'text-[#8696a0] hover:bg-[#202c33]' : 'text-[#54656f] hover:bg-gray-100'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#00a884] hover:bg-[#00a884]/90 text-white font-bold flex items-center gap-1.5 shadow"
            >
              <Send className="w-4 h-4" />
              <span>Simular Recebimento Webhook</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
