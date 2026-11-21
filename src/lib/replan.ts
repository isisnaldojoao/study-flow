import {
  addDaysISO,
  addMinutesToTime,
  minutesToTime,
  parseTimeToMinutes,
  sessionDurationMinutes,
  weekdayIndex,
} from "@/lib/dates";
import type { StudySession, WeekAvailability } from "@/types";

export interface Reschedule {
  id: string;
  startDate: string;
  startTime: string;
  endTime: string;
  minutes: number;
}

/**
 * Move sessões pendentes que ficaram no passado para o próximo dia
 * que ainda tem disponibilidade. A duração é preservada quando cabe no dia.
 */
export function reorganizeOverdueSessions(
  sessions: StudySession[],
  availability: WeekAvailability,
  today: string
): Reschedule[] {
  const overdue = sessions
    .filter((session) => session.status === "pendente" && session.startDate < today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.startTime.localeCompare(b.startTime));

  const used = new Map<string, number>();
  for (const session of sessions) {
    if (session.status !== "pendente" || session.startDate < today) continue;
    const minutes = sessionDurationMinutes(session.startTime, session.endTime);
    if (minutes <= 0) continue;
    used.set(session.startDate, (used.get(session.startDate) ?? 0) + minutes);
  }

  const patches: Reschedule[] = [];
  for (const session of overdue) {
    const duration = sessionDurationMinutes(session.startTime, session.endTime);
    if (duration <= 0) continue;
    const placed = placeSession(duration, used, availability, today);
    if (!placed) continue;
    patches.push({ id: session.id, ...placed });
    used.set(placed.startDate, (used.get(placed.startDate) ?? 0) + placed.minutes);
  }
  return patches;
}

function placeSession(
  duration: number,
  used: Map<string, number>,
  availability: WeekAvailability,
  today: string
): Omit<Reschedule, "id"> | null {
  const strict = findSlot(duration, used, availability, today, true);
  if (strict) return strict;
  return findSlot(duration, used, availability, today, false);
}

function findSlot(
  duration: number,
  used: Map<string, number>,
  availability: WeekAvailability,
  today: string,
  strict: boolean
): Omit<Reschedule, "id"> | null {
  const startBase = parseTimeToMinutes(availability.startTime) ?? 19 * 60;
  for (let offset = 0; offset < 14; offset += 1) {
    const date = addDaysISO(today, offset);
    const cap = availability.minutes[weekdayIndex(date)] ?? 0;
    if (cap <= 0) continue;
    const busy = used.get(date) ?? 0;
    if (busy >= cap) continue;
    const startMin = startBase + busy;
    if (startMin >= 24 * 60 - 15) continue;
    const untilMidnight = 24 * 60 - 1 - startMin;
    const room = Math.min(cap - busy, untilMidnight);
    if (strict && room < duration) continue;
    const minutes = strict ? duration : Math.min(duration, untilMidnight);
    if (minutes < 15) continue;
    const startTime = minutesToTime(startMin);
    return {
      startDate: date,
      startTime,
      endTime: addMinutesToTime(startTime, minutes),
      minutes,
    };
  }
  return null;
}
