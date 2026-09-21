import type { Metadata } from "next";
import { Rajdhani, Manrope } from "next/font/google";
import NavBar from "@/components/NavBar";
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
  title: "BoutCasts",
  description: "Head-to-head clip battles with crowd voting.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${rajdhani.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <NavBar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
