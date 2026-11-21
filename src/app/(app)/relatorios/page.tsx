"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui";
import { WeeklySummary } from "@/components/study/weekly-summary";
import { useStudyPlan } from "@/hooks/use-study-plan";
import {
  addDaysISO,
  formatDisplayDate,
  sessionDurationHours,
  todayISO,
} from "@/lib/dates";

export default function RelatoriosPage() {
  const { subjects, activities, sessions, topics, plan } = useStudyPlan();
  const today = todayISO();

  const weeklyEvolution = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(today, i - 6));
    return days.map((date) => {
      const daySessions = sessions.filter((s) => s.startDate === date);
      const hours = daySessions.reduce(
        (acc, s) => acc + sessionDurationHours(s.startTime, s.endTime),
        0
      );
      const doneHours = daySessions
        .filter((s) => s.status === "concluida")
        .reduce(
          (acc, s) => acc + sessionDurationHours(s.startTime, s.endTime),
          0
        );
      const completedActs = activities.filter(
        (a) => a.status === "concluido" && a.updatedAt.slice(0, 10) === date
      ).length;
      return {
        date,
        label: formatDisplayDate(date, "dd/MM"),
        horas: Number(hours.toFixed(1)),
        horasFeitas: Number(doneHours.toFixed(1)),
        concluidas: completedActs,
      };
    });
  }, [sessions, activities, today]);

  const completion = useMemo(() => {
    const total = activities.length;
    const done = activities.filter((a) => a.status === "concluido").length;
    const pending = activities.filter((a) => a.status === "pendente").length;
    const progress = activities.filter((a) => a.status === "em_andamento").length;
    const overdue = activities.filter((a) => a.status === "atrasado").length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return {
      total,
      done,
      pending,
      progress,
      overdue,
      percent,
      pie: [
        { name: "Concluídas", value: done, color: "#059669" },
        { name: "Pendentes", value: pending, color: "#0F766E" },
        { name: "Em andamento", value: progress, color: "#D97706" },
        { name: "Atrasadas", value: overdue, color: "#DC2626" },
      ].filter((d) => d.value > 0),
    };
  }, [activities]);

  const hoursStats = useMemo(() => {
    const planned = sessions.reduce(
      (acc, s) => acc + sessionDurationHours(s.startTime, s.endTime),
      0
    );
    const done = sessions
      .filter((s) => s.status === "concluida")
      .reduce(
        (acc, s) => acc + sessionDurationHours(s.startTime, s.endTime),
        0
      );
    return {
      planned: Number(planned.toFixed(1)),
      done: Number(done.toFixed(1)),
      chart: [
        { name: "Planejadas", horas: Number(planned.toFixed(1)) },
        { name: "Concluídas", horas: Number(done.toFixed(1)) },
      ],
    };
  }, [sessions]);

  const mostStudied = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      const hours = sessionDurationHours(s.startTime, s.endTime);
      map.set(s.subjectId, (map.get(s.subjectId) ?? 0) + hours);
    }
    return [...map.entries()]
      .map(([subjectId, hours]) => {
        const subject = subjects.find((s) => s.id === subjectId);
        return {
          name: subject?.name ?? "—",
          horas: Number(hours.toFixed(1)),
          color: subject?.color ?? "#0F766E",
        };
      })
      .sort((a, b) => b.horas - a.horas)
      .slice(0, 8);
  }, [sessions, subjects]);

  const hasData =
    activities.length > 0 || sessions.length > 0 || subjects.length > 0 || topics.length > 0;

  if (!hasData) {
    return (
      <div className="mx-auto max-w-6xl animate-fade-up">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Relatórios
        </h1>
        <EmptyState
          className="mt-6"
          title="Sem dados ainda"
          description="Cadastre disciplinas, atividades e sessões para ver gráficos reais."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Relatórios
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Minutos estudados nas sessões concluídas e o ritmo da semana
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <WeeklySummary weekly={plan.weekly} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Conclusão" value={`${completion.percent}%`} />
        <Metric title="Atividades" value={String(completion.total)} />
        <Metric title="Horas planejadas" value={`${hoursStats.planned}h`} />
        <Metric title="Horas feitas" value={`${hoursStats.done}h`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução semanal</CardTitle>
            <CardDescription>Horas de estudo e atividades concluídas</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyEvolution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="horas"
                  name="Horas planejadas"
                  stroke="#0F766E"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="horasFeitas"
                  name="Horas feitas"
                  stroke="#059669"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="concluidas"
                  name="Atividades"
                  stroke="#D97706"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">% de conclusão</CardTitle>
            <CardDescription>Distribuição por status das atividades</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {completion.pie.length === 0 ? (
              <EmptyState className="h-full py-8" title="Sem atividades" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={completion.pie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {completion.pie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horas de estudo</CardTitle>
            <CardDescription>Planejado vs concluído</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hoursStats.chart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="horas" name="Horas" fill="#0F766E" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Disciplinas mais estudadas</CardTitle>
            <CardDescription>Horas acumuladas por matéria</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {mostStudied.length === 0 ? (
              <EmptyState className="h-full py-8" title="Sem sessões ainda" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mostStudied} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar dataKey="horas" name="Horas" radius={[0, 8, 8, 0]}>
                    {mostStudied.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
