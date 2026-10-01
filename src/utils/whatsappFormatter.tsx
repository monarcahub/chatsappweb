import React from 'react';

export type WhatsAppFormatType =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'monospace'
  | 'number'
  | 'bullet'
  | 'quote';

/**
 * Aplica regras de formatação do WhatsApp sobre uma seleção de texto ou na posição do cursor
 */
export function applyWhatsAppFormatting(
  fullText: string,
  start: number,
  end: number,
  format: WhatsAppFormatType
): { text: string; newStart: number; newEnd: number } {
  const isRange = start !== end;
  const before = fullText.slice(0, start);
  const selected = fullText.slice(start, end);
  const after = fullText.slice(end);

  // Se não houver seleção (cursor simples)
  if (!isRange) {
    let wrap = '';
    let cursorOffset = 1;

    switch (format) {
      case 'bold':
        wrap = '**';
        cursorOffset = 1;
        break;
      case 'italic':
        wrap = '__';
        cursorOffset = 1;
        break;
      case 'strike':
        wrap = '~~';
        cursorOffset = 1;
        break;
      case 'monospace':
        wrap = '``````';
        cursorOffset = 3;
        break;
      case 'quote':
        wrap = '\n> ';
        cursorOffset = 3;
        break;
      case 'bullet':
        wrap = '\n- ';
        cursorOffset = 3;
        break;
      case 'number':
        wrap = '\n1. ';
        cursorOffset = 4;
        break;
    }

    const newText = before + wrap + after;
    return {
      text: newText,
      newStart: start + cursorOffset,
      newEnd: start + cursorOffset,
    };
  }

  // Se houver seleção de texto
  let replacement = '';
  let newStart = start;
  let newEnd = end;

  switch (format) {
    case 'bold': {
      // Toggle off se já estiver envolvido em *
      if (selected.startsWith('*') && selected.endsWith('*') && selected.length >= 2) {
        replacement = selected.slice(1, -1);
      } else if (before.endsWith('*') && after.startsWith('*')) {
        return {
          text: before.slice(0, -1) + selected + after.slice(1),
          newStart: start - 1,
          newEnd: end - 1,
        };
      } else {
        replacement = `*${selected}*`;
      }
      break;
    }

    case 'italic': {
      if (selected.startsWith('_') && selected.endsWith('_') && selected.length >= 2) {
        replacement = selected.slice(1, -1);
      } else if (before.endsWith('_') && after.startsWith('_')) {
        return {
          text: before.slice(0, -1) + selected + after.slice(1),
          newStart: start - 1,
          newEnd: end - 1,
        };
      } else {
        replacement = `_${selected}_`;
      }
      break;
    }

    case 'strike': {
      if (selected.startsWith('~') && selected.endsWith('~') && selected.length >= 2) {
        replacement = selected.slice(1, -1);
      } else if (before.endsWith('~') && after.startsWith('~')) {
        return {
          text: before.slice(0, -1) + selected + after.slice(1),
          newStart: start - 1,
          newEnd: end - 1,
        };
      } else {
        replacement = `~${selected}~`;
      }
      break;
    }

    case 'monospace': {
      if (selected.startsWith('```') && selected.endsWith('```') && selected.length >= 6) {
        replacement = selected.slice(3, -3);
      } else if (selected.startsWith('`') && selected.endsWith('`') && selected.length >= 2) {
        replacement = selected.slice(1, -1);
      } else {
        replacement = `\`\`\`${selected}\`\`\``;
      }
      break;
    }

    case 'quote': {
      const lines = selected.split('\n');
      const allQuoted = lines.every((l) => !l.trim() || l.startsWith('>'));
      if (allQuoted) {
        replacement = lines.map((l) => l.replace(/^>\s?/, '')).join('\n');
      } else {
        replacement = lines.map((l) => (l.trim() ? `> ${l.replace(/^>\s?/, '')}` : l)).join('\n');
      }
      break;
    }

    case 'bullet': {
      const lines = selected.split('\n');
      const allBulleted = lines.every((l) => !l.trim() || /^[-*]\s/.test(l));
      if (allBulleted) {
        replacement = lines.map((l) => l.replace(/^[-*]\s*/, '')).join('\n');
      } else {
        replacement = lines
          .map((l) => (l.trim() ? `- ${l.replace(/^[-*]\s*/, '')}` : l))
          .join('\n');
      }
      break;
    }

    case 'number': {
      const lines = selected.split('\n');
      const allNumbered = lines.every((l) => !l.trim() || /^\d+\.\s/.test(l));
      if (allNumbered) {
        replacement = lines.map((l) => l.replace(/^\d+\.\s*/, '')).join('\n');
      } else {
        let count = 1;
        replacement = lines
          .map((l) => (l.trim() ? `${count++}. ${l.replace(/^\d+\.\s*/, '')}` : l))
          .join('\n');
      }
      break;
    }
  }

  const newText = before + replacement + after;
  newStart = start;
  newEnd = start + replacement.length;

  return { text: newText, newStart, newEnd };
}

/**
 * Renderizador de formatação inline do WhatsApp (*bold*, _italic_, ~strike~, `code`, links)
 */
function renderInlineFormatting(text: string, keyPrefix = 'inline'): React.ReactNode[] {
  if (!text) return [];

  // Padrão que captura:
  // 1. URLs
  // 2. Inline Code: `code`
  // 3. Bold: *bold*
  // 4. Italic: _italic_
  // 5. Strikethrough: ~strike~
  const pattern = /(https?:\/\/[^\s]+|www\.[^\s]+)|`([^`\n]+)`|(?<=^|[\s\W_])\*([^\s*](?:.*?[^\s*])?)\*(?=[\s\W_]|$)|(?<=^|[\s\W*])_([^\s_](?:.*?[^\s_])?)_(?=[\s\W*]|$)|(?<=^|[\s\W])~([^\s~](?:.*?[^\s~])?)~(?=[\s\W]|$)/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const [fullMatch, url, code, bold, italic, strike] = match;

    if (url) {
      const href = url.startsWith('http') ? url : `https://${url}`;
      nodes.push(
        <a
          key={`${keyPrefix}-url-${match.index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#53bdeb] hover:underline underline-offset-2 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );
    } else if (code !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${match.index}`}
          className="font-mono bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-[12px] border border-black/5 dark:border-white/5"
        >
          {code}
        </code>
      );
    } else if (bold !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-bold-${match.index}`} className="font-bold">
          {renderInlineFormatting(bold, `${keyPrefix}-b-${match.index}`)}
        </strong>
      );
    } else if (italic !== undefined) {
      nodes.push(
        <em key={`${keyPrefix}-italic-${match.index}`} className="italic">
          {renderInlineFormatting(italic, `${keyPrefix}-i-${match.index}`)}
        </em>
      );
    } else if (strike !== undefined) {
      nodes.push(
        <del key={`${keyPrefix}-strike-${match.index}`} className="line-through opacity-80">
          {renderInlineFormatting(strike, `${keyPrefix}-s-${match.index}`)}
        </del>
      );
    } else {
      nodes.push(fullMatch);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Componente React que renderiza texto formatado com suporte completo ao Markdown do WhatsApp:
 * - Blocos de código (```code```)
 * - Citações em bloco (> citação)
 * - Listas numeradas (1. item)
 * - Listas com marcadores (- item ou * item)
 * - Negrito (*texto*)
 * - Itálico (_texto_)
 * - Tachado (~texto~)
 * - Monoespaçado (`texto`)
 * - Links com preview/clique
 */
export const WhatsAppFormattedText: React.FC<{
  text: string;
  className?: string;
}> = ({ text, className = '' }) => {
  if (!text) return null;

  // 1. Processar blocos de código com ```
  const codeBlockParts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`whitespace-pre-wrap leading-relaxed break-words ${className}`}>
      {codeBlockParts.map((part, partIdx) => {
        if (part.startsWith('```') && part.endsWith('```') && part.length >= 6) {
          const codeContent = part.slice(3, -3).replace(/^\n/, '').replace(/\n$/, '');
          return (
            <pre
              key={`cb-${partIdx}`}
              className="font-mono bg-black/10 dark:bg-black/30 p-2.5 my-1.5 rounded-lg text-[12.5px] overflow-x-auto border border-black/5 dark:border-white/5 leading-relaxed"
            >
              <code>{codeContent}</code>
            </pre>
          );
        }

        // 2. Linhas do bloco: verificar citações (> ), listas (- , 1. )
        const lines = part.split('\n');
        const elements: React.ReactNode[] = [];
        let i = 0;

        while (i < lines.length) {
          const line = lines[i];

          // Citação em bloco (> )
          if (/^>\s?/.test(line)) {
            const quoteLines: string[] = [];
            while (i < lines.length && /^>\s?/.test(lines[i])) {
              quoteLines.push(lines[i].replace(/^>\s?/, ''));
              i++;
            }
            elements.push(
              <div
                key={`quote-${partIdx}-${i}`}
                className="border-l-[3px] border-[#00a884] pl-2.5 my-1.5 py-0.5 bg-black/5 dark:bg-white/5 rounded-r text-[13px] italic opacity-95 leading-relaxed"
              >
                {quoteLines.map((ql, qIdx) => (
                  <div key={`ql-${qIdx}`}>
                    {renderInlineFormatting(ql, `ql-${partIdx}-${i}-${qIdx}`)}
                  </div>
                ))}
              </div>
            );
            continue;
          }

          // Lista com marcadores (- item ou * item)
          if (/^[-*]\s+/.test(line)) {
            const listItems: string[] = [];
            while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
              listItems.push(lines[i].replace(/^[-*]\s+/, ''));
              i++;
            }
            elements.push(
              <ul key={`ul-${partIdx}-${i}`} className="list-disc pl-5 my-1 space-y-0.5">
                {listItems.map((itemText, lIdx) => (
                  <li key={`li-${lIdx}`} className="leading-relaxed">
                    {renderInlineFormatting(itemText, `li-${partIdx}-${i}-${lIdx}`)}
                  </li>
                ))}
              </ul>
            );
            continue;
          }

          // Lista numerada (1. item)
          if (/^\d+\.\s+/.test(line)) {
            const numItems: string[] = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
              numItems.push(lines[i].replace(/^\d+\.\s+/, ''));
              i++;
            }
            elements.push(
              <ol key={`ol-${partIdx}-${i}`} className="list-decimal pl-5 my-1 space-y-0.5">
                {numItems.map((itemText, nIdx) => (
                  <li key={`ol-li-${nIdx}`} className="leading-relaxed">
                    {renderInlineFormatting(itemText, `ol-${partIdx}-${i}-${nIdx}`)}
                  </li>
                ))}
              </ol>
            );
            continue;
          }

          // Linha comum com formatação inline
          elements.push(
            <React.Fragment key={`line-${partIdx}-${i}`}>
              {renderInlineFormatting(line, `l-${partIdx}-${i}`)}
              {i < lines.length - 1 && '\n'}
            </React.Fragment>
          );
          i++;
        }

        return <React.Fragment key={`part-${partIdx}`}>{elements}</React.Fragment>;
      })}
    </div>
  );
};
