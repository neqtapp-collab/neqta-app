import { AppShell } from '@/components/AppShell';
import { PricingPage } from '@/components/PricingPage';
import { createClient } from '@/lib/supabase/server';
import { productsService } from '@/services/products.service';

export default async function Page({searchParams}:{searchParams:Promise<{produto?:string}>}){
  const supabase=await createClient();
  const [products,params]=await Promise.all([productsService.list(supabase),searchParams]);
  return <AppShell active="/precificacao"><PricingPage initialProducts={products} initialProductId={params.produto}/></AppShell>;
}
