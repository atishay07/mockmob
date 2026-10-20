import { Bricolage_Grotesque, Gabarito, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./marketing-theme.css";
import "./brand-pip.css";
import "./brand.css";
import { Providers } from "@/components/Providers";
import { JsonLd } from "@/components/JsonLd";
import { globalJsonLd, seoMetadata, siteConfig } from "@/lib/seo";
import { BRAND_FLAGS } from "@/../data/brand_flags.mjs";

// The display face (data/brand_flags.mjs displayFont): Bricolage Grotesque, the app's display face, for
// headings, numbers and moments, set exactly as the owner approved it at Gate A (the variable weight axis,
// default optical size and width, so the pages' own weights and tracking hold). Gabarito stays declared for
// a rollback but is not preloaded, so it costs nothing while Bricolage is on. (next/font options must be
// literals: a rollback flips the flag and swaps the two preload values.)
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800", "900"],
  preload: false,
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

// Only the faces the first screen reads are preloaded: Bricolage (the headline, the page's largest paint) and
// Hanken (the hero's lead). Geist Mono sets small labels and figures; it loads from the stylesheet with swap,
// so it no longer competes with the headline face for a slow phone's first second.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  preload: false,
});

// The direction contract for this build. Kept as real markup so it survives
// the production build and can be audited against the rendered result.
const DIRECTION_CONTRACT = `<!--
IMPECCABLE DIRECTION CONTRACT
THESIS: Find the mistaken reasoning, practise the missing step and check it on fresh questions. Recovery stays unavailable until sources, independent calibration and the authenticated journey pass their gates. Ordinary practice remains the pre-release primary action.
OWN-WORLD: Retain Night Arena, volt green, Bricolage Grotesque display (the app's face), Hanken Grotesk text, Geist Mono measurement, logo B (Mobi as the second o) and the app's photo-real subject objects. The theme switch retains the optional daylight palette. Preserve the playable sample and current product identity.
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
      data-theme="light"
      data-display-font={BRAND_FLAGS.displayFont}
      suppressHydrationWarning
      className={`${bricolage.variable} ${gabarito.variable} ${hanken.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var d=document.documentElement,m=0;try{d.dataset.theme=localStorage.getItem('mm:theme:v1')==='dark'?'dark':'light'}catch(e){d.dataset.theme='light'}try{m=localStorage.getItem('mm:motion:v1')==='reduced'}catch(e){}try{m=m||matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}if(m)d.dataset.motion='reduced';try{var k=JSON.parse(localStorage.getItem('mm:den:shape:v1')||'null'),b=k&&k.blocks&&k.blocks[innerWidth>=640?'w':'n'];if(b)for(var i=0;i<b.length&&i<4;i++)d.style.setProperty('--den-skel-b'+i,Math.max(24,Math.min(900,Math.round(+b[i])||24))+'px');if(k&&k.switcher===true)d.dataset.denSwitch='1'}catch(e){}})()` }} />
        <JsonLd id="global-json-ld" data={globalJsonLd()} />
      </head>
      <body className="min-h-full flex flex-col">
        <div hidden data-impeccable-contract dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
