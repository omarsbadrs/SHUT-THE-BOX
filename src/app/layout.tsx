import type { Metadata, Viewport } from "next";
import { Aref_Ruqaa, Baloo_Bhaijaan_2, Caveat_Brush, Reem_Kufi } from "next/font/google";
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

// Chalk handwriting for Hangman: Latin brush + Arabic Ruqaa fallback.
const chalkLatin = Caveat_Brush({ subsets: ["latin"], weight: "400", variable: "--font-chalk-latin", display: "swap" });
const chalkArabic = Aref_Ruqaa({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-chalk-arabic", display: "swap" });
// Kufic display face for Guess Who's Egyptian look (Latin + Arabic).
const kufi = Reem_Kufi({ subsets: ["latin", "arabic"], weight: ["500", "700"], variable: "--font-kufi", display: "swap" });

export const metadata: Metadata = {
  title: "Games HUB",
  description: "Party games for your phones: Shut the Box, Hangman and Guess Who? (Egyptian edition).",
  applicationName: "Games HUB",
  authors: [{ name: "Omar Badr", url: "https://omar-badr.digital/" }],
  creator: "Omar Badr",
  appleWebApp: { capable: true, title: "Games HUB", statusBarStyle: "black-translucent" },
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
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className={`${baloo.variable} ${chalkLatin.variable} ${chalkArabic.variable} ${kufi.variable}`}>
      <body className="antialiased">
        <I18nProvider initialLang={lang}>{children}</I18nProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
