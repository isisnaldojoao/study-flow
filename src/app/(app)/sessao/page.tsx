"use client";

import { Suspense } from "react";
import { FocusSession } from "@/components/study/focus-session";

export default function SessaoPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-dvh max-w-lg items-center px-6 text-sm text-muted-foreground">
          Abrindo sessão...
        </div>
      }
    >
      <FocusSession />
    </Suspense>
  );
}
