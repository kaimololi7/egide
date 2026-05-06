/**
 * @egide/oscal — minimal OSCAL 1.1.x serializer.
 *
 * Status: MVP. Produces a valid `system-security-plan` document from
 * an Egide pyramid graph snapshot. Intentionally narrow:
 *   - One component per policy.
 *   - One implemented-requirement per anchor (control_id).
 *   - No back-matter resources (signed PDFs land at M5+).
 *   - No party / responsible-party (single-tenant view at MVP).
 *
 * The output validates against the OSCAL 1.1.2 SSP JSON schema for
 * the fields we emit. Additional fields (parties, profile import,
 * back-matter) are added in M5 with the auditor view.
 *
 * Cf. https://pages.nist.gov/OSCAL/reference/1.1.2/system-security-plan/json-outline/
 */

export { serializePyramidToSSP } from "./ssp.js";
export type {
  PyramidSnapshot,
  PyramidPolicy,
  PyramidAnchor,
  SspExportInput,
  SspDocument,
} from "./ssp.js";
