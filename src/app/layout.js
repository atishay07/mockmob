import { Gabarito, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./marketing-theme.css";
import "./brand-pip.css";
import { Providers } from "@/components/Providers";
import { JsonLd } from "@/components/JsonLd";
import { globalJsonLd, seoMetadata, siteConfig } from "@/lib/seo";
import AssistantLauncherGate from "@/components/ai/AssistantLauncherGate";

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800", "900"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

// The direction contract for this build. Kept as real markup so it survives
// the production build and can be audited against the rendered result.
const DIRECTION_CONTRACT = `<!--
IMPECCABLE DIRECTION CONTRACT
THESIS: Find the mistaken reasoning, practise the missing step and check it on fresh questions. Recovery stays unavailable until sources, independent calibration and the authenticated journey pass their gates. Ordinary practice remains the pre-release primary action.
OWN-WORLD: Retain Night Arena, volt green, Gabarito display, Hanken Grotesk text and Geist Mono measurement. The theme switch retains the optional daylight palette. Preserve the playable sample and current product identity.
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
  themeColor: "#F4F5F0",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${gabarito.variable} ${hanken.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{document.documentElement.dataset.theme=localStorage.getItem('mm:theme:v1')==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}})()` }} />
        <JsonLd id="global-json-ld" data={globalJsonLd()} />
      </head>
      <body className="min-h-full flex flex-col">
        <div hidden data-impeccable-contract dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        <Providers>
          {children}
          <AssistantLauncherGate />
        </Providers>
      </body>
    </html>
  );
}
