"use client";

import { useEffect, useState } from "react";
import credits from "@/games/guesswho/credits.json";
import { cardById, cardImage } from "@/games/guesswho";
import { MadeBy } from "@/components/made-by";
import { PageShell } from "@/components/page-shell";
import { GameButton } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/context";

interface Credit {
  id: string;
  file: string;
  page: string;
  author: string;
  license: string;
  licenseUrl: string | null;
}
const ROW = 50;

/** Attribution for every Guess Who photo, paged so the screen never scrolls. */
export default function CreditsPage() {
  const { t, n, lang } = useI18n();
  const list = credits as Credit[];
  const [perPage, setPerPage] = useState(8);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const fit = () => setPerPage(Math.max(3, Math.floor((window.innerHeight - 400) / ROW)));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  const current = Math.min(page, pages - 1);
  const shown = list.slice(current * perPage, current * perPage + perPage);

  return (
    <PageShell title={t("credits")}>
      {/* The app itself: made by Omar Badr. */}
      <div className="mb-2 shrink-0">
        <MadeBy />
      </div>
      <div className="mb-1 shrink-0 text-[11px] font-bold tracking-wider text-white/50 uppercase">{t("photoSources")}</div>
      <p className="mb-2 shrink-0 text-[11px] leading-snug text-white/60">{t("gw_creditsIntro")}</p>
      <ol className="grid min-h-0 flex-1 content-start gap-1 overflow-hidden" data-testid="credits">
        {shown.map((c) => {
          const card = cardById(c.id);
          return (
            <li key={c.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1" style={{ height: ROW - 4 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cardImage(c.id)} alt="" className="h-9 w-7 shrink-0 rounded object-cover" loading="lazy" />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[13px] font-extrabold">{card ? card[lang] : c.id}</div>
                <div className="truncate text-[10px] text-white/55" dir="ltr">
                  {c.author} ·{" "}
                  {c.licenseUrl ? (
                    <a href={c.licenseUrl} target="_blank" rel="noreferrer" className="underline">
                      {c.license}
                    </a>
                  ) : (
                    c.license
                  )}{" "}
                  ·{" "}
                  <a href={c.page} target="_blank" rel="noreferrer" className="underline">
                    {t("gw_source")}
                  </a>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 pt-2 pb-2">
        <GameButton size="md" variant="dark" disabled={current === 0} onClick={() => setPage(current - 1)} data-testid="credits-prev">
          ←
        </GameButton>
        <span className="text-sm font-bold text-white/60 tabular-nums">
          {n(current + 1)} / {n(pages)}
        </span>
        <GameButton size="md" variant="dark" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} data-testid="credits-next">
          →
        </GameButton>
      </div>
    </PageShell>
  );
}
