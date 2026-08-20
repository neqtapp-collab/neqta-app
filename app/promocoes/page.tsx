import { AppShell } from '@/components/AppShell';
import { PromotionsPage } from '@/components/PromotionsPage';
import { productsService } from '@/services/products.service';
export default async function Page(){const products=await productsService.list();return <AppShell active="/promocoes"><PromotionsPage initialProducts={products}/></AppShell>}
