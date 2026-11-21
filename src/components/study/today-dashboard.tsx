"use client";

import { useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { useSearch } from "@/components/layout/search-context";
import { WeeklySummary } from "@/components/study/weekly-summary";
import { Badge, Button, EmptyState, Progress } from "@/components/ui";
import { useStudyPlan } from "@/hooks/use-study-plan";
import { ACTIVITY_TYPES } from "@/lib/constants";
import {
  daysUntil,
  formatDisplayDate,
  formatMinutes,
  todayISO,
  urgencyBucket,
  urgencyLabels,
} from "@/lib/dates";
import {
  focusSessionHref,
  type PlanBlock,
  type PlanPriorityLevel,
  type StudyPlan,
} from "@/lib/planner";
import { matchesSearch, urgencyBadgeVariant } from "@/lib/urgency";
import { applyOverdueReplan } from "@/services/replan";

const levelLabel: Record<PlanPriorityLevel, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const levelBadge: Record<PlanPriorityLevel, "danger" | "warning" | "success"> = {
  alta: "danger",
  media: "warning",
  baixa: "success",
};

const levelDot: Record<PlanPriorityLevel, string> = {
  alta: "bg-red-500",
  media: "bg-amber-500",
  baixa: "bg-emerald-500",
};

export function TodayDashboard() {
  const { search } = useSearch();
  const { user, subjects, activities, sessions, topics, plan, ready, availability } = useStudyPlan();
  const [reorganizing, setReorganizing] = useState(false);
  const today = todayISO();
  const usingDefault = !user?.preferences.availability;

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <EmptyState
          title="Comece pela primeira disciplina"
          description="O Study Flow usa suas disciplinas, provas e conteúdos para dizer o que estudar hoje."
          action={
            <Link href="/disciplinas" className="text-sm font-medium text-primary hover:underline">
              Cadastrar disciplina
            </Link>
          }
        />
      </div>
    );
  }

  const visibleBlocks = plan.today.blocks.filter((block) =>
    matchesSearch(`${block.subjectName} ${block.title} ${block.activityTitle ?? ""} ${block.reason}`, search)
  );
  const groups = groupBlocks(visibleBlocks);
  const shown = new Set(groups.map((group) => group.subjectId));
  const later = plan.priorities
    .filter(
      (item) =>
        item.pendingMinutes > 0 &&
        !shown.has(item.subjectId) &&
        matchesSearch(`${item.subjectName} ${item.activityTitle} ${item.reason}`, search)
    )
    .slice(0, Math.max(0, 3 - Math.max(0, groups.length - 1)));
  const deadlines = activities
    .filter((activity) => activity.status !== "concluido" && activity.date >= today)
    .filter((activity) => {
      const subject = subjects.find((item) => item.id === activity.subjectId)?.name ?? "";
      return matchesSearch(`${activity.title} ${subject} ${activity.type}`, search);
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
    .slice(0, 5);
  const priorities = plan.priorities
    .filter((item) => matchesSearch(`${item.subjectName} ${item.activityTitle} ${item.reason}`, search))
    .slice(0, 4);
  const agenda = sessions.filter((session) => session.startDate === today && session.status === "pendente");
  const behind = plan.priorities.filter((item) => item.behind);
  const noInputs = activities.length === 0 && topics.length === 0;
  const noTime = availability.minutes.every((minutes) => minutes === 0);

  async function reorganize() {
    if (!user) return;
    setReorganizing(true);
    try {
      const patches = await applyOverdueReplan(user.id, sessions, availability, today);
      if (patches.length > 0) {
        const minutes = patches.reduce((sum, patch) => sum + patch.minutes, 0);
        toast.success(
          `Reorganizei ${patches.length === 1 ? "1 sessão atrasada" : `${patches.length} sessões atrasadas`} (${formatMinutes(minutes)}).`
        );
      } else if (plan.overdueMinutes >= 20) {
        toast.success(
          `O plano já distribui ${formatMinutes(plan.overdueMinutes)} de atraso a partir de hoje.`
        );
      } else {
        toast.success("Seu plano já está em dia.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível reorganizar.");
    } finally {
      setReorganizing(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 animate-fade-up">
      <header>
        <p className="text-sm text-muted-foreground">Bom estudo</p>
        {plan.today.totalMinutes > 0 ? (
          <>
            <h1 className="font-display mt-1 text-3xl tracking-tight sm:text-4xl">
              Hoje você precisa estudar {formatMinutes(plan.today.totalMinutes)}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {usingDefault ? "Sugestão de disponibilidade: " : "Disponibilidade de hoje: "}
              {formatMinutes(plan.today.availableMinutes)}.{" "}
              <Link href="/configuracoes" className="font-medium text-primary hover:underline">
                Ajustar
              </Link>
            </p>
          </>
        ) : (
          <h1 className="font-display mt-1 text-3xl tracking-tight sm:text-4xl">
            {noInputs ? "Falta o que estudar" : noTime ? "Sem tempo disponível hoje" : "Você está em dia"}
          </h1>
        )}
      </header>

      {noInputs ? (
        <EmptyState
          title="Cadastre uma prova ou os conteúdos"
          description="Com uma data e o que ainda falta estudar, o Study Flow escolhe a próxima ação."
          action={
            <Link href="/disciplinas" className="text-sm font-medium text-primary hover:underline">
              Abrir disciplinas
            </Link>
          }
        />
      ) : noTime ? (
        <EmptyState
          title="Defina quanto tempo você tem"
          description="O plano só distribui estudo nos dias com disponibilidade."
          action={
            <Link href="/configuracoes" className="text-sm font-medium text-primary hover:underline">
              Ajustar disponibilidade
            </Link>
          }
        />
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search.trim()
            ? "Nada encontrado para essa busca."
            : "Nada pendente para as próximas avaliações. Quando surgir uma prova ou um conteúdo novo, a recomendação volta aqui."}
        </p>
      ) : (
        <PriorityBlock blocks={groups[0].blocks} emphasis />
      )}

      {(groups.length > 1 || later.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Depois</h2>
          {groups.slice(1).map((group) => (
            <PriorityBlock key={group.subjectId} blocks={group.blocks} />
          ))}
          {later.map((item) => {
            const slot = nextSlot(plan, item.subjectId);
            return (
              <article key={item.id} className="rounded-2xl border border-border px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${levelDot[item.level]}`} />
                  <h3 className="font-display text-xl tracking-tight">{item.subjectName}</h3>
                  <Badge variant={levelBadge[item.level]}>{levelLabel[item.level]}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
                <p className="mt-3 text-sm">
                  Tempo recomendado:{" "}
                  <strong>{formatMinutes(slot?.minutes ?? Math.min(item.pendingMinutes, 60))}</strong>
                </p>
                {slot && slot.date !== today && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sugerido para {formatDisplayDate(slot.date, "EEEE")}
                  </p>
                )}
                {slot && (
                  <Button asChild className="mt-4" variant="outline">
                    <Link href={focusSessionHref(slot.block)}>
                      <Play className="h-4 w-4" />
                      Começar sessão
                    </Link>
                  </Button>
                )}
              </article>
            );
          })}
        </section>
      )}

      {(plan.overdueMinutes >= 20 || behind.length > 0) && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4">
          <h2 className="text-sm font-medium">Atenção</h2>
          <p className="mt-1 text-sm">
            {plan.overdueMinutes >= 20
              ? overdueCopy(plan)
              : `Você está atrasado em ${behind[0]?.subjectName}: ${behind[0]?.behindReason}.`}
          </p>
          {behind.length > 0 && plan.overdueMinutes >= 20 && (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {behind.slice(0, 3).map((item) => (
                <li key={item.id}>
                  {item.subjectName}: {item.behindReason}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Esse tempo entra nos próximos dias em que você tem disponibilidade.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => void reorganize()} disabled={reorganizing}>
            {reorganizing ? "Reorganizando..." : "Reorganizar meu plano"}
          </Button>
        </section>
      )}

      {priorities.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Andamento</h2>
            <Link href="/disciplinas" className="text-sm font-medium text-primary hover:underline">
              Disciplinas
            </Link>
          </div>
          {priorities.map((item) => (
            <div key={item.id}>
              <div className="flex items-center justify-between gap-3">
                <Link href={`/disciplinas/${item.subjectId}`} className="truncate text-sm font-medium hover:underline">
                  {item.subjectName}
                </Link>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.progressPercent}%</span>
              </div>
              <Progress value={item.progressPercent} className="mt-2" />
              <p className="mt-1 text-xs text-muted-foreground">
                {item.totalTopics > 0
                  ? `${item.doneTopics} de ${item.totalTopics} conteúdos`
                  : "Estimativa pela avaliação"}
                {" · "}
                {item.reason}
              </p>
            </div>
          ))}
        </section>
      )}

      {deadlines.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground">Próximos prazos</h2>
          {deadlines.map((activity) => {
            const bucket = urgencyBucket(activity.date);
            const subject = subjects.find((item) => item.id === activity.subjectId);
            const type = ACTIVITY_TYPES.find((item) => item.value === activity.type)?.label ?? activity.type;
            const distance = daysUntil(activity.date, today);
            return (
              <div key={activity.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{activity.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subject?.name} · {type} · {formatDisplayDate(activity.date)}
                    {distance >= 0 ? ` · em ${distance}d` : ""}
                  </p>
                </div>
                <Badge variant={urgencyBadgeVariant(bucket)}>{urgencyLabels[bucket]}</Badge>
              </div>
            );
          })}
        </section>
      )}

      {(plan.weekly.studiedMinutes > 0 || activities.length > 0 || sessions.length > 0) && (
        <WeeklySummary weekly={plan.weekly} href="/relatorios" />
      )}

      {agenda.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Na sua agenda hoje:{" "}
          {agenda.map((session) => `${session.title} (${session.startTime})`).join(", ")}.{" "}
          <Link href="/planejamento" className="font-medium text-primary hover:underline">
            Abrir planejamento
          </Link>
        </p>
      )}
    </div>
  );
}

function PriorityBlock({ blocks, emphasis = false }: { blocks: PlanBlock[]; emphasis?: boolean }) {
  const first = blocks[0];
  if (!first) return null;
  const minutes = blocks.reduce((sum, block) => sum + block.minutes, 0);
  const contents = unique(
    blocks.filter((block) => block.kind === "conteudo" || block.kind === "geral").map((block) => block.title)
  );

  return (
    <article
      className={
        emphasis
          ? "rounded-2xl border border-border bg-card px-4 py-5 shadow-sm sm:px-5"
          : "rounded-2xl border border-border px-4 py-4"
      }
    >
      {emphasis && <p className="text-sm font-medium text-muted-foreground">Sua prioridade</p>}
      <div className={`flex flex-wrap items-center gap-2 ${emphasis ? "mt-2" : ""}`}>
        <span className="size-2.5 rounded-full" style={{ backgroundColor: first.subjectColor }} />
        <h2 className={emphasis ? "font-display text-2xl tracking-tight" : "font-display text-xl tracking-tight"}>
          {first.subjectName}
        </h2>
        <span className={`size-2 rounded-full ${levelDot[first.level]}`} />
        <Badge variant={levelBadge[first.level]}>{levelLabel[first.level]}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{first.reason}</p>

      {contents.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {first.synthetic ? "Foco de hoje" : "Conteúdo prioritário"}
          </p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {contents.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </div>
      )}

      {emphasis && (
        <ol className="mt-4 space-y-1 border-t border-border pt-3">
          {blocks.map((block) => (
            <li key={block.id}>
              <Link
                href={focusSessionHref(block)}
                className="flex min-w-0 gap-3 rounded-lg py-1 text-sm hover:bg-muted/60"
              >
                <span className="w-[108px] shrink-0 tabular-nums text-muted-foreground">
                  {block.startTime}–{block.endTime}
                </span>
                <span className="min-w-0 truncate">{block.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 text-sm">
        Tempo recomendado: <strong>{formatMinutes(minutes)}</strong>
      </p>
      {first.synthetic && (
        <p className="mt-1 text-xs text-muted-foreground">
          Estimativa até a avaliação.{" "}
          <Link href={`/disciplinas/${first.subjectId}`} className="font-medium text-primary hover:underline">
            Cadastre os conteúdos
          </Link>{" "}
          para detalhar o plano.
        </p>
      )}
      <Button asChild className="mt-4 w-full sm:w-auto" size={emphasis ? "lg" : "default"} variant={emphasis ? "default" : "outline"}>
        <Link href={focusSessionHref(first)}>
          <Play className="h-4 w-4" />
          Começar sessão
        </Link>
      </Button>
    </article>
  );
}

function groupBlocks(blocks: PlanBlock[]) {
  const groups: { subjectId: string; blocks: PlanBlock[] }[] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (last?.subjectId === block.subjectId) last.blocks.push(block);
    else groups.push({ subjectId: block.subjectId, blocks: [block] });
  }
  return groups;
}

function nextSlot(plan: StudyPlan, subjectId: string) {
  for (const day of [plan.today, ...plan.upcoming]) {
    const blocks = day.blocks.filter((block) => block.subjectId === subjectId);
    if (blocks.length === 0 || !blocks[0]) continue;
    return {
      date: day.date,
      minutes: blocks.reduce((sum, block) => sum + block.minutes, 0),
      block: blocks[0],
    };
  }
  return null;
}

function overdueCopy(plan: StudyPlan) {
  if (plan.overdueSubjects.length === 1) {
    const item = plan.overdueSubjects[0];
    return `Você deixou ${formatMinutes(item.minutes)} de ${item.subjectName} pendente.`;
  }
  return `Você possui ${formatMinutes(plan.overdueMinutes)} de estudos atrasados.`;
}

function unique(items: string[]) {
  return [...new Set(items)];
}
