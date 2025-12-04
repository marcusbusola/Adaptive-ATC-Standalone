"""
Main simulation engine for ATC aircraft simulation.

Uses simple kinematic physics for reliable aircraft movement.

COORDINATE SYSTEM: This engine uses GEOGRAPHIC COORDINATES (lat/lon in degrees).
All distance calculations use the haversine formula expecting decimal degrees.

NOTE: This is a standalone simulation engine. The scenario system in
scenarios/base_scenario.py uses its own Aircraft class with radar coordinates
(x, y in NM). These are two separate systems:
- sim_engine.py + simulation/aircraft.py: Geographic coordinates (lat/lon)
- scenarios/*.py + base_scenario.Aircraft: Radar coordinates (x, y NM)

If you need to convert between systems, use BaseScenario._convert_to_bluesky_coords()
"""

import asyncio
import math
from datetime import datetime
from typing import Dict, List, Optional, Callable, Any
from loguru import logger

from .aircraft import Aircraft, Conflict


# Constants
EARTH_RADIUS_NM = 3440.065  # Nautical miles
KNOTS_TO_NM_PER_SEC = 1 / 3600  # 1 knot = 1 NM/hour

# Separation standards
MIN_HORIZONTAL_SEPARATION_NM = 3.0  # 3 nautical miles
MIN_VERTICAL_SEPARATION_FT = 1000  # 1000 feet

# Altitude change rate (realistic commercial aircraft climb/descent rate)
ALTITUDE_CHANGE_RATE_FPM = 2000  # feet per minute (standard for commercial aircraft)


def calculate_distance_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two points in nautical miles.
    Uses haversine formula for accuracy.
    """
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_NM * c


def check_conflict(ac1: Aircraft, ac2: Aircraft) -> Optional[Conflict]:
    """
    Check if two aircraft are in conflict.

    Returns Conflict object if separation is violated, None otherwise.
    """
    # Calculate horizontal separation
    horizontal_sep = calculate_distance_nm(ac1.lat, ac1.lon, ac2.lat, ac2.lon)

    # Calculate vertical separation
    vertical_sep = abs(ac1.altitude - ac2.altitude)

    # Check if in conflict
    if horizontal_sep < MIN_HORIZONTAL_SEPARATION_NM and vertical_sep < MIN_VERTICAL_SEPARATION_FT:
        # Determine severity
        if horizontal_sep < 1.0 and vertical_sep < 500:
            severity = "critical"
        elif horizontal_sep < 2.0 and vertical_sep < 750:
            severity = "alert"
        else:
            severity = "warning"

        return Conflict(
            callsign1=ac1.callsign,
            callsign2=ac2.callsign,
            horizontal_separation_nm=round(horizontal_sep, 2),
            vertical_separation_ft=round(vertical_sep, 0),
            time_to_closest=0,
            severity=severity,
        )

    return None


def detect_all_conflicts(aircraft_list: List[Aircraft]) -> List[Conflict]:
    """Check all aircraft pairs for conflicts."""
    conflicts = []

    for i, ac1 in enumerate(aircraft_list):
        for ac2 in aircraft_list[i + 1:]:
            conflict = check_conflict(ac1, ac2)
            if conflict:
                conflicts.append(conflict)

    return conflicts


class SimulationEngine:
    """
    Aircraft simulation engine with simple kinematic physics.

    Manages aircraft state, runs position updates, and detects conflicts.
    Uses instant response for heading/speed commands and gradual altitude changes.
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

    def _update_aircraft_position(self, aircraft: Aircraft, dt: float):
        """
        Update a single aircraft's position using simple kinematics.

        - Heading: Instant snap to target
        - Speed: Instant snap to target
        - Altitude: Gradual change at 2000 ft/s
        - Position: Simple distance = speed * time

        Args:
            aircraft: The aircraft to update
            dt: Time delta in seconds
        """
        # INSTANT HEADING - snap immediately to target
        if aircraft.target_heading is not None:
            aircraft.heading = aircraft.target_heading
            aircraft.target_heading = None

        # INSTANT SPEED - snap immediately to target
        if aircraft.target_speed is not None:
            aircraft.speed = aircraft.target_speed
            aircraft.target_speed = None

        # GRADUAL ALTITUDE - change at realistic rate (2000 fpm)
        if aircraft.target_altitude is not None:
            alt_diff = aircraft.target_altitude - aircraft.altitude
            # Convert fpm to ft/sec: divide by 60
            max_change = (ALTITUDE_CHANGE_RATE_FPM / 60.0) * dt

            if abs(alt_diff) <= max_change:
                # Close enough - snap to target
                aircraft.altitude = aircraft.target_altitude
                aircraft.target_altitude = None
                aircraft.vertical_rate = 0
            else:
                # Move toward target
                if alt_diff > 0:
                    aircraft.altitude += max_change
                    aircraft.vertical_rate = ALTITUDE_CHANGE_RATE_FPM  # Already in fpm for display
                else:
                    aircraft.altitude -= max_change
                    aircraft.vertical_rate = -ALTITUDE_CHANGE_RATE_FPM
        else:
            aircraft.vertical_rate = 0

        # UPDATE POSITION using simple kinematics
        # Distance traveled in nautical miles
        distance_nm = aircraft.speed * KNOTS_TO_NM_PER_SEC * dt

        # Convert heading to radians (0 = North, 90 = East)
        heading_rad = math.radians(aircraft.heading)

        # Flat-earth approximation for position change
        # 1 degree of latitude = 60 NM
        # Longitude degrees vary with latitude
        lat_change = distance_nm * math.cos(heading_rad) / 60.0

        # Protect against division by zero near poles
        cos_lat = math.cos(math.radians(aircraft.lat))
        if abs(cos_lat) > 0.001:
            lon_change = distance_nm * math.sin(heading_rad) / (60.0 * cos_lat)
        else:
            lon_change = 0

        aircraft.lat += lat_change
        aircraft.lon += lon_change
        aircraft.updated_at = datetime.utcnow()

    def tick(self, dt: float):
        """
        Advance simulation by one tick.

        Args:
            dt: Time delta in seconds
        """
        # Update all aircraft positions
        for ac in self.aircraft.values():
            self._update_aircraft_position(ac, dt)

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
