// EU VIES VAT check helpers (spec §16.4). Pure, unit-tested.
const EU = new Set(["AT","BE","BG","CY","CZ","DE","DK","EE","EL","ES","FI","FR","HR","HU","IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK","XI"]);

/** Split a VAT code into VIES country + number. "LT100001919017", "PL 123-456-32-18" or a bare number with the company country. */
export function parseVat(vatCode: string | null | undefined, country = "LT"): { cc: string; number: string } | null {
  if (!vatCode) return null;
  let s = vatCode.toUpperCase().replace(/[\s.\-]/g, "");
  let cc = (country || "LT").toUpperCase();
  if (cc === "GR") cc = "EL";
  const pre = s.slice(0, 2);
  if (/^[A-Z]{2}$/.test(pre)) { cc = pre === "GR" ? "EL" : pre; s = s.slice(2); }
  if (!EU.has(cc) || !/^[0-9A-Z]{2,14}$/.test(s)) return null;
  return { cc, number: s };
}

export const viesUrl = (cc: string, number: string) =>
  `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${cc}/vat/${encodeURIComponent(number)}`;
