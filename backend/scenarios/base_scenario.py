"""
Base Scenario Class

Defines the interface and common functionality for all ATC scenarios.
All scenarios inherit from this base class.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
import math


# Enums for scenario configuration (backwards compatibility)
class WorkloadLevel(Enum):
    """Workload level classification"""
    LOW = "low"
    HIGH = "high"


class EventType(Enum):
    """Types of scenario events"""
    EMERGENCY = "emergency"
    COMM_LOSS = "comm_loss"
    CONFLICT = "conflict"
    PHASE_TRANSITION = "phase_transition"
    AIRCRAFT_SPAWN = "aircraft_spawn"
    AUTOMATION_FAILURE = "automation_failure"


class AlertSeverity(Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Aircraft:
    """Aircraft state representation"""
    callsign: str
    position: Tuple[float, float]  # (x, y) in nautical miles
    altitude: int  # Flight level (e.g., 280 = FL280 = 28,000 ft)
    heading: int  # Degrees (0-360)
    speed: int  # Knots

    # Status flags
    emergency: bool = False
    emergency_type: Optional[str] = None
    comm_status: str = 'normal'  # 'normal', 'lost', 'degraded'
    datalink_status: str = 'normal'

    # Metadata
    route: Optional[str] = None
    destination: Optional[str] = None
    fuel_remaining: Optional[int] = None  # Minutes

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'callsign': self.callsign,
            'position': {
                'x': self.position[0],
                'y': self.position[1]
            },
            'altitude': self.altitude,
            'heading': self.heading,
            'speed': self.speed,
            'emergency': self.emergency,
            'emergency_type': self.emergency_type,
            'comm_status': self.comm_status,
            'datalink_status': self.datalink_status,
            'route': self.route,
            'destination': self.destination,
            'fuel_remaining': self.fuel_remaining
        }


@dataclass
class ScenarioEvent:
    """Timed event in scenario"""
    time_offset: float  # Seconds from scenario start
    event_type: str  # 'emergency', 'comm_loss', 'aircraft_spawn', etc.
    target: str  # Aircraft callsign or system
    data: Dict[str, Any]
    triggered: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'time_offset': self.time_offset,
            'event_type': self.event_type,
            'target': self.target,
            'data': self.data,
            'triggered': self.triggered
        }


@dataclass
class SAGATProbe:
    """Situation Awareness Global Assessment Technique probe"""
    time_offset: float  # Seconds from scenario start
    questions: List[Dict[str, Any]]
    triggered: bool = False
    response: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'time_offset': self.time_offset,
            'questions': self.questions,
            'triggered': self.triggered,
            'response': self.response
        }


class BaseScenario(ABC):
    """
    Base class for all ATC scenarios

    Provides common functionality:
    - Aircraft state management
    - Event scheduling and triggering
    - SAGAT probe management
    - Time tracking
    - Alert generation
    """

    def __init__(self, session_id: str, condition: int):
        """
        Initialize scenario

        Args:
            session_id: Unique session identifier
            condition: Experimental condition (1, 2, or 3)
        """
        self.session_id = session_id
        self.condition = condition

        # Time tracking
        self.start_time: Optional[datetime] = None
        self.elapsed_time: float = 0.0  # Seconds
        self.last_elapsed_time: float = 0.0
        self.paused: bool = False
        self.pause_start: Optional[datetime] = None

        # Scenario state
        self.aircraft: Dict[str, Aircraft] = {}
        self.events: List[ScenarioEvent] = []
        self.sagat_probes: List[SAGATProbe] = []

        # Measurements
        self.measurements: Dict[str, Any] = {}
        self.interactions: List[Dict[str, Any]] = []

        # Current phase
        self.current_phase: int = 0
        self.phase_descriptions: List[str] = []

    @abstractmethod
    def get_scenario_info(self) -> Dict[str, Any]:
        """Get scenario metadata"""
        pass

    @abstractmethod
    def initialize(self) -> None:
        """Initialize scenario state"""
        pass

    def start(self) -> None:
        """Start the scenario"""
        if self.start_time is None:
            self.initialize()
            self.start_time = datetime.now()
            print(f"Scenario started at {self.start_time}")

    def pause(self) -> None:
        """Pause the scenario"""
        if not self.paused:
            self.paused = True
            self.pause_start = datetime.now()
            print(f"Scenario paused at elapsed time: {self.elapsed_time:.1f}s")

    def resume(self) -> None:
        """Resume the scenario"""
        if self.paused and self.pause_start:
            self.paused = False
            self.pause_start = None
            print(f"Scenario resumed")

    def update(self) -> Dict[str, Any]:
        """
        Update scenario state
        Called periodically to trigger events and update state
        """
        if self.start_time is None or self.paused:
            return {'status': 'paused' if self.paused else 'not_started'}

        # Update elapsed time and calculate delta time (dt)
        now = datetime.now()
        self.elapsed_time = (now - self.start_time).total_seconds()
        dt = self.elapsed_time - self.last_elapsed_time
        self.last_elapsed_time = self.elapsed_time

        # Trigger pending events
        triggered_events = self._check_and_trigger_events()

        # Check SAGAT probes
        triggered_probes = self._check_sagat_probes()

        # Update aircraft positions
        self._update_aircraft_positions(dt)

        # Update current phase
        self._update_current_phase()

        return {
            'elapsed_time': self.elapsed_time,
            'current_phase': self.current_phase,
            'phase_description': self.phase_descriptions[self.current_phase] if self.current_phase < len(self.phase_descriptions) else 'Complete',
            'aircraft': {callsign: ac.to_dict() for callsign, ac in self.aircraft.items()},
            'triggered_events': triggered_events,
            'triggered_probes': triggered_probes,
            'measurements': self.measurements
        }

    def _check_and_trigger_events(self) -> List[Dict[str, Any]]:
        """Check for events that should trigger at current time"""
        triggered = []

        for event in self.events:
            if not event.triggered and self.elapsed_time >= event.time_offset:
                event.triggered = True
                self._trigger_event(event)
                triggered.append(event.to_dict())

        return triggered

    def _trigger_event(self, event: ScenarioEvent) -> None:
        """Execute event actions"""
        print(f"Triggering event: {event.event_type} for {event.target} at T+{self.elapsed_time:.0f}s")

        if event.event_type == 'emergency':
            self._handle_emergency_event(event)
        elif event.event_type == 'comm_loss':
            self._handle_comm_loss_event(event)
        elif event.event_type == 'phase_transition':
            self._handle_phase_transition(event)

    def _handle_emergency_event(self, event: ScenarioEvent) -> None:
        """Handle emergency declaration"""
        aircraft = self.aircraft.get(event.target)
        if aircraft:
            aircraft.emergency = True
            aircraft.emergency_type = event.data.get('emergency_type', 'unknown')

            if 'fuel' in aircraft.emergency_type.lower():
                aircraft.fuel_remaining = event.data.get('fuel_remaining', 20)

            print(f"  {aircraft.callsign} declares {aircraft.emergency_type} emergency")

    def _handle_comm_loss_event(self, event: ScenarioEvent) -> None:
        """Handle communication loss"""
        aircraft = self.aircraft.get(event.target)
        if aircraft:
            aircraft.comm_status = event.data.get('comm_status', 'lost')
            aircraft.datalink_status = event.data.get('datalink_status', 'lost')

            measurement_key = f"{event.target}_comm_loss_detection"
            self.measurements[measurement_key] = {
                'loss_time': self.elapsed_time,
                'detected_time': None,
                'resolved_time': None,
                'detection_delay': None,
                'resolution_delay': None
            }

            print(f"  {aircraft.callsign} lost communication")

    def _handle_phase_transition(self, event: ScenarioEvent) -> None:
        """Handle phase transition"""
        new_phase = event.data.get('phase', 0)
        print(f"  Transitioning to phase {new_phase}")

    def _check_sagat_probes(self) -> List[Dict[str, Any]]:
        """Check for SAGAT probes that should trigger"""
        triggered = []

        for probe in self.sagat_probes:
            if not probe.triggered and self.elapsed_time >= probe.time_offset:
                probe.triggered = True
                triggered.append(probe.to_dict())
                print(f"SAGAT Probe triggered at T+{self.elapsed_time:.0f}s")

        return triggered

    def _update_aircraft_positions(self, dt: float) -> None:
        """Update aircraft positions based on heading and speed"""
        for aircraft in self.aircraft.values():
            # If dt is very large, it's likely due to a long pause,
            # so we cap it to avoid huge jumps in position.
            effective_dt = min(dt, 5.0)  # Cap at 5 seconds to prevent large jumps

            speed_nm_per_sec = aircraft.speed / 3600  # knots to NM/sec

            heading_rad = math.radians(aircraft.heading)
            dx = speed_nm_per_sec * math.sin(heading_rad) * effective_dt
            dy = speed_nm_per_sec * math.cos(heading_rad) * effective_dt

            aircraft.position = (
                aircraft.position[0] + dx,
                aircraft.position[1] + dy
            )

    @abstractmethod
    def _update_current_phase(self) -> None:
        """Update current phase based on elapsed time"""
        pass

    def record_interaction(self, interaction_type: str, target: str, data: Dict[str, Any]) -> None:
        """Record participant interaction"""
        interaction = {
            'time': self.elapsed_time,
            'type': interaction_type,
            'target': target,
            'data': data,
            'timestamp': datetime.now().isoformat()
        }

        self.interactions.append(interaction)
        self._check_measurement_resolution(interaction_type, target)

    def _check_measurement_resolution(self, interaction_type: str, target: str) -> None:
        """Check if interaction resolves any measurements"""
        for key, measurement in self.measurements.items():
            if 'comm_loss_detection' in key and target in key:
                if measurement['detected_time'] is None:
                    measurement['detected_time'] = self.elapsed_time
                    measurement['detection_delay'] = self.elapsed_time - measurement['loss_time']
                    print(f"  Comm loss detected for {target} after {measurement['detection_delay']:.1f}s")

                if measurement['resolved_time'] is None and interaction_type in ['command', 'frequency_change']:
                    measurement['resolved_time'] = self.elapsed_time
                    measurement['resolution_delay'] = self.elapsed_time - measurement['loss_time']
                    print(f"  Comm loss resolved for {target} after {measurement['resolution_delay']:.1f}s")

    def generate_alert(self, alert_type: str, target: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate alert based on condition"""
        base_alert = {
            'alert_id': f"{alert_type}_{target}_{int(self.elapsed_time)}",
            'type': alert_type,
            'target': target,
            'priority': data.get('priority', 'medium'),
            'message': data.get('message', ''),
            'timestamp': datetime.now().isoformat(),
            'elapsed_time': self.elapsed_time
        }

        if self.condition == 1:
            # Traditional: Full-screen modal
            return {
                **base_alert,
                'presentation': 'modal',
                'blocking': True,
                'requires_acknowledgment': True,
                'audio': True
            }

        elif self.condition == 2:
            # Rule-Based Adaptive
            return {
                **base_alert,
                'presentation': 'banner',
                'blocking': False,
                'requires_acknowledgment': False,
                'audio': alert_type == 'emergency',
                'adaptive_style': self._determine_adaptive_style(alert_type, data)
            }

        elif self.condition == 3:
            # ML-Based
            return {
                **base_alert,
                'presentation': 'banner',
                'blocking': False,
                'requires_acknowledgment': False,
                'audio': False,
                'ml_prediction': data.get('ml_prediction'),
                'confidence': data.get('confidence', 0.8),
                'highlight_regions': data.get('highlight_regions', [])
            }

        return base_alert

    def _determine_adaptive_style(self, alert_type: str, data: Dict[str, Any]) -> str:
        """Determine adaptive alert style based on context"""
        active_emergencies = sum(1 for ac in self.aircraft.values() if ac.emergency)

        if active_emergencies > 0 and alert_type != 'emergency':
            return 'subtle'
        else:
            return 'prominent'

    # BlueSky coordinate conversion methods
    @property
    @abstractmethod
    def scenario_id(self) -> str:
        """Return scenario identifier (e.g., 'L1', 'H4')"""
        pass

    def _get_scenario_center(self) -> Tuple[float, float]:
        """Get center coordinates for scenario (KSFO for all)"""
        # All scenarios use KSFO as center point
        SCENARIO_CENTERS = {
            "L1": (37.6213, -122.3790),  # KSFO
            "L2": (37.6213, -122.3790),
            "L3": (37.6213, -122.3790),
            "H4": (37.6213, -122.3790),
            "H5": (37.6213, -122.3790),
            "H6": (37.6213, -122.3790),
        }
        return SCENARIO_CENTERS.get(self.scenario_id, (37.6213, -122.3790))

    def _convert_to_bluesky_coords(
        self, relative_pos: Tuple[float, float], altitude_fl: int
    ) -> Tuple[float, float, int]:
        """
        Convert relative NM position to absolute lat/lon for BlueSky

        Args:
            relative_pos: (x, y) position in nautical miles from center
            altitude_fl: Flight level (e.g., 280 = FL280)

        Returns:
            (latitude, longitude, altitude_feet) tuple
        """
        center_lat, center_lon = self._get_scenario_center()
        x_nm, y_nm = relative_pos

        # Convert NM to degrees
        # 1 degree latitude ≈ 60 NM
        # 1 degree longitude ≈ 60 * cos(latitude) NM
        lat = center_lat + (y_nm / 60.0)
        lon = center_lon + (x_nm / (60.0 * math.cos(math.radians(center_lat))))

        # Convert flight level to feet
        altitude_ft = altitude_fl * 100

        return lat, lon, altitude_ft

    def get_aircraft_config(self) -> List[Dict[str, Any]]:
        """
        Convert scenario aircraft to BlueSky spawn format

        Returns:
            List of aircraft configurations with absolute coordinates
        """
        config = []
        for callsign, aircraft in self.aircraft.items():
            lat, lon, alt_ft = self._convert_to_bluesky_coords(
                aircraft.position, aircraft.altitude
            )
            config.append({
                "callsign": callsign,
                "aircraft_type": "B737",  # Default type
                "type": "B737",  # Alias for compatibility
                "latitude": lat,
                "lat": lat,  # Alias for compatibility
                "longitude": lon,
                "lon": lon,  # Alias for compatibility
                "altitude": alt_ft,
                "heading": aircraft.heading,
                "speed": aircraft.speed,
                "route": aircraft.route or ""
            })
        return config

    def get_state(self) -> Dict[str, Any]:
        """Get current scenario state"""
        return {
            'session_id': self.session_id,
            'condition': self.condition,
            'elapsed_time': self.elapsed_time,
            'current_phase': self.current_phase,
            'aircraft_count': len(self.aircraft),
            'aircraft': {callsign: ac.to_dict() for callsign, ac in self.aircraft.items()},
            'measurements': self.measurements,
            'interaction_count': len(self.interactions)
        }

    def get_results(self) -> Dict[str, Any]:
        """Get final scenario results"""
        return {
            'scenario_info': self.get_scenario_info(),
            'duration': self.elapsed_time,
            'measurements': self.measurements,
            'interactions': self.interactions,
            'sagat_responses': [probe.response for probe in self.sagat_probes if probe.response],
            'final_state': self.get_state()
        }
