"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { GameButton, TextInput } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/client/api";
import type { AdminOverview } from "@/lib/server/store/types";

interface OverviewResponse {
  overview: AdminOverview;
  config: { store: string; upstash: boolean; environment: string };
}

/** Protected admin panel (ADMIN_PASSWORD). Shows no session tokens or guest ids. */
export default function AdminPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await apiFetch<OverviewResponse>("/api/admin/overview");
    if (r.ok) {
      setData(r);
      setNeedsLogin(false);
    } else if (r.error.code === "FORBIDDEN") setNeedsLogin(true);
    else setError(r.error.code);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const login = async () => {
    const r = await apiFetch("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
    if (r.ok) void load();
    else setError(r.error.code === "NOT_CONFIGURED" ? "ADMIN_PASSWORD is not set" : "Wrong password");
  };

  const closeRoom = async (code: string) => {
    if (!confirm(`Close room ${code}?`)) return;
    await apiFetch(`/api/admin/rooms/${code}`, { method: "POST", body: JSON.stringify({ action: "close" }) });
    void load();
  };

  if (needsLogin)
    return (
      <PageShell title="Admin">
        <div className="grid gap-3">
          <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          <GameButton onClick={login}>Sign in</GameButton>
          {error && <div className="text-center text-sm text-[#ff8a82]">{error}</div>}
        </div>
      </PageShell>
    );

  if (!data) return <PageShell title="Admin">{error ? <div className="text-[#ff8a82]">{error}</div> : <div className="text-white/50">Loading…</div>}</PageShell>;

  const { overview, config } = data;
  const s = overview.stats;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold">SHUT10 Admin</h1>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
          store: {config.store} · redis: {config.upstash ? "on" : "off"} · env: {config.environment}
        </span>
        <button type="button" onClick={load} className="ms-auto rounded-xl bg-white/10 px-3 py-1.5 text-sm font-bold">
          ↻ Refresh
        </button>
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Rooms created", s.roomsCreated],
          ["Matches started", s.matchesStarted],
          ["Completion rate", pct(s.completionRate)],
          ["Rematch rate", pct(s.rematchRate)],
          ["Perfect boxes", s.perfectBoxes],
          ["Avg room size", Number(s.averageRoomSize).toFixed(2)],
          ["Avg rounds", Number(s.averageRounds).toFixed(2)],
          ["Avg round score", Number(s.averageScore).toFixed(1)],
          ["Matches done", s.matchesCompleted],
          ["Rematches", s.rematches],
        ].map(([k, v]) => (
          <div key={String(k)} className="glass rounded-2xl p-3">
            <div className="text-xs font-bold text-white/50">{k}</div>
            <div className="text-2xl font-extrabold tabular-nums">{v}</div>
          </div>
        ))}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-extrabold">Active rooms ({overview.activeRooms.length})</h2>
        <div className="overflow-x-auto rounded-2xl bg-black/25">
          <table className="w-full text-sm">
            <thead className="text-start text-white/50">
              <tr>
                {["Code", "Phase", "Mode", "Players", "Version", "Updated", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-start">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overview.activeRooms.map((r) => (
                <tr key={r.roomId} className="border-t border-white/5">
                  <td className="px-3 py-2 font-extrabold tracking-widest">{r.code}</td>
                  <td className="px-3 py-2">{r.phase}</td>
                  <td className="px-3 py-2">{r.mode}</td>
                  <td className="px-3 py-2">{r.players}</td>
                  <td className="px-3 py-2 tabular-nums">{r.version}</td>
                  <td className="px-3 py-2 text-white/60">{new Date(r.updatedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => closeRoom(r.code)} className="rounded-lg bg-[#7d1714] px-2 py-1 text-xs font-bold">
                      Close
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-extrabold">Finished matches</h2>
        <div className="grid gap-1.5">
          {overview.finishedMatches.map((m) => (
            <a key={m.matchId} href={`/results/${m.matchId}`} className="flex gap-3 rounded-xl bg-white/5 px-3 py-2 text-sm">
              <span className="font-extrabold tracking-widest">{m.code}</span>
              <span>🏆 {m.winner}</span>
              <span className="text-white/60">{m.rounds} rounds</span>
              <span className="ms-auto text-white/50">{new Date(m.endedAt).toLocaleString()}</span>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-extrabold">Error events</h2>
        <div className="grid gap-1.5">
          {overview.errors.length === 0 && <div className="text-sm text-white/50">No errors 🎉</div>}
          {overview.errors.map((e, i) => (
            <div key={i} className="rounded-xl bg-[#7d1714]/30 px-3 py-2 font-mono text-xs">
              <span className="font-bold">[{e.source}]</span> {e.message} <span className="text-white/50">{new Date(e.at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
