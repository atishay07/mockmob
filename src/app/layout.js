import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "@/../shared/tokens.css";
import "./globals.css";
import "@/components/ui/ui.css";
import "./marketing-theme.css";
import "./brand-pip.css";
import { Providers } from "@/components/Providers";
import { JsonLd } from "@/components/JsonLd";
import { globalJsonLd, seoMetadata, siteConfig } from "@/lib/seo";
import AssistantLauncherGate from "@/components/ai/AssistantLauncherGate";
import { ThemeSync } from "@/components/ui/ThemeSync";
import { VISITOR_BOOT_SCRIPT } from "@/../data/visitor_state.mjs";
import { THEME_BOOT_SCRIPT, THEME_COLOR } from "@/../shared/theme.mjs";
import "./visitor.css";

// Brand type (owner D5, the app's Night Sheet): Bricolage Grotesque for display and numbers,
// Hanken Grotesk for everything a student reads. Bricolage loads as a variable font with its
// width (wdth 75 to 100) and optical size (opsz 12 to 96) axes, so condensed numerals are
// `font-stretch: 75%` and large headings get the display cut on their own. Gabarito and Geist
// Mono are retired; --font-mono resolves to Hanken (see globals.css).
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "wdth"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

// The direction contract for this build. Kept as real markup so it survives
// the production build and can be audited against the rendered result.
const DIRECTION_CONTRACT = `<!--
IMPECCABLE DIRECTION CONTRACT
THESIS: Find the mistaken reasoning, practise the missing step and check it on fresh questions. Recovery stays unavailable until sources, independent calibration and the authenticated journey pass their gates. Ordinary practice remains the pre-release primary action.
OWN-WORLD: Night Sheet tokens from shared/tokens.json (warm charcoal, warm paper, volt as the one accent), Bricolage Grotesque display and numbers, Hanken Grotesk text. Night is the default for the signed-in product; Light stays an option and a saved choice wins. Glass on chrome only.
STORY: Promise, playable example, connected recovery demonstration, actual coverage and evidence, price, FAQ. CUET UG 2027: English, Accountancy, Business Studies and Economics. Illustrative outcomes never become observed student gains.
FIRST VIEWPORT (320px): clear promise and Start free practice before release. After release, Find my first gap starts an available functional baseline. No unavailable feature is advertised as live.
FORM: The owner's approved roadmap of 2026-10-02 supersedes the earlier paper-only pilot direction. Keep existing purchased tools accessible.
FINISH: Record actual source changes, tests, exercised browser flows and unresolved content/deployment gates in docs/brain/STATUS.md. A compiled build is not a complete recovery release.
-->`;

export const metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  ...seoMetadata({
    title: "CUET Mock Tests & Practice Questions | MockMob",
    description: siteConfig.description,
    path: "/",
  }),
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The boot script keeps this in step with the theme it picks.
  themeColor: THEME_COLOR.light,
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${bricolage.variable} ${hanken.variable} h-full antialiased`}
    >
      <head>
        {/* Theme and glass before first paint: a saved choice wins, the product opens in Night. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: VISITOR_BOOT_SCRIPT }} />
        <JsonLd id="global-json-ld" data={globalJsonLd()} />
      </head>
      <body className="min-h-full flex flex-col">
        <div hidden data-impeccable-contract dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        <ThemeSync />
        <Providers>
          {children}
          <AssistantLauncherGate />
        </Providers>
      </body>
    </html>
  );
}
