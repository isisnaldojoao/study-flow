import {
  addDays,
  differenceInCalendarDays,
  format,
  isBefore,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export const TIMEZONE = "America/Sao_Paulo";

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC midnight shift). */
export function parseDateOnly(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/** Current calendar date in America/Sao_Paulo as YYYY-MM-DD */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function formatDisplayDate(date: string, pattern = "dd MMM yyyy") {
  return format(parseDateOnly(date), pattern, { locale: ptBR });
}

export function formatLongDate(date = todayISO()) {
  return format(parseDateOnly(date), "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: ptBR,
  });
}

export function daysUntil(date: string, from = todayISO()) {
  return differenceInCalendarDays(parseDateOnly(date), parseDateOnly(from));
}

export type UrgencyBucket =
  | "hoje"
  | "amanha"
  | "proximos_3"
  | "proximos_7"
  | "mais_7"
  | "atrasado";

export function urgencyBucket(date: string, from = todayISO()): UrgencyBucket {
  const days = daysUntil(date, from);
  if (days < 0) return "atrasado";
  if (days === 0) return "hoje";
  if (days === 1) return "amanha";
  if (days <= 3) return "proximos_3";
  if (days <= 7) return "proximos_7";
  return "mais_7";
}

export const urgencyLabels: Record<UrgencyBucket, string> = {
  atrasado: "Atrasado",
  hoje: "Hoje",
  amanha: "Amanhã",
  proximos_3: "Em 3d",
  proximos_7: "Em 7d",
  mais_7: "+7d",
};

export function isPastDate(date: string, from = todayISO()) {
  return isBefore(startOfDay(parseDateOnly(date)), startOfDay(parseDateOnly(from)));
}

export function addDaysISO(date: string, amount: number) {
  return format(addDays(parseDateOnly(date), amount), "yyyy-MM-dd");
}

/** Semana começa na segunda. */
export function startOfWeekISO(date: string) {
  const day = parseDateOnly(date).getDay();
  const diff = day === 0 ? 6 : day - 1;
  return addDaysISO(date, -diff);
}

export function weekdayIndex(date: string) {
  return parseDateOnly(date).getDay();
}

export function minutesToTime(totalMinutes: number) {
  const clamped = ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function addMinutesToTime(time: string, amount: number) {
  return minutesToTime((parseTimeToMinutes(time) ?? 0) + amount);
}

export function sessionDurationMinutes(startTime: string, endTime: string) {
  return Math.round(sessionDurationHours(startTime, endTime) * 60);
}

/** Mantém a duração no mesmo dia, para o relatório contar os minutos estudados. */
export function fitSameDayRange(startTime: string, minutes: number) {
  const duration = Math.max(1, Math.min(Math.round(minutes), 8 * 60));
  let end = (parseTimeToMinutes(startTime) ?? 0) + duration;
  if (end >= 24 * 60) end = 24 * 60 - 1;
  const start = Math.max(0, end - duration);
  return { startTime: minutesToTime(start), endTime: minutesToTime(end) };
}

export function formatMinutes(total: number) {
  const minutes = Math.max(0, Math.round(total));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} min`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h${String(rest).padStart(2, "0")}`;
}

export function nowMinutesInTimezone(timeZone = TIMEZONE) {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  const [hour, minute] = formatted.split(":").map(Number);
  return (hour % 24) * 60 + (minute || 0);
}

export function roundedNowMinutes(step = 5) {
  const now = nowMinutesInTimezone();
  return Math.min(23 * 60 + 55, Math.ceil(now / step) * step);
}

export function parseTimeToMinutes(time?: string) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function sessionDurationHours(startTime: string, endTime: string) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null || end <= start) return 0;
  return (end - start) / 60;
}
