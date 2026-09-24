import type { Metadata, Viewport } from "next";
import { Baloo_Bhaijaan_2 } from "next/font/google";
import { cookies } from "next/headers";
import { ServiceWorker } from "@/components/service-worker";
import { I18nProvider } from "@/lib/i18n/context";
import { LANG_COOKIE, type Lang } from "@/lib/i18n/dictionaries";
import "./globals.css";

const baloo = Baloo_Bhaijaan_2({
  subsets: ["latin", "arabic"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SHUT10 — Roll. Think. Shut.",
  description: "A multiplayer Shut the Box party game for 2–4 phones.",
  applicationName: "SHUT10",
  appleWebApp: { capable: true, title: "SHUT10", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/192", apple: "/icons/180" },
};

export const viewport: Viewport = {
  themeColor: "#07120d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang: Lang = (await cookies()).get(LANG_COOKIE)?.value === "ar" ? "ar" : "en";
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className={baloo.variable}>
      <body className="antialiased">
        <I18nProvider initialLang={lang}>{children}</I18nProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
