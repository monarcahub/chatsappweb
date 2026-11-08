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
export function formatSaoPauloTime(dateInput?: string | Date | number | null): string {
  if (!dateInput) {
    return timeFormatter.format(new Date());
  }

  try {
    // Se já for uma string curta como "14:30", retorna ela mesma
    if (typeof dateInput === 'string' && /^\d{2}:\d{2}$/.test(dateInput.trim())) {
      return dateInput.trim();
    }
    const d = parseSafeDate(dateInput);
    return timeFormatter.format(d);
  } catch {
    return timeFormatter.format(new Date());
  }
}

/**
 * Realiza o parsing tolerante e seguro de datas em múltiplos formatos (ISO UTC, DD/MM/AAAA, "Hoje às 18:47", etc.)
 */
export function parseSafeDate(
  input?: string | Date | number | null,
  fallbackDate?: string | Date | null
): Date {
  if (!input && !fallbackDate) {
    return new Date();
  }

  // Se já for Date válido
  if (input instanceof Date && !isNaN(input.getTime())) {
    return input;
  }

  // Se for timestamp numérico (ms ou seg)
  if (typeof input === 'number') {
    if (!isNaN(input) && input > 0) {
      if (input < 10000000000) {
        return new Date(input * 1000);
      }
      return new Date(input);
    }
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();

    // 1. Caso ISO / UTC padrão: "2026-11-07T16:42:00.000Z" ou "2026-11-07 16:42:00"
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    // 2. Formato brasileiro: "05/11/2026", "05/11/2026 às 16:42", "05/11/2026 16:42"
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:(?:\s+às\s+|\s+)(\d{1,2}):(\d{2}))?/);
    if (brMatch) {
      const day = parseInt(brMatch[1], 10);
      const month = parseInt(brMatch[2], 10) - 1;
      const year = parseInt(brMatch[3], 10);
      const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 12;
      const min = brMatch[5] ? parseInt(brMatch[5], 10) : 0;
      const d = new Date(year, month, day, hour, min, 0);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }

    // 3. Formato relativo textual: "Hoje às 18:47" ou "Ontem às 21:30"
    if (/^Hoje/i.test(trimmed)) {
      const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})/);
      const d = new Date();
      if (timeMatch) {
        d.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
      }
      return d;
    }

    if (/^Ontem/i.test(trimmed)) {
      const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})/);
      const d = new Date();
      d.setDate(d.getDate() - 1);
      if (timeMatch) {
        d.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
      }
      return d;
    }

    // 4. Se for apenas horário: "16:42"
    const onlyTimeMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (onlyTimeMatch) {
      const baseDate = fallbackDate ? parseSafeDate(fallbackDate) : new Date();
      const d = new Date(baseDate);
      d.setHours(parseInt(onlyTimeMatch[1], 10), parseInt(onlyTimeMatch[2], 10), 0, 0);
      return d;
    }

    // Tentativa genérica de parsing
    const genericDate = new Date(trimmed);
    if (!isNaN(genericDate.getTime())) {
      return genericDate;
    }
  }

  // Fallback
  if (fallbackDate) {
    const fb = parseSafeDate(fallbackDate);
    if (!isNaN(fb.getTime())) return fb;
  }

  return new Date();
}

/**
 * Obtém os componentes de data de calendário em um fuso horário específico
 */
export function getCalendarDateParts(date: Date, timeZone: string = SAO_PAULO_TZ) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  let year = 2026;
  let month = 1;
  let day = 1;
  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    if (part.type === 'month') month = parseInt(part.value, 10);
    if (part.type === 'day') day = parseInt(part.value, 10);
  }
  const formattedDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  const dayKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, formattedDate, dayKey };
}

/**
 * Determina o rótulo do separador cronológico de chat estilo WhatsApp:
 * - "Hoje": pertence ao dia atual no fuso
 * - "Ontem": pertence ao dia anterior
 * - "DD/MM/AAAA": qualquer outra data (inclusive anteontem e anos anteriores)
 */
export function getChatDateSeparatorLabel(
  dateInput?: string | Date | number | null,
  now: Date = new Date(),
  fallbackDate?: string | Date | null,
  timeZone: string = SAO_PAULO_TZ
): { label: string; dayKey: string; formattedDate: string; date: Date } {
  const d = parseSafeDate(dateInput, fallbackDate);
  const targetParts = getCalendarDateParts(d, timeZone);
  const nowParts = getCalendarDateParts(now, timeZone);

  // Calcula ontem estritamente por dias de calendário (independente de horário/DST)
  const yesterdayUtc = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day - 1, 12, 0, 0));
  const yesterdayParts = {
    year: yesterdayUtc.getUTCFullYear(),
    month: yesterdayUtc.getUTCMonth() + 1,
    day: yesterdayUtc.getUTCDate(),
  };
  const yesterdayKey = `${yesterdayParts.year}-${String(yesterdayParts.month).padStart(2, '0')}-${String(yesterdayParts.day).padStart(2, '0')}`;

  if (targetParts.dayKey === nowParts.dayKey) {
    return { label: 'Hoje', dayKey: targetParts.dayKey, formattedDate: targetParts.formattedDate, date: d };
  }

  if (targetParts.dayKey === yesterdayKey) {
    return { label: 'Ontem', dayKey: targetParts.dayKey, formattedDate: targetParts.formattedDate, date: d };
  }

  // Qualquer outra data: exibe a data numérica "DD/MM/AAAA", nunca "Anteontem"
  return { label: targetParts.formattedDate, dayKey: targetParts.dayKey, formattedDate: targetParts.formattedDate, date: d };
}

/**
 * Formata os dados de dia e horário para a visualização "Dados da mensagem".
 * Garante que o dia numérico e relativo (ex: "07/11/2026 (Hoje)" ou "05/11/2026")
 * apareçam com destaque ao lado do horário.
 */
export function formatMessageDetailsDateAndHour(
  createdAt?: string | Date | null,
  timestamp?: string | null,
  timeZone: string = SAO_PAULO_TZ
): { dateStr: string; timeStr: string; fullDisplay: string; dayFormatted: string } {
  const d = parseSafeDate(createdAt || timestamp, timestamp);
  const parts = getCalendarDateParts(d, timeZone);
  const timeStr = formatSaoPauloTime(createdAt || timestamp);

  const { label } = getChatDateSeparatorLabel(d, new Date(), null, timeZone);
  const relativeBadge = label === 'Hoje' ? 'Hoje' : label === 'Ontem' ? 'Ontem' : null;
  const dateStr = relativeBadge ? `${parts.formattedDate} (${relativeBadge})` : parts.formattedDate;

  return {
    dateStr,
    timeStr,
    dayFormatted: parts.formattedDate,
    fullDisplay: `${dateStr} às ${timeStr}`,
  };
}

/**
 * Formata um timestamp UTC para a data no horário de Brasília (ex: "08/09/2026", "Hoje", "Ontem")
 */
export function formatSaoPauloDate(dateInput?: string | Date | number | null): string {
  if (!dateInput) return 'Hoje';

  try {
    const { label } = getChatDateSeparatorLabel(dateInput);
    return label;
  } catch {
    return 'Hoje';
  }
}

/**
 * Formata para "DD/MM/YYYY às HH:mm" no fuso de Brasília
 */
export function formatSaoPauloFull(dateInput?: string | Date | number | null): string {
  if (!dateInput) return dateTimeFormatter.format(new Date());

  try {
    const d = parseSafeDate(dateInput);
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
