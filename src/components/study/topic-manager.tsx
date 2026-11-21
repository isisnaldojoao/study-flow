"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ACTIVITY_PRIORITIES } from "@/lib/constants";
import { formatMinutes } from "@/lib/dates";
import { useAuth } from "@/providers/auth-provider";
import {
  createStudyTopic,
  deleteStudyTopic,
  setStudyTopicStatus,
} from "@/services/study-topics";
import type { Activity, StudyDifficulty, StudyTopic } from "@/types";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

export function TopicManager({
  subjectId,
  activities,
  topics,
}: {
  subjectId: string;
  activities: Activity[];
  topics: StudyTopic[];
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("40");
  const [difficulty, setDifficulty] = useState<StudyDifficulty>("media");
  const [activityId, setActivityId] = useState("none");
  const [saving, setSaving] = useState(false);

  const openActivities = activities.filter((activity) => activity.status !== "concluido");
  const pending = topics.filter((topic) => topic.status !== "concluido");
  const pendingMinutes = pending.reduce((sum, topic) => sum + topic.estimatedMinutes, 0);

  async function addTopic() {
    if (!user) return;
    setSaving(true);
    try {
      await createStudyTopic(user.id, {
        subjectId,
        title,
        estimatedMinutes: Number(minutes) || 40,
        difficulty,
        activityId: activityId === "none" ? undefined : activityId,
      });
      setTitle("");
      setMinutes("40");
      toast.success("Conteúdo adicionado ao plano.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(topic: StudyTopic, done: boolean) {
    if (!user) return;
    try {
      await setStudyTopicStatus(topic.id, user.id, done ? "concluido" : "pendente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar.");
    }
  }

  async function remove(topic: StudyTopic) {
    if (!user) return;
    try {
      await deleteStudyTopic(topic.id, user.id);
      toast.success("Conteúdo removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">O que precisa ser estudado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {topics.length === 0
            ? "Estes conteúdos viram a recomendação de hoje. Sem eles, o plano estima o tempo pela prova."
            : `${pending.length} pendente${pending.length === 1 ? "" : "s"} · ${formatMinutes(pendingMinutes)} no total`}
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="topic-title">Conteúdo</Label>
          <Input
            id="topic-title"
            value={title}
            placeholder="Ex.: Limites"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addTopic();
              }
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="topic-minutes">Tempo estimado (min)</Label>
          <Input
            id="topic-minutes"
            type="number"
            min={10}
            max={240}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Dificuldade</Label>
          <Select value={difficulty} onValueChange={(value) => setDifficulty(value as StudyDifficulty)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_PRIORITIES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {openActivities.length > 0 && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Vincular à avaliação</Label>
            <Select value={activityId} onValueChange={setActivityId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Próxima avaliação da disciplina</SelectItem>
                {openActivities.map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>
                    {activity.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="sm:col-span-2">
          <Button onClick={() => void addTopic()} disabled={saving || !title.trim()}>
            <Plus className="h-4 w-4" />
            Adicionar conteúdo
          </Button>
        </div>
      </div>

      {topics.length > 0 && (
        <ul className="space-y-2">
          {topics.map((topic) => (
            <li
              key={topic.id}
              className="flex items-center gap-3 rounded-xl border border-border px-3 py-2"
            >
              <Checkbox
                checked={topic.status === "concluido"}
                onCheckedChange={(checked) => void toggle(topic, checked === true)}
                aria-label={`Marcar ${topic.title} como concluído`}
              />
              <div className="min-w-0 flex-1">
                <p className={topic.status === "concluido" ? "truncate text-sm text-muted-foreground line-through" : "truncate text-sm font-medium"}>
                  {topic.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatMinutes(topic.estimatedMinutes)} ·{" "}
                  {ACTIVITY_PRIORITIES.find((item) => item.value === topic.difficulty)?.label}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => void remove(topic)}
                aria-label={`Remover ${topic.title}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
