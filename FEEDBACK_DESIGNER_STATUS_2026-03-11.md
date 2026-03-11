# FEEDBACK_DESIGNER – Umsetzungsstatus (2026-03-11)

## 1) Status clarity first (High)
**Status:** ✅ erledigt
- Bei Draft-Menüs wird jetzt klarer Hinweistext angezeigt:
  - „Dieses Menü ist ein Entwurf. Einzelne Rezepte können noch fehlen.“
- Zusätzlich bleibt der Draft-Badge sichtbar.

## 2) Action gating (High)
**Status:** ✅ erledigt
- Fehlende Rezepte sind nicht mehr klickbar.
- CTA-Label wurde auf **„Rezept folgt“** umgestellt.
- Sekundäre Recovery-Aktionen ergänzt:
  - **„Archiv ansehen“**
  - **„Später erneut laden“**

## 3) Information architecture (Medium)
**Status:** ✅ erledigt
- Semantische Trennung im Hero umgesetzt:
  - **„Tagesmenü Schweiz“** für verfügbare Menüs
  - **„Neuster Entwurf“** für Draft-Stand

## 4) Error-state design for recipe pages (Medium)
**Status:** ✅ erledigt
- Kein Plain-Text-404 mehr.
- Strukturierter Error-State mit Handlungsmöglichkeiten:
  - Zurück zum Menü
  - Zum Archiv

## 5) Mobile micro-UX (Medium)
**Status:** ✅ erledigt
- Auf kleinen Screens werden Menüeinträge besser gestapelt.
- CTA-Pills sind touch-freundlicher gestaltet.

---

## QA Verifikation
- Test-Suite: **26/26 grün** (`npm test`)
- Manuelle Smoke-Checks bestätigt:
  - Draft-Hinweis sichtbar
  - „Rezept folgt“ statt Dead-Link
  - Recovery-Links vorhanden
