import { AppShell } from '@/components/AppShell';
import { CostsPage } from '@/components/CostsPage';
import { costService, purchaseService, structureCostService, supplierService, teamCostService } from '@/services/costs.service';
import { createClient } from '@/lib/supabase/server';
import { productsService } from '@/services/products.service';

export default async function Page() {
  const supabase = await createClient();
  const [initialItems, initialPurchases, suppliers, initialStructure, initialTeam, products] = await Promise.all([costService.list(supabase), purchaseService.list(supabase), supplierService.list(supabase), structureCostService.list(supabase), teamCostService.list(supabase), productsService.list(supabase)]);
  const itemsWithUsage = initialItems.map((item) => {
    const affectedProducts = products.filter((product) =>
      item.type === 'packaging'
        ? product.packaging?.some((entry) => entry.id === item.id)
        : product.components?.some((entry) => entry.id === item.id),
    ).map((product) => ({
      productId: product.id,
      name: product.name,
      category: product.category,
      margin: product.projectedMargin,
    }));
    return { ...item, usedBy: affectedProducts.map((product) => product.name), affectedProducts };
  });
  return <AppShell><CostsPage initialItems={itemsWithUsage} initialPurchases={initialPurchases} suppliers={suppliers} initialStructure={initialStructure} initialTeam={initialTeam}/></AppShell>;
}
