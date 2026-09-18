import type { Metadata } from "next";
import { Orbitron, IBM_Plex_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Footer from "./Footer";
import GoogleAnalytics from "./GoogleAnalytics";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Post Your Need",
  description: "Post what you need. Let sellers come to you.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${ibmPlexSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-rv-bg text-rv-text">
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="beforeInteractive" />
        <GoogleAnalytics />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}