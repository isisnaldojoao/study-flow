"use client";

import { useMemo, useState } from "react";
import { Clock3, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SessionFormDialog } from "@/components/sessions/session-form-dialog";
import { RecommendedPlan } from "@/components/study/recommended-plan";
import { useSearch } from "@/components/layout/search-context";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
} from "@/components/ui";
import { useStudyPlan } from "@/hooks/use-study-plan";
import { ACTIVITY_TYPES } from "@/lib/constants";
import {
  daysUntil,
  formatDisplayDate,
  sessionDurationHours,
  todayISO,
  urgencyBucket,
  urgencyLabels,
} from "@/lib/dates";
import { matchesSearch, urgencyBadgeVariant } from "@/lib/urgency";
import {
  deleteActivity,
  setActivityStatus,
} from "@/services/activities";
import {
  computeSessionStats,
  deleteStudySession,
  setStudySessionStatus,
} from "@/services/study-sessions";
import type { Activity, StudySession } from "@/types";

type ListItem =
  | { kind: "session"; data: StudySession }
  | { kind: "activity"; data: Activity };

export default function PlanejamentoPage() {
  const { search } = useSearch();
  const { user, subjects, sessions, activities, plan } = useStudyPlan();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deletingSession, setDeletingSession] = useState<StudySession | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  const today = todayISO();

  const items = useMemo(() => {
    const sessionItems: ListItem[] = sessions
      .filter((s) => {
        const subject = subjectMap.get(s.subjectId)?.name ?? "";
        return matchesSearch(`${s.title} ${subject} ${s.content}`, search);
      })
      .map((data) => ({ kind: "session" as const, data }));

    const activityItems: ListItem[] = activities
      .filter((a) => a.status !== "concluido")
      .filter((a) => {
        const subject = subjectMap.get(a.subjectId)?.name ?? "";
        return matchesSearch(`${a.title} ${subject} ${a.type}`, search);
      })
      .map((data) => ({ kind: "activity" as const, data }));

    return [...sessionItems, ...activityItems].sort((a, b) => {
      const dateA = a.kind === "session" ? a.data.startDate : a.data.date;
      const dateB = b.kind === "session" ? b.data.startDate : b.data.date;
      const timeA =
        a.kind === "session" ? a.data.startTime : a.data.time ?? "";
      const timeB =
        b.kind === "session" ? b.data.startTime : b.data.time ?? "";
      return dateA.localeCompare(dateB) || timeA.localeCompare(timeB);
    });
  }, [sessions, activities, subjectMap, search]);

  const stats = computeSessionStats(sessions);

  function typeLabel(type: string) {
    return ACTIVITY_TYPES.find((t) => t.value === type)?.label ?? type;
  }

  function openCreate() {
    setEditingSession(null);
    setEditingActivity(null);
    setFormOpen(true);
  }

  async function confirmDelete() {
    if (!user) return;
    try {
      if (deletingSession) {
        await deleteStudySession(deletingSession.id, user.id);
        toast.success("Sessão excluída.");
        setDeletingSession(null);
      }
      if (deletingActivity) {
        await deleteActivity(deletingActivity.id, user.id);
        toast.success("Atividade excluída.");
        setDeletingActivity(null);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível excluir."
      );
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Meu planejamento
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            O plano recomendado diz o que estudar. A lista abaixo é a sua agenda.
          </p>
        </div>
        <Button onClick={openCreate} disabled={subjects.length === 0}>
          <Plus className="h-4 w-4" />
          Novo compromisso
        </Button>
      </div>

      <RecommendedPlan plan={plan} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Horas planejadas" value={`${stats.plannedHours}h`} />
        <Stat label="Horas concluídas" value={`${stats.doneHours}h`} />
        <Stat label="Sessões pendentes" value={String(stats.pending)} />
        <Stat
          label="Provas/atividades"
          value={String(
            activities.filter((a) => a.status !== "concluido").length
          )}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Clock3 className="h-5 w-5" />}
          title="Nenhum compromisso"
          description={
            subjects.length === 0
              ? "Cadastre uma disciplina antes de planejar."
              : "Crie uma prova, trabalho ou sessão de estudo."
          }
          action={
            subjects.length > 0 ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Criar compromisso
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            if (item.kind === "session") {
              const session = item.data;
              const hours = sessionDurationHours(
                session.startTime,
                session.endTime
              );
              const isToday = session.startDate === today;
              return (
                <div
                  key={`session-${session.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <Checkbox
                      className="mt-1"
                      checked={session.status === "concluida"}
                      onCheckedChange={async (c) => {
                        if (!user) return;
                        await setStudySessionStatus(
                          session.id,
                          user.id,
                          c === true ? "concluida" : "pendente"
                        );
                      }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{session.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Sessão · {subjectMap.get(session.subjectId)?.name} ·{" "}
                        {formatDisplayDate(session.startDate)} ·{" "}
                        {session.startTime}–{session.endTime} · {hours.toFixed(1)}h
                      </p>
                    </div>
                  </label>
                  <div className="flex items-center gap-2">
                    {isToday && <Badge variant="warning">Hoje</Badge>}
                    <Badge variant="secondary">Sessão</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingActivity(null);
                        setEditingSession(session);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeletingSession(session)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            }

            const activity = item.data;
            const bucket = urgencyBucket(activity.date);
            return (
              <div
                key={`activity-${activity.id}`}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={activity.status === "concluido"}
                    onCheckedChange={async (c) => {
                      if (!user) return;
                      await setActivityStatus(
                        activity.id,
                        user.id,
                        c === true ? "concluido" : "pendente"
                      );
                    }}
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabel(activity.type)} ·{" "}
                      {subjectMap.get(activity.subjectId)?.name} ·{" "}
                      {formatDisplayDate(activity.date)}
                      {activity.time ? ` · ${activity.time}` : ""}
                      {daysUntil(activity.date) >= 0
                        ? ` · em ${daysUntil(activity.date)}d`
                        : ""}
                    </p>
                  </div>
                </label>
                <div className="flex items-center gap-2">
                  <Badge variant={urgencyBadgeVariant(bucket)}>
                    {urgencyLabels[bucket]}
                  </Badge>
                  <Badge
                    variant={
                      activity.type === "prova" || activity.type === "trabalho"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {typeLabel(activity.type)}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingSession(null);
                      setEditingActivity(activity);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeletingActivity(activity)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SessionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        session={editingSession}
        activity={editingActivity}
        subjects={subjects}
        defaultKind="sessao"
      />

      <Dialog
        open={Boolean(deletingSession || deletingActivity)}
        onOpenChange={(o) => {
          if (!o) {
            setDeletingSession(null);
            setDeletingActivity(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir?</DialogTitle>
            <DialogDescription>
              Remover &quot;
              {deletingSession?.title ?? deletingActivity?.title}
              &quot; permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeletingSession(null);
                setDeletingActivity(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
