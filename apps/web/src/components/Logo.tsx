import Image from "next/image";

/**
 * Logo iRemeslo.cz (soubory v public/brand vytvořené z dodaného loga, průhledné pozadí).
 * Logo je tmavomodré, proto patří na světlé pozadí.
 *  - full: se sloganem „Řemeslná práce pod kontrolou“
 *  - compact: bez sloganu (hlavička aplikace)
 *  - mark: jen znak domečku (malé plochy)
 */
export function Logo({ variant = "compact", height = 32, priority = false, className }: {
  variant?: "full" | "compact" | "mark"; height?: number; priority?: boolean;
  /** Výška přes třídy (např. „h-7 sm:h-11“) – logo se pak zmenšuje podle šířky obrazovky. */
  className?: string;
}) {
  const src = variant === "full" ? "/brand/logo.png" : variant === "mark" ? "/brand/znak.png" : "/brand/logo-bez-sloganu.png";
  const ratio = variant === "full" ? 1000 / 229 : variant === "mark" ? 1 : 800 / 144;
  return (
    <Image
      src={src}
      alt="iRemeslo.cz"
      height={height}
      width={Math.round(height * ratio)}
      priority={priority}
      className={className}
      style={className ? { width: "auto" } : { height, width: "auto" }}
    />
  );
}
