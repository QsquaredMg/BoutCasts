import type { Metadata } from "next";
import { Rajdhani, Manrope } from "next/font/google";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const rajdhani = Rajdhani({
  variable: "--font-display",
  weight: ["600", "700"],
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-body",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.boutcasts.com"),
  title: {
    default: "BoutCasts",
    template: "%s | BoutCasts",
  },
  description: "Head-to-head clip battles with crowd voting.",
  openGraph: {
    title: "BoutCasts",
    description: "Head-to-head clip battles with crowd voting.",
    url: "https://www.boutcasts.com",
    siteName: "BoutCasts",
    images: ["/boutcasts-logo.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BoutCasts",
    description: "Head-to-head clip battles with crowd voting.",
    images: ["/boutcasts-logo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${rajdhani.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <ToastProvider>
          <NavBar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
