// Styly: Tailwind v4 a pak „rozbalení“ CSS vrstev (@layer).
// Safari do verze 15.3 (starší macOS a iPhony) @layer nezná a celý vzhled by ignoroval – stránka by byla bez stylů.
// @csstools/postcss-cascade-layers vrstvy odstraní a pořadí pravidel zachová pomocí specificity.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    "@csstools/postcss-cascade-layers": {},
  },
};
