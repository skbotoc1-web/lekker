import { migrate, db } from '../src/core/db.js';

const guidelineMd = `# Koch-Richtlinie

- Fokus auf proteinreiche Mahlzeiten.
- Orientierung an den Schweizer Ernährungsempfehlungen (BLV).
- Täglich vegane und nicht-vegane Option.
- Hohe Wiederholung vermeiden (insb. Pasta nicht täglich).
- Wochen-CO2-Bilanz niedrig halten (mehr pflanzlich, weniger Rind).
`;

migrate();

db.prepare('INSERT INTO guidelines (version, markdown, created_at) VALUES (?, ?, ?)')
  .run('1.0.0', guidelineMd, new Date().toISOString());

console.log('Guidelines seeded.');
