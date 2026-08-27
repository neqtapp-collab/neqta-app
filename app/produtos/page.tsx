import { AppShell } from '@/components/AppShell';
import { ProductsPage } from '@/components/ProductsPage';
import { productsService } from '@/services/products.service';
import { createClient } from '@/lib/supabase/server';

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; view?: string }> }) {
  const supabase = await createClient();
  const [products, params] = await Promise.all([productsService.list(supabase), searchParams]);
  return <AppShell><ProductsPage initialProducts={products} initialStatus={params.status} initialView={params.view} /></AppShell>;
}
