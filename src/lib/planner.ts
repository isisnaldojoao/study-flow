import { ACTIVITY_TYPES } from "@/lib/constants";
import {
  addDaysISO,
  addMinutesToTime,
  daysUntil,
  formatMinutes,
  minutesToTime,
  parseTimeToMinutes,
  sessionDurationMinutes,
  startOfWeekISO,
  weekdayIndex,
} from "@/lib/dates";
import type {
  Activity,
  ActivityPriority,
  ActivityType,
  StudyDifficulty,
  StudySession,
  StudyTopic,
  Subject,
  WeekAvailability,
} from "@/types";

/**
 * Plano determinístico.
 *
 * 1. Cada avaliação aberta vira uma fila de conteúdos pendentes.
 *    Sem conteúdos, a prova/trabalho recebe uma carga estimada.
 * 2. A nota sobe com a proximidade, o tipo, a prioridade, o volume e o atraso.
 * 3. O dia é preenchido nessa ordem, até a disponibilidade.
 *    Se houver outra matéria competitiva, a primeira fica com ~67% do dia.
 * 4. Conteúdo de 90 min ou mais vira estudo + exercícios + 10 min de revisão.
 * 5. O que não coube nos dias anteriores entra de novo a partir de hoje.
 */

const TYPE_SCORE: Record<ActivityType, number> = {
  prova: 40,
  trabalho: 32,
  questionario: 26,
  seminario: 22,
  atividade: 18,
  leitura: 10,
  revisao: 8,
  outro: 8,
};

const DEFAULT_LOAD: Record<ActivityType, number> = {
  prova: 180,
  trabalho: 120,
  questionario: 90,
  seminario: 90,
  atividade: 60,
  leitura: 45,
  revisao: 40,
  outro: 40,
};

const HORIZON_DAYS = 7;
const OVERDUE_ACTIVITY_DAYS = 14;
const SECOND_SUBJECT_SHARE = 0.67;
const COMPETITIVE_RATIO = 0.55;

export type PlanBlockKind = "conteudo" | "exercicio" | "revisao" | "geral";
export type PlanPriorityLevel = "alta" | "media" | "baixa";

export interface PlanBlock {
  id: string;
  date: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  activityId?: string;
  activityTitle?: string;
  topicId?: string;
  topicMinutes?: number;
  title: string;
  kind: PlanBlockKind;
  startTime: string;
  endTime: string;
  minutes: number;
  level: PlanPriorityLevel;
  reason: string;
  objective: string;
  synthetic: boolean;
}

export interface StudyPriority {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectColor: string;
  activityId?: string;
  activityTitle: string;
  activityType: ActivityType;
  level: PlanPriorityLevel;
  score: number;
  daysUntil: number;
  reason: string;
  pendingMinutes: number;
  pendingTopics: number;
  totalTopics: number;
  doneTopics: number;
  progressPercent: number;
  backlogMinutes: number;
  behind: boolean;
  behindReason?: string;
}

export interface DayPlan {
  date: string;
  availableMinutes: number;
  blocks: PlanBlock[];
  totalMinutes: number;
}

export interface WeeklySnapshot {
  studiedMinutes: number;
  goalMinutes: number;
  completedTasks: number;
  completedSessions: number;
  subjectsStudied: number;
  consistencyPercent: number;
}

export interface OverdueSubject {
  subjectId: string;
  subjectName: string;
  minutes: number;
}

export interface StudyPlan {
  today: DayPlan;
  upcoming: DayPlan[];
  priorities: StudyPriority[];
  nextAction: PlanBlock | null;
  overdueMinutes: number;
  overdueSubjects: OverdueSubject[];
  weekly: WeeklySnapshot;
}

export interface PlannerInput {
  today: string;
  nowMinutes?: number | null;
  subjects: Subject[];
  activities: Activity[];
  topics: StudyTopic[];
  sessions: StudySession[];
  availability: WeekAvailability;
}

interface Assessment {
  key: string;
  subject: Subject;
  activity?: Activity;
  type: ActivityType;
  title: string;
  date: string;
  priority: ActivityPriority;
  createdOn: string;
  topics: StudyTopic[];
  pendingTopics: StudyTopic[];
  pendingMinutes: number;
  doneMinutes: number;
  totalMinutes: number;
  backlogMinutes: number;
  days: number;
  behind: boolean;
  behindReason?: string;
  level: PlanPriorityLevel;
  score: number;
  reason: string;
  synthetic: boolean;
  unscheduled: boolean;
}

interface WorkItem {
  assessment: Assessment;
  title: string;
  remaining: number;
  topicId?: string;
  topicMinutes?: number;
  order: number;
  synthetic: boolean;
}

export function focusSessionHref(block: PlanBlock) {
  const params = new URLSearchParams();
  params.set("subjectId", block.subjectId);
  params.set("subject", block.subjectName);
  params.set("title", block.title);
  params.set("minutes", String(block.minutes));
  params.set("objective", block.objective);
  params.set("kind", block.kind);
  if (block.topicId) params.set("topicId", block.topicId);
  if (block.activityId) params.set("activityId", block.activityId);
  if (block.topicMinutes) params.set("topicMinutes", String(block.topicMinutes));
  if (block.subjectColor) params.set("color", block.subjectColor);
  return `/sessao?${params.toString()}`;
}

export function buildStudyPlan(input: PlannerInput): StudyPlan {
  const { today, subjects, activities, topics, sessions, availability } = input;
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const assessments = buildAssessments(input, subjectById);
  const days = allocate(assessments, input);
  const todayPlan = days[0] ?? emptyDay(today, 0);
  const overdueSubjects = buildOverdue(assessments, sessions, subjectById, today);

  return {
    today: todayPlan,
    upcoming: days.slice(1),
    priorities: assessments.map(toPriority).sort(comparePriorities),
    nextAction: todayPlan.blocks[0] ?? null,
    overdueMinutes: overdueSubjects.reduce((sum, item) => sum + item.minutes, 0),
    overdueSubjects,
    weekly: buildWeekly(today, sessions, activities, topics, availability),
  };
}

function buildAssessments(
  input: PlannerInput,
  subjectById: Map<string, Subject>
): Assessment[] {
  const { today, activities, topics, sessions, availability } = input;
  const open = activities
    .filter((activity) => {
      if (activity.status === "concluido") return false;
      if (!subjectById.has(activity.subjectId)) return false;
      return daysUntil(activity.date, today) >= -OVERDUE_ACTIVITY_DAYS;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));

  const soonestBySubject = new Map<string, string>();
  for (const activity of open) {
    if (!soonestBySubject.has(activity.subjectId)) {
      soonestBySubject.set(activity.subjectId, activity.id);
    }
  }

  const subjectsWithTopics = new Set(topics.map((topic) => topic.subjectId));
  const assessments = open.map((activity) => {
    const subject = subjectById.get(activity.subjectId)!;
    const related = topicsFor(activity, topics, soonestBySubject.get(activity.subjectId));
    return toAssessment({
      subject,
      activity,
      topics: related,
      sessions,
      today,
      availability,
      unscheduled: false,
      subjectHasTopics: subjectsWithTopics.has(activity.subjectId),
    });
  });

  const covered = new Set(open.map((activity) => activity.subjectId));
  for (const subject of input.subjects) {
    if (covered.has(subject.id)) continue;
    const related = topics.filter((topic) => topic.subjectId === subject.id);
    if (!related.some((topic) => topic.status !== "concluido")) continue;
    assessments.push(
      toAssessment({
        subject,
        topics: related,
        sessions,
        today,
        availability,
        unscheduled: true,
        horizon: addDaysISO(today, 21),
      })
    );
  }

  return assessments.sort((a, b) => b.score - a.score || a.days - b.days);
}

function topicsFor(activity: Activity, topics: StudyTopic[], soonestId?: string) {
  return topics.filter((topic) => {
    if (topic.subjectId !== activity.subjectId) return false;
    if (topic.activityId) return topic.activityId === activity.id;
    return activity.id === soonestId;
  });
}

function toAssessment(args: {
  subject: Subject;
  activity?: Activity;
  topics: StudyTopic[];
  sessions: StudySession[];
  today: string;
  availability: WeekAvailability;
  unscheduled: boolean;
  horizon?: string;
  subjectHasTopics?: boolean;
}): Assessment {
  const { subject, activity, topics, sessions, today, availability, unscheduled } = args;
  const date = activity?.date ?? args.horizon ?? addDaysISO(today, 21);
  const type = activity?.type ?? "revisao";
  const createdOn = (activity?.createdAt ?? today).slice(0, 10);
  const hasTopics = topics.length > 0;
  const pendingTopics = topics
    .filter((topic) => topic.status !== "concluido")
    .sort(compareTopics);
  const doneTopics = topics.filter((topic) => topic.status === "concluido");

  let pendingMinutes = 0;
  let doneMinutes = 0;
  let totalMinutes = 0;

  if (hasTopics) {
    pendingMinutes = pendingTopics.reduce((sum, topic) => sum + clampMinutes(topic.estimatedMinutes), 0);
    doneMinutes = doneTopics.reduce((sum, topic) => sum + clampMinutes(topic.estimatedMinutes), 0);
    totalMinutes = pendingMinutes + doneMinutes;
  } else if (args.subjectHasTopics) {
    pendingMinutes = 0;
    doneMinutes = 0;
    totalMinutes = 0;
  } else {
    totalMinutes = DEFAULT_LOAD[type];
    const studied = studiedSince(sessions, subject.id, createdOn, today);
    doneMinutes = Math.min(totalMinutes, studied);
    pendingMinutes = Math.max(0, totalMinutes - doneMinutes);
  }

  const days = daysUntil(date, today);
  const backlogMinutes = backlogOf(createdOn, date, today, totalMinutes, doneMinutes, pendingMinutes);
  const capacity = capacityUntil(date, today, availability);
  let behind = false;
  let behindReason: string | undefined;
  if (pendingMinutes > 0 && backlogMinutes >= 30) {
    behind = true;
    behindReason = `${formatMinutes(backlogMinutes)} abaixo do ritmo`;
  } else if (pendingMinutes > 0 && date >= today && pendingMinutes > capacity) {
    behind = true;
    behindReason = "o conteúdo não cabe antes da avaliação";
  }

  const priority = activity?.priority ?? "baixa";
  const level = levelFor(days, priority, behind);
  const difficulty = strongestDifficulty(pendingTopics);
  const pendingCount = hasTopics ? pendingTopics.length : pendingMinutes > 0 ? 1 : 0;
  const score =
    urgencyScore(days) +
    TYPE_SCORE[type] +
    priorityScore(priority) +
    difficultyScore(difficulty) +
    Math.min(18, pendingCount * 3) +
    Math.min(30, Math.round(backlogMinutes / 10));

  const reason = unscheduled ? "Sem avaliação marcada" : assessmentReason(type, days);

  return {
    key: activity?.id ?? `subject-${subject.id}`,
    subject,
    activity,
    type,
    title: activity?.title ?? "Conteúdos pendentes",
    date,
    priority,
    createdOn,
    topics,
    pendingTopics,
    pendingMinutes,
    doneMinutes,
    totalMinutes,
    backlogMinutes,
    days,
    behind,
    behindReason,
    level,
    score,
    reason,
    synthetic: !hasTopics && !args.subjectHasTopics,
    unscheduled,
  };
}

function allocate(assessments: Assessment[], input: PlannerInput): DayPlan[] {
  const queue: WorkItem[] = [];
  for (const assessment of assessments) {
    if (assessment.pendingTopics.length > 0) {
      assessment.pendingTopics.forEach((topic, order) => {
        queue.push({
          assessment,
          title: topic.title,
          remaining: clampMinutes(topic.estimatedMinutes),
          topicId: topic.id,
          topicMinutes: clampMinutes(topic.estimatedMinutes),
          order,
          synthetic: false,
        });
      });
    } else if (assessment.synthetic && assessment.pendingMinutes > 0) {
      queue.push({
        assessment,
        title: assessment.title,
        remaining: assessment.pendingMinutes,
        order: 0,
        synthetic: true,
      });
    }
  }

  queue.sort(
    (a, b) =>
      b.assessment.score - a.assessment.score ||
      a.assessment.days - b.assessment.days ||
      a.order - b.order
  );

  const days: DayPlan[] = [];
  for (let offset = 0; offset < HORIZON_DAYS; offset += 1) {
    const date = addDaysISO(input.today, offset);
    days.push(fillDay(date, queue, input));
  }
  return days;
}

function fillDay(date: string, queue: WorkItem[], input: PlannerInput): DayPlan {
  const weekday = weekdayIndex(date);
  const offered = input.availability.minutes[weekday] ?? 0;
  const startTime = dayStart(date, input);
  const dayCapacity = Math.min(offered, minutesUntilMidnight(startTime));
  const blocks: PlanBlock[] = [];
  if (dayCapacity < 10) return emptyDay(date, dayCapacity);

  let capacityLeft = dayCapacity;
  let cursor = startTime;
  const usedBySubject = new Map<string, number>();
  let guard = 0;

  while (capacityLeft >= 10 && guard < 80) {
    guard += 1;
    const candidates = queue.filter(
      (item) => item.remaining > 0 && availableOn(item.assessment, date, input.today)
    );
    if (candidates.length === 0) break;

    const top = candidates[0];
    const competitive = candidates.some(
      (item) =>
        item.assessment.subject.id !== top.assessment.subject.id &&
        item.assessment.score >= top.assessment.score * COMPETITIVE_RATIO
    );

    let picked: { item: WorkItem; slice: number } | null = null;
    for (const item of candidates) {
      const isTop = item.assessment.subject.id === top.assessment.subject.id;
      const subjectCap =
        competitive && isTop ? Math.round(dayCapacity * SECOND_SUBJECT_SHARE) : dayCapacity;
      const used = usedBySubject.get(item.assessment.subject.id) ?? 0;
      const room = Math.min(capacityLeft, Math.max(0, subjectCap - used));
      if (room <= 0) continue;
      if (room < 10 && item.remaining >= 10) continue;
      const slice = Math.min(item.remaining, room);
      if (slice <= 0) continue;
      picked = { item, slice };
      break;
    }

    if (!picked) break;
    const parts = splitSlice(picked.slice, picked.item.title, picked.item.synthetic);
    for (const part of parts) {
      const endTime = addMinutesToTime(cursor, part.minutes);
      blocks.push(toBlock(picked.item, date, part, cursor, endTime, blocks.length));
      cursor = endTime;
    }
    picked.item.remaining -= picked.slice;
    capacityLeft -= picked.slice;
    const subjectId = picked.item.assessment.subject.id;
    usedBySubject.set(subjectId, (usedBySubject.get(subjectId) ?? 0) + picked.slice);
  }

  return {
    date,
    availableMinutes: dayCapacity,
    blocks,
    totalMinutes: blocks.reduce((sum, block) => sum + block.minutes, 0),
  };
}

function toBlock(
  item: WorkItem,
  date: string,
  part: { kind: PlanBlockKind; title: string; minutes: number },
  startTime: string,
  endTime: string,
  index: number
): PlanBlock {
  const assessment = item.assessment;
  return {
    id: `${date}:${assessment.key}:${item.topicId ?? "geral"}:${part.kind}:${index}`,
    date,
    subjectId: assessment.subject.id,
    subjectName: assessment.subject.name,
    subjectColor: assessment.subject.color,
    activityId: assessment.activity?.id,
    activityTitle: assessment.activity?.title,
    topicId: item.topicId,
    topicMinutes: item.topicMinutes,
    title: part.title,
    kind: part.kind,
    startTime,
    endTime,
    minutes: part.minutes,
    level: assessment.level,
    reason: assessment.reason,
    objective: objectiveFor(part.kind, part.title, item.synthetic, assessment.title),
    synthetic: item.synthetic,
  };
}

function splitSlice(slice: number, title: string, synthetic: boolean) {
  if (slice >= 90) {
    const review = 10;
    const rest = slice - review;
    const study = Math.floor(rest / 2);
    return [
      { kind: "conteudo" as const, title, minutes: study },
      {
        kind: "exercicio" as const,
        title: synthetic ? "Exercícios" : `Exercícios de ${title}`,
        minutes: rest - study,
      },
      { kind: "revisao" as const, title: "Revisão", minutes: review },
    ];
  }
  if (slice >= 50) {
    const study = Math.round(slice * 0.6);
    return [
      { kind: "conteudo" as const, title, minutes: study },
      {
        kind: "exercicio" as const,
        title: synthetic ? "Exercícios" : `Exercícios de ${title}`,
        minutes: slice - study,
      },
    ];
  }
  return [
    {
      kind: (synthetic ? "geral" : "conteudo") as PlanBlockKind,
      title,
      minutes: slice,
    },
  ];
}

function objectiveFor(kind: PlanBlockKind, title: string, synthetic: boolean, activityTitle: string) {
  if (kind === "revisao") return "Revisar o que acabou de estudar.";
  if (kind === "exercicio") {
    const topic = title.replace(/^Exercícios de /, "");
    return topic === "Exercícios" ? "Resolver exercícios." : `Resolver exercícios de ${topic}.`;
  }
  if (synthetic) return `Estudar para ${activityTitle}.`;
  return `Estudar ${title}.`;
}

function buildOverdue(
  assessments: Assessment[],
  sessions: StudySession[],
  subjectById: Map<string, Subject>,
  today: string
): OverdueSubject[] {
  const backlogBySubject = new Map<string, number>();
  for (const assessment of assessments) {
    const id = assessment.subject.id;
    backlogBySubject.set(id, (backlogBySubject.get(id) ?? 0) + assessment.backlogMinutes);
  }

  const missedBySubject = new Map<string, number>();
  for (const session of sessions) {
    if (session.status !== "pendente" || session.startDate >= today) continue;
    const minutes = sessionDurationMinutes(session.startTime, session.endTime);
    if (minutes <= 0) continue;
    missedBySubject.set(session.subjectId, (missedBySubject.get(session.subjectId) ?? 0) + minutes);
  }

  const ids = new Set([...backlogBySubject.keys(), ...missedBySubject.keys()]);
  return [...ids]
    .map((subjectId) => ({
      subjectId,
      subjectName: subjectById.get(subjectId)?.name ?? "Disciplina",
      minutes: Math.max(backlogBySubject.get(subjectId) ?? 0, missedBySubject.get(subjectId) ?? 0),
    }))
    .filter((item) => item.minutes >= 20)
    .sort((a, b) => b.minutes - a.minutes);
}

function buildWeekly(
  today: string,
  sessions: StudySession[],
  activities: Activity[],
  topics: StudyTopic[],
  availability: WeekAvailability
): WeeklySnapshot {
  const weekStart = startOfWeekISO(today);
  const weekEnd = addDaysISO(weekStart, 6);
  const dates = Array.from({ length: 7 }, (_, index) => addDaysISO(weekStart, index));
  const elapsed = dates.filter((date) => date <= today);
  const studiedByDay = new Map<string, number>();

  for (const session of sessions) {
    if (session.status !== "concluida") continue;
    if (session.startDate < weekStart || session.startDate > weekEnd) continue;
    const minutes = sessionDurationMinutes(session.startTime, session.endTime);
    studiedByDay.set(session.startDate, (studiedByDay.get(session.startDate) ?? 0) + minutes);
  }

  const studiedMinutes = [...studiedByDay.values()].reduce((sum, value) => sum + value, 0);
  const goalMinutes = dates.reduce(
    (sum, date) => sum + (availability.minutes[weekdayIndex(date)] ?? 0),
    0
  );
  const activeDays = elapsed.filter((date) => (studiedByDay.get(date) ?? 0) > 0).length;
  const inWeek = (value: string) => {
    const day = value.slice(0, 10);
    return day >= weekStart && day <= weekEnd;
  };

  return {
    studiedMinutes,
    goalMinutes,
    completedTasks:
      activities.filter((activity) => activity.status === "concluido" && inWeek(activity.updatedAt)).length +
      topics.filter((topic) => topic.status === "concluido" && inWeek(topic.updatedAt)).length,
    completedSessions: sessions.filter(
      (session) => session.status === "concluida" && inWeek(session.startDate)
    ).length,
    subjectsStudied: new Set(
      sessions
        .filter((session) => session.status === "concluida" && inWeek(session.startDate))
        .map((session) => session.subjectId)
    ).size,
    consistencyPercent: elapsed.length === 0 ? 0 : Math.round((activeDays / elapsed.length) * 100),
  };
}

function toPriority(assessment: Assessment): StudyPriority {
  const totalTopics = assessment.topics.length;
  const doneTopics = totalTopics - assessment.pendingTopics.length;
  const progressPercent =
    assessment.totalMinutes === 0
      ? 0
      : Math.round((assessment.doneMinutes / assessment.totalMinutes) * 100);
  return {
    id: assessment.key,
    subjectId: assessment.subject.id,
    subjectName: assessment.subject.name,
    subjectColor: assessment.subject.color,
    activityId: assessment.activity?.id,
    activityTitle: assessment.title,
    activityType: assessment.type,
    level: assessment.level,
    score: assessment.score,
    daysUntil: assessment.days,
    reason: assessment.reason,
    pendingMinutes: assessment.pendingMinutes,
    pendingTopics: assessment.pendingTopics.length,
    totalTopics,
    doneTopics,
    progressPercent,
    backlogMinutes: assessment.backlogMinutes,
    behind: assessment.behind,
    behindReason: assessment.behindReason,
  };
}

function comparePriorities(a: StudyPriority, b: StudyPriority) {
  const aPending = a.pendingMinutes > 0 ? 0 : 1;
  const bPending = b.pendingMinutes > 0 ? 0 : 1;
  return aPending - bPending || b.score - a.score || a.daysUntil - b.daysUntil;
}

function compareTopics(a: StudyTopic, b: StudyTopic) {
  return difficultyScore(b.difficulty) - difficultyScore(a.difficulty) || a.createdAt.localeCompare(b.createdAt);
}

function availableOn(assessment: Assessment, date: string, today: string) {
  if (assessment.unscheduled) return true;
  if (assessment.date < today) return true;
  return date <= assessment.date;
}

function dayStart(date: string, input: PlannerInput) {
  const base = parseTimeToMinutes(input.availability.startTime) ?? 19 * 60;
  if (date !== input.today || input.nowMinutes == null) return minutesToTime(Math.min(base, 23 * 60));
  if (input.nowMinutes <= base) return minutesToTime(base);
  const rounded = Math.ceil(input.nowMinutes / 5) * 5;
  if (rounded > 23 * 60 + 15) return minutesToTime(Math.min(base, 23 * 60));
  return minutesToTime(rounded);
}

function minutesUntilMidnight(startTime: string) {
  const start = parseTimeToMinutes(startTime) ?? 0;
  return Math.max(0, 24 * 60 - start - 1);
}

function emptyDay(date: string, availableMinutes: number): DayPlan {
  return { date, availableMinutes, blocks: [], totalMinutes: 0 };
}

function studiedSince(sessions: StudySession[], subjectId: string, since: string, until: string) {
  return sessions.reduce((sum, session) => {
    if (session.status !== "concluida" || session.subjectId !== subjectId) return sum;
    if (session.startDate < since || session.startDate > until) return sum;
    return sum + sessionDurationMinutes(session.startTime, session.endTime);
  }, 0);
}

function backlogOf(
  createdOn: string,
  due: string,
  today: string,
  total: number,
  done: number,
  pending: number
) {
  if (pending <= 0 || total <= 0) return 0;
  if (due < today) return pending;
  if (createdOn >= today) return 0;
  const span = Math.max(1, daysUntil(due, createdOn));
  const elapsed = Math.min(span, Math.max(0, daysUntil(today, createdOn)));
  const expected = Math.round((total * elapsed) / span);
  return Math.max(0, expected - done);
}

function capacityUntil(due: string, today: string, availability: WeekAvailability) {
  if (due < today) return 0;
  const span = Math.min(daysUntil(due, today), 21);
  let sum = 0;
  for (let index = 0; index <= span; index += 1) {
    const date = addDaysISO(today, index);
    sum += availability.minutes[weekdayIndex(date)] ?? 0;
  }
  return sum;
}

function levelFor(days: number, priority: ActivityPriority, behind: boolean): PlanPriorityLevel {
  if (behind || days <= 3) return "alta";
  if (days <= 7 || priority === "alta") return "media";
  return "baixa";
}

function urgencyScore(days: number) {
  if (days < 0) return 140;
  if (days === 0) return 120;
  if (days === 1) return 110;
  if (days <= 3) return 80;
  if (days <= 7) return 50;
  if (days <= 14) return 28;
  return 12;
}

function priorityScore(priority: ActivityPriority) {
  if (priority === "alta") return 24;
  if (priority === "media") return 12;
  return 0;
}

function difficultyScore(difficulty: StudyDifficulty) {
  if (difficulty === "alta") return 8;
  if (difficulty === "media") return 4;
  return 0;
}

function strongestDifficulty(topics: StudyTopic[]): StudyDifficulty {
  if (topics.some((topic) => topic.difficulty === "alta")) return "alta";
  if (topics.some((topic) => topic.difficulty === "media")) return "media";
  return "baixa";
}

function assessmentReason(type: ActivityType, days: number) {
  const label = ACTIVITY_TYPES.find((item) => item.value === type)?.label ?? "Atividade";
  if (days < 0) return `${label} com prazo vencido`;
  if (days === 0) return `${label} hoje`;
  if (days === 1) return `${label} amanhã`;
  return `${label} em ${days} dias`;
}

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) return 40;
  return Math.min(240, Math.max(10, Math.round(value)));
}
