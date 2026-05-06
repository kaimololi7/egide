"""
Egide compliance AI worker.

Exposes ComplianceSuperAgent and SuperAgentConfig as primary public API.
"""

from .agent import ComplianceSuperAgent, SuperAgentConfig

__all__ = ["ComplianceSuperAgent", "SuperAgentConfig"]

__version__ = "0.0.1"
