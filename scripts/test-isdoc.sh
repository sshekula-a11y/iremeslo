#!/usr/bin/env bash
# Ověří export ISDOC proti oficiálnímu schématu 6.0.2 (potřebuje xmllint a npx tsx).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
cd "$ROOT/apps/web/test/isdoc"
npx --yes tsx "$ROOT/apps/web/test/isdoc/variants.mts" "$OUT"
for f in "$OUT"/*.isdoc; do xmllint --noout --schema isdoc-invoice-6.0.2.xsd "$f"; done
echo "ISDOC: všechny ukázkové doklady odpovídají schématu 6.0.2"
