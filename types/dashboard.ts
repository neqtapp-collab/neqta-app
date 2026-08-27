export type DashboardPriorityProduct = { id:string;name:string;margin:number;currentPrice:number;recommendedPrice:number };
export type DashboardPressuringCost = { id:string;name:string;affectedProducts:number;variation:number };
export interface DashboardOverviewResponse{averageMargin:number;targetMargin:number;reviewCount:number;recommendedCount:number;criticalCount:number;warningCount:number;priorityProduct?:DashboardPriorityProduct;pressuringCosts:DashboardPressuringCost[];promotionOpportunityCount:number;maximumSafeDiscount:number}
