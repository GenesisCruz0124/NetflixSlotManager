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

/** Days until the next occurrence of `billingDay` (1-31) from today, clamped to the month length. */
export function daysUntilNextBilling(billingDay: number): number {
  const now = new Date();
  const clampDay = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return Math.min(billingDay, lastDay);
  };

  let target = new Date(now.getFullYear(), now.getMonth(), clampDay(now.getFullYear(), now.getMonth()));
  target.setHours(0, 0, 0, 0);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (target.getTime() < todayStart.getTime()) {
    const nextMonth = now.getMonth() + 1;
    const year = now.getFullYear() + (nextMonth > 11 ? 1 : 0);
    const month = nextMonth % 12;
    target = new Date(year, month, clampDay(year, month));
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - todayStart.getTime()) / msPerDay);
}
