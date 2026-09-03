import Decimal from 'decimal.js';
import { sanitizePercent } from './input';

export function calculateMargin(price: number, cost: number) {
  return price > 0 ? new Decimal(price).minus(cost).div(price).mul(100).toNumber() : 0;
}
export function recommendedPrice(cost: number, targetMargin: number) {
  return targetMargin < 100 ? new Decimal(cost).div(new Decimal(1).minus(new Decimal(targetMargin).div(100))).toDecimalPlaces(2).toNumber() : cost;
}
export function parseBRL(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? new Decimal(digits).div(100).toNumber() : 0;
}
export function formatBRL(value: number) { return money(value); }
export function parsePercent(value: string) {
  return sanitizePercent(value);
}
export function formatPercent(value: number) {
  const safe = sanitizePercent(value);
  const hasDecimals = !Number.isInteger(safe);
  return `${safe.toLocaleString('pt-BR', { minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: 2 })}%`;
}
export function recommendedPriceForChannel(cost: number, targetMargin: number, percentageFees = 0, fixedFees = 0) {
  const divisor = new Decimal(1).minus(new Decimal(targetMargin).div(100)).minus(new Decimal(percentageFees).div(100));
  if (divisor.lte(0)) return 0;
  return new Decimal(cost).plus(fixedFees).div(divisor).toDecimalPlaces(2).toNumber();
}
export type PricingCostInputs = {
  directCost: number;
  directOperationalCost?: number;
  laborMinutes?: number;
  directLaborHourlyCost?: number;
  monthlyOverhead?: number;
  estimatedMonthlyRevenue?: number;
  operationalReserve?: number;
};
export function buildPricingCost(inputs: PricingCostInputs) {
  const laborCost = new Decimal(inputs.directLaborHourlyCost ?? 0).mul(inputs.laborMinutes ?? 0).div(60);
  const unitCost = new Decimal(inputs.directCost).plus(inputs.directOperationalCost ?? 0).plus(laborCost).toDecimalPlaces(2).toNumber();
  const overheadRate = inputs.estimatedMonthlyRevenue && inputs.estimatedMonthlyRevenue > 0
    ? new Decimal(inputs.monthlyOverhead ?? 0).div(inputs.estimatedMonthlyRevenue).mul(100).toDecimalPlaces(2).toNumber()
    : 0;
  return { unitCost, laborCost: laborCost.toDecimalPlaces(2).toNumber(), overheadRate };
}
export function pricingCompleteness(inputs: PricingCostInputs) {
  const checks = [inputs.directCost > 0, (inputs.estimatedMonthlyRevenue ?? 0) > 0, (inputs.monthlyOverhead ?? 0) > 0];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}
export function marginForChannel(price: number, cost: number, percentageFees = 0, fixedFees = 0) {
  if (price <= 0) return null;
  return new Decimal(price)
    .minus(cost)
    .minus(new Decimal(price).mul(percentageFees).div(100))
    .minus(fixedFees)
    .div(price)
    .mul(100)
    .toDecimalPlaces(2)
    .toNumber();
}
export function commercialRound(value: number) {
  if (value <= 0) return 0;
  return new Decimal(value).ceil().minus(.1).toDecimalPlaces(2).toNumber();
}
export function sumMoney(values: number[]) {
  return values.reduce((total, value) => total.plus(value || 0), new Decimal(0)).toDecimalPlaces(2).toNumber();
}
export function multiplyMoney(quantity: number, unitCost: number) {
  return new Decimal(quantity || 0).mul(unitCost || 0).toDecimalPlaces(2).toNumber();
}
export function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
