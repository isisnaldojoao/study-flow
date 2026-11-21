import type { UserPreferences, WeekAvailability, WeekdayMinutes } from "@/types";

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

/** 1h30 nos dias úteis, 1h no sábado e 45 min no domingo, a partir das 19h. */
export const DEFAULT_AVAILABILITY: WeekAvailability = {
  minutes: [45, 90, 90, 90, 90, 90, 60],
  startTime: "19:00",
};

export function resolveAvailability(preferences?: UserPreferences | null): WeekAvailability {
  const raw = preferences?.availability;
  const minutes = DEFAULT_AVAILABILITY.minutes.map((fallback, index) => {
    const value = raw?.minutes?.[index];
    if (typeof value !== "number" || Number.isNaN(value)) return fallback;
    return Math.min(12 * 60, Math.max(0, Math.round(value)));
  }) as WeekdayMinutes;

  const startMatch = raw?.startTime?.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  const startTime = startMatch ? `${startMatch[1]}:${startMatch[2]}` : DEFAULT_AVAILABILITY.startTime;

  return { minutes, startTime };
}
