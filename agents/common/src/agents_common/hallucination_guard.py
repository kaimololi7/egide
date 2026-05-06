"""Hallucination guard — coherence rule Q01.

Verifies that every anchor reference cited by an AI worker exists in
the ontology (`ontology_chunks.anchor_ref`). Mismatch raises
HallucinationDetectedError. The caller can retry once with a correction
prompt, then surface to user.

Cf. ADR 007 §Hallucination guard + ADR 014 §LLM09.
"""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable

from agents_common.errors import HallucinationDetectedError

# Matches "iso27001-2022:A.8.13", "nis2:Art.21.2.b", "dora:Chap.4", etc.
ANCHOR_PATTERN = re.compile(
    r"\b(iso27001-2022|iso9001-2026|nis2|dora|cis|hds):([A-Za-z0-9._-]+)\b"
)


class HallucinationGuard:
    """Verifies anchor references against the ontology.

    Provide a `lookup_fn` that returns True if an anchor exists. Typically
    backed by `ontology_chunks` table query in apps/api.
    """

    def __init__(
        self,
        lookup_fn: Callable[[str, str], Awaitable[bool]],
    ) -> None:
        self._lookup = lookup_fn

    async def verify(self, text: str) -> None:
        """Raise HallucinationDetectedError if any anchor is unknown."""
        cited = self.extract_anchors(text)
        invalid: list[str] = []
        for framework, ref in cited:
            ok = await self._lookup(framework, ref)
            if not ok:
                invalid.append(f"{framework}:{ref}")
        if invalid:
            raise HallucinationDetectedError(invalid)

    @staticmethod
    def extract_anchors(text: str) -> list[tuple[str, str]]:
        """Extract all (framework, ref) pairs from text."""
        return [(m.group(1), m.group(2)) for m in ANCHOR_PATTERN.finditer(text)]
