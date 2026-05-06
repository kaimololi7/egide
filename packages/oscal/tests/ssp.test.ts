import { describe, expect, it } from "vitest";
import { serializePyramidToSSP } from "../src/ssp.js";

describe("serializePyramidToSSP", () => {
  const baseInput = {
    pyramidId: "11111111-1111-4111-8111-111111111111",
    pyramidTitle: "ISO 27001 — A.5 series",
    versionId: "22222222-2222-4222-8222-222222222222",
    versionLabel: "v2",
    contentHash: "deadbeef",
    tenantId: "33333333-3333-4333-8333-333333333333",
    generatedAt: "2026-05-06T10:00:00.000Z",
  };

  it("emits a minimal valid SSP shape", () => {
    const ssp = serializePyramidToSSP({
      ...baseInput,
      snapshot: {
        framework: "ISO27001:2022",
        anchors: [
          { id: "iso27001:A.5.1", title: "Information security policies" },
        ],
        policies: [
          {
            id: "p1",
            title: "Information Security Policy",
            description: "Top-level policy.",
            anchor_ids: ["iso27001:A.5.1"],
          },
        ],
      },
    });

    const root = ssp["system-security-plan"];
    expect(root.metadata["oscal-version"]).toBe("1.1.2");
    expect(root.metadata.version).toBe("v2");
    expect(root["import-profile"].href).toBe("urn:egide:profile:iso27001:2022");
    expect(root["system-implementation"].components).toHaveLength(1);
    expect(root["control-implementation"]["implemented-requirements"]).toHaveLength(1);
    const req = root["control-implementation"]["implemented-requirements"][0];
    expect(req?.["control-id"]).toBe("a.5.1");
    expect(req?.["by-components"]).toHaveLength(1);
  });

  it("is deterministic for the same input", () => {
    const a = serializePyramidToSSP({
      ...baseInput,
      snapshot: { framework: "ISO27001:2022", anchors: [], policies: [] },
    });
    const b = serializePyramidToSSP({
      ...baseInput,
      snapshot: { framework: "ISO27001:2022", anchors: [], policies: [] },
    });
    expect(a).toEqual(b);
    expect(a["system-security-plan"].uuid).toBe(b["system-security-plan"].uuid);
  });

  it("emits placeholder component when pyramid has no policies", () => {
    const ssp = serializePyramidToSSP({
      ...baseInput,
      snapshot: { framework: "ISO27001:2022", anchors: [], policies: [] },
    });
    expect(ssp["system-security-plan"]["system-implementation"].components).toHaveLength(1);
    expect(
      ssp["system-security-plan"]["system-implementation"].components[0]?.status.state,
    ).toBe("other");
  });
});
