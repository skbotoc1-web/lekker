# Overnight Report

## What changed

### 1) UX/Design polish
- Menükarten auf `/` und `/menue/:day` strukturiert (`meal-list`) mit besserer Lesbarkeit für Mobile/Desktop.
- Rezeptseiten mit klarer Informationshierarchie (`eyebrow`, `subtitle`, `meta-grid`, interne Links).
- Navigation erweitert: `/wochenplan`, `/status`, API bleibt direkt erreichbar.

### 2) Data quality
- Pipeline-Härtung über atomische Menü+Rezept-Erzeugung (`createMenuAndRecipesAtomic`) mit Coverage-Check.
- Rezept-Metadaten-Validierung/Normalisierung (inkl. Drink/Snack-Grenzen) über `recipeMeta` Tests abgesichert.

### 3) Product depth
- Neue API: `GET /api/weekly-plan?days=7` (3-14 Tage).
- Neue Seite: `/wochenplan` inkl. Anti-Repetition-Radar (Top-Repeats + Unique Dish Count).

### 4) Operations
- Neue persistente Run-Historie `pipeline_runs` in SQLite.
- Hook-Ausführung schreibt Status, Dauer, Details in Run-Logs.
- Neue Status-Endpunkte:
  - `GET /api/status`
  - `GET /status`
- README um Troubleshooting-Sektion ergänzt.

### 5) SEO/content structure
- Interne Verlinkung auf Rezeptseiten und Navigation verbessert.
- Sitemap erweitert um `/wochenplan` und `/status`.

## Why
- PMF-Richtung verlangt nicht nur neue Features, sondern Vertrauen: keine toten Rezeptlinks, sichtbarer Produktionsstatus, klarere Inhaltsstruktur und Wochenplanung mit Repetition-Sichtbarkeit.

## Test results
- `npm test` nach jeder Iteration ausgeführt.
- Final: **13/13 tests pass**.
- Neue/erweiterte Tests decken ab:
  - Atomare Menü+Rezept-Konsistenz
  - Run-Logging in `pipeline_runs`
  - Rezept-Meta-Validierung
  - Weekly-Plan Repetition-Statistik

## Remaining gaps
- Repetition derzeit nur sichtbar, nicht aktiv optimierend in Menüauswahl.
- SEO-Meta noch ohne feinere OpenGraph-Varianten pro Seitentyp.
- Approval-Flow hat jetzt Publish-Gate für Vollständigkeit, aber noch keine explizite Retry-UI für Reviewer.

## Next 3 high-impact tasks
1. **Repetition-aware Menügenerator**: Auswahl aktiv gegen häufige Wiederholungen optimieren (nicht nur anzeigen).
2. **Contract tests für APIs**: stabile JSON-Schemas für `/api/status` und `/api/weekly-plan` absichern.
3. **Publish readiness gate**: nur vollständige Menüs (`10/10 Rezepte`) als `published` zulassen.
