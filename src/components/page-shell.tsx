"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/context";

/** Full-screen page that never scrolls: header + a flex column that fills the rest. */
export function PageShell({ title, back = "/", children, right }: { title: string; back?: string; children: ReactNode; right?: ReactNode }) {
  const { t, dir } = useI18n();
  return (
    <main className="mx-auto flex h-dvh w-full max-w-[520px] min-w-0 flex-col overflow-hidden px-4 safe-top safe-bottom">
      <header className="mb-3 flex shrink-0 items-center gap-3">
        <Link href={back} className="glass rounded-xl px-3 py-2 text-sm font-bold" aria-label={t("back")}>
          {dir === "rtl" ? "→" : "←"}
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-wide">{title}</h1>
        {right}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </main>
  );
}
