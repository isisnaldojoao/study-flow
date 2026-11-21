import Link from "next/link";
import { formatMinutes } from "@/lib/dates";
import type { WeeklySnapshot } from "@/lib/planner";
import { Progress } from "@/components/ui";

export function WeeklySummary({
  weekly,
  href,
}: {
  weekly: WeeklySnapshot;
  href?: string;
}) {
  const ratio =
    weekly.goalMinutes === 0
      ? 0
      : Math.min(100, Math.round((weekly.studiedMinutes / weekly.goalMinutes) * 100));

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Esta semana</h2>
        {href ? (
          <Link href={href} className="text-sm font-medium text-primary hover:underline">
            Ver relatório
          </Link>
        ) : null}
      </div>
      <div>
        <p className="font-display text-2xl tracking-tight">
          {formatMinutes(weekly.studiedMinutes)}{" "}
          <span className="text-base font-normal text-muted-foreground">
            de {formatMinutes(weekly.goalMinutes)}
          </span>
        </p>
        <Progress value={ratio} className="mt-3" />
        <p className="mt-3 text-sm text-muted-foreground">
          {weekly.completedTasks} {weekly.completedTasks === 1 ? "tarefa concluída" : "tarefas concluídas"}
          {" · "}
          {weekly.completedSessions} {weekly.completedSessions === 1 ? "sessão" : "sessões"}
          {" · "}
          {weekly.subjectsStudied} {weekly.subjectsStudied === 1 ? "disciplina" : "disciplinas"}
          {" · "}
          {weekly.consistencyPercent}% de consistência
        </p>
      </div>
    </section>
  );
}
