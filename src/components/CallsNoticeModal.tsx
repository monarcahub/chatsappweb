import React from 'react';
import { PhoneOff, X, AlertCircle } from 'lucide-react';

interface CallsNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export const CallsNoticeModal: React.FC<CallsNoticeModalProps> = ({
  isOpen,
  onClose,
  darkMode,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border transition-all transform scale-100 ${
          darkMode ? 'bg-[#202c33] border-[#2f3b43] text-[#e9edef]' : 'bg-white border-gray-200 text-[#111b21]'
        }`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <PhoneOff className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base">Aviso de Ligações</h3>
              <span className="text-[11px] text-gray-400">Recurso de Voz & Chamadas</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors ${
              darkMode ? 'hover:bg-[#374248] text-[#8696a0]' : 'hover:bg-gray-100 text-gray-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className={`p-4 rounded-xl border text-sm leading-relaxed mb-6 ${
            darkMode ? 'bg-[#111b21] border-[#222e35] text-[#d1d7db]' : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="font-medium text-sm">
              Ligações e históricos de ligações não estão disponíveis nesse seu dispositivo ou não estão de acordo com seu plano.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#00a884] hover:bg-[#02906f] text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
