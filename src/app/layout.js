import { Bricolage_Grotesque, Gabarito, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./marketing-theme.css";
import "./brand-pip.css";
import { Providers } from "@/components/Providers";
import { JsonLd } from "@/components/JsonLd";
import { globalJsonLd, seoMetadata, siteConfig } from "@/lib/seo";
import { brandFlags } from "@/../data/brand_flags.mjs";

const gabarito = Gabarito({
  variable: "--font-gabarito",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800", "900"],
});

// The app's display face (D5), behind data/brand_flags.mjs displayFont. Not preloaded while the
// flag is off, so it costs nothing until it is used.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  preload: false,
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F5F0" },
    { media: "(prefers-color-scheme: dark)", color: "#0B100E" },
  ],
};

// Runs before first paint (web IA plan 7, 2.1):
// - Theme. A saved choice always wins (Night, Daylight, or Match device). With no saved choice the
//   signed-in product starts in Night (D5) and public pages follow the device on the first visit.
// - Motion. The student's Reduce motion switch, or the device setting.
// - Visitor. <html data-visitor="new|returning|member"> (plus data-plan and data-started for a
//   member) from the stored hint (src/lib/navigation.js VISITOR_KEY), so the public header and the
//   shell paint the right variant without a flash. The hint holds no personal data.
// Keep the signed-in path list in step with src/app/(app) and /onboarding.
const FIRST_PAINT = `(function(){var d=document.documentElement,t=null,s=null,o=null,m=0,h=null,k='new';
try{s=localStorage.getItem('mm:theme:v1');o=localStorage.getItem('mm:theme-mode:v1')}catch(e){}
if(o!=='system'&&(s==='dark'||s==='light'))t=s;
else if(o!=='system'&&/^\\/(today|dashboard|practice|start|review|you|ask|analytics|saved|mentor|explore|learn|study|progress|profile|admission-compass|leaderboard|rival|upload|my-uploads|moderation|result|test|recovery|onboarding|preview\\/arena)(\\/|$)/.test(location.pathname))t='dark';
else{try{t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){t='light'}}
d.dataset.theme=t;
try{m=localStorage.getItem('mm:motion:v1')==='reduced'}catch(e){}try{m=m||matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}if(m)d.dataset.motion='reduced';
try{h=JSON.parse(localStorage.getItem('mm:visitor:v1')||'null')}catch(e){}
if(h&&h.kind==='member')k='member';else if(h&&h.kind==='returning')k='returning';d.dataset.visitor=k;
if(k==='member'){d.dataset.plan=h.plan==='pro'?'pro':'free';if(h.started===true)d.dataset.started='yes';else if(h.started===false)d.dataset.started='no'}})()`;

export default function RootLayout({ children }) {
  const flags = brandFlags();
  // Display font switch: every font-display rule reads --font-gabarito, so pointing it at Bricolage
  // changes the face everywhere at once (and back) without touching a page.
  const displayStyle = flags.displayFont === "bricolage" ? { "--font-gabarito": "var(--font-bricolage)" } : undefined;
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${gabarito.variable} ${bricolage.variable} ${hanken.variable} ${geistMono.variable} h-full antialiased`}
      style={displayStyle}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: FIRST_PAINT }} />
        <JsonLd id="global-json-ld" data={globalJsonLd()} />
      </head>
      <body className="min-h-full flex flex-col">
        <div hidden data-impeccable-contract dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        {/* The floating assistant launcher is gone (plan 2.1): Ask Mobi lives in Review. */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
