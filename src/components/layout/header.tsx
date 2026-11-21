"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import { formatLongDate, todayISO } from "@/lib/dates";
import { initials } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useNotifications } from "@/hooks/use-live-data";
import { getActivity } from "@/services/activities";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  onMenuClick: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function Header({ onMenuClick, search, onSearchChange }: HeaderProps) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const notifications = useNotifications();
  const [openNotifs, setOpenNotifs] = useState(false);

  const unread = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const greeting = useMemo(() => {
    const hour = Number(
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "numeric",
        hour12: false,
      }).format(new Date())
    );
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const firstName = user?.name?.split(" ")[0] ?? "estudante";

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="flex flex-col gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-4 lg:px-8">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 lg:hidden"
              onClick={onMenuClick}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate font-[family-name:var(--font-fraunces)] text-base tracking-tight text-foreground sm:text-2xl">
                {greeting}, {firstName}
              </h1>
              <p className="mt-0.5 hidden text-sm capitalize text-muted-foreground sm:block">
                {formatLongDate(todayISO())}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar disciplinas, provas, conteúdos..."
                className="w-72 pl-9"
              />
            </div>

            <DropdownMenu open={openNotifs} onOpenChange={setOpenNotifs}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9"
                  aria-label="Notificações"
                >
                  <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                  {unread > 0 && (
                    <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                collisionPadding={12}
                className="w-[min(20rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)]"
              >
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <p className="text-sm font-semibold">Notificações</p>
                  {unread > 0 && user && (
                    <DropdownMenuItem
                      className="h-auto px-2 py-1 text-xs text-primary focus:text-primary"
                      onSelect={(e) => {
                        e.preventDefault();
                        void markAllNotificationsRead(user.id);
                      }}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Marcar todas
                    </DropdownMenuItem>
                  )}
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-[min(20rem,50vh)] overflow-y-auto overscroll-contain">
                  {notifications.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                      Nenhuma notificação por enquanto.
                    </p>
                  ) : (
                    notifications.slice(0, 12).map((n) => (
                      <DropdownMenuItem
                        key={n.id}
                        className="items-start whitespace-normal py-2.5"
                        onSelect={() => {
                          void (async () => {
                            try {
                              if (user && !n.read) {
                                await markNotificationRead(n.id, user.id);
                              }
                              if (user && n.relatedActivityId) {
                                const activity = await getActivity(
                                  n.relatedActivityId,
                                  user.id
                                );
                                if (activity?.subjectId) {
                                  router.push(
                                    `/disciplinas/${activity.subjectId}`
                                  );
                                  return;
                                }
                              }
                              if (n.relatedSessionId || n.relatedActivityId) {
                                router.push("/planejamento");
                              }
                            } catch {
                              // evita quebrar o menu se a consulta falhar
                            }
                          })();
                        }}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-start gap-2">
                            <span className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">
                              {n.title}
                            </span>
                            {!n.read && (
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="break-words text-xs leading-snug text-muted-foreground">
                            {n.message}
                          </p>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              aria-label="Alternar tema"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              <Sun className="h-4 w-4 dark:hidden sm:h-5 sm:w-5" />
              <Moon className="hidden h-4 w-4 dark:block sm:h-5 sm:w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-1.5 sm:px-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary sm:h-8 sm:w-8 sm:text-xs">
                    {initials(user?.name ?? "U")}
                  </span>
                  <span className="hidden max-w-[120px] truncate text-sm sm:inline">
                    {user?.name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user?.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {user?.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/configuracoes")}>
                  <UserRound className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/configuracoes")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                    router.replace("/login");
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="relative md:hidden">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar..."
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>
    </header>
  );
}
