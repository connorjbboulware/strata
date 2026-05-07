function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

const DASH = '—'; // em dash

export function pct(x: number | null | undefined, decimals = 2): string {
  if (!isFiniteNumber(x)) return DASH;
  return `${(x * 100).toFixed(decimals)}%`;
}

export function pctSigned(x: number | null | undefined, decimals = 2): string {
  if (!isFiniteNumber(x)) return DASH;
  const v = x * 100;
  if (Object.is(v, -0)) return '0.00%';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(decimals)}%`;
}

export function money(x: number | null | undefined): string {
  if (!isFiniteNumber(x)) return DASH;
  if (Math.abs(x) >= 1000) {
    return `$${Math.round(x).toLocaleString('en-US')}`;
  }
  return `$${x.toFixed(2)}`;
}

export function decimal(x: number | null | undefined, decimals = 2): string {
  if (!isFiniteNumber(x)) return DASH;
  return x.toFixed(decimals);
}

export function decimalSigned(x: number | null | undefined, decimals = 2): string {
  if (!isFiniteNumber(x)) return DASH;
  if (Object.is(x, -0)) return '0.00';
  const sign = x > 0 ? '+' : '';
  return `${sign}${x.toFixed(decimals)}`;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const y = parseInt(m[1]!, 10);
  const mo = parseInt(m[2]!, 10) - 1;
  const d = parseInt(m[3]!, 10);
  if (mo < 0 || mo > 11) return iso;
  return `${MONTHS[mo]} ${d}, ${y}`;
}

export function monthYearShort(iso: string | number | null | undefined): string {
  if (iso == null) return DASH;
  const date = typeof iso === 'number' ? new Date(iso) : new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return DASH;
  return `${MONTHS[date.getUTCMonth()]} '${String(date.getUTCFullYear()).slice(2)}`;
}
