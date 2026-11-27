import type { Metadata, Viewport } from "next";
// Písma jsou na vlastním serveru (žádné volání Google Fonts – lepší pro GDPR i rychlost)
import "@fontsource-variable/inter";
import "@fontsource-variable/archivo";
import "./globals.css";
import { ConsentManager } from "@/components/ConsentManager";
import { CtaTracker } from "@/components/CtaTracker";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: "iRemeslo.cz – program pro řemeslníky a poptávky zdarma", template: "%s · iRemeslo.cz" },
  description:
    "Zakázky s kalkulací, nabídky, faktury a smlouvy s podpisem prstem v telefonu. Zákazníci zadávají poptávky zdarma. 30 dní zdarma, pak od 199 Kč.",
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
