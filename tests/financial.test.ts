import { describe, expect, it } from "vitest";
import {
  buildPricingCost,
  calculateMargin,
  commercialRound,
  marginForChannel,
  multiplyMoney,
  parseBRL,
  parsePercent,
  pricingCompleteness,
  recommendedPrice,
  recommendedPriceForChannel,
  sumMoney,
} from "../lib/financial";

describe("motor financeiro atual", () => {
  it("calcula margem e preço por margem-alvo", () => {
    expect(calculateMargin(40, 20)).toBe(50);
    expect(recommendedPrice(20, 20)).toBe(25);
  });

  it("calcula mão de obra e rateio mensal", () => {
    expect(
      buildPricingCost({
        directCost: 3.83,
        directOperationalCost: 0.5,
        laborMinutes: 10,
        directLaborHourlyCost: 20,
        monthlyOverhead: 10_000,
        estimatedMonthlyRevenue: 50_000,
      }),
    ).toEqual({ unitCost: 7.66, laborCost: 3.33, overheadRate: 20 });
  });

  it("considera margem, taxas percentuais e taxa fixa no preço por canal", () => {
    expect(recommendedPriceForChannel(7.66, 15, 31.2, 1)).toBe(16.1);
    expect(marginForChannel(16.1, 7.66, 31.2, 1)).toBe(15.01);
  });

  it("bloqueia denominador zero ou negativo", () => {
    expect(recommendedPriceForChannel(10, 50, 50)).toBe(0);
    expect(recommendedPriceForChannel(10, 60, 50)).toBe(0);
  });

  it("não calcula margem quando o preço não é positivo", () => {
    expect(marginForChannel(0, 10, 5)).toBeNull();
    expect(marginForChannel(-1, 10, 5)).toBeNull();
  });

  it("mantém precisão monetária nas somas e multiplicações", () => {
    expect(sumMoney([0.1, 0.2, 1])).toBe(1.3);
    expect(multiplyMoney(0.2, 11.6667)).toBe(2.33);
  });

  it("interpreta valores brasileiros e percentuais decimais", () => {
    expect(parseBRL("R$ 1.234,56")).toBe(1234.56);
    expect(parsePercent("26,2%")).toBe(26.2);
  });

  it("registra o arredondamento comercial atual terminado em ,90", () => {
    expect(commercialRound(15.93)).toBe(15.9);
    expect(commercialRound(15.89)).toBe(15.9);
  });

  it("mede os três grupos de completude atualmente implementados", () => {
    expect(pricingCompleteness({ directCost: 10 })).toBe(33);
    expect(
      pricingCompleteness({
        directCost: 10,
        monthlyOverhead: 2_000,
        estimatedMonthlyRevenue: 10_000,
      }),
    ).toBe(100);
  });

  it("fecha um cenário completo sem omitir mão de obra, rateio, imposto, reserva e canal", () => {
    const model = buildPricingCost({
      directCost: 20,
      directOperationalCost: 0.5,
      laborMinutes: 10,
      directLaborHourlyCost: 20,
      monthlyOverhead: 10_000,
      estimatedMonthlyRevenue: 50_000,
    });
    expect(model).toEqual({
      unitCost: 23.83,
      laborCost: 3.33,
      overheadRate: 20,
    });
    expect(recommendedPriceForChannel(model.unitCost, 15, 27)).toBe(41.09);
    expect(recommendedPriceForChannel(model.unitCost, 15, 53.2)).toBe(74.94);
    expect(marginForChannel(74.94, model.unitCost, 53.2)).toBeCloseTo(15, 1);
  });
});
