import { formatDisplayDate } from "@/lib/dates";
import type { StudyPlan } from "@/lib/planner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export function RecommendedPlan({ plan }: { plan: StudyPlan }) {
  const days = [plan.today, ...plan.upcoming.slice(0, 2)].filter((day) => day.blocks.length > 0);
  if (days.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plano recomendado</CardTitle>
        <CardDescription>
          Montado a partir das provas, dos conteúdos e da sua disponibilidade. A agenda abaixo continua sua.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {days.map((day) => (
          <div key={day.date}>
            <p className="text-sm font-medium">
              {day.date === plan.today.date
                ? "Hoje"
                : formatDisplayDate(day.date, "EEEE, dd MMM")}
            </p>
            <ul className="mt-2 space-y-1.5">
              {day.blocks.map((block) => (
                <li key={block.id} className="flex min-w-0 gap-3 text-sm">
                  <span className="w-[108px] shrink-0 tabular-nums text-muted-foreground">
                    {block.startTime}–{block.endTime}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium">{block.title}</span>
                    <span className="text-muted-foreground"> · {block.subjectName}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
