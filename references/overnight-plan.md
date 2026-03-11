# Overnight Plan (Role Iteration Loop)

## Mission
MVP bis morgen spürbar Richtung Product-Market-Fit verbessern (leichtgewichtig, VPS-tauglich, bestehende Hook-Orchestrierung + lokaler Feed-Fallback unverändert).

## Iteration 1 — Data Quality Foundation
- CTO/Nutrition Lead: Strikte Rezept-Metadatenvalidierung (Zeit, kcal, Difficulty, CO2).
- AgentOps Lead: Basis für Run-Status-Transparenz in Datenmodell.
- Tests: neue Unit-Tests für Metadaten und Repetition-Logik.

## Iteration 2 — UX + Product Depth
- Designer: Lesbarkeit Rezeptseiten + Menülisten Desktop/Mobile verbessern.
- CEO: Wochenplan-Seite + API priorisieren.
- CFO: Kein Heavy-Frontend, SSR + CSS-only beibehalten.

## Iteration 3 — Operations + SEO + Docs
- AgentOps Lead: Status-Endpunkte + Run-Historie mit Fehlersichtbarkeit.
- CEO/CTO: bessere Navigation und interne Verlinkung.
- CFO: Troubleshooting-Readme für geringere Betriebskosten (Support-Aufwand runter).

## Guardrails
- Keine Breaking Changes an `POST /hooks/run/:stage`
- Lokaler Feed-Fallback bleibt Default
- Jede Iteration: Tests, Commit
