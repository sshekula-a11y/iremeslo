#!/usr/bin/env bash
# Spustí čistý PostgreSQL v dočasné složce, nahraje migrace a pustí test izolace firem.
# Potřebuje nainstalovaný PostgreSQL 15+ (initdb, pg_ctl, psql). Data se po testu smažou.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || PGBIN="$(dirname "$(command -v initdb)")"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUNAS=()
if [ "$(id -u)" = "0" ]; then
  # initdb nesmí běžet pod rootem
  chown -R postgres "$TMP"
  RUNAS=(sudo -u postgres)
  command -v sudo >/dev/null || RUNAS=(su postgres -s /bin/bash -c)
fi

run() {
  if [ "${RUNAS[0]:-}" = "su" ]; then "${RUNAS[@]}" "$(printf '%q ' "$@")"; else "${RUNAS[@]}" "$@"; fi
}

cleanup() { run "$PGBIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

run "$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust -E UTF8 --locale=C.UTF-8 >/dev/null
run "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" -w start >/dev/null

PSQL=(psql -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/db/local/000_supabase_stub.sql"
for f in "$ROOT"/db/migrations/*.sql; do
  echo "migrace $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "test izolace firem a dokladů"
"${PSQL[@]}" -f "$ROOT/db/test/isolation.sql" 2>&1 | sed 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /' | grep -v '^\s*$'
