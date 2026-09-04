import { AppShell } from "@/components/AppShell";
import { PricingPage } from "@/components/PricingPage";
import { createClient } from "@/lib/supabase/server";
import { productsService } from "@/services/products.service";
import {
  structureCostService,
  teamCostService,
} from "@/services/costs.service";
import { loadSettingsFromSupabase } from "@/lib/settings";
import { buildPricingContext } from "@/lib/pricing-evaluation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ produto?: string }>;
}) {
  const supabase = await createClient();
  const [products, structure, team, settings, params] = await Promise.all([
    productsService.list(supabase),
    structureCostService.list(supabase),
    teamCostService.list(supabase),
    loadSettingsFromSupabase(supabase),
    searchParams,
  ]);
  const { monthlyOverhead, selectiveCosts, directLaborHourlyCost } =
    buildPricingContext(structure, team);
  return (
    <AppShell active="/precificacao">
      <PricingPage
        initialProducts={products}
        initialProductId={params.produto}
        monthlyOverhead={monthlyOverhead}
        selectiveCosts={selectiveCosts}
        directLaborHourlyCost={directLaborHourlyCost}
        initialSettings={settings}
      />
    </AppShell>
  );
}
