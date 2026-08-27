import { AppShell } from '@/components/AppShell';
import { PromotionsPage } from '@/components/PromotionsPage';
import { createClient } from '@/lib/supabase/server';
import { productsService } from '@/services/products.service';
import { promotionDismissalsService, promotionsService } from '@/services/promotions.service';
export default async function Page(){const supabase=await createClient();const [products,promotions,dismissals]=await Promise.all([productsService.list(supabase),promotionsService.list(supabase),promotionDismissalsService.list(supabase)]);return <AppShell active="/promocoes"><PromotionsPage initialProducts={products} initialPromotions={promotions} initialDismissedSuggestionIds={dismissals.map((row)=>row.id)}/></AppShell>}
