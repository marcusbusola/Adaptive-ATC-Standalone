"""
Scenario H4: Conflict-Driven Tunneling / VFR Intrusion

WORKLOAD: High (9 aircraft, reduced from 14-16)
DURATION: 6 minutes (360 seconds)

PHASE 1 (T+0:00 to T+2:00): High-Density Tactical Load
- 9 aircraft: DAL332, AAL908, UAL111, SWA222, JBU333, AAL444, DAL555, UAL666, SWA777
- High traffic, active tactical management
- Primary conflict: DAL332 and AAL908 converging at FL340
- Controller must issue tactical vectors to resolve
- Purpose: Induce conflict-driven cognitive tunneling

PHASE 2 (T+2:00 to T+2:36): Imminent Separation Violation
- DAL332 and AAL908 on COLLISION course
- Separation: 8 nm and closing rapidly
- Requires immediate tactical intervention:
  * DAL332: "Turn left heading 270, expedite"
  * AAL908: "Climb to FL360, maintain speed"
- Controller's full attention demanded
- Expected: Tactical fixation causes tunnel vision

PHASE 3 (T+2:36 to end): Peripheral VFR Intrusion
- VFR aircraft N123AB enters controlled airspace
- Position: (200, 50), FL65 (6,500 feet), climbing
- Squawking 1200 (VFR code)
- Not immediately threatening but violates boundaries
- Test: Will controller notice intruder during conflict management?

KEY MEASUREMENTS:
- Detection time for N123AB (T+2:36 to first interaction)
- Fixation duration on DAL332/AAL908
- Peripheral awareness during high workload
- Expected Results:
  * Traditional: 35 seconds
  * Rule-Based: 18 seconds
  * ML: 12 seconds
"""

from typing import Dict, Any
from datetime import datetime
from .base_scenario import BaseScenario


class ScenarioH4(BaseScenario):
    """
    H4: Conflict-Driven Tunneling / VFR Intrusion

    Tests whether controllers notice peripheral VFR intrusions
    when fixated on critical conflict resolution.
    """
    duration = 360 # seconds

    @property
    def scenario_id(self) -> str:
        """Return scenario identifier"""
        return "H4"

    def get_scenario_info(self) -> Dict[str, Any]:
        """Get scenario metadata"""
        return {
            'scenario_id': 'H4',
            'name': 'Conflict-Driven Tunneling / VFR Intrusion',
            'workload': 'High',
            'aircraft_count': 9,  # 9 IFR + 1 VFR that spawns later
            'duration_seconds': 360,  # 6 minutes
            'duration_minutes': 6,
            'complexity': 'High',
            'description': 'High-density scenario with critical conflict and peripheral VFR intrusion',
            'phases': [
                {
                    'phase': 1,
                    'name': 'High-Density Tactical Load',
                    'start': 0,
                    'end': 120,  # 2:00
                    'description': '9 aircraft, active management, conflict develops'
                },
                {
                    'phase': 2,
                    'name': 'Imminent Separation Violation',
                    'start': 120,
                    'end': 156,  # 2:36
                    'description': 'DAL332/AAL908 collision course, immediate action required'
                },
                {
                    'phase': 3,
                    'name': 'Peripheral VFR Intrusion',
                    'start': 156,
                    'end': 360,  # 6 minutes
                    'description': 'N123AB VFR intrusion during conflict management'
                }
            ],
            'key_measurements': [
                'N123AB VFR intrusion detection time',
                'DAL332/AAL908 conflict resolution time',
                'Fixation duration on primary conflict',
                'SAGAT situation awareness scores'
            ]
        }

    def initialize(self) -> None:
        """Initialize scenario H4"""
        print("Initializing Scenario H4: Conflict-Driven Tunneling / VFR Intrusion")

        # Initialize aircraft
        self._initialize_aircraft()

        # Schedule events
        self._schedule_events()

        # Setup SAGAT probes
        self._setup_sagat_probes()

        # Set phase descriptions
        self.phase_descriptions = [
            'Phase 1: High-Density Tactical Load',
            'Phase 2: Imminent Separation Violation (DAL332/AAL908)',
            'Phase 3: Peripheral VFR Intrusion (N123AB)'
        ]

        print(f"  Initialized {len(self.aircraft)} aircraft")
        print(f"  Scheduled {len(self.events)} events")
        print(f"  Configured {len(self.sagat_probes)} SAGAT probes")

    def _initialize_aircraft(self) -> None:
        """Initialize 9 aircraft with positions and parameters"""

        # DAL332: Primary conflict aircraft 1 (will conflict with AAL908)
        self.add_aircraft('DAL332', position=(100.0, 125.0), altitude=340, heading=90,
                          speed=460, route='ORD-BOS', destination='BOS')

        # AAL908: Primary conflict aircraft 2 (will conflict with DAL332)
        self.add_aircraft('AAL908', position=(175.0, 125.0), altitude=340, heading=270,
                          speed=460, route='BOS-ORD', destination='ORD')

        # UAL111: Background traffic
        self.add_aircraft('UAL111', position=(125.0, 175.0), altitude=320, heading=180,
                          speed=450, route='SEA-LAX', destination='LAX')

        # SWA222: Background traffic
        self.add_aircraft('SWA222', position=(75.0, 150.0), altitude=300, heading=45,
                          speed=445, route='PHX-DEN', destination='DEN')

        # JBU333: Background traffic
        self.add_aircraft('JBU333', position=(150.0, 100.0), altitude=360, heading=315,
                          speed=455, route='MCO-BOS', destination='BOS')

        # AAL444: Background traffic
        self.add_aircraft('AAL444', position=(50.0, 75.0), altitude=280, heading=135,
                          speed=450, route='MSP-ATL', destination='ATL')

        # DAL555: Background traffic
        self.add_aircraft('DAL555', position=(200.0, 175.0), altitude=310, heading=225,
                          speed=455, route='JFK-DFW', destination='DFW')

        # UAL666: Background traffic
        self.add_aircraft('UAL666', position=(175.0, 50.0), altitude=290, heading=90,
                          speed=450, route='LAX-IAH', destination='IAH')

        # SWA777: Background traffic
        self.add_aircraft('SWA777', position=(100.0, 200.0), altitude=330, heading=180,
                          speed=445, route='SEA-SAN', destination='SAN')

    def _schedule_events(self) -> None:
        """Schedule timed events for scenario"""

        # Phase 1 -> Phase 2 transition (T+2:00 = 120s)
        self.add_event('phase_transition', 120.0, target='system', phase=2)

        # T+2:00 (120s): Conflict becomes imminent
        # DAL332 and AAL908 are now 8 nm apart, closing rapidly
        self.add_event('conflict', 120.0, target='DAL332',
                       conflict_type='head_on_collision',
                       aircraft_1='DAL332',
                       aircraft_2='AAL908',
                       separation='8nm',
                       closure_rate='18nm/min',
                       time_to_conflict=240,  # 4 minutes without intervention
                       priority='critical',
                       message='TRAFFIC CONFLICT - DAL332/AAL908',
                       details={
                           'current_separation': '8 nm and closing rapidly',
                           'both_at': 'FL340',
                           'heading': 'head-on (090° vs 270°)',
                           'required_action': 'Immediate tactical intervention required',
                           'suggested_actions': [
                               'DAL332: Turn left heading 270, expedite',
                               'AAL908: Climb to FL360, maintain speed'
                           ]
                       })

        # Phase 2 -> Phase 3 transition (T+2:36 = 156s)
        self.add_event('phase_transition', 156.0, target='system', phase=3)

        # T+2:36 (156s): VFR aircraft N123AB enters controlled airspace
        self.add_event('aircraft_spawn', 156.0, target='N123AB',
                       aircraft_type='VFR_intrusion',
                       callsign='N123AB',
                       position=(200.0, 50.0),
                       altitude=65,  # FL65 = 6,500 feet
                       heading=0,  # North (climbing)
                       speed=120,  # Typical VFR speed
                       squawk='1200',  # VFR code
                       transponder='mode_c',
                       priority='high',
                       message='VFR INTRUSION - N123AB',
                       details={
                           'location': 'Southern sector, peripheral to conflict',
                           'altitude': '6,500 feet and climbing',
                           'status': 'Unauthorized entry into controlled airspace',
                           'threat_level': 'Not immediately threatening but violates boundaries',
                           'required_action': 'Contact and instruct to exit controlled airspace'
                       })

        # Create the aircraft when it spawns
        self.add_event('internal', 156.0, target='N123AB',
                       action='create_aircraft',
                       aircraft_data={
                           'callsign': 'N123AB',
                           'position': (200.0, 50.0),
                           'altitude': 65,
                           'heading': 0,
                           'speed': 120
                       })

        # ML PREDICTIONS (Condition 3 only) - predict events before they occur
        # Predict conflict 50 seconds before it becomes imminent (at T+70s, predicting T+120s)
        self.add_event('ml_prediction', 70.0, target='DAL332',
                       predicted_event='conflict',
                       predicted_time=120.0,
                       confidence=0.91,
                       reasoning='DAL332 and AAL908 trajectories converging at FL340. Current closure rate of 18nm/min indicates imminent conflict requiring tactical intervention.',
                       suggested_action_ids=['vector_dal332_left', 'climb_aal908'])

        # Predict VFR intrusion 50 seconds before spawn (at T+106s, predicting T+156s)
        self.add_event('ml_prediction', 106.0, target='N123AB',
                       predicted_event='aircraft_spawn',
                       predicted_time=156.0,
                       confidence=0.76,
                       reasoning='Primary radar detecting slow-moving target approaching southern sector boundary. Pattern suggests VFR aircraft may enter controlled airspace.',
                       suggested_action_ids=['monitor_south_sector', 'prepare_vfr_contact'])

    def _setup_sagat_probes(self) -> None:
        """Setup SAGAT situation awareness probes"""

        # Probe 1: T+1:00 (60s) - During high-density phase
        self.add_sagat_probe(60.0, [
            {
                'id': 'p1_q1',
                'question': 'How many aircraft are in your sector?',
                'type': 'number',
                'correct_answer': 9
            },
            {
                'id': 'p1_q2',
                'question': 'Are any aircraft on conflicting paths?',
                'type': 'multiple_choice',
                'options': ['Yes', 'No', 'Uncertain'],
                'correct_answer': 'Yes',
                'explanation': 'DAL332 and AAL908 are converging at FL340'
            },
            {
                'id': 'p1_q3',
                'question': 'What is your current workload level (1-10)?',
                'type': 'number',
                'correct_answer': None,  # Subjective
                'range': [1, 10]
            }
        ])

        # Probe 2: T+2:18 (138s) - During imminent conflict
        self.add_sagat_probe(138.0, [
            {
                'id': 'p2_q1',
                'question': 'What is the separation between DAL332 and AAL908?',
                'type': 'text',
                'correct_answer': None,  # Depends on controller actions
                'explanation': 'Should be monitoring separation closely'
            },
            {
                'id': 'p2_q2',
                'question': 'What vectors have you issued to resolve the conflict?',
                'type': 'text',
                'correct_answer': None,  # Depends on controller strategy
                'critical': True
            },
            {
                'id': 'p2_q3',
                'question': 'Are any other aircraft requiring attention?',
                'type': 'multiple_choice',
                'options': ['Yes', 'No', 'Uncertain'],
                'correct_answer': 'No',
                'explanation': 'Other 7 aircraft should be routine'
            }
        ])

        # Probe 3: T+2:48 (168s) - After VFR intrusion (CRITICAL for measurement)
        self.add_sagat_probe(168.0, [
            {
                'id': 'p3_q1',
                'question': 'How many unauthorized aircraft are in the sector?',
                'type': 'number',
                'correct_answer': 1,
                'critical': True,
                'explanation': 'N123AB VFR intrusion'
            },
            {
                'id': 'p3_q2',
                'question': 'What is N123AB\'s position and altitude?',
                'type': 'text',
                'correct_answer': None,  # Should be aware of southern sector, ~FL65-70
                'critical': True,
                'explanation': 'Tests awareness of peripheral VFR intrusion'
            },
            {
                'id': 'p3_q3',
                'question': 'What action is required for the VFR intrusion?',
                'type': 'multiple_choice',
                'options': [
                    'None - normal operations',
                    'Contact and instruct to exit controlled airspace',
                    'Issue immediate climb restriction',
                    'Declare emergency'
                ],
                'correct_answer': 'Contact and instruct to exit controlled airspace',
                'critical': True
            }
        ])

    def _update_current_phase(self) -> None:
        """Update current phase based on elapsed time"""
        if self.elapsed_time < 120:
            self.current_phase = 0  # Phase 1: High-Density Tactical Load
        elif self.elapsed_time < 156:
            self.current_phase = 1  # Phase 2: Imminent Separation Violation
        else:
            self.current_phase = 2  # Phase 3: Peripheral VFR Intrusion

    def _trigger_event(self, event: Any) -> None:
        """Execute event actions (override to handle VFR spawn)"""
        # Call parent trigger first
        super()._trigger_event(event)

        # Handle VFR aircraft spawn
        if event.event_type == 'aircraft_spawn' and event.target == 'N123AB':
            self._spawn_vfr_aircraft(event)
        elif event.event_type == 'internal' and event.data.get('action') == 'create_aircraft':
            aircraft_data = event.data['aircraft_data']
            self.add_aircraft(
                callsign=aircraft_data['callsign'],
                position=tuple(aircraft_data['position']),
                altitude=aircraft_data['altitude'],
                heading=aircraft_data['heading'],
                speed=aircraft_data['speed']
            )
            print(f"  VFR aircraft {aircraft_data['callsign']} entered controlled airspace")

            # Initialize measurement for VFR intrusion detection
            measurement_key = f"{aircraft_data['callsign']}_vfr_intrusion_detection"
            self.measurements[measurement_key] = {
                'intrusion_time': self.elapsed_time,
                'detected_time': None,
                'contacted_time': None,
                'detection_delay': None,
                'contact_delay': None
            }

    def _spawn_vfr_aircraft(self, event: Any) -> None:
        """Handle VFR aircraft spawn event"""
        # Aircraft already created by internal event, ensure metrics and alert are recorded
        measurement_key = f"{event.target}_vfr_intrusion_detection"
        if measurement_key not in self.measurements:
            self.measurements[measurement_key] = {
                'intrusion_time': self.elapsed_time,
                'detected_time': None,
                'contacted_time': None,
                'detection_delay': None,
                'contact_delay': None
            }

        # Generate a condition-specific alert so the intrusion surfaces to the UI/logs
        alert_payload = self.generate_condition_specific_alert(alert_type='vfr_intrusion')
        self.interactions.append({
            'time': self.elapsed_time,
            'type': 'system_alert',
            'target': event.target,
            'data': alert_payload,
            'timestamp': datetime.now().isoformat()
        })
        print(f"  VFR intrusion event logged for {event.target}")

    def check_peripheral_neglect_vfr(self) -> bool:
        """
        Check if N123AB VFR intrusion has been neglected

        Returns True if N123AB has been neglected > 30 seconds
        after intrusion. Used for adaptive alerts.
        """
        # Only relevant in Phase 3 (after VFR intrusion)
        if self.current_phase < 2:
            return False

        # Check if VFR intrusion measurement exists
        measurement = self.measurements.get('N123AB_vfr_intrusion_detection')
        if not measurement:
            return False

        # If not yet detected, check neglect duration
        if measurement['detected_time'] is None:
            time_since_intrusion = self.elapsed_time - measurement['intrusion_time']
            return time_since_intrusion > 30  # Neglected if > 30 seconds

        return False

    def _check_measurement_resolution(self, interaction_type: str, target: str) -> None:
        """Check if interaction resolves any measurements (override to handle VFR)"""
        # Call parent for comm loss handling
        super()._check_measurement_resolution(interaction_type, target)

        # Handle VFR intrusion detection
        measurement_key = f"{target}_vfr_intrusion_detection"
        measurement = self.measurements.get(measurement_key)

        if measurement:
            # First interaction with VFR aircraft = detection
            if measurement['detected_time'] is None:
                measurement['detected_time'] = self.elapsed_time
                measurement['detection_delay'] = self.elapsed_time - measurement['intrusion_time']
                print(f"  VFR intrusion detected for {target} after {measurement['detection_delay']:.1f}s")

            # Contact via radio = resolution
            if measurement['contacted_time'] is None and interaction_type in ['command', 'frequency_change', 'radio_contact']:
                measurement['contacted_time'] = self.elapsed_time
                measurement['contact_delay'] = self.elapsed_time - measurement['intrusion_time']
                print(f"  VFR intrusion resolved for {target} after {measurement['contact_delay']:.1f}s")

    def generate_condition_specific_alert(self, alert_type: str = 'vfr_intrusion') -> Dict[str, Any]:
        """
        Generate condition-specific alert for conflict and VFR intrusion

        Called when alerts should be shown based on condition rules.
        """
        # Handle conflict alert (Phase 2)
        if alert_type == 'conflict' or self.current_phase == 1:
            if self.condition == 1:
                # Traditional: Full-screen modal blocking view
                return self.generate_alert(
                    alert_type='conflict',
                    target='DAL332',
                    data={
                        'priority': 'critical',
                        'message': 'TRAFFIC CONFLICT - DAL332/AAL908\n\nHead-on collision course at FL340.\n8nm separation, closing at 18nm/min.\n\nImmediate action required!'
                    }
                )
            elif self.condition == 2:
                # Rule-Based: Banner with recommended actions
                return self.generate_alert(
                    alert_type='conflict',
                    target='DAL332',
                    data={
                        'priority': 'critical',
                        'message': 'Traffic Conflict: DAL332/AAL908 - FL340 - 8nm closing',
                        'recommended_actions': [
                            'DAL332: Turn left heading 270, expedite',
                            'AAL908: Climb to FL360, maintain speed'
                        ]
                    }
                )
            elif self.condition == 3:
                # ML: Banner with confidence and reasoning
                return self.generate_alert(
                    alert_type='conflict',
                    target='DAL332',
                    data={
                        'priority': 'critical',
                        'message': 'Traffic Conflict: DAL332/AAL908',
                        'ml_prediction': {
                            'conflict_probability': 0.96,
                            'time_to_conflict': 240,
                            'recommended_resolution': 'Turn DAL332 left, climb AAL908'
                        },
                        'confidence': 0.96,
                        'highlight_regions': [
                            {'aircraft': 'DAL332', 'severity': 'critical'},
                            {'aircraft': 'AAL908', 'severity': 'critical'}
                        ]
                    }
                )

        # Handle VFR intrusion alert (Phase 3)
        is_neglected = self.check_peripheral_neglect_vfr()

        if self.condition == 1:
            # Traditional: Modal alert (blocks view, may interfere with conflict management)
            return self.generate_alert(
                alert_type='vfr_intrusion',
                target='N123AB',
                data={
                    'priority': 'high',
                    'message': 'VFR INTRUSION - N123AB\n\nUnauthorized aircraft in controlled airspace.\nPosition: Southern sector, FL65, climbing.\nSquawk: 1200 (VFR)\n\nContact and instruct to exit immediately.'
                }
            )

        elif self.condition == 2:
            # Rule-Based: Banner + directional cue if peripheral neglect > 30s
            if is_neglected:
                return self.generate_alert(
                    alert_type='vfr_intrusion',
                    target='N123AB',
                    data={
                        'priority': 'high',
                        'message': 'VFR INTRUSION - N123AB (Southern Sector)',
                        'peripheral_cue': True,
                        'directional_indicator': 'south',
                        'neglect_duration': self.elapsed_time - self.measurements['N123AB_vfr_intrusion_detection']['intrusion_time']
                    }
                )
            else:
                return self.generate_alert(
                    alert_type='vfr_intrusion',
                    target='N123AB',
                    data={
                        'priority': 'medium',
                        'message': 'VFR Traffic - N123AB (FL65, southern sector)',
                        'peripheral_cue': False
                    }
                )

        elif self.condition == 3:
            # ML: Banner + highlight BOTH conflict pair AND southern sector (VFR region)
            # Predict tunnel vision and proactively highlight peripheral region
            return self.generate_alert(
                alert_type='vfr_intrusion',
                target='N123AB',
                data={
                    'priority': 'high' if is_neglected else 'medium',
                    'message': 'VFR Intrusion: N123AB',
                    'ml_prediction': {
                        'tunnel_vision_risk': 0.78,
                        'attention_on_conflict': True,
                        'peripheral_awareness_low': True,
                        'explanation': 'High workload on DAL332/AAL908 conflict. Risk of missing VFR intrusion in southern sector.'
                    },
                    'confidence': 0.82,
                    'highlight_regions': [
                        {
                            'aircraft': 'DAL332',
                            'severity': 'critical'
                        },
                        {
                            'aircraft': 'AAL908',
                            'severity': 'critical'
                        },
                        {
                            'center': (200.0, 50.0),  # VFR region
                            'radius': 30,  # NM
                            'severity': 'high' if is_neglected else 'medium',
                            'label': 'VFR Intrusion Zone'
                        }
                    ]
                }
            )

        # Fallback
        return {}

    def get_expected_detection_times(self) -> Dict[str, float]:
        """
        Get expected VFR intrusion detection times by condition

        Returns:
            Dictionary with expected times in seconds
        """
        return {
            'condition_1_traditional': 35.0,  # seconds
            'condition_2_adaptive': 18.0,
            'condition_3_ml': 12.0
        }

    def analyze_performance(self) -> Dict[str, Any]:
        """
        Analyze participant performance against expected benchmarks

        Returns comprehensive performance analysis
        """
        vfr_measurement = self.measurements.get('N123AB_vfr_intrusion_detection')

        if not vfr_measurement:
            return {
                'status': 'incomplete',
                'message': 'VFR intrusion event not yet triggered'
            }

        expected_times = self.get_expected_detection_times()
        condition_key = f'condition_{self.condition}_{"traditional" if self.condition == 1 else "adaptive" if self.condition == 2 else "ml"}'
        expected_detection = expected_times[condition_key]

        actual_detection = vfr_measurement.get('detection_delay')
        actual_contact = vfr_measurement.get('contact_delay')

        analysis = {
            'condition': self.condition,
            'scenario': 'H4',
            'expected_detection_time': expected_detection,
            'actual_detection_time': actual_detection,
            'actual_contact_time': actual_contact,
            'detection_performance': None,
            'contact_performance': None,
            'sagat_accuracy': self._calculate_sagat_accuracy(),
            'tunnel_vision_indicator': None
        }

        if actual_detection is not None:
            # Calculate performance relative to expected
            detection_diff = actual_detection - expected_detection
            analysis['detection_performance'] = {
                'faster_than_expected': detection_diff < 0,
                'difference_seconds': detection_diff,
                'percentage': (detection_diff / expected_detection) * 100
            }

            # Tunnel vision indicator: > 30s detection suggests fixation
            analysis['tunnel_vision_indicator'] = {
                'detected': actual_detection > 30,
                'severity': 'high' if actual_detection > 45 else 'medium' if actual_detection > 30 else 'low',
                'explanation': 'Long detection time suggests fixation on primary conflict'
            }

        if actual_contact is not None:
            # Contact typically 5-10 seconds after detection
            expected_contact = expected_detection + 7.5  # midpoint
            contact_diff = actual_contact - expected_contact
            analysis['contact_performance'] = {
                'faster_than_expected': contact_diff < 0,
                'difference_seconds': contact_diff,
                'total_time': actual_contact
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
    print("Scenario H4 Demo")
    print("=" * 60)

    # Create scenario
    scenario = ScenarioH4(session_id='demo_h4', condition=3)

    # Initialize
    scenario.start()

    # Print scenario info
    info = scenario.get_scenario_info()
    print(f"\nScenario: {info['name']}")
    print(f"Duration: {info['duration_minutes']} minutes")
    print(f"Aircraft: {info['aircraft_count']}")
    print(f"Workload: {info['workload']}")

    print(f"\nPhases:")
    for phase in info['phases']:
        print(f"  Phase {phase['phase']}: {phase['name']}")
        print(f"    Time: T+{phase['start']}s to T+{phase['end']}s")
        print(f"    {phase['description']}")

    print(f"\nKey Measurements:")
    for measurement in info['key_measurements']:
        print(f"  - {measurement}")

    print(f"\nExpected VFR Intrusion Detection Times:")
    expected = scenario.get_expected_detection_times()
    for condition, time in expected.items():
        print(f"  {condition}: {time}s")

    print(f"\nInitial Aircraft Positions:")
    print(f"  Conflict Pair:")
    print(f"    DAL332: {scenario.aircraft['DAL332'].position}, FL{scenario.aircraft['DAL332'].altitude}, HDG {scenario.aircraft['DAL332'].heading}°")
    print(f"    AAL908: {scenario.aircraft['AAL908'].position}, FL{scenario.aircraft['AAL908'].altitude}, HDG {scenario.aircraft['AAL908'].heading}°")
    print(f"  Background Traffic: 7 additional aircraft")

    print("\n" + "=" * 60)
