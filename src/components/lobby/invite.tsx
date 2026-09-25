"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Sheet } from "../ui/primitives";

export function joinUrl(code: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/$/, "")}/join/${code}`;
}

export function QrImage({ text, size = 260 }: { text: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, { width: size * 2, margin: 1, color: { dark: "#07120d", light: "#fbf1dc" } })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [text, size]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="QR code" width={size} height={size} className="rounded-2xl" data-testid="qr" />
  ) : (
    <div style={{ width: size, height: size }} className="animate-pulse rounded-2xl bg-white/10" />
  );
}

export function InvitePanel({ code }: { code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);
  const [qr, setQr] = useState(false);
  const url = joinUrl(code);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard blocked
    }
  };
  const share = async () => {
    const text = t("shareText", { code });
    try {
      if (navigator.share) await navigator.share({ title: "Games HUB", text, url });
      else await copy(`${text}\n${url}`, "link");
    } catch {
      // user cancelled
    }
  };

  const iconBtn = "glass flex h-11 flex-col items-center justify-center rounded-xl px-1 text-[8px] leading-none font-extrabold tracking-wide text-white/80 active:scale-95";
  return (
    <div className="glass shrink-0 rounded-2xl p-2.5" data-testid="invite">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => copy(code, "code")} className="min-w-0 flex-1 text-start" data-testid="lobby-code-button">
          <div className="text-[10px] font-bold tracking-[0.3em] text-white/60">{copied ? t("copied") : t("roomCode")}</div>
          <div className="text-[clamp(1.3rem,6.2vw,2.2rem)] leading-none font-extrabold tracking-[0.1em] text-[#ffcf4a]" data-testid="lobby-code" dir="ltr">
            {code}
          </div>
        </button>
        <div className="grid shrink-0 grid-cols-4 gap-1.5">
          <button type="button" className={`${iconBtn} w-10`} onClick={() => copy(code, "code")} aria-label={t("copyCode")}>
            <span className="text-base">⧉</span>
            {copied === "code" ? "✓" : "CODE"}
          </button>
          <button type="button" className={`${iconBtn} w-10`} onClick={() => copy(url, "link")} aria-label={t("copyLink")}>
            <span className="text-base">🔗</span>
            {copied === "link" ? "✓" : "LINK"}
          </button>
          <button type="button" className={`${iconBtn} w-10`} onClick={share} aria-label={t("share")}>
            <span className="text-base">📤</span>
            {t("share")}
          </button>
          <button type="button" className={`${iconBtn} w-10`} onClick={() => setQr(true)} aria-label={t("qrCode")} data-testid="qr-button">
            <span className="text-base">▦</span>
            QR
          </button>
        </div>
      </div>
      <Sheet open={qr} onClose={() => setQr(false)} title={t("inviteFriends")}>
        <div className="flex flex-col items-center gap-3 pb-6">
          <QrImage text={url} size={Math.min(260, typeof window !== "undefined" ? Math.floor(window.innerHeight * 0.45) : 260)} />
          <div className="text-4xl font-extrabold tracking-[0.18em] text-[#ffcf4a]" dir="ltr">
            {code}
          </div>
          <div className="text-xs break-all text-white/50" dir="ltr">
            {url}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
