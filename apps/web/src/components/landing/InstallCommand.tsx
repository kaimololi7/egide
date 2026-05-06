/**
 * InstallCommand — single-line install snippet with copy-to-clipboard
 * + cosign-verified badge. ADR 017 compliant: tokens only, no shadow,
 * radius ≤ 8px, motion ≤ 200ms.
 */
"use client";

import { Check, Copy, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";
import styles from "./InstallCommand.module.css";

const COMMAND = "curl -fsSL https://egide.io/install.sh | sh";

export function InstallCommand() {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may be blocked (insecure context, denied permission).
      // Silent fail is acceptable: the command is selectable as plain text.
    }
  }, []);

  return (
    <div className={styles.row}>
      <code className={styles.code} aria-label="Install one-liner">
        <span className={styles.dollar} aria-hidden="true">$ </span>
        {COMMAND}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className={styles.copy}
        aria-label={copied ? "Copied" : "Copy install command"}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span>{copied ? "copied" : "copy"}</span>
      </button>
      <span className={styles.badge} title="Image and binary signed with cosign / Sigstore">
        <ShieldCheck size={12} aria-hidden="true" />
        cosign verified
      </span>
    </div>
  );
}
