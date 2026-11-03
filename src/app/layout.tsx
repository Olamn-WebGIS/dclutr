import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./responsive.css";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { PwaAppControls } from "@/components/pwa";

export const metadata: Metadata = {
  metadataBase: new URL("https://dclutr.com.ng"),
  title: "D_clutr — Find a little something lovely",
  description: "Find affordable pre-loved essentials and pass useful things on to other FUTA students in Akure.",
  manifest: "/manifest.webmanifest",
  icons: [
    { rel: "icon", url: "/icon.svg" },
    { rel: "apple-touch-icon", url: "/icon.svg" },
  ],
  applicationName: "D_clutr",
  appleWebApp: {
    capable: true,
    title: "D_clutr",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#244b39",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaAppControls />
        <div className="announcement">Made for FUTA students <span aria-hidden="true">✳</span> Find something good, pass something on.</div>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
