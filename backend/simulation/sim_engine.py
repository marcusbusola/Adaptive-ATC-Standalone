"""
Main simulation engine for ATC aircraft simulation.
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Callable, Any
from loguru import logger

from .aircraft import Aircraft, Conflict
from .physics import update_aircraft_position, detect_all_conflicts


class SimulationEngine:
    """
    Aircraft simulation engine.

    Manages aircraft state, runs physics updates, and detects conflicts.
    """

    def __init__(self, tick_rate: float = 1.0):
        """
        Initialize simulation engine.

        Args:
            tick_rate: Seconds between physics updates
        """
        self.aircraft: Dict[str, Aircraft] = {}
        self.conflicts: List[Conflict] = []
        self.running = False
        self.paused = False
        self.tick_rate = tick_rate
        self.sim_time = 0.0  # Simulation elapsed time in seconds
        self.speed_multiplier = 1.0  # Time acceleration

        # Event callbacks
        self._event_handlers: Dict[str, List[Callable]] = {
            "aircraft_update": [],
            "conflict_detected": [],
            "emergency": [],
            "tick": [],
        }

        # Background task
        self._task: Optional[asyncio.Task] = None

    def add_event_handler(self, event_type: str, handler: Callable):
        """Register an event handler."""
        if event_type in self._event_handlers:
            self._event_handlers[event_type].append(handler)

    def remove_event_handler(self, event_type: str, handler: Callable):
        """Remove an event handler."""
        if event_type in self._event_handlers:
            handlers = self._event_handlers[event_type]
            if handler in handlers:
                handlers.remove(handler)

    async def _emit_event(self, event_type: str, data: Any = None):
        """Emit an event to all registered handlers."""
        if event_type in self._event_handlers:
            for handler in self._event_handlers[event_type]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(data)
                    else:
                        handler(data)
                except Exception as e:
                    logger.error(f"Event handler error: {e}")

    def load_scenario(self, aircraft_config: List[dict]):
        """
        Load aircraft from scenario configuration.

        Args:
            aircraft_config: List of aircraft configuration dicts
        """
        self.aircraft.clear()
        self.conflicts.clear()
        self.sim_time = 0.0

        for config in aircraft_config:
            ac = Aircraft.from_config(config)
            self.aircraft[ac.callsign] = ac
            logger.info(f"Loaded aircraft: {ac.callsign} at ({ac.lat:.4f}, {ac.lon:.4f})")

        logger.info(f"Loaded {len(self.aircraft)} aircraft")

    def add_aircraft(self, config: dict) -> Aircraft:
        """Add a single aircraft to the simulation."""
        ac = Aircraft.from_config(config)
        self.aircraft[ac.callsign] = ac
        return ac

    def remove_aircraft(self, callsign: str) -> bool:
        """Remove an aircraft from the simulation."""
        if callsign in self.aircraft:
            del self.aircraft[callsign]
            return True
        return False

    def get_aircraft(self, callsign: str) -> Optional[Aircraft]:
        """Get aircraft by callsign."""
        return self.aircraft.get(callsign)

    def get_all_aircraft(self) -> List[Aircraft]:
        """Get all aircraft."""
        return list(self.aircraft.values())

    def get_state(self) -> dict:
        """Get current simulation state."""
        return {
            "running": self.running,
            "paused": self.paused,
            "sim_time": self.sim_time,
            "speed_multiplier": self.speed_multiplier,
            "aircraft_count": len(self.aircraft),
            "aircraft": [ac.to_dict() for ac in self.aircraft.values()],
            "conflicts": [c.to_dict() for c in self.conflicts],
        }

    def command_aircraft(
        self,
        callsign: str,
        altitude: Optional[float] = None,
        heading: Optional[float] = None,
        speed: Optional[float] = None,
    ) -> bool:
        """
        Issue a command to an aircraft.

        Args:
            callsign: Aircraft callsign
            altitude: Target altitude in feet
            heading: Target heading in degrees
            speed: Target speed in knots

        Returns:
            True if command was accepted
        """
        ac = self.aircraft.get(callsign)
        if not ac:
            return False

        if altitude is not None:
            ac.target_altitude = altitude
            logger.debug(f"[{callsign}] Cleared to altitude {altitude}")

        if heading is not None:
            ac.target_heading = heading % 360
            logger.debug(f"[{callsign}] Turn heading {heading}")

        if speed is not None:
            ac.target_speed = max(150, min(speed, 500))  # Clamp to reasonable range
            logger.debug(f"[{callsign}] Speed {speed}")

        return True

    def trigger_emergency(self, callsign: str, emergency_type: str = "general"):
        """Trigger an emergency for an aircraft."""
        ac = self.aircraft.get(callsign)
        if ac:
            ac.emergency = True
            logger.warning(f"[{callsign}] EMERGENCY: {emergency_type}")
            asyncio.create_task(
                self._emit_event("emergency", {"callsign": callsign, "type": emergency_type})
            )

    def trigger_comm_loss(self, callsign: str):
        """Trigger communication loss for an aircraft."""
        ac = self.aircraft.get(callsign)
        if ac:
            ac.comm_loss = True
            logger.warning(f"[{callsign}] COMM LOSS (NORDO)")

    def clear_emergency(self, callsign: str):
        """Clear emergency status for an aircraft."""
        ac = self.aircraft.get(callsign)
        if ac:
            ac.emergency = False
            ac.comm_loss = False

    def tick(self, dt: float):
        """
        Advance simulation by one tick.

        Args:
            dt: Time delta in seconds
        """
        # Update all aircraft positions
        for ac in self.aircraft.values():
            update_aircraft_position(ac, dt)

        # Detect conflicts
        self.conflicts = detect_all_conflicts(list(self.aircraft.values()))

        # Emit conflict events
        for conflict in self.conflicts:
            asyncio.create_task(self._emit_event("conflict_detected", conflict.to_dict()))

        self.sim_time += dt

    async def run(self):
        """Run the simulation loop."""
        self.running = True
        logger.info("Simulation started")

        last_time = asyncio.get_event_loop().time()

        while self.running:
            await asyncio.sleep(self.tick_rate / self.speed_multiplier)

            if self.paused:
                last_time = asyncio.get_event_loop().time()
                continue

            current_time = asyncio.get_event_loop().time()
            dt = (current_time - last_time) * self.speed_multiplier
            last_time = current_time

            self.tick(dt)

            # Emit tick event with current state
            await self._emit_event("tick", self.get_state())

        logger.info("Simulation stopped")

    async def start(self):
        """Start the simulation in background."""
        if self._task and not self._task.done():
            return

        self._task = asyncio.create_task(self.run())

    async def stop(self):
        """Stop the simulation."""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    def pause(self):
        """Pause the simulation."""
        self.paused = True
        logger.info("Simulation paused")

    def resume(self):
        """Resume the simulation."""
        self.paused = False
        logger.info("Simulation resumed")

    def set_speed(self, multiplier: float):
        """Set simulation speed multiplier."""
        self.speed_multiplier = max(0.1, min(multiplier, 10.0))
        logger.info(f"Simulation speed: {self.speed_multiplier}x")
