"""Tests for HallucinationGuard (Q01) — anchor reference verification."""

from __future__ import annotations

import pytest
from agents_common.errors import HallucinationDetectedError
from agents_common.hallucination_guard import HallucinationGuard

KNOWN_ANCHORS: set[tuple[str, str]] = {
    ("iso27001-2022", "A.8.13"),
    ("iso27001-2022", "A.5.30"),
    ("nis2", "Art.21.2.c"),
    ("dora", "Chap.4"),
}


def _make_guard() -> HallucinationGuard:
    async def lookup(framework: str, ref: str) -> bool:
        return (framework, ref) in KNOWN_ANCHORS

    return HallucinationGuard(lookup)


def test_extract_anchors_finds_all_supported_frameworks() -> None:
    text = (
        "Per iso27001-2022:A.8.13 backups are mandatory. See nis2:Art.21.2.c "
        "and dora:Chap.4. Local frameworks: cis:CIS-3.4.1 and hds:H-1.2."
    )
    found = HallucinationGuard.extract_anchors(text)
    assert ("iso27001-2022", "A.8.13") in found
    assert ("nis2", "Art.21.2.c") in found
    assert ("dora", "Chap.4") in found
    assert ("cis", "CIS-3.4.1") in found
    assert ("hds", "H-1.2") in found


def test_extract_ignores_unsupported_frameworks() -> None:
    text = "Reference to nist:CSF.1.1 should not be extracted."
    assert HallucinationGuard.extract_anchors(text) == []


def test_extract_handles_empty_text() -> None:
    assert HallucinationGuard.extract_anchors("") == []


async def test_verify_passes_when_all_anchors_known() -> None:
    guard = _make_guard()
    text = "Backups per iso27001-2022:A.8.13 and nis2:Art.21.2.c."
    await guard.verify(text)  # No raise.


async def test_verify_raises_on_unknown_anchor() -> None:
    guard = _make_guard()
    text = "See iso27001-2022:A.99.99 — invented control."
    with pytest.raises(HallucinationDetectedError) as excinfo:
        await guard.verify(text)
    assert "iso27001-2022:A.99.99" in excinfo.value.invalid_anchors


async def test_verify_lists_all_invalid_anchors() -> None:
    guard = _make_guard()
    text = "Bogus iso27001-2022:A.99.99 and nis2:Art.999. Real iso27001-2022:A.8.13."
    with pytest.raises(HallucinationDetectedError) as excinfo:
        await guard.verify(text)
    invalid = excinfo.value.invalid_anchors
    assert "iso27001-2022:A.99.99" in invalid
    assert "nis2:Art.999" in invalid
    assert "iso27001-2022:A.8.13" not in invalid


async def test_verify_passes_when_no_anchors_cited() -> None:
    guard = _make_guard()
    await guard.verify("Plain narrative text without normative citations.")


async def test_error_code_and_retryable_flag() -> None:
    err = HallucinationDetectedError(["iso27001-2022:A.99.99"])
    assert err.code == "HALLUCINATION_DETECTED"
    assert err.retryable is True
