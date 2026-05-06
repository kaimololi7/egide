/**
 * PII scrubber (cf. ADR 014 §LLM02).
 *
 * Replaces likely-PII patterns with placeholders before sending text
 * to cloud LLM providers. Designed to be conservative (false positives
 * over false negatives).
 *
 * Reverse-mapping (placeholder → original) is the caller's
 * responsibility if needed for downstream re-injection.
 *
 * Status: scaffold. Production patterns expand at M2 with eval coverage.
 */

const PATTERNS: Array<{ name: string; regex: RegExp; placeholder: string }> = [
  // Emails
  {
    name: "email",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    placeholder: "<EMAIL_REDACTED>",
  },
  // IPv4 addresses
  {
    name: "ipv4",
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    placeholder: "<IPV4_REDACTED>",
  },
  // IPv6 (simplified, may produce false positives)
  {
    name: "ipv6",
    regex: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    placeholder: "<IPV6_REDACTED>",
  },
  // AWS access key IDs
  {
    name: "aws_access_key",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    placeholder: "<AWS_KEY_REDACTED>",
  },
  // Generic API key patterns (sk-..., pk-..., etc.)
  {
    name: "api_key_secret",
    regex: /\b(?:sk|pk|key|token|secret)[-_][A-Za-z0-9]{16,}\b/gi,
    placeholder: "<API_KEY_REDACTED>",
  },
  // GitHub tokens
  {
    name: "github_token",
    regex: /\bghp_[A-Za-z0-9]{36}\b/g,
    placeholder: "<GITHUB_TOKEN_REDACTED>",
  },
  // JWT (header.payload.signature)
  {
    name: "jwt",
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    placeholder: "<JWT_REDACTED>",
  },
  // French phone numbers (rough)
  {
    name: "phone_fr",
    regex: /\b(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}\b/g,
    placeholder: "<PHONE_REDACTED>",
  },
];

export function scrubPII(text: string): string {
  let result = text;
  for (const { regex, placeholder } of PATTERNS) {
    result = result.replace(regex, placeholder);
  }
  return result;
}

/**
 * Returns a list of redactions performed (for audit/debugging).
 * Useful in tests and adversarial eval.
 */
export function detectPII(
  text: string,
): Array<{ kind: string; value: string; index: number }> {
  const found: Array<{ kind: string; value: string; index: number }> = [];
  for (const { name, regex } of PATTERNS) {
    // Reset lastIndex on global regexes.
    const re = new RegExp(regex.source, regex.flags);
    let match = re.exec(text);
    while (match !== null) {
      found.push({ kind: name, value: match[0], index: match.index });
      match = re.exec(text);
    }
  }
  return found;
}
