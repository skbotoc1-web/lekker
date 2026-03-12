import { db } from '../core/db.js';
import { normalizeSlotMeta } from './recipeMeta.js';

function normalizeCo2Label(value) {
  if (value <= 1.6) return 'grün';
  if (value <= 3.5) return 'gelb';
  return 'rot';
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function hasStem(text, pattern) {
  return new RegExp(`(${pattern})`, 'i').test(text);
}

const PROTEIN_LIBRARY = {
  tofu: {
    key: 'tofu',
    family: 'vegan',
    ingredient: '180 g Tofu natur',
    proteinHint: 'Protein: mittel-hoch',
    shoppingTip: 'Tofu natur mit fester Struktur wählen.',
    cookingTip: 'Tofu vor dem Braten gut trocken tupfen.'
  },
  linsen: {
    key: 'linsen',
    family: 'vegan',
    ingredient: '180 g Linsen, gekocht',
    proteinHint: 'Protein: mittel',
    shoppingTip: 'Linsen in Bio-Qualität und ohne Zusätze bevorzugen.',
    cookingTip: 'Linsen nur kurz erhitzen, damit sie nicht zerfallen.'
  },
  kichererbsen: {
    key: 'kichererbsen',
    family: 'vegan',
    ingredient: '180 g Kichererbsen, gekocht',
    proteinHint: 'Protein: mittel',
    shoppingTip: 'Kichererbsen gründlich abspülen, wenn sie aus der Dose kommen.',
    cookingTip: 'Kichererbsen zum Schluss unterheben, damit sie Biss behalten.'
  },
  bohnen: {
    key: 'bohnen',
    family: 'vegan',
    ingredient: '180 g Bohnen, gekocht',
    proteinHint: 'Protein: mittel',
    shoppingTip: 'Bohnen mit wenig Salz kaufen und selbst würzen.',
    cookingTip: 'Bohnen nicht zu lange kochen, damit sie nicht mehlig werden.'
  },
  sojaskyr: {
    key: 'sojaskyr',
    family: 'vegan',
    ingredient: '200 g Soja-Skyr natur',
    proteinHint: 'Protein: leicht-mittel',
    shoppingTip: 'Soja-Skyr nature ohne Zuckerzusatz wählen.',
    cookingTip: 'Soja-Skyr nur kalt verwenden, nicht kochen.'
  },
  skyr: {
    key: 'skyr',
    family: 'dairy',
    ingredient: '200 g Skyr nature',
    proteinHint: 'Protein: hoch',
    shoppingTip: 'Skyr nature ohne zugesetzten Zucker wählen.',
    cookingTip: 'Skyr erst beim Servieren einarbeiten.'
  },
  huettenkaese: {
    key: 'huettenkaese',
    family: 'dairy',
    ingredient: '160 g Hüttenkäse',
    proteinHint: 'Protein: mittel-hoch',
    shoppingTip: 'Hüttenkäse natur wählen und frisch halten.',
    cookingTip: 'Hüttenkäse nicht stark erhitzen, eher kalt verwenden.'
  },
  eier: {
    key: 'eier',
    family: 'egg',
    ingredient: '2 Eier',
    proteinHint: 'Protein: hoch',
    shoppingTip: 'Eier aus regionaler Haltung bevorzugen.',
    cookingTip: 'Eier nur bis zur gewünschten Bindung stocken lassen.'
  },
  kefir: {
    key: 'kefir',
    family: 'dairy',
    ingredient: '250 ml Kefir nature',
    proteinHint: 'Protein: mittel',
    shoppingTip: 'Kefir natur ohne Zuckerzusatz verwenden.',
    cookingTip: 'Kefir immer kalt verarbeiten.'
  },
  kaese: {
    key: 'kaese',
    family: 'dairy',
    ingredient: '80 g Käsewürfel',
    proteinHint: 'Protein: mittel',
    shoppingTip: 'Milden, gut schneidbaren Käse wählen.',
    cookingTip: 'Käse für Snacks nicht zu früh schneiden.'
  },
  poulet: {
    key: 'poulet',
    family: 'meat',
    ingredient: '140 g Pouletbrust',
    proteinHint: 'Protein: hoch',
    shoppingTip: 'Poulet möglichst aus CH-Herkunft wählen.',
    cookingTip: 'Kerntemperatur von 72 °C für sichere Garung einhalten.'
  },
  rind: {
    key: 'rind',
    family: 'meat',
    ingredient: '140 g Rindstreifen',
    proteinHint: 'Protein: hoch',
    shoppingTip: 'Mageres Rindfleisch für kurze Garzeiten wählen.',
    cookingTip: 'Rind sehr heiß und kurz anbraten, dann ruhen lassen.'
  },
  forelle: {
    key: 'forelle',
    family: 'fish',
    ingredient: '160 g Forellenfilet',
    proteinHint: 'Protein: hoch',
    shoppingTip: 'Forelle möglichst frisch und regional einkaufen.',
    cookingTip: 'Fischhaut trocken halten und zuerst auf der Hautseite braten.'
  },
  lachs: {
    key: 'lachs',
    family: 'fish',
    ingredient: '160 g Lachsfilet',
    proteinHint: 'Protein: hoch',
    shoppingTip: 'Lachsfilet gleichmäßig dick kaufen für saubere Garung.',
    cookingTip: 'Lachs bei mittlerer Hitze glasig garen.'
  },
  thunfisch: {
    key: 'thunfisch',
    family: 'fish',
    ingredient: '140 g Thunfisch (abgetropft)',
    proteinHint: 'Protein: hoch',
    shoppingTip: 'Thunfisch in nachhaltiger Fangqualität bevorzugen.',
    cookingTip: 'Thunfisch nur kurz erhitzen, damit er nicht austrocknet.'
  }
};

const VEGAN_KEYS = ['tofu', 'linsen', 'kichererbsen', 'bohnen', 'sojaskyr'];
const OMNI_KEYS = ['poulet', 'rind', 'forelle', 'lachs', 'thunfisch', 'skyr', 'huettenkaese', 'eier', 'kefir', 'kaese'];

function inferProteinProfile(title, vegan, slot) {
  const text = normalizeText(title);

  if (vegan) {
    if (hasStem(text, 'tofu')) return PROTEIN_LIBRARY.tofu;
    if (hasStem(text, 'linsen')) return PROTEIN_LIBRARY.linsen;
    if (hasStem(text, 'kichererbsen|hummus')) return PROTEIN_LIBRARY.kichererbsen;
    if (hasStem(text, 'bohnen')) return PROTEIN_LIBRARY.bohnen;
    if (hasStem(text, 'soja|porridge|bowl|joghurt')) return PROTEIN_LIBRARY.sojaskyr;

    if (slot === 'fruehstueck') return PROTEIN_LIBRARY.sojaskyr;
    if (slot === 'mittagessen') return PROTEIN_LIBRARY.kichererbsen;
    if (slot === 'abendessen') return PROTEIN_LIBRARY.tofu;
    return PROTEIN_LIBRARY.kichererbsen;
  }

  if (hasStem(text, 'forelle')) return PROTEIN_LIBRARY.forelle;
  if (hasStem(text, 'lachs')) return PROTEIN_LIBRARY.lachs;
  if (hasStem(text, 'thunfisch')) return PROTEIN_LIBRARY.thunfisch;
  if (hasStem(text, 'fisch')) return PROTEIN_LIBRARY.forelle;
  if (hasStem(text, 'poulet|huhn|hahnchen|haehnchen')) return PROTEIN_LIBRARY.poulet;
  if (hasStem(text, 'rind|beef')) return PROTEIN_LIBRARY.rind;
  if (hasStem(text, 'eier|egg')) return PROTEIN_LIBRARY.eier;
  if (hasStem(text, 'huttenkase|huettenkaese|huttenkase|huttengaese|hüttenkäse|hüttenkase')) return PROTEIN_LIBRARY.huettenkaese;
  if (hasStem(text, 'skyr')) return PROTEIN_LIBRARY.skyr;
  if (hasStem(text, 'kefir')) return PROTEIN_LIBRARY.kefir;
  if (hasStem(text, 'kase|kaese|käse')) return PROTEIN_LIBRARY.kaese;

  if (slot === 'fruehstueck') return PROTEIN_LIBRARY.skyr;
  if (slot === 'mittagessen') return PROTEIN_LIBRARY.poulet;
  if (slot === 'abendessen') return PROTEIN_LIBRARY.forelle;
  if (slot === 'snack') return PROTEIN_LIBRARY.skyr;
  return PROTEIN_LIBRARY.poulet;
}

function inferBaseComponent(title, slot) {
  const text = normalizeText(title);

  if (slot === 'drink') return null;
  if (slot === 'snack') return null;

  if (slot === 'fruehstueck' && hasStem(text, 'porridge')) {
    return {
      ingredient: '55 g Haferflocken',
      prep: 'Haferflocken mit 180 ml Flüssigkeit 4–5 Minuten sanft köcheln lassen.'
    };
  }

  if (hasStem(text, 'pasta|nudeln?|spaghetti|penne')) {
    return {
      ingredient: '80 g Vollkornpasta (trocken)',
      prep: 'Vollkornpasta nach Packung al dente kochen.'
    };
  }

  if (hasStem(text, 'reis|risotto')) {
    return {
      ingredient: '70 g Vollkornreis (trocken)',
      prep: 'Reis waschen und in leicht gesalzenem Wasser garen.'
    };
  }

  if (hasStem(text, 'kartoffel')) {
    return {
      ingredient: '250 g Kartoffeln',
      prep: slot === 'abendessen'
        ? 'Kartoffeln in Spalten schneiden und im Ofen garen.'
        : 'Kartoffeln in wenig Salzwasser garen.'
    };
  }

  if (hasStem(text, 'quinoa')) {
    return {
      ingredient: '60 g Quinoa (trocken)',
      prep: 'Quinoa gründlich waschen und 12–15 Minuten garen.'
    };
  }

  if (slot === 'abendessen' && hasStem(text, 'pfanne|stir[-\s]?fry')) {
    return {
      ingredient: '70 g Vollkornreis (trocken)',
      prep: 'Vollkornreis vorkochen und abtropfen lassen.'
    };
  }

  if (slot === 'fruehstueck') {
    return {
      ingredient: '50 g Haferflocken',
      prep: 'Haferflocken kurz trocken anrösten.'
    };
  }

  if (slot === 'mittagessen') {
    return {
      ingredient: '60 g Quinoa (trocken)',
      prep: 'Quinoa gründlich waschen und 12–15 Minuten garen.'
    };
  }

  return {
    ingredient: '250 g Kartoffeln',
    prep: 'Kartoffeln in Spalten schneiden und im Ofen garen.'
  };
}

function inferVegetableSet(title, slot) {
  const text = normalizeText(title);

  if (slot === 'drink') return [];
  if (slot === 'snack') return ['1 kleine Frucht nach Wahl'];

  const vegetables = [];
  if (hasStem(text, 'bohnen')) vegetables.push('120 g grüne Bohnen');
  if (hasStem(text, 'spinat')) vegetables.push('80 g Spinat');
  if (hasStem(text, 'brokkoli')) vegetables.push('120 g Brokkoli');
  if (hasStem(text, 'tomaten?')) vegetables.push('120 g Tomaten');
  if (hasStem(text, 'zucchini|zucchetti')) vegetables.push('120 g Zucchini');
  if (hasStem(text, 'peperoni|paprika')) vegetables.push('100 g Peperoni');

  if (!vegetables.length) {
    vegetables.push(slot === 'fruehstueck' ? '150 g Früchte (Beeren oder Apfel)' : '220 g gemischtes Gemüse');
  }

  return vegetables;
}

function monthFromMenuDay(day) {
  if (!day) return new Date().getUTCMonth() + 1;
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return new Date().getUTCMonth() + 1;
  return parsed.getUTCMonth() + 1;
}

function seasonFromMonth(month) {
  if ([12, 1, 2].includes(month)) return 'winter';
  if ([3, 4, 5].includes(month)) return 'fruehling';
  if ([6, 7, 8].includes(month)) return 'sommer';
  return 'herbst';
}

function stableIndex(seed, max) {
  if (!max) return 0;
  let hash = 0;
  for (const char of String(seed || 'lekker')) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  return hash % max;
}

const SEASONAL_HERBS = {
  winter: ['Rosmarin', 'Thymian', 'Majoran'],
  fruehling: ['Bärlauch', 'Schnittlauch', 'Petersilie'],
  sommer: ['Basilikum', 'Dill', 'Minze'],
  herbst: ['Salbei', 'Estragon', 'Petersilie']
};

const CUISINE_PROFILES = {
  alpin: {
    label: 'alpin-schweizerisch',
    spices: ['Muskat', 'Kümmel', 'Paprika edelsüss']
  },
  mediterran: {
    label: 'mediterran',
    spices: ['Oregano', 'Thymian', 'Paprika edelsüss']
  },
  levantinisch: {
    label: 'levantinisch',
    spices: ['Kreuzkümmel', 'Koriander', 'Sumach']
  },
  indisch: {
    label: 'indisch',
    spices: ['Kurkuma', 'Garam Masala', 'Kreuzkümmel']
  },
  asiatisch: {
    label: 'asiatisch',
    spices: ['Ingwer', 'Chili', 'Sesam']
  },
  mexikanisch: {
    label: 'mexikanisch',
    spices: ['Geräucherte Paprika', 'Kreuzkümmel', 'Oregano']
  },
  nordisch: {
    label: 'nordisch',
    spices: ['Dill', 'Senfsaat', 'Zitronenabrieb']
  }
};

function inferCuisineKey(title, slot, protein, vegan) {
  const text = normalizeText(title);

  if (hasStem(text, 'curry|masala|dal|korma')) return 'indisch';
  if (hasStem(text, 'chili|taco|mex')) return 'mexikanisch';
  if (hasStem(text, 'stir|wok|thai|asia|asiat')) return 'asiatisch';
  if (hasStem(text, 'hummus|sumach|kichererbsen|quinoa|bowl')) return 'levantinisch';
  if (hasStem(text, 'pasta|bolognese|risotto|mediterran|ital')) return 'mediterran';

  if (protein?.family === 'fish') return 'nordisch';
  if (protein?.family === 'meat' && hasStem(text, 'rind|beef')) return 'alpin';
  if (protein?.family === 'meat') return 'mediterran';
  if (slot === 'fruehstueck' && vegan && hasStem(text, 'porridge')) return 'nordisch';

  return vegan ? 'levantinisch' : 'alpin';
}

function buildFlavorProfile({ title, slot, protein, vegan, day }) {
  const cuisineKey = inferCuisineKey(title, slot, protein, vegan);
  const cuisine = CUISINE_PROFILES[cuisineKey] || CUISINE_PROFILES.alpin;
  const month = monthFromMenuDay(day);
  const season = seasonFromMonth(month);
  const herbs = SEASONAL_HERBS[season] || SEASONAL_HERBS.herbst;
  const herb = herbs[stableIndex(`${title}:${slot}:${season}`, herbs.length)];

  const spiceIngredient = `Gewürzprofil (${cuisine.label}): ${cuisine.spices.join(', ')}`;
  const herbIngredient = `Frische Kräuter (${season}): ${herb}`;

  let spiceStep = `Gewürze (${cuisine.spices.join(', ')}) kurz im Öl anrösten, damit die Aromen sich entfalten.`;
  if (slot === 'fruehstueck') spiceStep = `Gewürze (${cuisine.spices.join(', ')}) fein dosieren und harmonisch einarbeiten.`;
  if (slot === 'snack') spiceStep = `Gewürze (${cuisine.spices.join(', ')}) direkt in Dip oder Topping einrühren.`;

  return {
    cuisineLabel: cuisine.label,
    spices: cuisine.spices,
    herb,
    spiceIngredient,
    herbIngredient,
    spiceStep,
    shoppingTip: `${cuisine.label}: Gewürze idealerweise ganz kaufen und frisch mörsern.`,
    herbTip: `${herb} erst gegen Ende einarbeiten, damit Frische und Aroma erhalten bleiben.`
  };
}

function buildMeta(slot, vegan, title, protein, flavor) {
  const defaults = {
    servings: 1,
    difficulty: slot === 'abendessen' ? 3 : slot === 'mittagessen' ? 2 : 1,
    timeMin: slot === 'abendessen' ? 40 : slot === 'mittagessen' ? 25 : slot === 'fruehstueck' ? 10 : slot === 'snack' ? 5 : 3,
    kcal: slot === 'abendessen' ? (vegan ? 560 : 620) : slot === 'mittagessen' ? (vegan ? 500 : 540) : slot === 'fruehstueck' ? 390 : slot === 'snack' ? 220 : 5,
    co2Label: slot === 'drink' ? 'grün' : slot === 'snack' ? 'gelb-grün' : slot === 'abendessen' ? 'gelb' : slot === 'mittagessen' ? 'gelb' : 'grün bis gelb',
    titleMarketing: title,
    subtitle: '',
    proteinHint: protein?.proteinHint || (vegan ? 'Protein: mittel' : 'Protein: hoch')
  };

  if (slot === 'fruehstueck') defaults.subtitle = `${title} als strukturierter Start in den Tag.`;
  if (slot === 'mittagessen') defaults.subtitle = `${title} mit klarer Zutatenlogik und sauberer Zubereitung.`;
  if (slot === 'abendessen') defaults.subtitle = `${title} mit konsistenter Proteinführung und passender Beilage.`;
  if (slot === 'snack') defaults.subtitle = `${title} als schneller, ausgewogener Protein-Snack.`;
  if (slot === 'drink') defaults.subtitle = `${title} – frisch, zuckerfrei und alltagstauglich.`;

  if (flavor?.cuisineLabel) {
    defaults.subtitle = `${defaults.subtitle} Inspiriert von ${flavor.cuisineLabel}er Küche mit ${flavor.herb}.`;
  }

  if (protein?.family === 'fish') {
    defaults.co2Label = slot === 'abendessen' ? 'gelb' : defaults.co2Label;
    defaults.kcal = Math.max(320, defaults.kcal - 20);
  }

  if (protein?.family === 'meat') {
    defaults.co2Label = slot === 'abendessen' ? 'gelb' : defaults.co2Label;
  }

  if (protein?.family === 'vegan') {
    defaults.co2Label = slot === 'abendessen' ? 'gelb' : 'grün bis gelb';
  }

  return defaults;
}

function buildBreakfastRecipe({ title, vegan, protein, meta, flavor }) {
  const text = normalizeText(title);

  if (!vegan && protein.key === 'eier') {
    return {
      title,
      ingredients: [
        '2 Eier',
        '60 g Spinat',
        '1 kleine Tomate, gewürfelt',
        '1 TL Olivenöl',
        '1 Scheibe Vollkornbrot',
        'Salz, Pfeffer',
        flavor.spiceIngredient,
        flavor.herbIngredient
      ],
      steps: [
        'Backofen auf 180 °C vorheizen.',
        'Eier mit Salz und Pfeffer verquirlen, Spinat und Tomate einrühren.',
        flavor.spiceStep,
        'Masse in eine kleine Form geben und 12–15 Minuten stocken lassen.',
        `Zum Schluss ${flavor.herb} fein hacken und darübergeben.`,
        'Mit Vollkornbrot servieren.'
      ],
      tipsShopping: [
        protein.shoppingTip,
        'Frischen Spinat bevorzugen; TK-Spinat gut ausdrücken.',
        flavor.shoppingTip
      ],
      tipsCooking: [
        protein.cookingTip,
        'Eiermischung nicht überbacken, damit sie saftig bleibt.',
        flavor.herbTip
      ],
      meta,
      protein
    };
  }

  if (!vegan && protein.key === 'huettenkaese') {
    return {
      title,
      ingredients: [
        '160 g Hüttenkäse',
        '2 Scheiben Vollkornbrot',
        '1 Tomate in Scheiben',
        '1 TL Olivenöl',
        'Pfeffer',
        flavor.spiceIngredient,
        flavor.herbIngredient
      ],
      steps: [
        'Vollkornbrot kurz toasten.',
        flavor.spiceStep,
        'Hüttenkäse auf dem Brot verteilen.',
        `Tomate auflegen, mit Öl und ${flavor.herb} abschliessen.`
      ],
      tipsShopping: [
        protein.shoppingTip,
        'Brot mit hohem Vollkornanteil wählen.',
        flavor.shoppingTip
      ],
      tipsCooking: [
        protein.cookingTip,
        'Tomaten erst kurz vor dem Servieren auflegen.',
        flavor.herbTip
      ],
      meta,
      protein
    };
  }

  if (vegan && hasStem(text, 'porridge')) {
    return {
      title,
      ingredients: [
        '55 g Haferflocken',
        '180 ml Haferdrink',
        '120 g Beeren',
        '60 g Soja-Skyr natur',
        '1 TL Chiasamen',
        flavor.spiceIngredient,
        flavor.herbIngredient
      ],
      steps: [
        'Haferflocken mit Haferdrink aufkochen und 4–5 Minuten sanft köcheln lassen.',
        flavor.spiceStep,
        'Porridge in eine Schale geben und mit Beeren toppen.',
        `Soja-Skyr sowie Chiasamen darüber verteilen und mit ${flavor.herb} fein abrunden.`
      ],
      tipsShopping: [
        'Ungesüssten Haferdrink und Soja-Skyr verwenden.',
        'Beeren je nach Saison frisch oder tiefgekühlt einkaufen.',
        flavor.shoppingTip
      ],
      tipsCooking: [
        'Beim Köcheln regelmäßig rühren, damit nichts ansetzt.',
        'Soja-Skyr erst nach dem Kochen hinzufügen.',
        flavor.herbTip
      ],
      meta,
      protein
    };
  }

  if (vegan && hasStem(text, 'tofu|ruhrei|ruehrei')) {
    return {
      title,
      ingredients: [
        '180 g Tofu natur',
        '1 TL Kurkuma',
        '1 TL Rapsöl',
        '80 g Tomatenwürfel',
        '1 Scheibe Vollkorntoast',
        'Salz, Pfeffer',
        flavor.spiceIngredient,
        flavor.herbIngredient
      ],
      steps: [
        'Tofu mit einer Gabel grob zerdrücken.',
        flavor.spiceStep,
        'Öl in einer Pfanne erhitzen und Tofu mit Kurkuma 3–4 Minuten braten.',
        'Tomaten unterheben und kurz mitgaren.',
        `Mit Salz und Pfeffer abschmecken, ${flavor.herb} einstreuen und mit Toast servieren.`
      ],
      tipsShopping: [
        protein.shoppingTip,
        'Kurkuma für Farbe und milde Würze nutzen.',
        flavor.shoppingTip
      ],
      tipsCooking: [
        protein.cookingTip,
        'Tofu nicht zu fein zerdrücken, sonst wird die Textur breiig.',
        flavor.herbTip
      ],
      meta,
      protein
    };
  }

  const dairy = vegan ? '200 g Soja-Skyr natur' : protein.ingredient;
  return {
    title,
    ingredients: [
      dairy,
      '50 g Haferflocken',
      '150 g Früchte (Beeren oder Apfel)',
      vegan ? '1 TL Chiasamen' : '1 TL Leinsamen',
      'etwas Zimt',
      flavor.spiceIngredient,
      flavor.herbIngredient
    ],
    steps: [
      'Haferflocken 2 Minuten trocken anrösten.',
      flavor.spiceStep,
      `${vegan ? 'Soja-Skyr' : 'Skyr'} in eine Schale geben.`,
      'Früchte und Haferflocken darauf verteilen.',
      `Mit Samen, etwas Zimt und ${flavor.herb} abschliessen.`
    ],
    tipsShopping: [
      vegan ? 'Soja-Skyr nature ohne Zuckerzusatz wählen.' : protein.shoppingTip,
      'Saisonale Früchte bevorzugen.',
      flavor.shoppingTip
    ],
    tipsCooking: [
      vegan ? 'Pflanzliche Basis ungesüsst halten.' : protein.cookingTip,
      'Toppings erst kurz vor dem Essen hinzufügen.',
      flavor.herbTip
    ],
    meta,
    protein
  };
}

function buildLunchRecipe({ title, vegan, protein, meta, flavor }) {
  const base = inferBaseComponent(title, 'mittagessen');
  const vegetables = inferVegetableSet(title, 'mittagessen');

  const fishProtein = protein.family === 'fish';
  const meatProtein = protein.family === 'meat';
  const plantProtein = vegan || protein.family === 'vegan';

  const proteinStep = fishProtein
    ? `${protein.key === 'thunfisch' ? 'Thunfisch kurz abtropfen und nur zum Schluss unterheben.' : `${protein.ingredient.split(' ')[2] || 'Fisch'} würzen und in wenig Öl schonend braten.`}`
    : meatProtein
      ? `${protein.key === 'rind' ? 'Rindstreifen sehr heiß und kurz anbraten.' : 'Poulet würzen und vollständig durchgaren.'}`
      : `${protein.key === 'tofu' ? 'Tofu würzen und goldbraun anbraten.' : 'Hülsenfrüchte kurz erwärmen und würzen.'}`;

  return {
    title,
    ingredients: [
      protein.ingredient,
      base.ingredient,
      ...vegetables,
      '1 EL Raps- oder Olivenöl',
      'Saft von 1/2 Zitrone',
      'Salz, Pfeffer',
      flavor.spiceIngredient,
      flavor.herbIngredient
    ],
    steps: [
      base.prep,
      flavor.spiceStep,
      proteinStep,
      'Gemüse mundgerecht schneiden und mit der Basis mischen.',
      `Dressing aus Öl, Zitrone, ${flavor.herb}, Salz und Pfeffer rühren.`,
      `${plantProtein ? 'Pflanzliches Protein' : 'Protein'} auf der Basis anrichten und Dressing darübergeben.`
    ],
    tipsShopping: [
      protein.shoppingTip,
      'Gemüse möglichst saisonal auswählen.',
      flavor.shoppingTip
    ],
    tipsCooking: [
      protein.cookingTip,
      'Dressing erst vor dem Servieren dazugeben.',
      flavor.herbTip
    ],
    meta,
    protein
  };
}

function buildDinnerRecipe({ title, vegan, protein, meta, flavor }) {
  const base = inferBaseComponent(title, 'abendessen');
  const vegetables = inferVegetableSet(title, 'abendessen');
  const text = normalizeText(title);

  const includeOven = !hasStem(text, 'pfanne|stir[-\s]?fry');

  const proteinStep = protein.family === 'fish'
    ? `${protein.key === 'thunfisch' ? 'Thunfisch abtropfen und am Schluss kurz unterheben.' : `${protein.key === 'lachs' ? 'Lachs' : 'Forelle'} trocken tupfen und 2–3 Minuten pro Seite braten.`}`
    : protein.family === 'meat'
      ? `${protein.key === 'rind' ? 'Rindstreifen scharf anbraten und danach kurz ruhen lassen.' : 'Poulet in wenig Öl rundum braten, bis es vollständig gegart ist.'}`
      : `${protein.key === 'tofu' ? 'Tofu in Würfeln goldbraun anbraten.' : 'Hülsenfrüchte separat erwärmen und würzen.'}`;

  const steps = [];
  if (includeOven) {
    steps.push('Backofen auf 200 °C vorheizen.');
    steps.push(base.prep);
    steps.push('Gemüse mit etwas Öl, Salz und Pfeffer mischen und im Ofen bissfest garen.');
  } else {
    steps.push(base.prep);
    steps.push('Gemüse in einer großen Pfanne mit etwas Öl bissfest garen.');
  }
  steps.push(flavor.spiceStep);
  steps.push(proteinStep);
  steps.push(`Alles zusammen anrichten, mit ${flavor.herb} verfeinern und mit Zitronensaft, Salz und Pfeffer abschliessen.`);

  return {
    title,
    ingredients: [
      protein.ingredient,
      base.ingredient,
      ...vegetables,
      '1 EL Raps- oder Olivenöl',
      'etwas Zitronensaft',
      'Salz, Pfeffer',
      flavor.spiceIngredient,
      flavor.herbIngredient
    ],
    steps,
    tipsShopping: [
      protein.shoppingTip,
      'Gemüse nach Saison variieren für bessere CO₂-Bilanz.',
      flavor.shoppingTip
    ],
    tipsCooking: [
      protein.cookingTip,
      'Hitze kontrollieren, Öl nicht rauchen lassen.',
      flavor.herbTip
    ],
    meta,
    protein
  };
}

function buildSnackRecipe({ title, vegan, protein, meta, flavor }) {
  const text = normalizeText(title);

  if (vegan && hasStem(text, 'hummus|kichererbsen')) {
    return {
      title,
      ingredients: [
        '120 g Hummus',
        '100 g Gemüsesticks (Karotte, Gurke)',
        '1 TL Olivenöl',
        'Paprika, Salz',
        flavor.spiceIngredient,
        flavor.herbIngredient
      ],
      steps: [
        'Gemüse in Sticks schneiden.',
        flavor.spiceStep,
        `Hummus in eine Schale geben, mit Öl sowie ${flavor.herb} toppen.`,
        'Mit Gemüsesticks servieren.'
      ],
      tipsShopping: [
        'Hummus mit kurzer Zutatenliste wählen.',
        'Gemüse frisch und knackig einkaufen.',
        flavor.shoppingTip
      ],
      tipsCooking: [
        'Gemüse erst kurz vor dem Essen schneiden.',
        'Hummus bei Bedarf mit Zitronensaft auffrischen.',
        flavor.herbTip
      ],
      meta,
      protein
    };
  }

  if (!vegan && protein.key === 'kefir') {
    return {
      title,
      ingredients: [
        '250 ml Kefir nature',
        '1/2 Banane',
        '1 EL Haferflocken',
        'etwas Zimt',
        flavor.spiceIngredient,
        flavor.herbIngredient
      ],
      steps: [
        flavor.spiceStep,
        'Alle Zutaten in den Mixer geben.',
        `20–30 Sekunden cremig mixen, mit ${flavor.herb} abrunden und kalt servieren.`
      ],
      tipsShopping: [
        protein.shoppingTip,
        'Reife Banane für natürliche Süsse verwenden.',
        flavor.shoppingTip
      ],
      tipsCooking: [
        protein.cookingTip,
        'Nicht zu lange mixen, damit die Textur frisch bleibt.',
        flavor.herbTip
      ],
      meta,
      protein
    };
  }

  if (!vegan && protein.key === 'kaese') {
    return {
      title,
      ingredients: [
        protein.ingredient,
        '1 Birne',
        '10 g Nüsse',
        flavor.spiceIngredient,
        flavor.herbIngredient
      ],
      steps: [
        flavor.spiceStep,
        'Käse in mundgerechte Würfel schneiden.',
        `Birne in Spalten schneiden, mit Nüssen und ${flavor.herb} servieren.`
      ],
      tipsShopping: [
        protein.shoppingTip,
        'Birne eher festreif wählen.',
        flavor.shoppingTip
      ],
      tipsCooking: [
        protein.cookingTip,
        'Snacks kurz vor dem Servieren anrichten.',
        flavor.herbTip
      ],
      meta,
      protein
    };
  }

  return {
    title,
    ingredients: [
      vegan ? '30 g Nussmix' : '150 g Skyr nature',
      vegan ? '1 Apfel' : '20 g Nüsse',
      vegan ? 'optional: 1 EL Hummus als Dip' : 'optional: 2 Apfelschnitze',
      flavor.spiceIngredient,
      flavor.herbIngredient
    ],
    steps: [
      flavor.spiceStep,
      vegan ? 'Nussmix in eine kleine Schale geben.' : 'Skyr in eine Schale geben.',
      vegan ? `Apfel in Stücke schneiden und mit ${flavor.herb} servieren.` : `Nüsse darüberstreuen und optional mit Apfel sowie ${flavor.herb} ergänzen.`
    ],
    tipsShopping: [
      vegan ? 'Ungesalzene Nüsse wählen.' : protein.shoppingTip,
      'Zutaten ohne zugesetzten Zucker bevorzugen.',
      flavor.shoppingTip
    ],
    tipsCooking: [
      vegan ? 'Apfel erst kurz vor dem Essen schneiden.' : protein.cookingTip,
      'Nüsse zum Schluss hinzufügen für besseren Crunch.',
      flavor.herbTip
    ],
    meta,
    protein
  };
}

function buildDrinkRecipe({ title, meta }) {
  return {
    title,
    ingredients: [
      '1–2 Liter Wasser',
      '2–3 Zitronen- oder Limettenscheiben'
    ],
    steps: [
      'Wasser in Karaffe oder Flasche füllen.',
      'Zitrusfrüchte zugeben und 10 Minuten ziehen lassen.'
    ],
    tipsShopping: [
      'Hahnenwasser in der Schweiz ist qualitativ sehr gut.',
      'Zitrusfrüchte in Bio-Qualität bevorzugen.'
    ],
    tipsCooking: [
      'Kalt servieren für maximale Frische.',
      'Mit Minze oder Gurke variieren.'
    ],
    meta: { ...meta, kcal: 5, difficulty: 1, timeMin: 2, co2Label: normalizeCo2Label(0.2) },
    protein: null
  };
}

const PROTEIN_TOKENS = {
  tofu: ['tofu'],
  linsen: ['linsen'],
  kichererbsen: ['kichererbsen', 'hummus'],
  bohnen: ['bohnen'],
  sojaskyr: ['soja', 'skyr'],
  poulet: ['poulet', 'huhn', 'hahnchen', 'haehnchen'],
  rind: ['rind', 'beef'],
  forelle: ['forelle'],
  lachs: ['lachs'],
  thunfisch: ['thunfisch'],
  skyr: ['skyr'],
  huettenkaese: ['huttenkase', 'huettenkaese', 'hüttenkäse', 'hüttenkase'],
  eier: ['eier', 'egg'],
  kefir: ['kefir'],
  kaese: ['kase', 'kaese', 'käse']
};

function textContainsAny(text, tokens = []) {
  return tokens.some(token => hasStem(text, token));
}

const TITLE_CONSISTENCY_RULES = [
  { pattern: 'pfanne|stir[-\\s]?fry', slots: ['abendessen'], mustInSteps: ['pfanne'], forbidInSteps: ['backofen', 'im ofen'] },
  { pattern: 'ofen|blech', slots: ['abendessen'], mustInSteps: ['ofen'] },
  { pattern: 'porridge', slots: ['fruehstueck'], mustInAll: ['hafer'], mustInSteps: ['koch|koechel|kochel'] },
  { pattern: 'quinoa', mustInAll: ['quinoa'] },
  { pattern: 'pasta|nudeln?|spaghetti|penne', mustInAll: ['pasta|nudel|spaghetti|penne'] },
  { pattern: 'kartoffel', mustInAll: ['kartoffel'] },
  { pattern: 'bohnen', mustInAll: ['bohnen'] },
  { pattern: 'spinat', mustInAll: ['spinat'] }
];

const VEGAN_ANIMAL_PATTERNS = [
  'poulet', 'huhn', 'rind', 'beef', 'forelle', 'lachs', 'thunfisch', 'fisch', 'eier', 'egg', 'huettenkaese', 'huttenkase', 'kefir'
];

const SPICE_SIGNAL_PATTERNS = [
  'muskat', 'kummel', 'paprika', 'oregano', 'thymian', 'kreuzkummel', 'koriander', 'sumach', 'kurkuma',
  'masala', 'ingwer', 'chili', 'dill', 'senfsaat', 'zitronenabrieb', 'rosmarin', 'salbei', 'estragon',
  'petersilie', 'schnittlauch', 'barlauch', 'basilikum', 'minze'
];

function enforceTitleConsistency(recipe, slot, titleText, combinedText, stepsText) {
  for (const rule of TITLE_CONSISTENCY_RULES) {
    if (rule.slots && !rule.slots.includes(slot)) continue;
    if (!hasStem(titleText, rule.pattern)) continue;

    for (const token of (rule.mustInAll || [])) {
      if (!hasStem(combinedText, token)) {
        throw new Error(`Recipe consistency check failed for "${recipe.title}": title token "${rule.pattern}" missing expected ingredient/action (${token})`);
      }
    }

    for (const token of (rule.mustInSteps || [])) {
      if (!hasStem(stepsText, token)) {
        throw new Error(`Recipe consistency check failed for "${recipe.title}": title token "${rule.pattern}" missing expected step (${token})`);
      }
    }

    for (const token of (rule.forbidInSteps || [])) {
      if (hasStem(stepsText, token)) {
        throw new Error(`Recipe consistency check failed for "${recipe.title}": title token "${rule.pattern}" conflicts with step token (${token})`);
      }
    }
  }
}

function validateRecipeConsistency(recipe, { slot, vegan, protein }) {
  if (slot === 'drink') return;
  if (!protein) throw new Error(`Recipe consistency check failed for "${recipe.title}": missing protein profile`);

  const titleText = normalizeText(recipe.title || recipe.meta?.titleMarketing || '');
  const stepsText = normalizeText((recipe.steps || []).join(' '));
  const combined = normalizeText([
    recipe.title,
    recipe.meta?.titleMarketing,
    recipe.meta?.subtitle,
    ...(recipe.ingredients || []),
    ...(recipe.steps || [])
  ].join(' '));

  enforceTitleConsistency(recipe, slot, titleText, combined, stepsText);

  if (vegan && textContainsAny(combined, VEGAN_ANIMAL_PATTERNS)) {
    throw new Error(`Recipe consistency check failed for "${recipe.title}": vegan recipe contains animal token`);
  }

  if (['mittagessen', 'abendessen', 'snack'].includes(slot) && !textContainsAny(combined, SPICE_SIGNAL_PATTERNS)) {
    throw new Error(`Recipe consistency check failed for "${recipe.title}": missing cuisine-level spice/herb profile`);
  }

  const ownTokens = PROTEIN_TOKENS[protein.key] || [];
  if (ownTokens.length && !textContainsAny(combined, ownTokens)) {
    throw new Error(`Recipe consistency check failed for "${recipe.title}": primary protein "${protein.key}" missing in ingredients/steps`);
  }

  const omniHardConflicts = ['poulet', 'rind', 'forelle', 'lachs', 'thunfisch', 'eier'];
  const omniDairyKeys = ['skyr', 'huettenkaese', 'kefir', 'kaese'];

  let conflictKeys;
  if (vegan) {
    conflictKeys = VEGAN_KEYS.filter(k => k !== protein.key && k !== 'sojaskyr');
  } else if (omniDairyKeys.includes(protein.key)) {
    conflictKeys = omniHardConflicts;
  } else if (protein.key === 'eier') {
    conflictKeys = ['poulet', 'rind', 'forelle', 'lachs', 'thunfisch'];
  } else {
    conflictKeys = omniHardConflicts.filter(k => k !== protein.key);
  }

  const possibleConflicts = conflictKeys.flatMap(k => PROTEIN_TOKENS[k] || []);
  const conflictHits = possibleConflicts.filter(token => hasStem(combined, token));
  if (conflictHits.length) {
    throw new Error(`Recipe consistency check failed for "${recipe.title}": contains conflicting protein tokens (${[...new Set(conflictHits)].join(', ')})`);
  }
}

function buildBySlot(slot, vegan, title, day) {
  const protein = inferProteinProfile(title, vegan, slot);
  const flavor = buildFlavorProfile({ title, slot, protein, vegan, day });
  const meta = buildMeta(slot, vegan, title, protein, flavor);

  if (slot === 'fruehstueck') return buildBreakfastRecipe({ title, vegan, protein, meta, flavor });
  if (slot === 'mittagessen') return buildLunchRecipe({ title, vegan, protein, meta, flavor });
  if (slot === 'abendessen') return buildDinnerRecipe({ title, vegan, protein, meta, flavor });
  if (slot === 'snack') return buildSnackRecipe({ title, vegan, protein, meta, flavor });
  return buildDrinkRecipe({ title, meta });
}

const EXPECTED_RECIPES_PER_MENU = 10;

function parseJsonSafe(raw, fallback) {
  try {
    return JSON.parse(raw || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function shouldRepairMenuRecipes(menu) {
  const rows = db.prepare('SELECT option_type, meal_slot, title, ingredients, steps, meta FROM recipes WHERE menu_id=? ORDER BY option_type, meal_slot').all(menu.id);

  if (rows.length !== EXPECTED_RECIPES_PER_MENU) return true;

  for (const row of rows) {
    const vegan = row.option_type === 'vegan';
    const protein = inferProteinProfile(row.title, vegan, row.meal_slot);
    const ingredients = parseJsonSafe(row.ingredients, []);
    const steps = parseJsonSafe(row.steps, []);
    const meta = parseJsonSafe(row.meta, {});

    if (meta?.titleMarketing && meta.titleMarketing !== row.title) {
      return true;
    }

    try {
      validateRecipeConsistency({ title: row.title, ingredients, steps, meta }, { slot: row.meal_slot, vegan, protein });
    } catch {
      return true;
    }
  }

  return false;
}

export function repairLegacyRecipeSets() {
  const menus = db.prepare('SELECT * FROM menus ORDER BY day DESC').all();
  const regenerate = db.transaction((menu) => generateRecipesForMenu(menu));

  let repaired = 0;
  for (const menu of menus) {
    if (!shouldRepairMenuRecipes(menu)) continue;
    regenerate(menu);
    repaired += 1;
  }

  return { scanned: menus.length, repaired };
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
    const recipe = buildBySlot(slot, vegan, title, menu.day);
    const meta = normalizeSlotMeta({
      ...recipe.meta,
      titleMarketing: title,
      tipsShopping: recipe.tipsShopping,
      tipsCooking: recipe.tipsCooking
    }, slot);

    validateRecipeConsistency({ ...recipe, meta }, { slot, vegan, protein: recipe.protein });

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
