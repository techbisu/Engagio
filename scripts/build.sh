#!/bin/bash
# Auto-switch Prisma provider based on DATABASE_URL
# If DATABASE_URL starts with "postgresql://" → use postgresql
# If DATABASE_URL starts with "file:" → use sqlite (local dev)

set -e

SCHEMA="prisma/schema.prisma"
DB_URL="${DATABASE_URL:-}"

if [[ "$DB_URL" == postgresql://* ]] || [[ "$DB_URL" == postgres://* ]]; then
  echo "[build] DATABASE_URL is PostgreSQL — switching provider to postgresql"
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA"
elif [[ "$DB_URL" == file:* ]]; then
  echo "[build] DATABASE_URL is SQLite — keeping provider as sqlite"
  # Already sqlite — no change needed
else
  echo "[build] WARNING: DATABASE_URL not recognized, defaulting to sqlite"
  echo "[build] DATABASE_URL starts with: ${DB_URL:0:20}..."
fi

# Run prisma generate + db push
echo "[build] Running prisma generate..."
bunx prisma generate

echo "[build] Running prisma db push..."
bunx prisma db push --accept-data-loss

echo "[build] Running next build..."
bunx next build
