import { AppShell } from '@/components/AppShell';
import { PricingPage } from '@/components/PricingPage';
import { productsService } from '@/services/products.service';

export default async function Page({searchParams}:{searchParams:Promise<{produto?:string}>}){
  const [products,params]=await Promise.all([productsService.list(),searchParams]);
  return <AppShell active="/precificacao"><PricingPage initialProducts={products} initialProductId={params.produto}/></AppShell>;
}
