import assert from "node:assert/strict";
import { buildStudyPlan } from "./planner";
import { reorganizeOverdueSessions } from "./replan";
import type {
  Activity,
  StudySession,
  StudyTopic,
  Subject,
  WeekAvailability,
} from "../types";

const today = "2026-11-20";
const availability: WeekAvailability = {
  minutes: [120, 120, 120, 120, 120, 120, 120],
  startTime: "19:00",
};

function subject(id: string, name: string): Subject {
  return {
    id,
    userId: "user",
    name,
    description: "",
    color: id === "calc" ? "#2563EB" : "#0D9488",
    notes: "",
    createdAt: `${today}T12:00:00.000Z`,
    updatedAt: `${today}T12:00:00.000Z`,
  };
}

function activity(partial: Pick<Activity, "id" | "subjectId" | "title" | "type" | "date"> & Partial<Activity>): Activity {
  return {
    userId: "user",
    description: "",
    priority: "media",
    status: "pendente",
    reminderSettings: [1],
    createdAt: `${today}T12:00:00.000Z`,
    updatedAt: `${today}T12:00:00.000Z`,
    ...partial,
  };
}

function topic(partial: Pick<StudyTopic, "id" | "subjectId" | "title" | "estimatedMinutes"> & Partial<StudyTopic>): StudyTopic {
  return {
    userId: "user",
    difficulty: "media",
    status: "pendente",
    createdAt: `${today}T12:00:00.000Z`,
    updatedAt: `${today}T12:00:00.000Z`,
    ...partial,
  };
}

const calc = subject("calc", "Cálculo II");
const algo = subject("algo", "Algoritmos");

const timeline = buildStudyPlan({
  today,
  nowMinutes: null,
  subjects: [calc],
  activities: [
    activity({
      id: "prova",
      subjectId: "calc",
      title: "P1",
      type: "prova",
      date: "2026-11-23",
    }),
  ],
  topics: [
    topic({ id: "lim", subjectId: "calc", title: "Limites", estimatedMinutes: 90, activityId: "prova" }),
    topic({ id: "der", subjectId: "calc", title: "Derivadas", estimatedMinutes: 30, activityId: "prova" }),
  ],
  sessions: [],
  availability,
});

assert.deepEqual(
  timeline.today.blocks.map((block) => [block.startTime, block.endTime, block.title]),
  [
    ["19:00", "19:40", "Limites"],
    ["19:40", "20:20", "Exercícios de Limites"],
    ["20:20", "20:30", "Revisão"],
    ["20:30", "21:00", "Derivadas"],
  ]
);
assert.equal(timeline.today.totalMinutes, 120);
assert.equal(timeline.nextAction?.title, "Limites");
assert.equal(timeline.nextAction?.objective, "Estudar Limites.");
assert.equal(timeline.priorities[0]?.reason, "Prova em 3 dias");
assert.equal(timeline.priorities[0]?.level, "alta");

const shared = buildStudyPlan({
  today,
  nowMinutes: null,
  subjects: [calc, algo],
  activities: [
    activity({
      id: "prova",
      subjectId: "calc",
      title: "P1",
      type: "prova",
      date: "2026-11-23",
      priority: "alta",
    }),
    activity({
      id: "trab",
      subjectId: "algo",
      title: "Lista 3",
      type: "trabalho",
      date: "2026-11-26",
    }),
  ],
  topics: [
    topic({ id: "lim", subjectId: "calc", title: "Limites", estimatedMinutes: 40, activityId: "prova" }),
    topic({ id: "der", subjectId: "calc", title: "Derivadas", estimatedMinutes: 40, activityId: "prova" }),
  ],
  sessions: [],
  availability,
});

const calcMinutes = shared.today.blocks
  .filter((block) => block.subjectId === "calc")
  .reduce((sum, block) => sum + block.minutes, 0);
const algoMinutes = shared.today.blocks
  .filter((block) => block.subjectId === "algo")
  .reduce((sum, block) => sum + block.minutes, 0);

assert.equal(calcMinutes, 80);
assert.equal(algoMinutes, 40);
assert.equal(shared.today.blocks[0]?.subjectName, "Cálculo II");
assert.equal(shared.today.blocks.at(-1)?.title, "Lista 3");
assert.equal(shared.priorities.find((item) => item.subjectId === "algo")?.level, "media");

const caughtUp = buildStudyPlan({
  today,
  nowMinutes: null,
  subjects: [calc],
  activities: [
    activity({
      id: "prova",
      subjectId: "calc",
      title: "P1",
      type: "prova",
      date: "2026-11-23",
      createdAt: "2026-11-13T12:00:00.000Z",
    }),
  ],
  topics: [],
  sessions: [
    {
      id: "done",
      userId: "user",
      subjectId: "calc",
      title: "P1",
      content: "",
      startDate: "2026-11-18",
      startTime: "19:00",
      endTime: "20:00",
      notes: "",
      status: "concluida",
      createdAt: "2026-11-18T12:00:00.000Z",
      updatedAt: "2026-11-18T12:00:00.000Z",
    } satisfies StudySession,
  ],
  availability,
});

assert.ok((caughtUp.priorities[0]?.backlogMinutes ?? 0) > 0);
assert.ok((caughtUp.priorities[0]?.pendingMinutes ?? 0) < 180);
assert.ok(caughtUp.overdueMinutes >= 20);

const missed: StudySession = {
  id: "late",
  userId: "user",
  subjectId: "calc",
  title: "Revisão",
  content: "",
  startDate: "2026-11-18",
  startTime: "19:00",
  endTime: "20:00",
  notes: "",
  status: "pendente",
  createdAt: "2026-11-18T12:00:00.000Z",
  updatedAt: "2026-11-18T12:00:00.000Z",
};

const moved = reorganizeOverdueSessions([missed], availability, today);
assert.equal(moved.length, 1);
assert.equal(moved[0]?.startDate, today);
assert.equal(moved[0]?.startTime, "19:00");
assert.equal(moved[0]?.endTime, "20:00");

console.log("planner ok");
