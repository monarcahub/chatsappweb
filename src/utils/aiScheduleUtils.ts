import { AIScheduleMode, AIScheduleRule } from '../types';

export const DAY_LABELS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

export const DAY_LABELS_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

export const TIMEZONE_OPTIONS = [
  { value: 'America/Sao_Paulo', label: 'Brasília (America/Sao_Paulo)' },
  { value: 'America/Fortaleza', label: 'Nordeste (America/Fortaleza)' },
  { value: 'America/Cuiaba', label: 'Mato Grosso (America/Cuiaba)' },
  { value: 'America/Manaus', label: 'Amazonas (America/Manaus)' },
  { value: 'America/Rio_Branco', label: 'Acre (America/Rio_Branco)' },
  { value: 'Europe/Lisbon', label: 'Lisboa (Europe/Lisbon)' },
  { value: 'UTC', label: 'UTC' },
] as const;

export interface AISchedulePreset {
  id: string;
  label: string;
  description: string;
  name: string;
  mode: AIScheduleMode;
  days_of_week: number[];
  start_time: string;
  end_time: string;
}

export const AI_SCHEDULE_PRESETS: AISchedulePreset[] = [
  {
    id: 'after_hours',
    label: 'Fora do horário comercial',
    description: 'IA ativa das 18:00 às 08:00 (Seg–Sex)',
    name: 'Plantão IA (Fora do Horário Comercial)',
    mode: 'active_window',
    days_of_week: [1, 2, 3, 4, 5],
    start_time: '18:00',
    end_time: '08:00',
  },
  {
    id: 'business_hours_pause',
    label: 'Pausar no expediente humano',
    description: 'Pausa das 08:00 às 18:00 (Seg–Sex)',
    name: 'Pausa durante Expediente Humano',
    mode: 'paused_window',
    days_of_week: [1, 2, 3, 4, 5],
    start_time: '08:00',
    end_time: '18:00',
  },
  {
    id: 'lunch_break',
    label: 'Horário de almoço',
    description: 'IA ativa das 12:00 às 13:30 (Seg–Sex)',
    name: 'Atendimento IA no Almoço',
    mode: 'active_window',
    days_of_week: [1, 2, 3, 4, 5],
    start_time: '12:00',
    end_time: '13:30',
  },
  {
    id: 'weekend_24h',
    label: 'Finais de semana',
    description: 'IA ativa das 00:00 às 23:59 (Sáb e Dom)',
    name: 'Plantão de Fim de Semana',
    mode: 'active_window',
    days_of_week: [0, 6],
    start_time: '00:00',
    end_time: '23:59',
  },
];

export interface LocalTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dow: number;
  dateStr: string;
  timeStr: string;
  minutesSinceEpochApprox: number;
}

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export function getLocalTimeParts(date: Date, timezone = 'America/Sao_Paulo'): LocalTimeParts {
  const safeTz = timezone?.trim() || 'America/Sao_Paulo';
  let parts: Intl.DateTimeFormatPart[];
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: safeTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    });
    parts = fmt.formatToParts(date);
  } catch {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    });
    parts = fmt.formatToParts(date);
  }

  const getVal = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const year = Number(getVal('year'));
  const month = Number(getVal('month'));
  const day = Number(getVal('day'));
  const hour = Number(getVal('hour')) % 24;
  const minute = Number(getVal('minute'));
  const weekdayShort = getVal('weekday').toLowerCase().slice(0, 3);
  const dow = WEEKDAY_MAP[weekdayShort] ?? 0;

  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${year}-${pad(month)}-${pad(day)}`;
  const timeStr = `${pad(hour)}:${pad(minute)}`;
  const minutesSinceEpochApprox = Math.floor(Date.UTC(year, month - 1, day, hour, minute) / 60000);

  return {
    year,
    month,
    day,
    hour,
    minute,
    dow,
    dateStr,
    timeStr,
    minutesSinceEpochApprox,
  };
}

function addDaysToYmd(year: number, month: number, day: number, deltaDays: number) {
  const d = new Date(Date.UTC(year, month - 1, day + deltaDays));
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const dt = d.getUTCDate();
  const dow = d.getUTCDay();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    year: y,
    month: m,
    day: dt,
    dow,
    dateStr: `${y}-${pad(m)}-${pad(dt)}`,
  };
}

function parseHm(timeStr: string): { hour: number; minute: number; totalMinutes: number; normalized: string } | null {
  const match = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    hour,
    minute,
    totalMinutes: hour * 60 + minute,
    normalized: `${pad(hour)}:${pad(minute)}`,
  };
}

export interface ScheduleTransitionEvent {
  slotKey: string;
  targetState: boolean;
  dateStr: string;
  timeStr: string;
  dow: number;
  minutesSinceEpochApprox: number;
  dayOffsetFromToday: number;
}

export interface RuleEvaluation {
  latestEvent: ScheduleTransitionEvent | null;
  nextEvent: ScheduleTransitionEvent | null;
  expectedStateNow: boolean | null;
  isWithinCatchupWindow: boolean;
  nextTransitionLabel: string | null;
}

export function evaluateRuleSchedule(
  rule: Pick<AIScheduleRule, 'mode' | 'days_of_week' | 'start_time' | 'end_time' | 'timezone'>,
  now: Date = new Date()
): RuleEvaluation {
  const start = parseHm(rule.start_time);
  const end = parseHm(rule.end_time);
  const days = Array.isArray(rule.days_of_week) ? rule.days_of_week : [];

  if (!start || !end || days.length === 0 || start.totalMinutes === end.totalMinutes) {
    return {
      latestEvent: null,
      nextEvent: null,
      expectedStateNow: null,
      isWithinCatchupWindow: false,
      nextTransitionLabel: null,
    };
  }

  const localNow = getLocalTimeParts(now, rule.timezone || 'America/Sao_Paulo');
  const enterState = rule.mode === 'active_window';
  const exitState = !enterState;
  const isOvernight = end.totalMinutes < start.totalMinutes;

  const events: ScheduleTransitionEvent[] = [];

  for (let offset = -7; offset <= 8; offset++) {
    const baseDay = addDaysToYmd(localNow.year, localNow.month, localNow.day, offset);
    if (!days.includes(baseDay.dow)) continue;

    // Enter boundary
    const enterMinutes = Math.floor(
      Date.UTC(baseDay.year, baseDay.month - 1, baseDay.day, start.hour, start.minute) / 60000
    );
    events.push({
      slotKey: `${baseDay.dateStr}_${start.normalized}_enter`,
      targetState: enterState,
      dateStr: baseDay.dateStr,
      timeStr: start.normalized,
      dow: baseDay.dow,
      minutesSinceEpochApprox: enterMinutes,
      dayOffsetFromToday: offset,
    });

    // Exit boundary (same day or next day if overnight)
    const exitDay = isOvernight
      ? addDaysToYmd(localNow.year, localNow.month, localNow.day, offset + 1)
      : baseDay;
    const exitOffset = isOvernight ? offset + 1 : offset;
    const exitMinutes = Math.floor(
      Date.UTC(exitDay.year, exitDay.month - 1, exitDay.day, end.hour, end.minute) / 60000
    );
    events.push({
      slotKey: `${exitDay.dateStr}_${end.normalized}_exit`,
      targetState: exitState,
      dateStr: exitDay.dateStr,
      timeStr: end.normalized,
      dow: exitDay.dow,
      minutesSinceEpochApprox: exitMinutes,
      dayOffsetFromToday: exitOffset,
    });
  }

  events.sort((a, b) => a.minutesSinceEpochApprox - b.minutesSinceEpochApprox);

  let latestEvent: ScheduleTransitionEvent | null = null;
  let nextEvent: ScheduleTransitionEvent | null = null;

  for (const ev of events) {
    if (ev.minutesSinceEpochApprox <= localNow.minutesSinceEpochApprox) {
      latestEvent = ev;
    } else if (!nextEvent) {
      nextEvent = ev;
    }
  }

  const diffMinutes = latestEvent
    ? localNow.minutesSinceEpochApprox - latestEvent.minutesSinceEpochApprox
    : Infinity;
  const isWithinCatchupWindow = diffMinutes >= 0 && diffMinutes <= 360; // até 6h de tolerância idempotente

  let nextTransitionLabel: string | null = null;
  if (nextEvent) {
    const actionLabel = nextEvent.targetState ? 'Ativar IA' : 'Pausar IA';
    const dayPrefix =
      nextEvent.dayOffsetFromToday === 0
        ? 'hoje'
        : nextEvent.dayOffsetFromToday === 1
        ? 'amanhã'
        : DAY_LABELS_SHORT[nextEvent.dow];
    nextTransitionLabel = `${actionLabel} ${dayPrefix} às ${nextEvent.timeStr}`;
  }

  return {
    latestEvent,
    nextEvent,
    expectedStateNow: latestEvent ? latestEvent.targetState : null,
    isWithinCatchupWindow,
    nextTransitionLabel,
  };
}

export function formatDaysSummary(days: number[]): string {
  const uniqueSorted = Array.from(new Set(days || [])).filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (uniqueSorted.length === 0) return 'Nenhum dia';
  if (uniqueSorted.length === 7) return 'Todos os dias';
  if (uniqueSorted.join(',') === '1,2,3,4,5') return 'Seg a Sex';
  if (uniqueSorted.join(',') === '0,6') return 'Sáb e Dom';
  return uniqueSorted.map((d) => DAY_LABELS_SHORT[d]).join(', ');
}

export function formatScheduleSummary(
  rule: Pick<AIScheduleRule, 'mode' | 'days_of_week' | 'start_time' | 'end_time'>
): string {
  const action = rule.mode === 'active_window' ? 'Ativa' : 'Pausa';
  const daysLabel = formatDaysSummary(rule.days_of_week);
  return `${action} ${rule.start_time.slice(0, 5)}–${rule.end_time.slice(0, 5)} · ${daysLabel}`;
}

export function isOvernightWindow(startTime: string, endTime: string): boolean {
  const s = parseHm(startTime);
  const e = parseHm(endTime);
  if (!s || !e) return false;
  return e.totalMinutes < s.totalMinutes;
}
