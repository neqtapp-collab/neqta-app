import { marginForChannel, recommendedPriceForChannel } from "@/lib/financial";
import type { Product } from "@/types/product";
import type { PromotionStatus } from "@/types/promotion";

function effectiveCost(product: Product) {
  return product.pricingEffectiveCost ?? product.variableCost;
}

function embeddedFees(product: Product) {
  return product.pricingEmbeddedFees ?? 0;
}

function productReady(product: Product) {
  return (
    (product.pricingCompleteness ?? 0) === 100 &&
    effectiveCost(product) > 0 &&
    product.currentPrice > 0
  );
}

export function promotionStatus(
  margin: number,
  minimumMargin: number,
): PromotionStatus {
  if (margin < minimumMargin) return "unsafe";
  if (margin < minimumMargin + 3) return "warning";
  return "safe";
}

export function evaluatePromotionScenario(
  product: Product,
  promotionalPrice: number,
  minimumMargin: number,
  secondaryProduct?: Product,
) {
  const products = secondaryProduct ? [product, secondaryProduct] : [product];
  const referencePrice = products.reduce(
    (total, item) => total + item.currentPrice,
    0,
  );
  const consideredCost = products.reduce(
    (total, item) => total + effectiveCost(item),
    0,
  );
  const feeAmount = products.reduce(
    (total, item) =>
      total + (item.currentPrice * embeddedFees(item)) / 100,
    0,
  );
  const percentageFees = referencePrice > 0 ? (feeAmount / referencePrice) * 100 : 0;
  const dataReady = products.every(productReady);
  const margin = dataReady
    ? (marginForChannel(promotionalPrice, consideredCost, percentageFees) ?? 0)
    : 0;
  const contribution = dataReady
    ? promotionalPrice -
      consideredCost -
      (promotionalPrice * percentageFees) / 100
    : 0;
  const equivalentDiscount =
    referencePrice > 0
      ? Math.max(0, (1 - promotionalPrice / referencePrice) * 100)
      : 0;
  const minimumPrice = dataReady
    ? recommendedPriceForChannel(
        consideredCost,
        minimumMargin,
        percentageFees,
      )
    : referencePrice;
  const maxDiscount = dataReady
    ? Math.max(0, (1 - minimumPrice / referencePrice) * 100)
    : 0;
  const classification = dataReady
    ? promotionStatus(margin, minimumMargin)
    : "unsafe";
  const valid =
    dataReady &&
    promotionalPrice > 0 &&
    margin >= minimumMargin &&
    contribution > 0 &&
    classification !== "unsafe" &&
    equivalentDiscount <= maxDiscount + 0.001;

  return {
    referencePrice,
    consideredCost,
    percentageFees,
    margin,
    contribution,
    equivalentDiscount,
    minimumPrice,
    maxDiscount,
    classification,
    dataReady,
    valid,
  };
}

export function promotionSafeLimit(
  product: Product,
  minimumMargin: number,
  secondaryProduct?: Product,
) {
  const referencePrice =
    product.currentPrice + (secondaryProduct?.currentPrice ?? 0);
  return evaluatePromotionScenario(
    product,
    referencePrice,
    minimumMargin,
    secondaryProduct,
  );
}
