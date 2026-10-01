import React, { useState } from 'react';
import { Eye, Edit3, Maximize2, Sparkles, Code2 } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MarkdownTextBoxProps {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  darkMode: boolean;
  onExpand?: (title: string, value: string, onSave: (newVal: string) => void) => void;
  helperText?: string;
}

export const MarkdownTextBox: React.FC<MarkdownTextBoxProps> = ({
  label,
  icon,
  value,
  onChange,
  placeholder,
  rows = 4,
  darkMode,
  onExpand,
  helperText,
}) => {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  const handleExpandClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onExpand) {
      onExpand(label, value, (newVal) => onChange(newVal));
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* Header com Label e Ícones de Ação de Markdown */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5 truncate">
          {icon}
          <span className="truncate">{label}</span>
        </label>

        {/* Barra de Ações com Ícones: Prévia e Ampliar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Alternador Rápido: Editar / Prévia Markdown */}
          <div
            className={`flex items-center rounded-lg p-0.5 text-[11px] font-semibold border transition-all ${
              darkMode ? 'bg-[#111b21] border-[#222e35]' : 'bg-gray-100 border-gray-300'
            }`}
          >
            <button
              type="button"
              onClick={() => setMode('edit')}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
                mode === 'edit'
                  ? 'bg-[#00a884] text-white font-bold shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Modo de edição do texto"
            >
              <Edit3 className="w-3 h-3" />
              <span>Editar</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 text-[11px] ${
                mode === 'preview'
                  ? 'bg-[#00a884] text-white font-bold shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Clique para visualizar com formatação Markdown neste box"
            >
              <Eye className="w-3 h-3" />
              <span>Ver Markdown</span>
            </button>
          </div>

          {/* Botão Ícone de Expandir para Tela Cheia / Visualizador Dedicado */}
          {onExpand && (
            <button
              type="button"
              onClick={handleExpandClick}
              className={`p-1.5 rounded-lg transition-all cursor-pointer border flex items-center gap-1 text-[11px] font-semibold ${
                darkMode
                  ? 'bg-[#111b21] border-[#222e35] text-[#00a884] hover:bg-[#202c33] hover:border-[#00a884]/40'
                  : 'bg-white border-gray-300 text-[#00a884] hover:bg-emerald-50 hover:border-[#00a884]/40'
              }`}
              title="Abrir no Visualizador Markdown em tela ampla"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[10px]">Ampliar</span>
            </button>
          )}
        </div>
      </div>

      {/* Box de Conteúdo: Editor ou Prévia Formatada */}
      <div className="relative group">
        {mode === 'edit' ? (
          <div className="relative">
            <textarea
              rows={rows}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={`w-full px-3 py-2.5 rounded-xl text-xs border outline-none resize-none transition-colors leading-relaxed ${
                darkMode
                  ? 'bg-[#111b21] border-[#222e35] text-[#e9edef] focus:border-[#00a884]'
                  : 'bg-gray-50 border-gray-200 text-[#111b21] focus:border-[#00a884]'
              }`}
            />

            {/* Ícone rápido flutuante no canto inferior direito do editor */}
            <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity pointer-events-auto">
              <button
                type="button"
                onClick={() => setMode('preview')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border flex items-center gap-1 shadow-xs cursor-pointer ${
                  darkMode
                    ? 'bg-[#202c33]/90 border-gray-700 text-gray-300 hover:text-white hover:border-[#00a884]'
                    : 'bg-white/95 border-gray-300 text-gray-600 hover:text-black hover:border-[#00a884]'
                }`}
                title="Visualizar texto com formatação Markdown"
              >
                <Eye className="w-2.5 h-2.5 text-[#00a884]" />
                <span>Prévia MD</span>
              </button>

              {onExpand && (
                <button
                  type="button"
                  onClick={handleExpandClick}
                  className={`p-1 rounded-md border shadow-xs cursor-pointer ${
                    darkMode
                      ? 'bg-[#202c33]/90 border-gray-700 text-gray-300 hover:text-[#00a884] hover:border-[#00a884]'
                      : 'bg-white/95 border-gray-300 text-gray-600 hover:text-[#00a884] hover:border-[#00a884]'
                  }`}
                  title="Expandir para o Visualizador Markdown Completo"
                >
                  <Maximize2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            style={{ minHeight: `${Math.max(rows * 28, 90)}px`, maxHeight: `${Math.max(rows * 42, 220)}px` }}
            className={`w-full px-3.5 py-3 rounded-xl text-xs border overflow-y-auto custom-scrollbar transition-all ${
              darkMode
                ? 'bg-[#111b21]/95 border-[#00a884]/40 text-[#e9edef] shadow-inner'
                : 'bg-emerald-50/50 border-[#00a884]/40 text-[#111b21] shadow-inner'
            }`}
          >
            {/* Header interno do box no modo de prévia formatada */}
            <div className="flex items-center justify-between text-[11px] text-[#00a884] font-bold mb-2 pb-1.5 border-b border-[#00a884]/20">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Visualização Formatada (Markdown)</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className="flex items-center gap-1 text-gray-400 hover:text-[#00a884] hover:underline cursor-pointer font-medium text-[10px]"
                >
                  <Edit3 className="w-2.5 h-2.5" />
                  <span>Voltar a editar</span>
                </button>

                {onExpand && (
                  <button
                    type="button"
                    onClick={handleExpandClick}
                    className="flex items-center gap-1 text-emerald-400 hover:underline cursor-pointer font-bold text-[10px]"
                    title="Abrir em tela cheia com visualizador completo"
                  >
                    <Maximize2 className="w-2.5 h-2.5" />
                    <span>Expandir</span>
                  </button>
                )}
              </div>
            </div>

            <div className="p-1">
              <MarkdownRenderer
                content={value}
                emptyText="Este campo está vazio. Clique em Editar para escrever texto em Markdown."
              />
            </div>
          </div>
        )}
      </div>

      {helperText && (
        <span className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
          <Code2 className="w-2.5 h-2.5 text-[#00a884]" />
          <span>{helperText}</span>
        </span>
      )}
    </div>
  );
};
