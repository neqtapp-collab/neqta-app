import { AppShell } from '@/components/AppShell';
import { ProductsPage } from '@/components/ProductsPage';
import { productsService } from '@/services/products.service';

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; view?: string }> }) {
  const [products, params] = await Promise.all([productsService.list(), searchParams]);
  return <AppShell><ProductsPage initialProducts={products} initialStatus={params.status} initialView={params.view} /></AppShell>;
}
