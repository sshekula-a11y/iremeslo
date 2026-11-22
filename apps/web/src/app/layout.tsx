import type { Metadata, Viewport } from "next";
// Písma jsou na vlastním serveru (žádné volání Google Fonts – lepší pro GDPR i rychlost)
import "@fontsource-variable/inter";
import "@fontsource-variable/archivo";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "iŘemeslo – zakázky, nabídky a faktury pro řemeslníky", template: "%s · iŘemeslo" },
  description:
    "Cenová nabídka a faktura za pár minut z telefonu. U každé zakázky vidíte náklady, výdělek a marži. Pro řemeslníky a malé firmy v ČR.",
  applicationName: "iŘemeslo",
};

export const viewport: Viewport = {
  themeColor: "#17191C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
