# lekker – Design/Dev/QA Delivery (2026-03-11)

## Zielbild für Morgenfrüh
Ein stabiler, visuell konsistenter, release-fähiger Web-Flow mit klarer Nutzerführung:
- Startseite zeigt nur valide Rezeptlinks
- unvollständige Menüs werden transparent als "in Vorbereitung" kommuniziert
- Design-System konsistent über Start, Archiv, Menüdetail, Rezeptdetail, Statusseiten
- Pipeline reduziert Inkonsistenzen durch atomare Menü+Rezept-Erstellung

---

## 1) Umgesetzte Fixes (Dev)

### A. Broken recipe links (High) – **behoben**
- Datei: `src/web/server.js`
- Änderung:
  - Rezeptverfügbarkeit pro Menü wird geprüft (`getRecipeLookup`).
  - CTA pro Slot zeigt entweder
    - `Rezept` (wenn vorhanden) oder
    - `in Vorbereitung` (wenn nicht vorhanden).
- Effekt:
  - Keine Dead-Links mehr auf `/rezept/...` bei unvollständigen Menüs.

### B. Inconsistent today behavior (Medium) – **behoben**
- Datei: `src/web/server.js`
- Änderung:
  - Homepage-Selektor verwendet `pickHomepageMenu()` mit Regel:
    1. Heute + vollständig (10/10 Rezepte), sonst
    2. neuester vollständiger Stand bis heute, sonst
    3. neuester unvollständiger Stand.
  - Titel/Intro sind jetzt semantisch korrekt (`Tagesmenü`, `Neuester fertiger Menüvorschlag`, `Menü in Vorbereitung`).
- Effekt:
  - Kein irreführendes "Tagesmenü" mehr, wenn nur ein unvollständiger oder zukünftiger Datensatz existiert.

### C. Data integrity gap (High) – **adressiert mit atomarer Erzeugung**
- Dateien:
  - `src/agents/orchestrator.js`
  - `src/hooks/pipelineHooks.js`
- Änderung:
  - Atomare Menü+Rezept-Erstellung via SQLite-Transaktion.
  - Integritätsgate: erwartet exakt 10 Rezepte (`EXPECTED_RECIPE_COUNT`).
  - Scheduler 06:35 erzeugt Menü + Rezepte atomar; 06:40 bleibt als Repair-Fallback.
  - Hook `full` nutzt atomare Kombinationslogik.
- Effekt:
  - Deutlich geringeres Risiko für halb-fertige Menüstände.

---

## 2) Umgesetzte Fixes (Design)

### Brand/UX-System modernisiert
- Datei: `public/styles.css`
- Neu:
  - konsistente Tokens (Farben, Border, Shadow, Fokus)
  - klare Typo-Hierarchie (H1/H2/Lead)
  - gebrandete Topbar
  - verbesserte Kartenstruktur + Meal-List-Komponente
  - Status-Badges inkl. Rezeptvollständigkeit
  - mobile/desktop responsive Layouts
  - sichtbare Fokuszustände (Accessibility-Basis)
  - verbesserte Lesbarkeit in Rezeptdetailseiten (Meta-Grid, Inline-Navigation)

---

## 3) QA-Verifikation

### Automatisierte Tests
- Befehl: `npm test`
- Resultat: **8/8 tests passed**

### Manuelle Smoke Checks
- `/` zeigt vollständiges Tagesmenü nur mit gültigen Rezeptlinks.
- `/menue/2026-03-13` (unvollständig) zeigt `Rezepte: 0/10` + ausschließlich `in Vorbereitung` (keine Rezeptlinks).
- No dead link behavior für unvollständige Menüs bestätigt.

---

## 4) Offene Punkte (für morgen früh)
1. **Pipeline-Run Telemetrie**
   - Optional: run-level Logging für jede Hook-Stage in `pipeline_runs` ausbauen.
2. **Accessibility Quick Sweep**
   - Kontrastmessung + Keyboard-only walkthrough über alle Kernseiten.
3. **Review-Flow E2E**
   - Approve/Reject inkl. Mailflow nochmals end-to-end auf Staging bestätigen.

---

## 5) Release-Empfehlung (Stand jetzt)
**Go für Demo/Präsentation morgen früh** mit Hinweis auf zwei Feinschliff-Themen:
- finaler Accessibility-Check
- erweiterte Pipeline-Telemetrie
