export type CostItemType = "ingredient" | "packaging";
export type PurchaseUnit = "kg" | "g" | "L" | "ml" | "un" | "cx" | "pct";
export type BasePurchaseUnit = Exclude<PurchaseUnit, "cx" | "pct">;

export type Supplier = {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  notes?: string;
  active?: boolean;
};
export type PriceHistory = {
  id: string;
  date: string;
  price: number;
  unitCost: number;
};
export type ProductCostRelation = {
  productId: string;
  name: string;
  category: string;
  margin: number;
  quantity?: number;
  unit?: string;
};
export type CostItem = {
  id: string;
  name: string;
  type: CostItemType;
  category: string;
  supplierId?: string;
  purchasePrice: number;
  purchaseQuantity: number;
  purchaseUnit: PurchaseUnit;
  baseUnitCost: number;
  effectiveUnitCost?: number;
  packageContentQuantity?: number;
  packageContentUnit?: BasePurchaseUnit;
  previousUnitCost?: number;
  freight?: number;
  discount?: number;
  grossQuantity?: number;
  netQuantity?: number;
  lossPercentage?: number;
  purchaseDate?: string;
  notes?: string;
  usedBy: string[];
  affectedProducts?: ProductCostRelation[];
  history: PriceHistory[];
  createdAt: string;
  updatedAt: string;
};

export type Purchase = {
  id: string;
  itemId: string;
  supplierId?: string;
  date: string;
  quantity: number;
  unit: PurchaseUnit;
  price: number;
  freight?: number;
  discount?: number;
  notes?: string;
};
export type StructureCost = {
  id: string;
  description: string;
  category: string;
  monthlyValue: number;
  recurrence: "monthly";
  allocationMode?: "all" | "selected";
};
export type TeamCost = {
  id: string;
  role: string;
  salary: number;
  charges: number;
  benefits: number;
  otherCosts: number;
  directProduction?: boolean;
  productiveHoursMonthly?: number;
};

export type CostItemPayload = Omit<
  CostItem,
  | "id"
  | "baseUnitCost"
  | "effectiveUnitCost"
  | "history"
  | "usedBy"
  | "createdAt"
  | "updatedAt"
> & { id?: string; history?: PriceHistory[] };
