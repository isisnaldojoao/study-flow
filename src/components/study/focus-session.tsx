"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import {
  fitSameDayRange,
  formatMinutes,
  minutesToTime,
  nowMinutesInTimezone,
  todayISO,
} from "@/lib/dates";
import { useAuth } from "@/providers/auth-provider";
import { createStudySession } from "@/services/study-sessions";
import { setStudyTopicStatus } from "@/services/study-topics";
import { Button, Checkbox } from "@/components/ui";

type Phase = "ready" | "running" | "paused" | "summary";

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function studiedMinutes(elapsed: number) {
  if (elapsed < 15_000) return 0;
  return Math.max(1, Math.round(elapsed / 60_000));
}

const kindLabel: Record<string, string> = {
  conteudo: "Conteúdo",
  exercicio: "Exercícios",
  revisao: "Revisão",
  geral: "Estudo",
};

export function FocusSession() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const subjectId = params.get("subjectId") ?? "";
  const subject = params.get("subject") ?? "Estudo";
  const title = params.get("title") ?? "Sessão de estudo";
  const objective = params.get("objective") ?? `Estudar ${title}.`;
  const topicId = params.get("topicId") ?? "";
  const kind = params.get("kind") ?? "geral";
  const color = params.get("color") ?? "";
  const planned = Math.max(1, Number(params.get("minutes")) || 25);
  const topicMinutes = Number(params.get("topicMinutes")) || 0;

  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsed, setElapsed] = useState(0);
  const [abandoned, setAbandoned] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [markTopic, setMarkTopic] = useState(
    Boolean(topicId) && (topicMinutes === 0 || planned >= topicMinutes * 0.8)
  );
  const [saving, setSaving] = useState(false);

  const accumulated = useRef(0);
  const runStart = useRef<number | null>(null);
  const clockStart = useRef<string | null>(null);

  function readElapsed() {
    const extra = runStart.current ? Date.now() - runStart.current : 0;
    return accumulated.current + extra;
  }

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => setElapsed(readElapsed()), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  function start() {
    if (!clockStart.current) clockStart.current = minutesToTime(nowMinutesInTimezone());
    runStart.current = Date.now();
    setConfirmLeave(false);
    setPhase("running");
  }

  function pause() {
    accumulated.current = readElapsed();
    runStart.current = null;
    setElapsed(accumulated.current);
    setPhase("paused");
  }

  function openSummary(nextAbandoned: boolean) {
    accumulated.current = readElapsed();
    runStart.current = null;
    const next = accumulated.current;
    setElapsed(next);
    if (studiedMinutes(next) <= 0) {
      toast.message("A sessão ficou curta demais para registrar.");
      router.push("/dashboard");
      return;
    }
    setAbandoned(nextAbandoned);
    setConfirmLeave(false);
    setPhase("summary");
  }

  async function persist() {
    if (!user || !subjectId || saving) return;
    const minutes = studiedMinutes(elapsed);
    if (minutes <= 0) {
      router.push("/dashboard");
      return;
    }
    setSaving(true);
    try {
      const range = fitSameDayRange(
        clockStart.current ?? minutesToTime(nowMinutesInTimezone()),
        minutes
      );
      await createStudySession(user.id, {
        subjectId,
        title,
        content: objective,
        startDate: todayISO(),
        startTime: range.startTime,
        endTime: range.endTime,
        notes: abandoned ? "Encerrada antes do fim." : "",
        status: "concluida",
      });
      if (!abandoned && markTopic && topicId) {
        await setStudyTopicStatus(topicId, user.id, "concluido");
      }
      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a sessão.");
      setSaving(false);
    }
  }

  if (!subjectId) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
        <p className="text-lg font-medium">Nenhuma sessão selecionada.</p>
        <Link href="/dashboard" className="mt-3 text-sm font-medium text-primary hover:underline">
          Voltar para o que estudar hoje
        </Link>
      </div>
    );
  }

  const plannedMs = planned * 60_000;
  const remaining = Math.max(0, plannedMs - elapsed);
  const overtime = Math.max(0, elapsed - plannedMs);
  const doneMinutes = studiedMinutes(elapsed);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-6 sm:px-6">
      <button
        type="button"
        className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
        onClick={() => {
          if (phase === "summary") {
            router.push("/dashboard");
            return;
          }
          if (studiedMinutes(readElapsed()) > 0) {
            if (phase === "running") pause();
            setConfirmLeave(true);
            return;
          }
          router.push("/dashboard");
        }}
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <div className="flex flex-1 flex-col justify-center py-10">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full bg-primary"
            style={color ? { backgroundColor: color } : undefined}
          />
          <p className="text-sm text-muted-foreground">{subject}</p>
        </div>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {kindLabel[kind] ?? "Estudo"}
        </p>
        <h1 className="font-display mt-1 text-3xl tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-base text-muted-foreground">{objective}</p>

        {phase === "summary" ? (
          <div className="mt-10">
            <p className="text-lg">{abandoned ? "Sessão encerrada" : "Sessão concluída"}</p>
            <p className="font-display mt-2 text-4xl tracking-tight">
              {formatMinutes(doneMinutes)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Conteúdo: {title}</p>
            {topicId && !abandoned && (
              <label className="mt-6 flex items-center gap-3 text-sm">
                <Checkbox
                  checked={markTopic}
                  onCheckedChange={(checked) => setMarkTopic(checked === true)}
                />
                Marcar conteúdo como concluído
              </label>
            )}
            <Button className="mt-6 w-full sm:w-auto" size="lg" onClick={() => void persist()} disabled={saving}>
              {saving ? "Salvando..." : "Concluir"}
            </Button>
          </div>
        ) : (
          <>
            <p
              className="font-display mt-10 text-6xl tabular-nums tracking-tight sm:text-7xl"
              aria-live="polite"
            >
              {clock(remaining > 0 ? remaining : elapsed)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {remaining > 0
                ? `de ${planned} min`
                : overtime > 0
                  ? "Tempo previsto concluído"
                  : `Meta de ${planned} min`}
            </p>

            {confirmLeave ? (
              <div className="mt-8 space-y-3">
                <p className="text-sm">Registrar os {formatMinutes(doneMinutes)} já estudados?</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={() => openSummary(true)}>Registrar e sair</Button>
                  <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                    Sair sem registrar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-col gap-2 sm:flex-row">
                {phase === "running" ? (
                  <Button variant="outline" size="lg" onClick={pause}>
                    <Pause className="h-4 w-4" />
                    Pausar
                  </Button>
                ) : (
                  <Button size="lg" onClick={start}>
                    <Play className="h-4 w-4" />
                    {phase === "paused" ? "Continuar" : "Iniciar"}
                  </Button>
                )}
                {phase !== "ready" && (
                  <Button variant="secondary" size="lg" onClick={() => openSummary(false)}>
                    Concluir
                  </Button>
                )}
                {phase !== "ready" && (
                  <Button variant="ghost" size="lg" onClick={() => openSummary(true)}>
                    Abandonar
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
