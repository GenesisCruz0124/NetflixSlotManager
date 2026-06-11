export function formatCurrency(amount: number): string {
  return `₱${amount.toFixed(2)}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function clampToMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

/** The next occurrence of `billingDay` (1-31) on or after today, clamped to the month length. */
export function nextBillingDate(billingDay: number): Date {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let target = clampToMonth(now.getFullYear(), now.getMonth(), billingDay);
  if (target.getTime() < todayStart.getTime()) {
    const nextMonth = now.getMonth() + 1;
    const year = now.getFullYear() + (nextMonth > 11 ? 1 : 0);
    target = clampToMonth(year, nextMonth % 12, billingDay);
  }
  return target;
}

/** ISO (YYYY-MM-DD) date string of the next occurrence of `billingDay`. */
export function nextBillingDateIso(billingDay: number): string {
  const d = nextBillingDate(billingDay);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Days until the next occurrence of `billingDay` (1-31) from today, clamped to the month length. */
export function daysUntilNextBilling(billingDay: number): number {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = nextBillingDate(billingDay);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - todayStart.getTime()) / msPerDay);
}
