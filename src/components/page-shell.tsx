"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/context";

export function PageShell({ title, back = "/", children }: { title: string; back?: string; children: ReactNode }) {
  const { t, dir } = useI18n();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-4 safe-top safe-bottom">
      <header className="mb-4 flex items-center gap-3">
        <Link href={back} className="glass rounded-xl px-3 py-2 text-sm font-bold" aria-label={t("back")}>
          {dir === "rtl" ? "→" : "←"}
        </Link>
        <h1 className="text-xl font-extrabold tracking-wide">{title}</h1>
      </header>
      {children}
    </main>
  );
}
