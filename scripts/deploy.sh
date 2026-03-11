#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[lekker] .env erstellt. Bitte SMTP/BASE_URL prüfen."
fi

docker compose up -d --build
echo "[lekker] läuft auf http://localhost:8787"
