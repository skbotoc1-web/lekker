# lekker (DE-CH)

Leichtgewichtige WebApp für den Schweizer Markt: tägliche Menüvorschläge (vegan + nicht-vegan) für Frühstück, Mittag, Abendessen plus Snack und Getränkebegleitung.

## Ziel

- Proteinfokus gemäss Schweizer Ernährungsempfehlungen (BLV)
- Tagesaktuelle Angebotsdaten von Migros, Coop, Aldi Suisse, Lidl
- Gute Wochen-CO2-Bilanz
- Vollautomatisiert via Multi-Agent-Orchestrierung
- Menschlicher Freigabe-Flow per E-Mail-Link (Approve/Reject)

## Architektur (Schritt 1)

**Backend:** Node.js + Express + SQLite (better-sqlite3)  
**Scheduling:** node-cron (Europe/Zurich)  
**Ingestion:** Retailer-Crawler (Cheerio + Fallbacks)  
**Semantik/Clustering:** Lightweight Hash-Embeddings + Heuristik (modular austauschbar)  
**Workflow:** 10 Rollen/Agenten als deterministische Pipeline  
**Frontend:** SSR HTML (sehr leicht deploybar)  

### Rollenmodell (inkl. Design)

- **CEO/Orchestrator:** priorisiert Outcomes, steuert Gesamtpipeline
- **CTO:** technische Architektur, Integrations- und Qualitätsentscheidungen
- **CFO:** ROI/Margen-Guardrail (>=35% für Softwarebetrieb)
- **Designer (neu):** Marken-Konsistenz, UI/UX-Qualität, Responsive Verhalten (Desktop + Mobile), visuelle Wiedererkennbarkeit über alle Seiten und States

### Agenten-Pipeline

1. 06:01 Agent 1 crawlt Migros-Angebote (≥10 Zutaten)
2. 06:02 Agent 2 crawlt Coop-Angebote (≥10 Zutaten)
3. 06:03 Agent 3 crawlt Aldi-Angebote (≥10 Zutaten)
4. 06:04 Agent 4 crawlt Lidl-Angebote (≥10 Zutaten)
5. 06:30 Agent 5 clustert/strukturiert nach Mahlzeit + vegan/nicht-vegan
6. 06:35 Agent 6 erstellt Tagesmenü mit Richtlinien + 10-Tage-Historie
7. 06:40 Agent 7 generiert Schritt-für-Schritt-Rezepte
8. 06:45 Agent 8 sendet Freigabe-Mail (Approve/Reject Link)
9. Alle 5 Min Agent 9 prüft Freigabe und publiziert
10. Designer-Rolle prüft UI-Qualität (Design-Tokens, Konsistenz, Responsive, Accessibility) vor Release-Freigabe

## Maßnahmenplan (Schritt 2)

- [x] Datenmodell + Migrationen
- [x] Retailer-Crawler + Fallback-Strategie
- [x] Clustering + Kategoriezuordnung
- [x] Menügenerator (Protein, Vegan/Omni, CO2, Anti-Wiederholung)
- [x] Rezeptgenerator
- [x] Premium-Rezeptformat (Portionen, Tipps, Zeit, Schwierigkeit, kcal, CO₂-Ampel)
- [x] Freigabe-Workflow (Token-Link)
- [x] Web-UI + JSON-API
- [x] Scheduler + Full Pipeline
- [x] Tests + Deploy-Script + Docker

## Run lokal

```bash
cp .env.example .env
npm install
npm run seed
RUN_PIPELINE_ON_BOOT=true npm start
```

App: `http://localhost:8787`

## One-command Deploy via SSH

```bash
git clone <repo-url> && cd lekker && ./scripts/deploy.sh
```

## API

- `GET /api/menu/today` – Tagesmenü + Rezepte
- `GET /review/:token?action=approve|reject` – Freigabe/Zurückweisung
- `GET /health`
- `POST /hooks/run/:stage` – Hook Runner (`ingestion|clustering|menu|recipes|full`)
- `GET /feeds/:tab.csv` – Exportfeed (CSV)
- `GET /feeds/:tab.jsonl` – Exportfeed (JSONL)
- `GET /feeds/menu-today.json` – Tagesmenü als JSON-Feed

### Hook-Automation (neu)

`lekker` unterstützt jetzt Hook-basierte Stages mit token-gesicherter Ausführung:

```bash
curl -X POST http://localhost:8787/hooks/run/full \
  -H "x-hook-token: $HOOK_TOKEN"
```

Oder lokal ohne HTTP:

```bash
npm run hook:full
```

Datensenke ist standardmässig **lokal** (`DATA_SINK=local`) und schreibt Feeds nach `data/feeds/*.csv|*.jsonl`.
Optional kann auf Google Sheets umgestellt werden (`DATA_SINK=google`) mit Service Account.

## Hinweise

- Für echten Versand SMTP in `.env` setzen (`SMTP_ENABLED=true`).
- Bei `reject` wird der Status auf Draft gesetzt; nächste Pipeline erstellt Alternativen.
- Semantik-Modul kann später auf externe Embeddings umgestellt werden (gleiche Schnittstelle).
