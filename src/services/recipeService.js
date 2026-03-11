import { db } from '../core/db.js';
import { normalizeSlotMeta } from './recipeMeta.js';

function normalizeCo2Label(value) {
  if (value <= 1.6) return 'grün';
  if (value <= 3.5) return 'gelb';
  return 'rot';
}

function buildMeta(slot, vegan, title) {
  const base = {
    servings: 1,
    difficulty: slot === 'abendessen' ? 3 : slot === 'mittagessen' ? 2 : 1,
    timeMin: slot === 'abendessen' ? 40 : slot === 'mittagessen' ? 25 : slot === 'fruehstueck' ? 10 : 3,
    kcal: slot === 'abendessen' ? (vegan ? 560 : 620) : slot === 'mittagessen' ? (vegan ? 500 : 520) : slot === 'fruehstueck' ? 390 : slot === 'snack' ? 220 : 5,
    co2Label: slot === 'drink' ? 'grün' : slot === 'snack' ? 'gelb-grün' : slot === 'abendessen' ? 'gelb' : slot === 'mittagessen' ? 'gelb' : 'grün bis gelb',
    titleMarketing: '',
    subtitle: '',
    proteinHint: vegan ? 'Protein: mittel' : 'Protein: hoch'
  };

  if (slot === 'fruehstueck') {
    base.titleMarketing = vegan ? 'Sonnenstart im Glas' : 'Alpenmorgen im Glas';
    base.subtitle = `${title} mit Crunch, Frische und leichtem Zimthauch`;
  }
  if (slot === 'mittagessen') {
    base.titleMarketing = vegan ? 'Quinoa-Garten ohne Umweg' : 'Quinoa-Garten mit Zitronen-Poulet';
    base.subtitle = `${title} mit Kräutern, Gemüse und leichter Vinaigrette`;
  }
  if (slot === 'abendessen') {
    base.titleMarketing = vegan ? 'Abendruhe vom Blech' : 'Forelle der Abendruhe';
    base.subtitle = `${title} auf Ofengemüse mit Kräuternote`;
  }
  if (slot === 'snack') {
    base.titleMarketing = vegan ? 'Nusskraft Pause' : 'Skyr-Noisette';
    base.subtitle = `${title} als schneller Protein-Zvieri`;
    base.proteinHint = vegan ? 'Protein: leicht-mittel' : 'Protein: mittel';
  }
  if (slot === 'drink') {
    base.titleMarketing = 'Infusion claire';
    base.subtitle = `${title} – klar, frisch und alltagstauglich`;
    base.proteinHint = 'Protein: minimal';
  }

  return base;
}

function buildBySlot(slot, vegan, title) {
  const meta = buildMeta(slot, vegan, title);

  if (slot === 'fruehstueck') {
    return {
      title,
      ingredients: [
        vegan ? '200 g Soja-Skyr natur' : '200 g Skyr nature',
        '50 g Haferflocken',
        '150 g Früchte (Beeren, Apfel oder Birne)',
        vegan ? '1 TL Chiasamen (optional)' : '1 TL Leinsamen oder Chiasamen (optional)',
        'etwas Zimt'
      ],
      steps: [
        'Haferflocken 2 Minuten trocken in der Pfanne anrösten.',
        `${vegan ? 'Soja-Skyr' : 'Skyr'} in eine Schale geben.`,
        'Früchte darüber verteilen, Haferflocken und optionale Samen daraufgeben.',
        'Mit etwas Zimt abschliessen.'
      ],
      tipsShopping: [
        `${vegan ? 'Soja-Skyr' : 'Skyr'} möglichst nature und ungesüsst wählen.`,
        'Früchte saisonal und regional einkaufen; tiefgekühlte Beeren sind ausserhalb der Saison ideal.'
      ],
      tipsCooking: [
        'Das kurze Rösten macht die Bowl deutlich aromatischer.',
        'Zimt sparsam dosieren, damit die Fruchtfrische bleibt.'
      ],
      meta
    };
  }

  if (slot === 'mittagessen') {
    const protein = vegan ? '150 g Kichererbsen oder Linsen, gekocht' : '120 g Pouletbrust';
    return {
      title,
      ingredients: [
        protein,
        '60 g Quinoa (trocken)',
        '200 g gemischtes Gemüse (Gurke, Cherrytomaten, Peperoni, Blattsalat)',
        '1 EL Raps- oder Olivenöl',
        'Saft von 1/2 Zitrone',
        'Petersilie oder Schnittlauch',
        'Salz, Pfeffer'
      ],
      steps: [
        'Quinoa gründlich waschen und in Wasser 12–15 Minuten garen.',
        vegan ? 'Kichererbsen/Linsen kurz mit wenig Öl und Gewürzen erwärmen.' : 'Poulet würzen und in wenig Öl beidseitig goldbraun anbraten.',
        'Gemüse klein schneiden.',
        'Aus Zitronensaft, Öl, Kräutern, Salz und Pfeffer ein Dressing rühren.',
        `Quinoa mit Gemüse mischen, ${vegan ? 'Hülsenfrüchte' : 'Poulet in Scheiben'} daraufsetzen, Dressing darübergeben.`
      ],
      tipsShopping: [
        'Quinoa immer gut spülen, damit der bittere Randstoff verschwindet.',
        'Bei hoher Wochen-CO₂-Bilanz öfter die pflanzliche Proteinoption wählen.'
      ],
      tipsCooking: [
        vegan ? 'Linsen/Kichererbsen nur kurz erwärmen, damit sie Biss behalten.' : 'Poulet nicht zu lange braten, sonst wird es trocken.',
        'Dressing erst kurz vor dem Servieren dazugeben.'
      ],
      meta
    };
  }

  if (slot === 'abendessen') {
    const protein = vegan ? '180 g Tofu natur' : '160 g Forellenfilet';
    return {
      title,
      ingredients: [
        protein,
        '200 g Kartoffeln',
        '300 g Ofengemüse (Karotte, Zucchetti, Brokkoli, rote Zwiebel)',
        '1 EL Raps- oder Olivenöl',
        'etwas Zitronensaft',
        'Rosmarin oder Thymian',
        'Salz, Pfeffer'
      ],
      steps: [
        'Ofen auf 200 °C vorheizen.',
        'Kartoffeln und festes Gemüse mit Öl, Kräutern, Salz und Pfeffer mischen und 20 Minuten backen.',
        'Zarteres Gemüse ergänzen und weitere 10–15 Minuten garen.',
        vegan
          ? 'Tofu trocken tupfen, würzen und in der Pfanne 3–4 Minuten pro Seite anbraten.'
          : 'Forelle trocken tupfen, leicht salzen und 2–3 Minuten auf der Hautseite anbraten, dann kurz wenden.',
        'Mit Zitronensaft vollenden und auf dem Ofengemüse anrichten.'
      ],
      tipsShopping: [
        vegan ? 'Tofu natur mit fester Struktur wählen, damit er schön bräunt.' : 'Forelle möglichst frisch und wenn möglich regional wählen.',
        'Gemüse saisonal variieren für bessere CO₂-Bilanz.'
      ],
      tipsCooking: [
        vegan ? 'Tofu vorher gut trocknen und ggf. leicht pressen.' : 'Fischhaut vor dem Braten wirklich trocken halten.',
        'Öl nicht überhitzen; sobald es raucht, sinkt die Qualität.'
      ],
      meta
    };
  }

  if (slot === 'snack') {
    return {
      title,
      ingredients: [
        vegan ? '150 g Soja-Skyr nature' : '150 g Skyr nature',
        '20 g Nüsse (Walnüsse oder Mandeln)',
        'optional 1–2 Apfelschnitze'
      ],
      steps: [
        `${vegan ? 'Soja-Skyr' : 'Skyr'} in eine kleine Schale geben.`,
        'Nüsse grob hacken und darüberstreuen.',
        'Optional mit Apfelschnitzen ergänzen.'
      ],
      tipsShopping: [
        'Ungesalzene Nüsse verwenden.',
        'Natur-Produkt ohne zugesetzten Zucker bevorzugen.'
      ],
      tipsCooking: [
        'Nüsse erst kurz vor dem Essen dazugeben, damit der Crunch bleibt.'
      ],
      meta
    };
  }

  // drink
  return {
    title,
    ingredients: [
      '1–2 Liter Wasser',
      '2–3 Limettenscheiben oder etwas Limettensaft'
    ],
    steps: [
      'Wasser in Karaffe oder Flasche füllen.',
      'Limette dazugeben und 10 Minuten ziehen lassen.'
    ],
    tipsShopping: [
      'Hahnenwasser ist in der Schweiz ökologisch und qualitativ top.',
      'Limette bringt Geschmack ohne Zuckerfalle.'
    ],
    tipsCooking: [
      'Kalt servieren für mehr Frische.',
      'Mit Minze oder Gurke variieren.'
    ],
    meta: { ...meta, kcal: 5, difficulty: 1, timeMin: 2, co2Label: normalizeCo2Label(0.2) }
  };
}

export function generateRecipesForMenu(menu) {
  db.prepare('DELETE FROM recipes WHERE menu_id = ?').run(menu.id);

  const entries = [
    ['vegan', 'fruehstueck', menu.vegan_breakfast, true],
    ['vegan', 'mittagessen', menu.vegan_lunch, true],
    ['vegan', 'abendessen', menu.vegan_dinner, true],
    ['vegan', 'snack', menu.vegan_snack, true],
    ['vegan', 'drink', menu.vegan_drink, true],
    ['omni', 'fruehstueck', menu.omni_breakfast, false],
    ['omni', 'mittagessen', menu.omni_lunch, false],
    ['omni', 'abendessen', menu.omni_dinner, false],
    ['omni', 'snack', menu.omni_snack, false],
    ['omni', 'drink', menu.omni_drink, false]
  ];

  const stmt = db.prepare('INSERT INTO recipes (menu_id, option_type, meal_slot, title, ingredients, steps, meta) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const [optionType, slot, title, vegan] of entries) {
    const recipe = buildBySlot(slot, vegan, title);
    const meta = normalizeSlotMeta({
      ...recipe.meta,
      tipsShopping: recipe.tipsShopping,
      tipsCooking: recipe.tipsCooking
    }, slot);
    stmt.run(
      menu.id,
      optionType,
      slot,
      recipe.title,
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.steps),
      JSON.stringify(meta)
    );
  }

  return db.prepare('SELECT * FROM recipes WHERE menu_id = ? ORDER BY option_type, meal_slot').all(menu.id);
}
