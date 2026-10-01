import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  Edit3,
  Columns,
  Copy,
  Check,
  Save,
  BookOpen,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MarkdownViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  initialContent: string;
  onSave?: (newContent: string) => void;
  darkMode: boolean;
  readOnly?: boolean;
}

export const MarkdownViewerModal: React.FC<MarkdownViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  initialContent,
  onSave,
  darkMode,
  readOnly = false,
}) => {
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<'preview' | 'split' | 'edit'>('preview');
  const [copied, setCopied] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      setViewMode('preview');
    }
  }, [isOpen, initialContent]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAndClose = () => {
    if (onSave) {
      onSave(content);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in select-none">
      <div
        className={`w-full ${
          isFullScreen ? 'max-w-[98vw] h-[96vh]' : 'max-w-4xl max-h-[90vh]'
        } rounded-2xl flex flex-col shadow-2xl border overflow-hidden transition-all ${
          darkMode
            ? 'bg-[#182229] border-[#2a3942] text-[#e9edef]'
            : 'bg-white border-gray-200 text-[#111b21]'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-3.5 flex items-center justify-between border-b shrink-0 ${
            darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#00a884]/20 border border-[#00a884]/30 flex items-center justify-center text-[#00a884] shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm truncate" title={title}>
                  {title}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/30 flex items-center gap-1 shrink-0">
                  <Sparkles className="w-3 h-3" />
                  Markdown Formatado
                </span>
              </div>
              {subtitle && (
                <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Mode Switcher */}
            {!readOnly && (
              <div
                className={`hidden sm:flex items-center rounded-lg p-0.5 border text-xs ${
                  darkMode ? 'bg-[#111b21] border-[#222e35]' : 'bg-gray-200/80 border-gray-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'preview'
                      ? 'bg-[#00a884] text-white font-bold shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Apenas visualização com formatação markdown"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Prévia</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'split'
                      ? 'bg-[#00a884] text-white font-bold shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Editor e prévia lado a lado"
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Lado a Lado</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('edit')}
                  className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    viewMode === 'edit'
                      ? 'bg-[#00a884] text-white font-bold shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Apenas editor de texto"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Editor</span>
                </button>
              </div>
            )}

            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              className={`p-2 rounded-lg transition-colors cursor-pointer border text-xs flex items-center gap-1.5 ${
                copied
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : darkMode
                  ? 'border-[#2f3b43] hover:bg-[#374248] text-gray-300'
                  : 'border-gray-300 hover:bg-gray-100 text-gray-700'
              }`}
              title="Copiar texto original"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span className="hidden md:inline">{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>

            {/* Toggle Fullscreen */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                darkMode ? 'hover:bg-[#374248] text-gray-400' : 'hover:bg-gray-200 text-gray-500'
              }`}
              title={isFullScreen ? 'Reduzir janela' : 'Tela cheia'}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                darkMode ? 'hover:bg-[#374248] text-gray-400' : 'hover:bg-gray-200 text-gray-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Split Mode: Left Editor / Right Preview */}
          {viewMode === 'split' && (
            <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-700/30 overflow-hidden">
              {/* Left Pane: Editor */}
              <div className="flex-1 flex flex-col min-h-0 p-4">
                <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-[#00a884]" />
                    <span>Editor Markdown</span>
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Suporta # Títulos, **negrito**, listas -, tabelas, etc.
                  </span>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Digite seu texto em Markdown..."
                  className={`flex-1 w-full p-3 rounded-xl text-xs font-mono border outline-none resize-none custom-scrollbar ${
                    darkMode
                      ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]'
                      : 'bg-gray-50 border-gray-200 text-[#111b21]'
                  }`}
                />
              </div>

              {/* Right Pane: Live Rendered Preview */}
              <div className="flex-1 flex flex-col min-h-0 p-4 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-[#00a884]" />
                    <span>Prévia em Tempo Real</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">Renderização Ativa</span>
                </div>
                <div
                  className={`flex-1 p-4 rounded-xl border overflow-y-auto custom-scrollbar ${
                    darkMode
                      ? 'bg-black/30 border-[#222e35]'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <MarkdownRenderer content={content} />
                </div>
              </div>
            </div>
          )}

          {/* Full Preview Mode */}
          {viewMode === 'preview' && (
            <div className="flex-1 flex flex-col min-h-0 p-5 overflow-y-auto custom-scrollbar">
              <div
                className={`p-6 rounded-2xl border min-h-full ${
                  darkMode
                    ? 'bg-[#111b21]/70 border-[#222e35]'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <MarkdownRenderer content={content} />
              </div>
            </div>
          )}

          {/* Full Edit Mode */}
          {viewMode === 'edit' && (
            <div className="flex-1 flex flex-col min-h-0 p-5">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Digite seu texto em Markdown..."
                className={`flex-1 w-full p-4 rounded-xl text-xs font-mono border outline-none resize-none custom-scrollbar leading-relaxed ${
                  darkMode
                    ? 'bg-[#111b21] border-[#222e35] text-[#e9edef]'
                    : 'bg-gray-50 border-gray-200 text-[#111b21]'
                }`}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`px-5 py-3 border-t flex items-center justify-between shrink-0 text-xs ${
            darkMode ? 'bg-[#202c33] border-[#222e35]' : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3 text-gray-400 text-[11px]">
            <span>{content.length} caracteres</span>
            <span>•</span>
            <span>{content.split('\n').length} linhas</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                darkMode
                  ? 'border-[#2f3b43] text-gray-300 hover:bg-[#374248]'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              Fechar
            </button>

            {!readOnly && onSave && (
              <button
                type="button"
                onClick={handleSaveAndClose}
                className="px-4 py-1.5 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Alterações</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
