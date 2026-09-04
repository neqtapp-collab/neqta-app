import { AppShell } from '@/components/AppShell';
import { PromotionsPage } from '@/components/PromotionsPage';
import { createClient } from '@/lib/supabase/server';
import { loadSettingsFromSupabase } from '@/lib/settings';
import { buildPricingContext, evaluateProductPricing } from '@/lib/pricing-evaluation';
import { structureCostService, teamCostService } from '@/services/costs.service';
import { productsService } from '@/services/products.service';
import { promotionDismissalsService, promotionsService } from '@/services/promotions.service';

export default async function Page(){
  const supabase=await createClient();
  const [products,promotions,dismissals,settings,structure,team]=await Promise.all([
    productsService.list(supabase),promotionsService.list(supabase),promotionDismissalsService.list(supabase),
    loadSettingsFromSupabase(supabase),structureCostService.list(supabase),teamCostService.list(supabase),
  ]);
  const context=buildPricingContext(structure,team);
  const evaluatedProducts=products.map((product)=>evaluateProductPricing(product,settings,context.monthlyOverhead,context.selectiveCosts,context.directLaborHourlyCost).product);
  return <AppShell active="/promocoes"><PromotionsPage initialProducts={evaluatedProducts} initialPromotions={promotions} initialDismissedSuggestionIds={dismissals.map((row)=>row.id)} initialSettings={settings} monthlyOverhead={context.monthlyOverhead} selectiveCosts={context.selectiveCosts} directLaborHourlyCost={context.directLaborHourlyCost}/></AppShell>
}
