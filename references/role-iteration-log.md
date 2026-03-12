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

## Iteration 7

| Rolle | Beitrag | Risiko | Decision |
|---|---|---|---|
| CEO | Night-Ziel auf vier Händlerdaten + bessere Rezeptpassung + SEO-Conversionpfad fokussiert | zu viele Teilziele in einem Sprint | genau ein integrierter Loop, keine Nebenfeatures |
| CTO | Extraktion robuster gemacht (Heading-Noise-Filter, stärkere Raw-Dedupe, größere Harmonize-Window), Slot+Vegan-Signale ins Matching eingebaut | Heuristiken können überfiltern | konservative Filter + Fallback-Füllung bleibt aktiv |
| CFO | Lightweight-Guardrail gehalten: 0 neue Dependencies, nur Funktions-/Test-Updates | schleichende Komplexität im Matching | kleine pure helpers + klare Testfälle pro Risiko |
| Designer | Bestehende Intent/Cluster/Index/Print-Flows bestätigt; Fokus auf Relevanz statt zusätzlicher UI-Schichten | geringerer visuell sichtbarer Fortschritt | Qualität vor Oberflächen-Ausbau |
| Nutrition Lead | Harmonisierung erweitert (Delimiter-/Label-Cleanup, Synonymhärte), Mapping für gemischte Retail-Bezeichnungen verbessert | Grenzfälle bei exotischen Produktnamen | bekannte Canonicals priorisieren, Soft-Fallback behalten |
| AgentOps Lead | Neue Validierungstests für Noise-Filter, Mapping-Härte und slot+vegan Matching eingeführt | Testlaufzeit steigt | kleine Fixtures, zielgerichtete Assertions |

Integration Review:
- Retailer-Scrapes für Migros/Coop/Aldi/Lidl sind resilienter gegen Dubletten und Header-Rauschen.
- Ingredient-Harmonisierung und Menü-Matching sind stärker auf echte Angebotslage ausgerichtet.
- SEO/UX-Erweiterungen bleiben aktiv, Plattform weiterhin schlank (SSR/SQLite, keine neuen Laufzeitpakete).

## Iteration 8

| Rolle | Beitrag | Risiko | Decision |
|---|---|---|---|
| CEO | Night-Loop strikt auf Impact priorisiert: bessere Händlerdatenqualität + bessere Menütreffer + bestehende SEO/UX-Flächen stabil halten | übergreifende Änderungen können Regressionen erzeugen | genau ein integrierter Loop mit vollständigem Test-Gate |
| CTO | Retailer-Extraktion vertieft: zusätzliche Selektoren je Händler, JSON-LD + `__NEXT_DATA__` Fallback, Source-Tag-Ranking, robustere Noise-/Dedup-Strategie | scraper drift / noisy payloads | Multi-Source Scoring + confidence-basierte Selektion + Fill-up Fallback |
| CFO | Lightweight-Prinzip eingehalten: keine neuen Dependencies, nur bestehende Services/Tests erweitert | Heuristikkomplexität wächst | kleine modulare Funktionen, klare Contract-Tests als Kostenbremse |
| Designer | Bestehende Intent-Hub/Cluster/Index/Print-UX bestätigt und intern verlinkt belassen (keine neue UI-Schwere) | wenig visuell neuer Scope | Fokus auf Inhaltsqualität + Conversionpfad statt zusätzlicher UI-Schicht |
| Nutrition Lead | Harmonisierung ausgebaut: stärkere Synonyme, Unit-Cleanup, Source-aware Kandidaten-Harmonisierung, bessere Canonical-/Taxonomie-Konsistenz | Fehlklassifikation bei Randbegriffen | bekannte Canonicals priorisieren, Soft-Food-Fallback konservativ belassen |
| AgentOps Lead | Validierung erweitert: Scraper-Output-Contract, `__NEXT_DATA__` Fallback-Test, source-tag Harmonisierung, erweitertes Matching-Coverage-Testset | längere Tests | kleine Fixtures, Testlaufzeit weiterhin schlank (~3s) |

Integration Review:
- Retailer-Pipeline (Migros/Coop/Aldi/Lidl) nutzt jetzt robustere Selektor- und JSON-Fallback-Ketten mit Source-gewichteter Auswahl.
- Ingredient-Normalisierung/Harmonisierung wurde um source-aware Dedup und zusätzliche Synonyme erweitert; Matching trifft Angebotslage zuverlässiger.
- SEO/UX-Elemente bleiben aktiv (Intent-Landing, Cluster, strukturierte Daten, Linkhubs, Freshness, Print/Export), Plattform bleibt leichtgewichtig (SSR + SQLite, 0 neue Runtime-Dependencies).

## Iteration 9

| Rolle | Beitrag | Risiko | Decision |
|---|---|---|---|
| CEO | Genau ein Night-Loop auf Priorität „Retailer-Qualität + Matching-Fit + stabile SEO-UX-Flächen“ durchgezogen | Verzettelung über alte Backlogs | Scope strikt auf 4 Händler + Mapping + Tests begrenzt |
| CTO | Extraktionsstrategie vertieft: source-priorisierte Raw-Dedupe, differenzierte JSON-Source-Tags (`ld+json`/`__NEXT_DATA__`), robustere Kandidatenauswahl | Heuristik-Overfit | konservative Schwellen + Fill-up-Fallback beibehalten |
| CFO | Lightweight-Grenze eingehalten (0 neue Dependencies), nur modulare Service-/Test-Änderungen | steigende Heuristik-Wartung | klare Helper-Funktionen + Contract-Tests als Kostenbremse |
| Designer | Bestehende Intent-/Cluster-/Index-/Print-Flows bewusst stabil gehalten (kein zusätzlicher UI-Overhead) | visuell wenig „neu“ | Fokus auf Relevanz/Conversion über Datenqualität |
| Nutrition Lead | Harmonisierung erweitert (Retail-Label/Preis/Einheit-Cleanup, zusätzliche Synonyme wie Courgette/Kefir, konsistentere Canonicals) | Fehlmapping bei Randbegriffen | bekannte Canonicals priorisieren, Soft-Fallback konservativ |
| AgentOps Lead | Validierungstests ergänzt: JSON-vs-selector-Dedupe, Unit/Label-Cleanup-Mapping, cross-retailer vegan Matching | zusätzliche Testlaufzeit | kleine Fixtures, schnelle Einzeltests, grüner Gesamtlauf |

Integration Review:
- Vier Retailer profitieren von robusterer Extraction + Dedupe + JSON-Fallback-Auswertung.
- Ingredient-Normalisierung/Harmonisierung verbessert Canonical-Qualität und reduziert Label-/Preisrauschen.
- Menü-Matching richtet sich stärker nach realer Angebotslage (inkl. retailer-diversity Signal), bei unverändert leichtgewichtiger Architektur.

## Iteration 10

| Rolle | Beitrag | Risiko | Decision |
|---|---|---|---|
| CEO | Einen fokussierten Night-Loop auf Händlerdatenqualität + Mapping + Matching abgeschlossen; SEO/UX-Flächen stabil gehalten statt Scope-Erweiterung | zu wenig sichtbare UI-Neuerung | Impact vor Oberfläche: Datenqualität zuerst |
| CTO | Retailer-Crawler pro Händler vertieft: zusätzliche Selektoren, neue Link-Hint-Fallback-Extraktion, relaxte-but-scored Finalauswahl statt hartem Cutoff | mehr Heuristikfläche | source-priority + fallback-fill als robuste Kette |
| CFO | Lightweight-Guardrail gehalten: 0 neue Runtime-Dependencies, nur bestehende Module/Tests erweitert | langfristige Wartungskosten | modulare Helper + Contract-Tests als Absicherung |
| Designer | Bestehende Intent-/Cluster-/Index-/Internal-Link-Hubs bewusst unverändert gehalten, um UX nicht zu überladen | wahrgenommene Stagnation | Conversionpfad stabil, keine UI-Schwere |
| Nutrition Lead | Canonical-Harmonisierung erweitert (Rindshack, Cherrytomaten, Blattspinat), Unit-/Preis-Cleanup verbessert; Canonical-Namen konsistenter über Händler | Fehlklassifikation bei Randbegriffen | bekannte Canonicals priorisiert, Soft-Fallback bleibt |
| AgentOps Lead | Neue Validierungstests ergänzt (Link-Hint-Scraping, erweiterte Alias-Normalisierung); vollständige Suite weiterhin grün | längere Testdauer | kleine Fixtures, schneller Gesamtlauf (~3s) |

Integration Review:
- Migros/Coop/Aldi/Lidl profitieren jetzt zusätzlich von link-basiertem Fallback neben Selector/JSON-Pfaden.
- Ingredient-Harmonisierung liefert konsistentere Canonicals und reduziert retail-spezifisches Labelrauschen weiter.
- Menü-Matching nutzt Taxonomie robuster (Keyword-Normalisierung via normalizer), bleibt leichtgewichtig (SSR/SQLite, keine neuen Pakete).

