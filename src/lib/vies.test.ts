import { describe, expect, it } from "vitest";
import { parseVat } from "./vies";
describe("parseVat", () => {
  it("reads a prefixed Lithuanian code", () => expect(parseVat("LT100001919017")).toEqual({ cc: "LT", number: "100001919017" }));
  it("uses the company country for a bare number", () => expect(parseVat("123-456-32-18", "PL")).toEqual({ cc: "PL", number: "1234563218" }));
  it("maps Greece to EL", () => expect(parseVat("GR123456789")?.cc).toBe("EL"));
  it("rejects non-EU and empty codes", () => { expect(parseVat("US123456")).toBeNull(); expect(parseVat("")).toBeNull(); });
});
