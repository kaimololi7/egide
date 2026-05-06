/**
 * TerminalReplay — animated terminal replay component (ADR 017 signature).
 *
 * Replays a sequence of (prompt, output) blocks at a fixed cadence
 * (~30ms/char) with a blinking caret. Plays once on mount, then exposes
 * a discrete "replay" button per ADR 017 ("no infinite/decorative
 * animation").
 *
 * prefers-reduced-motion: reduce → render the fully composed transcript
 * at once with no animation, no replay button.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./TerminalReplay.module.css";

export interface TerminalLine {
  /** "$" prompt commands ("input") vs program output lines. */
  kind: "prompt" | "output" | "ok";
  text: string;
}

export interface TerminalReplayProps {
  lines: TerminalLine[];
  /** ms per character. Default 30. */
  cps?: number;
  /** ms to pause between lines. Default 200. */
  linePauseMs?: number;
  /** Fixed height in px to avoid CLS while typing. Default 280. */
  heightPx?: number;
  /** ARIA label for the terminal frame. */
  ariaLabel?: string;
}

export function TerminalReplay({
  lines,
  cps = 30,
  linePauseMs = 200,
  heightPx = 280,
  ariaLabel = "Terminal session replay",
}: Readonly<TerminalReplayProps>) {
  const [renderedLines, setRenderedLines] = useState<string[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const cancelRef = useRef(false);
  const playTokenRef = useRef(0);

  useEffect(() => {
    if (typeof globalThis.window === "undefined") return;
    const mql = globalThis.window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const play = useCallback(async () => {
    cancelRef.current = false;
    const myToken = ++playTokenRef.current;
    setIsPlaying(true);
    setHasFinished(false);
    setRenderedLines([]);

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < lines.length; i++) {
      if (cancelRef.current || playTokenRef.current !== myToken) {
        setIsPlaying(false);
        return;
      }
      const line = lines[i];
      if (!line) continue;
      const target = line.text;

      if (line.kind !== "prompt") {
        setRenderedLines((prev) => [...prev, target]);
        await sleep(linePauseMs);
        continue;
      }

      for (let c = 1; c <= target.length; c++) {
        if (cancelRef.current || playTokenRef.current !== myToken) {
          setIsPlaying(false);
          return;
        }
        const partial = target.slice(0, c);
        setRenderedLines((prev) => {
          const copy = prev.slice(0, i);
          copy[i] = partial;
          return copy;
        });
        await sleep(cps);
      }
      await sleep(linePauseMs);
    }

    if (playTokenRef.current === myToken) {
      setIsPlaying(false);
      setHasFinished(true);
    }
  }, [lines, cps, linePauseMs]);

  useEffect(() => {
    if (reducedMotion) {
      setRenderedLines(lines.map((l) => l.text));
      setHasFinished(true);
      return;
    }
    play();
    return () => {
      cancelRef.current = true;
    };
  }, [reducedMotion, lines, play]);

  return (
    <figure
      className={styles.frame}
      style={{ height: `${heightPx}px` }}
      aria-label={ariaLabel}
    >
      <div className={styles.chrome}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.title}>egide@dev — zsh</span>
        {!reducedMotion && hasFinished && !isPlaying ? (
          <button
            type="button"
            onClick={play}
            className={styles.replay}
            aria-label="Replay terminal session"
          >
            ▷ replay
          </button>
        ) : null}
      </div>
      <pre className={styles.body}>
        {renderedLines.map((text, idx) => {
          const kind = lines[idx]?.kind ?? "output";
          const isLast = idx === renderedLines.length - 1;
          return (
            <span
              key={`line-${idx}-${kind}`}
              className={`${styles.line} ${styles[kind]}`}
            >
              {kind === "prompt" ? <span className={styles.dollar}>$ </span> : null}
              {kind === "ok" ? <span className={styles.check}>✓ </span> : null}
              <span>{text}</span>
              {isLast && isPlaying && !reducedMotion ? (
                <span className={styles.caret} aria-hidden="true" />
              ) : null}
              {"\n"}
            </span>
          );
        })}
      </pre>
    </figure>
  );
}
