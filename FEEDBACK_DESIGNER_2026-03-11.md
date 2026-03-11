# Designer Feedback (Senior QA)

## Core UX issue
Die App zeigt im Hero "Tagesmenü" + aktive Rezeptlinks, obwohl der Inhalt im Status `draft` und teils nicht verfügbar ist. Das verletzt Erwartungskonsistenz und Vertrauen.

## UX recommendations (prioritized)
1. **Status clarity first (High)**
   - Wenn `draft`: sichtbarer Hinweistext unter Titel:
     - "Entwurf – Rezepte werden gerade vorbereitet"
   - Badge allein ist zu wenig.

2. **Action gating (High)**
   - Bei unvollständigem Menü Rezept-CTAs deaktivieren/ausblenden.
   - Stattdessen sekundäre Aktion: "Archiv ansehen" oder "Später erneut laden".

3. **Information architecture (Medium)**
   - Begriffe trennen:
     - "Tagesmenü" = heute verfügbar
     - "Neuster Entwurf" = nicht final
   - Sonst semantischer Konflikt für User.

4. **Error-state design for recipe pages (Medium)**
   - Nicht nur Plain-Text "Rezept nicht gefunden."
   - Eigener Error-Card-State mit Recovery-Optionen:
     - zurück zum Menü
     - zum Archiv

5. **Mobile micro-UX (Medium)**
   - Auf 390px gut lesbar, aber Linkdichte pro Listitem hoch.
   - Optional: pro Slot Card-Pattern statt Inline-Link, für bessere Touch-Sicherheit.

## Copy proposals
- Draft-Hinweis: "Dieses Menü ist ein Entwurf. Einzelne Rezepte können noch fehlen."
- Disabled CTA label: "Rezept folgt"
- Error headline: "Dieses Rezept ist noch nicht verfügbar"
