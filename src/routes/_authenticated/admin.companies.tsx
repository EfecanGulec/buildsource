import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { checkCompanyVat, setCompanyContactEmail } from "@/lib/company-data.functions";

export const Route = createFileRoute("/_authenticated/admin/companies")({
  head: () => ({ meta: [{ title: "Companies & data — BuildSource LT" }, { name: "description", content: "Company register data, VAT checks and contact emails." }] }),
  component: Companies,
});

type Row = { id: string; name: string; type: string; city: string | null; country: string | null; company_code: string | null; vat_code: string | null; contact_email: string | null; is_claimed: boolean | null;
  company_public_data: { status: string; vat_valid: boolean; employees: number | null; tax_debt: boolean; sodra_debt: boolean; data_date: string | null } | null };

function Companies() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies")
        .select("id,name,type,city,country,company_code,vat_code,contact_email,is_claimed,company_public_data(status,vat_valid,employees,tax_debt,sodra_debt,data_date)").order("type").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-3"><Building2 className="h-6 w-6 text-primary" /><h1 className="font-display text-2xl font-semibold">{t("nav.companies")}</h1></div>
      <p className="text-muted-foreground">{t("cd.intro")}</p>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b"><tr>
            <th className="p-3">{t("trust.company")}</th><th>{t("cd.code")}</th><th>{t("cd.public")}</th><th>{t("cd.vat")}</th><th className="pr-3">{t("cd.contact")}</th>
          </tr></thead>
          <tbody>{(q.data ?? []).map((c) => <CompanyRow key={c.id} c={c} />)}</tbody>
        </table>
        {q.isLoading && <p className="p-4 text-muted-foreground">…</p>}
      </div>
    </div>
  );
}

function CompanyRow({ c }: { c: Row }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const pd = Array.isArray(c.company_public_data) ? c.company_public_data[0] : c.company_public_data;
  const [email, setEmail] = useState(c.contact_email ?? "");
  const vat = useMutation({
    mutationFn: () => checkCompanyVat({ data: { companyId: c.id } }),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.message);
      else toast[r.valid ? "success" : "warning"](`${r.valid ? t("cd.vatValid") : t("cd.vatInvalid")}${r.name ? ` — ${r.name}` : ""}`);
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  const save = useMutation({
    mutationFn: () => setCompanyContactEmail({ data: { companyId: c.id, email } }),
    onSuccess: () => { toast.success(t("cd.saved")); qc.invalidateQueries({ queryKey: ["admin-companies"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  return (
    <tr className="border-b last:border-0 align-top">
      <td className="p-3"><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.type} · {c.city ?? "—"}, {c.country ?? "LT"}</div></td>
      <td className="py-3 text-xs"><div>{c.company_code ?? "—"}</div><div className="text-muted-foreground">{c.vat_code ?? "—"}</div></td>
      <td className="py-3 text-xs space-y-1">
        {pd ? <>
          <div className="flex flex-wrap gap-1">
            <Badge variant={pd.status === "active" ? "secondary" : "destructive"}>{pd.status}</Badge>
            {pd.tax_debt && <Badge variant="destructive">{t("cd.taxDebt")}</Badge>}
            {pd.sodra_debt && <Badge variant="destructive">{t("cd.sodraDebt")}</Badge>}
          </div>
          <div className="text-muted-foreground">{pd.employees ?? "—"} {t("cd.employees")} · {t("cd.dataDate")} {pd.data_date ?? "—"}</div>
        </> : <span className="text-muted-foreground">{t("cd.none")}</span>}
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          {pd && <Badge variant={pd.vat_valid ? "secondary" : "destructive"}>{pd.vat_valid ? t("cd.vatValid") : t("cd.vatInvalid")}</Badge>}
          <Button size="sm" variant="outline" disabled={!c.vat_code || vat.isPending} onClick={() => vat.mutate()} aria-label={`${t("cd.checkVat")} ${c.name}`}>
            {vat.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <BadgeCheck className="h-3 w-3" />}<span className="ml-1">{t("cd.checkVat")}</span>
          </Button>
        </div>
      </td>
      <td className="py-3 pr-3">
        {c.type === "supplier" && !c.is_claimed ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sales@company.lt" className="h-8 w-48" />
            <Button size="sm" type="submit" disabled={save.isPending || email === (c.contact_email ?? "")}>{t("cd.save")}</Button>
          </form>
        ) : <span className="text-xs text-muted-foreground">{t("cd.hasAccount")}</span>}
      </td>
    </tr>
  );
}
