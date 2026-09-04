import { describe, expect, it } from "vitest";
import { evaluatePromotionScenario } from "../lib/promotion-evaluation";
import type { Product } from "../types/product";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "produto-a",
    name: "Produto A",
    category: "Teste",
    variableCost: 7.5,
    currentPrice: 12.9,
    projectedMargin: 0,
    targetMargin: 20,
    recommendedPrice: 0,
    status: "healthy",
    kind: "product",
    pricingEffectiveCost: 7.5,
    pricingEmbeddedFees: 21,
    pricingCompleteness: 100,
    ...overrides,
  };
}

describe("avaliação central de promoções", () => {
  it("reprova desconto que fica abaixo da margem mínima", () => {
    const result = evaluatePromotionScenario(product(), 10.32, 10);

    expect(result.margin).toBeCloseTo(6.33, 2);
    expect(result.classification).toBe("unsafe");
    expect(result.valid).toBe(false);
  });

  it("soma os custos efetivos dos produtos do combo", () => {
    const primary = product({
      currentPrice: 10,
      pricingEffectiveCost: 7.3,
    });
    const secondary = product({
      id: "produto-b",
      name: "Produto B",
      currentPrice: 10,
      pricingEffectiveCost: 4,
    });
    const result = evaluatePromotionScenario(primary, 16.9, 15, secondary);

    expect(result.consideredCost).toBe(11.3);
    expect(result.margin).toBeCloseTo(12.14, 2);
    expect(result.valid).toBe(false);
  });

  it("bloqueia promoção quando qualquer ficha está incompleta", () => {
    const result = evaluatePromotionScenario(
      product({ pricingCompleteness: 67 }),
      12,
      10,
    );

    expect(result.dataReady).toBe(false);
    expect(result.maxDiscount).toBe(0);
    expect(result.valid).toBe(false);
  });
});
