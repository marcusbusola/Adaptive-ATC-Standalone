"""
Basic flight physics for aircraft simulation.

Uses simple flat-earth approximation for short-range ATC scenarios.
"""

import math
from datetime import datetime
from .aircraft import Aircraft, Conflict
from typing import List, Tuple


# Constants
EARTH_RADIUS_NM = 3440.065  # Nautical miles
KNOTS_TO_NM_PER_SEC = 1 / 3600  # 1 knot = 1 NM/hour
FPM_TO_FPS = 1 / 60  # feet per minute to feet per second

# Standard rates
STANDARD_TURN_RATE = 3.0  # degrees per second (standard rate turn)
STANDARD_CLIMB_RATE = 2000  # feet per minute
STANDARD_DESCENT_RATE = 1500  # feet per minute
SPEED_CHANGE_RATE = 5  # knots per second

# Separation standards
MIN_HORIZONTAL_SEPARATION_NM = 3.0  # 3 nautical miles
MIN_VERTICAL_SEPARATION_FT = 1000  # 1000 feet


def normalize_heading(heading: float) -> float:
    """Normalize heading to 0-360 range."""
    while heading < 0:
        heading += 360
    while heading >= 360:
        heading -= 360
    return heading


def heading_difference(from_hdg: float, to_hdg: float) -> float:
    """
    Calculate shortest turn direction and magnitude.
    Returns negative for left turn, positive for right turn.
    """
    diff = normalize_heading(to_hdg) - normalize_heading(from_hdg)
    if diff > 180:
        diff -= 360
    elif diff < -180:
        diff += 360
    return diff


def update_aircraft_position(aircraft: Aircraft, dt: float) -> Aircraft:
    """
    Update aircraft position based on current state and time delta.

    Args:
        aircraft: Current aircraft state
        dt: Time delta in seconds

    Returns:
        Updated aircraft (mutates in place and returns)
    """
    # Update heading toward target
    if aircraft.target_heading is not None:
        hdg_diff = heading_difference(aircraft.heading, aircraft.target_heading)
        max_turn = STANDARD_TURN_RATE * dt

        if abs(hdg_diff) <= max_turn:
            aircraft.heading = aircraft.target_heading
            aircraft.target_heading = None
        else:
            turn = max_turn if hdg_diff > 0 else -max_turn
            aircraft.heading = normalize_heading(aircraft.heading + turn)

    # Update speed toward target
    if aircraft.target_speed is not None:
        speed_diff = aircraft.target_speed - aircraft.speed
        max_change = SPEED_CHANGE_RATE * dt

        if abs(speed_diff) <= max_change:
            aircraft.speed = aircraft.target_speed
            aircraft.target_speed = None
        else:
            change = max_change if speed_diff > 0 else -max_change
            aircraft.speed += change

    # Update altitude toward target
    if aircraft.target_altitude is not None:
        alt_diff = aircraft.target_altitude - aircraft.altitude

        if alt_diff > 0:
            # Climbing
            climb_rate = min(STANDARD_CLIMB_RATE, alt_diff * 60 / dt) if dt > 0 else STANDARD_CLIMB_RATE
            aircraft.vertical_rate = climb_rate
        else:
            # Descending
            descent_rate = min(STANDARD_DESCENT_RATE, abs(alt_diff) * 60 / dt) if dt > 0 else STANDARD_DESCENT_RATE
            aircraft.vertical_rate = -descent_rate

        alt_change = aircraft.vertical_rate * FPM_TO_FPS * dt

        if abs(alt_diff) <= abs(alt_change):
            aircraft.altitude = aircraft.target_altitude
            aircraft.target_altitude = None
            aircraft.vertical_rate = 0
        else:
            aircraft.altitude += alt_change
    else:
        aircraft.vertical_rate = 0

    # Update position based on heading and speed
    distance_nm = aircraft.speed * KNOTS_TO_NM_PER_SEC * dt

    # Convert heading to radians (0 = North, 90 = East)
    heading_rad = math.radians(aircraft.heading)

    # Calculate lat/lon change (flat earth approximation)
    # At the equator, 1 degree of latitude = 60 NM
    # Longitude degrees vary with latitude
    lat_change = distance_nm * math.cos(heading_rad) / 60.0
    lon_change = distance_nm * math.sin(heading_rad) / (60.0 * math.cos(math.radians(aircraft.lat)))

    aircraft.lat += lat_change
    aircraft.lon += lon_change
    aircraft.updated_at = datetime.utcnow()

    return aircraft


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


def check_conflict(ac1: Aircraft, ac2: Aircraft) -> Conflict | None:
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
            time_to_closest=0,  # Would need velocity projection to calculate
            severity=severity,
        )

    return None


def detect_all_conflicts(aircraft_list: List[Aircraft]) -> List[Conflict]:
    """Check all aircraft pairs for conflicts."""
    conflicts = []

    for i, ac1 in enumerate(aircraft_list):
        for ac2 in aircraft_list[i + 1 :]:
            conflict = check_conflict(ac1, ac2)
            if conflict:
                conflicts.append(conflict)

    return conflicts
