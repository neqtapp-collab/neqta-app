import { describe, expect, it } from "vitest";
import { defaultSettings } from "../lib/settings";
import { evaluateProductPricing } from "../lib/pricing-evaluation";
import type { Product } from "../types/product";

const product: Product = {
  id: "produto-teste",
  name: "Produto teste",
  category: "Teste",
  variableCost: 20,
  currentPrice: 30,
  projectedMargin: 0,
  targetMargin: 15,
  recommendedPrice: 30,
  status: "healthy",
  kind: "product",
  laborMinutes: 10,
  directOperationalCost: 0.5,
};

describe("avaliação unificada de precificação", () => {
  it("bloqueia recomendação quando receita e rateio ainda estão incompletos", () => {
    const result = evaluateProductPricing(product, defaultSettings);
    expect(result.completeness).toBe(33);
    expect(result.product.status).toBe("critical");
    expect(result.product.recommendedPrice).toBe(0);
  });

  it("cruza custo direto, mão de obra, rateio, imposto, reserva e margem", () => {
    const settings = {
      ...defaultSettings,
      financial: {
        ...defaultSettings.financial,
        targetMargin: 15,
        estimatedMonthlyRevenue: 50_000,
        salesTax: 5,
        operationalReserve: 2,
      },
    };
    const result = evaluateProductPricing(product, settings, 10_000, [], 20);
    expect(result.completeness).toBe(100);
    expect(result.effectiveCost).toBe(23.83);
    expect(result.overheadRate).toBe(20);
    expect(result.embeddedFees).toBe(27);
    expect(result.product.recommendedPrice).toBe(41.9);
    expect(result.product.status).toBe("critical");
  });
});
