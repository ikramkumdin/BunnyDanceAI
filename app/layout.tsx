import type { Metadata, Viewport } from "next";
import "./globals.css";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "WaifuDance AI - AI Dance Video Generator for Twerk & Anime Waifu Animations",
  description: "Upload a photo (real or anime) to WaifuDance AI and generate short sensual dance videos instantly—twerking, hip shakes, pole dances & more. Perfect for TikTok creators, OnlyFans content, or private waifu collections. Free trial now!",
  keywords: ["AI dance video generator", "twerk AI animator", "anime waifu dance", "OnlyFans content creator", "TikTok viral videos", "sensual photo animation", "hip shake AI", "pole dance generator"],
  robots: "index, follow",
  openGraph: {
    title: "WaifuDance AI: Create Sensual Dance Videos from Photos",
    description: "AI tool for twerking, hip shaking & waifu animations. Ideal for creators and collectors.",
    url: "https://www.waifudance.com/",
    siteName: "WaifuDance AI",
    images: [
      {
        url: "/og-images/sensual-dance-preview.png",
        width: 1200,
        height: 630,
        alt: "WaifuDance AI preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WaifuDance AI: Create Sensual Dance Videos from Photos",
    description: "AI tool for twerking, hip shaking & waifu animations. Ideal for creators and collectors.",
    images: ["/og-images/sensual-dance-preview.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "WaifuDance AI",
              "description": "AI tool for creating short sensual dance videos from photos. Targets creators on OnlyFans/TikTok and anime waifu enthusiasts.",
              "applicationCategory": "MultimediaSoftware",
              "featureList": ["Twerk Animation", "Anime Waifu Dance", "Viral Content Generator"],
              "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
            })
          }}
        />
        {/* Umami — self-hosted at stats.kina.men (Kurt team). The tracker
            is a no-op unless NEXT_PUBLIC_UMAMI_WEBSITE_ID is set in Vercel.
            auto-track is disabled so we count pageviews from one source
            (AnalyticsTracker) and don't double-count SPA navigations. */}
        {process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID && (
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script
            defer
            src="https://stats.kina.men/script.js"
            data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
            data-auto-track="false"
          />
        )}
      </head>
      <body>
        <Suspense fallback={null}>
          <AnalyticsTracker />
        </Suspense>
        {children}
      </body>
    </html>
  );
}

