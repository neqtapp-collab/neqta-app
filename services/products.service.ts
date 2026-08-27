import { createClient } from '@/lib/supabase/client';
import { getCurrentContext } from '@/lib/supabase/current-context';
import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CreateProductDTO,
  Product,
  ProductKind,
  ProductPackaging,
  ProductStatus,
  UpdateProductDTO,
} from '@/types/product';
import type { CostItem } from '@/types/cost';
import { componentCost, type Unit } from '@/lib/units';

type ProductMetadata = Pick<Product,
  'description' | 'variableCost' | 'targetMargin' | 'recommendedPrice' | 'components' | 'packaging'
> & { version: 1 };

type ProductCategoryRow = {
  id: string;
  name: string;
};

type ProductRow = {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  description: string | null;
  sale_price: number | string | null;
  packaging_cost: number | string | null;
  is_base: boolean | null;
  yield_quantity: number | string | null;
  yield_unit: string | null;
  active: boolean | null;
  created_at: string;
  updated_at: string;
  product_categories?: ProductCategoryRow | ProductCategoryRow[] | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ProductsService {
  list(supabase?: SupabaseClient): Promise<Product[]>;

  getById(id: string): Promise<Product | null>;

  create(dto: CreateProductDTO): Promise<Product>;

  update(
    id: string,
    dto: UpdateProductDTO,
  ): Promise<Product>;

  save(product: Product): Promise<Product>;

  remove(id: string): Promise<void>;
}

function toNumber(
  value: number | string | null | undefined,
): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function getCategoryName(
  relation: ProductRow['product_categories'],
): string {
  if (!relation) {
    return '';
  }

  if (Array.isArray(relation)) {
    return relation[0]?.name ?? '';
  }

  return relation.name ?? '';
}

function calculateStatus(
  projectedMargin: number,
  targetMargin: number,
): ProductStatus {
  if (projectedMargin <= 0) {
    return 'warning';
  }

  if (projectedMargin < targetMargin * 0.75) {
    return 'critical';
  }

  if (projectedMargin < targetMargin) {
    return 'warning';
  }

  return 'healthy';
}

function readMetadata(value: string | null): Partial<ProductMetadata> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Partial<ProductMetadata>;
    return parsed.version === 1 ? parsed : { description: value };
  } catch {
    return { description: value };
  }
}

function writeMetadata(dto: CreateProductDTO | UpdateProductDTO): string {
  return JSON.stringify({
    version: 1,
    description: dto.description ?? '',
    variableCost: dto.variableCost ?? 0,
    targetMargin: dto.targetMargin ?? 0,
    recommendedPrice: dto.recommendedPrice ?? dto.currentPrice ?? 0,
    components: dto.components ?? [],
    packaging: dto.packaging ?? [],
  } satisfies ProductMetadata);
}

function calculatePackagingCost(packaging: ProductPackaging[] | undefined): number {
  return (packaging ?? []).reduce(
    (total, item) => total + toNumber(item.quantity) * toNumber(item.unitCost),
    0,
  );
}

function componentReferenceCost(item: CostItem): number {
  return item.purchaseUnit === 'g' || item.purchaseUnit === 'ml'
    ? item.baseUnitCost * 1000
    : item.baseUnitCost;
}

function normalizedName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

function matchesLegacyCostReference(reference: { id: string; name: string }, item: CostItem): boolean {
  if (reference.id === item.id) return true;
  const referenceName = normalizedName(reference.name);
  const itemName = normalizedName(item.name);
  return referenceName === itemName
    || (referenceName.length >= 5 && itemName.length >= 5
      && (referenceName.includes(itemName) || itemName.includes(referenceName)));
}

async function loadCostItems(supabase: SupabaseClient, storeId: string): Promise<CostItem[]> {
  const { data, error } = await supabase.from('neqta_records').select('record_key,data')
    .eq('store_id', storeId).eq('namespace', 'cost-items');
  if (error) throw new Error(`Erro ao carregar custos dos produtos: ${error.message}`);
  return (data ?? []).map((row) => ({ ...(row.data as CostItem), id: row.record_key }));
}

function enrichProductCosts(product: Product, costs: CostItem[]): Product {
  const components = (product.components ?? []).map((component) => {
    const cost = costs.find((item) => item.type === 'ingredient' && matchesLegacyCostReference(component, item));
    return cost ? { ...component, id: cost.id, name: cost.name, unitCost: componentReferenceCost(cost) } : component;
  });
  const packaging = (product.packaging ?? []).map((item) => {
    const cost = costs.find((entry) => entry.type === 'packaging' && matchesLegacyCostReference(item, entry));
    return cost ? { ...item, id: cost.id, name: cost.name, unitCost: cost.baseUnitCost } : item;
  });
  const componentsCost = components.reduce(
    (total, item) => total + componentCost(item.quantity, item.unit as Unit, item.unitCost), 0,
  );
  const packagingCost = calculatePackagingCost(packaging);
  const variableCost = componentsCost + packagingCost;
  const projectedMargin = product.currentPrice > 0
    ? ((product.currentPrice - variableCost) / product.currentPrice) * 100
    : 0;
  const recommendedPrice = product.targetMargin < 100
    ? variableCost / (1 - product.targetMargin / 100)
    : product.currentPrice;
  const isBase = product.status === 'recipe';
  return {
    ...product,
    components,
    packaging,
    variableCost,
    projectedMargin,
    recommendedPrice,
    status: isBase ? 'recipe' : calculateStatus(projectedMargin, product.targetMargin),
    unitCost: isBase && product.yieldQuantity && product.yieldQuantity > 0
      ? variableCost / product.yieldQuantity
      : product.unitCost,
  };
}

function mapProduct(row: ProductRow): Product {
  const currentPrice = toNumber(row.sale_price);
  const metadata = readMetadata(row.description);
  const packaging = Array.isArray(metadata.packaging) ? metadata.packaging : [];

  /*
   * Esses valores ainda serão enriquecidos nas próximas etapas
   * usando ficha técnica, custos, store_settings e precificação.
   */
  const variableCost = metadata.variableCost ?? 0;
  const targetMargin = metadata.targetMargin ?? 0;
  const projectedMargin = currentPrice > 0
    ? ((currentPrice - variableCost) / currentPrice) * 100
    : 0;
  const recommendedPrice = metadata.recommendedPrice ?? currentPrice;

  const kind: ProductKind = 'product';
  const isBase = Boolean(row.is_base);
  const yieldQuantity = row.yield_quantity !== null ? toNumber(row.yield_quantity) : undefined;
  const yieldUnit = row.yield_unit ?? undefined;

  return {
    id: row.id,
    name: row.name,
    category: getCategoryName(row.product_categories),

    variableCost,
    currentPrice,
    projectedMargin,
    targetMargin,
    recommendedPrice,

    status: isBase ? 'recipe' : calculateStatus(projectedMargin, targetMargin),

    kind,

    yield:
      row.yield_quantity && row.yield_unit
        ? `${toNumber(row.yield_quantity)} ${row.yield_unit}`
        : undefined,

    yieldQuantity,
    yieldUnit,
    unitCost: isBase && yieldQuantity && yieldQuantity > 0 ? variableCost / yieldQuantity : undefined,

    componentCount: metadata.components?.length ?? 0,
    description: metadata.description ?? '',
    components: metadata.components ?? [],
    packaging,
  };
}

async function getStoreId(supabase: SupabaseClient): Promise<string> {
  const context = await getCurrentContext(supabase);

  if (!context) {
    throw new Error(
      'Não foi possível identificar o contexto atual do usuário.',
    );
  }

  if (!context.store) {
    throw new Error(
      'Não foi possível identificar a loja atual.',
    );
  }

  return context.store.id;
}

async function findCategoryId(
  categoryName: string | undefined,
  storeId: string,
): Promise<string | null> {
  const normalizedName = categoryName?.trim();

  if (!normalizedName) {
    return null;
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('product_categories')
    .select('id')
    .eq('store_id', storeId)
    .ilike('name', normalizedName)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Erro ao localizar categoria: ${error.message}`,
    );
  }

  if (data?.id) return data.id;

  const { data: created, error: createError } = await supabase
    .from('product_categories')
    .insert({ store_id: storeId, name: normalizedName })
    .select('id')
    .single();

  if (createError) {
    throw new Error(`Erro ao criar categoria: ${createError.message}`);
  }

  return created.id;
}

async function getProductRow(
  id: string,
): Promise<ProductRow | null> {
  const supabase = createClient();
  const storeId = await getStoreId(supabase);

  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      store_id,
      category_id,
      name,
      sku,
      description,
      sale_price,
      packaging_cost,
      is_base,
      yield_quantity,
      yield_unit,
      active,
      created_at,
      updated_at,
      product_categories (
        id,
        name
      )
    `)
    .eq('id', id)
    .eq('store_id', storeId)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Erro ao carregar produto: ${error.message}`,
    );
  }

  return data as ProductRow | null;
}

export const productsService: ProductsService = {
  async list(providedClient) {
    const supabase = providedClient ?? createClient();
    const storeId = await getStoreId(supabase);

    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        store_id,
        category_id,
        name,
        sku,
        description,
        sale_price,
        packaging_cost,
        is_base,
        yield_quantity,
        yield_unit,
        active,
        created_at,
        updated_at,
        product_categories (
          id,
          name
        )
      `)
      .eq('store_id', storeId)
      .eq('active', true)
      .order('name', {
        ascending: true,
      });

    if (error) {
      throw new Error(
        `Erro ao carregar produtos: ${error.message}`,
      );
    }

    const costs = await loadCostItems(supabase, storeId);
    return (data as ProductRow[]).map(mapProduct).map((product) => enrichProductCosts(product, costs));
  },

  async getById(id) {
    const row = await getProductRow(id);

    if (!row) {
      return null;
    }

    const supabase = createClient();
    const storeId = await getStoreId(supabase);
    return enrichProductCosts(mapProduct(row), await loadCostItems(supabase, storeId));
  },

  async create(dto) {
    const supabase = createClient();
    const storeId = await getStoreId(supabase);

    const categoryId = await findCategoryId(
      dto.category,
      storeId,
    );

    const { data, error } = await supabase
      .from('products')
      .insert({
        store_id: storeId,
        category_id: categoryId,

        name: dto.name.trim(),

        description: writeMetadata(dto),

        sale_price: dto.currentPrice,

        packaging_cost: calculatePackagingCost(dto.packaging),

        is_base: dto.isBase ?? false,
        yield_quantity: dto.yieldQuantity ?? null,
        yield_unit: dto.yieldUnit ?? null,

        active: true,
      })
      .select(`
        id,
        store_id,
        category_id,
        name,
        sku,
        description,
        sale_price,
        packaging_cost,
        is_base,
        yield_quantity,
        yield_unit,
        active,
        created_at,
        updated_at,
        product_categories (
          id,
          name
        )
      `)
      .single();

    if (error) {
      throw new Error(
        `Erro ao criar produto: ${error.message}`,
      );
    }

    return mapProduct(data as ProductRow);
  },

  async update(id, dto) {
    const supabase = createClient();
    const storeId = await getStoreId(supabase);

    const payload: {
      name?: string;
      category_id?: string | null;
      sale_price?: number;
      description?: string;
      packaging_cost?: number;
      is_base?: boolean;
      yield_quantity?: number | null;
      yield_unit?: string | null;
    } = {};

    const currentRow = await getProductRow(id);

    if (!currentRow) {
      throw new Error('Produto não encontrado.');
    }

    const current = mapProduct(currentRow);
    const mergedDto: CreateProductDTO = {
      name: dto.name ?? current.name,
      category: dto.category ?? current.category,
      currentPrice: dto.currentPrice ?? current.currentPrice,
      targetMargin: dto.targetMargin ?? current.targetMargin,
      kind: dto.kind ?? current.kind,
      description: dto.description ?? current.description,
      variableCost: dto.variableCost ?? current.variableCost,
      recommendedPrice: dto.recommendedPrice ?? current.recommendedPrice,
      components: dto.components ?? current.components,
      packaging: dto.packaging ?? current.packaging,
      isBase: dto.isBase ?? current.status === 'recipe',
      yieldQuantity: dto.yieldQuantity ?? current.yieldQuantity,
      yieldUnit: dto.yieldUnit ?? current.yieldUnit,
    };

    if (dto.name !== undefined) {
      payload.name = dto.name.trim();
    }

    if (dto.currentPrice !== undefined) {
      payload.sale_price = dto.currentPrice;
    }

    if (dto.category !== undefined) {
      payload.category_id = await findCategoryId(
        dto.category,
        storeId,
      );
    }

    if (dto.description !== undefined || dto.variableCost !== undefined ||
        dto.targetMargin !== undefined || dto.recommendedPrice !== undefined ||
        dto.components !== undefined || dto.packaging !== undefined) {
      payload.description = writeMetadata(mergedDto);
    }

    if (dto.packaging !== undefined) {
      payload.packaging_cost = calculatePackagingCost(mergedDto.packaging);
    }
    if (dto.isBase !== undefined) payload.is_base = dto.isBase;
    if (dto.yieldQuantity !== undefined) payload.yield_quantity = dto.yieldQuantity;
    if (dto.yieldUnit !== undefined) payload.yield_unit = dto.yieldUnit;

    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id)
      .eq('store_id', storeId)
      .select(`
        id,
        store_id,
        category_id,
        name,
        sku,
        description,
        sale_price,
        packaging_cost,
        is_base,
        yield_quantity,
        yield_unit,
        active,
        created_at,
        updated_at,
        product_categories (
          id,
          name
        )
      `)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Erro ao atualizar produto: ${error.message}`,
      );
    }

    if (!data) {
      throw new Error('Produto não encontrado.');
    }

    return mapProduct(data as ProductRow);
  },

  async save(product) {
    if (!UUID_PATTERN.test(product.id)) {
      return this.create({
        name: product.name,
        category: product.category,
        currentPrice: product.currentPrice,
        targetMargin: product.targetMargin,
        kind: product.kind,
        description: product.description,
        variableCost: product.variableCost,
        recommendedPrice: product.recommendedPrice,
        components: product.components,
        packaging: product.packaging,
        isBase: product.status === 'recipe',
        yieldQuantity: product.yieldQuantity,
        yieldUnit: product.yieldUnit,
      });
    }

    const existing = await this.getById(product.id);

    if (!existing) {
      /*
       * save() existia no serviço antigo e pode ser utilizado
       * por outras partes da interface.
       *
       * Não criamos manualmente usando product.id porque os IDs
       * do banco são administrados pelo Supabase/Postgres.
       */
      return this.create({
        name: product.name,
        category: product.category,
        currentPrice: product.currentPrice,
        targetMargin: product.targetMargin,
        kind: product.kind,
        description: product.description,
        variableCost: product.variableCost,
        recommendedPrice: product.recommendedPrice,
        components: product.components,
        packaging: product.packaging,
        isBase: product.status === 'recipe',
        yieldQuantity: product.yieldQuantity,
        yieldUnit: product.yieldUnit,
      });
    }

    return this.update(product.id, {
      name: product.name,
      category: product.category,
      currentPrice: product.currentPrice,
      targetMargin: product.targetMargin,
      kind: product.kind,
      description: product.description,
      variableCost: product.variableCost,
      recommendedPrice: product.recommendedPrice,
      components: product.components,
      packaging: product.packaging,
      isBase: product.status === 'recipe',
      yieldQuantity: product.yieldQuantity,
      yieldUnit: product.yieldUnit,
    });
  },

  async remove(id) {
    const supabase = createClient();
    const storeId = await getStoreId(supabase);

    /*
     * Soft delete.
     *
     * A linha continua no banco para preservar histórico,
     * mas deixa de aparecer na aplicação.
     */
    const { error } = await supabase
      .from('products')
      .update({
        active: false,
      })
      .eq('id', id)
      .eq('store_id', storeId);

    if (error) {
      throw new Error(
        `Erro ao remover produto: ${error.message}`,
      );
    }
  },
};
