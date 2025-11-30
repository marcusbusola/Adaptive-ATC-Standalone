"""
Aircraft state model for ATC simulation.
"""

from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class Aircraft:
    """Represents an aircraft in the simulation."""

    callsign: str
    lat: float
    lon: float
    altitude: float  # feet
    heading: float  # degrees (0-360)
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
        """Create aircraft from scenario configuration."""
        return cls(
            callsign=config["callsign"],
            lat=config["lat"],
            lon=config["lon"],
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
