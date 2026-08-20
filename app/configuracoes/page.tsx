import { PricingSettings } from '@/components/PricingSettings';
import { structureCostService } from '@/services/costs.service';

export default async function Page() { const costs=await structureCostService.list();return <PricingSettings structureCostsTotal={costs.reduce((total,item)=>total+item.monthlyValue,0)} />; }
