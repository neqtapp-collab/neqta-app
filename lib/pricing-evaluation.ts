import type { Product, ProductStatus } from "@/types/product";
import type { StructureCost, TeamCost } from "@/types/cost";
import type { NeqtaSettings } from "@/types/settings";
import {
  buildPricingCost,
  commercialRound,
  marginForChannel,
  pricingCompleteness,
  recommendedPriceForChannel,
} from "@/lib/financial";

const intensityWeight = { low: 0.5, medium: 1, high: 1.5 } as const;

export function getPricingDataWarnings(product: Product) {
  const components = product.components ?? [];
  if (components.length < 2 || product.currentPrice <= 0) return [];

  const directCostRatio = product.variableCost / product.currentPrice;
  const measuredQuantity = components.reduce((total, component) => {
    const unit = component.unit.toLowerCase();
    if (unit === "kg" || unit === "l") return total + component.quantity * 1000;
    if (unit === "g" || unit === "ml") return total + component.quantity;
    return total;
  }, 0);
  const measuredComponents = components.filter((component) =>
    ["kg", "g", "l", "ml"].includes(component.unit.toLowerCase()),
  ).length;

  const warnings: string[] = [];
  if (directCostRatio < 0.01)
    warnings.push(
      "O custo da ficha está abaixo de 1% do preço de venda. Confira os preços e as quantidades dos componentes.",
    );
  if (
    measuredComponents >= 2 &&
    measuredQuantity > 0 &&
    measuredQuantity <= 5
  ) {
    const names = components
      .filter((component) =>
        ["kg", "g", "l", "ml"].includes(component.unit.toLowerCase()),
      )
      .map(
        (component) =>
          `${component.name}: ${component.quantity} ${component.unit}`,
      )
      .join("; ");
    warnings.push(
      `A quantidade total informada parece muito baixa. Confirme: ${names}.`,
    );
  }
  return warnings;
}

export function pricingStatus(margin: number, target: number): ProductStatus {
  return margin < target - 8
    ? "critical"
    : margin < target
      ? "warning"
      : "healthy";
}

export function evaluateProductPricing(
  product: Product,
  settings: NeqtaSettings,
  monthlyOverhead = 0,
  selectiveCosts: StructureCost[] = [],
  directLaborHourlyCost = 0,
) {
  const selectiveMonthly = (product.utilityUsages ?? []).reduce(
    (total, usage) =>
      total +
      (selectiveCosts.find((item) => item.id === usage.costId)?.monthlyValue ??
        0) *
        intensityWeight[usage.intensity],
    0,
  );
  const allocatedOverhead = monthlyOverhead + selectiveMonthly;
  const model = buildPricingCost({
    directCost: product.variableCost,
    directOperationalCost: product.directOperationalCost,
    laborMinutes: product.laborMinutes,
    directLaborHourlyCost,
    monthlyOverhead: allocatedOverhead,
    estimatedMonthlyRevenue: settings.financial.estimatedMonthlyRevenue,
  });
  const baseCompleteness = pricingCompleteness({
    directCost: product.variableCost,
    monthlyOverhead: allocatedOverhead,
    estimatedMonthlyRevenue: settings.financial.estimatedMonthlyRevenue,
  });
  const pricingWarnings = getPricingDataWarnings(product);
  const suspiciousComposition = pricingWarnings.length > 0;
  const completeness = suspiciousComposition
    ? Math.min(baseCompleteness, 67)
    : baseCompleteness;
  const embeddedFees =
    settings.financial.salesTax +
    settings.financial.operationalReserve +
    model.overheadRate;
  if (product.status === "recipe")
    return {
      product,
      effectiveCost: model.unitCost,
      laborCost: model.laborCost,
      overheadRate: model.overheadRate,
      embeddedFees,
      completeness,
      suspiciousComposition,
      pricingWarnings,
    };
  if (completeness < 100 || model.unitCost <= 0)
    return {
      product: {
        ...product,
        projectedMargin: 0,
        recommendedPrice: 0,
        status: "critical" as ProductStatus,
        pricingCompleteness: completeness,
        pricingWarnings,
      },
      effectiveCost: model.unitCost,
      laborCost: model.laborCost,
      overheadRate: model.overheadRate,
      embeddedFees,
      completeness,
      suspiciousComposition,
    };
  const target = settings.financial.targetMargin || product.targetMargin || 30;
  const margin =
    marginForChannel(product.currentPrice, model.unitCost, embeddedFees) ?? 0;
  const recommendedPrice = commercialRound(
    recommendedPriceForChannel(model.unitCost, target, embeddedFees),
  );
  return {
    product: {
      ...product,
      projectedMargin: margin,
      recommendedPrice,
      status: pricingStatus(margin, target),
      pricingCompleteness: completeness,
      pricingWarnings,
    },
    effectiveCost: model.unitCost,
    laborCost: model.laborCost,
    overheadRate: model.overheadRate,
    embeddedFees,
    completeness,
    suspiciousComposition,
  };
}

export function buildPricingContext(
  structure: StructureCost[],
  team: TeamCost[],
) {
  const monthlyOverhead =
    structure
      .filter((item) => (item.allocationMode ?? "all") === "all")
      .reduce((total, item) => total + item.monthlyValue, 0) +
    team
      .filter((item) => !item.directProduction)
      .reduce(
        (total, item) =>
          total + item.salary + item.charges + item.benefits + item.otherCosts,
        0,
      );
  const productive = team.filter(
    (item) => item.directProduction && item.productiveHoursMonthly,
  );
  const payroll = productive.reduce(
    (total, item) =>
      total + item.salary + item.charges + item.benefits + item.otherCosts,
    0,
  );
  const hours = productive.reduce(
    (total, item) => total + (item.productiveHoursMonthly ?? 0),
    0,
  );
  return {
    monthlyOverhead,
    selectiveCosts: structure.filter(
      (item) => item.allocationMode === "selected",
    ),
    directLaborHourlyCost: hours > 0 ? payroll / hours : 0,
  };
}
