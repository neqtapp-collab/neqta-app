export type ThemePreference = 'dark' | 'light' | 'system';
export type PriceRounding = 'x90' | 'x99' | 'integer' | 'none';

export type SalesChannelSetting = {
  id: string;
  name: string;
  type: string;
  percentageFee: number;
  fixedFee: number;
  processesPayment: boolean;
  active: boolean;
  custom?: boolean;
};

export type PaymentSetting = {
  id: string;
  name: string;
  percentageFee: number;
  fixedFee: number;
  anticipationFee: number;
  active: boolean;
  custom?: boolean;
};

export type NeqtaSettings = {
  company: { name: string; segment: string; cnpj: string; taxRegime: string; operatingDays: number };
  financial: {
    targetMargin: number;
    minimumMargin: number;
    estimatedMonthlyRevenue: number;
    salesTax: number;
    operationalReserve: number;
    paymentFeeStrategy: 'highest' | 'first';
  };
  channels: SalesChannelSetting[];
  payments: PaymentSetting[];
  preferences: {
    theme: ThemePreference;
    rounding: PriceRounding;
    massUnit: 'kg' | 'g';
    volumeUnit: 'L' | 'ml';
    itemUnit: 'un';
    alerts: { costIncrease: boolean; belowMinimumMargin: boolean; safePromotion: boolean };
  };
};
