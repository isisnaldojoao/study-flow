import { nowISO, sessionDurationHours } from "@/lib/dates";
import { deleteOwned, getOwned, insertRow, listByUser, updateRow } from "@/lib/supabase-db";
import type { SessionStatus, StudySession } from "@/types";

const table = "study_sessions";

export type StudySessionFields = {
  subjectId: string;
  title: string;
  content?: string;
  startDate: string;
  startTime: string;
  endTime: string;
  notes?: string;
  status?: SessionStatus;
};

export async function listStudySessions(userId: string) {
  const items = await listByUser<StudySession>(table, userId);
  return items.sort((a, b) =>
    a.startDate === b.startDate
      ? a.startTime.localeCompare(b.startTime)
      : a.startDate.localeCompare(b.startDate)
  );
}

export async function createStudySession(userId: string, input: StudySessionFields) {
  return insertRow<StudySession>(table, {
    id: crypto.randomUUID(),
    userId,
    subjectId: input.subjectId,
    title: input.title.trim(),
    content: input.content ?? "",
    startDate: input.startDate,
    startTime: input.startTime,
    endTime: input.endTime,
    notes: input.notes ?? "",
    status: input.status ?? "pendente",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
}

export async function updateStudySession(id: string, userId: string, input: StudySessionFields) {
  const existing = await getOwned<StudySession>(table, id, userId);
  if (!existing) throw new Error("Sessão não encontrada.");
  return updateRow<StudySession>(table, id, userId, {
    subjectId: input.subjectId,
    title: input.title.trim(),
    content: input.content ?? "",
    startDate: input.startDate,
    startTime: input.startTime,
    endTime: input.endTime,
    notes: input.notes ?? "",
    updatedAt: nowISO(),
  });
}

export async function setStudySessionStatus(id: string, userId: string, status: SessionStatus) {
  const existing = await getOwned<StudySession>(table, id, userId);
  if (!existing) throw new Error("Sessão não encontrada.");
  return updateRow<StudySession>(table, id, userId, { status, updatedAt: nowISO() });
}

export async function deleteStudySession(id: string, userId: string) {
  const existing = await getOwned<StudySession>(table, id, userId);
  if (!existing) throw new Error("Sessão não encontrada.");
  await deleteOwned(table, id, userId);
}

export function computeSessionStats(sessions: StudySession[]) {
  const planned = sessions.reduce(
    (acc, session) => acc + sessionDurationHours(session.startTime, session.endTime),
    0
  );
  const doneSessions = sessions.filter((session) => session.status === "concluida");
  const doneHours = doneSessions.reduce(
    (acc, session) => acc + sessionDurationHours(session.startTime, session.endTime),
    0
  );
  return {
    plannedHours: Number(planned.toFixed(1)),
    doneHours: Number(doneHours.toFixed(1)),
    completed: doneSessions.length,
    pending: sessions.filter((session) => session.status === "pendente").length,
  };
}
