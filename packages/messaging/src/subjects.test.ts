import { describe, expect, it } from "vitest";
import { isEgideSubject, parseSubject, Subjects } from "./subjects.js";

describe("Subjects", () => {
  it("exposes versioned subject namespace", () => {
    const sample = Object.values(Subjects)[0];
    expect(typeof sample).toBe("string");
    expect(sample.startsWith("egide.v1.")).toBe(true);
  });

  it("validates Egide subject format", () => {
    expect(isEgideSubject("egide.v1.pyramid.created")).toBe(true);
    expect(isEgideSubject("not.an.egide.subject")).toBe(false);
  });

  it("parses subject components", () => {
    const parsed = parseSubject("egide.v1.pyramid.created");
    expect(parsed?.version).toBe("v1");
  });
});
