import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { deliveryDetailsSchema, emptyDeliveryDetails, type DeliveryDetails } from "@/lib/delivery-details";
import type { TKey } from "@/lib/translations";

export function DeliveryAcceptance({ rfqId, quoteId, agreementId, onSaved, variant = "default", className }: {
  rfqId: string; quoteId?: string; agreementId?: string; onSaved?: () => void;
  variant?: "default" | "secondary" | "outline"; className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["delivery-prefill", rfqId], enabled: open,
    queryFn: async () => {
      const [{ data: r, error }, { data: c, error: ce }] = await Promise.all([
        supabase.from("rfqs").select("delivery_city,delivery_address,delivery_date_requested,unloading,delivery_window,site_access_notes").eq("id", rfqId).single(),
        supabase.from("rfq_site_contacts").select("name,phone").eq("rfq_id", rfqId).maybeSingle(),
      ]);
      if (error || ce) throw error ?? ce;
      return { ...emptyDeliveryDetails, city: r.delivery_city ?? "", address: r.delivery_address ?? "", date: r.delivery_date_requested ?? "", contact: c?.name ?? "", phone: c?.phone ?? "", unloading: r.unloading ?? "manual", window: r.delivery_window ?? "any", access: r.site_access_notes ?? "" };
    },
  });
  return <>
    <Button variant={variant} className={className} onClick={() => setOpen(true)}>{t(agreementId ? "delivery.add" : "compare.accept")}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-xl">
        <DialogHeader><DialogTitle>{t("delivery.title")}</DialogTitle><DialogDescription>{t("delivery.summary")}</DialogDescription></DialogHeader>
        {q.isPending ? <p className="text-muted-foreground">…</p> : q.isError ? <div role="alert"><p>{t("delivery.loadError")}</p><Button variant="outline" onClick={() => q.refetch()}>{t("delivery.retry")}</Button></div> : <DeliveryForm initial={q.data} quoteId={quoteId} agreementId={agreementId} onCancel={() => setOpen(false)} onSaved={() => { setOpen(false); onSaved?.(); }} />}
      </DialogContent>
    </Dialog>
  </>;
}

function DeliveryForm({ initial, quoteId, agreementId, onCancel, onSaved }: {
  initial: Record<string, string>; quoteId?: string; agreementId?: string; onCancel: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = deliveryDetailsSchema.safeParse(values);
    if (!parsed.success) { setError(t("delivery.required")); return; }
    setSaving(true); setError("");
    try {
      if (agreementId) {
        const { error } = await supabase.rpc("buyer_save_agreement_delivery", { _agreement: agreementId, _details: parsed.data });
        if (error) throw error;
      } else if (quoteId) {
        const { data, error } = await supabase.rpc("buyer_accept_quote_with_delivery", { _quote: quoteId, _details: parsed.data });
        if (error) throw error;
        onSaved();
        await navigate({ to: "/app/agreements/$agreementId", params: { agreementId: data } });
      }
      qc.invalidateQueries({ queryKey: ["rfqs"] });
      qc.invalidateQueries({ queryKey: ["agreement"] });
      qc.invalidateQueries({ queryKey: ["compare"] });
      if (agreementId) { toast.success(t("delivery.saved")); onSaved(); }
    } catch { setError(t("delivery.saveError")); }
    finally { setSaving(false); }
  }
  const fields: { key: string; label: TKey; type?: string }[] = [
    { key: "city", label: "rfq.city" }, { key: "address", label: "rfq.address" }, { key: "date", label: "rfq.date", type: "date" },
    { key: "contact", label: "rfq.siteContact" }, { key: "phone", label: "delivery.phone", type: "tel" },
  ];
  return <form onSubmit={submit} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => <div key={f.key} className={f.key === "address" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
        <Label htmlFor={`${id}-${f.key}`}>{t(f.label)} *</Label>
        <Input id={`${id}-${f.key}`} type={f.type ?? "text"} required value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
      </div>)}
      {([{ key: "unloading", label: "rfq.unloading", options: ["manual", "crane_needed", "forklift_on_site"], prefix: "unl" }, { key: "window", label: "rfq.window", options: ["any", "morning", "afternoon"], prefix: "win" }] as const).map((f) => <div key={f.key} className="space-y-1.5">
        <Label htmlFor={`${id}-${f.key}`}>{t(f.label)}</Label>
        <Select value={values[f.key]} onValueChange={(v) => set(f.key, v)}><SelectTrigger id={`${id}-${f.key}`}><SelectValue /></SelectTrigger><SelectContent>{f.options.map((v) => <SelectItem key={v} value={v}>{t(`${f.prefix}.${v}` as TKey)}</SelectItem>)}</SelectContent></Select>
      </div>)}
    </div>
    <div className="space-y-1.5"><Label htmlFor={`${id}-access`}>{t("rfq.access")}</Label><Textarea id={`${id}-access`} rows={3} maxLength={2000} value={values["access"]} onChange={(e) => set("access", e.target.value)} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>{t("quote.cancel")}</Button><Button type="submit" disabled={saving}>{t(saving ? "delivery.saving" : agreementId ? "delivery.save" : "delivery.confirm")}</Button></div>
  </form>;
}

export function DeliverySummary({ details }: { details: DeliveryDetails }) {
  const { t } = useI18n();
  return <section className="space-y-2 text-sm">
    <h2 className="font-semibold">{t("delivery.title")}</h2>
    <p>{t("rfq.address")}: {details.city}, {details.address}</p>
    <p>{t("rfq.date")}: {details.date} · {t(`win.${details.window}`)}</p>
    <p>{t("rfq.unloading")}: {t(`unl.${details.unloading}`)}</p>
    {details.access && <p>{t("rfq.access")}: {details.access}</p>}
    <p>{t("rfq.siteContact")}: {details.contact} · {details.phone}</p>
  </section>;
}