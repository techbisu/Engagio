#!/bin/bash
# Build script for Vercel — auto-detects database provider and runs Prisma + Next.js
set -e

SCHEMA="prisma/schema.prisma"
DB_URL="${DATABASE_URL:-}"

echo "[build] DATABASE_URL starts with: ${DB_URL:0:30}..."

# Auto-switch Prisma provider based on DATABASE_URL
if [[ "$DB_URL" == postgresql://* ]] || [[ "$DB_URL" == postgres://* ]]; then
  echo "[build] PostgreSQL detected — switching provider"
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA"
elif [[ "$DB_URL" == file:* ]]; then
  echo "[build] SQLite detected — keeping provider"
else
  echo "[build] WARNING: Unknown DATABASE_URL format"
fi

# Generate Prisma client
echo "[build] Running prisma generate..."
npx prisma generate

# Push schema to database (creates tables)
echo "[build] Running prisma db push..."
npx prisma db push --accept-data-loss

# Build Next.js
echo "[build] Running next build..."
npx next build
