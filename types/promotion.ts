export type PromotionType='percentage'|'fixed'|'price'|'take2'|'combo';
export type PromotionSource='neqta'|'manual';
export type PromotionStatus='safe'|'warning'|'unsafe'|'active'|'ended';
export interface Promotion{ id:string;productId:string;secondaryProductId?:string;type:PromotionType;discountValue:number;promotionalPrice:number;marginAfterPromotion:number;channels:string[];source:PromotionSource;status:PromotionStatus;createdAt:string;startDate?:string;endDate?:string }
