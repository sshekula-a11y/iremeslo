import type { Metadata, Viewport } from "next";
// Písma jsou na vlastním serveru (žádné volání Google Fonts – lepší pro GDPR i rychlost)
import "@fontsource-variable/inter";
import "@fontsource-variable/archivo";
import "./globals.css";
import { ConsentManager } from "@/components/ConsentManager";
import { CtaTracker } from "@/components/CtaTracker";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: "iRemeslo.cz je vaše virtuální kancelář + veřejné poptávky", template: "%s · iRemeslo.cz" },
  description:
    "iRemeslo.cz je vaše virtuální kancelář + veřejné poptávky. Pro řemeslníky: zakázky, cenové nabídky, faktury, smlouvy o dílo a nové poptávky na jednom místě. Zákazníci zadávají poptávky zdarma a bez registrace.",
  applicationName: "iRemeslo.cz",
  metadataBase: new URL(SITE_URL),
  // Náhled při sdílení (Facebook, WhatsApp, LinkedIn…). Obrázek je app/opengraph-image.png.
  openGraph: { type: "website", siteName: "iRemeslo.cz", locale: "cs_CZ" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#05264C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body className="min-h-dvh antialiased">
        {children}
        <ConsentManager />
        <CtaTracker />
      </body>
    </html>
  );
}
