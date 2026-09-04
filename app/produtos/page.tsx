import { AppShell } from "@/components/AppShell";
import { ProductsPage } from "@/components/ProductsPage";
import { productsService } from "@/services/products.service";
import { createClient } from "@/lib/supabase/server";
import {
  structureCostService,
  teamCostService,
} from "@/services/costs.service";
import { loadSettingsFromSupabase } from "@/lib/settings";
import {
  buildPricingContext,
  evaluateProductPricing,
} from "@/lib/pricing-evaluation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string; product?: string }>;
}) {
  const supabase = await createClient();
  const [products, structure, team, settings, params] = await Promise.all([
    productsService.list(supabase),
    structureCostService.list(supabase),
    teamCostService.list(supabase),
    loadSettingsFromSupabase(supabase),
    searchParams,
  ]);
  const context = buildPricingContext(structure, team);
  const evaluated = products.map(
    (product) =>
      evaluateProductPricing(
        product,
        settings,
        context.monthlyOverhead,
        context.selectiveCosts,
        context.directLaborHourlyCost,
      ).product,
  );
  return (
    <AppShell>
      <ProductsPage
        initialProducts={evaluated}
        initialStatus={params.status}
        initialView={params.view}
        initialProductId={params.product}
      />
    </AppShell>
  );
}
