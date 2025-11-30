"""
ATC Simulation Engine

Provides aircraft simulation for the standalone ATC dashboard.
No external simulator dependencies required.
"""

from .aircraft import Aircraft
from .sim_engine import SimulationEngine
from .physics import update_aircraft_position

__all__ = ["Aircraft", "SimulationEngine", "update_aircraft_position"]
