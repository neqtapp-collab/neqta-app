import { PricingSettings } from '@/components/PricingSettings';
import { structureCostService } from '@/services/costs.service';
import { createClient } from '@/lib/supabase/server';

export default async function Page() { const supabase=await createClient();const costs=await structureCostService.list(supabase);return <PricingSettings structureCostsTotal={costs.reduce((total,item)=>total+item.monthlyValue,0)} />; }
