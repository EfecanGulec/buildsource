import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QueryState } from "@/components/query-state";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, type Lang } from "@/lib/i18n";
import { emptyDeliveryDetails, type DeliveryDetails } from "@/lib/delivery-details";
import type { TKey } from "@/lib/translations";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Profile & settings — BuildSource LT" }, { name: "description", content: "Update your personal details, company details and default delivery address." }] }),
  component: Settings,
});

type Me = { full_name: string | null; phone: string | null; email: string | null; language: string; default_delivery: Partial<DeliveryDetails> | null;
  company: { name: string; company_code: string; vat_code: string | null; city: string | null; country: string; address: string | null; buyer_segment: string | null } | null };

function Settings() {
  const { t, setLang } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-profile"], queryFn: async () => {
    const { data, error } = await supabase.rpc("my_profile");
    if (error) throw error;
    return data as unknown as Me;
  } });
  const [p, setP] = useState({ full_name: "", phone: "", language: "en", address: "", vat_code: "" });
  const [c, setC] = useState({ name: "", company_code: "", city: "", country: "LT", buyer_segment: "" });
  const [d, setD] = useState<DeliveryDetails>(emptyDeliveryDetails);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const m = q.data; if (!m) return;
    setP({ full_name: m.full_name ?? "", phone: m.phone ?? "", language: m.language ?? "en", address: m.company?.address ?? "", vat_code: m.company?.vat_code ?? "" });
    setC({ name: m.company?.name ?? "", company_code: m.company?.company_code ?? "", city: m.company?.city ?? "", country: m.company?.country ?? "LT", buyer_segment: m.company?.buyer_segment ?? "" });
    setD({ ...emptyDeliveryDetails, ...(m.default_delivery ?? {}) });
  }, [q.data]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("set.saved")); qc.invalidateQueries({ queryKey: ["my-profile"] });
  }
  const saveProfile = () => run(async () => {
    const r = await supabase.rpc("save_my_profile", { _full_name: p.full_name, _phone: p.phone, _language: p.language, _address: p.address, _vat_code: p.vat_code });
    if (!r.error) setLang(p.language as Lang);
    return r;
  });
  const saveCompany = () => run(() => supabase.rpc("save_my_company", { _name: c.name, _company_code: c.company_code, _city: c.city, _country: c.country, _buyer_segment: (c.buyer_segment || null) as never }));
  const saveDelivery = () => run(() => supabase.rpc("save_my_default_delivery", { _details: d }));

  if (q.isPending || q.isError) return <QueryState isLoading={q.isPending} error={q.error} onRetry={() => q.refetch()} />;
  const field = (label: TKey, value: string, on: (v: string) => void, opts: { id: string; type?: string; disabled?: boolean; wide?: boolean }) => (
    <div className={opts.wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}><Label htmlFor={opts.id}>{t(label)}</Label>
      <Input id={opts.id} type={opts.type ?? "text"} value={value} disabled={opts.disabled} onChange={(e) => on(e.target.value)} /></div>);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-2xl font-semibold">{t("set.title")}</h1>
      <Card><CardHeader><CardTitle>{t("set.personal")}</CardTitle></CardHeader>
        <CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
          {field("set.fullName", p.full_name, (v) => setP({ ...p, full_name: v }), { id: "fn" })}
          {field("set.email", q.data.email ?? "", () => {}, { id: "em", disabled: true })}
          {field("set.phone", p.phone, (v) => setP({ ...p, phone: v }), { id: "ph", type: "tel" })}
          <div className="space-y-1.5"><Label htmlFor="lg">{t("set.language")}</Label>
            <Select value={p.language} onValueChange={(v) => setP({ ...p, language: v })}><SelectTrigger id="lg"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="lt">Lietuvių</SelectItem></SelectContent></Select></div>
          {field("set.billingAddress", p.address, (v) => setP({ ...p, address: v }), { id: "ba", wide: true })}
          {field("inv.vat", p.vat_code, (v) => setP({ ...p, vat_code: v }), { id: "vat" })}
        </div><Button onClick={saveProfile} disabled={busy}>{t("cd.save")}</Button></CardContent></Card>

      <Card><CardHeader><CardTitle>{t("set.company")}</CardTitle></CardHeader>
        <CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
          {field("set.companyName", c.name, (v) => setC({ ...c, name: v }), { id: "cn" })}
          {field("inv.companyCode", c.company_code, (v) => setC({ ...c, company_code: v }), { id: "cc" })}
          {field("rfq.city", c.city, (v) => setC({ ...c, city: v }), { id: "ci" })}
          {field("set.country", c.country, (v) => setC({ ...c, country: v.toUpperCase().slice(0, 2) }), { id: "co" })}
        </div><Button onClick={saveCompany} disabled={busy || !c.name || !c.company_code}>{t("cd.save")}</Button></CardContent></Card>

      <Card><CardHeader><CardTitle>{t("set.delivery")}</CardTitle><CardDescription>{t("set.deliveryHelp")}</CardDescription></CardHeader>
        <CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">
          {field("rfq.city", d.city, (v) => setD({ ...d, city: v }), { id: "dc" })}
          {field("rfq.address", d.address, (v) => setD({ ...d, address: v }), { id: "da" })}
          {field("rfq.siteContact", d.contact, (v) => setD({ ...d, contact: v }), { id: "dn" })}
          {field("delivery.phone", d.phone, (v) => setD({ ...d, phone: v }), { id: "dp", type: "tel" })}
          {([{ key: "unloading", label: "rfq.unloading", options: ["manual", "crane_needed", "forklift_on_site"], prefix: "unl" }, { key: "window", label: "rfq.window", options: ["any", "morning", "afternoon"], prefix: "win" }] as const).map((f) => (
            <div key={f.key} className="space-y-1.5"><Label htmlFor={`d-${f.key}`}>{t(f.label)}</Label>
              <Select value={d[f.key]} onValueChange={(v) => setD({ ...d, [f.key]: v } as DeliveryDetails)}><SelectTrigger id={`d-${f.key}`}><SelectValue /></SelectTrigger>
                <SelectContent>{f.options.map((v) => <SelectItem key={v} value={v}>{t(`${f.prefix}.${v}` as TKey)}</SelectItem>)}</SelectContent></Select></div>))}
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="dx">{t("rfq.access")}</Label><Textarea id="dx" rows={3} maxLength={2000} value={d.access} onChange={(e) => setD({ ...d, access: e.target.value })} /></div>
        </div><Button onClick={saveDelivery} disabled={busy}>{t("cd.save")}</Button></CardContent></Card>
    </div>
  );
}
