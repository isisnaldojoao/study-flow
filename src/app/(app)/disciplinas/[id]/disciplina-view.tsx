"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutGrid,
  Paperclip,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ActivityFormDialog } from "@/components/activities/activity-form-dialog";
import { TopicManager } from "@/components/study/topic-manager";
import { SubjectFormDialog } from "@/components/subjects/subject-form-dialog";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
import {
  useActivities,
  useMaterials,
  useReviewContents,
  useStudySessions,
  useStudyTopics,
  useSubjects,
} from "@/hooks/use-live-data";
import { ACTIVITY_TYPES } from "@/lib/constants";
import {
  formatDisplayDate,
  todayISO,
  urgencyBucket,
  urgencyLabels,
} from "@/lib/dates";
import { urgencyBadgeVariant } from "@/lib/urgency";
import { useAuth } from "@/providers/auth-provider";
import { deleteActivity } from "@/services/activities";
import { downloadMaterial, openMaterial } from "@/services/materials";
import { updateSubject } from "@/services/subjects";
import type { Activity } from "@/types";

export default function DisciplinaDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const subjects = useSubjects();
  const activities = useActivities();
  const sessions = useStudySessions();
  const materials = useMaterials(id);
  const reviews = useReviewContents(id);
  const topics = useStudyTopics(id);
  const subject = subjects.find((s) => s.id === id) ?? null;

  const [editSubjectOpen, setEditSubjectOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  const subjectActivities = useMemo(
    () =>
      activities
        .filter((a) => a.subjectId === id)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [activities, id]
  );

  const subjectSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.subjectId === id)
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [sessions, id]
  );

  const done = subjectActivities.filter((a) => a.status === "concluido").length;
  const progress =
    subjectActivities.length === 0
      ? 0
      : Math.round((done / subjectActivities.length) * 100);

  const byDate = useMemo(() => {
    type DayItem =
      | { kind: "activity"; data: Activity }
      | {
          kind: "session";
          data: (typeof subjectSessions)[number];
        };
    const map = new Map<string, DayItem[]>();
    for (const a of subjectActivities) {
      const list = map.get(a.date) ?? [];
      list.push({ kind: "activity", data: a });
      map.set(a.date, list);
    }
    for (const s of subjectSessions) {
      const list = map.get(s.startDate) ?? [];
      list.push({ kind: "session", data: s });
      map.set(s.startDate, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [subjectActivities, subjectSessions]);

  const notesValue = notes ?? subject?.notes ?? "";

  function openCreateActivity() {
    setEditingActivity(null);
    setActivityOpen(true);
  }

  function openEditActivity(activity: Activity) {
    setEditingActivity(activity);
    setActivityOpen(true);
  }

  async function confirmDeleteActivity() {
    if (!user || !deletingActivity) return;
    try {
      await deleteActivity(deletingActivity.id, user.id);
      toast.success("Atividade excluída.");
      setDeletingActivity(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível excluir."
      );
    }
  }

  async function saveNotes() {
    if (!user || !subject) return;
    setSavingNotes(true);
    try {
      await updateSubject(subject.id, user.id, {
        name: subject.name,
        description: subject.description,
        color: subject.color,
        notes: notesValue,
      });
      toast.success("Anotações salvas.");
      setNotes(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar."
      );
    } finally {
      setSavingNotes(false);
    }
  }

  function typeLabel(type: string) {
    return ACTIVITY_TYPES.find((t) => t.value === type)?.label ?? type;
  }

  if (!subject) {
    return (
      <EmptyState
        title="Disciplina não encontrada"
        description="Ela pode ter sido removida."
        action={
          <Link href="/disciplinas">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link
            href="/disciplinas"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Disciplinas
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="h-4 w-4 shrink-0 rounded-full"
              style={{ backgroundColor: subject.color }}
            />
            <h1 className="font-display truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {subject.name}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {subject.description || "Sem descrição"}
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditSubjectOpen(true)}>
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <LayoutGrid className="h-3.5 w-3.5" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="activities">
            <ClipboardList className="h-3.5 w-3.5" />
            Atividades
            <span className="rounded-md bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {subjectActivities.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays className="h-3.5 w-3.5" />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="contents">
            <BookOpen className="h-3.5 w-3.5" />
            Conteúdos
            <span className="rounded-md bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {topics.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="materials">
            <Paperclip className="h-3.5 w-3.5" />
            Materiais
            <span className="rounded-md bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
              {materials.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote className="h-3.5 w-3.5" />
            Notas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Atividades</CardDescription>
                <CardTitle className="text-2xl">{subjectActivities.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Sessões</CardDescription>
                <CardTitle className="text-2xl">{subjectSessions.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Concluídas</CardDescription>
                <CardTitle className="text-2xl">{done}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Progresso</CardDescription>
                <CardTitle className="text-2xl">{progress}%</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={progress} />
              </CardContent>
            </Card>
          </div>
          <p className="text-sm text-muted-foreground">
            {topics.length === 0
              ? "Nenhum conteúdo cadastrado. O plano de hoje estima o tempo pela prova até você listar o que falta estudar."
              : `${topics.filter((topic) => topic.status === "concluido").length} de ${topics.length} conteúdos concluídos.`}
          </p>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Próximos compromissos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                ...subjectActivities
                  .filter((a) => a.status !== "concluido" && a.date >= todayISO())
                  .map((a) => ({
                    key: `a-${a.id}`,
                    title: a.title,
                    subtitle: `${typeLabel(a.type)} · ${formatDisplayDate(a.date)}`,
                    date: a.date,
                  })),
                ...subjectSessions
                  .filter(
                    (s) => s.status !== "concluida" && s.startDate >= todayISO()
                  )
                  .map((s) => ({
                    key: `s-${s.id}`,
                    title: s.title,
                    subtitle: `Sessão · ${formatDisplayDate(s.startDate)}`,
                    date: s.startDate,
                  })),
              ]
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(0, 8)
                .map((item) => {
                  const bucket = urgencyBucket(item.date);
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.subtitle}
                        </p>
                      </div>
                      <Badge variant={urgencyBadgeVariant(bucket)}>
                        {urgencyLabels[bucket]}
                      </Badge>
                    </div>
                  );
                })}
              {subjectActivities.filter(
                (a) => a.status !== "concluido" && a.date >= todayISO()
              ).length === 0 &&
                subjectSessions.filter(
                  (s) => s.status !== "concluida" && s.startDate >= todayISO()
                ).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum compromisso futuro nesta disciplina.
                  </p>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateActivity}>
              <Plus className="h-4 w-4" />
              Nova atividade
            </Button>
          </div>
          {subjectActivities.length === 0 && subjectSessions.length === 0 ? (
            <EmptyState
              title="Sem atividades"
              description="Cadastre provas e trabalhos aqui — ou no planejamento com tipo Prova."
              action={
                <Button onClick={openCreateActivity}>
                  <Plus className="h-4 w-4" />
                  Criar atividade
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {subjectActivities.map((a) => {
                const bucket = urgencyBucket(a.date);
                return (
                  <div
                    key={a.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeLabel(a.type)} · {formatDisplayDate(a.date)}
                        {a.time ? ` · ${a.time}` : ""} · {a.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={urgencyBadgeVariant(bucket)}>
                        {urgencyLabels[bucket]}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditActivity(a)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeletingActivity(a)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {subjectSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Sessão · {formatDisplayDate(s.startDate)} · {s.startTime}–
                      {s.endTime}
                    </p>
                  </div>
                  <Badge variant="secondary">Sessão</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          {byDate.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-5 w-5" />}
              title="Calendário vazio"
              description="Atividades e sessões aparecerão agrupadas por data."
            />
          ) : (
            byDate.map(([date, dayItems]) => (
              <Card key={date}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {formatDisplayDate(date, "EEEE, dd MMM yyyy")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dayItems.map((item) =>
                    item.kind === "activity" ? (
                      <div
                        key={item.data.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <span>
                          {item.data.time ? `${item.data.time} · ` : ""}
                          {item.data.title}
                        </span>
                        <Badge variant="outline">
                          {typeLabel(item.data.type)}
                        </Badge>
                      </div>
                    ) : (
                      <div
                        key={item.data.id}
                        className="flex items-center justify-between rounded-lg border border-dashed px-3 py-2 text-sm"
                      >
                        <span>
                          {item.data.startTime} · {item.data.title}
                        </span>
                        <Badge variant="secondary">Sessão</Badge>
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="contents" className="space-y-8">
          <TopicManager subjectId={subject.id} activities={subjectActivities} topics={topics} />
          <div className="space-y-2">
            <h2 className="text-base font-semibold">Notas de revisão</h2>
          {reviews.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="Sem notas de revisão"
              description="Anotações feitas na Central de revisão aparecem aqui."
              action={
                <Link href="/revisao">
                  <Button variant="outline">Ir para revisão</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {reviews.map((r) => (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">{r.title}</CardTitle>
                      <Badge variant={r.reviewed ? "success" : "secondary"}>
                        {r.reviewed ? "Revisado" : "Pendente"}
                      </Badge>
                    </div>
                    <CardDescription>
                      Atualizado em {formatDisplayDate(r.updatedAt.slice(0, 10))}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
          </div>
        </TabsContent>

        <TabsContent value="materials">
          {materials.length === 0 ? (
            <EmptyState
              title="Sem materiais"
              description="Envie arquivos na página de Materiais."
              action={
                <Link href="/materiais">
                  <Button variant="outline">Ir para materiais</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {materials.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{m.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.fileType.toUpperCase()} · {(m.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openMaterial(m)}>
                      Abrir
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => downloadMaterial(m)}>
                      Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <StickyNote className="h-4 w-4" />
                Anotações da disciplina
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={10}
                value={notesValue}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Escreva anotações gerais..."
              />
              <div className="flex justify-end">
                <Button onClick={() => void saveNotes()} disabled={savingNotes}>
                  {savingNotes ? "Salvando..." : "Salvar anotações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SubjectFormDialog
        open={editSubjectOpen}
        onOpenChange={setEditSubjectOpen}
        subject={subject}
      />

      <ActivityFormDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        activity={editingActivity}
        defaultSubjectId={subject.id}
      />

      <Dialog
        open={Boolean(deletingActivity)}
        onOpenChange={(o) => !o && setDeletingActivity(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir atividade?</DialogTitle>
            <DialogDescription>
              Remover &quot;{deletingActivity?.title}&quot; permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingActivity(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmDeleteActivity()}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
