"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { COLORS, MIN_PLAYERS, type PlayerColor, type RoomPlayer } from "@/game-engine";
import type { AnyCommand } from "@/lib/client/games";
import type { RoomHandle } from "@/lib/client/use-room";
import { useI18n } from "@/lib/i18n/context";
import { Avatar, ConnectionDot } from "../game/player-badge";
import { ColorIcon, PLAYER_STYLE } from "../game/theme";
import { PreferenceToggles } from "../game/menu";
import { useErrorText, useToast } from "../ui/hooks";
import { GameButton, Sheet, Toast } from "../ui/primitives";
import { Wizard, type WizardStep } from "../ui/wizard";
import { GuideButton } from "../guide/guide";
import type { GuideGame } from "../guide/guides";
import { InvitePanel } from "./invite";

/** Seat positions around the table, matching the physical set. */
const SEAT_AREA: Record<PlayerColor, string> = { green: "top", red: "right", blue: "bottom", yellow: "left" };

function Seat({
  color,
  player,
  isHost,
  isMe,
  presence,
  onTap,
}: {
  color: PlayerColor;
  player: RoomPlayer | undefined;
  isHost: boolean;
  isMe: boolean;
  presence: boolean;
  onTap: () => void;
}) {
  const { t } = useI18n();
  const c = PLAYER_STYLE[color];
  // Top and bottom seats span the table: laid out in a row so the table stays short.
  const wide = SEAT_AREA[color] === "top" || SEAT_AREA[color] === "bottom";
  return (
    <motion.button
      type="button"
      layout
      onClick={onTap}
      data-testid={`seat-${color}`}
      data-occupied={player ? "yes" : "no"}
      whileTap={{ scale: 0.96 }}
      className={`flex min-h-0 w-full min-w-0 items-center justify-center rounded-2xl p-1.5 text-center ${wide ? "flex-row gap-2" : "flex-col gap-0.5"}`}
      style={{
        gridArea: SEAT_AREA[color],
        background: player ? `linear-gradient(180deg, ${c.base}cc, ${c.dark}ee)` : "rgba(0,0,0,.28)",
        border: player ? `2px solid ${c.light}` : `2px dashed ${c.base}88`,
        boxShadow: isMe ? `0 0 0 3px #ffcf4a, 0 0 18px ${c.glow}` : undefined,
      }}
    >
      {player ? (
        <>
          <div className="relative shrink-0">
            <Avatar player={player} size={wide ? 30 : 32} />
            {isHost && <span className="absolute -top-2 -end-2 text-sm">👑</span>}
          </div>
          <div className="flex min-w-0 max-w-full items-center gap-1 text-[13px] leading-tight font-extrabold" style={{ color: c.text }}>
            <span className="truncate">{player.nickname}</span>
            <ConnectionDot status={player.connection} presence={presence} />
          </div>
          <div className="flex shrink-0 flex-wrap justify-center gap-1 text-[9px] font-extrabold tracking-wider">
            {player.isBot && <span className="rounded bg-black/40 px-1 text-white">{t("bot")}</span>}
            <span className={`rounded px-1 ${player.isReady ? "bg-emerald-400 text-emerald-950" : "bg-black/40 text-white/80"}`} data-testid={`ready-${color}`}>
              {player.isReady ? t("ready") : t("notReady")}
            </span>
          </div>
        </>
      ) : (
        <>
          <ColorIcon color={color} size={20} />
          <div className="text-[11px] font-extrabold" style={{ color: c.light }}>
            {t(color)}
          </div>
          <div className="text-[10px] font-bold text-white/50">{t("openSlot")}</div>
        </>
      )}
    </motion.button>
  );
}

/** Shared lobby for every game; the game supplies its settings summary, editor steps and dev tools. Always fits one screen. */
export function LobbyView({
  room,
  summary,
  editorSteps,
  devPanel,
  title,
  guide,
}: {
  room: RoomHandle;
  summary: ReactNode;
  editorSteps: (draft: Record<string, unknown>, setDraft: (d: Record<string, unknown>) => void) => WizardStep[];
  devPanel?: ReactNode;
  title?: string;
  guide?: GuideGame;
}) {
  const { t, n } = useI18n();
  const router = useRouter();
  const state = room.state!;
  const me = room.me;
  const isHost = state.hostId === me;
  const toast = useToast();
  const errText = useErrorText();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [seatMenu, setSeatMenu] = useState<RoomPlayer | null>(null);
  const [menu, setMenu] = useState(false);
  const [starting, setStarting] = useState(false);

  const players = state.players.filter((p) => p.connection !== "left");
  const mine = players.find((p) => p.id === me);
  const allReady = players.length >= MIN_PLAYERS && players.every((p) => p.isReady);

  const send = async (c: AnyCommand) => {
    const res = await room.send(c);
    if (!res.ok) toast.show(errText(res.error));
    return res;
  };

  const tapSeat = (color: PlayerColor) => {
    const occupant = players.find((p) => p.color === color);
    if (!occupant) {
      if (mine) void send({ type: "UPDATE_PROFILE", color });
      return;
    }
    if (isHost && occupant.id !== me) setSeatMenu(occupant);
  };

  const start = async () => {
    setStarting(true);
    await send({ type: "START" });
    setStarting(false);
  };

  const leave = async () => {
    await room.send({ type: "LEAVE" });
    router.push("/");
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await send({ type: "UPDATE_SETTINGS", settings: editing } as AnyCommand);
    setSaving(false);
    if (res.ok) setEditing(null);
  };

  // The host is ready by default; only show their button if they un-readied.
  const showReady = mine && (!isHost || !mine.isReady);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[520px] flex-col gap-2.5 overflow-hidden px-4 safe-top safe-bottom" data-testid="lobby">
      <Toast message={toast.message} />
      <header className="flex shrink-0 items-center justify-between pt-1">
        <button type="button" onClick={leave} className="glass rounded-xl px-3 py-2 text-sm font-bold">
          ← {t("leaveRoom")}
        </button>
        <span className="truncate px-2 text-sm font-extrabold tracking-[0.25em] text-white/70" data-testid="lobby-title">
          {title ?? t("lobby")}
        </span>
        <div className="flex shrink-0 gap-1.5">
          {guide && <GuideButton game={guide} />}
          <button type="button" onClick={() => setMenu(true)} className="glass h-10 w-10 shrink-0 rounded-xl" aria-label={t("settings")}>
            ☰
          </button>
        </div>
      </header>

      <InvitePanel code={state.code} />

      {/* Four-sided table: takes the height that is left, capped so tall phones don't get giant empty seats */}
      <div className="flex min-h-[170px] flex-1 flex-col justify-center">
      <div className="wood flex h-full max-h-[340px] min-h-0 rounded-[26px] p-2">
        <div
          className="felt grid min-h-0 w-full flex-1 gap-1.5 rounded-[20px] p-2"
          style={{ gridTemplateAreas: `"top top top" "left center right" "bottom bottom bottom"`, gridTemplateColumns: "1fr 0.9fr 1fr", gridTemplateRows: "minmax(0,0.8fr) minmax(0,1.2fr) minmax(0,0.8fr)" }}
        >
          {COLORS.map((c) => {
            const p = players.find((x) => x.color === c);
            return <Seat key={c} color={c} player={p} isHost={!!p && p.id === state.hostId} isMe={!!p && p.id === me} presence={!!p && room.presence.has(p.id)} onTap={() => tapSeat(c)} />;
          })}
          <div style={{ gridArea: "center" }} className="flex min-h-0 flex-col items-center justify-center rounded-2xl bg-black/25 text-center">
            <div className="px-1 text-base leading-tight font-extrabold" data-testid="player-count">
              {t("playersCount", { n: players.length, max: state.settings.maxPlayers })}
            </div>
            {state.spectatorCount > 0 && <div className="text-[10px] text-white/60">{t("spectatorsWatching", { n: state.spectatorCount })}</div>}
          </div>
        </div>
      </div>
      </div>

      <div className="shrink-0">{summary}</div>
      {isHost && (
        <div className="flex shrink-0 justify-center gap-2">
          <GameButton size="sm" variant="ghost" onClick={() => setEditing({ ...state.settings } as Record<string, unknown>)} data-testid="edit-settings">
            ⚙ {t("editSettings")}
          </GameButton>
          {players.length < state.settings.maxPlayers && (
            <GameButton size="sm" variant="ghost" onClick={() => send({ type: "ADD_BOT", level: "normal" })} data-testid="add-bot">
              🤖 {t("addBot")}
            </GameButton>
          )}
        </div>
      )}

      <div className="grid shrink-0 gap-2 pb-2">
        {showReady && (
          <GameButton
            size={isHost ? "md" : "lg"}
            variant={mine.isReady ? "dark" : "green"}
            onClick={() => send({ type: "SET_READY", ready: !mine.isReady })}
            data-testid="ready-button"
            data-ready={mine.isReady ? "yes" : "no"}
          >
            {mine.isReady ? t("cancelReady") : t("imReady")}
          </GameButton>
        )}
        {isHost ? (
          <>
            <GameButton onClick={start} disabled={!allReady || starting} data-testid="start-game">
              {t("startGame")}
            </GameButton>
            {!allReady && (
              <div className="text-center text-xs font-bold text-white/60">{players.length < MIN_PLAYERS ? t("needMorePlayers") : t("waitingForReady")}</div>
            )}
          </>
        ) : (
          <div className="text-center text-sm font-bold text-white/60">{t("waitingForHost")}</div>
        )}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={t("editSettings")}>
        {editing && (
          <div className="flex h-[min(600px,82dvh)] min-h-0 flex-col pb-3">
            <Wizard steps={editorSteps(editing, setEditing)} finishLabel={t("save")} onFinish={save} busy={saving} testId="editor" />
          </div>
        )}
      </Sheet>

      <Sheet open={!!seatMenu} onClose={() => setSeatMenu(null)} title={seatMenu?.nickname}>
        {seatMenu && (
          <div className="grid gap-2 pb-6">
            {!seatMenu.isBot && (
              <GameButton size="md" variant="blue" onClick={() => send({ type: "TRANSFER_HOST", playerId: seatMenu.id }).then(() => setSeatMenu(null))}>
                👑 {t("makeHost")}
              </GameButton>
            )}
            <GameButton size="md" variant="dark" onClick={() => send({ type: "KICK", playerId: seatMenu.id }).then(() => setSeatMenu(null))} data-testid="kick">
              {t("kick")}
            </GameButton>
            {!seatMenu.isBot && (
              <GameButton size="md" variant="red" onClick={() => send({ type: "KICK", playerId: seatMenu.id, ban: true }).then(() => setSeatMenu(null))}>
                {t("ban")}
              </GameButton>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={menu} onClose={() => setMenu(false)} title={t("settings")}>
        <div className="grid gap-3 pb-6">
          <PreferenceToggles />
          {room.config?.devTools && devPanel}
          <div className="text-center text-xs text-white/40">
            {state.code} · v{n(state.version)}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
