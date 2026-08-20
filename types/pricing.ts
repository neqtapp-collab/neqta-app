export interface PricingSimulationDTO{productId:string;salePrice:number}
export interface PricingSimulationResponse{margin:number;contribution:number;status:'healthy'|'warning'|'critical'}
