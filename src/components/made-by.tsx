"use client";

import { useI18n } from "@/lib/i18n/context";

export const AUTHOR = {
  website: "https://omar-badr.digital/",
  linkedin: "https://www.linkedin.com/in/omarsbadrss",
};

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3V9.5zm7 0h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.7V21h-4V9.5z" />
    </svg>
  );
}

/** "Games HUB · Developed by Omar Badr" with website + LinkedIn links. `compact` is the one-line hub footer. */
export function MadeBy({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const link = "inline-flex items-center gap-1 rounded-full font-bold transition hover:text-[#ffcf4a]";
  if (compact)
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[11px] text-white/50" data-testid="made-by">
        <span>
          {t("madeBy")} <span className="font-extrabold text-white/75">{t("authorName")}</span>
        </span>
        <span aria-hidden>·</span>
        <a href={AUTHOR.website} target="_blank" rel="noopener noreferrer" className={link} data-testid="author-website">
          🌐 omar-badr.digital
        </a>
        <span aria-hidden>·</span>
        <a href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer" className={link} aria-label="LinkedIn" data-testid="author-linkedin">
          <LinkedInIcon /> LinkedIn
        </a>
      </div>
    );
  return (
    <section className="glass rounded-3xl p-3 text-center" data-testid="made-by">
      <div className="text-[11px] font-bold tracking-[0.25em] text-white/50 uppercase">{t("appName")}</div>
      <div className="mt-0.5 text-sm text-white/70">
        {t("madeBy")} <span className="font-extrabold text-[#ffcf4a]">{t("authorName")}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <a href={AUTHOR.website} target="_blank" rel="noopener noreferrer" className="glass flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-extrabold" data-testid="author-website">
          🌐 {t("authorWebsite")}
        </a>
        <a href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0a66c2] text-sm font-extrabold text-white" data-testid="author-linkedin">
          <LinkedInIcon /> LinkedIn
        </a>
      </div>
    </section>
  );
}
