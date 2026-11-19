import localFont from "next/font/local";
import "./globals.css";
import "./marketing-theme.css";
import "./brand-pip.css";
import "./brand.css";
import "./app-view.css";
import { Providers } from "@/components/Providers";
import { JsonLd } from "@/components/JsonLd";
import RouteProgress from "@/components/progress/RouteProgress";
import { globalJsonLd, seoMetadata, siteConfig } from "@/lib/seo";
import { BRAND_FLAGS } from "@/../data/brand_flags.mjs";

// The display face (data/brand_flags.mjs displayFont): Bricolage Grotesque, the app's display face, for
// headings, numbers and moments, set exactly as the owner approved it at Gate A (the variable weight axis,
// default optical size and width, so the pages' own weights and tracking hold). Gabarito stays declared for
// a rollback but is not preloaded, so it costs nothing while Bricolage is on. (next/font options must be
// literals: a rollback flips the flag and swaps the two preload values.) All three text faces are
// self-hosted (the Fontsource variable latin wght files, v5.3.0, OFL, licences beside them in
// src/app/fonts/), so a build never fetches Google Fonts.
const bricolage = localFont({
  src: "./fonts/BricolageGrotesque-Variable.woff2",
  variable: "--font-bricolage",
  display: "swap",
  weight: "200 800",
  preload: true,
});

const gabarito = localFont({
  src: "./fonts/Gabarito-Variable.woff2",
  variable: "--font-gabarito",
  display: "swap",
  weight: "400 900",
  preload: false,
});

const hanken = localFont({
  src: "./fonts/HankenGrotesk-Variable.woff2",
  variable: "--font-hanken",
  display: "swap",
  weight: "100 900",
});

// Only the faces the first screen reads are preloaded: Bricolage (the headline, the page's largest paint) and
// Hanken (the hero's lead). Geist Mono sets small labels and figures; it loads from the stylesheet with swap,
// so it no longer competes with the headline face for a slow phone's first second. It is self-hosted (the
// variable face from geist@1.8.1, OFL, src/app/fonts/GeistMono-OFL.txt), so a build never fetches it from
// Google: 2 of 4 production builds failed on that fetch on 2 Nov 2026.
// Literata (the home page's question voice) is declared in src/components/landing/HomeFonts.jsx, not here, so it is preloaded
// on "/" only and costs every other route nothing.
const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
  preload: false,
});

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
  themeColor: "#F3EFE6",
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
        {/* A weak machine (owner LK353, 20 Nov 2026: "it should easily work on even a cheap Rs 15,000 Chromebook"). Before the first
            paint, from the machine's own figures (where the browser tells its memory: 4 GB or less, or four processor threads or
            fewer; where it does not: two threads or fewer; or Data Saver), <html> gets data-lite. Pages then drop what costs a weak processor a frame and adds nothing a reader
            needs: blur behind glass, the pointer's wide light, lean and tilt, scroll drift, Mobi's eye-follow. Nothing is removed
            from the page. localStorage mm:lite:v1 = "1" or "0" forces it either way (tests, and a student's own switch later). */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var d=document.documentElement,n=navigator,c=n.hardwareConcurrency||8,g=n.deviceMemory||8,s=false,f=null;try{s=!!(n.connection&&n.connection.saveData)}catch(e){}try{f=localStorage.getItem('mm:lite:v1')}catch(e){}if(f==='1'||(f!=='0'&&(s||(n.deviceMemory?(g<=4||c<=4):c<=2))))d.dataset.lite='1'})()` }} />
        {/* App view (src/app/app-view.css): a page opened from the Android app (?from=app) hides its ways to buy, for this tab only
            (sessionStorage, never a cookie: Custom Tabs share Chrome's cookies). Runs before paint, like the theme script. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var d=document.documentElement,on=false;try{on=new URLSearchParams(location.search).get('from')==='app'}catch(e){}try{if(on)sessionStorage.setItem('mm:appView','1');else on=sessionStorage.getItem('mm:appView')==='1'}catch(e){}if(on)d.dataset.appView='1'})()` }} />
        <JsonLd id="global-json-ld" data={globalJsonLd()} />
      </head>
      <body className="min-h-full flex flex-col">
        <RouteProgress />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
