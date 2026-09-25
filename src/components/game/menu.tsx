"use client";

import { useState } from "react";
import type { Command, HistoryEntry, RoomState } from "@/game-engine";
import { getPlayer } from "@/game-engine";
import { setPrefs, usePrefs } from "@/lib/client/prefs";
import { useI18n } from "@/lib/i18n/context";
import { GameButton, Sheet, Toggle } from "../ui/primitives";
import { ColorIcon } from "./theme";
import { ThemePicker } from "../theme-picker";

export function PreferenceToggles({ theme = true }: { theme?: boolean }) {
  const { t, lang, setLang } = useI18n();
  const prefs = usePrefs();
  return (
    <div className="grid gap-2">
      <Toggle checked={prefs.sound} onChange={(v) => setPrefs({ sound: v })} label={`🔊 ${t("sound")}`} />
      <Toggle checked={prefs.haptics} onChange={(v) => setPrefs({ haptics: v })} label={`📳 ${t("haptics")}`} />
      {theme && <ThemePicker compact />}
      <button
        type="button"
        onClick={() => setLang(lang === "en" ? "ar" : "en")}
        className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3 font-semibold"
        data-testid="lang-toggle"
      >
        <span>🌐 {t("language")}</span>
        <span className="font-extrabold text-[#ffcf4a]">{lang === "en" ? "العربية" : "English"}</span>
      </button>
    </div>
  );
}

export function HistoryList({ state }: { state: RoomState }) {
  const { t, n } = useI18n();
  // Latest entries only — as many as fit the sheet, so the list never scrolls.
  const fit = typeof window !== "undefined" ? Math.max(5, Math.floor((window.innerHeight * 0.55) / 34)) : 10;
  const items = [...state.history].reverse().slice(0, fit);
  if (!items.length) return <div className="py-6 text-center text-white/50">{t("noHistory")}</div>;
  const line = (h: HistoryEntry) => {
    const plus = (xs: number[]) => xs.map((x) => n(x)).join(" + ");
    switch (h.kind) {
      case "roll":
        return `${h.dice?.[1] != null ? `${n(h.dice[0])} + ${n(h.dice[1])}` : n(h.dice?.[0] ?? 0)} = ${n(h.total ?? 0)}${h.auto ? ` (${t(`auto_${h.auto}`)})` : ""}`;
      case "close":
        return `${t("closeTiles")} ${plus(h.tiles ?? [])}`;
      case "blocked":
        return `${t("blocked")} · ${n(h.total ?? 0)}`;
      case "shut":
        return `🎉 ${t("shutTheBox")}`;
      case "skip":
        return t("skipped");
      case "extra":
        return t("extraTurn");
      case "hint":
        return `💡 ${plus(h.tiles ?? [])}`;
      case "round":
        return `— ${t("roundN", { n: h.roundNumber })} —`;
    }
  };
  return (
    <ol className="space-y-1 overflow-hidden" data-testid="history">
      {items.map((h) => {
        const p = getPlayer(state, h.playerId);
        return (
          <li key={h.n} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm ${h.kind === "round" ? "justify-center text-white/50" : "bg-white/5"}`}>
            {h.kind !== "round" && p && (
              <>
                <ColorIcon color={p.color} size={10} />
                <span className="w-20 shrink-0 truncate font-extrabold">{p.nickname}</span>
              </>
            )}
            <span className="font-semibold">{line(h)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function GameMenu({
  open,
  onClose,
  state,
  me,
  isHost,
  devTools,
  send,
  onLeave,
}: {
  open: boolean;
  onClose: () => void;
  state: RoomState;
  me: string | null;
  isHost: boolean;
  devTools: boolean;
  send: (c: Command) => void;
  onLeave: () => void;
}) {
  const { t } = useI18n();
  const prefs = usePrefs();
  const [tab, setTab] = useState<"menu" | "history" | "dev">("menu");
  const inMatch = !!state.match && !state.match.result;
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="mb-3 flex gap-2">
        {(["menu", "history", ...(devTools ? (["dev"] as const) : [])] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex-1 rounded-xl py-2 text-sm font-extrabold ${tab === k ? "bg-[#ffcf4a] text-[#2a1a00]" : "bg-white/5"}`}
          >
            {k === "menu" ? t("settings") : k === "history" ? t("history") : "DEV"}
          </button>
        ))}
      </div>
      {tab === "menu" && (
        <div className="grid gap-2 pb-4">
          <PreferenceToggles />
          <Toggle checked={prefs.view === "table"} onChange={(v) => setPrefs({ view: v ? "table" : "players" })} label={`🟩 ${t("tableView")}`} testId="table-view-toggle" />
          {isHost && inMatch && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <GameButton size="md" variant="dark" onClick={() => send({ type: state.paused ? "RESUME" : "PAUSE" })}>
                {state.paused ? t("resume") : t("pause")}
              </GameButton>
              <GameButton size="md" variant="red" onClick={() => send({ type: "END_MATCH" })} data-testid="end-match">
                {t("endMatch")}
              </GameButton>
            </div>
          )}
          <GameButton size="md" variant="ghost" className="mt-2" onClick={onLeave}>
            {t("leaveRoom")}
          </GameButton>
        </div>
      )}
      {tab === "history" && (
        <div className="pb-4">
          <HistoryList state={state} />
        </div>
      )}
      {tab === "dev" && devTools && <DevPanel state={state} me={me} send={send} />}
    </Sheet>
  );
}

/** Development-only controls. The server refuses these commands unless dev tools are enabled. */
export function DevPanel({ state, me, send }: { state: RoomState; me: string | null; send: (c: Command) => void }) {
  const [d1, setD1] = useState(3);
  const [d2, setD2] = useState(5);
  const [tiles, setTiles] = useState("1,2,4");
  const round = state.match?.round;
  const players = state.players.filter((p) => state.match?.playerIds.includes(p.id) ?? true);
  const [target, setTarget] = useState<string>(me ?? players[0]?.id ?? "");
  const dieSel = (v: number, set: (n: number) => void) => (
    <select value={v} onChange={(e) => set(Number(e.target.value))} className="rounded-lg bg-black/40 px-2 py-1">
      {[1, 2, 3, 4, 5, 6].map((x) => (
        <option key={x}>{x}</option>
      ))}
    </select>
  );
  return (
    <div className="grid gap-2 pb-4 text-sm" data-testid="dev-panel">
      <div className="flex items-center gap-2">
        <span className="font-bold">Force dice</span>
        {dieSel(d1, setD1)} {dieSel(d2, setD2)}
        <button type="button" className="rounded-lg bg-white/10 px-3 py-1 font-bold" onClick={() => send({ type: "DEV_FORCE_DICE", dice: [[d1, d2]] })} data-testid="dev-force">
          Queue
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold">Player</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1 rounded-lg bg-black/40 px-2 py-1">
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nickname} ({p.color})
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="rounded-lg bg-white/10 py-2 font-bold" disabled={!round} onClick={() => send({ type: "DEV_SET_TURN", playerId: target })}>
          Force turn
        </button>
        <button type="button" className="rounded-lg bg-white/10 py-2 font-bold" disabled={!round} onClick={() => send({ type: "DEV_BLOCK_PLAYER", playerId: target })}>
          Block player
        </button>
        <button type="button" className="rounded-lg bg-white/10 py-2 font-bold" disabled={!round} onClick={() => send({ type: "DEV_SHUT_BOARD", playerId: target })}>
          Shut board
        </button>
        <button type="button" className="rounded-lg bg-white/10 py-2 font-bold" onClick={() => send({ type: "DEV_NEXT_ROUND" })}>
          Next round
        </button>
        <button type="button" className="rounded-lg bg-white/10 py-2 font-bold" onClick={() => send({ type: "DEV_SIMULATE_DISCONNECT", playerId: target })}>
          Simulate disconnect
        </button>
        <button type="button" className="rounded-lg bg-white/10 py-2 font-bold" disabled={state.phase !== "ROOM_LOBBY"} onClick={() => send({ type: "DEV_ADD_FAKE_PLAYERS", count: 1 })}>
          Add fake player
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input value={tiles} onChange={(e) => setTiles(e.target.value)} className="flex-1 rounded-lg bg-black/40 px-2 py-1" />
        <button
          type="button"
          className="rounded-lg bg-white/10 px-3 py-1 font-bold"
          disabled={!round}
          onClick={() =>
            send({
              type: "DEV_SET_TILES",
              playerId: target,
              openTiles: tiles
                .split(",")
                .map((x) => Number(x.trim()))
                .filter((x) => x >= 1 && x <= 10),
            })
          }
        >
          Set open tiles
        </button>
      </div>
    </div>
  );
}
