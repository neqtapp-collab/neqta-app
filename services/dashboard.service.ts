import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSettingsFromSupabase } from "@/lib/settings";
import {
  costService,
  effectiveUnitCostForItem,
  priceVariation,
  structureCostService,
  teamCostService,
} from "@/services/costs.service";
import { productsService } from "@/services/products.service";
import type { DashboardOverviewResponse } from "@/types/dashboard";
import {
  buildPricingContext,
  evaluateProductPricing,
} from "@/lib/pricing-evaluation";
import { promotionSafeLimit } from "@/lib/promotion-evaluation";
export interface DashboardService {
  getOverview(client?: SupabaseClient): Promise<DashboardOverviewResponse>;
}
export const dashboardService: DashboardService = {
  async getOverview(client) {
    const [products, costs, structure, team, settings] = await Promise.all([
      productsService.list(client),
      costService.list(client),
      structureCostService.list(client),
      teamCostService.list(client),
      loadSettingsFromSupabase(client),
    ]);
    const context = buildPricingContext(structure, team);
    const evaluations = products.map((product) =>
      evaluateProductPricing(
        product,
        settings,
        context.monthlyOverhead,
        context.selectiveCosts,
        context.directLaborHourlyCost,
      ),
    );
    const sellableEvaluations = evaluations.filter(
      ({ product }) => product.status !== "recipe",
    );
    const sellable = sellableEvaluations.map(({ product }) => product);
    const critical = sellable.filter(
      (product) => product.status === "critical",
    );
    const warning = sellable.filter((product) => product.status === "warning");
    const priority = [...critical, ...warning].sort(
      (a, b) => a.projectedMargin - b.projectedMargin,
    )[0];
    const discounts = sellable.map(
      (product) =>
        promotionSafeLimit(product, settings.financial.minimumMargin)
          .maxDiscount,
    );
    const pressuringCosts = costs
      .map((cost) => ({
        id: cost.id,
        name: cost.name,
        affectedProducts: sellable.filter((product) =>
          cost.type === "packaging"
            ? product.packaging?.some((entry) => entry.id === cost.id)
            : product.components?.some((entry) => entry.id === cost.id),
        ).length,
        variation:
          priceVariation(
            effectiveUnitCostForItem(cost),
            cost.previousUnitCost,
          ) ?? 0,
      }))
      .filter((cost) => cost.variation > 0 && cost.affectedProducts > 0)
      .sort((a, b) => b.variation - a.variation)
      .slice(0, 3);
    return {
      averageMargin: Number(
        (sellable.length
          ? sellable.reduce(
              (sum, product) => sum + product.projectedMargin,
              0,
            ) / sellable.length
          : 0
        ).toFixed(1),
      ),
      targetMargin: settings.financial.targetMargin,
      reviewCount: critical.length + warning.length,
      recommendedCount: sellable.filter(
        (product) =>
          product.variableCost > 0 &&
          product.recommendedPrice > product.currentPrice + 0.009,
      ).length,
      criticalCount: critical.length,
      warningCount: warning.length,
      priorityProduct: priority
        ? {
            id: priority.id,
            name: priority.name,
            margin: priority.projectedMargin,
            currentPrice: priority.currentPrice,
            recommendedPrice: priority.recommendedPrice,
          }
        : undefined,
      pressuringCosts,
      promotionOpportunityCount: discounts.filter((discount) => discount >= 1)
        .length,
      maximumSafeDiscount: Math.floor(Math.max(0, ...discounts)),
    };
  },
};
