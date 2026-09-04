export type ProductStatus = "healthy" | "warning" | "critical" | "recipe";
export type ProductKind = "product" | "service";

export interface ProductComponent {
  id: string;
  name: string;
  type?: "INSUMO" | "RECEITA-BASE";
  quantity: number;
  unit: string;
  unitCost: number;
}

export interface ProductPackaging {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
}
export type ProductOperationalCost = {
  kind: "gas" | "energy" | "water" | "consumables" | "other";
  name: string;
  amount: number;
};
export type ProductUtilityUsage = {
  costId: string;
  intensity: "low" | "medium" | "high";
};

export interface Product {
  id: string;
  name: string;
  category: string;
  variableCost: number;
  currentPrice: number;
  projectedMargin: number;
  targetMargin: number;
  recommendedPrice: number;
  status: ProductStatus;
  kind: ProductKind;
  yield?: string;
  yieldQuantity?: number;
  yieldUnit?: string;
  unitCost?: number;
  componentCount?: number;
  description?: string;
  components?: ProductComponent[];
  packaging?: ProductPackaging[];
  laborMinutes?: number;
  directOperationalCost?: number;
  operationalCosts?: ProductOperationalCost[];
  utilityUsages?: ProductUtilityUsage[];
  pricingCompleteness?: number;
  pricingConfidence?: number;
  pricingConfidenceLevel?: 'baixa' | 'média' | 'alta';
  pricingWarnings?: string[];
  pricingMissingInputs?: string[];
  coveragePrice?: number;
  sustainablePrice?: number;
  pricingFormulaVersion?: string;
  pricingEffectiveCost?: number;
  pricingEmbeddedFees?: number;
}

export interface CreateProductDTO {
  name: string;
  category: string;
  currentPrice: number;
  targetMargin: number;
  kind?: ProductKind;
  description?: string;
  variableCost?: number;
  recommendedPrice?: number;
  components?: ProductComponent[];
  packaging?: ProductPackaging[];
  isBase?: boolean;
  yieldQuantity?: number;
  yieldUnit?: string;
  laborMinutes?: number;
  directOperationalCost?: number;
  operationalCosts?: ProductOperationalCost[];
  utilityUsages?: ProductUtilityUsage[];
}
export type UpdateProductDTO = Partial<CreateProductDTO>;
