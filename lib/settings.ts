import type { NeqtaSettings } from '@/types/settings';
import { normalizeCNPJ, normalizeShortText, normalizeStoredNumber, sanitizeInteger, sanitizePercent } from '@/lib/input';
import { loadStoreValue, saveStoreValue } from '@/services/store-records.service';
import type { SupabaseClient } from '@supabase/supabase-js';

let cachedSettings: NeqtaSettings | null = null;

export const defaultSettings: NeqtaSettings = {
  company: { name: '', segment: '', cnpj: '', taxRegime: '', operatingDays: 30 },
  financial: { targetMargin: 30, minimumMargin: 25, estimatedMonthlyRevenue: 0, salesTax: 0 },
  channels: [
    { id: 'store', name: 'Loja / Balcão', type: 'Loja física', percentageFee: 0, fixedFee: 0, processesPayment: false, active: true },
  ],
  payments: [
    { id: 'pix', name: 'PIX', percentageFee: 0, fixedFee: 0, anticipationFee: 0, active: true },
    { id: 'cash', name: 'Dinheiro', percentageFee: 0, fixedFee: 0, anticipationFee: 0, active: true },
  ],
  preferences: {
    theme: 'dark', rounding: 'x90', massUnit: 'kg', volumeUnit: 'L', itemUnit: 'un',
    alerts: { costIncrease: true, belowMinimumMargin: true, safePromotion: true },
  },
};

function isLegacyChannelPreset(rows: NeqtaSettings['channels'] | undefined) {
  const expected = { store: 0, whatsapp: 0, delivery: 0, ifood: 23, '99': 14 } as Record<string, number>;
  return rows?.length === 5
    && rows.every((row) => expected[row.id] === row.percentageFee && row.fixedFee === 0);
}

function isLegacyPaymentPreset(rows: NeqtaSettings['payments'] | undefined) {
  const expected = { pix: 0, cash: 0, debit: 1.49, credit: 3.49, online: 4.29 } as Record<string, number>;
  return rows?.length === 5
    && rows.every((row) => expected[row.id] === row.percentageFee && row.fixedFee === 0 && row.anticipationFee === 0);
}

export async function loadSettingsFromSupabase(client?: SupabaseClient): Promise<NeqtaSettings> {
  try {
    const stored = await loadStoreValue<Partial<NeqtaSettings>>('settings', defaultSettings, client);
    const company = { ...defaultSettings.company, ...stored.company };
    const financial = { ...defaultSettings.financial, ...stored.financial };
    cachedSettings = {
      ...defaultSettings,
      ...stored,
      company: { ...company, cnpj: normalizeCNPJ(company.cnpj), operatingDays: sanitizeInteger(company.operatingDays, 1, 31) },
      financial: { ...financial, targetMargin: sanitizePercent(financial.targetMargin), minimumMargin: sanitizePercent(financial.minimumMargin), estimatedMonthlyRevenue: normalizeStoredNumber(financial.estimatedMonthlyRevenue), salesTax: sanitizePercent(financial.salesTax) },
      channels: (isLegacyChannelPreset(stored.channels) ? defaultSettings.channels : stored.channels?.length ? stored.channels : defaultSettings.channels).map(channel => ({ ...channel, percentageFee: sanitizePercent(channel.percentageFee), fixedFee: normalizeStoredNumber(channel.fixedFee) })),
      payments: (isLegacyPaymentPreset(stored.payments) ? defaultSettings.payments : stored.payments?.length ? stored.payments : defaultSettings.payments).map(payment => ({ ...payment, percentageFee: sanitizePercent(payment.percentageFee), fixedFee: normalizeStoredNumber(payment.fixedFee), anticipationFee: sanitizePercent(payment.anticipationFee) })),
      preferences: {
        ...defaultSettings.preferences,
        ...stored.preferences,
        alerts: { ...defaultSettings.preferences.alerts, ...stored.preferences?.alerts },
      },
    };
    return cachedSettings;
  } catch { return cachedSettings ?? defaultSettings; }
}

export async function saveSettings(settings: NeqtaSettings) {
  const normalized: NeqtaSettings = {
    ...settings,
    company: { ...settings.company, name: normalizeShortText(settings.company.name), segment: normalizeShortText(settings.company.segment), cnpj: normalizeCNPJ(settings.company.cnpj), taxRegime: normalizeShortText(settings.company.taxRegime), operatingDays: sanitizeInteger(settings.company.operatingDays, 1, 31) },
    financial: { ...settings.financial, targetMargin: sanitizePercent(settings.financial.targetMargin), minimumMargin: sanitizePercent(settings.financial.minimumMargin), estimatedMonthlyRevenue: Math.max(0, normalizeStoredNumber(settings.financial.estimatedMonthlyRevenue)), salesTax: sanitizePercent(settings.financial.salesTax) },
    channels: settings.channels.map(channel => ({ ...channel, name: normalizeShortText(channel.name), percentageFee: sanitizePercent(channel.percentageFee), fixedFee: Math.max(0, normalizeStoredNumber(channel.fixedFee)) })),
    payments: settings.payments.map(payment => ({ ...payment, name: normalizeShortText(payment.name), percentageFee: sanitizePercent(payment.percentageFee), fixedFee: Math.max(0, normalizeStoredNumber(payment.fixedFee)), anticipationFee: sanitizePercent(payment.anticipationFee) })),
  };
  cachedSettings = normalized;
  await saveStoreValue('settings', normalized);
  window.dispatchEvent(new CustomEvent('neqta-settings-updated', { detail: normalized }));
}
