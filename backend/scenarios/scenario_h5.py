"""
Scenario H5: Compounded Stress / Multi-Crisis

WORKLOAD: High (9 aircraft, adjusted from 6-8)
DURATION: 6 minutes (360 seconds)

PHASE 1 (T+0:00 to T+1:12): Weather Rerouting (Building Stress)
- 9 aircraft: UAL100, DAL200, AAL300, SWA400, UAL345, JBU500, AAL600, DAL700, UAL800
- Severe thunderstorm at (175, 125), radius 30nm
- All aircraft need rerouting around weather
- Northern route: narrow, limited capacity
- Southern route: adds 40nm to flight
- Controller already at MAXIMUM workload

PHASE 2 (T+1:12 to T+2:36): Fuel Emergency ON TOP of Weather
- UAL345 declares: "MAYDAY - FUEL EMERGENCY"
- Fuel remaining: 45 minutes (CRITICAL)
- Controller already managing 9 rerouting aircraft
- Must coordinate:
  * Emergency descent for UAL345
  * Divert to nearest airport
  * Continue managing weather reroutes
- Test: Can controller handle multiple simultaneous crises?

PHASE 3 (T+2:36 to end): Unauthorized Altitude Deviation
- AAL300 deviates from assigned altitude
- Assigned: FL310, Actual: FL330 (climbing through FL320)
- Reason: Pilot trying to avoid weather without clearance
- Creates conflict risk with other traffic at FL330
- Test: Will controller notice altitude deviation during emergency + weather?

KEY MEASUREMENTS:
- Response to altitude deviation (T+2:36 to detection)
- Parallel crisis management quality
- Attention distribution (fuel emergency vs. reroutes vs. altitude deviation)
- Expected Results:
  * Traditional: Poor parallel handling (sequential processing)
  * Rule-Based: Good (can see all aircraft)
  * ML: Best (highlights all at-risk areas)
"""

from typing import Dict, Any
from .base_scenario import BaseScenario


class ScenarioH5(BaseScenario):
    """
    H5: Compounded Stress / Multi-Crisis

    Tests whether controllers can manage multiple simultaneous crises:
    weather rerouting, fuel emergency, and altitude deviation.
    """
    duration = 360 # seconds

    @property
    def scenario_id(self) -> str:
        """Return scenario identifier"""
        return "H5"

    def get_scenario_info(self) -> Dict[str, Any]:
        """Get scenario metadata"""
        return {
            'scenario_id': 'H5',
            'name': 'Compounded Stress / Multi-Crisis',
            'workload': 'High',
            'aircraft_count': 9,
            'duration_seconds': 360,  # 6 minutes
            'duration_minutes': 6,
            'complexity': 'High',
            'description': 'High-workload multi-crisis scenario with weather rerouting, fuel emergency, and altitude deviation',
            'phases': [
                {
                    'phase': 1,
                    'name': 'Weather Rerouting (Building Stress)',
                    'start': 0,
                    'end': 72,  # 1:12
                    'description': '9 aircraft rerouting around severe thunderstorm'
                },
                {
                    'phase': 2,
                    'name': 'Fuel Emergency on Top of Weather',
                    'start': 72,
                    'end': 156,  # 2:36
                    'description': 'UAL345 fuel emergency while managing weather reroutes'
                },
                {
                    'phase': 3,
                    'name': 'Unauthorized Altitude Deviation',
                    'start': 156,
                    'end': 360,  # 6 minutes
                    'description': 'AAL300 altitude deviation during emergency + weather management'
                }
            ],
            'key_measurements': [
                'AAL300 altitude deviation detection time',
                'Parallel crisis management quality',
                'Attention distribution across crises',
                'SAGAT situation awareness scores'
            ],
            'weather_system': {
                'center': (175.0, 125.0),
                'radius': 30.0,
                'type': 'Severe thunderstorms, embedded hail',
                'effect': 'Blocks all direct routes through center'
            }
        }

    def initialize(self) -> None:
        """Initialize scenario H5"""
        print("Initializing Scenario H5: Compounded Stress / Multi-Crisis")

        # Initialize aircraft
        self._initialize_aircraft()

        # Schedule events
        self._schedule_events()

        # Setup SAGAT probes
        self._setup_sagat_probes()

        # Set phase descriptions
        self.phase_descriptions = [
            'Phase 1: Weather Rerouting (Building Stress)',
            'Phase 2: Fuel Emergency on Top of Weather (UAL345)',
            'Phase 3: Unauthorized Altitude Deviation (AAL300)'
        ]

        # Store weather system info
        self.weather_system = {
            'center': (175.0, 125.0),
            'radius': 30.0,
            'active': True
        }

        print(f"  Initialized {len(self.aircraft)} aircraft")
        print(f"  Scheduled {len(self.events)} events")
        print(f"  Configured {len(self.sagat_probes)} SAGAT probes")
        print(f"  Weather system: Center {self.weather_system['center']}, Radius {self.weather_system['radius']}nm")

    def _initialize_aircraft(self) -> None:
        """Initialize 9 aircraft with positions and parameters"""

        # UAL100: Northern route aircraft
        self.add_aircraft('UAL100', position=(100.0, 175.0), altitude=320, heading=15,
                          speed=450, route='LAX-SFO-northern', destination='SFO')

        # DAL200: Northern route aircraft
        self.add_aircraft('DAL200', position=(110.0, 170.0), altitude=330, heading=20,
                          speed=445, route='SAN-SEA-northern', destination='SEA')

        # AAL300: Southern route aircraft (WILL DEVIATE)
        self.add_aircraft('AAL300', position=(125.0, 100.0), altitude=310, heading=180,
                          speed=440, route='SFO-LAX-southern', destination='LAX')

        # SWA400: Southern route aircraft
        self.add_aircraft('SWA400', position=(120.0, 95.0), altitude=290, heading=185,
                          speed=450, route='OAK-SAN-southern', destination='SAN')

        # UAL345: Will declare fuel emergency
        self.add_aircraft('UAL345', position=(75.0, 125.0), altitude=280, heading=90,
                          speed=450, route='SEA-DEN', destination='DEN', fuel_remaining=60)

        # JBU500: Northern route aircraft
        self.add_aircraft('JBU500', position=(150.0, 160.0), altitude=300, heading=10,
                          speed=455, route='LAX-PDX-northern', destination='PDX')

        # AAL600: Near weather system
        self.add_aircraft('AAL600', position=(175.0, 150.0), altitude=340, heading=90,
                          speed=460, route='SFO-DEN', destination='DEN')

        # DAL700: Background traffic
        self.add_aircraft('DAL700', position=(50.0, 100.0), altitude=300, heading=45,
                          speed=445, route='LAX-SLC', destination='SLC')

        # UAL800: Background traffic
        self.add_aircraft('UAL800', position=(200.0, 125.0), altitude=320, heading=270,
                          speed=450, route='DEN-SFO', destination='SFO')

    def _schedule_events(self) -> None:
        """Schedule timed events for scenario"""

        # T+0:00: Weather system activation (immediate)
        self.add_event('weather', 0.0, target='system',
                       weather_type='severe_thunderstorm',
                       center=(175.0, 125.0),
                       radius=30.0,
                       severity='high',
                       priority='critical',
                       message='SEVERE WEATHER ALERT',
                       details={
                           'type': 'Severe thunderstorms, embedded hail',
                           'location': 'Center sector (175, 125)',
                           'radius': '30 nautical miles',
                           'effect': 'All aircraft must reroute',
                           'routes': {
                               'northern': 'Narrow, limited capacity',
                               'southern': 'Adds 40nm to flight'
                           }
                       })

        # Phase 1 -> Phase 2 transition (T+1:12 = 72s)
        self.add_event('phase_transition', 72.0, target='system', phase=2)

        # T+1:12 (72s): UAL345 declares FUEL EMERGENCY
        self.add_event('emergency', 72.0, target='UAL345',
                       emergency_type='FUEL EMERGENCY',
                       fuel_remaining=45,  # Critical - 45 minutes
                       priority='critical',
                       message='MAYDAY - FUEL EMERGENCY - UAL345',
                       details={
                           'fuel_remaining': '45 minutes',
                           'current_position': 'West of weather system',
                           'souls_on_board': 156,
                           'requesting': 'Immediate divert to nearest airport',
                           'context': 'On top of weather rerouting operations'
                       })

        # Phase 2 -> Phase 3 transition (T+2:36 = 156s)
        self.add_event('phase_transition', 156.0, target='system', phase=3)

        # T+2:36 (156s): AAL300 unauthorized altitude deviation
        self.add_event('altitude_deviation', 156.0, target='AAL300',
                       deviation_type='unauthorized_climb',
                       assigned_altitude=310,  # FL310
                       actual_altitude=320,  # FL320 (climbing through)
                       target_altitude=330,  # FL330 (unauthorized)
                       reason='Pilot avoiding weather without clearance',
                       conflict_risk=True,
                       traffic_at_fl330=['DAL200', 'AAL600'],
                       priority='high',
                       message='ALTITUDE DEVIATION - AAL300',
                       details={
                           'assigned': 'FL310',
                           'actual': 'Climbing through FL320 to FL330',
                           'reason': 'Unauthorized weather avoidance',
                           'risk': 'Conflict with traffic at FL330',
                           'required_action': 'Immediate descent clearance or separation assurance'
                       })

        # Create internal event to modify AAL300 altitude
        self.add_event('internal', 156.0, target='AAL300',
                       action='modify_altitude',
                       new_altitude=320)  # Climbing through FL320

        # ML PREDICTIONS (Condition 3 only) - predict events before they occur
        # Predict fuel emergency 50 seconds before it occurs (at T+22s, predicting T+72s)
        self.add_event('ml_prediction', 22.0, target='UAL345',
                       predicted_event='emergency',
                       predicted_time=72.0,
                       confidence=0.84,
                       reasoning='UAL345 fuel consumption rate elevated due to weather avoidance routing. Current reserves trending toward critical threshold.',
                       suggested_action_ids=['check_ual345_fuel', 'prepare_divert_options'])

        # Predict altitude deviation 50 seconds before it occurs (at T+106s, predicting T+156s)
        self.add_event('ml_prediction', 106.0, target='AAL300',
                       predicted_event='altitude_deviation',
                       predicted_time=156.0,
                       confidence=0.79,
                       reasoning='AAL300 pilot behavior pattern suggests potential unauthorized weather avoidance maneuver. Aircraft positioning inconsistent with assigned altitude.',
                       suggested_action_ids=['verify_aal300_altitude', 'confirm_clearance'])

    def _setup_sagat_probes(self) -> None:
        """Setup SAGAT situation awareness probes"""

        # Probe 1: T+1:00 (60s) - During weather rerouting phase
        self.add_sagat_probe(60.0, [
            {
                'id': 'p1_q1',
                'question': 'How many aircraft require rerouting due to weather?',
                'type': 'number',
                'correct_answer': 9,
                'explanation': 'All 9 aircraft need to avoid the weather system'
            },
            {
                'id': 'p1_q2',
                'question': 'Which route (north/south) has more traffic?',
                'type': 'multiple_choice',
                'options': ['North', 'South', 'Equal', 'Unknown'],
                'correct_answer': 'North',
                'explanation': 'Northern route has UAL100, DAL200, JBU500 (3), Southern has AAL300, SWA400 (2)'
            },
            {
                'id': 'p1_q3',
                'question': 'What is your current workload (1-10)?',
                'type': 'number',
                'correct_answer': None,  # Subjective
                'range': [1, 10],
                'explanation': 'Expected: 7-9 (very high workload)'
            }
        ])

        # Probe 2: T+2:18 (138s) - During fuel emergency + weather management
        self.add_sagat_probe(138.0, [
            {
                'id': 'p2_q1',
                'question': 'What is UAL345\'s emergency status?',
                'type': 'multiple_choice',
                'options': ['No emergency', 'Fuel emergency', 'Medical emergency', 'Engine failure'],
                'correct_answer': 'Fuel emergency',
                'critical': True
            },
            {
                'id': 'p2_q2',
                'question': 'How many aircraft are you currently managing?',
                'type': 'number',
                'correct_answer': 9,
                'explanation': 'All 9 aircraft require active management'
            },
            {
                'id': 'p2_q3',
                'question': 'Are all rerouted aircraft maintaining separation?',
                'type': 'multiple_choice',
                'options': ['Yes', 'No', 'Uncertain'],
                'correct_answer': None,  # Depends on controller actions
                'explanation': 'Controller should be monitoring separation'
            }
        ])

        # Probe 3: T+2:48 (168s) - After altitude deviation (CRITICAL for measurement)
        self.add_sagat_probe(168.0, [
            {
                'id': 'p3_q1',
                'question': 'Is AAL300 at its assigned altitude?',
                'type': 'multiple_choice',
                'options': ['Yes', 'No', 'Unknown'],
                'correct_answer': 'No',
                'critical': True,
                'explanation': 'AAL300 deviated from FL310 to FL330'
            },
            {
                'id': 'p3_q2',
                'question': 'What is AAL300\'s current altitude?',
                'type': 'text',
                'correct_answer': None,  # Should be aware of FL330 or climbing
                'critical': True,
                'explanation': 'AAL300 is at or near FL330 (unauthorized)'
            },
            {
                'id': 'p3_q3',
                'question': 'What corrective action is required?',
                'type': 'multiple_choice',
                'options': [
                    'None - altitude is correct',
                    'Descend to assigned altitude or ensure separation',
                    'Climb to higher altitude',
                    'Speed restriction'
                ],
                'correct_answer': 'Descend to assigned altitude or ensure separation',
                'critical': True
            }
        ])

    def _update_current_phase(self) -> None:
        """Update current phase based on elapsed time"""
        if self.elapsed_time < 72:
            self.current_phase = 0  # Phase 1: Weather Rerouting
        elif self.elapsed_time < 156:
            self.current_phase = 1  # Phase 2: Fuel Emergency on Top of Weather
        else:
            self.current_phase = 2  # Phase 3: Unauthorized Altitude Deviation

    def _trigger_event(self, event: Any) -> None:
        """Execute event actions (override to handle altitude deviation)"""
        # Call parent trigger first
        super()._trigger_event(event)

        # Handle altitude deviation
        if event.event_type == 'altitude_deviation' and event.target == 'AAL300':
            # Initialize measurement for altitude deviation detection
            measurement_key = f"{event.target}_altitude_deviation_detection"
            self.measurements[measurement_key] = {
                'deviation_time': self.elapsed_time,
                'assigned_altitude': event.data['assigned_altitude'],
                'actual_altitude': event.data['actual_altitude'],
                'target_altitude': event.data['target_altitude'],
                'detected_time': None,
                'corrected_time': None,
                'detection_delay': None,
                'correction_delay': None
            }
            print(f"  {event.target} altitude deviation: Assigned FL{event.data['assigned_altitude']}, "
                  f"Actual climbing to FL{event.data['target_altitude']}")

        elif event.event_type == 'internal' and event.data.get('action') == 'modify_altitude':
            # Modify aircraft altitude
            aircraft = self.aircraft.get(event.target)
            if aircraft:
                old_altitude = aircraft.altitude
                aircraft.altitude = event.data['new_altitude']
                print(f"  {event.target} altitude changed: FL{old_altitude} -> FL{aircraft.altitude}")

        elif event.event_type == 'weather':
            # Weather system is already stored in initialize()
            print(f"  Severe weather system active at {event.data['center']}, radius {event.data['radius']}nm")

    def check_parallel_crisis_overload(self) -> bool:
        """
        Check if controller is experiencing parallel crisis overload

        Returns True if managing multiple crises simultaneously.
        Used for adaptive alerts.
        """
        # Check if in Phase 2 or 3 (fuel emergency + weather, or all three crises)
        if self.current_phase < 1:
            return False

        # Phase 2: Weather rerouting + Fuel emergency = 2 crises
        # Phase 3: Weather rerouting + Fuel emergency + Altitude deviation = 3 crises
        return True

    def check_altitude_deviation_neglect(self) -> bool:
        """
        Check if AAL300 altitude deviation has been neglected

        Returns True if deviation not addressed > 20 seconds.
        """
        # Only relevant in Phase 3
        if self.current_phase < 2:
            return False

        measurement = self.measurements.get('AAL300_altitude_deviation_detection')
        if not measurement:
            return False

        # If not yet detected, check neglect duration
        if measurement['detected_time'] is None:
            time_since_deviation = self.elapsed_time - measurement['deviation_time']
            return time_since_deviation > 20  # Neglected if > 20 seconds

        return False

    def _check_measurement_resolution(self, interaction_type: str, target: str) -> None:
        """Check if interaction resolves any measurements (override to handle altitude deviation)"""
        # Call parent for comm loss handling
        super()._check_measurement_resolution(interaction_type, target)

        # Handle altitude deviation detection
        measurement_key = f"{target}_altitude_deviation_detection"
        measurement = self.measurements.get(measurement_key)

        if measurement:
            # First interaction with AAL300 = detection
            if measurement['detected_time'] is None:
                measurement['detected_time'] = self.elapsed_time
                measurement['detection_delay'] = self.elapsed_time - measurement['deviation_time']
                print(f"  Altitude deviation detected for {target} after {measurement['detection_delay']:.1f}s")

            # Altitude command or clearance = correction
            if measurement['corrected_time'] is None and interaction_type in ['altitude_command', 'command', 'clearance']:
                measurement['corrected_time'] = self.elapsed_time
                measurement['correction_delay'] = self.elapsed_time - measurement['deviation_time']
                print(f"  Altitude deviation corrected for {target} after {measurement['correction_delay']:.1f}s")

    def generate_condition_specific_alert(self, alert_type: str = 'multi_crisis') -> Dict[str, Any]:
        """
        Generate condition-specific alert for multi-crisis scenario

        Called when alerts should be shown based on condition rules.
        """
        # Handle fuel emergency alert (Phase 2)
        if alert_type == 'fuel_emergency' or self.current_phase == 1:
            is_overload = self.check_parallel_crisis_overload()

            if self.condition == 1:
                # Traditional: Full-screen modal (blocks weather reroutes from view)
                return self.generate_alert(
                    alert_type='emergency',
                    target='UAL345',
                    data={
                        'priority': 'critical',
                        'message': 'MAYDAY - FUEL EMERGENCY - UAL345\n\n45 minutes fuel remaining.\n156 souls on board.\n\nImmediate divert required!'
                    }
                )
            elif self.condition == 2:
                # Rule-Based: Banner keeps reroutes visible
                return self.generate_alert(
                    alert_type='emergency',
                    target='UAL345',
                    data={
                        'priority': 'critical',
                        'message': 'FUEL EMERGENCY: UAL345 - 45 min fuel, divert required',
                        'parallel_operations': True,
                        'keep_visible': ['weather_reroutes']
                    }
                )
            elif self.condition == 3:
                # ML: Banner + highlight UAL345 AND northern reroute cluster
                return self.generate_alert(
                    alert_type='emergency',
                    target='UAL345',
                    data={
                        'priority': 'critical',
                        'message': 'Fuel Emergency: UAL345',
                        'ml_prediction': {
                            'parallel_crisis_detected': True,
                            'workload_level': 'very_high',
                            'attention_distribution_risk': 'high',
                            'explanation': 'Fuel emergency during weather rerouting. Monitor all traffic.'
                        },
                        'confidence': 0.88,
                        'highlight_regions': [
                            {'aircraft': 'UAL345', 'severity': 'critical'},
                            {
                                'center': (120.0, 170.0),  # Northern reroute cluster
                                'radius': 40,
                                'severity': 'medium',
                                'label': 'Active Reroute Zone'
                            }
                        ]
                    }
                )

        # Handle altitude deviation alert (Phase 3)
        is_neglected = self.check_altitude_deviation_neglect()

        if self.condition == 1:
            # Traditional: Modal (may miss during emergency handling)
            return self.generate_alert(
                alert_type='altitude_deviation',
                target='AAL300',
                data={
                    'priority': 'high',
                    'message': 'ALTITUDE DEVIATION - AAL300\n\nAssigned: FL310\nActual: FL330\n\nUnauthorized climb - possible conflict!\n\nImmediate action required.'
                }
            )

        elif self.condition == 2:
            # Rule-Based: Banner + cue if neglected
            if is_neglected:
                return self.generate_alert(
                    alert_type='altitude_deviation',
                    target='AAL300',
                    data={
                        'priority': 'high',
                        'message': 'ALTITUDE DEVIATION - AAL300 (FL310→FL330)',
                        'peripheral_cue': True,
                        'conflict_risk': True,
                        'neglect_duration': self.elapsed_time - self.measurements['AAL300_altitude_deviation_detection']['deviation_time']
                    }
                )
            else:
                return self.generate_alert(
                    alert_type='altitude_deviation',
                    target='AAL300',
                    data={
                        'priority': 'high',
                        'message': 'AAL300 - Altitude Deviation (FL310→FL330)',
                        'peripheral_cue': False
                    }
                )

        elif self.condition == 3:
            # ML: Banner + highlight ALL crisis areas (UAL345, northern cluster, AAL300)
            return self.generate_alert(
                alert_type='altitude_deviation',
                target='AAL300',
                data={
                    'priority': 'high',
                    'message': 'Altitude Deviation: AAL300',
                    'ml_prediction': {
                        'multi_crisis_active': True,
                        'attention_fragmentation_risk': 0.85,
                        'sequential_processing_detected': True,
                        'explanation': 'Triple crisis: weather rerouting + fuel emergency + altitude deviation. '
                                     'Risk of sequential processing instead of parallel awareness.'
                    },
                    'confidence': 0.86,
                    'highlight_regions': [
                        {
                            'aircraft': 'UAL345',
                            'severity': 'critical',
                            'label': 'Fuel Emergency'
                        },
                        {
                            'center': (120.0, 170.0),  # Northern reroute cluster
                            'radius': 40,
                            'severity': 'medium',
                            'label': 'Weather Reroutes'
                        },
                        {
                            'aircraft': 'AAL300',
                            'severity': 'high',
                            'label': 'Altitude Deviation'
                        }
                    ]
                }
            )

        # Fallback
        return {}

    def get_expected_detection_times(self) -> Dict[str, float]:
        """
        Get expected altitude deviation detection times by condition

        Returns:
            Dictionary with expected times in seconds
        """
        return {
            'condition_1_traditional': 45.0,  # seconds - Poor (sequential processing)
            'condition_2_adaptive': 22.0,  # Good (can see all aircraft)
            'condition_3_ml': 15.0  # Best (highlights all at-risk areas)
        }

    def analyze_performance(self) -> Dict[str, Any]:
        """
        Analyze participant performance against expected benchmarks

        Returns comprehensive performance analysis including parallel crisis handling
        """
        altitude_measurement = self.measurements.get('AAL300_altitude_deviation_detection')

        if not altitude_measurement:
            return {
                'status': 'incomplete',
                'message': 'Altitude deviation event not yet triggered'
            }

        expected_times = self.get_expected_detection_times()
        condition_key = f'condition_{self.condition}_{"traditional" if self.condition == 1 else "adaptive" if self.condition == 2 else "ml"}'
        expected_detection = expected_times[condition_key]

        actual_detection = altitude_measurement.get('detection_delay')
        actual_correction = altitude_measurement.get('correction_delay')

        analysis = {
            'condition': self.condition,
            'scenario': 'H5',
            'expected_detection_time': expected_detection,
            'actual_detection_time': actual_detection,
            'actual_correction_time': actual_correction,
            'detection_performance': None,
            'correction_performance': None,
            'sagat_accuracy': self._calculate_sagat_accuracy(),
            'parallel_crisis_handling': None
        }

        if actual_detection is not None:
            # Calculate performance relative to expected
            detection_diff = actual_detection - expected_detection
            analysis['detection_performance'] = {
                'faster_than_expected': detection_diff < 0,
                'difference_seconds': detection_diff,
                'percentage': (detection_diff / expected_detection) * 100
            }

            # Parallel crisis handling indicator
            analysis['parallel_crisis_handling'] = {
                'quality': 'poor' if actual_detection > 40 else 'good' if actual_detection > 20 else 'excellent',
                'sequential_processing_detected': actual_detection > 35,
                'explanation': 'Long detection time suggests sequential crisis processing instead of parallel awareness'
            }

        if actual_correction is not None:
            # Correction typically 5-10 seconds after detection
            expected_correction = expected_detection + 7.5
            correction_diff = actual_correction - expected_correction
            analysis['correction_performance'] = {
                'faster_than_expected': correction_diff < 0,
                'difference_seconds': correction_diff,
                'total_time': actual_correction
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
    print("Scenario H5 Demo")
    print("=" * 60)

    # Create scenario
    scenario = ScenarioH5(session_id='demo_h5', condition=3)

    # Initialize
    scenario.start()

    # Print scenario info
    info = scenario.get_scenario_info()
    print(f"\nScenario: {info['name']}")
    print(f"Duration: {info['duration_minutes']} minutes")
    print(f"Aircraft: {info['aircraft_count']}")
    print(f"Workload: {info['workload']}")

    print(f"\nWeather System:")
    weather = info['weather_system']
    print(f"  Center: {weather['center']}")
    print(f"  Radius: {weather['radius']} nm")
    print(f"  Type: {weather['type']}")
    print(f"  Effect: {weather['effect']}")

    print(f"\nPhases:")
    for phase in info['phases']:
        print(f"  Phase {phase['phase']}: {phase['name']}")
        print(f"    Time: T+{phase['start']}s to T+{phase['end']}s")
        print(f"    {phase['description']}")

    print(f"\nKey Measurements:")
    for measurement in info['key_measurements']:
        print(f"  - {measurement}")

    print(f"\nExpected Altitude Deviation Detection Times:")
    expected = scenario.get_expected_detection_times()
    for condition, time in expected.items():
        print(f"  {condition}: {time}s")

    print(f"\nInitial Aircraft Positions (9 total):")
    print(f"  Weather Impact: All aircraft routing around center (175, 125)")
    print(f"  Critical Aircraft:")
    print(f"    UAL345 (Fuel Emergency): {scenario.aircraft['UAL345'].position}, FL{scenario.aircraft['UAL345'].altitude}")
    print(f"    AAL300 (Altitude Deviation): {scenario.aircraft['AAL300'].position}, FL{scenario.aircraft['AAL300'].altitude}")

    print("\n" + "=" * 60)
