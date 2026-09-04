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

  it("bloqueia recomendação quando a composição usa valores simbólicos", () => {
    const settings = {
      ...defaultSettings,
      financial: {
        ...defaultSettings.financial,
        estimatedMonthlyRevenue: 50_000,
      },
    };
    const suspiciousProduct: Product = {
      ...product,
      variableCost: 0.04,
      currentPrice: 25,
      laborMinutes: 0,
      directOperationalCost: 0,
      components: [
        { id: "1", name: "Mussarela", quantity: 1, unit: "g", unitCost: 0.04 },
        { id: "2", name: "Tomate", quantity: 1, unit: "g", unitCost: 0.001 },
        { id: "3", name: "Orégano", quantity: 1, unit: "g", unitCost: 0.001 },
      ],
    };

    const result = evaluateProductPricing(suspiciousProduct, settings, 4500);

    expect(result.suspiciousComposition).toBe(true);
    expect(result.completeness).toBe(67);
    expect(result.product.status).toBe("critical");
    expect(result.product.recommendedPrice).toBe(0);
  });
});
