export type ThemeMode = "light" | "dark" | "system";

export type ActivityType =
  | "prova"
  | "trabalho"
  | "atividade"
  | "questionario"
  | "seminario"
  | "leitura"
  | "revisao"
  | "outro";

export type ActivityStatus =
  | "pendente"
  | "em_andamento"
  | "concluido"
  | "atrasado";

export type ActivityPriority = "baixa" | "media" | "alta";

export type ReminderOffset = 0 | 1 | 3 | 5 | 7;

export type SessionStatus = "pendente" | "concluida";

export type NotificationType =
  | "reminder"
  | "overdue"
  | "completed"
  | "upcoming"
  | "system";

export type StudyDifficulty = "baixa" | "media" | "alta";

export type StudyTopicStatus = "pendente" | "concluido";

/** Index 0 = domingo … 6 = sábado. Minutos disponíveis para estudar. */
export type WeekdayMinutes = [number, number, number, number, number, number, number];

export interface WeekAvailability {
  minutes: WeekdayMinutes;
  startTime: string;
}

export interface UserPreferences {
  theme: ThemeMode;
  defaultReminderDays: ReminderOffset;
  notificationsEnabled: boolean;
  browserPushEnabled: boolean;
  availability?: WeekAvailability;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  preferences: UserPreferences;
}

export interface Subject {
  id: string;
  userId: string;
  name: string;
  description: string;
  color: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  description: string;
  type: ActivityType;
  date: string; // YYYY-MM-DD America/Sao_Paulo
  time?: string; // HH:mm
  priority: ActivityPriority;
  status: ActivityStatus;
  reminderSettings: ReminderOffset[];
  createdAt: string;
  updatedAt: string;
}

export interface StudySession {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  content: string;
  startDate: string;
  startTime: string;
  endTime: string;
  notes: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudyTopic {
  id: string;
  userId: string;
  subjectId: string;
  activityId?: string;
  title: string;
  estimatedMinutes: number;
  difficulty: StudyDifficulty;
  status: StudyTopicStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewContent {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  content: string; // HTML from rich editor
  reviewed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  userId: string;
  subjectId: string;
  question: string;
  answer: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface Material {
  id: string;
  userId: string;
  subjectId: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  size: number;
  storagePath?: string;
  blob?: Blob;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedActivityId?: string;
  relatedSessionId?: string;
  read: boolean;
  scheduledAt: string;
  createdAt: string;
  dedupeKey: string;
}

export interface Session {
  userId: string;
  email: string;
  name: string;
  loggedAt: string;
}
