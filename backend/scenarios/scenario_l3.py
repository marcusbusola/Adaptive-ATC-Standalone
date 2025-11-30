"""
Scenario L3: Automation Complacency / Vigilance

WORKLOAD: Low (5 aircraft)
DURATION: 6 minutes (360 seconds)

PHASE 1 (T+0:00 to T+2:00): Reliable Automation
- 5 aircraft in routine operations
- Conflict detection system works perfectly
- Multiple minor conflicts detected and alerted automatically
- Purpose: Build complacency through perfect automation performance

PHASE 2 (T+2:00 to T+2:36): Silent System Crash
- Conflict detection system CRASHES (silent)
- No error message, no warning
- System appears normal (still shows aircraft)
- Visual: "TCAS OK" indicator disappears (subtle)
- Tests: Will controller maintain manual vigilance?

PHASE 3 (T+2:36 to end): Unalerted Conflict
- DAL456 and JBU567 converge at FL300
- Separation reduces to 4.5 nm (minimum is 5 nm)
- NO automatic alert (system is crashed)
- Tests: Will controller manually detect conflict?

KEY MEASUREMENTS:
- Manual detection rate (Did they see the conflict?)
- Response time if detected
- Manual check frequency (clicks per minute on aircraft)
- Scan thoroughness (coverage of all aircraft)
- Expected Results:
  * Traditional: 70% detection rate
  * Rule-Based: 95% detection rate
  * ML: 98% detection rate
"""

from typing import Dict, Any, List, Tuple
import math
from datetime import datetime
from .base_scenario import BaseScenario, Aircraft, ScenarioEvent, SAGATProbe


class ScenarioL3(BaseScenario):
    """
    L3: Automation Complacency / Vigilance

    Tests controller's ability to maintain manual vigilance when
    automation appears reliable but silently fails.
    """
    duration = 360 # seconds

    @property
    def scenario_id(self) -> str:
        """Return scenario identifier"""
        return "L3"

    def get_scenario_info(self) -> Dict[str, Any]:
        """Get scenario metadata"""
        return {
            'scenario_id': 'L3',
            'name': 'Automation Complacency / Vigilance',
            'workload': 'Low',
            'aircraft_count': 5,
            'duration_seconds': 360,  # 6 minutes
            'duration_minutes': 6,
            'phases': [
                {
                    'phase': 1,
                    'name': 'Reliable Automation',
                    'start': 0,
                    'end': 120,  # 2:00 minutes
                    'description': 'Perfect conflict detection builds complacency'
                },
                {
                    'phase': 2,
                    'name': 'Silent System Crash',
                    'start': 120,
                    'end': 156,  # 2:36
                    'description': 'Conflict detection crashes silently'
                },
                {
                    'phase': 3,
                    'name': 'Unalerted Conflict',
                    'start': 156,
                    'end': 360,  # 6 minutes
                    'description': 'DAL456/JBU567 conflict without automatic alert'
                }
            ],
            'key_features': [
                'Perfect automation builds complacency',
                'Silent system crash (no alert)',
                'Gradual conflict development',
                'Behavioral tracking (manual checks)',
                'Vigilance testing'
            ]
        }

    def initialize(self) -> None:
        """Initialize scenario L3"""
        print(f"Initializing Scenario L3: Automation Complacency / Vigilance")

        self._initialize_aircraft()
        self._schedule_events()
        self._setup_sagat_probes()

        # Initialize automation system state
        self.conflict_detection_active = True
        self.tcas_ok_indicator = True
        self.system_crash_time = None
        self.conflict_detected_manually = False
        self.conflict_threshold_reached = False

        # Behavioral tracking
        self.manual_checks = []  # List of (time, aircraft_callsign)
        self.scan_history = []   # Rolling window of checked aircraft
        self.last_scan_calculation = 0.0

        # Initialize measurements
        self.measurements['conflict_detection'] = {
            'conflict_start_time': 156.0,  # T+2:36
            'detected_manually': False,
            'detection_time': None,
            'detection_delay': None,
            'action_taken': None,
            'action_time': None
        }

        self.measurements['behavioral_metrics'] = {
            'manual_check_frequency': 0.0,  # Clicks per minute
            'scan_thoroughness': 0.0,       # % of aircraft checked
            'vigilance_score': 0.0,         # Composite metric
            'checks_over_time': []          # Time series
        }

        self.measurements['system_monitoring'] = {
            'crash_time': 120.0,  # T+2:00
            'crash_detected': False,
            'crash_detection_time': None,
            'crash_detection_delay': None
        }

        print(f"  Initialized {len(self.aircraft)} aircraft")
        print(f"  Scheduled {len(self.events)} events")
        print(f"  Configured {len(self.sagat_probes)} SAGAT probes")

    def _initialize_aircraft(self) -> None:
        """Initialize all aircraft for L3"""

        # UAL123: Eastern sector
        self.aircraft['UAL123'] = Aircraft(
            callsign='UAL123',
            position=(100.0, 100.0),
            altitude=280,  # FL280
            heading=90,    # East
            speed=450,
            route='ORD-BOS',
            destination='BOS',
            fuel_remaining=120
        )

        # SWA234: Southeast sector
        self.aircraft['SWA234'] = Aircraft(
            callsign='SWA234',
            position=(150.0, 125.0),
            altitude=290,  # FL290
            heading=180,   # South
            speed=445,
            route='DEN-DAL',
            destination='DAL',
            fuel_remaining=110
        )

        # AAL345: North sector
        self.aircraft['AAL345'] = Aircraft(
            callsign='AAL345',
            position=(125.0, 150.0),
            altitude=320,  # FL320
            heading=270,   # West
            speed=440,
            route='JFK-SFO',
            destination='SFO',
            fuel_remaining=180
        )

        # DAL456: Northwest sector - WILL CONFLICT
        self.aircraft['DAL456'] = Aircraft(
            callsign='DAL456',
            position=(75.0, 175.0),
            altitude=300,  # FL300
            heading=135,   # Southeast
            speed=455,
            route='SEA-ATL',
            destination='ATL',
            fuel_remaining=160
        )

        # JBU567: Southeast sector - WILL CONFLICT
        self.aircraft['JBU567'] = Aircraft(
            callsign='JBU567',
            position=(175.0, 75.0),
            altitude=300,  # FL300
            heading=315,   # Northwest
            speed=455,
            route='MCO-PDX',
            destination='PDX',
            fuel_remaining=170
        )

    def _schedule_events(self) -> None:
        """Schedule all timed events for L3"""

        # T+2:00 (120s): Phase 2 - Silent System Crash
        self.events.append(ScenarioEvent(
            time_offset=120.0,
            event_type='phase_transition',
            target='system',
            data={
                'phase': 2,
                'description': 'Entering Phase 2: Silent System Crash'
            }
        ))

        self.events.append(ScenarioEvent(
            time_offset=120.0,
            event_type='system_crash',
            target='conflict_detection',
            data={
                'crash_type': 'silent',
                'system': 'conflict_detection',
                'indicator': 'TCAS OK',
                'indicator_change': 'VISIBLE → HIDDEN',
                'audio_alert': False,
                'modal_alert': False,
                'priority': 'critical',
                'message': 'CONFLICT DETECTION SYSTEM OFFLINE',
                'details': {
                    'type': 'Silent crash - no alert',
                    'affected_systems': ['TCAS', 'Conflict detection'],
                    'visual_cue': 'TCAS OK indicator disappears',
                    'detection_method': 'Controller must notice missing indicator'
                }
            }
        ))

        # T+2:36 (156s): Phase 3 - Conflict Threshold Reached
        self.events.append(ScenarioEvent(
            time_offset=156.0,
            event_type='phase_transition',
            target='system',
            data={
                'phase': 3,
                'description': 'Entering Phase 3: Unalerted Conflict'
            }
        ))

        self.events.append(ScenarioEvent(
            time_offset=156.0,
            event_type='conflict_threshold',
            target='DAL456_JBU567',
            data={
                'conflict_type': 'converging',
                'aircraft_1': 'DAL456',
                'aircraft_2': 'JBU567',
                'separation': 4.5,  # nm
                'minimum_separation': 5.0,  # nm
                'altitude': 300,  # FL300 (same altitude)
                'closure_rate': 15.0,  # nm/min
                'priority': 'critical',
                'message': 'CONFLICT: DAL456 / JBU567 - 4.5 NM',
                'details': {
                    'type': 'Loss of separation imminent',
                    'aircraft_1': 'DAL456',
                    'aircraft_2': 'JBU567',
                    'current_separation': 4.5,
                    'minimum_required': 5.0,
                    'projected_minimum': 3.0,
                    'time_to_minimum': 45,  # seconds
                    'automatic_alert': False,  # System is crashed
                    'requires_manual_detection': True
                }
            }
        ))

    def _setup_sagat_probes(self) -> None:
        """Configure SAGAT probes for situation awareness measurement"""

        # Probe 1: T+1:00 (60s) - During reliable automation phase
        self.sagat_probes.append(SAGATProbe(
            time_offset=60.0,
            questions=[
                {
                    'id': 'p1_q1',
                    'question': 'Is the conflict detection system operational?',
                    'type': 'multiple_choice',
                    'options': ['Yes', 'No', 'Unknown', 'Degraded'],
                    'correct_answer': 'Yes'
                },
                {
                    'id': 'p1_q2',
                    'question': 'How many potential conflicts has the system detected?',
                    'type': 'number',
                    'correct_answer': 0,
                    'note': 'During this phase, no actual conflicts (just testing)'
                },
                {
                    'id': 'p1_q3',
                    'question': 'What is your confidence in the automation?',
                    'type': 'multiple_choice',
                    'options': ['Very Low', 'Low', 'Medium', 'High', 'Very High'],
                    'note': 'Subjective - no correct answer'
                }
            ]
        ))

        # Probe 2: T+2:18 (138s) - After system crash, before conflict
        self.sagat_probes.append(SAGATProbe(
            time_offset=138.0,
            questions=[
                {
                    'id': 'p2_q1',
                    'question': 'Is the conflict detection system currently active?',
                    'type': 'multiple_choice',
                    'options': ['Yes', 'No', 'Unknown'],
                    'correct_answer': 'No',
                    'note': 'System crashed at T+2:00'
                },
                {
                    'id': 'p2_q2',
                    'question': 'Are any aircraft on converging paths?',
                    'type': 'multiple_choice',
                    'options': ['Yes', 'No', 'Unsure'],
                    'correct_answer': 'Yes',
                    'note': 'DAL456 and JBU567 are converging'
                },
                {
                    'id': 'p2_q3',
                    'question': 'What is the approximate separation between DAL456 and JBU567?',
                    'type': 'number',
                    'correct_answer': 7.5,  # Approximate at T+2:18
                    'tolerance': 2.0,  # Accept ±2 nm
                    'unit': 'nautical miles'
                }
            ]
        ))

        # Probe 3: T+2:48 (168s) - During/after conflict
        self.sagat_probes.append(SAGATProbe(
            time_offset=168.0,
            questions=[
                {
                    'id': 'p3_q1',
                    'question': 'Did you manually detect any conflicts?',
                    'type': 'multiple_choice',
                    'options': ['Yes', 'No', 'Not sure'],
                    'correct_answer': 'Yes',
                    'note': 'DAL456/JBU567 conflict occurred at T+2:36'
                },
                {
                    'id': 'p3_q2',
                    'question': 'What action did you take for DAL456/JBU567?',
                    'type': 'text',
                    'note': 'Open-ended - expect: vector, altitude change, or none'
                },
                {
                    'id': 'p3_q3',
                    'question': 'When did you first notice the conflict?',
                    'type': 'text',
                    'note': 'Timing reference - cross-check with interaction logs'
                }
            ]
        ))

    def _update_current_phase(self) -> None:
        """Update current phase based on elapsed time"""
        if self.elapsed_time < 120:
            self.current_phase = 0  # Phase 1: Reliable Automation
        elif self.elapsed_time < 156:
            self.current_phase = 1  # Phase 2: Silent System Crash
        else:
            self.current_phase = 2  # Phase 3: Unalerted Conflict

    def _trigger_event(self, event: ScenarioEvent) -> None:
        """Execute event actions (override to handle L3-specific events)"""
        print(f"Triggering event: {event.event_type} for {event.target} at T+{self.elapsed_time:.0f}s")

        if event.event_type == 'system_crash':
            self._handle_system_crash_event(event)
        elif event.event_type == 'conflict_threshold':
            self._handle_conflict_threshold_event(event)
        elif event.event_type == 'phase_transition':
            self._handle_phase_transition(event)
        else:
            # Call parent handler for standard events
            super()._trigger_event(event)

    def _handle_system_crash_event(self, event: ScenarioEvent) -> None:
        """Handle silent system crash"""
        self.conflict_detection_active = False
        self.tcas_ok_indicator = False
        self.system_crash_time = self.elapsed_time

        print(f"  CONFLICT DETECTION SYSTEM CRASHED (SILENT)")
        print(f"  Visual indicator: TCAS OK → HIDDEN")
        print(f"  No audio alert, no modal - controller must notice missing indicator")

        # Record crash time
        self.measurements['system_monitoring']['crash_time'] = self.elapsed_time

    def _handle_conflict_threshold_event(self, event: ScenarioEvent) -> None:
        """Handle conflict threshold being reached"""
        self.conflict_threshold_reached = True

        details = event.data['details']
        print(f"  CONFLICT THRESHOLD REACHED")
        print(f"  {details['aircraft_1']} / {details['aircraft_2']}")
        print(f"  Separation: {details['current_separation']} nm (min: {details['minimum_required']} nm)")
        print(f"  NO AUTOMATIC ALERT - System is crashed")

        # Record conflict start
        self.measurements['conflict_detection']['conflict_start_time'] = self.elapsed_time

    def update(self) -> Dict[str, Any]:
        """Update scenario state (override to add behavioral tracking)"""
        # Call parent update
        result = super().update()

        # Update behavioral metrics
        self._update_behavioral_metrics()

        # Check for conflict development
        self._check_conflict_development()

        # Add behavioral data to result
        result['behavioral_metrics'] = {
            'manual_check_frequency': self.measurements['behavioral_metrics']['manual_check_frequency'],
            'scan_thoroughness': self.measurements['behavioral_metrics']['scan_thoroughness'],
            'vigilance_score': self.measurements['behavioral_metrics']['vigilance_score']
        }

        result['system_status'] = {
            'conflict_detection_active': self.conflict_detection_active,
            'tcas_ok_indicator': self.tcas_ok_indicator
        }

        # Add real-time separation if in conflict phase
        if self.elapsed_time >= 300:  # After system crash
            separation = self._calculate_separation('DAL456', 'JBU567')
            result['dal456_jbu567_separation'] = separation

        return result

    def _update_behavioral_metrics(self) -> None:
        """Update behavioral tracking metrics"""
        # Calculate manual check frequency (clicks per minute in last 60s)
        recent_checks = [
            check for check in self.manual_checks
            if self.elapsed_time - check[0] <= 60.0
        ]
        self.measurements['behavioral_metrics']['manual_check_frequency'] = len(recent_checks)

        # Calculate scan thoroughness (unique aircraft checked in last 30s)
        recent_scans = [
            check[1] for check in self.manual_checks
            if self.elapsed_time - check[0] <= 30.0
        ]
        unique_aircraft = len(set(recent_scans))
        total_aircraft = len(self.aircraft)
        self.measurements['behavioral_metrics']['scan_thoroughness'] = (
            unique_aircraft / total_aircraft if total_aircraft > 0 else 0.0
        )

        # Calculate vigilance score (composite metric)
        check_freq = self.measurements['behavioral_metrics']['manual_check_frequency']
        scan_thorough = self.measurements['behavioral_metrics']['scan_thoroughness']
        self.measurements['behavioral_metrics']['vigilance_score'] = (
            (check_freq / 5.0) * 0.5 +  # Normalize check frequency (5/min = 100%)
            scan_thorough * 0.5          # Thoroughness already 0-1
        )

        # Record time series
        if self.elapsed_time - self.last_scan_calculation >= 10.0:  # Every 10 seconds
            self.measurements['behavioral_metrics']['checks_over_time'].append({
                'time': self.elapsed_time,
                'frequency': check_freq,
                'thoroughness': scan_thorough,
                'vigilance': self.measurements['behavioral_metrics']['vigilance_score']
            })
            self.last_scan_calculation = self.elapsed_time

    def _check_conflict_development(self) -> None:
        """Monitor conflict development between DAL456 and JBU567"""
        if self.elapsed_time < 300:  # Before system crash
            return

        separation = self._calculate_separation('DAL456', 'JBU567')

        # Check if conflict threshold reached (first time)
        if separation <= 5.0 and not self.conflict_threshold_reached:
            # Should have been caught by event at T+6:30, but double-check
            print(f"  [CONFLICT MONITOR] Separation: {separation:.2f} nm (threshold: 5.0 nm)")

    def _calculate_separation(self, callsign1: str, callsign2: str) -> float:
        """Calculate horizontal separation between two aircraft"""
        if callsign1 not in self.aircraft or callsign2 not in self.aircraft:
            return 999.0  # Large number if aircraft not found

        ac1 = self.aircraft[callsign1]
        ac2 = self.aircraft[callsign2]

        dx = ac2.position[0] - ac1.position[0]
        dy = ac2.position[1] - ac1.position[1]

        return math.sqrt(dx**2 + dy**2)

    def record_interaction(self, interaction_type: str, target: str, data: Dict[str, Any]) -> None:
        """Record participant interaction (override to track manual checks)"""
        # Call parent to record interaction
        super().record_interaction(interaction_type, target, data)

        # Track manual checks (clicks on aircraft)
        if interaction_type in ['click', 'select', 'info_check'] and target in self.aircraft:
            self.manual_checks.append((self.elapsed_time, target))
            print(f"  Manual check: {target} at T+{self.elapsed_time:.1f}s")

        # Check if system crash was detected
        if not self.measurements['system_monitoring']['crash_detected'] and self.system_crash_time:
            if interaction_type in ['system_check', 'tcas_check', 'indicator_check']:
                self.measurements['system_monitoring']['crash_detected'] = True
                self.measurements['system_monitoring']['crash_detection_time'] = self.elapsed_time
                self.measurements['system_monitoring']['crash_detection_delay'] = (
                    self.elapsed_time - self.system_crash_time
                )
                print(f"  System crash DETECTED at T+{self.elapsed_time:.1f}s")
                print(f"  Detection delay: {self.measurements['system_monitoring']['crash_detection_delay']:.1f}s")

        # Check if conflict was manually detected
        if self.conflict_threshold_reached and not self.conflict_detected_manually:
            # Check if interaction involves conflict aircraft
            if target in ['DAL456', 'JBU567'] or 'separation' in str(data).lower():
                measurement = self.measurements['conflict_detection']
                measurement['detected_manually'] = True
                measurement['detection_time'] = self.elapsed_time
                measurement['detection_delay'] = (
                    self.elapsed_time - measurement['conflict_start_time']
                )
                self.conflict_detected_manually = True

                print(f"  Conflict MANUALLY DETECTED at T+{self.elapsed_time:.1f}s")
                print(f"  Detection delay: {measurement['detection_delay']:.1f}s")

            # Check if action was taken
            if interaction_type in ['vector', 'altitude_change', 'command', 'clearance']:
                if target in ['DAL456', 'JBU567']:
                    measurement = self.measurements['conflict_detection']
                    if measurement['action_time'] is None:
                        measurement['action_taken'] = interaction_type
                        measurement['action_time'] = self.elapsed_time
                        print(f"  Action taken: {interaction_type} for {target}")

    def get_expected_detection_rates(self) -> Dict[str, Any]:
        """Get expected detection rates for performance comparison"""
        return {
            'manual_conflict_detection': {
                'condition_1_traditional': 0.70,  # 70% detection rate
                'condition_2_rule_based': 0.95,   # 95% detection rate
                'condition_3_ml': 0.98            # 98% detection rate
            },
            'system_crash_detection': {
                'condition_1_traditional': 0.40,  # Low detection of subtle indicator
                'condition_2_rule_based': 0.75,   # Better with vigilance prompts
                'condition_3_ml': 0.85            # Best with ML predictions
            },
            'expected_response_times': {
                'condition_1_traditional': 45.0,  # Seconds after conflict threshold
                'condition_2_rule_based': 20.0,
                'condition_3_ml': 10.0
            }
        }

    def analyze_performance(self) -> Dict[str, Any]:
        """Analyze controller performance against expected benchmarks"""

        conflict = self.measurements.get('conflict_detection', {})
        system = self.measurements.get('system_monitoring', {})
        behavioral = self.measurements.get('behavioral_metrics', {})
        expected = self.get_expected_detection_rates()

        # Calculate SAGAT accuracy
        sagat_scores = []
        for probe in self.sagat_probes:
            if probe.response:
                correct = 0
                total = len([q for q in probe.questions if 'correct_answer' in q])
                for q in probe.questions:
                    if q.get('correct_answer') == probe.response.get(q['id']):
                        correct += 1
                accuracy = correct / total if total > 0 else 0
                sagat_scores.append(accuracy)

        avg_sagat = sum(sagat_scores) / len(sagat_scores) if sagat_scores else 0

        analysis = {
            'scenario': 'L3',
            'condition': self.condition,
            'duration': self.elapsed_time,

            'conflict_detection': {
                'detected_manually': conflict.get('detected_manually', False),
                'detection_delay': conflict.get('detection_delay'),
                'action_taken': conflict.get('action_taken'),
                'expected_detection_rate': expected['manual_conflict_detection'].get(
                    f'condition_{self.condition}_traditional' if self.condition == 1
                    else f'condition_{self.condition}_rule_based' if self.condition == 2
                    else f'condition_{self.condition}_ml'
                ),
                'performance': 'excellent' if conflict.get('detected_manually') and conflict.get('detection_delay', 999) < 20
                              else 'good' if conflict.get('detected_manually') and conflict.get('detection_delay', 999) < 45
                              else 'needs_improvement'
            },

            'system_crash_awareness': {
                'detected': system.get('crash_detected', False),
                'detection_delay': system.get('crash_detection_delay'),
                'expected_detection_rate': expected['system_crash_detection'].get(
                    f'condition_{self.condition}_traditional' if self.condition == 1
                    else f'condition_{self.condition}_rule_based' if self.condition == 2
                    else f'condition_{self.condition}_ml'
                ),
                'performance': 'good' if system.get('crash_detected') else 'needs_improvement'
            },

            'behavioral_vigilance': {
                'avg_check_frequency': behavioral.get('manual_check_frequency', 0),
                'avg_scan_thoroughness': behavioral.get('scan_thoroughness', 0),
                'avg_vigilance_score': behavioral.get('vigilance_score', 0),
                'performance': 'excellent' if behavioral.get('vigilance_score', 0) >= 0.7
                              else 'good' if behavioral.get('vigilance_score', 0) >= 0.5
                              else 'needs_improvement'
            },

            'situation_awareness': {
                'sagat_average': avg_sagat,
                'probe_count': len(self.sagat_probes),
                'probes_completed': len([p for p in self.sagat_probes if p.response]),
                'performance': 'excellent' if avg_sagat >= 0.8 else 'good' if avg_sagat >= 0.6 else 'needs_improvement'
            },

            'overall_assessment': self._calculate_overall_assessment(
                conflict.get('detected_manually', False),
                conflict.get('detection_delay'),
                behavioral.get('vigilance_score', 0),
                avg_sagat
            )
        }

        return analysis

    def _calculate_overall_assessment(self, conflict_detected, detection_delay, vigilance, sagat_score) -> str:
        """Calculate overall performance assessment"""

        # Score components (0-100)
        conflict_score = 100 if conflict_detected and detection_delay and detection_delay < 20 else \
                        70 if conflict_detected and detection_delay and detection_delay < 45 else \
                        40 if conflict_detected else 0

        vigilance_pct = vigilance * 100
        sagat_pct = sagat_score * 100

        # Weighted average (conflict detection is most important)
        overall = (conflict_score * 0.5 + vigilance_pct * 0.3 + sagat_pct * 0.2)

        if overall >= 85:
            return 'Excellent - Manual conflict detection with high vigilance'
        elif overall >= 70:
            return 'Good - Adequate vigilance and conflict detection'
        elif overall >= 55:
            return 'Adequate - Some vigilance maintained'
        else:
            return 'Needs Improvement - Low vigilance or missed conflict'


# Demo/Test function
if __name__ == '__main__':
    print("=" * 70)
    print("SCENARIO L3 DEMO")
    print("=" * 70)

    # Initialize scenario
    scenario = ScenarioL3('demo-session', condition=3)
    info = scenario.get_scenario_info()

    print(f"\nScenario: {info['name']}")
    print(f"Duration: {info['duration_seconds']}s ({info['duration_seconds']//60} minutes)")
    print(f"Aircraft: {info['aircraft_count']}")

    # Initialize
    scenario.initialize()

    print(f"\n{'='*70}")
    print("INITIALIZATION COMPLETE")
    print(f"{'='*70}")
    print(f"Aircraft: {list(scenario.aircraft.keys())}")
    print(f"Events: {len(scenario.events)}")
    print(f"SAGAT Probes: {len(scenario.sagat_probes)}")
    print(f"\nExpected Detection Rates:")
    for key, rates in scenario.get_expected_detection_rates().items():
        print(f"  {key}:")
        if isinstance(rates, dict):
            for cond, rate in rates.items():
                if isinstance(rate, float) and rate < 1:
                    print(f"    {cond}: {rate:.0%}")
                else:
                    print(f"    {cond}: {rate}")
