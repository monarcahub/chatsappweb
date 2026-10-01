import React from 'react';
import { Strikethrough, List, ListOrdered, Quote } from 'lucide-react';
import { WhatsAppFormatType, applyWhatsAppFormatting } from '../utils/whatsappFormatter';

interface WhatsAppFormatToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  inputText: string;
  onUpdateText: (newText: string, newStart?: number, newEnd?: number) => void;
  selection: { start: number; end: number } | null;
  onClose?: () => void;
  darkMode?: boolean;
}

export const WhatsAppFormatToolbar: React.FC<WhatsAppFormatToolbarProps> = ({
  textareaRef,
  inputText,
  onUpdateText,
  selection,
  darkMode = true,
}) => {
  if (!selection || selection.start === selection.end) {
    return null;
  }

  const handleFormat = (type: WhatsAppFormatType) => {
    const textarea = textareaRef.current;
    const start = selection.start;
    const end = selection.end;

    const result = applyWhatsAppFormatting(inputText, start, end, type);
    onUpdateText(result.text, result.newStart, result.newEnd);

    // Mantém o foco e restaura a seleção no textarea no próximo tick
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(result.newStart, result.newEnd);
      }
    }, 10);
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatação de texto do WhatsApp"
      className={`absolute -top-12 left-2 z-40 flex items-center gap-0.5 px-2 py-1 rounded-full shadow-2xl border transition-all animate-in fade-in zoom-in-95 duration-150 select-none ${
        darkMode
          ? 'bg-[#1f2c34] border-[#374248] text-[#e9edef]'
          : 'bg-[#202c33] border-[#374248] text-white shadow-black/25'
      }`}
      onMouseDown={(e) => {
        // Evita que o clique na barra retire o foco do textarea
        e.preventDefault();
      }}
    >
      {/* 1. Negrito (*texto*) */}
      <button
        type="button"
        id="format-btn-bold"
        onClick={() => handleFormat('bold')}
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer text-white"
        title="Negrito (*texto*) • Ctrl+B"
      >
        <span className="font-black text-[15px] leading-none">B</span>
      </button>

      {/* 2. Itálico (_texto_) */}
      <button
        type="button"
        id="format-btn-italic"
        onClick={() => handleFormat('italic')}
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer text-white"
        title="Itálico (_texto_) • Ctrl+I"
      >
        <span className="italic font-serif font-black text-[15px] leading-none">I</span>
      </button>

      {/* 3. Tachado (~texto~) */}
      <button
        type="button"
        id="format-btn-strike"
        onClick={() => handleFormat('strike')}
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer text-white"
        title="Tachado (~texto~)"
      >
        <Strikethrough className="w-4 h-4 stroke-[2.5]" />
      </button>

      {/* 4. Monoespaçado / Código (```texto```) */}
      <button
        type="button"
        id="format-btn-monospace"
        onClick={() => handleFormat('monospace')}
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer text-white"
        title="Monoespaçado (```texto```)"
      >
        <span className="font-mono font-bold text-[13px] tracking-tighter leading-none">&lt;&gt;</span>
      </button>

      {/* Divisória sutil */}
      <div className="w-[1px] h-4 bg-white/15 mx-0.5" />

      {/* 5. Lista numerada (1. item) */}
      <button
        type="button"
        id="format-btn-number"
        onClick={() => handleFormat('number')}
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer text-white"
        title="Lista numerada (1. item)"
      >
        <ListOrdered className="w-4 h-4" />
      </button>

      {/* 6. Lista com marcadores (- item) */}
      <button
        type="button"
        id="format-btn-bullet"
        onClick={() => handleFormat('bullet')}
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer text-white"
        title="Lista com marcadores (- item)"
      >
        <List className="w-4 h-4" />
      </button>

      {/* 7. Citação em bloco (> citação) */}
      <button
        type="button"
        id="format-btn-quote"
        onClick={() => handleFormat('quote')}
        className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 active:bg-white/25 transition-colors cursor-pointer text-white"
        title="Citação em bloco (> texto)"
      >
        <Quote className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
