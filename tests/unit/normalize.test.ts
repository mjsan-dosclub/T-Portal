import { describe, expect, it } from "vitest";
import { cleanText, csvSafe, nameKey, normalizeEmail, parseDateInput, toCsv } from "@/lib/normalize";

describe("normalisation helpers", () => {
  it("cleanText trims and collapses whitespace including non-breaking spaces", () => {
    expect(cleanText("  a    b\t\nc ")).toBe("a b c");
  });
  it("nameKey is case-insensitive and Unicode-normalised", () => {
    expect(nameKey("  Computer   SCIENCE ")).toBe("computer science");
    expect(nameKey("அருண்")).toBe(nameKey("அருண்".normalize("NFD")));
  });
  it("normalizeEmail lower-cases and trims", () => {
    expect(normalizeEmail("  A.B@Example.TEST ")).toBe("a.b@example.test");
  });
  it("parseDateInput handles ISO, DD-MM-YYYY, serials and rejects impossible dates", () => {
    expect(parseDateInput("2005-03-15")).toEqual({ ok: true, iso: "2005-03-15" });
    expect(parseDateInput("15/03/2005")).toEqual({ ok: true, iso: "2005-03-15" });
    expect(parseDateInput("38426")).toEqual({ ok: true, iso: "2005-03-15" });
    expect(parseDateInput("31-02-2005")).toMatchObject({ ok: false });
    expect(parseDateInput("")).toBeNull();
  });
  it("csvSafe escapes formula prefixes = + - @ tab CR, and quotes commas", () => {
    expect(csvSafe("=1+1")).toBe("'=1+1");
    expect(csvSafe("+91 98")).toBe("'+91 98");
    expect(csvSafe("-5")).toBe("'-5");
    expect(csvSafe("@cmd")).toBe("'@cmd");
    expect(csvSafe("\tx")).toBe("'\tx");
    expect(csvSafe('a,"b"')).toBe('"a,""b"""');
    expect(toCsv(["h"], [["v"]]).startsWith("﻿h\r\nv")).toBe(true);
  });
});
