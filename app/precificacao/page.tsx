import { AppShell } from '@/components/AppShell';
import { PricingPage } from '@/components/PricingPage';
import { createClient } from '@/lib/supabase/server';
import { productsService } from '@/services/products.service';
import { structureCostService, teamCostService } from '@/services/costs.service';

export default async function Page({searchParams}:{searchParams:Promise<{produto?:string}>}){
  const supabase=await createClient();
  const [products,structure,team,params]=await Promise.all([productsService.list(supabase),structureCostService.list(supabase),teamCostService.list(supabase),searchParams]);
  const monthlyOverhead=structure.filter(item=>(item.allocationMode??'all')==='all').reduce((total,item)=>total+item.monthlyValue,0)+team.filter(item=>!item.directProduction).reduce((total,item)=>total+item.salary+item.charges+item.benefits+item.otherCosts,0);
  const productiveTeam=team.filter(item=>item.directProduction&&item.productiveHoursMonthly);const productivePayroll=productiveTeam.reduce((total,item)=>total+item.salary+item.charges+item.benefits+item.otherCosts,0);const productiveHours=productiveTeam.reduce((total,item)=>total+(item.productiveHoursMonthly??0),0);const directLaborHourlyCost=productiveHours>0?productivePayroll/productiveHours:0;
  return <AppShell active="/precificacao"><PricingPage initialProducts={products} initialProductId={params.produto} monthlyOverhead={monthlyOverhead} selectiveCosts={structure.filter(item=>item.allocationMode==='selected')} directLaborHourlyCost={directLaborHourlyCost}/></AppShell>;
}
