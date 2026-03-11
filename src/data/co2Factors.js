export const co2Factors = {
  tofu: 2.0,
  linsen: 0.9,
  bohnen: 1.2,
  hafer: 0.8,
  gemuese: 0.5,
  milch: 1.3,
  ei: 2.1,
  huhn: 6.0,
  rind: 27.0,
  kaese: 8.5,
  fisch: 5.0
};

export function estimateDishCo2(name) {
  const n = name.toLowerCase();
  if (n.includes('rind')) return 6.5;
  if (n.includes('huhn')) return 3.4;
  if (n.includes('tofu') || n.includes('linsen') || n.includes('bohnen')) return 1.2;
  if (n.includes('fisch')) return 3.1;
  return 2.2;
}
