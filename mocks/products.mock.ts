import type { Product } from '@/types/product';

export const productsMock: Product[] = [
  { id: 'x-bacon', name: 'X-Bacon', category: 'Lanches', variableCost: 18.72, currentPrice: 29.9, projectedMargin: 18.6, targetMargin: 30, recommendedPrice: 32.9, status: 'critical', kind: 'product' },
  { id: 'x-salada', name: 'X-Salada', category: 'Lanches', variableCost: 15.4, currentPrice: 31.9, projectedMargin: 33.4, targetMargin: 35, recommendedPrice: 33.5, status: 'warning', kind: 'product' },
  { id: 'batata-premium', name: 'Batata Premium', category: 'Acompanhamentos', variableCost: 7.3, currentPrice: 15.9, projectedMargin: 46.1, targetMargin: 40, recommendedPrice: 15.9, status: 'healthy', kind: 'product' },
  { id: 'combo-familia', name: 'Combo Família', category: 'Combos', variableCost: 42.8, currentPrice: 69.9, projectedMargin: 27.8, targetMargin: 32, recommendedPrice: 74.9, status: 'critical', kind: 'product' },
  { id: 'cheeseburger', name: 'Cheeseburger', category: 'Lanches', variableCost: 12.1, currentPrice: 27.9, projectedMargin: 43.7, targetMargin: 35, recommendedPrice: 27.9, status: 'healthy', kind: 'product' },
  { id: 'milkshake', name: 'Milk-shake de Chocolate', category: 'Bebidas', variableCost: 9.6, currentPrice: 19.9, projectedMargin: 38.2, targetMargin: 40, recommendedPrice: 20.5, status: 'warning', kind: 'product' },
  { id: 'molho-casa', name: 'Molho da Casa', category: 'Molhos', variableCost: 24.6, currentPrice: 0, projectedMargin: 0, targetMargin: 0, recommendedPrice: 0, status: 'recipe', kind: 'product', yield: '3 kg · R$ 8,20/kg', yieldQuantity: 3, yieldUnit: 'kg', unitCost: 8.2, componentCount: 6 },
  { id: 'maionese-especial', name: 'Maionese Especial', category: 'Molhos', variableCost: 18.9, currentPrice: 0, projectedMargin: 0, targetMargin: 0, recommendedPrice: 0, status: 'recipe', kind: 'product', yield: '2 kg · R$ 9,45/kg', yieldQuantity: 2, yieldUnit: 'kg', unitCost: 9.45, componentCount: 5 },
];
