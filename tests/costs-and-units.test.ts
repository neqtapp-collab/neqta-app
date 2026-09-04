import { describe, expect, it } from "vitest";
import {
  calculateBaseUnitCost,
  calculateEffectiveUnitCost,
  convertUnitCost,
  effectiveUnitCostForItem,
  effectiveUnitForItem,
  priceVariation,
} from "../services/costs.service";
import { componentCost } from "../lib/units";

describe("custos de insumos", () => {
  it("calcula o custo nominal da compra", () => {
    expect(calculateBaseUnitCost(100, 10)).toBe(10);
    expect(calculateBaseUnitCost(100, 0)).toBe(0);
  });

  it("calcula custo efetivo com frete, desconto e perda", () => {
    expect(calculateEffectiveUnitCost(100, 10, 10, 5, 10)).toBe(11.6667);
  });

  it("não divide por uma quantidade aproveitável inexistente", () => {
    expect(calculateEffectiveUnitCost(100, 10, 0, 0, 100)).toBe(0);
    expect(calculateEffectiveUnitCost(100, 0)).toBe(0);
  });

  it("calcula a variação do custo em relação à compra anterior", () => {
    expect(priceVariation(11, 10)).toBe(10);
    expect(priceVariation(10, 0)).toBeNull();
  });

  it("usa o custo efetivo persistido como referência oficial", () => {
    expect(
      effectiveUnitCostForItem({
        purchasePrice: 100,
        purchaseQuantity: 10,
        purchaseUnit: "kg",
        effectiveUnitCost: 12,
      }),
    ).toBe(12);
  });
  it("bloqueia desconto que produza custo efetivo negativo", () => {
    expect(calculateEffectiveUnitCost(10, 1, 0, 20)).toBe(0);
  });
});

describe("unidades e composição", () => {
  it("converte custo entre massa e volume da mesma dimensão", () => {
    expect(convertUnitCost(10, "kg", "g")).toBe(0.01);
    expect(convertUnitCost(0.01, "g", "kg")).toBe(10);
    expect(convertUnitCost(5, "L", "ml")).toBe(0.005);
    expect(convertUnitCost(0.005, "ml", "L")).toBe(5);
  });

  it("calcula consumo em gramas e mililitros usando custo por kg e litro", () => {
    expect(componentCost(200, "g", 11.6667)).toBe(2.33334);
    expect(componentCost(250, "ml", 8)).toBe(2);
  });

  it("preserva frações de centavo por componente para arredondar somente o total", () => {
    expect(componentCost(1, "g", 1)).toBe(0.001);
  });

  it("calcula unidades, caixas, pacotes e dúzias conforme a regra atual", () => {
    expect(componentCost(2, "un", 1.5)).toBe(3);
    expect(componentCost(2, "cx", 10)).toBe(20);
    expect(componentCost(2, "pacote", 10)).toBe(20);
    expect(componentCost(6, "dúzia", 24)).toBe(12);
  });

  it("calcula caixa e pacote pelo conteúdo interno", () => {
    const box = {
      purchasePrice: 120,
      purchaseQuantity: 2,
      purchaseUnit: "cx" as const,
      packageContentQuantity: 12,
      packageContentUnit: "un" as const,
    };
    expect(effectiveUnitCostForItem(box)).toBe(5);
    expect(effectiveUnitForItem(box)).toBe("un");
    expect(
      effectiveUnitCostForItem({
        purchasePrice: 120,
        purchaseQuantity: 2,
        purchaseUnit: "cx",
      }),
    ).toBe(0);
  });

  it("rejeita conversões entre dimensões incompatíveis", () => {
    expect(convertUnitCost(10, "kg", "L")).toBeNull();
    expect(convertUnitCost(10, "cx", "un")).toBeNull();
  });
});
