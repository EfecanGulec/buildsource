import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FieldDef } from "@/lib/rfq";

type Specs = Record<string, string | number | boolean>;

/** Renders the extra RFQ fields defined by a category's field_template. */
export function SpecFields({ template, value, onChange }: { template: FieldDef[]; value: Specs; onChange: (v: Specs) => void }) {
  if (!template.length) return null;
  const set = (k: string, v: string | number | boolean) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {template.map((f) => (
        <label key={f.key} className="space-y-1 text-sm">
          <span className="text-muted-foreground">{f.label}</span>
          {f.type === "select" ? (
            <Select value={String(value[f.key] ?? "")} onValueChange={(v) => set(f.key, v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{f.options?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          ) : f.type === "bool" ? (
            <div className="flex h-10 items-center"><Checkbox checked={!!value[f.key]} onCheckedChange={(c) => set(f.key, !!c)} /></div>
          ) : (
            <Input type={f.type === "number" ? "number" : "text"} placeholder={f.placeholder}
              value={String(value[f.key] ?? "")}
              onChange={(e) => set(f.key, f.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value)} />
          )}
        </label>
      ))}
    </div>
  );
}

export function specsSummary(specs: unknown): string {
  if (!specs || typeof specs !== "object") return "";
  return Object.entries(specs as Specs).filter(([, v]) => v !== "" && v !== false)
    .map(([k, v]) => (v === true ? k.replace(/_/g, " ") : `${k.replace(/_/g, " ")}: ${v}`)).join(" · ");
}
