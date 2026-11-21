"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FolderOpen,
  LayoutDashboard,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { AppLogo } from "@/components/brand/app-logo";
import { useSidebarPreference } from "@/components/layout/sidebar-preference";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const icons = {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Clock3,
  Sparkles,
  FolderOpen,
  BarChart3,
  Settings,
} as const;

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex-1 space-y-1 pb-6", collapsed ? "px-2" : "px-3")}>
      {NAV_ITEMS.map((item) => {
        const Icon = icons[item.icon];
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={item.label}
            className={cn(
              "flex items-center rounded-xl text-sm transition-colors",
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
              active
                ? "bg-sidebar-accent text-white shadow-sm"
                : "text-sidebar-muted hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand({
  collapsed,
  onNavigate,
  showClose,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  showClose?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center py-5",
        collapsed ? "justify-center px-2" : "justify-between px-5"
      )}
    >
      <Link
        href="/dashboard"
        className={cn(
          "group flex min-w-0 items-center gap-3",
          collapsed && "justify-center"
        )}
        onClick={onNavigate}
        title={APP_NAME}
      >
        <AppLogo size={36} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-fraunces)] text-lg leading-none tracking-tight">
              {APP_NAME}
            </p>
            <p className="mt-1 text-[11px] text-sidebar-muted">
              O que estudar hoje
            </p>
          </div>
        )}
      </Link>
      {showClose && (
        <button
          type="button"
          className="rounded-lg p-2 text-sidebar-muted hover:bg-sidebar-accent"
          onClick={onNavigate}
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { collapsed, toggleCollapsed } = useSidebarPreference();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onMobileClose}
        aria-hidden={!mobileOpen}
      />

      {/* Mobile drawer — always expanded labels */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarBrand collapsed={false} onNavigate={onMobileClose} showClose />
        <SidebarNav collapsed={false} onNavigate={onMobileClose} />
        <div className="border-t border-white/10 px-5 py-4 text-xs text-sidebar-muted">
          Conta salva no Supabase.
        </div>
      </aside>

      {/* Desktop — sticky, pushes content, supports collapse */}
      <aside
        className={cn(
          "sticky top-0 hidden h-svh shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-300 lg:flex",
          collapsed ? "w-[76px]" : "w-[272px]"
        )}
      >
        <SidebarBrand collapsed={collapsed} />
        <SidebarNav collapsed={collapsed} />
        <div className="mt-auto border-t border-white/10 p-2">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-sidebar-muted transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Recolher</span>
              </>
            )}
          </button>
          {!collapsed && (
            <p className="px-3 pb-3 text-xs text-sidebar-muted">
              Conta salva no Supabase.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
