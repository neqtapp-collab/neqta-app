import type { NeqtaSettings } from '@/types/settings';
import { normalizeCNPJ, normalizeShortText, normalizeStoredNumber, sanitizeInteger, sanitizePercent } from '@/lib/input';

export const SETTINGS_STORAGE_KEY = 'neqta-settings';

export const defaultSettings: NeqtaSettings = {
  company: { name: 'Burger House', segment: 'Restaurante', cnpj: '', taxRegime: '', operatingDays: 30 },
  financial: { targetMargin: 30, minimumMargin: 25, estimatedMonthlyRevenue: 0, salesTax: 0 },
  channels: [
    { id: 'store', name: 'Loja / Balcão', type: 'Loja física', percentageFee: 0, fixedFee: 0, processesPayment: false, active: true },
    { id: 'whatsapp', name: 'WhatsApp', type: 'Venda direta', percentageFee: 0, fixedFee: 0, processesPayment: false, active: false },
    { id: 'delivery', name: 'Delivery próprio', type: 'Delivery', percentageFee: 0, fixedFee: 0, processesPayment: false, active: false },
    { id: 'ifood', name: 'iFood', type: 'Marketplace', percentageFee: 23, fixedFee: 0, processesPayment: true, active: true },
    { id: '99', name: '99', type: 'Marketplace', percentageFee: 14, fixedFee: 0, processesPayment: true, active: true },
  ],
  payments: [
    { id: 'pix', name: 'PIX', percentageFee: 0, fixedFee: 0, anticipationFee: 0, active: true },
    { id: 'cash', name: 'Dinheiro', percentageFee: 0, fixedFee: 0, anticipationFee: 0, active: true },
    { id: 'debit', name: 'Débito', percentageFee: 1.49, fixedFee: 0, anticipationFee: 0, active: true },
    { id: 'credit', name: 'Crédito', percentageFee: 3.49, fixedFee: 0, anticipationFee: 0, active: true },
    { id: 'online', name: 'Pagamento online', percentageFee: 4.29, fixedFee: 0, anticipationFee: 0, active: true },
  ],
  preferences: {
    theme: 'dark', rounding: 'x90', massUnit: 'kg', volumeUnit: 'L', itemUnit: 'un',
    alerts: { costIncrease: true, belowMinimumMargin: true, safePromotion: true },
  },
};

export function loadSettings(): NeqtaSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? 'null') as Partial<NeqtaSettings> | null;
    if (!stored) return defaultSettings;
    const company = { ...defaultSettings.company, ...stored.company };
    const financial = { ...defaultSettings.financial, ...stored.financial };
    return {
      ...defaultSettings,
      ...stored,
      company: { ...company, cnpj: normalizeCNPJ(company.cnpj), operatingDays: sanitizeInteger(company.operatingDays, 1, 31) },
      financial: { ...financial, targetMargin: sanitizePercent(financial.targetMargin), minimumMargin: sanitizePercent(financial.minimumMargin), estimatedMonthlyRevenue: normalizeStoredNumber(financial.estimatedMonthlyRevenue), salesTax: sanitizePercent(financial.salesTax) },
      channels: (stored.channels?.length ? stored.channels : defaultSettings.channels).map(channel => ({ ...channel, percentageFee: sanitizePercent(channel.percentageFee), fixedFee: normalizeStoredNumber(channel.fixedFee) })),
      payments: (stored.payments?.length ? stored.payments : defaultSettings.payments).map(payment => ({ ...payment, percentageFee: sanitizePercent(payment.percentageFee), fixedFee: normalizeStoredNumber(payment.fixedFee), anticipationFee: sanitizePercent(payment.anticipationFee) })),
      preferences: {
        ...defaultSettings.preferences,
        ...stored.preferences,
        alerts: { ...defaultSettings.preferences.alerts, ...stored.preferences?.alerts },
      },
    };
  } catch { return defaultSettings; }
}

export function saveSettings(settings: NeqtaSettings) {
  const normalized: NeqtaSettings = {
    ...settings,
    company: { ...settings.company, name: normalizeShortText(settings.company.name), segment: normalizeShortText(settings.company.segment), cnpj: normalizeCNPJ(settings.company.cnpj), taxRegime: normalizeShortText(settings.company.taxRegime), operatingDays: sanitizeInteger(settings.company.operatingDays, 1, 31) },
    financial: { ...settings.financial, targetMargin: sanitizePercent(settings.financial.targetMargin), minimumMargin: sanitizePercent(settings.financial.minimumMargin), estimatedMonthlyRevenue: Math.max(0, normalizeStoredNumber(settings.financial.estimatedMonthlyRevenue)), salesTax: sanitizePercent(settings.financial.salesTax) },
    channels: settings.channels.map(channel => ({ ...channel, name: normalizeShortText(channel.name), percentageFee: sanitizePercent(channel.percentageFee), fixedFee: Math.max(0, normalizeStoredNumber(channel.fixedFee)) })),
    payments: settings.payments.map(payment => ({ ...payment, name: normalizeShortText(payment.name), percentageFee: sanitizePercent(payment.percentageFee), fixedFee: Math.max(0, normalizeStoredNumber(payment.fixedFee)), anticipationFee: sanitizePercent(payment.anticipationFee) })),
  };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent('neqta-settings-updated', { detail: normalized }));
}
