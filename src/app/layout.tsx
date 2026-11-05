import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./responsive.css";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { PwaAppControls } from "@/components/pwa";
import { NotificationToasts } from "@/components/notification-toasts";
import { HomeFooter } from "@/components/home-footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://dclutr.com.ng"),
  title: "D_clutr — Find a little something lovely",
  description: "Find affordable pre-loved essentials and pass useful things on to other FUTA students in Akure.",
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "/",
    siteName: "D_clutr",
    title: "D_clutr — Find a little something lovely",
    description: "Find affordable used essentials and sell useful things on to other FUTA students in Akure.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "D_clutr — used items for FUTA students in Akure" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "D_clutr — Find a little something lovely",
    description: "Find affordable used essentials and sell useful things on to other FUTA students in Akure.",
    images: ["/opengraph-image"],
  },
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
        <div className="announcement" role="note" aria-label="Made for FUTA students. Find something good, pass something on.">
          <div className="announcement-track" aria-hidden="true">
            {Array.from({ length: 2 }, (_, group) => (
              <div className="announcement-group" key={group}>
                {Array.from({ length: 6 }, (_, item) => (
                  <span className="announcement-message" key={item}>Made for FUTA students <span>✳</span> Find something good, pass something on.</span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <SiteHeader />
        <NotificationToasts />
        <main>{children}</main>
        <HomeFooter><SiteFooter /></HomeFooter>
      </body>
    </html>
  );
}
