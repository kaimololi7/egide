"""Egide workflow orchestrator (cf. ADR 011).

Plain Python state machine — NOT a PydanticAI agent. Orchestration is
deterministic, not LLM-driven.

Drives long-running journeys (J1 drop-docs → pyramid generation, J3
compilation pipeline) by consuming NATS subjects and dispatching to
agents/compliance tools.
"""

from .j1_state_machine import J1Phase, J1State, J1StateMachine
from .worker import OrchestratorWorker

__version__ = "0.0.1"
__all__ = ["J1Phase", "J1State", "J1StateMachine", "OrchestratorWorker"]

