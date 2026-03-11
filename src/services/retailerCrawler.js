import * as cheerio from 'cheerio';

const retailers = [
  { id: 'migros', url: 'https://www.migros.ch/de/offers/home' },
  { id: 'coop', url: 'https://www.coop.ch/de/' },
  { id: 'aldi', url: 'https://www.aldi-suisse.ch/de/aktionen-und-angebote.html' },
  { id: 'lidl', url: 'https://www.lidl.ch/' }
];

const fallbackItems = {
  migros: ['Broccoli', 'Haferflocken', 'Tofu', 'Kichererbsen', 'Äpfel', 'Rüebli', 'Vollkornbrot', 'Naturjoghurt', 'Lachs', 'Pouletbrust'],
  coop: ['Spinat', 'Bananen', 'Linsen', 'Nüsse', 'Quinoa', 'Tomaten', 'Eier', 'Hüttenkäse', 'Rindshack', 'Reis'],
  aldi: ['Peperoni', 'Zucchini', 'Kartoffeln', 'Bohnen', 'Sojadrink', 'Beeren', 'Vollkornpasta', 'Mozzarella', 'Thunfisch', 'Pouletwürfel'],
  lidl: ['Kale', 'Pilze', 'Süsskartoffeln', 'Haferdrink', 'Mandeln', 'Birnen', 'Kefir', 'Feta', 'Forelle', 'Rindsgeschnetzeltes']
};

export async function crawlRetailer(retailerId) {
  const retailer = retailers.find(r => r.id === retailerId);
  if (!retailer) throw new Error(`Unknown retailer ${retailerId}`);

  try {
    const response = await fetch(retailer.url, { headers: { 'User-Agent': 'lekker-bot/1.0' } });
    const html = await response.text();
    const $ = cheerio.load(html);
    const tokens = new Set();

    $('h1,h2,h3,a,span,p').each((_, el) => {
      const txt = $(el).text().trim();
      if (!txt || txt.length < 4 || txt.length > 40) return;
      if (/angebot|aktion|rabatt|mehr|jetzt|online|shop/i.test(txt)) return;
      if (/^[0-9\W]+$/.test(txt)) return;
      tokens.add(txt);
    });

    const items = [...tokens].slice(0, 10);
    if (items.length < 10) {
      return fallbackItems[retailerId].map(x => ({ item: x, price: 'n/a' }));
    }

    return items.map(x => ({ item: x, price: 'n/a' }));
  } catch {
    return fallbackItems[retailerId].map(x => ({ item: x, price: 'n/a' }));
  }
}

export function getRetailers() {
  return retailers;
}
