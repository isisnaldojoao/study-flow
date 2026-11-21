"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@/components/ui";
import { resolveAvailability, WEEKDAY_LABELS } from "@/lib/availability";
import { REMINDER_OPTIONS } from "@/lib/constants";
import { formatMinutes } from "@/lib/dates";
import { useAuth } from "@/providers/auth-provider";
import type { ReminderOffset, ThemeMode, UserPreferences, WeekAvailability } from "@/types";

const profileSchema = z.object({
  name: z.string().min(3, "Informe o nome completo"),
});

const passwordSchema = z
  .object({
    current: z.string().min(6, "Informe a senha atual"),
    next: z.string().min(6, "Nova senha deve ter ao menos 6 caracteres"),
    confirm: z.string().min(6, "Confirme a nova senha"),
  })
  .refine((d) => d.next === d.confirm, {
    message: "As senhas não coincidem",
    path: ["confirm"],
  });

type ProfileInput = z.infer<typeof profileSchema>;
type PasswordInput = z.infer<typeof passwordSchema>;

export default function ConfiguracoesPage() {
  const { user, updateProfile, updatePassword } = useAuth();
  const { theme, setTheme } = useTheme();
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [availability, setAvailability] = useState<WeekAvailability>(() =>
    resolveAvailability(user?.preferences)
  );

  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "" },
  });

  const passwordForm = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: "", next: "", confirm: "" },
  });

  useEffect(() => {
    if (user) profileForm.reset({ name: user.name });
  }, [user, profileForm]);

  async function onSaveProfile(data: ProfileInput) {
    try {
      await updateProfile({ name: data.name.trim() });
      toast.success("Nome atualizado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar."
      );
    }
  }

  async function onChangePassword(data: PasswordInput) {
    try {
      await updatePassword(data.current, data.next);
      toast.success("Senha alterada.");
      passwordForm.reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível alterar."
      );
    }
  }

  async function savePreferences(partial: Partial<UserPreferences>) {
    if (!user) return;
    setSavingPrefs(true);
    try {
      await updateProfile({ preferences: partial });
      if (partial.theme) setTheme(partial.theme);
      toast.success("Preferências salvas.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar."
      );
    } finally {
      setSavingPrefs(false);
    }
  }

  if (!user) return null;

  const prefs = user.preferences;

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Perfil, aparência e preferências de lembretes
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Disponibilidade</CardTitle>
          <CardDescription>
            O plano usa esses minutos para decidir quanto estudar em cada dia.
            A sugestão inicial é 1h30 nos dias úteis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {WEEKDAY_LABELS.map((label, index) => (
              <div key={label} className="space-y-1.5">
                <Label htmlFor={`day-${index}`}>{label}</Label>
                <Input
                  id={`day-${index}`}
                  type="number"
                  min={0}
                  max={720}
                  step={15}
                  value={availability.minutes[index]}
                  onChange={(event) => {
                    const next = [...availability.minutes] as WeekAvailability["minutes"];
                    next[index] = Math.min(720, Math.max(0, Number(event.target.value) || 0));
                    setAvailability({ ...availability, minutes: next });
                  }}
                />
              </div>
            ))}
          </div>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="study-start">Começar a estudar às</Label>
            <Input
              id="study-start"
              type="time"
              value={availability.startTime}
              onChange={(event) =>
                setAvailability({ ...availability, startTime: event.target.value || "19:00" })
              }
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Meta da semana: {formatMinutes(availability.minutes.reduce((sum, value) => sum + value, 0))}
          </p>
          <Button
            type="button"
            disabled={savingPrefs}
            onClick={() => void savePreferences({ availability })}
          >
            Salvar disponibilidade
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
          <CardDescription>Seus dados de conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={profileForm.handleSubmit(onSaveProfile)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" {...profileForm.register("name")} />
              {profileForm.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {profileForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" value={user.email} disabled />
            </div>
            <Button type="submit">Salvar nome</Button>
          </form>

          <Separator />

          <form
            onSubmit={passwordForm.handleSubmit(onChangePassword)}
            className="space-y-4"
          >
            <p className="text-sm font-medium">Alterar senha</p>
            <div className="space-y-1.5">
              <Label htmlFor="current">Senha atual</Label>
              <Input
                id="current"
                type="password"
                {...passwordForm.register("current")}
              />
              {passwordForm.formState.errors.current && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.current.message}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="next">Nova senha</Label>
                <Input
                  id="next"
                  type="password"
                  {...passwordForm.register("next")}
                />
                {passwordForm.formState.errors.next && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.next.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar</Label>
                <Input
                  id="confirm"
                  type="password"
                  {...passwordForm.register("confirm")}
                />
                {passwordForm.formState.errors.confirm && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.confirm.message}
                  </p>
                )}
              </div>
            </div>
            <Button type="submit" variant="outline">
              Alterar senha
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
          <CardDescription>Tema da interface</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={(prefs.theme || theme || "system") as string}
            onValueChange={(value) =>
              void savePreferences({ theme: value as ThemeMode })
            }
            disabled={savingPrefs}
          >
            <SelectTrigger className="max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Claro</SelectItem>
              <SelectItem value="dark">Escuro</SelectItem>
              <SelectItem value="system">Sistema</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificações</CardTitle>
          <CardDescription>Lembretes e alertas no app</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 text-sm">
            <Checkbox
              checked={prefs.notificationsEnabled}
              disabled={savingPrefs}
              onCheckedChange={(checked) =>
                void savePreferences({ notificationsEnabled: checked === true })
              }
            />
            Ativar notificações no aplicativo
          </label>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox
              checked={prefs.browserPushEnabled}
              disabled={savingPrefs}
              onCheckedChange={(checked) =>
                void savePreferences({ browserPushEnabled: checked === true })
              }
            />
            Permitir alertas do navegador (quando disponível)
          </label>
          <div className="max-w-xs space-y-1.5">
            <Label>Lembrete padrão</Label>
            <Select
              value={String(prefs.defaultReminderDays)}
              disabled={savingPrefs}
              onValueChange={(value) =>
                void savePreferences({
                  defaultReminderDays: Number(value) as ReminderOffset,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
