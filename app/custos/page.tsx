import { AppShell } from '@/components/AppShell';
import { CostsPage } from '@/components/CostsPage';
import { costService, purchaseService, structureCostService, supplierService, teamCostService } from '@/services/costs.service';

export default async function Page() {
  const [initialItems, initialPurchases, suppliers, initialStructure, initialTeam] = await Promise.all([costService.list(), purchaseService.list(), supplierService.list(), structureCostService.list(), teamCostService.list()]);
  return <AppShell><CostsPage initialItems={initialItems} initialPurchases={initialPurchases} suppliers={suppliers} initialStructure={initialStructure} initialTeam={initialTeam}/></AppShell>;
}
