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

/** App icon: two tiles, one open (10) and one flipped, on green felt with a wooden rim. */
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size: key } = await ctx.params;
  const spec = SIZES[key] ?? SIZES["192"];
  const s = spec.size;
  const inner = s - spec.padding * 2;
  const u = inner / 100;
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: "flex", alignItems: "center", justifyContent: "center", background: "#07120d" }}>
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: spec.padding ? 0 : 22 * u,
            background: "linear-gradient(180deg, #b9804d, #8a5530 50%, #4f2c14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 82 * u,
              height: 82 * u,
              borderRadius: 16 * u,
              background: "radial-gradient(circle at 50% 30%, #1f7a50, #0f432c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6 * u,
            }}
          >
            <div
              style={{
                width: 30 * u,
                height: 46 * u,
                borderRadius: 6 * u,
                background: "linear-gradient(180deg, #ffdb6e, #f4b400)",
                color: "#2a1d00",
                fontSize: 26 * u,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 ${4 * u}px 0 #9c6b00`,
              }}
            >
              10
            </div>
            <div
              style={{
                width: 30 * u,
                height: 46 * u,
                borderRadius: 6 * u,
                background: "linear-gradient(180deg, #7aa5ff, #2f6fed)",
                color: "white",
                fontSize: 26 * u,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 ${4 * u}px 0 #173e94`,
              }}
            >
              S
            </div>
          </div>
        </div>
      </div>
    ),
    { width: s, height: s },
  );
}
