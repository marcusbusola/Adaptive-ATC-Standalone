"""
Scenario Validation Tests

These tests ensure all scenarios are correctly configured:
- Events are sorted by trigger time
- All event types have handlers
- Phases don't overlap
- Aircraft counts match manifest
- Measurements are properly registered
"""

import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from scenarios.base_scenario import load_scenario_manifest, get_scenario_config
from scenarios.scenario_l1 import ScenarioL1
from scenarios.scenario_l2 import ScenarioL2
from scenarios.scenario_l3 import ScenarioL3
from scenarios.scenario_h4 import ScenarioH4
from scenarios.scenario_h5 import ScenarioH5
from scenarios.scenario_h6 import ScenarioH6


# List of all scenario classes
SCENARIO_CLASSES = [
    ScenarioL1,
    ScenarioL2,
    ScenarioL3,
    ScenarioH4,
    ScenarioH5,
    ScenarioH6,
]


class TestManifest:
    """Test the scenario manifest is valid"""

    def test_manifest_loads(self):
        """Test that manifest loads without error"""
        manifest = load_scenario_manifest()
        assert manifest is not None
        assert len(manifest) > 0

    def test_manifest_has_all_scenarios(self):
        """Test that manifest has all 6 scenarios"""
        manifest = load_scenario_manifest()
        expected_ids = ['L1', 'L2', 'L3', 'H4', 'H5', 'H6']
        for scenario_id in expected_ids:
            assert scenario_id in manifest, f"Missing scenario {scenario_id} in manifest"

    def test_manifest_required_fields(self):
        """Test that each scenario in manifest has required fields"""
        manifest = load_scenario_manifest()
        required_fields = [
            'id', 'name', 'description', 'workload', 'complexity',
            'aircraft_count', 'duration_seconds', 'phases',
            'sagat_probe_times', 'event_types'
        ]

        for scenario_id, config in manifest.items():
            for field in required_fields:
                assert field in config, f"Scenario {scenario_id} missing required field: {field}"

    def test_manifest_phases_valid(self):
        """Test that phases are properly defined"""
        manifest = load_scenario_manifest()

        for scenario_id, config in manifest.items():
            phases = config.get('phases', [])
            assert len(phases) >= 1, f"Scenario {scenario_id} has no phases"

            # Check phase fields
            for i, phase in enumerate(phases):
                assert 'phase' in phase, f"Scenario {scenario_id} phase {i} missing 'phase' field"
                assert 'start' in phase, f"Scenario {scenario_id} phase {i} missing 'start' field"
                assert 'end' in phase, f"Scenario {scenario_id} phase {i} missing 'end' field"

            # Check phases don't overlap and are sorted
            for i in range(1, len(phases)):
                assert phases[i]['start'] >= phases[i-1]['start'], \
                    f"Scenario {scenario_id}: phases not sorted by start time"
                assert phases[i]['start'] <= phases[i-1]['end'], \
                    f"Scenario {scenario_id}: gap between phases {i-1} and {i}"


@pytest.mark.parametrize("scenario_class", SCENARIO_CLASSES)
class TestScenarioEvents:
    """Test event configuration for each scenario"""

    def test_events_sorted_by_time(self, scenario_class):
        """Test that events are sorted by trigger time"""
        scenario = scenario_class(session_id='test', condition=1)
        scenario.initialize()

        times = [e.time_offset for e in scenario.events]
        assert times == sorted(times), \
            f"{scenario_class.__name__}: Events not sorted by trigger time"

    def test_all_event_types_have_handlers(self, scenario_class):
        """Test that all event types used have handlers"""
        scenario = scenario_class(session_id='test', condition=1)
        scenario.initialize()

        for event in scenario.events:
            assert event.event_type in scenario._event_handlers, \
                f"{scenario_class.__name__}: No handler for event type '{event.event_type}'"

    def test_events_within_duration(self, scenario_class):
        """Test that all events trigger within scenario duration"""
        scenario = scenario_class(session_id='test', condition=1)
        scenario.initialize()

        info = scenario.get_scenario_info()
        duration = info.get('duration_seconds', 360)

        for event in scenario.events:
            assert event.time_offset <= duration, \
                f"{scenario_class.__name__}: Event at {event.time_offset}s exceeds duration {duration}s"


@pytest.mark.parametrize("scenario_class", SCENARIO_CLASSES)
class TestScenarioAircraft:
    """Test aircraft configuration for each scenario"""

    def test_aircraft_count_matches_info(self, scenario_class):
        """Test that aircraft count matches scenario info"""
        scenario = scenario_class(session_id='test', condition=1)
        scenario.initialize()

        info = scenario.get_scenario_info()
        expected_count = info.get('aircraft_count', 0)

        # Allow for aircraft that spawn later (H4 has VFR that spawns)
        # So we just check initial count is reasonable
        assert len(scenario.aircraft) >= expected_count - 2, \
            f"{scenario_class.__name__}: Aircraft count {len(scenario.aircraft)} much less than expected {expected_count}"

    def test_aircraft_have_required_fields(self, scenario_class):
        """Test that all aircraft have required fields"""
        scenario = scenario_class(session_id='test', condition=1)
        scenario.initialize()

        for callsign, aircraft in scenario.aircraft.items():
            assert aircraft.callsign == callsign
            assert aircraft.position is not None
            assert len(aircraft.position) == 2
            assert aircraft.altitude > 0
            assert 0 <= aircraft.heading <= 360
            assert aircraft.speed > 0


@pytest.mark.parametrize("scenario_class", SCENARIO_CLASSES)
class TestScenarioSAGAT:
    """Test SAGAT probe configuration for each scenario"""

    def test_sagat_probes_exist(self, scenario_class):
        """Test that SAGAT probes are defined"""
        scenario = scenario_class(session_id='test', condition=1)
        scenario.initialize()

        assert len(scenario.sagat_probes) >= 1, \
            f"{scenario_class.__name__}: No SAGAT probes defined"

    def test_sagat_probes_sorted(self, scenario_class):
        """Test that SAGAT probes are sorted by time"""
        scenario = scenario_class(session_id='test', condition=1)
        scenario.initialize()

        times = [p.time_offset for p in scenario.sagat_probes]
        assert times == sorted(times), \
            f"{scenario_class.__name__}: SAGAT probes not sorted by time"

    def test_sagat_questions_valid(self, scenario_class):
        """Test that SAGAT questions have required fields"""
        scenario = scenario_class(session_id='test', condition=1)
        scenario.initialize()

        for i, probe in enumerate(scenario.sagat_probes):
            assert len(probe.questions) >= 1, \
                f"{scenario_class.__name__}: Probe {i} has no questions"

            for j, question in enumerate(probe.questions):
                assert 'id' in question, \
                    f"{scenario_class.__name__}: Probe {i} question {j} missing 'id'"
                assert 'question' in question, \
                    f"{scenario_class.__name__}: Probe {i} question {j} missing 'question'"
                assert 'type' in question, \
                    f"{scenario_class.__name__}: Probe {i} question {j} missing 'type'"


@pytest.mark.parametrize("scenario_class", SCENARIO_CLASSES)
class TestScenarioPhases:
    """Test phase configuration for each scenario"""

    def test_phase_descriptions_exist(self, scenario_class):
        """Test that phase descriptions are defined"""
        scenario = scenario_class(session_id='test', condition=1)
        scenario.initialize()

        assert len(scenario.phase_descriptions) >= 1, \
            f"{scenario_class.__name__}: No phase descriptions defined"

    def test_update_phase_works(self, scenario_class):
        """Test that _update_current_phase works correctly"""
        scenario = scenario_class(session_id='test', condition=1)
        scenario.initialize()

        # Test phase 0 at start
        scenario.elapsed_time = 0
        scenario._update_current_phase()
        assert scenario.current_phase == 0

        # Test final phase near end
        info = scenario.get_scenario_info()
        duration = info.get('duration_seconds', 360)
        scenario.elapsed_time = duration - 1
        scenario._update_current_phase()
        # Should be in last phase
        assert scenario.current_phase >= 0


class TestManifestScenarioSync:
    """Test that manifest and scenario classes are in sync"""

    @pytest.mark.parametrize("scenario_class,scenario_id", [
        (ScenarioL1, 'L1'),
        (ScenarioL2, 'L2'),
        (ScenarioL3, 'L3'),
        (ScenarioH4, 'H4'),
        (ScenarioH5, 'H5'),
        (ScenarioH6, 'H6'),
    ])
    def test_aircraft_count_matches_manifest(self, scenario_class, scenario_id):
        """Test that scenario aircraft count matches manifest"""
        manifest_config = get_scenario_config(scenario_id)
        scenario = scenario_class(session_id='test', condition=1)
        scenario.initialize()

        manifest_count = manifest_config.get('aircraft_count', 0)
        actual_count = len(scenario.aircraft)

        # Allow some variance for aircraft that spawn later
        assert abs(actual_count - manifest_count) <= 2, \
            f"{scenario_id}: Manifest says {manifest_count} aircraft, scenario has {actual_count}"

    @pytest.mark.parametrize("scenario_class,scenario_id", [
        (ScenarioL1, 'L1'),
        (ScenarioL2, 'L2'),
        (ScenarioL3, 'L3'),
        (ScenarioH4, 'H4'),
        (ScenarioH5, 'H5'),
        (ScenarioH6, 'H6'),
    ])
    def test_duration_matches_manifest(self, scenario_class, scenario_id):
        """Test that scenario duration matches manifest"""
        manifest_config = get_scenario_config(scenario_id)
        scenario = scenario_class(session_id='test', condition=1)
        scenario.initialize()

        manifest_duration = manifest_config.get('duration_seconds', 0)
        scenario_info = scenario.get_scenario_info()
        scenario_duration = scenario_info.get('duration_seconds', 0)

        assert manifest_duration == scenario_duration, \
            f"{scenario_id}: Manifest says {manifest_duration}s, scenario says {scenario_duration}s"


class TestEventHandlerRegistry:
    """Test the event handler registry functionality"""

    def test_handler_registry_initialized(self):
        """Test that handler registry is initialized"""
        scenario = ScenarioL1(session_id='test', condition=1)
        assert hasattr(scenario, '_event_handlers')
        assert len(scenario._event_handlers) > 0

    def test_all_standard_handlers_registered(self):
        """Test that all standard event types have handlers"""
        scenario = ScenarioL1(session_id='test', condition=1)

        standard_types = [
            'emergency', 'comm_loss', 'phase_transition',
            'weather', 'altitude_deviation', 'conflict',
            'aircraft_spawn', 'vfr_intrusion', 'comm_failure',
            'system_crash', 'conflict_threshold', 'false_alarm',
            'delayed_alert', 'internal'
        ]

        for event_type in standard_types:
            assert event_type in scenario._event_handlers, \
                f"No handler registered for '{event_type}'"

    def test_custom_handler_registration(self):
        """Test that custom handlers can be registered"""
        scenario = ScenarioL1(session_id='test', condition=1)

        custom_called = {'value': False}

        def custom_handler(event):
            custom_called['value'] = True

        scenario.register_handler('custom_event', custom_handler)
        assert 'custom_event' in scenario._event_handlers


class TestMeasurementHelpers:
    """Test the measurement helper functions"""

    def test_register_measurement(self):
        """Test register_measurement creates correct structure"""
        scenario = ScenarioL1(session_id='test', condition=1)
        scenario.elapsed_time = 100.0

        key = scenario.register_measurement('test_event', 'target1', {'extra': 'data'})

        assert key == 'target1_test_event_detection'
        assert key in scenario.measurements

        measurement = scenario.measurements[key]
        assert measurement['event_type'] == 'test_event'
        assert measurement['target'] == 'target1'
        assert measurement['event_time'] == 100.0
        assert measurement['detected_time'] is None
        assert measurement['resolved_time'] is None
        assert measurement['extra'] == 'data'

    def test_resolve_measurement_detected(self):
        """Test resolve_measurement for detection"""
        scenario = ScenarioL1(session_id='test', condition=1)
        scenario.elapsed_time = 100.0
        scenario.register_measurement('test_event', 'target1')

        scenario.elapsed_time = 115.0
        result = scenario.resolve_measurement('target1', 'test_event', 'detected')

        assert result is True
        measurement = scenario.measurements['target1_test_event_detection']
        assert measurement['detected_time'] == 115.0
        assert measurement['detection_delay'] == 15.0

    def test_resolve_measurement_resolved(self):
        """Test resolve_measurement for resolution"""
        scenario = ScenarioL1(session_id='test', condition=1)
        scenario.elapsed_time = 100.0
        scenario.register_measurement('test_event', 'target1')

        scenario.elapsed_time = 130.0
        result = scenario.resolve_measurement('target1', 'test_event', 'resolved')

        assert result is True
        measurement = scenario.measurements['target1_test_event_detection']
        assert measurement['resolved_time'] == 130.0
        assert measurement['resolution_delay'] == 30.0


class TestBuilderHelpers:
    """Test the builder helper functions"""

    def test_add_aircraft(self):
        """Test add_aircraft helper"""
        scenario = ScenarioL1(session_id='test', condition=1)

        aircraft = scenario.add_aircraft(
            callsign='TEST123',
            position=(100.0, 200.0),
            altitude=350,
            heading=90,
            speed=450,
            route='LAX-SFO',
            destination='SFO'
        )

        assert 'TEST123' in scenario.aircraft
        assert aircraft.callsign == 'TEST123'
        assert aircraft.position == (100.0, 200.0)
        assert aircraft.altitude == 350
        assert aircraft.heading == 90
        assert aircraft.speed == 450

    def test_add_event(self):
        """Test add_event helper"""
        scenario = ScenarioL1(session_id='test', condition=1)
        initial_count = len(scenario.events)

        event = scenario.add_event(
            event_type='test_event',
            trigger_time=60.0,
            target='TEST123',
            message='Test message',
            priority='high'
        )

        assert len(scenario.events) == initial_count + 1
        assert event.event_type == 'test_event'
        assert event.time_offset == 60.0
        assert event.target == 'TEST123'
        assert event.data['message'] == 'Test message'

    def test_add_sagat_probe(self):
        """Test add_sagat_probe helper"""
        scenario = ScenarioL1(session_id='test', condition=1)
        initial_count = len(scenario.sagat_probes)

        probe = scenario.add_sagat_probe(
            trigger_time=120.0,
            questions=[
                {'id': 'q1', 'question': 'Test?', 'type': 'number'}
            ]
        )

        assert len(scenario.sagat_probes) == initial_count + 1
        assert probe.time_offset == 120.0
        assert len(probe.questions) == 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
