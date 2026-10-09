import type { Metadata, Viewport } from "next";
import { Manrope, Archivo } from "next/font/google";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import GuestClaim from "@/components/GuestClaim";
import AdInterstitial from "@/components/AdInterstitial";
import SplashGate from "@/components/SplashGate";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { ToastProvider } from "@/components/Toast";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

// Wide, heavy display face — used for headlines everywhere (homepage,
// splash and app pages) so the whole site shares one look.
const archivo = Archivo({
  variable: "--font-hero",
  axes: ["wdth"],
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-body",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

// iOS launch images for the installed (Add to Home Screen) app — one per
// screen size, matched by CSS pixel size + pixel ratio.
const STARTUP_IMAGES = [
  ["iphone-6.9in-1320x2868", 440, 956, 3],
  ["iphone-6.7in-1290x2796", 430, 932, 3],
  ["iphone-6.3in-1206x2622", 402, 874, 3],
  ["iphone-6.1in-1179x2556", 393, 852, 3],
  ["iphone-6.1in-1170x2532", 390, 844, 3],
  ["iphone-6.5in-1242x2688", 414, 896, 3],
  ["iphone-6.1in-828x1792", 414, 896, 2],
  ["iphone-5.8in-1125x2436", 375, 812, 3],
  ["iphone-5.5in-1242x2208", 414, 736, 3],
  ["iphone-4.7in-750x1334", 375, 667, 2],
  ["ipad-2048x2732", 1024, 1366, 2],
].map(([file, w, h, dpr]) => ({
  url: `/splash/${file}.png`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
}));

export const metadata: Metadata = {
  metadataBase: new URL("https://www.boutcasts.com"),
  title: {
    default: "BoutCasts",
    template: "%s | BoutCasts",
  },
  description: "Live voting for battles, class elections, polls and events — one vote per voter, results in real time.",
  openGraph: {
    title: "BoutCasts",
    description: "Live voting for battles, class elections, polls and events — one vote per voter, results in real time.",
    url: "https://www.boutcasts.com",
    siteName: "BoutCasts",
    images: ["/boutcasts-logo.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BoutCasts",
    description: "Live voting for battles, class elections, polls and events — one vote per voter, results in real time.",
    images: ["/boutcasts-logo.png"],
  },
  appleWebApp: {
    capable: true,
    title: "BoutCasts",
    statusBarStyle: "black",
    startupImage: STARTUP_IMAGES,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={`${manrope.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <SplashGate />
        <AnalyticsTracker />
        <GuestClaim />
        <ToastProvider>
          <NavBar />
          <main className="flex-1">{children}</main>
          <Footer />
          <AdInterstitial />
        </ToastProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
