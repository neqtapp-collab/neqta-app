export type ProductStatus = 'healthy' | 'warning' | 'critical' | 'recipe';
export type ProductKind = 'product' | 'service';

export interface Product {
  id: string; name: string; category: string; variableCost: number;
  currentPrice: number; projectedMargin: number; targetMargin: number;
  recommendedPrice: number; status: ProductStatus; kind: ProductKind; yield?: string;
  yieldQuantity?: number; yieldUnit?: string; unitCost?: number; componentCount?: number;
}

export interface CreateProductDTO {
  name: string; category: string; currentPrice: number; targetMargin: number; kind?: ProductKind;
}
export type UpdateProductDTO = Partial<CreateProductDTO>;
