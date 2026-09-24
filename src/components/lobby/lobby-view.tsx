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
  return (
    <motion.button
      type="button"
      layout
      onClick={onTap}
      data-testid={`seat-${color}`}
      data-occupied={player ? "yes" : "no"}
      whileTap={{ scale: 0.96 }}
      className="flex w-full flex-col items-center gap-1 rounded-2xl p-2 text-center"
      style={{
        gridArea: SEAT_AREA[color],
        background: player ? `linear-gradient(180deg, ${c.base}cc, ${c.dark}ee)` : "rgba(0,0,0,.28)",
        border: player ? `2px solid ${c.light}` : `2px dashed ${c.base}88`,
        boxShadow: isMe ? `0 0 0 3px #ffcf4a, 0 0 18px ${c.glow}` : undefined,
      }}
    >
      {player ? (
        <>
          <Avatar player={player} size={38} />
          <div className="flex max-w-full items-center gap-1 text-sm leading-tight font-extrabold" style={{ color: c.text }}>
            <span className="truncate">{player.nickname}</span>
            <ConnectionDot status={player.connection} presence={presence} />
          </div>
          <div className="flex flex-wrap justify-center gap-1 text-[9px] font-extrabold tracking-wider">
            {isHost && <span className="rounded bg-[#ffcf4a] px-1 text-[#2a1a00]">👑 {t("host")}</span>}
            {player.isBot && <span className="rounded bg-black/40 px-1 text-white">{t("bot")}</span>}
            <span className={`rounded px-1 ${player.isReady ? "bg-emerald-400 text-emerald-950" : "bg-black/40 text-white/80"}`} data-testid={`ready-${color}`}>
              {player.isReady ? t("ready") : t("notReady")}
            </span>
          </div>
        </>
      ) : (
        <>
          <ColorIcon color={color} size={22} />
          <div className="text-xs font-extrabold" style={{ color: c.light }}>
            {t(color)}
          </div>
          <div className="text-[10px] font-bold text-white/50">{t("openSlot")}</div>
        </>
      )}
    </motion.button>
  );
}

/** Shared lobby for every game; the game supplies its settings summary, editor and dev tools. */
export function LobbyView({
  room,
  summary,
  renderEditor,
  devPanel,
  title,
}: {
  room: RoomHandle;
  summary: ReactNode;
  renderEditor: (draft: Record<string, unknown>, setDraft: (d: Record<string, unknown>) => void) => ReactNode;
  devPanel?: ReactNode;
  title?: string;
}) {
  const { t, n } = useI18n();
  const router = useRouter();
  const state = room.state!;
  const me = room.me;
  const isHost = state.hostId === me;
  const toast = useToast();
  const errText = useErrorText();
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col gap-4 px-4 safe-top safe-bottom" data-testid="lobby">
      <Toast message={toast.message} />
      <header className="flex items-center justify-between">
        <button type="button" onClick={leave} className="glass rounded-xl px-3 py-2 text-sm font-bold">
          ← {t("leaveRoom")}
        </button>
        <span className="text-sm font-extrabold tracking-[0.25em] text-white/70" data-testid="lobby-title">{title ?? t("lobby")}</span>
        <button type="button" onClick={() => setMenu(true)} className="glass h-10 w-10 rounded-xl" aria-label={t("settings")}>
          ☰
        </button>
      </header>

      <InvitePanel code={state.code} />

      {/* Four-sided table */}
      <div className="wood rounded-[28px] p-2.5">
        <div
          className="felt grid gap-2 rounded-[20px] p-2.5"
          style={{ gridTemplateAreas: `". top ." "left center right" ". bottom ."`, gridTemplateColumns: "1fr 1.1fr 1fr" }}
        >
          {COLORS.map((c) => {
            const p = players.find((x) => x.color === c);
            return <Seat key={c} color={c} player={p} isHost={!!p && p.id === state.hostId} isMe={!!p && p.id === me} presence={!!p && room.presence.has(p.id)} onTap={() => tapSeat(c)} />;
          })}
          <div style={{ gridArea: "center" }} className="flex flex-col items-center justify-center rounded-2xl bg-black/25 text-center">
            <div className="text-2xl font-extrabold" data-testid="player-count">
              {t("playersCount", { n: players.length, max: state.settings.maxPlayers })}
            </div>
            {state.spectatorCount > 0 && <div className="text-[10px] text-white/60">{t("spectatorsWatching", { n: state.spectatorCount })}</div>}
          </div>
        </div>
      </div>

      {summary}
      {isHost && (
        <div className="flex justify-center gap-2">
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

      <div className="mt-auto grid gap-3 pb-2">
        {mine && (
          <GameButton
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
          <div className="grid min-w-0 grid-cols-1 gap-4 pb-6">
            {renderEditor(editing, setEditing)}
            <div className="grid grid-cols-2 gap-2">
              <GameButton size="md" variant="dark" onClick={() => setEditing(null)}>
                {t("cancel")}
              </GameButton>
              <GameButton
                size="md"
                variant="green"
                onClick={async () => {
                  const res = await send({ type: "UPDATE_SETTINGS", settings: editing } as AnyCommand);
                  if (res.ok) setEditing(null);
                }}
              >
                {t("save")}
              </GameButton>
            </div>
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
