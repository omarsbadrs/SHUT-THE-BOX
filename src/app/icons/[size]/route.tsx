import { ImageResponse } from "next/og";

const SIZES: Record<string, { size: number; padding: number }> = {
  "180": { size: 180, padding: 0 },
  "192": { size: 192, padding: 0 },
  "512": { size: 512, padding: 0 },
  maskable: { size: 512, padding: 72 },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

/**
 * Games HUB icon: a gilded frame holding one tile per game —
 * a die (Shut the Box), chalk letters (Hangman), the Eye of Horus (Guess Who)
 * and a "10" tile.
 */
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: key } = await ctx.params;
  const spec = SIZES[key] ?? SIZES["192"];
  const s = spec.size;
  const inner = s - spec.padding * 2;
  const u = inner / 100;
  const tile = (children: React.ReactNode, background: string, shadow: string) => (
    <div
      style={{
        width: 36 * u,
        height: 36 * u,
        borderRadius: 8 * u,
        background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 ${2.4 * u}px 0 ${shadow}`,
      }}
    >
      {children}
    </div>
  );
  const pip = (x: number, y: number) => <circle key={`${x}-${y}`} cx={x} cy={y} r={3.2} fill="#ffffff" />;
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: "flex", alignItems: "center", justifyContent: "center", background: "#07120d" }}>
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: spec.padding ? 0 : 22 * u,
            background: "linear-gradient(135deg, #fff1b0 0%, #e6b33a 30%, #9c6b12 55%, #f4cf62 80%, #8a5a0c 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 88 * u,
              height: 88 * u,
              borderRadius: 17 * u,
              background: "radial-gradient(circle at 50% 25%, #1d4a33, #07120d)",
              display: "flex",
              flexWrap: "wrap",
              alignContent: "center",
              justifyContent: "center",
              gap: 5 * u,
            }}
          >
            {tile(
              <svg width={26 * u} height={26 * u} viewBox="0 0 30 30">
                {pip(8, 8)}
                {pip(15, 15)}
                {pip(22, 22)}
              </svg>,
              "linear-gradient(180deg, #ff8e85, #e0413b 60%, #c32f2a)",
              "#7d1714",
            )}
            {tile(
              <svg width={28 * u} height={28 * u} viewBox="0 0 30 30" fill="none" stroke="#f2efe6" strokeWidth={2.4} strokeLinecap="round">
                <path d="M6 22 L11 7 L16 22 M8 17 H14" />
                <path d="M19 23 H26" />
              </svg>,
              "linear-gradient(180deg, #2b3a33, #1f2b26)",
              "#0c120f",
            )}
            {tile(
              <svg width={30 * u} height={20 * u} viewBox="0 0 64 40" fill="none" stroke="#f2c14e" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14C14 4 38 2 58 12" />
                <path d="M10 22c10-10 30-10 40 0-10 8-30 8-40 0z" />
                <circle cx="30" cy="21" r="5" fill="#f2c14e" />
                <path d="M26 28l-4 10" />
                <path d="M34 29c2 6 8 9 14 7" />
              </svg>,
              "linear-gradient(180deg, #2a4fa8, #1a347a 60%, #0e1f4d)",
              "#08143a",
            )}
            {tile(
              <div style={{ display: "flex", fontSize: 19 * u, fontWeight: 900, color: "#2a1d00", letterSpacing: -0.5 * u }}>10</div>,
              "linear-gradient(180deg, #ffe07a, #ffc21f 55%, #f0a400)",
              "#9a6400",
            )}
          </div>
        </div>
      </div>
    ),
    { width: s, height: s },
  );
}
