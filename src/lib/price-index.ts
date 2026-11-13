// Price Index (spec 7.9): the database view only returns months with 5+ accepted quote lines.
export const MIN_SAMPLES = 5;
export type IndexRow = { category_id: string | null; region: string | null; month: string | null; avg_unit_price: number | null; sample_count: number | null };

/** Groups rows into one chart series per category + region, sorted by month; drops anything under 5 samples. */
export function buildSeries(rows: IndexRow[]) {
  const map = new Map<string, { category_id: string; region: string; points: { month: string; avg: number; n: number }[] }>();
  for (const r of rows) {
    if (!r.category_id || !r.region || !r.month || r.avg_unit_price == null || (r.sample_count ?? 0) < MIN_SAMPLES) continue;
    const key = `${r.category_id}|${r.region}`;
    const s = map.get(key) ?? { category_id: r.category_id, region: r.region, points: [] };
    s.points.push({ month: r.month.slice(0, 7), avg: Number(r.avg_unit_price), n: Number(r.sample_count) });
    map.set(key, s);
  }
  for (const s of map.values()) s.points.sort((a, b) => a.month.localeCompare(b.month));
  return [...map.values()];
}
