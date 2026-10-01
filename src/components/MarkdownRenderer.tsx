import React, { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  emptyText?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  emptyText = 'Nenhum texto inserido para visualização.',
}) => {
  const parsedHtml = useMemo(() => {
    if (!content || !content.trim()) return '';
    try {
      return marked.parse(content, {
        breaks: true,
        gfm: true,
      }) as string;
    } catch (err) {
      console.warn('Erro ao formatar markdown:', err);
      return content;
    }
  }, [content]);

  if (!content || !content.trim()) {
    return (
      <div className="py-4 text-center text-xs text-gray-400 italic">
        {emptyText}
      </div>
    );
  }

  return (
    <div
      className={`markdown-body text-xs leading-relaxed select-text ${className}`}
      dangerouslySetInnerHTML={{ __html: parsedHtml }}
    />
  );
};
