export function digitsOnly(value: unknown, maxLength?: number) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return typeof maxLength === 'number' ? digits.slice(0, maxLength) : digits;
}

export function normalizeCNPJ(value: unknown) {
  return digitsOnly(value, 14);
}

export function formatCNPJ(value: unknown) {
  const digits = normalizeCNPJ(value);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function validateCNPJ(value: unknown) {
  const digits = normalizeCNPJ(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const calculate = (length: number) => {
    let factor = length - 7;
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * factor--;
      if (factor < 2) factor = 9;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13]);
}

export function sanitizeDecimal(value: unknown, decimals = 3, maximum?: number) {
  const raw = String(value ?? '').replace(/[^\d,.]/g, '').replace(',', '.');
  const [integer = '', fraction = ''] = raw.split('.');
  const normalized = `${integer.replace(/^0+(?=\d)/, '') || '0'}${fraction ? `.${fraction.slice(0, decimals)}` : ''}`;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return typeof maximum === 'number' ? Math.min(parsed, maximum) : parsed;
}

export function sanitizePercent(value: unknown) {
  return sanitizeDecimal(value, 2, 100);
}

export function sanitizeInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(digitsOnly(value));
  if (!Number.isFinite(parsed)) return minimum;
  return Math.min(Math.max(parsed, minimum), maximum);
}

export function normalizeShortText(value: unknown, maxLength = 80) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export function normalizeLongText(value: unknown, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export function normalizeStoredNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const cleaned = String(value ?? '').replace(/[^\d,.-]/g, '');
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}
