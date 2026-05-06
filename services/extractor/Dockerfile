# syntax=docker/dockerfile:1.7
# Egide document extractor — Python 3.13 (Docling + pypdf + python-docx +
# MarkItDown). Build context: monorepo root (uv workspace).
#
# Docling pulls heavy ML deps; we keep the runtime layer focused by
# copying only the prebuilt virtualenv from the builder.
#
# Security (cf. ADR 014):
#   - non-root UID 65532
#   - no compilers in runtime
#   - HEALTHCHECK on /health (FastAPI route)

ARG PYTHON_VERSION=3.13
ARG UV_VERSION=0.5.11

# ─── builder ──────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim-bookworm AS build
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        build-essential curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN curl -LsSf https://astral.sh/uv/${UV_VERSION}/install.sh | sh \
 && mv /root/.local/bin/uv /usr/local/bin/uv
WORKDIR /repo
# Workspace manifests first for cache reuse
COPY pyproject.toml uv.lock* ./
COPY services/extractor/pyproject.toml services/extractor/pyproject.toml
COPY agents/common/pyproject.toml agents/common/pyproject.toml
COPY agents/compliance/pyproject.toml agents/compliance/pyproject.toml
COPY agents/orchestrator/pyproject.toml agents/orchestrator/pyproject.toml
RUN uv sync --frozen --no-install-project --package egide-extractor
# Now sources
COPY services/extractor services/extractor
COPY agents/common agents/common
RUN uv sync --frozen --package egide-extractor

# ─── runtime ──────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -g 65532 egide \
 && useradd  -u 65532 -g egide -d /app -s /sbin/nologin egide
WORKDIR /app
COPY --from=build --chown=65532:65532 /opt/venv /opt/venv
COPY --from=build --chown=65532:65532 /repo/services/extractor /app/services/extractor
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    EGIDE_LOG_LEVEL=info \
    PORT=8000
USER 65532:65532
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
ENTRYPOINT ["uvicorn", "extractor.app:app", "--host", "0.0.0.0", "--port", "8000"]
