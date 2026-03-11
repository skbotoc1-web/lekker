import { z } from 'zod';

const co2Labels = ['grün', 'gelb', 'rot', 'gelb-grün', 'grün bis gelb'];

const RecipeMetaSchema = z.object({
  servings: z.number().int().min(1).max(8).default(1),
  difficulty: z.number().int().min(1).max(5),
  timeMin: z.number().int().min(2).max(180),
  kcal: z.number().int().min(0).max(1600),
  co2Label: z.enum(co2Labels),
  titleMarketing: z.string().max(120).default(''),
  subtitle: z.string().max(180).default(''),
  proteinHint: z.string().max(80).default(''),
  tipsShopping: z.array(z.string().min(3)).max(6).default([]),
  tipsCooking: z.array(z.string().min(3)).max(6).default([])
});

export function normalizeSlotMeta(meta, slot) {
  const normalized = RecipeMetaSchema.parse(meta);

  if (slot === 'drink') {
    normalized.difficulty = 1;
    normalized.timeMin = Math.min(normalized.timeMin, 8);
    normalized.kcal = Math.min(normalized.kcal, 20);
    normalized.co2Label = 'grün';
  }

  if (slot === 'snack') {
    normalized.timeMin = Math.max(2, Math.min(normalized.timeMin, 20));
  }

  return normalized;
}

export { RecipeMetaSchema };
