import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import UtmTracker from "@/components/UtmTracker";
import { SITE } from "@/lib/site/content";

export const metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: research proposals with verified references`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: { title: SITE.name, description: SITE.description, url: SITE.url, siteName: SITE.name, type: "website" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Manrope:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="antialiased">
        {children}
        <Analytics />
        <UtmTracker />
      </body>
    </html>
  );
}
