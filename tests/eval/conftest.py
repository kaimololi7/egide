# conftest.py — shared pytest configuration for tests/eval

import pathlib
import sys


def pytest_configure(config):
    """Add repo source paths to sys.path so agents packages are importable."""
    repo_root = pathlib.Path(__file__).resolve().parents[1]
    paths = [
        repo_root / "agents" / "compliance" / "src",
        repo_root / "agents" / "orchestrator" / "src",
        repo_root / "agents" / "common" / "src",
    ]
    for p in paths:
        path_str = str(p)
        if path_str not in sys.path:
            sys.path.insert(0, path_str)
