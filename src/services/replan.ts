import { reorganizeOverdueSessions } from "@/lib/replan";
import { updateStudySession } from "@/services/study-sessions";
import type { StudySession, WeekAvailability } from "@/types";

export async function applyOverdueReplan(
  userId: string,
  sessions: StudySession[],
  availability: WeekAvailability,
  today: string
) {
  const patches = reorganizeOverdueSessions(sessions, availability, today);
  for (const patch of patches) {
    const session = sessions.find((item) => item.id === patch.id);
    if (!session) continue;
    await updateStudySession(session.id, userId, {
      subjectId: session.subjectId,
      title: session.title,
      content: session.content,
      startDate: patch.startDate,
      startTime: patch.startTime,
      endTime: patch.endTime,
      notes: session.notes,
    });
  }
  return patches;
}
