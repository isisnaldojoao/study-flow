"use client";

import { useEffect, useState } from "react";
import { onDataChange } from "@/lib/data-sync";
import { useAuth } from "@/providers/auth-provider";
import { listActivities } from "@/services/activities";
import { listMaterials } from "@/services/materials";
import { listNotifications } from "@/services/notifications";
import { listFlashcards, listReviewContents } from "@/services/review";
import { listStudySessions } from "@/services/study-sessions";
import { listStudyTopics } from "@/services/study-topics";
import { listSubjects } from "@/services/subjects";

function useRemote<T>(load: () => Promise<T>, initial: T, deps: unknown[]) {
  const [data, setData] = useState<T>(initial);

  useEffect(() => {
    let active = true;
    async function run() {
      try {
        const next = await load();
        if (active) setData(next);
      } catch {
        if (active) setData(initial);
      }
    }
    void run();
    const unsubscribe = onDataChange(() => {
      void run();
    });
    return () => {
      active = false;
      unsubscribe();
    };
    // The loader closes over the latest user and filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}

export function useSubjects() {
  const { user } = useAuth();
  return useRemote(() => (user ? listSubjects(user.id) : Promise.resolve([])), [], [user?.id]);
}

export function useActivities() {
  const { user } = useAuth();
  return useRemote(() => (user ? listActivities(user.id) : Promise.resolve([])), [], [user?.id]);
}

export function useStudySessions() {
  const { user } = useAuth();
  return useRemote(() => (user ? listStudySessions(user.id) : Promise.resolve([])), [], [user?.id]);
}

export function useStudyTopics(subjectId?: string) {
  const { user } = useAuth();
  return useRemote(
    async () => {
      if (!user) return [];
      const items = await listStudyTopics(user.id);
      return subjectId ? items.filter((topic) => topic.subjectId === subjectId) : items;
    },
    [],
    [user?.id, subjectId]
  );
}

export function useNotifications() {
  const { user } = useAuth();
  return useRemote(() => (user ? listNotifications(user.id) : Promise.resolve([])), [], [user?.id]);
}

export function useReviewContents(subjectId?: string) {
  const { user } = useAuth();
  return useRemote(
    () => (user ? listReviewContents(user.id, subjectId) : Promise.resolve([])),
    [],
    [user?.id, subjectId]
  );
}

export function useFlashcards(subjectId?: string) {
  const { user } = useAuth();
  return useRemote(
    () => (user ? listFlashcards(user.id, subjectId) : Promise.resolve([])),
    [],
    [user?.id, subjectId]
  );
}

export function useMaterials(subjectId?: string) {
  const { user } = useAuth();
  return useRemote(
    () => (user ? listMaterials(user.id, subjectId) : Promise.resolve([])),
    [],
    [user?.id, subjectId]
  );
}
