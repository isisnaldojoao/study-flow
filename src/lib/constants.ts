import type {
  ActivityPriority,
  ActivityStatus,
  ActivityType,
  ReminderOffset,
} from "@/types";

export const APP_NAME = "Study Flow";

export const SUBJECT_COLORS = [
  "#2563EB",
  "#0D9488",
  "#059669",
  "#D97706",
  "#DC2626",
  "#DB2777",
  "#7C3AED",
  "#4F46E5",
  "#0891B2",
  "#65A30D",
] as const;

export const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "prova", label: "Prova" },
  { value: "trabalho", label: "Trabalho" },
  { value: "atividade", label: "Atividade" },
  { value: "questionario", label: "Questionário" },
  { value: "seminario", label: "Seminário" },
  { value: "leitura", label: "Leitura" },
  { value: "revisao", label: "Revisão" },
  { value: "outro", label: "Outro" },
];

export const ACTIVITY_STATUSES: { value: ActivityStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluido", label: "Concluído" },
  { value: "atrasado", label: "Atrasado" },
];

export const ACTIVITY_PRIORITIES: {
  value: ActivityPriority;
  label: string;
}[] = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
];

export const REMINDER_OPTIONS: { value: ReminderOffset; label: string }[] = [
  { value: 0, label: "No dia" },
  { value: 1, label: "1 dia antes" },
  { value: 3, label: "3 dias antes" },
  { value: 5, label: "5 dias antes" },
  { value: 7, label: "7 dias antes" },
];

export const ACCEPTED_MATERIAL_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
];

export const ACCEPTED_MATERIAL_EXTENSIONS = ".pdf,.docx,.pptx,.jpg,.jpeg,.png,.webp,.gif,.txt";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Hoje", icon: "LayoutDashboard" },
  { href: "/calendario", label: "Calendário", icon: "CalendarDays" },
  { href: "/disciplinas", label: "Minhas disciplinas", icon: "BookOpen" },
  { href: "/planejamento", label: "Meu planejamento", icon: "Clock3" },
  { href: "/revisao", label: "Central de revisão", icon: "Sparkles" },
  { href: "/materiais", label: "Materiais", icon: "FolderOpen" },
  { href: "/relatorios", label: "Relatórios", icon: "BarChart3" },
  { href: "/configuracoes", label: "Configurações", icon: "Settings" },
] as const;
