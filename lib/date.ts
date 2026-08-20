export function todayISO(reference = new Date()) {
  const year = reference.getFullYear();
  const month = String(reference.getMonth() + 1).padStart(2, '0');
  const day = String(reference.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysAgo(days: number, reference = new Date()) {
  const date = new Date(reference);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}
