import { notifyDataChange } from "@/lib/data-sync";
import { nowISO } from "@/lib/dates";
import { deleteOwned, insertRow, listByUser, updateRow } from "@/lib/supabase-db";
import { getSupabase } from "@/lib/supabase";
import type { StudyDifficulty, StudyTopic, StudyTopicStatus } from "@/types";

const TABLE = "study_topics";

let tableAvailable: boolean | null = null;
let migrating: Promise<StudyTopic[]> | null = null;

export type StudyTopicInput = {
  subjectId: string;
  activityId?: string;
  title: string;
  estimatedMinutes?: number;
  difficulty?: StudyDifficulty;
};

function isMissingTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /study_topics|schema cache|does not exist|42P01/i.test(message);
}

function normalize(topic: StudyTopic): StudyTopic {
  const minutes = Number(topic.estimatedMinutes);
  const difficulty: StudyDifficulty =
    topic.difficulty === "baixa" || topic.difficulty === "alta" ? topic.difficulty : "media";
  return {
    ...topic,
    title: topic.title?.trim() || "Conteúdo",
    estimatedMinutes: Number.isFinite(minutes) ? Math.min(240, Math.max(10, Math.round(minutes))) : 40,
    difficulty,
    status: topic.status === "concluido" ? "concluido" : "pendente",
    activityId: topic.activityId || undefined,
  };
}

function sortTopics(items: StudyTopic[]) {
  return [...items].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title, "pt-BR")
  );
}

async function readProfileTopics(userId: string) {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const preferences = (data?.preferences ?? {}) as { studyTopics?: StudyTopic[] };
  const items = Array.isArray(preferences.studyTopics)
    ? preferences.studyTopics.filter((topic) => topic && topic.userId === userId)
    : [];
  return sortTopics(items.map(normalize));
}

async function writeProfileTopics(userId: string, topics: StudyTopic[]) {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const preferences = {
    ...((data?.preferences ?? {}) as Record<string, unknown>),
    studyTopics: topics,
  };
  const { error: updateError } = await getSupabase()
    .from("profiles")
    .update({ preferences })
    .eq("id", userId);
  if (updateError) throw new Error(updateError.message);
  notifyDataChange();
}

async function migrateProfileTopics(userId: string, local: StudyTopic[]) {
  const created: StudyTopic[] = [];
  for (const topic of local) {
    created.push(normalize(await insertRow<StudyTopic>(TABLE, topic)));
  }
  await writeProfileTopics(userId, []);
  return sortTopics(created);
}

export async function listStudyTopics(userId: string) {
  if (tableAvailable === false) return readProfileTopics(userId);
  try {
    const items = sortTopics((await listByUser<StudyTopic>(TABLE, userId)).map(normalize));
    tableAvailable = true;
    if (items.length === 0) {
      const local = await readProfileTopics(userId);
      if (local.length > 0) {
        migrating ??= migrateProfileTopics(userId, local).finally(() => {
          migrating = null;
        });
        return migrating;
      }
    }
    return items;
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    tableAvailable = false;
    return readProfileTopics(userId);
  }
}

export async function createStudyTopic(userId: string, input: StudyTopicInput) {
  const title = input.title.trim();
  if (!title) throw new Error("Informe o nome do conteúdo.");
  const topic = normalize({
    id: crypto.randomUUID(),
    userId,
    subjectId: input.subjectId,
    activityId: input.activityId || undefined,
    title,
    estimatedMinutes: input.estimatedMinutes ?? 40,
    difficulty: input.difficulty ?? "media",
    status: "pendente",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });

  if (tableAvailable === false) {
    const items = await readProfileTopics(userId);
    await writeProfileTopics(userId, [...items, topic]);
    return topic;
  }

  try {
    const created = normalize(await insertRow<StudyTopic>(TABLE, topic));
    tableAvailable = true;
    return created;
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    tableAvailable = false;
    const items = await readProfileTopics(userId);
    await writeProfileTopics(userId, [...items, topic]);
    return topic;
  }
}

export async function setStudyTopicStatus(id: string, userId: string, status: StudyTopicStatus) {
  return patchTopic(id, userId, { status });
}

async function patchTopic(id: string, userId: string, patch: Partial<StudyTopic>) {
  if (tableAvailable !== false) {
    try {
      const updated = normalize(
        await updateRow<StudyTopic>(TABLE, id, userId, { ...patch, updatedAt: nowISO() })
      );
      tableAvailable = true;
      return updated;
    } catch (error) {
      if (!isMissingTable(error)) {
        const message = error instanceof Error ? error.message : "";
        if (!/não encontrado/i.test(message)) throw error;
      } else {
        tableAvailable = false;
      }
    }
  }

  const items = await readProfileTopics(userId);
  const current = items.find((topic) => topic.id === id);
  if (!current) throw new Error("Conteúdo não encontrado.");
  const updated = normalize({ ...current, ...patch, updatedAt: nowISO() });
  await writeProfileTopics(
    userId,
    items.map((topic) => (topic.id === id ? updated : topic))
  );
  return updated;
}

export async function deleteStudyTopic(id: string, userId: string) {
  if (tableAvailable !== false) {
    try {
      await deleteOwned(TABLE, id, userId);
      tableAvailable = true;
    } catch (error) {
      if (!isMissingTable(error)) throw error;
      tableAvailable = false;
    }
  }

  const local = await readProfileTopics(userId);
  if (local.some((topic) => topic.id === id)) {
    await writeProfileTopics(
      userId,
      local.filter((topic) => topic.id !== id)
    );
  }
}
