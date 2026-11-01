import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./responsive.css";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { PwaAppControls } from "@/components/pwa";

export const metadata: Metadata = {
  metadataBase: new URL("https://dclutr.com.ng"),
  title: "D_clutr — Find a little something lovely",
  description: "D_clutr is a student-to-student marketplace for affordable pre-loved finds around the Federal University of Technology, Akure.",
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
        <div className="announcement">A little less waste, a lot more lovely <span aria-hidden="true">✳</span> Shop secondhand, feel good.</div>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
