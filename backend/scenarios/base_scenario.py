"""
Base Scenario Class

Defines the interface and common functionality for all ATC scenarios.
All scenarios inherit from this base class.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Tuple, Optional, Any, Callable
from datetime import datetime
from dataclasses import dataclass
from enum import Enum
import math
import json
import os


# Load scenario manifest (single source of truth)
_MANIFEST_PATH = os.path.join(os.path.dirname(__file__), 'scenario_manifest.json')
_SCENARIO_MANIFEST: Dict[str, Any] = {}

def load_scenario_manifest() -> Dict[str, Any]:
    """Load the scenario manifest from JSON file"""
    global _SCENARIO_MANIFEST
    if not _SCENARIO_MANIFEST:
        try:
            with open(_MANIFEST_PATH, 'r') as f:
                _SCENARIO_MANIFEST = json.load(f)
        except FileNotFoundError:
            print(f"Warning: Scenario manifest not found at {_MANIFEST_PATH}")
            _SCENARIO_MANIFEST = {}
    return _SCENARIO_MANIFEST


def get_scenario_config(scenario_id: str) -> Dict[str, Any]:
    """
    Get configuration for a specific scenario from the manifest.

    Args:
        scenario_id: Scenario identifier (e.g., 'L1', 'H5')

    Returns:
        Dictionary with scenario configuration, or empty dict if not found
    """
    manifest = load_scenario_manifest()
    return manifest.get(scenario_id, {})


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

    # Gamification: Pilot mood tracking
    last_contact_time: float = 0.0  # Elapsed time when controller last clicked/interacted
    mood: str = 'happy'  # 'happy', 'annoyed', 'angry'
    total_angry_time: float = 0.0  # Total seconds spent angry (for complaints)
    max_ignored_time: float = 0.0  # Maximum time ignored in a single stretch

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
            'fuel_remaining': self.fuel_remaining,
            # Gamification fields
            'last_contact_time': self.last_contact_time,
            'mood': self.mood,
            'total_angry_time': self.total_angry_time,
            'max_ignored_time': self.max_ignored_time
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

    @classmethod
    def get_manifest_config(cls) -> Dict[str, Any]:
        """
        Get configuration from the scenario manifest for this scenario.

        Returns:
            Dictionary with scenario configuration from manifest
        """
        # Get scenario_id from subclass property
        # This requires instantiating temporarily or using class attribute
        return get_scenario_config(getattr(cls, 'SCENARIO_ID', ''))

    def get_config(self) -> Dict[str, Any]:
        """
        Get configuration from the scenario manifest for this scenario instance.

        Returns:
            Dictionary with scenario configuration from manifest
        """
        return get_scenario_config(self.scenario_id)

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

        # Alert tracking and suppression
        self.active_alerts: Dict[str, Dict[str, Any]] = {}  # alert_id -> alert data
        self.alert_history: List[Dict[str, Any]] = []  # All alerts with lifecycle
        self.max_simultaneous_alerts: int = 3  # Max non-critical alerts at once
        self.suppressed_alerts: List[Dict[str, Any]] = []  # Alerts that were suppressed

        # ML Prediction tracking (for Condition 3)
        self.resolved_predictions: set = set()  # Track which predictions user resolved
        self.pending_predictions: Dict[str, Dict[str, Any]] = {}  # prediction_id -> prediction data

        # ===== GAMIFICATION STATE =====
        self.safety_score: int = 1000  # Starting score
        self.score_changes: List[Dict[str, Any]] = []  # History of score changes
        self.pilot_complaints: List[Dict[str, Any]] = []  # Pilots who got angry
        self.active_conflicts: set = set()  # Track active conflict pairs for penalty

        # Mood thresholds (seconds since last contact)
        self.MOOD_ANNOYED_THRESHOLD = 45.0  # Becomes annoyed after 45s
        self.MOOD_ANGRY_THRESHOLD = 90.0    # Becomes angry after 90s

        # Score penalties and rewards
        self.ANGRY_PENALTY_PER_SECOND = 2   # Points lost per second while angry
        self.CONFLICT_PENALTY_PER_SECOND = 5  # Points lost per second during conflict
        self.HAPPY_BONUS_PER_SECOND = 1     # Points gained per second when all happy
        self.COMPLAINT_THRESHOLD = 90.0     # Seconds ignored to file complaint

        # Event handler registry
        self._event_handlers: Dict[str, Callable[[ScenarioEvent], None]] = {
            'emergency': self._handle_emergency_event,
            'comm_loss': self._handle_comm_loss_event,
            'phase_transition': self._handle_phase_transition,
            'weather': self._handle_weather_event,
            'altitude_deviation': self._handle_altitude_deviation_event,
            'conflict': self._handle_conflict_event,
            'aircraft_spawn': self._handle_aircraft_spawn_event,
            'vfr_intrusion': self._handle_vfr_intrusion_event,
            'comm_failure': self._handle_comm_failure_event,
            'system_crash': self._handle_system_crash_event,
            'conflict_threshold': self._handle_conflict_threshold_event,
            'false_alarm': self._handle_false_alarm_event,
            'delayed_alert': self._handle_delayed_alert_event,
            'internal': self._handle_internal_event,
            'ml_prediction': self._handle_ml_prediction_event,
        }

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

    # ========== Builder Helpers ==========
    # These methods reduce duplication when creating scenarios

    def add_aircraft(
        self,
        callsign: str,
        position: Tuple[float, float],
        altitude: int,
        heading: int,
        speed: int,
        route: Optional[str] = None,
        destination: Optional[str] = None,
        fuel_remaining: Optional[int] = None,
        **kwargs
    ) -> Aircraft:
        """
        Add an aircraft to the scenario.

        This is a convenience method to reduce duplication in scenario initialization.

        Args:
            callsign: Aircraft callsign (e.g., 'UAL238')
            position: (x, y) position in nautical miles
            altitude: Flight level (e.g., 280 = FL280)
            heading: Heading in degrees (0-360)
            speed: Speed in knots
            route: Optional route string
            destination: Optional destination airport
            fuel_remaining: Optional fuel in minutes
            **kwargs: Additional aircraft attributes

        Returns:
            The created Aircraft object
        """
        aircraft = Aircraft(
            callsign=callsign,
            position=position,
            altitude=altitude,
            heading=heading,
            speed=speed,
            route=route,
            destination=destination,
            fuel_remaining=fuel_remaining
        )

        # Apply any additional kwargs
        for key, value in kwargs.items():
            if hasattr(aircraft, key):
                setattr(aircraft, key, value)

        self.aircraft[callsign] = aircraft
        return aircraft

    def add_event(
        self,
        event_type: str,
        trigger_time: float,
        target: str = 'system',
        **data
    ) -> ScenarioEvent:
        """
        Add a timed event to the scenario.

        This is a convenience method to reduce duplication in event scheduling.

        Args:
            event_type: Type of event (e.g., 'emergency', 'phase_transition')
            trigger_time: Seconds from scenario start when event triggers
            target: Target identifier (aircraft callsign or 'system')
            **data: Event data passed to the handler

        Returns:
            The created ScenarioEvent object
        """
        event = ScenarioEvent(
            time_offset=trigger_time,
            event_type=event_type,
            target=target,
            data=data
        )
        self.events.append(event)
        return event

    def add_sagat_probe(
        self,
        trigger_time: float,
        questions: List[Dict[str, Any]]
    ) -> SAGATProbe:
        """
        Add a SAGAT probe to the scenario.

        This is a convenience method to create SAGAT probes consistently.

        Args:
            trigger_time: Seconds from scenario start when probe triggers
            questions: List of question dictionaries with 'id', 'question', 'type', etc.

        Returns:
            The created SAGATProbe object
        """
        probe = SAGATProbe(
            time_offset=trigger_time,
            questions=questions
        )
        self.sagat_probes.append(probe)
        return probe

    def add_phase(
        self,
        phase_number: int,
        name: str,
        start_time: float,
        end_time: float,
        description: str = ''
    ) -> None:
        """
        Add a phase description and schedule the phase transition event.

        Args:
            phase_number: Phase number (1-indexed)
            name: Phase name
            start_time: Start time in seconds
            end_time: End time in seconds
            description: Phase description
        """
        # Ensure we have enough phase descriptions
        while len(self.phase_descriptions) < phase_number:
            self.phase_descriptions.append('')

        # Set the phase description (0-indexed internally)
        self.phase_descriptions[phase_number - 1] = f"Phase {phase_number}: {name}"

        # Add phase transition event (except for phase 1 which starts at T=0)
        if phase_number > 1:
            self.add_event(
                event_type='phase_transition',
                trigger_time=start_time,
                target='system',
                phase=phase_number
            )

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

        # Alert lifecycle management
        resolved_alerts = self._check_alert_resolution()
        reemit_alerts = self._check_alert_reemission()

        return {
            'elapsed_time': self.elapsed_time,
            'current_phase': self.current_phase,
            'phase_description': self.phase_descriptions[self.current_phase] if self.current_phase < len(self.phase_descriptions) else 'Complete',
            'aircraft': {callsign: ac.to_dict() for callsign, ac in self.aircraft.items()},
            'triggered_events': triggered_events,
            'triggered_probes': triggered_probes,
            'measurements': self.measurements,
            'active_alerts': list(self.active_alerts.values()),
            'reemit_alerts': reemit_alerts,
            'resolved_alerts': resolved_alerts
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

    def register_handler(self, event_type: str, handler: Callable[[ScenarioEvent], None]) -> None:
        """
        Register a custom event handler for a specific event type.

        This allows scenarios to override default handlers or add new ones.

        Args:
            event_type: The type of event to handle
            handler: Callable that takes a ScenarioEvent and processes it
        """
        self._event_handlers[event_type] = handler

    def _trigger_event(self, event: ScenarioEvent) -> None:
        """Execute event actions using the handler registry"""
        print(f"Triggering event: {event.event_type} for {event.target} at T+{self.elapsed_time:.0f}s")

        handler = self._event_handlers.get(event.event_type)
        if handler:
            handler(event)
        else:
            print(f"  Warning: No handler registered for event type '{event.event_type}'")

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

    def _handle_weather_event(self, event: ScenarioEvent) -> None:
        """
        Handle weather system activation/modification.

        Creates measurement for weather response tracking if not already present.
        Scenarios can override for specific weather handling logic.
        """
        weather_data = event.data
        center = weather_data.get('center', (0, 0))
        radius = weather_data.get('radius', 30)
        severity = weather_data.get('severity', 'moderate')

        print(f"  Weather event: {weather_data.get('weather_type', 'unknown')} at {center}, radius {radius}nm")

        # Store weather system info on scenario
        if not hasattr(self, 'weather_system'):
            self.weather_system = {}
        self.weather_system.update({
            'center': center,
            'radius': radius,
            'severity': severity,
            'active': True
        })

        # Generate alert for weather
        if weather_data.get('priority') in ['high', 'critical']:
            self.register_measurement('weather', 'system', {
                'weather_type': weather_data.get('weather_type'),
                'center': center,
                'radius': radius
            })

    def _handle_altitude_deviation_event(self, event: ScenarioEvent) -> None:
        """
        Handle unauthorized altitude deviation.

        Creates measurement for deviation detection tracking.
        """
        target = event.target
        data = event.data
        assigned = data.get('assigned_altitude')
        actual = data.get('actual_altitude')
        target_alt = data.get('target_altitude', actual)

        print(f"  Altitude deviation: {target} - Assigned FL{assigned}, Actual FL{actual}")

        # Create measurement for detection tracking
        self.register_measurement('altitude_deviation', target, {
            'assigned_altitude': assigned,
            'actual_altitude': actual,
            'target_altitude': target_alt,
            'reason': data.get('reason', 'unknown')
        })

        # Modify aircraft altitude if we have the aircraft
        aircraft = self.aircraft.get(target)
        if aircraft:
            aircraft.altitude = actual

    def _handle_conflict_event(self, event: ScenarioEvent) -> None:
        """
        Handle conflict detection event.

        Creates measurement for conflict resolution tracking.
        """
        data = event.data
        aircraft1 = data.get('aircraft_1', event.target)
        aircraft2 = data.get('aircraft_2', '')
        separation = data.get('separation', 'unknown')

        print(f"  Conflict: {aircraft1}/{aircraft2} - {separation}")

        # Create measurement for conflict resolution
        measurement_key = f"{aircraft1}_{aircraft2}_conflict_resolution"
        self.measurements[measurement_key] = {
            'conflict_time': self.elapsed_time,
            'detected_time': None,
            'resolved_time': None,
            'detection_delay': None,
            'resolution_delay': None,
            'separation_at_detection': separation,
            'alert_delayed': data.get('alert_delayed', False)
        }

    def _handle_aircraft_spawn_event(self, event: ScenarioEvent) -> None:
        """
        Handle new aircraft entering the scenario.

        Creates the aircraft and measurement for detection tracking.
        """
        data = event.data
        callsign = data.get('callsign', event.target)

        print(f"  Aircraft spawn: {callsign}")

        # Create the aircraft if aircraft_data provided
        if 'position' in data:
            self.aircraft[callsign] = Aircraft(
                callsign=callsign,
                position=tuple(data.get('position', (0, 0))),
                altitude=data.get('altitude', 100),
                heading=data.get('heading', 0),
                speed=data.get('speed', 250)
            )

        # Create measurement for detection (e.g., VFR intrusion detection)
        aircraft_type = data.get('aircraft_type', 'unknown')
        if aircraft_type == 'VFR_intrusion':
            self.register_measurement('vfr_intrusion', callsign, {
                'spawn_position': data.get('position'),
                'squawk': data.get('squawk', '1200')
            })

    def _handle_vfr_intrusion_event(self, event: ScenarioEvent) -> None:
        """
        Handle VFR intrusion into controlled airspace.

        Creates measurement for intrusion detection/contact tracking.
        """
        target = event.target
        data = event.data

        print(f"  VFR intrusion: {target}")

        # Create measurement for VFR intrusion detection
        self.register_measurement('vfr_intrusion', target, {
            'intrusion_time': self.elapsed_time,
            'position': data.get('position'),
            'altitude': data.get('altitude')
        })

    def _handle_comm_failure_event(self, event: ScenarioEvent) -> None:
        """
        Handle communication system failure (different from aircraft comm loss).

        This is typically a frequency or system-wide failure.
        """
        data = event.data
        target = event.target  # Could be 'frequency_119.5' or similar

        print(f"  Comm failure: {target}")

        # Create measurement for system failure detection
        self.register_measurement('comm_failure', target, {
            'failure_type': data.get('failure_type', 'frequency_offline'),
            'affected_aircraft': data.get('affected_aircraft', [])
        })

    def _handle_system_crash_event(self, event: ScenarioEvent) -> None:
        """
        Handle automation/system crash (silent failure).

        Used for complacency scenarios where system fails silently.
        """
        data = event.data
        system = data.get('system', 'conflict_detection')

        print(f"  System crash: {system}")

        # Create measurement for crash detection
        self.register_measurement('system_crash', system, {
            'system_type': system,
            'silent': data.get('silent', True),
            'affected_functions': data.get('affected_functions', [])
        })

    def _handle_conflict_threshold_event(self, event: ScenarioEvent) -> None:
        """
        Handle conflict threshold crossing (unalerted conflict).

        Used when conflict detection system has crashed and real conflict develops.
        """
        data = event.data
        aircraft1 = data.get('aircraft_1', event.target)
        aircraft2 = data.get('aircraft_2', '')

        print(f"  Conflict threshold: {aircraft1}/{aircraft2}")

        # Create measurement for manual conflict detection
        self.register_measurement('manual_conflict_detection', f"{aircraft1}_{aircraft2}", {
            'conflict_start': self.elapsed_time,
            'alert_generated': False,  # No automatic alert due to system crash
            'separation': data.get('separation')
        })

    def _handle_false_alarm_event(self, event: ScenarioEvent) -> None:
        """
        Handle false alarm generation.

        Used for cry wolf effect scenarios.
        """
        data = event.data
        target = event.target

        print(f"  False alarm: {target} - {data.get('alert_type', 'unknown')}")

        # Create measurement for false alarm recognition
        self.measurements[f"false_alarm_{target}"] = {
            'alarm_time': self.elapsed_time,
            'is_false_positive': True,
            'predicted': data.get('predicted_separation'),
            'actual': data.get('actual_separation'),
            'detected_as_false_time': None,
            'dismissed_time': None,
            'detection_delay': None,
            'dismissal_delay': None
        }

    def _handle_delayed_alert_event(self, event: ScenarioEvent) -> None:
        """
        Handle delayed alert delivery.

        The alert was supposed to trigger earlier but was delayed.
        """
        data = event.data
        target = event.target
        delay = data.get('delay_duration', data.get('delay_seconds', 0))

        print(f"  Delayed alert: {target} (delayed {delay}s)")

        # Update any existing measurements with alert time
        for key, measurement in self.measurements.items():
            if target in key and 'alert_time' in measurement:
                measurement['alert_time'] = self.elapsed_time
                print(f"  Updated measurement {key} with alert time")

    def _handle_internal_event(self, event: ScenarioEvent) -> None:
        """
        Handle internal state modifications.

        Used for scenario-specific state changes that don't fit other categories.
        """
        data = event.data
        action = data.get('action')
        target = event.target

        print(f"  Internal event: {action} for {target}")

        if action == 'modify_altitude':
            aircraft = self.aircraft.get(target)
            if aircraft:
                old_alt = aircraft.altitude
                aircraft.altitude = data.get('new_altitude', aircraft.altitude)
                print(f"  {target} altitude: FL{old_alt} -> FL{aircraft.altitude}")

        elif action == 'create_aircraft':
            aircraft_data = data.get('aircraft_data', {})
            callsign = aircraft_data.get('callsign', target)
            self.aircraft[callsign] = Aircraft(
                callsign=callsign,
                position=tuple(aircraft_data.get('position', (0, 0))),
                altitude=aircraft_data.get('altitude', 100),
                heading=aircraft_data.get('heading', 0),
                speed=aircraft_data.get('speed', 250)
            )
            print(f"  Created aircraft: {callsign}")

        elif action == 'modify_heading':
            aircraft = self.aircraft.get(target)
            if aircraft:
                old_hdg = aircraft.heading
                aircraft.heading = data.get('new_heading', aircraft.heading)
                print(f"  {target} heading: {old_hdg}° -> {aircraft.heading}°")

        elif action == 'modify_speed':
            aircraft = self.aircraft.get(target)
            if aircraft:
                old_spd = aircraft.speed
                aircraft.speed = data.get('new_speed', aircraft.speed)
                print(f"  {target} speed: {old_spd} -> {aircraft.speed} kts")

    def _handle_ml_prediction_event(self, event: ScenarioEvent) -> None:
        """
        Handle ML prediction events - generates early warning alerts (Condition 3 only).

        ML predictions appear 45-60 seconds before the real event occurs, giving
        controllers a chance to act proactively. If they act on the suggestion,
        the real alert is prevented.
        """
        if self.condition != 3:
            return  # Only for ML condition

        data = event.data
        target = event.target
        predicted_event = data.get('predicted_event', 'unknown')
        predicted_time = data.get('predicted_time', self.elapsed_time + 50)

        # Create unique prediction ID for tracking
        prediction_id = f"{target}_{predicted_event}"

        # Store prediction for later resolution check
        self.pending_predictions[prediction_id] = {
            'target': target,
            'predicted_event': predicted_event,
            'predicted_time': predicted_time,
            'prediction_time': self.elapsed_time,
            'confidence': data.get('confidence', 0.80),
            'reasoning': data.get('reasoning', ''),
            'suggested_action_ids': data.get('suggested_action_ids', [])
        }

        print(f"  ML Prediction: {predicted_event} for {target} in {predicted_time - self.elapsed_time:.0f}s")

        # Generate ML prediction alert
        self.generate_alert('ml_prediction', target, {
            'priority': 'medium',
            'message': f'ML predicts {predicted_event.replace("_", " ")} for {target}',
            'is_prediction': True,
            'prediction_id': prediction_id,
            'predicted_event': predicted_event,
            'predicted_time': predicted_time,
            'time_until_event': predicted_time - self.elapsed_time,
            'confidence': data.get('confidence', 0.80),
            'reasoning': data.get('reasoning', ''),
            'suggested_action_ids': data.get('suggested_action_ids', []),
            'ml_prediction': {
                'confidence': data.get('confidence', 0.80),
                'rationale': data.get('reasoning', 'ML model detected early signs of this event'),
                'explanation': data.get('reasoning', '')
            }
        })

    def resolve_prediction(self, prediction_id: str, action_taken: str = None) -> bool:
        """
        Mark an ML prediction as resolved by user action.

        When a user acts on an ML suggestion, this prevents the real alert
        from appearing when the predicted event would have occurred.

        Args:
            prediction_id: The prediction identifier (format: "target_event_type")
            action_taken: The action the user took to resolve

        Returns:
            True if prediction was resolved, False if not found
        """
        if prediction_id in self.pending_predictions:
            prediction = self.pending_predictions[prediction_id]
            prediction['resolved'] = True
            prediction['resolved_at'] = self.elapsed_time
            prediction['action_taken'] = action_taken
            self.resolved_predictions.add(prediction_id)
            print(f"  ML Prediction resolved: {prediction_id} via action '{action_taken}'")
            return True
        return False

    def should_show_real_alert(self, event_type: str, target: str) -> bool:
        """
        Check if real alert should be shown (not if prediction was resolved).

        If the user acted on an ML prediction for this event, the real alert
        is suppressed since the issue was proactively addressed.

        Args:
            event_type: Type of event (e.g., 'comm_loss', 'emergency')
            target: Target aircraft or system

        Returns:
            True if real alert should be shown, False if prediction was resolved
        """
        prediction_id = f"{target}_{event_type}"
        if prediction_id in self.resolved_predictions:
            print(f"  Real alert suppressed: {event_type} for {target} (prediction was resolved)")
            return False
        return True

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

    def register_measurement(self, event_type: str, target: str, data: Optional[Dict[str, Any]] = None) -> str:
        """
        Register a new measurement for tracking detection/resolution times.

        This is the unified way to create measurements for any event type.
        All measurements share a common structure with optional extra fields.

        Args:
            event_type: Type of event (e.g., 'comm_loss', 'altitude_deviation', 'vfr_intrusion')
            target: Target identifier (aircraft callsign, system name, etc.)
            data: Optional additional data specific to this measurement

        Returns:
            The measurement key for later reference
        """
        key = f"{target}_{event_type}_detection"

        self.measurements[key] = {
            'event_type': event_type,
            'target': target,
            'event_time': self.elapsed_time,
            'detected_time': None,
            'resolved_time': None,
            'detection_delay': None,
            'resolution_delay': None,
            **(data or {})
        }

        return key

    def resolve_measurement(
        self,
        target: str,
        event_type: str,
        resolution_type: str = 'detected'
    ) -> bool:
        """
        Mark a measurement as detected or resolved.

        Args:
            target: Target identifier (aircraft callsign, system name, etc.)
            event_type: Type of event
            resolution_type: Either 'detected' (first awareness) or 'resolved' (action taken)

        Returns:
            True if measurement was updated, False if not found or already set
        """
        key = f"{target}_{event_type}_detection"
        measurement = self.measurements.get(key)

        if not measurement:
            # Try to find by partial match (for backwards compatibility)
            for k, m in self.measurements.items():
                if target in k and event_type in k:
                    measurement = m
                    break

        if not measurement:
            return False

        if resolution_type == 'detected':
            if measurement['detected_time'] is None:
                measurement['detected_time'] = self.elapsed_time
                measurement['detection_delay'] = self.elapsed_time - measurement['event_time']
                print(f"  Measurement {event_type} for {target}: detected after {measurement['detection_delay']:.1f}s")
                return True

        elif resolution_type == 'resolved':
            if measurement['resolved_time'] is None:
                measurement['resolved_time'] = self.elapsed_time
                measurement['resolution_delay'] = self.elapsed_time - measurement['event_time']
                print(f"  Measurement {event_type} for {target}: resolved after {measurement['resolution_delay']:.1f}s")
                return True

        return False

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
        """
        Check if interaction resolves any measurements.

        This method is called after every interaction to see if it detects
        or resolves any pending measurements.
        """
        # Interaction types that count as detection
        detection_interactions = ['click', 'select', 'hover', 'focus', 'inspect']

        # Interaction types that count as resolution
        resolution_interactions = [
            'command', 'clearance', 'frequency_change',
            'altitude_command', 'heading_command', 'speed_command',
            'vector', 'handoff', 'acknowledge', 'radio_contact',
            'dismiss', 'clear', 'resolve'
        ]

        for key, measurement in self.measurements.items():
            # Skip if target doesn't match
            if target not in key:
                continue

            # Get event_time from various possible keys (backwards compatibility)
            event_time = measurement.get('event_time') or measurement.get('loss_time') or measurement.get('deviation_time') or measurement.get('intrusion_time') or measurement.get('alarm_time') or measurement.get('conflict_time') or 0

            # Handle detection
            if measurement.get('detected_time') is None:
                measurement['detected_time'] = self.elapsed_time
                measurement['detection_delay'] = self.elapsed_time - event_time
                event_type = measurement.get('event_type', key.split('_')[1] if '_' in key else 'unknown')
                print(f"  {event_type} detected for {target} after {measurement['detection_delay']:.1f}s")

            # Handle resolution
            if measurement.get('resolved_time') is None and interaction_type in resolution_interactions:
                measurement['resolved_time'] = self.elapsed_time
                measurement['resolution_delay'] = self.elapsed_time - event_time
                event_type = measurement.get('event_type', key.split('_')[1] if '_' in key else 'unknown')
                print(f"  {event_type} resolved for {target} after {measurement['resolution_delay']:.1f}s")

    def generate_alert(self, alert_type: str, target: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Generate alert based on condition with suppression and context-rich payloads.

        Features:
        - Alert suppression to prevent alert storms
        - Deduplication of similar alerts
        - Context-rich payloads with affected region, related traffic, required action
        - Alert lifecycle tracking

        Args:
            alert_type: Type of alert (e.g., 'emergency', 'comm_loss', 'conflict')
            target: Target identifier (aircraft callsign or system)
            data: Alert data including priority, message, and optional context

        Returns:
            Alert dictionary if generated, None if suppressed
        """
        alert_id = f"{alert_type}_{target}_{int(self.elapsed_time)}"
        priority = data.get('priority', 'medium')

        # ===== SUPPRESSION LOGIC =====

        # Check if ML prediction was resolved (Condition 3 only)
        # Skip this check for ml_prediction alerts themselves
        if self.condition == 3 and alert_type != 'ml_prediction':
            # Don't suppress alerts that are marked as predictions themselves
            if not data.get('is_prediction', False):
                if not self.should_show_real_alert(alert_type, target):
                    suppressed = {
                        'alert_id': alert_id,
                        'type': alert_type,
                        'target': target,
                        'priority': priority,
                        'reason': 'ml_prediction_resolved',
                        'suppressed_at': self.elapsed_time
                    }
                    self.suppressed_alerts.append(suppressed)
                    return None

        # Check for duplicate/similar active alerts
        existing_alert = self._find_similar_alert(alert_type, target)
        if existing_alert:
            # Update existing alert instead of creating new one
            return self._update_alert(existing_alert['alert_id'], data)

        # Suppress non-critical alerts if blocking modal is active
        if self._has_blocking_modal() and priority not in ['critical', 'high']:
            suppressed = {
                'alert_id': alert_id,
                'type': alert_type,
                'target': target,
                'priority': priority,
                'reason': 'blocking_modal_active',
                'suppressed_at': self.elapsed_time
            }
            self.suppressed_alerts.append(suppressed)
            print(f"  Alert suppressed: {alert_type} for {target} (blocking modal active)")
            return None

        # Limit simultaneous non-critical alerts
        non_critical_active = sum(1 for a in self.active_alerts.values()
                                  if a.get('priority') not in ['critical', 'high'])
        if non_critical_active >= self.max_simultaneous_alerts and priority not in ['critical', 'high']:
            suppressed = {
                'alert_id': alert_id,
                'type': alert_type,
                'target': target,
                'priority': priority,
                'reason': 'max_alerts_reached',
                'suppressed_at': self.elapsed_time
            }
            self.suppressed_alerts.append(suppressed)
            print(f"  Alert suppressed: {alert_type} for {target} (max alerts reached)")
            return None

        # ===== CONTEXT-RICH PAYLOAD =====

        # Get affected region
        affected_region = self._get_affected_region(target, alert_type, data)

        # Get related traffic
        related_traffic = self._get_related_traffic(target, alert_type)

        # Get required action
        required_action = data.get('required_action') or self._get_required_action(alert_type, target)

        # Build base alert with context
        base_alert = {
            'alert_id': alert_id,
            'type': alert_type,
            'target': target,
            'priority': priority,
            'message': data.get('message', ''),
            'timestamp': datetime.now().isoformat(),
            'elapsed_time': self.elapsed_time,
            # Context-rich fields
            'affected_region': affected_region,
            'related_traffic': related_traffic,
            'required_action': required_action,
            # Lifecycle tracking
            'generated_at': self.elapsed_time,
            'displayed_at': None,
            'acknowledged_at': None,
            'resolved_at': None,
        }

        # ===== CONDITION-SPECIFIC PRESENTATION =====

        if self.condition == 1:
            # Traditional: Full-screen modal
            alert = {
                **base_alert,
                'presentation': 'modal',
                'blocking': True,
                'requires_acknowledgment': True,
                'audio': True
            }

        elif self.condition == 2:
            # Rule-Based Adaptive
            alert = {
                **base_alert,
                'presentation': 'banner',
                'blocking': False,
                'requires_acknowledgment': False,
                'audio': alert_type == 'emergency',
                'adaptive_style': self._determine_adaptive_style(alert_type, data),
                'peripheral_cue': data.get('peripheral_cue', False),
                'recommended_actions': data.get('recommended_actions', [])
            }

        elif self.condition == 3:
            # ML-Based with explainability
            ml_prediction = data.get('ml_prediction', {})
            # Ensure ML prediction always has required fields
            if ml_prediction and 'confidence' not in ml_prediction:
                ml_prediction['confidence'] = data.get('confidence', 0.8)
            if ml_prediction and 'rationale' not in ml_prediction:
                ml_prediction['rationale'] = ml_prediction.get('explanation', 'Alert generated based on scenario conditions')

            alert = {
                **base_alert,
                'presentation': 'banner',
                'blocking': False,
                'requires_acknowledgment': False,
                'audio': False,
                'ml_prediction': ml_prediction,
                'confidence': data.get('confidence', 0.8),
                'highlight_regions': data.get('highlight_regions', [])
            }

        else:
            alert = base_alert

        # ===== TRACK ALERT =====
        self.active_alerts[alert_id] = alert
        self.alert_history.append({
            **alert,
            'status': 'generated'
        })

        return alert

    def _find_similar_alert(self, alert_type: str, target: str) -> Optional[Dict[str, Any]]:
        """Find an existing similar alert that could be updated instead of duplicated"""
        for alert_id, alert in self.active_alerts.items():
            if alert['type'] == alert_type and alert['target'] == target:
                # Same type and target = similar alert
                return alert
        return None

    def _update_alert(self, alert_id: str, new_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing alert with new data"""
        if alert_id not in self.active_alerts:
            return None

        alert = self.active_alerts[alert_id]

        # Update message if provided
        if 'message' in new_data:
            alert['message'] = new_data['message']

        # Update priority if higher
        priority_order = {'low': 0, 'medium': 1, 'high': 2, 'critical': 3}
        new_priority = new_data.get('priority', 'medium')
        if priority_order.get(new_priority, 0) > priority_order.get(alert.get('priority'), 0):
            alert['priority'] = new_priority

        # Mark as updated
        alert['updated_at'] = self.elapsed_time
        alert['update_count'] = alert.get('update_count', 0) + 1

        print(f"  Alert updated: {alert_id} (update #{alert['update_count']})")
        return alert

    def _has_blocking_modal(self) -> bool:
        """Check if there's currently a blocking modal alert active"""
        for alert in self.active_alerts.values():
            if alert.get('blocking') and alert.get('acknowledged_at') is None:
                return True
        return False

    def _get_affected_region(self, target: str, alert_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Get the affected airspace region for an alert"""
        # If explicitly provided, use that
        if 'affected_region' in data:
            return data['affected_region']

        # Try to determine from target aircraft
        aircraft = self.aircraft.get(target)
        if aircraft:
            return {
                'center': aircraft.position,
                'radius': 20,  # NM
                'altitude_range': [aircraft.altitude - 20, aircraft.altitude + 20],
                'type': 'aircraft_vicinity'
            }

        # For system-wide alerts
        if target == 'system' or alert_type in ['weather', 'system_crash']:
            if hasattr(self, 'weather_system') and self.weather_system:
                return {
                    'center': self.weather_system.get('center', (125, 125)),
                    'radius': self.weather_system.get('radius', 30),
                    'type': 'weather_affected'
                }

        return {'type': 'sector_wide'}

    def _get_related_traffic(self, target: str, alert_type: str) -> List[str]:
        """Get list of aircraft related to this alert"""
        related = []

        # For conflict alerts, both aircraft are related
        if alert_type in ['conflict', 'conflict_threshold']:
            for key, measurement in self.measurements.items():
                if target in key and 'conflict' in key:
                    # Extract both aircraft from measurement key
                    parts = key.replace('_conflict_resolution', '').split('_')
                    related.extend(parts)

        # For emergencies, nearby traffic is related
        elif alert_type == 'emergency':
            target_ac = self.aircraft.get(target)
            if target_ac:
                for callsign, ac in self.aircraft.items():
                    if callsign != target:
                        # Check if within 30nm and similar altitude
                        dx = ac.position[0] - target_ac.position[0]
                        dy = ac.position[1] - target_ac.position[1]
                        dist = (dx**2 + dy**2)**0.5
                        alt_diff = abs(ac.altitude - target_ac.altitude)
                        if dist < 30 and alt_diff < 40:
                            related.append(callsign)

        return list(set(related))  # Remove duplicates

    def _get_required_action(self, alert_type: str, target: str) -> str:
        """Get the required controller action for this alert type"""
        action_map = {
            'emergency': 'Provide priority handling and coordinate with adjacent sectors',
            'comm_loss': 'Attempt re-contact on guard frequency 121.5, initiate NORDO procedures',
            'conflict': 'Issue immediate vectors or altitude change to resolve conflict',
            'altitude_deviation': 'Verify with pilot, issue corrective clearance if unauthorized',
            'vfr_intrusion': 'Contact aircraft on guard frequency, instruct to exit controlled airspace',
            'weather': 'Coordinate reroutes around weather, monitor capacity',
            'system_crash': 'Switch to backup systems, increase manual monitoring',
            'false_alarm': 'Verify actual separation, dismiss if confirmed false',
            'delayed_alert': 'Verify current status, take immediate action if conflict confirmed'
        }
        return action_map.get(alert_type, 'Monitor situation and take appropriate action')

    def acknowledge_alert(self, alert_id: str) -> bool:
        """Mark an alert as acknowledged"""
        if alert_id in self.active_alerts:
            self.active_alerts[alert_id]['acknowledged_at'] = self.elapsed_time
            print(f"  Alert acknowledged: {alert_id}")
            return True
        return False

    def resolve_alert(self, alert_id: str) -> bool:
        """Mark an alert as resolved and remove from active"""
        if alert_id in self.active_alerts:
            alert = self.active_alerts[alert_id]
            alert['resolved_at'] = self.elapsed_time
            alert['status'] = 'resolved'

            # Update history
            for hist_alert in self.alert_history:
                if hist_alert['alert_id'] == alert_id:
                    hist_alert['resolved_at'] = self.elapsed_time
                    hist_alert['status'] = 'resolved'

            # Remove from active
            del self.active_alerts[alert_id]
            print(f"  Alert resolved: {alert_id}")
            return True
        return False

    def resolve_emergency_by_action(self, callsign: str, action_id: str) -> bool:
        """
        Clear emergency status if the action resolves it.

        This is called when a controller takes an expected action (like granting
        priority landing clearance) to update the aircraft's emergency state.

        Args:
            callsign: Aircraft callsign (e.g., 'UAL238')
            action_id: The action ID that was taken

        Returns:
            True if emergency was cleared, False otherwise
        """
        aircraft = self.aircraft.get(callsign)
        if not aircraft or not aircraft.emergency:
            return False

        # Actions that resolve emergencies
        resolving_actions = {
            'priority_landing', 'emergency_landing', 'clear_to_land',
            'grant_priority', 'emergency_clearance', 'priority_clearance',
            'grant_priority_landing_clearance'
        }

        # Normalize action_id for comparison
        action_lower = action_id.lower().replace(' ', '_').replace('-', '_')

        # Check if action resolves emergency
        if action_lower in resolving_actions or 'priority' in action_lower or 'emergency' in action_lower:
            aircraft.emergency = False
            aircraft.emergency_type = None
            print(f"  Emergency resolved for {callsign} via action '{action_id}'")
            return True

        return False

    def _check_alert_reemission(self) -> List[Dict[str, Any]]:
        """
        Re-emit unresolved alerts for Condition 1 (Traditional Modal) every 15 seconds.
        This ensures alerts stay visible until acknowledged or resolved.
        Returns list of alerts to re-emit (for inclusion in update response).
        """
        if self.condition != 1:
            return []

        REEMIT_INTERVAL = 15.0  # seconds
        alerts_to_reemit = []

        for alert_id, alert in self.active_alerts.items():
            # Skip already acknowledged alerts
            if alert.get('acknowledged_at') is not None:
                continue

            last_emitted = alert.get('last_emitted_at', alert.get('generated_at', 0))
            if self.elapsed_time - last_emitted >= REEMIT_INTERVAL:
                alert['last_emitted_at'] = self.elapsed_time
                alert['reemit_count'] = alert.get('reemit_count', 0) + 1

                # Create a copy for the response (don't play audio on re-emit)
                reemit_alert = alert.copy()
                reemit_alert['is_reemit'] = True
                reemit_alert['suppress_audio'] = True
                alerts_to_reemit.append(reemit_alert)

                print(f"  Re-emitting alert {alert_id} (reemit #{alert['reemit_count']})")

        return alerts_to_reemit

    def _check_alert_resolution(self) -> List[str]:
        """
        Auto-resolve alerts when underlying issue is fixed.
        Checks aircraft state to determine if the condition that triggered
        the alert has been resolved.
        Returns list of resolved alert IDs.
        """
        resolved_ids = []

        for alert_id, alert in list(self.active_alerts.items()):
            target = alert.get('target')
            alert_type = alert.get('type')
            should_resolve = False

            aircraft = self.aircraft.get(target) if target else None

            if alert_type == 'comm_loss':
                # Resolve when comm status is restored to normal
                if aircraft and aircraft.comm_status == 'normal':
                    should_resolve = True
            elif alert_type == 'emergency':
                # Resolve when emergency is cleared
                if aircraft and not aircraft.emergency:
                    should_resolve = True
            elif alert_type == 'altitude_deviation':
                # Resolve when aircraft returns to assigned altitude
                if aircraft and hasattr(aircraft, 'altitude_deviation_resolved'):
                    should_resolve = aircraft.altitude_deviation_resolved
            elif alert_type == 'conflict':
                # Resolve when separation is restored (would need conflict tracking)
                pass  # Conflicts typically resolved by ATC action, not auto-resolved
            elif alert_type == 'vfr_intrusion':
                # Resolve when VFR aircraft exits or is identified
                if aircraft and hasattr(aircraft, 'vfr_resolved'):
                    should_resolve = aircraft.vfr_resolved

            if should_resolve:
                self.resolve_alert(alert_id)
                resolved_ids.append(alert_id)

        return resolved_ids

    def get_alert_metrics(self) -> Dict[str, Any]:
        """Get alert metrics for analysis"""
        total_generated = len(self.alert_history)
        total_suppressed = len(self.suppressed_alerts)
        total_acknowledged = sum(1 for a in self.alert_history if a.get('acknowledged_at'))
        total_resolved = sum(1 for a in self.alert_history if a.get('resolved_at'))

        # Calculate average response times
        response_times = []
        for alert in self.alert_history:
            if alert.get('acknowledged_at') and alert.get('generated_at'):
                response_times.append(alert['acknowledged_at'] - alert['generated_at'])

        return {
            'total_generated': total_generated,
            'total_suppressed': total_suppressed,
            'suppression_rate': total_suppressed / (total_generated + total_suppressed) if (total_generated + total_suppressed) > 0 else 0,
            'total_acknowledged': total_acknowledged,
            'total_resolved': total_resolved,
            'currently_active': len(self.active_alerts),
            'avg_response_time': sum(response_times) / len(response_times) if response_times else None,
            'suppression_reasons': self._get_suppression_breakdown()
        }

    def _get_suppression_breakdown(self) -> Dict[str, int]:
        """Get breakdown of suppression reasons"""
        breakdown = {}
        for suppressed in self.suppressed_alerts:
            reason = suppressed.get('reason', 'unknown')
            breakdown[reason] = breakdown.get(reason, 0) + 1
        return breakdown

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
            'final_state': self.get_state(),
            # Alert data for research analysis
            'alert_history': self.alert_history,
            'alert_metrics': self.get_alert_metrics(),
            'suppressed_alerts': self.suppressed_alerts
        }
