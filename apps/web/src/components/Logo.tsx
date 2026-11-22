/** Logo iŘemeslo: bílé „i“ v oranžovém čtverci + nápis (stejné jako v návrhu). */
export function Logo({ size = 28, dark = true }: { size?: number; dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="7" fill="#E8590C" />
        <circle cx="14" cy="8.4" r="2" fill="#FFFFFF" />
        <path d="M14 13v8" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      <span className={`font-display text-[19px] font-extrabold tracking-tight ${dark ? "text-white" : "text-ink"}`}>
        <span className="text-accent-2">i</span>Řemeslo
      </span>
    </span>
  );
}
