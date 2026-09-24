"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { GameButton, Sheet } from "../ui/primitives";

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
      if (navigator.share) await navigator.share({ title: "SHUT10", text, url });
      else await copy(`${text}\n${url}`, "link");
    } catch {
      // user cancelled
    }
  };

  return (
    <div className="glass rounded-3xl p-4 text-center" data-testid="invite">
      <div className="text-xs font-bold tracking-[0.3em] text-white/60">{t("roomCode")}</div>
      <button type="button" onClick={() => copy(code, "code")} className="text-5xl font-extrabold tracking-[0.18em] text-[#ffcf4a]" data-testid="lobby-code" dir="ltr">
        {code}
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <GameButton size="sm" variant="dark" onClick={() => copy(code, "code")}>
          {copied === "code" ? t("copied") : t("copyCode")}
        </GameButton>
        <GameButton size="sm" variant="dark" onClick={() => copy(url, "link")}>
          {copied === "link" ? t("copied") : t("copyLink")}
        </GameButton>
        <GameButton size="sm" variant="blue" onClick={share}>
          📤 {t("share")}
        </GameButton>
        <GameButton size="sm" variant="blue" onClick={() => setQr(true)} data-testid="qr-button">
          ▦ {t("qrCode")}
        </GameButton>
      </div>
      <Sheet open={qr} onClose={() => setQr(false)} title={t("inviteFriends")}>
        <div className="flex flex-col items-center gap-3 pb-6">
          <QrImage text={url} />
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
