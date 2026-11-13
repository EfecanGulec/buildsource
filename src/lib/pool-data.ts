import { supabase } from "@/integrations/supabase/client";

export const POOL_COLS = "id,product_name,unit,base_price,tiers,deadline,status,region,images,category_id,min_qty,product_specs,certificates,delivery_week,closed_qty,final_unit_price,final_discount_pct,confirm_until,keep_tier_threshold,supplier_company_id,companies(name)";

export async function withTotals<T extends { id: string }>(rows: T[]) {
  const totals = await Promise.all(rows.map((r) => supabase.rpc("pool_totals", { _pool: r.id })));
  return rows.map((r, i) => {
    const x = totals[i].data?.[0];
    return { ...r, totals: { total_qty: Number(x?.total_qty ?? 0), members: Number(x?.members ?? 0), confirmed_qty: Number(x?.confirmed_qty ?? 0) } };
  });
}
