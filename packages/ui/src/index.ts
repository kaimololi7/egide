/**
 * @egide/ui — design tokens and signature components.
 *
 * Tokens shipped as CSS at @egide/ui/styles/tokens.css and base.css.
 * Signature components (cf. docs/design-system.md) land progressively.
 */

export const TOKENS_VERSION = "0.0.2";

export {
  TraceBreadcrumb,
  type TraceBreadcrumbProps,
  type TraceLevel,
  type TraceStep,
} from "./components/TraceBreadcrumb.js";

export type FrameworkId =
  | "iso27001-2022"
  | "iso9001-2026"
  | "nis2"
  | "dora"
  | "cis"
  | "hds";

export type AnchorStatus = "covered" | "partial" | "gap" | "out_of_scope" | "unknown";

export type CascadeNodeKind =
  | "directive"
  | "policy"
  | "procedure"
  | "bpmn"
  | "kpi"
  | "evidence"
  | "intent";
