"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { SearchProvider, useSearch } from "@/components/layout/search-context";
import { SidebarPreferenceProvider } from "@/components/layout/sidebar-preference";

function ShellInner({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { search, setSearch } = useSearch();
  const pathname = usePathname();

  if (pathname.startsWith("/sessao")) {
    return <div className="min-h-dvh bg-background">{children}</div>;
  }

  return (
    <div className="flex min-h-dvh w-full max-w-[100vw] overflow-x-clip bg-background">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex w-full min-w-0 flex-1 flex-col overflow-x-clip">
        <Header
          onMenuClick={() => setMobileOpen(true)}
          search={search}
          onSearchChange={setSearch}
        />
        <main className="box-border w-full min-w-0 flex-1 overflow-x-clip px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SearchProvider>
      <SidebarPreferenceProvider>
        <ShellInner>{children}</ShellInner>
      </SidebarPreferenceProvider>
    </SearchProvider>
  );
}
