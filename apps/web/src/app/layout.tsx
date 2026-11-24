import type { Metadata, Viewport } from "next";
// Písma jsou na vlastním serveru (žádné volání Google Fonts – lepší pro GDPR i rychlost)
import "@fontsource-variable/inter";
import "@fontsource-variable/archivo";
import "./globals.css";
import { ConsentManager } from "@/components/ConsentManager";

export const metadata: Metadata = {
  title: { default: "iRemeslo.cz – poptávky řemeslných prací, nabídky a faktury pro řemeslníky", template: "%s · iRemeslo.cz" },
  description:
    "Hledáte řemeslníka? Zadejte poptávku zdarma a bez registrace. Řemeslníkům iRemeslo.cz přináší nové zakázky, cenové nabídky a faktury z telefonu a přehled o zisku.",
  applicationName: "iRemeslo.cz",
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
      </body>
    </html>
  );
}
