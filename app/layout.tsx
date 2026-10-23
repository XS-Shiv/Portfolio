import "@fontsource/vt323/400.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { site } from "@/hero/content";
import { fontVariables, PAIRING, PAIRINGS } from "./fonts";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: site.title,
  description: site.description,
  openGraph: {
    title: site.title,
    description: site.description,
    images: [{ url: "/character/front.png", width: 1254, height: 1254 }],
  },
  twitter: { card: "summary_large_image", title: site.title, description: site.description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#D6D6D6",
};

/** ?font=geist (or plex, inter) previews another type pairing; set before first paint. */
const fontPreview = `try{var f=new URLSearchParams(location.search).get("font");if(${JSON.stringify(
  PAIRINGS,
)}.indexOf(f)>-1)document.documentElement.dataset.font=f}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables} data-font={PAIRING} suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          as="image"
          href="/character/front-blank.avif"
          type="image/avif"
          fetchPriority="high"
        />
        <script dangerouslySetInnerHTML={{ __html: fontPreview }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
