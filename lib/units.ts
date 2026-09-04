import Decimal from 'decimal.js';

export type Unit = 'g' | 'kg' | 'ml' | 'L' | 'un' | 'cx' | 'pacote' | 'dúzia';
export function componentCost(quantity: number, unit: Unit, unitCost: number) {
  const amount = new Decimal(quantity || 0);
  const cost = new Decimal(unitCost || 0);
  // Preserve frações de centavo por item. O total monetário é arredondado
  // somente depois da soma, evitando que vários consumos pequenos virem zero.
  if (unit === 'g' || unit === 'ml') return amount.div(1000).mul(cost).toDecimalPlaces(6).toNumber();
  if (unit === 'dúzia') return amount.div(12).mul(cost).toDecimalPlaces(6).toNumber();
  return amount.mul(cost).toDecimalPlaces(6).toNumber();
}
