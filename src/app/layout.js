import { Space_Grotesk, Inter, Lexend } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { JsonLd } from "@/components/JsonLd";
import { globalJsonLd, seoMetadata, siteConfig } from "@/lib/seo";
import AssistantLauncher from "@/components/ai/AssistantLauncher";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  display: "swap",
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

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${lexend.variable} h-full antialiased`}
    >
      <head>
        <JsonLd id="global-json-ld" data={globalJsonLd()} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          {children}
          <AssistantLauncher />
        </Providers>
      </body>
    </html>
  );
}
