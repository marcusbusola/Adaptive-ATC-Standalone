"""
Aircraft state model for ATC simulation.

NOTE: This module uses GEOGRAPHIC COORDINATES (lat/lon in degrees) for the
standalone simulation engine (sim_engine.py). This is distinct from
scenarios/base_scenario.py Aircraft class which uses radar coordinates (x, y in NM).

The sim_engine uses these coordinates with haversine formula for accurate
distance calculations. If integrating with scenarios, use Aircraft.from_config()
which handles coordinate conversion.
"""

from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class Aircraft:
    """
    Represents an aircraft in the simulation using geographic coordinates.

    Coordinate System:
    - lat/lon: Geographic coordinates in decimal degrees
    - lat: -90 to 90 (negative = South)
    - lon: -180 to 180 (negative = West)

    For radar coordinate conversion, see scenarios/base_scenario.py
    """

    callsign: str
    lat: float  # Latitude in decimal degrees
    lon: float  # Longitude in decimal degrees
    altitude: float  # feet (not flight level)
    heading: float  # degrees (0-360, 0=North, 90=East)
    speed: float  # knots (ground speed)

    # Target values for autopilot
    target_altitude: Optional[float] = None
    target_heading: Optional[float] = None
    target_speed: Optional[float] = None

    # Vertical rate (feet per minute)
    vertical_rate: float = 0.0

    # Status flags
    emergency: bool = False
    comm_loss: bool = False

    # Aircraft type (for display/filtering)
    aircraft_type: str = "B738"

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "callsign": self.callsign,
            "lat": self.lat,
            "lon": self.lon,
            "altitude": self.altitude,
            "heading": self.heading,
            "speed": self.speed,
            "target_altitude": self.target_altitude,
            "target_heading": self.target_heading,
            "target_speed": self.target_speed,
            "vertical_rate": self.vertical_rate,
            "emergency": self.emergency,
            "comm_loss": self.comm_loss,
            "aircraft_type": self.aircraft_type,
        }

    @classmethod
    def from_config(cls, config: dict) -> "Aircraft":
        """Create aircraft from scenario configuration.

        Handles both coordinate formats:
        - Simulation format: {lat, lon}
        - Scenario format: {position: {x, y}} or {position: (x, y)}
        """
        # Handle both coordinate formats
        if "lat" in config and "lon" in config:
            lat = config["lat"]
            lon = config["lon"]
        elif "position" in config:
            # Scenario format: position is {x, y} or (x, y)
            pos = config["position"]
            if isinstance(pos, dict):
                # {position: {x: ..., y: ...}} - x is lon, y is lat
                lat = pos.get("y", pos.get("lat", 0))
                lon = pos.get("x", pos.get("lon", 0))
            elif isinstance(pos, (list, tuple)):
                # (x, y) tuple - x is lon, y is lat
                lon, lat = pos[0], pos[1]
            else:
                lat, lon = 0, 0
        else:
            raise ValueError("Aircraft config must have 'lat'/'lon' or 'position'")

        return cls(
            callsign=config["callsign"],
            lat=lat,
            lon=lon,
            altitude=config.get("altitude", 35000),
            heading=config.get("heading", 0),
            speed=config.get("speed", 250),
            target_altitude=config.get("target_altitude"),
            target_heading=config.get("target_heading"),
            target_speed=config.get("target_speed"),
            aircraft_type=config.get("aircraft_type", "B738"),
        )


@dataclass
class Conflict:
    """Represents a conflict between two aircraft."""

    callsign1: str
    callsign2: str
    horizontal_separation_nm: float
    vertical_separation_ft: float
    time_to_closest: float  # seconds
    severity: str  # "warning", "alert", "critical"

    def to_dict(self) -> dict:
        return {
            "callsign1": self.callsign1,
            "callsign2": self.callsign2,
            "horizontal_separation_nm": self.horizontal_separation_nm,
            "vertical_separation_ft": self.vertical_separation_ft,
            "time_to_closest": self.time_to_closest,
            "severity": self.severity,
        }
