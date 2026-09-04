import Decimal from 'decimal.js';
import type { CostItem, CostItemPayload, Purchase, PurchaseUnit, StructureCost, Supplier, TeamCost } from '@/types/cost';
import { storeCollection } from '@/services/store-records.service';

export function calculateBaseUnitCost(price: number, quantity: number) { return quantity > 0 ? new Decimal(price).div(quantity).toDecimalPlaces(4).toNumber() : 0; }
export function calculateEffectiveUnitCost(price: number, quantity: number, freight = 0, discount = 0, lossPercentage = 0) {
  const usable = new Decimal(quantity || 0).mul(new Decimal(1).minus(new Decimal(lossPercentage || 0).div(100)));
  const netCost = new Decimal(price || 0).plus(freight || 0).minus(discount || 0);
  return usable.gt(0) && netCost.gte(0) ? netCost.div(usable).toDecimalPlaces(4).toNumber() : 0;
}
export function effectiveUnitCostForItem(item: Pick<CostItem, 'purchasePrice' | 'purchaseQuantity' | 'freight' | 'discount' | 'lossPercentage'>) {
  return calculateEffectiveUnitCost(item.purchasePrice, item.purchaseQuantity, item.freight, item.discount, item.lossPercentage);
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

const itemsCollection = storeCollection<CostItem>('cost-items');

export const costService = {
  ...itemsCollection,
  async save(payload: CostItemPayload): Promise<CostItem> {
    const rows=await itemsCollection.list();const previous=payload.id?rows.find(row=>row.id===payload.id):undefined;const now=new Date().toISOString();
    const item:CostItem={...payload,id:payload.id??`insumo-${Date.now()}`,baseUnitCost:calculateBaseUnitCost(payload.purchasePrice,payload.purchaseQuantity),usedBy:previous?.usedBy??[],history:previous?.history??[],createdAt:previous?.createdAt??now,updatedAt:now};
    return itemsCollection.save(item);
  },
};
export const purchaseService = storeCollection<Purchase>('purchases');
export const supplierService = storeCollection<Supplier>('suppliers');
export const structureCostService = storeCollection<StructureCost>('structure-costs');
export const teamCostService = storeCollection<TeamCost>('team-costs');
