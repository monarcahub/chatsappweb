/**
 * Utilitários para formatação rigorosa de horários no fuso horário brasileiro (Brasília / America/Sao_Paulo)
 * Garante que mensagens gravadas em UTC no banco de dados sejam exibidas com a hora exata do Brasil,
 * independente do servidor onde a aplicação ou Vercel estiver rodando.
 */

const SAO_PAULO_TZ = 'America/Sao_Paulo';

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO_TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO_TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Formata um timestamp UTC ou data ISO para "HH:mm" no horário de Brasília (UTC-3).
 * Ex: "14:35"
 */
export function formatSaoPauloTime(dateInput?: string | Date | null): string {
  if (!dateInput) {
    return timeFormatter.format(new Date());
  }

  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) {
      // Se já for uma string curta como "14:30", retorna ela mesma
      if (typeof dateInput === 'string' && /^\d{2}:\d{2}$/.test(dateInput.trim())) {
        return dateInput.trim();
      }
      return timeFormatter.format(new Date());
    }
    return timeFormatter.format(d);
  } catch {
    return timeFormatter.format(new Date());
  }
}

/**
 * Formata um timestamp UTC para a data no horário de Brasília (ex: "08/09/2026", "Hoje", "Ontem")
 */
export function formatSaoPauloDate(dateInput?: string | Date | null): string {
  if (!dateInput) return 'Hoje';

  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : 'Hoje';

    const now = new Date();
    const todayStr = dateFormatter.format(now);
    const targetStr = dateFormatter.format(d);

    if (todayStr === targetStr) {
      return 'Hoje';
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = dateFormatter.format(yesterday);

    if (targetStr === yesterdayStr) {
      return 'Ontem';
    }

    return targetStr;
  } catch {
    return 'Hoje';
  }
}

/**
 * Formata para "DD/MM/YYYY às HH:mm" no fuso de Brasília
 */
export function formatSaoPauloFull(dateInput?: string | Date | null): string {
  if (!dateInput) return dateTimeFormatter.format(new Date());

  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return dateTimeFormatter.format(new Date());
    return dateTimeFormatter.format(d);
  } catch {
    return dateTimeFormatter.format(new Date());
  }
}

/**
 * Normaliza e formata qualquer entrada de duração de áudio para MM:SS
 * Aceita:
 * - Formato "0:15", "1:23"
 * - Strings com texto: "audio 0:35", "audio: 1:10"
 * - Segundos numéricos ou strings de segundos: 45, 90, "45", "75.4"
 * - Fallback automático para "0:15"
 */
export function formatAudioDuration(input?: string | number | null): string {
  if (input === undefined || input === null || input === '') {
    return '0:15';
  }

  // Se for número direto (segundos)
  if (typeof input === 'number') {
    if (isNaN(input) || input <= 0) return '0:15';
    const mins = Math.floor(input / 60);
    const secs = Math.floor(input % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  const str = String(input).trim();

  // Verifica se já contém padrão MM:SS (ex: "0:25", "audio 0:45", "1:15")
  const match = str.match(/(\d{1,2}:\d{2})/);
  if (match) {
    return match[1];
  }

  // Verifica se é uma string numérica pura de segundos (ex: "45", "90", "15.8")
  const parsedSeconds = parseFloat(str);
  if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
    const mins = Math.floor(parsedSeconds / 60);
    const secs = Math.floor(parsedSeconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  return '0:15';
}
