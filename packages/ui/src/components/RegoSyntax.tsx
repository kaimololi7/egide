/**
 * <RegoSyntax> — minimal Rego code block with line numbers + annotations.
 *
 * Cf. docs/design-system.md §RegoSyntax.
 *
 * Zero-dependency: this component does NOT do syntax highlighting itself
 * (Shiki is heavy and belongs to apps/web). It provides the structural
 * shell — line numbers, line gutters, annotation badges. Highlighting,
 * if any, must be performed by the caller and rendered as React children
 * on top of the plain `code` text (see naiveColorize for inline comments).
 *
 * No copy button by default (we want users to read, not paste).
 * No `dangerouslySetInnerHTML`: forbids any XSS surface (cf. ADR 014 §A03).
 */

import type { CSSProperties, ReactNode } from "react";

export interface CodeAnnotation {
	/** 1-indexed line number. */
	line: number;
	text: string;
	href?: string;
}

export interface RegoSyntaxProps {
	/** Plain Rego source. Each newline becomes a numbered line. */
	code: string;
	annotations?: CodeAnnotation[];
	/** Highlight a (start, end) inclusive range. */
	highlightRange?: [number, number];
	/** Caption shown above the code block. */
	caption?: ReactNode;
	className?: string;
}

const COMMENT_RE = /(#.*)$/;

function naiveColorize(line: string): ReactNode {
	// Very minimal: only colorize comments. Anything else stays default.
	const m = line.match(COMMENT_RE);
	if (!m) return line;
	const before = line.slice(0, m.index ?? 0);
	return (
		<>
			{before}
			<span
				style={{ color: "var(--egide-color-text-muted)", fontStyle: "italic" }}
			>
				{m[1]}
			</span>
		</>
	);
}

export function RegoSyntax({
	code,
	annotations = [],
	highlightRange,
	caption,
	className,
}: RegoSyntaxProps) {
	const lines = code.split("\n");
	const annoByLine = new Map<number, CodeAnnotation[]>();
	for (const a of annotations) {
		const list = annoByLine.get(a.line) ?? [];
		list.push(a);
		annoByLine.set(a.line, list);
	}

	const containerStyle: CSSProperties = {
		fontFamily: "var(--egide-font-mono)",
		fontSize: "var(--egide-text-sm)",
		background: "var(--egide-color-surface)",
		border: "1px solid var(--egide-color-border)",
		borderRadius: "var(--egide-radius)",
		overflow: "hidden",
		color: "var(--egide-color-text-primary)",
	};

	const captionStyle: CSSProperties = {
		padding: "var(--egide-space-2) var(--egide-space-3)",
		background: "var(--egide-color-surface-raised)",
		borderBottom: "1px solid var(--egide-color-border)",
		fontFamily: "var(--egide-font-ui)",
		fontSize: "var(--egide-text-xs)",
		color: "var(--egide-color-text-secondary)",
		textTransform: "uppercase",
		letterSpacing: "var(--egide-tracking-wide)",
	};

	return (
		<figure className={className} style={containerStyle}>
			{caption && <figcaption style={captionStyle}>{caption}</figcaption>}
			<pre
				style={{
					margin: 0,
					padding: "var(--egide-space-3) 0",
					overflowX: "auto",
				}}
			>
				{lines.map((line, i) => {
					const lineNum = i + 1;
					const inHighlight =
						!!highlightRange &&
						lineNum >= highlightRange[0] &&
						lineNum <= highlightRange[1];
					const annos = annoByLine.get(lineNum);
					return (
						<span
							key={`l-${lineNum}`}
							style={{
								display: "grid",
								gridTemplateColumns: "auto 1fr auto",
								gap: "var(--egide-space-3)",
								padding: "0 var(--egide-space-3)",
								background: inHighlight
									? "var(--egide-color-accent-muted)"
									: "transparent",
								borderLeft: inHighlight
									? "2px solid var(--egide-color-accent)"
									: "2px solid transparent",
								minHeight: "1.5em",
								lineHeight: 1.5,
								whiteSpace: "pre",
								alignItems: "baseline",
							}}
						>
							<span
								style={{
									color: "var(--egide-color-text-muted)",
									userSelect: "none",
									fontFeatureSettings: '"tnum"',
									minWidth: "2.5ch",
									textAlign: "right",
								}}
								aria-hidden
							>
								{lineNum}
							</span>
							<span>{naiveColorize(line)}</span>
							{annos && annos.length > 0 && (
								<span
									style={{
										display: "inline-flex",
										gap: "var(--egide-space-1)",
									}}
								>
									{annos.map((a) => {
										const badgeStyle: CSSProperties = {
											fontSize: "var(--egide-text-xs)",
											fontFamily: "var(--egide-font-ui)",
											padding: "1px 6px",
											borderRadius: "var(--egide-radius-sm)",
											border: "1px solid var(--egide-color-accent)",
											color: "var(--egide-color-accent)",
											background: "transparent",
											whiteSpace: "nowrap",
										};
										const annoKey = `anno-${lineNum}-${a.text}-${a.href ?? ""}`;
										return a.href ? (
											<a
												key={annoKey}
												href={a.href}
												style={{ ...badgeStyle, textDecoration: "none" }}
											>
												{a.text}
											</a>
										) : (
											<span key={annoKey} style={badgeStyle}>
												{a.text}
											</span>
										);
									})}
								</span>
							)}
						</span>
					);
				})}
			</pre>
		</figure>
	);
}
