"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveAvailability } from "@/lib/availability";
import { onDataChange } from "@/lib/data-sync";
import { roundedNowMinutes, todayISO } from "@/lib/dates";
import { buildStudyPlan } from "@/lib/planner";
import { useAuth } from "@/providers/auth-provider";
import { listActivities } from "@/services/activities";
import { listStudySessions } from "@/services/study-sessions";
import { listStudyTopics } from "@/services/study-topics";
import { listSubjects } from "@/services/subjects";
import type { Activity, StudySession, StudyTopic, Subject } from "@/types";

export function useStudyPlan() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [ready, setReady] = useState(false);
  const [nowMinutes, setNowMinutes] = useState(() => roundedNowMinutes());

  useEffect(() => {
    const id = window.setInterval(() => setNowMinutes(roundedNowMinutes()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;

    async function load() {
      try {
        const [nextSubjects, nextActivities, nextSessions, nextTopics] = await Promise.all([
          listSubjects(userId!),
          listActivities(userId!),
          listStudySessions(userId!),
          listStudyTopics(userId!),
        ]);
        if (!active) return;
        setSubjects(nextSubjects);
        setActivities(nextActivities);
        setSessions(nextSessions);
        setTopics(nextTopics);
      } catch {
        if (!active) return;
      } finally {
        if (active) setReady(true);
      }
    }

    void load();
    const unsubscribe = onDataChange(() => {
      void load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  const availability = useMemo(
    () => resolveAvailability(user?.preferences),
    [user?.preferences]
  );

  const plan = useMemo(
    () =>
      buildStudyPlan({
        today: todayISO(),
        nowMinutes,
        subjects,
        activities,
        topics,
        sessions,
        availability,
      }),
    [nowMinutes, subjects, activities, topics, sessions, availability]
  );

  return { user, subjects, activities, sessions, topics, plan, ready, availability };
}
