#!/usr/bin/env bash
set -euo pipefail

echo "=== Search Ops Toolkit — Setup ==="
echo ""

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed. Install it first: https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker compose version &>/dev/null && ! docker-compose version &>/dev/null; then
  echo "ERROR: Docker Compose is not available. Install it first."
  exit 1
fi

# Generate .env if missing
if [ -f .env ]; then
  echo ".env already exists — skipping generation (edit manually if needed)."
else
  echo "Generating .env with secure random passwords..."

  POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
  SESSION_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)

  read -rp "Admin email (optional, grants admin access — leave empty to skip): " ADMIN_EMAIL

  cat > .env <<EOF
DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@db:5471/gmaps_reviews?schema=public"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
SESSION_SECRET="${SESSION_SECRET}"
ADMIN_EMAIL="${ADMIN_EMAIL}"
NEXT_PUBLIC_ADMIN_EMAIL="${ADMIN_EMAIL}"
APP_PORT=3847
DB_PORT=5471
EOF

  echo ".env created."
fi

echo ""
echo "Starting containers..."

if docker compose version &>/dev/null; then
  docker compose up -d --build
else
  docker-compose up -d --build
fi

echo ""
echo "Done! App is running at http://localhost:3000"
echo "Log in with your DataForSEO credentials."
