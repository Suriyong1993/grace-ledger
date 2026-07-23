#!/bin/sh
# ============================================================================
# Grace Ledger v2 — Docker Entrypoint
# ============================================================================
# 1. Waits for PostgreSQL to be ready
# 2. Runs Drizzle migrations (production-safe, no data loss)
# 3. Starts the application (nitro server)

set -e

echo "=== Grace Ledger v2 — Starting ==="

# Wait for PostgreSQL
echo "[entrypoint] Waiting for PostgreSQL at ${DATABASE_URL%%/*}..."
until node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
  pool.query('SELECT 1').then(() => { pool.end(); process.exit(0); }).catch(() => { pool.end(); process.exit(1); });
" 2>/dev/null; do
  echo "[entrypoint] PostgreSQL not ready — retrying in 2s..."
  sleep 2
done
echo "[entrypoint] PostgreSQL is ready."

# Run production-safe migrations
echo "[entrypoint] Running database migrations..."
npx drizzle-kit migrate --config drizzle.config.ts 2>&1
echo "[entrypoint] Migrations complete."

# Start the application (nitro server)
echo "[entrypoint] Starting application on port ${PORT:-3000}..."
exec node .output/server/index.mjs
