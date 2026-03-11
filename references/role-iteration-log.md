# Role Iteration Log

## Iteration 1

| Rolle | Beitrag | Risiko | Decision |
|---|---|---|---|
| CEO/Orchestrator | Fokus zuerst auf Datenqualität + Messbarkeit gesetzt | UX-Verbesserung später sichtbar | Reihenfolge akzeptiert, Basis zuerst |
| CTO | `recipeMeta` Validierung + Normalisierung eingebaut | Striktere Validierung kann alte Daten brechen | Nur bei Neugenerierung angewendet, kompatibel gehalten |
| CFO | Leichtgewicht beibehalten (zod bereits vorhanden, kein neues Runtime-Framework) | Feature-Drift | Kein zusätzlicher Service eingeführt |
| Designer | Strukturklassen vorbereitet für bessere Lesbarkeit | Styling kann regressieren | Iterativ mit Tests + manuellem Review |
| Nutrition Lead | Plausibilitätsgrenzen für kcal/Zeit/Schwierigkeit pro Slot | Zu harte Limits | pragmatische Grenzen + Drink/Snack-Sonderlogik |
| AgentOps Lead | `pipeline_runs` Tabelle und Hook-Run-Logging geplant/implementiert | Mehr DB writes | minimaler Payload, JSON details |

Integration Review:
- Änderungen konsistent mit bestehender Architektur
- Hook-Orchestrierung und Fallback-Mechanik unverändert

## Iteration 2

| Rolle | Beitrag | Risiko | Decision |
|---|---|---|---|
| CEO/Orchestrator | Wochenplan + Repetition-Sichtbarkeit als PMF-Feature priorisiert | Scope creep | 7-Tage-Kernumfang eingefroren |
| CTO | API `GET /api/weekly-plan` und Page `/wochenplan` integriert | Mehr Abhängigkeiten auf DB | bewusst SSR-only, keine neue Infra |
| CFO | Keine JS-Bundles, nur server-rendered HTML + CSS | Begrenzte Interaktivität | bewusst Kosten-/Wartungsvorteil |
| Designer | Menü-/Rezeptlayout mit klarer Typografie, Meta-Grid, mobile-freundliche Meal-List | regressives CSS | einfache Klassen + keine Framework-Migration |
| Nutrition Lead | Sichtbare Meta-Werte (Zeit, kcal, Difficulty, CO₂) auf Rezeptseite verdichtet | Falsche Erwartung bei Schätzwerten | Copy bleibt als Richtwert (ca.) |
| AgentOps Lead | Navigationsstruktur verbessert (`/wochenplan`, `/status`) für schnellere Diagnose | mehr Oberfläche | nur relevante Kernlinks im Topbar |

Integration Review:
- UX klarer bei Entwurf/Komplettheit, bessere Lesbarkeit mobil + desktop
- Anti-Repetition jetzt sichtbar statt implizit

## Iteration 3

| Rolle | Beitrag | Risiko | Decision |
|---|---|---|---|
| CEO/Orchestrator | Betriebsstabilität und Trust-Transparenz als Release-Kriterium gesetzt | weniger sichtbare Feature-Arbeit | bewusst Ops-first für PMF-Reliability |
| CTO | Run-Logging in Hooks (success/fail, Dauer, Details) integriert | zusätzlicher Schreibpfad | SQLite-append-only, minimal overhead |
| CFO | `/status` + Troubleshooting README reduziert Supportzeit (OPEX) | Doku kann veralten | konkrete Symptome/Fixes dokumentiert |
| Designer | Statusseite und Navigation in Informationsarchitektur eingebettet | mehr Navigationspunkte | auf Kernziele begrenzt |
| Nutrition Lead | Qualitätsmetriken bleiben sichtbar in Rezeptseiten + Wochenplan-Kontext | Health-Fokus nicht vollständig klinisch | als MVP-Richtwerte klar markiert |
| AgentOps Lead | `/api/status` mit Success-Ratio + letzten Runs; persistente `pipeline_runs` | false sense of health bei kleiner sample-size | sample-size explizit im Payload |

Integration Review:
- End-to-end deutlich robuster: Integrität + Sichtbarkeit + Troubleshooting
- Hook-Orchestrierung und lokaler Feed-Fallback vollständig erhalten

## Iteration 4

| Rolle | Beitrag | Risiko | Decision |
|---|---|---|---|
| CEO | SEO- und Intent-Hub priorisiert (`/was-koche-ich-heute-schweiz`) mit klaren Nutzerclustern | Zu viel Content ohne Mehrwert | Fokus auf direkte Decision-UX + interne Linkhubs |
| CTO | Retailer-Crawler-Heuristiken (Migros/Coop/Aldi/Lidl), stärkere Dedup/Fallback-Strategie, neue Routen (`/rezepte`, `/kategorie/:slug`, `/wochenplan/print`) | Selektor-Drift bei Händlerseiten | robuste Multi-Selector + JSON-LD-Fallback + konservative Fallback-Liste |
| CFO | Lightweight-Ansatz bestätigt: kein neues Frontend-Framework, SSR + bestehendes CSS | Feature-Kosten wachsen schleichend | nur serverseitige Erweiterungen, keine neue Runtime-Abhängigkeit |
| Designer | Grössere Rezeptkarten mit Zeit/Schwierigkeit/kcal/Protein/CO₂; FAQ-Block und Freshness-Signale | UI-Überladung | kompakte Karten + bestehende Design-Tokens |
| Nutrition Lead | Ingredient-Normalisierung vertieft (Synonyme, Unit-Cleanup, harmonisierte Canonicals), Matching auf Angebotsnähe optimiert | falsche Kanonisierung bei Grenzfällen | Confidence-gestützt + Soft-Food-Heuristik |
| AgentOps Lead | Validierungstests erweitert (alle 4 Retailer, Mapping-Harmonisierung, Landing/Print-Routen) | test maintenance overhead | kleine, zielgerichtete Tests statt großer Fixtures |

Integration Review:
- Zielbild umgesetzt: bessere Angebotsqualität, bessere Rezept-Ausrichtung, stärkere SEO/UX-Basis.
- Druckbare Wochenplanung + Einkaufsliste als pragmatischer Utility-Mehrwert integriert.

## Iteration 5

| Rolle | Beitrag | Risiko | Decision |
|---|---|---|---|
| CEO | Overnight-Fokus auf Datenqualität + Matching-Trefferquote für Retail-Angebote finalisiert | Scope-Ausweitung in UX/SEO | Nur bestehende SSR-Flächen genutzt, kein zusätzlicher Runtime-Stack |
| CTO | Retailer-Heuristiken vertieft (Migros/Coop/Aldi/Lidl), JSON-LD/Attribute-Extraktion erweitert, smarter Fallback-Mix statt harter Vollfallback | Selector-Drift in Zukunft | Mehrere Selektorfamilien + konservative fallback chain |
| CFO | Lightweight-Prinzip gehalten: keine neuen Dependencies, nur bestehende Services/Test-Suite erweitert | steigende Wartungslast durch Heuristiken | Kleine, klar abgegrenzte Funktionen + tests als Schutzschild |
| Designer | Bereits vorhandene Intent-/Index-/Print-UX bestätigt; keine neuen UI-Komplexitätskosten eingeführt | UX-Stagnation | Fokus auf inhaltliche Relevanz statt zusätzlichem Frontend-Code |
| Nutrition Lead | Ingredient-Harmonisierung ausgebaut (Synonyme/Token-Harmonisierung/Unit-Cleanup) inkl. robusteren Fisch/Fleisch-/Gemüse-Mappings | Fehlklassifikation bei exotischen Begriffen | confidence-basiert + bekannte Canonicals priorisiert |
| AgentOps Lead | Neue Validierungstests für retailer-spezifische Selektoren + Synonym-Matching in Menüplanung ergänzt | mehr Testlaufzeit | test-concurrency bleibt 1, kleine Fixtures, schnelle lokale Ausführung |

Integration Review:
- Extraktionsqualität in allen 4 Retailer-Pfaden verbessert und dedup/fallback robuster gemacht.
- Harmonisierung + Matching-Logik erhöht Alignment zwischen Angeboten und ausgewählten Gerichten.
- Validierungstiefe erweitert, Test-Suite bleibt grün und leichtgewichtig.

## Iteration 6

| Rolle | Beitrag | Risiko | Decision |
|---|---|---|---|
| CEO | End-to-end Night-Prioritäten gebündelt: Retail-Qualität + SEO-Intent + Export-Nutzen in einem schlanken Loop | Scope-Verzettelung | Nur bestehende SSR/SQLite-Pfade erweitert, keine neue Infra |
| CTO | Crawler-Heuristik pro Händler erweitert (mehr Selektorfamilien, tiefere JSON-LD-Rekursion, confidence-gesteuerte Auswahl, Hybrid-Fallback) | Scraper drift bei Website-Änderungen | Multi-Source-Extraktion + testbare fallback-Logik |
| CFO | Lightweight-Guardrail eingehalten: 0 neue Runtime-Dependencies, nur modulare Funktionsupdates + Tests | Wartungskosten über Zeit | Kleine Utilities, geringe Kopplung, bestehende CI-Tests als Gate |
| Designer | Intent-Hub und interne Linkhubs gestärkt; Kategorie-Seiten statt Redirect; rotierende „heute empfohlen“-Karten + sichtbare Freshness | Überladung der Startseite | kompakte Karten, bestehende Styles weiterverwendet |
| Nutrition Lead | Harmonisierung auf Taxonomie-Level erweitert (protein/carbs/produce), stärkeres unit cleanup + robuste Synonymketten für matching | Fehlklassifizierung bei Freitext | Confidence + Canonical/Token-Normalisierung kombiniert |
| AgentOps Lead | Testabdeckung erweitert: scraper fallback mix, JSON-LD extraction, taxonomy checks, category/export route validation | längere Testlaufzeit | kleine Fixtures, fokussierte Contract-Tests |

Integration Review:
- Retailer-Extraktion, Normalisierung und Menü-Matching greifen konsistenter ineinander.
- SEO/UX-Elemente aus competitor analysis pragmatisch umgesetzt (Intent-Hub, Clusterseiten, strukturierte Daten, Linkhubs, Freshness, Exporte).
- Plattform bleibt leichtgewichtig: SSR + SQLite + bestehender Teststack.
