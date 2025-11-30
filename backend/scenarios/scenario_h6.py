"""
Scenario H6: Cry Wolf Effect / Alert Filtering

WORKLOAD: High (9 aircraft, reduced from 12-15)
DURATION: 6 minutes (360 seconds)

PHASE 1 (T+0:00 to T+5:00): Normal High-Workload Operations
- 9 aircraft: UAL100, SWA200, DAL300, AAL400, JBU500, UAL600, SWA700, DAL800, AAL900
- High traffic density, routine operations
- Conflict detection system active
- Purpose: Establish baseline trust in system

PHASE 2 (T+5:00 to T+6:00): FALSE ALARM - Conflict Alert
- System generates conflict alert: "WARNING - UAL600/SWA700 CONFLICT"
- Predicted separation: 4.2 nm at FL320
- BUT: This is a FALSE POSITIVE
- Actual separation: 6.8 nm (safe, no action needed)
- Controller investigates, realizes it's false
- Purpose: Degrade trust in alert system

PHASE 3 (T+6:30 to end): REAL Conflict (Unalerted or Delayed)
- Real conflict develops: DAL300 and AAL900
- Separation: 4.8 nm and decreasing (below 5 nm minimum)
- Alert is DELAYED by 20 seconds (system processing lag)
- Or: Alert labeled "Low Confidence 42%" (ML condition)
- Test: Does false positive reduce response to real alert?

KEY MEASUREMENTS:
- Response time to real conflict (T+6:30 to corrective action)
- Trust calibration (pre/post false alarm)
- Alert dismissal time (how quickly do they act on real alert?)
- Expected Results:
  * Traditional: Trust degraded, slow response (45s)
  * Rule-Based: Moderate degradation (28s)
  * ML: Confidence labels preserve trust (18s) - "This one is 94% confidence"
"""

from typing import Dict, Any
from .base_scenario import BaseScenario, Aircraft, ScenarioEvent, SAGATProbe


class ScenarioH6(BaseScenario):
    """
    H6: Cry Wolf Effect / Alert Filtering

    Tests whether controllers maintain appropriate trust in alert systems
    after experiencing false alarms (cry wolf effect).
    """
    duration = 360 # seconds

    @property
    def scenario_id(self) -> str:
        """Return scenario identifier"""
        return "H6"

    def get_scenario_info(self) -> Dict[str, Any]:
        """Get scenario metadata"""
        return {
            'scenario_id': 'H6',
            'name': 'Cry Wolf Effect / Alert Filtering',
            'workload': 'High',
            'aircraft_count': 9,
            'duration_seconds': 360,  # 15 minutes
            'duration_minutes': 6,
            'complexity': 'High',
            'description': 'High-workload scenario testing trust calibration after false alarm',
            'phases': [
                {
                    'phase': 1,
                    'name': 'Normal High-Workload Operations',
                    'start': 0,
                    'end': 120,  # 2:00
                    'description': '9 aircraft, routine operations, establish baseline trust'
                },
                {
                    'phase': 2,
                    'name': 'FALSE ALARM - Conflict Alert',
                    'start': 120,
                    'end': 156,  # 2:36
                    'description': 'UAL600/SWA700 false conflict alert (6.8nm actual, 4.2nm predicted)'
                },
                {
                    'phase': 3,
                    'name': 'REAL Conflict (Delayed Alert)',
                    'start': 156,
                    'end': 360,  # 6 minutes
                    'description': 'DAL300/AAL900 real conflict, alert delayed 20 seconds'
                }
            ],
            'key_measurements': [
                'False alarm detection and dismissal time',
                'Real conflict response time',
                'Trust calibration (pre/post false alarm)',
                'Alert dismissal time comparison',
                'SAGAT situation awareness scores'
            ],
            'trust_calibration': {
                'false_alarm_time': 300,  # T+5:00
                'false_alarm_pair': ['UAL600', 'SWA700'],
                'real_conflict_time': 390,  # T+6:30
                'real_conflict_pair': ['DAL300', 'AAL900'],
                'alert_delay': 20  # seconds
            }
        }

    def initialize(self) -> None:
        """Initialize scenario H6"""
        print("Initializing Scenario H6: Cry Wolf Effect / Alert Filtering")

        # Initialize aircraft
        self._initialize_aircraft()

        # Schedule events
        self._schedule_events()

        # Setup SAGAT probes
        self._setup_sagat_probes()

        # Set phase descriptions
        self.phase_descriptions = [
            'Phase 1: Normal High-Workload Operations',
            'Phase 2: FALSE ALARM - Conflict Alert (UAL600/SWA700)',
            'Phase 3: REAL Conflict - Delayed Alert (DAL300/AAL900)'
        ]

        # Trust calibration tracking
        self.trust_baseline = None
        self.trust_post_false_alarm = None

        print(f"  Initialized {len(self.aircraft)} aircraft")
        print(f"  Scheduled {len(self.events)} events")
        print(f"  Configured {len(self.sagat_probes)} SAGAT probes")

    def _initialize_aircraft(self) -> None:
        """Initialize 9 aircraft with positions and parameters"""

        # UAL100: Background traffic
        self.aircraft['UAL100'] = Aircraft(
            callsign='UAL100',
            position=(75.0, 125.0),
            altitude=300,  # FL300
            heading=90,  # East
            speed=450,
            route='SEA-DEN',
            destination='DEN'
        )

        # SWA200: Background traffic
        self.aircraft['SWA200'] = Aircraft(
            callsign='SWA200',
            position=(125.0, 175.0),
            altitude=320,  # FL320
            heading=180,  # South
            speed=445,
            route='PDX-LAX',
            destination='LAX'
        )

        # DAL300: Real conflict aircraft 1
        self.aircraft['DAL300'] = Aircraft(
            callsign='DAL300',
            position=(100.0, 100.0),
            altitude=310,  # FL310
            heading=135,  # Southeast
            speed=455,
            route='SFO-DFW',
            destination='DFW'
        )

        # AAL400: Background traffic
        self.aircraft['AAL400'] = Aircraft(
            callsign='AAL400',
            position=(175.0, 150.0),
            altitude=280,  # FL280
            heading=270,  # West
            speed=440,
            route='DEN-SFO',
            destination='SFO'
        )

        # JBU500: Background traffic
        self.aircraft['JBU500'] = Aircraft(
            callsign='JBU500',
            position=(150.0, 75.0),
            altitude=340,  # FL340
            heading=45,  # Northeast
            speed=460,
            route='LAX-BOS',
            destination='BOS'
        )

        # UAL600: False alarm aircraft 1
        self.aircraft['UAL600'] = Aircraft(
            callsign='UAL600',
            position=(50.0, 150.0),
            altitude=320,  # FL320
            heading=90,  # East
            speed=450,
            route='SEA-ORD',
            destination='ORD'
        )

        # SWA700: False alarm aircraft 2
        self.aircraft['SWA700'] = Aircraft(
            callsign='SWA700',
            position=(125.0, 140.0),
            altitude=320,  # FL320
            heading=270,  # West
            speed=445,
            route='DEN-SEA',
            destination='SEA'
        )

        # DAL800: Background traffic
        self.aircraft['DAL800'] = Aircraft(
            callsign='DAL800',
            position=(200.0, 100.0),
            altitude=300,  # FL300
            heading=225,  # Southwest
            speed=450,
            route='MSP-PHX',
            destination='PHX'
        )

        # AAL900: Real conflict aircraft 2
        self.aircraft['AAL900'] = Aircraft(
            callsign='AAL900',
            position=(175.0, 50.0),
            altitude=310,  # FL310
            heading=315,  # Northwest
            speed=455,
            route='LAX-SEA',
            destination='SEA'
        )

    def _schedule_events(self) -> None:
        """Schedule timed events for scenario"""

        # Phase 1 -> Phase 2 transition (T+5:00 = 300s)
        self.events.append(ScenarioEvent(
            time_offset=120.0,
            event_type='phase_transition',
            target='system',
            data={'phase': 2}
        ))

        # T+5:00 (300s): FALSE ALARM - Conflict alert UAL600/SWA700
        self.events.append(ScenarioEvent(
            time_offset=120.0,
            event_type='false_alarm',
            target='UAL600',
            data={
                'alert_type': 'false_conflict',
                'aircraft_1': 'UAL600',
                'aircraft_2': 'SWA700',
                'predicted_separation': '4.2 nm',
                'actual_separation': '6.8 nm',
                'altitude': 'FL320',
                'is_false_positive': True,
                'priority': 'high',
                'message': 'CONFLICT WARNING - UAL600/SWA700',
                'details': {
                    'predicted': '4.2 nm separation at T+6:00',
                    'reality': '6.8 nm separation (SAFE)',
                    'reason': 'System miscalculation',
                    'action_required': 'Investigation reveals false alarm'
                }
            }
        ))

        # Phase 2 -> Phase 3 transition (T+6:30 = 390s)
        self.events.append(ScenarioEvent(
            time_offset=156.0,
            event_type='phase_transition',
            target='system',
            data={'phase': 3}
        ))

        # T+6:30 (390s): REAL conflict develops DAL300/AAL900
        # But alert is DELAYED until T+6:50
        self.events.append(ScenarioEvent(
            time_offset=156.0,
            event_type='conflict',
            target='DAL300',
            data={
                'conflict_type': 'real_conflict',
                'aircraft_1': 'DAL300',
                'aircraft_2': 'AAL900',
                'separation': '4.8 nm',
                'minimum_separation': '5.0 nm',
                'altitude': 'FL310',
                'below_minimum': True,
                'priority': 'critical',
                'message': 'REAL CONFLICT - DAL300/AAL900',
                'alert_delayed': True,
                'alert_delay_seconds': 20,
                'details': {
                    'current_separation': '4.8 nm and decreasing',
                    'minimum_required': '5.0 nm',
                    'violation': 'Below minimum separation',
                    'required_action': 'Immediate correction required'
                }
            }
        ))

        # T+6:50 (410s): DELAYED alert for real conflict
        self.events.append(ScenarioEvent(
            time_offset=164.0,
            event_type='delayed_alert',
            target='DAL300',
            data={
                'alert_type': 'real_conflict_alert',
                'aircraft_1': 'DAL300',
                'aircraft_2': 'AAL900',
                'separation': '4.8 nm',
                'priority': 'critical',
                'delay_reason': 'system_processing_lag',
                'delay_duration': 20,
                'message': 'TRAFFIC CONFLICT - DAL300/AAL900',
                'details': {
                    'alert_delayed_by': '20 seconds',
                    'conflict_started': 'T+6:30',
                    'alert_time': 'T+6:50',
                    'separation': '4.8 nm (below minimum)',
                    'action_required': 'Immediate corrective action'
                }
            }
        ))

    def _setup_sagat_probes(self) -> None:
        """Setup SAGAT situation awareness probes"""

        # Probe 1: T+2:30 (150s) - Baseline during normal operations
        self.sagat_probes.append(SAGATProbe(
            time_offset=60.0,
            questions=[
                {
                    'id': 'p1_q1',
                    'question': 'How many conflict alerts have been generated?',
                    'type': 'number',
                    'correct_answer': 0,
                    'explanation': 'No alerts yet in Phase 1'
                },
                {
                    'id': 'p1_q2',
                    'question': 'What is your trust in the conflict detection system (1-10)?',
                    'type': 'number',
                    'correct_answer': None,  # Subjective baseline
                    'range': [1, 10],
                    'explanation': 'Baseline trust measurement'
                },
                {
                    'id': 'p1_q3',
                    'question': 'Are any aircraft currently on conflicting paths?',
                    'type': 'multiple_choice',
                    'options': ['Yes', 'No', 'Uncertain'],
                    'correct_answer': 'No',
                    'explanation': 'No conflicts in Phase 1'
                }
            ]
        ))

        # Probe 2: T+5:45 (345s) - After false alarm
        self.sagat_probes.append(SAGATProbe(
            time_offset=138.0,
            questions=[
                {
                    'id': 'p2_q1',
                    'question': 'Was the UAL600/SWA700 alert accurate?',
                    'type': 'multiple_choice',
                    'options': ['Yes - real conflict', 'No - false alarm', 'Uncertain'],
                    'correct_answer': 'No - false alarm',
                    'critical': True,
                    'explanation': 'Tests recognition of false positive'
                },
                {
                    'id': 'p2_q2',
                    'question': 'Has your trust in the system changed?',
                    'type': 'multiple_choice',
                    'options': ['Increased', 'Decreased', 'No change', 'Uncertain'],
                    'correct_answer': None,  # Subjective
                    'critical': True,
                    'explanation': 'Tests trust degradation after false alarm'
                },
                {
                    'id': 'p2_q3',
                    'question': 'Are you manually verifying conflicts?',
                    'type': 'multiple_choice',
                    'options': ['Yes', 'No', 'Sometimes'],
                    'correct_answer': None,  # Depends on controller behavior
                    'explanation': 'Tests behavior change after false alarm'
                }
            ]
        ))

        # Probe 3: T+7:00 (420s) - During real conflict (CRITICAL)
        self.sagat_probes.append(SAGATProbe(
            time_offset=168.0,
            questions=[
                {
                    'id': 'p3_q1',
                    'question': 'Is the DAL300/AAL900 conflict real?',
                    'type': 'multiple_choice',
                    'options': ['Yes - real conflict', 'No - false alarm', 'Uncertain'],
                    'correct_answer': 'Yes - real conflict',
                    'critical': True,
                    'explanation': 'Tests ability to distinguish real from false'
                },
                {
                    'id': 'p3_q2',
                    'question': 'What action have you taken?',
                    'type': 'text',
                    'correct_answer': None,  # Open-ended
                    'critical': True,
                    'explanation': 'Tests response to real conflict after false alarm'
                },
                {
                    'id': 'p3_q3',
                    'question': 'How confident are you in the current alert?',
                    'type': 'number',
                    'correct_answer': None,  # Subjective
                    'range': [1, 10],
                    'critical': True,
                    'explanation': 'Tests trust calibration'
                }
            ]
        ))

    def _update_current_phase(self) -> None:
        """Update current phase based on elapsed time"""
        if self.elapsed_time < 120:
            self.current_phase = 0  # Phase 1: Normal High-Workload Operations
        elif self.elapsed_time < 156:
            self.current_phase = 1  # Phase 2: FALSE ALARM
        else:
            self.current_phase = 2  # Phase 3: REAL Conflict (Delayed Alert)

    def _trigger_event(self, event: ScenarioEvent) -> None:
        """Execute event actions (override to handle false alarm and delayed alert)"""
        # Call parent trigger first
        super()._trigger_event(event)

        # Handle false alarm
        if event.event_type == 'false_alarm':
            # Initialize measurement for false alarm
            measurement_key = "false_alarm_UAL600_SWA700"
            self.measurements[measurement_key] = {
                'alarm_time': self.elapsed_time,
                'detected_as_false_time': None,
                'dismissed_time': None,
                'detection_delay': None,
                'dismissal_delay': None,
                'trust_impact': None
            }
            print(f"  FALSE ALARM: UAL600/SWA700 - Predicted 4.2nm, Actual 6.8nm")

        # Handle real conflict (no immediate alert)
        elif event.event_type == 'conflict' and event.data.get('alert_delayed'):
            # Initialize measurement for real conflict
            measurement_key = "real_conflict_DAL300_AAL900"
            self.measurements[measurement_key] = {
                'conflict_start_time': self.elapsed_time,
                'alert_time': None,  # Will be set when delayed alert triggers
                'detected_time': None,
                'resolved_time': None,
                'alert_delay': event.data['alert_delay_seconds'],
                'detection_delay': None,
                'resolution_delay': None,
                'post_false_alarm': True
            }
            print(f"  REAL CONFLICT: DAL300/AAL900 - 4.8nm (below 5nm minimum)")
            print(f"  Alert will be DELAYED by {event.data['alert_delay_seconds']} seconds")

        # Handle delayed alert trigger
        elif event.event_type == 'delayed_alert':
            # Update measurement with alert time
            measurement_key = "real_conflict_DAL300_AAL900"
            if measurement_key in self.measurements:
                self.measurements[measurement_key]['alert_time'] = self.elapsed_time
                print(f"  DELAYED ALERT NOW APPEARING: DAL300/AAL900 conflict")

    def check_trust_degradation(self) -> bool:
        """
        Check if trust has been degraded after false alarm

        Returns True if in Phase 2+ (after false alarm).
        Used for adaptive alert logic.
        """
        return self.current_phase >= 1

    def check_alert_dismissal_time(self) -> float:
        """
        Calculate alert dismissal time for real conflict

        Returns time from alert appearance to first action.
        """
        measurement = self.measurements.get('real_conflict_DAL300_AAL900')
        if not measurement:
            return 0.0

        alert_time = measurement.get('alert_time')
        detected_time = measurement.get('detected_time')

        if alert_time and detected_time:
            return detected_time - alert_time

        return 0.0

    def _check_measurement_resolution(self, interaction_type: str, target: str) -> None:
        """Check if interaction resolves any measurements (override to handle both conflicts)"""
        # Call parent for standard handling
        super()._check_measurement_resolution(interaction_type, target)

        # Handle false alarm detection
        false_alarm_key = "false_alarm_UAL600_SWA700"
        if false_alarm_key in self.measurements:
            measurement = self.measurements[false_alarm_key]

            # Interaction with either aircraft = investigation
            if target in ['UAL600', 'SWA700']:
                if measurement['detected_as_false_time'] is None:
                    measurement['detected_as_false_time'] = self.elapsed_time
                    measurement['detection_delay'] = self.elapsed_time - measurement['alarm_time']
                    print(f"  False alarm detected after {measurement['detection_delay']:.1f}s")

                if measurement['dismissed_time'] is None and interaction_type in ['dismiss', 'acknowledge', 'clear']:
                    measurement['dismissed_time'] = self.elapsed_time
                    measurement['dismissal_delay'] = self.elapsed_time - measurement['alarm_time']
                    print(f"  False alarm dismissed after {measurement['dismissal_delay']:.1f}s")

        # Handle real conflict detection
        real_conflict_key = "real_conflict_DAL300_AAL900"
        if real_conflict_key in self.measurements:
            measurement = self.measurements[real_conflict_key]

            # Interaction with either aircraft = detection/action
            if target in ['DAL300', 'AAL900']:
                # Detection (first interaction after alert appears)
                if measurement['detected_time'] is None and measurement.get('alert_time'):
                    measurement['detected_time'] = self.elapsed_time
                    measurement['detection_delay'] = self.elapsed_time - measurement['alert_time']
                    print(f"  Real conflict detected after alert: {measurement['detection_delay']:.1f}s")

                # Resolution (corrective command)
                if measurement['resolved_time'] is None and interaction_type in ['altitude_command', 'heading_command', 'command', 'vector']:
                    measurement['resolved_time'] = self.elapsed_time
                    measurement['resolution_delay'] = self.elapsed_time - measurement['conflict_start_time']
                    print(f"  Real conflict resolved: {measurement['resolution_delay']:.1f}s from conflict start")

    def generate_condition_specific_alert(self, alert_type: str = 'real_conflict') -> Dict[str, Any]:
        """
        Generate condition-specific alert for false alarm and real conflict

        Called when alerts should be shown based on condition rules.
        """
        # Handle false alarm alert (Phase 2)
        if alert_type == 'false_alarm' or self.current_phase == 1:
            if self.condition == 1:
                # Traditional: Standard conflict alert (no indication it's false)
                return self.generate_alert(
                    alert_type='conflict',
                    target='UAL600',
                    data={
                        'priority': 'high',
                        'message': 'CONFLICT WARNING - UAL600/SWA700\n\nPredicted separation: 4.2 nm at FL320\nTime to conflict: 1 minute\n\nInvestigate and take action!'
                    }
                )
            elif self.condition == 2:
                # Rule-Based: Standard alert (system doesn't know it's false yet)
                return self.generate_alert(
                    alert_type='conflict',
                    target='UAL600',
                    data={
                        'priority': 'high',
                        'message': 'Conflict Warning: UAL600/SWA700 - 4.2nm predicted at FL320'
                    }
                )
            elif self.condition == 3:
                # ML: Low confidence label (system suspects false alarm)
                return self.generate_alert(
                    alert_type='conflict',
                    target='UAL600',
                    data={
                        'priority': 'medium',
                        'message': 'Conflict Warning: UAL600/SWA700',
                        'ml_prediction': {
                            'conflict_probability': 0.38,
                            'confidence': 0.38,  # LOW confidence
                            'false_alarm_risk': 'high',
                            'explanation': 'Conflict detected but confidence is low (38%). Manual verification recommended.'
                        },
                        'confidence': 0.38,
                        'confidence_label': 'Low Confidence 38%',
                        'highlight_regions': [
                            {'aircraft': 'UAL600', 'severity': 'medium'},
                            {'aircraft': 'SWA700', 'severity': 'medium'}
                        ]
                    }
                )

        # Handle real conflict alert (Phase 3)
        trust_degraded = self.check_trust_degradation()

        if self.condition == 1:
            # Traditional: Same format as false alarm (no differentiation)
            return self.generate_alert(
                alert_type='conflict',
                target='DAL300',
                data={
                    'priority': 'critical',
                    'message': 'TRAFFIC CONFLICT - DAL300/AAL900\n\nSeparation: 4.8 nm (BELOW MINIMUM)\nAltitude: FL310\n\nImmediate action required!'
                }
            )

        elif self.condition == 2:
            # Rule-Based: Same format + adaptive cue if neglecting
            alert_data = {
                'priority': 'critical',
                'message': 'TRAFFIC CONFLICT - DAL300/AAL900 - 4.8nm (BELOW MIN)'
            }

            # Add peripheral cue if trust degraded and neglecting
            if trust_degraded and self.check_alert_dismissal_time() == 0:
                alert_data['peripheral_cue'] = True
                alert_data['trust_degraded'] = True
                alert_data['message'] += ' - VERIFY MANUALLY'

            return self.generate_alert(
                alert_type='conflict',
                target='DAL300',
                data=alert_data
            )

        elif self.condition == 3:
            # ML: HIGH confidence label (distinguishes from false alarm)
            return self.generate_alert(
                alert_type='conflict',
                target='DAL300',
                data={
                    'priority': 'critical',
                    'message': 'Traffic Conflict: DAL300/AAL900',
                    'ml_prediction': {
                        'conflict_probability': 0.94,
                        'confidence': 0.94,  # HIGH confidence
                        'false_alarm_risk': 'very_low',
                        'explanation': 'Real conflict detected with high confidence (94%). Immediate action required. '
                                     'Unlike previous alert (38% confidence), this is a verified threat.'
                    },
                    'confidence': 0.94,
                    'confidence_label': 'High Confidence 94%',
                    'highlight_regions': [
                        {'aircraft': 'DAL300', 'severity': 'critical'},
                        {'aircraft': 'AAL900', 'severity': 'critical'}
                    ],
                    'trust_calibration': {
                        'previous_alert_confidence': 0.38,
                        'current_alert_confidence': 0.94,
                        'recommendation': 'This alert is highly reliable - act immediately'
                    }
                }
            )

        # Fallback
        return {}

    def get_expected_detection_times(self) -> Dict[str, float]:
        """
        Get expected real conflict detection times by condition
        (after delayed alert appears)

        Returns:
            Dictionary with expected times in seconds
        """
        return {
            'condition_1_traditional': 45.0,  # Trust degraded, slow response
            'condition_2_adaptive': 28.0,  # Moderate degradation
            'condition_3_ml': 18.0  # Confidence labels preserve trust
        }

    def analyze_performance(self) -> Dict[str, Any]:
        """
        Analyze participant performance against expected benchmarks

        Returns comprehensive performance analysis including trust calibration
        """
        false_alarm_measurement = self.measurements.get('false_alarm_UAL600_SWA700')
        real_conflict_measurement = self.measurements.get('real_conflict_DAL300_AAL900')

        if not real_conflict_measurement:
            return {
                'status': 'incomplete',
                'message': 'Real conflict event not yet triggered'
            }

        expected_times = self.get_expected_detection_times()
        condition_key = f'condition_{self.condition}_{"traditional" if self.condition == 1 else "adaptive" if self.condition == 2 else "ml"}'
        expected_detection = expected_times[condition_key]

        actual_detection = real_conflict_measurement.get('detection_delay')
        actual_resolution = real_conflict_measurement.get('resolution_delay')

        analysis = {
            'condition': self.condition,
            'scenario': 'H6',
            'expected_detection_time': expected_detection,
            'actual_detection_time': actual_detection,
            'actual_resolution_time': actual_resolution,
            'detection_performance': None,
            'resolution_performance': None,
            'sagat_accuracy': self._calculate_sagat_accuracy(),
            'trust_calibration': None,
            'false_alarm_impact': None
        }

        # False alarm analysis
        if false_alarm_measurement:
            analysis['false_alarm_impact'] = {
                'detection_delay': false_alarm_measurement.get('detection_delay'),
                'dismissal_delay': false_alarm_measurement.get('dismissal_delay'),
                'recognized_as_false': false_alarm_measurement.get('detected_as_false_time') is not None
            }

        # Real conflict detection performance
        if actual_detection is not None:
            detection_diff = actual_detection - expected_detection
            analysis['detection_performance'] = {
                'faster_than_expected': detection_diff < 0,
                'difference_seconds': detection_diff,
                'percentage': (detection_diff / expected_detection) * 100,
                'post_false_alarm': True
            }

            # Trust calibration indicator
            analysis['trust_calibration'] = {
                'response_speed': 'slow' if actual_detection > 40 else 'moderate' if actual_detection > 25 else 'fast',
                'trust_preserved': actual_detection < 25,
                'cry_wolf_effect_detected': actual_detection > 35,
                'explanation': 'Slow response suggests trust degradation from false alarm' if actual_detection > 35 else 'Fast response suggests preserved trust'
            }

        # Resolution performance
        if actual_resolution is not None:
            expected_resolution = expected_detection + 7.5
            resolution_diff = actual_resolution - expected_resolution
            analysis['resolution_performance'] = {
                'faster_than_expected': resolution_diff < 0,
                'difference_seconds': resolution_diff,
                'total_time': actual_resolution
            }

        return analysis

    def _calculate_sagat_accuracy(self) -> Dict[str, Any]:
        """Calculate SAGAT probe accuracy"""
        total_questions = 0
        correct_answers = 0
        critical_correct = 0
        critical_total = 0

        for probe in self.sagat_probes:
            if probe.response:
                for question in probe.questions:
                    total_questions += 1
                    q_id = question['id']
                    user_answer = probe.response.get(q_id)
                    correct_answer = question.get('correct_answer')

                    # Skip subjective questions (correct_answer = None)
                    if correct_answer is not None and user_answer == correct_answer:
                        correct_answers += 1
                        if question.get('critical', False):
                            critical_correct += 1

                    if question.get('critical', False):
                        critical_total += 1

        return {
            'total_questions': total_questions,
            'correct_answers': correct_answers,
            'accuracy_percentage': (correct_answers / total_questions * 100) if total_questions > 0 else 0,
            'critical_questions': critical_total,
            'critical_correct': critical_correct,
            'critical_accuracy': (critical_correct / critical_total * 100) if critical_total > 0 else 0
        }


# Demo/test function
if __name__ == '__main__':
    print("Scenario H6 Demo")
    print("=" * 60)

    # Create scenario
    scenario = ScenarioH6(session_id='demo_h6', condition=3)

    # Initialize
    scenario.start()

    # Print scenario info
    info = scenario.get_scenario_info()
    print(f"\nScenario: {info['name']}")
    print(f"Duration: {info['duration_minutes']} minutes")
    print(f"Aircraft: {info['aircraft_count']}")
    print(f"Workload: {info['workload']}")

    print(f"\nTrust Calibration Test:")
    trust_cal = info['trust_calibration']
    print(f"  False Alarm: {trust_cal['false_alarm_pair']} at T+{trust_cal['false_alarm_time']}s")
    print(f"  Real Conflict: {trust_cal['real_conflict_pair']} at T+{trust_cal['real_conflict_time']}s")
    print(f"  Alert Delay: {trust_cal['alert_delay']} seconds")

    print(f"\nPhases:")
    for phase in info['phases']:
        print(f"  Phase {phase['phase']}: {phase['name']}")
        print(f"    Time: T+{phase['start']}s to T+{phase['end']}s")
        print(f"    {phase['description']}")

    print(f"\nKey Measurements:")
    for measurement in info['key_measurements']:
        print(f"  - {measurement}")

    print(f"\nExpected Real Conflict Detection Times (Post-False Alarm):")
    expected = scenario.get_expected_detection_times()
    for condition, time in expected.items():
        print(f"  {condition}: {time}s")

    print(f"\nInitial Aircraft Positions (9 total):")
    print(f"  False Alarm Pair (UAL600/SWA700):")
    print(f"    UAL600: {scenario.aircraft['UAL600'].position}, FL{scenario.aircraft['UAL600'].altitude}, HDG {scenario.aircraft['UAL600'].heading}°")
    print(f"    SWA700: {scenario.aircraft['SWA700'].position}, FL{scenario.aircraft['SWA700'].altitude}, HDG {scenario.aircraft['SWA700'].heading}°")
    print(f"  Real Conflict Pair (DAL300/AAL900):")
    print(f"    DAL300: {scenario.aircraft['DAL300'].position}, FL{scenario.aircraft['DAL300'].altitude}, HDG {scenario.aircraft['DAL300'].heading}°")
    print(f"    AAL900: {scenario.aircraft['AAL900'].position}, FL{scenario.aircraft['AAL900'].altitude}, HDG {scenario.aircraft['AAL900'].heading}°")

    print("\n" + "=" * 60)
