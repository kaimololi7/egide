# syntax=docker/dockerfile:1.7
# Egide orchestrator — Python 3.13 NATS-driven J1 state machine.
# Bundles agents/compliance as an in-process library (cf. ADR 011 Strategy B).
# Build context: monorepo root (uv workspace).

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
COPY pyproject.toml uv.lock* ./
COPY services/extractor/pyproject.toml services/extractor/pyproject.toml
COPY agents/common/pyproject.toml agents/common/pyproject.toml
COPY agents/compliance/pyproject.toml agents/compliance/pyproject.toml
COPY agents/orchestrator/pyproject.toml agents/orchestrator/pyproject.toml
RUN uv sync --frozen --no-install-project --package egide-agents-orchestrator
COPY agents agents
RUN uv sync --frozen --package egide-agents-orchestrator

# ─── runtime ──────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -g 65532 egide \
 && useradd  -u 65532 -g egide -d /app -s /sbin/nologin egide
WORKDIR /app
COPY --from=build --chown=65532:65532 /opt/venv /opt/venv
COPY --from=build --chown=65532:65532 /repo/agents /app/agents
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    EGIDE_LOG_LEVEL=info
USER 65532:65532
ENTRYPOINT ["python", "-m", "agents_orchestrator"]
