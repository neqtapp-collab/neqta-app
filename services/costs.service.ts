import Decimal from 'decimal.js';
import { costItems, purchases, structureCosts, suppliers, teamCosts } from '@/mocks/costs.mock';
import type { CostItem, CostItemPayload, Purchase, PurchaseUnit, StructureCost, Supplier, TeamCost } from '@/types/cost';
import { readStoredList, writeStoredList } from '@/lib/storage';

export function calculateBaseUnitCost(price: number, quantity: number) { return quantity > 0 ? new Decimal(price).div(quantity).toDecimalPlaces(4).toNumber() : 0; }
export function calculateEffectiveUnitCost(price: number, quantity: number, freight = 0, discount = 0, lossPercentage = 0) {
  const usable = new Decimal(quantity || 0).mul(new Decimal(1).minus(new Decimal(lossPercentage || 0).div(100)));
  return usable.gt(0) ? new Decimal(price).plus(freight).minus(discount).div(usable).toDecimalPlaces(4).toNumber() : 0;
}
export function priceVariation(current: number, previous?: number) { return previous && previous > 0 ? new Decimal(current).minus(previous).div(previous).mul(100).toDecimalPlaces(1).toNumber() : null; }
export function convertUnitCost(cost: number, from: PurchaseUnit, to: PurchaseUnit) { if (from === to) return cost; if (from === 'kg' && to === 'g' || from === 'L' && to === 'ml') return new Decimal(cost).div(1000).toNumber(); if (from === 'g' && to === 'kg' || from === 'ml' && to === 'L') return new Decimal(cost).mul(1000).toNumber(); return cost; }

export const COST_VARIATION_THRESHOLDS = { attention: 5, critical: 10 } as const;

export function hasRecentAdjustment(item: CostItem) {
  return priceVariation(item.baseUnitCost, item.previousUnitCost) !== null
    && priceVariation(item.baseUnitCost, item.previousUnitCost) !== 0;
}

export function isImpactingProducts(item: CostItem) {
  return hasRecentAdjustment(item) && item.usedBy.length > 0;
}

export function isWithoutRecentUpdate(item: CostItem, referenceDate = new Date()) {
  const latest = item.history[0]?.date ?? item.purchaseDate;
  if (!latest) return true;
  const age = referenceDate.getTime() - new Date(`${latest}T12:00:00`).getTime();
  return age > 90 * 24 * 60 * 60 * 1000;
}

export function getCostHealthMetrics(items: CostItem[]) {
  return {
    recentAdjustments: items.filter(hasRecentAdjustment).length,
    impactingProducts: items.filter(isImpactingProducts).length,
    withoutRecentUpdate: items.filter((item) => isWithoutRecentUpdate(item)).length,
  };
}

const keys = { items:'neqta-cost-items', purchases:'neqta-purchases', suppliers:'neqta-suppliers', structure:'neqta-structure-costs', team:'neqta-team-costs' } as const;
const collection = <T>(key:string,seed:readonly T[]) => ({
  list: async ():Promise<T[]> => structuredClone(readStoredList(key,seed)),
  replaceAll: async (rows:T[]) => { writeStoredList(key,rows); return structuredClone(rows); },
});

export const costService = {
  ...collection<CostItem>(keys.items,costItems),
  async save(payload: CostItemPayload): Promise<CostItem> {
    const rows=readStoredList(keys.items,costItems);const previous=payload.id?rows.find(row=>row.id===payload.id):undefined;const now=new Date().toISOString();
    const item:CostItem={...payload,id:payload.id??`insumo-${Date.now()}`,baseUnitCost:calculateBaseUnitCost(payload.purchasePrice,payload.purchaseQuantity),usedBy:previous?.usedBy??[],history:previous?.history??[],createdAt:previous?.createdAt??now,updatedAt:now};
    writeStoredList(keys.items,previous?rows.map(row=>row.id===item.id?item:row):[...rows,item]);return structuredClone(item);
  },
  async remove(id:string){writeStoredList(keys.items,readStoredList(keys.items,costItems).filter(row=>row.id!==id));},
};
export const purchaseService = collection<Purchase>(keys.purchases,purchases);
export const supplierService = collection<Supplier>(keys.suppliers,suppliers);
export const structureCostService = collection<StructureCost>(keys.structure,structureCosts);
export const teamCostService = collection<TeamCost>(keys.team,teamCosts);
