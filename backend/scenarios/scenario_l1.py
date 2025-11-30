"""
Scenario L1: Baseline Emergency / Non-Routine Event

WORKLOAD: Low (5 aircraft)
DURATION: 6 minutes (360 seconds)

PHASE 1 (T+0:00 to T+0:36): Low-Density Routine
- 5 aircraft in routine flight
- Establish baseline vigilance

PHASE 2 (T+0:36 to T+2:36): Primary Emergency
- UAL238 declares DUAL emergency (low fuel + medical)
- High communication workload
- Expected: Controller fixates on UAL238

PHASE 3 (T+2:36 to end): Peripheral Comm Loss
- AAL119 loses comm AND data-link (silent failure)
- Test: Will controller notice peripheral failure during emergency?

KEY MEASUREMENTS:
- Detection time: T+2:36 to first interaction with AAL119
- Resolution time: Interaction to corrective command
- Expected Results:
  * Traditional: 42 seconds
  * Rule-Based: 20 seconds
  * ML: 14 seconds
"""

from typing import Dict, Any
from .base_scenario import BaseScenario, Aircraft, ScenarioEvent, SAGATProbe


class ScenarioL1(BaseScenario):
    """
    L1: Baseline Emergency / Non-Routine Event

    Tests whether controllers notice peripheral failures
    when fixated on primary emergency.
    """
    duration = 360 # seconds

    @property
    def scenario_id(self) -> str:
        """Return scenario identifier"""
        return "L1"

    def get_scenario_info(self) -> Dict[str, Any]:
        """Get scenario metadata"""
        return {
            'scenario_id': 'L1',
            'name': 'Baseline Emergency / Non-Routine Event',
            'workload': 'Low',
            'aircraft_count': 5,
            'duration_seconds': 360,  # 6 minutes
            'duration_minutes': 6,
            'complexity': 'Low',
            'description': 'Low-density scenario with dual emergency and peripheral comm loss',
            'phases': [
                {
                    'phase': 1,
                    'name': 'Low-Density Routine',
                    'start': 0,
                    'end': 36,
                    'description': 'Routine monitoring, 5 aircraft'
                },
                {
                    'phase': 2,
                    'name': 'Primary Emergency',
                    'start': 36,
                    'end': 156,
                    'description': 'UAL238 dual emergency (fuel + medical)'
                },
                {
                    'phase': 3,
                    'name': 'Peripheral Comm Loss',
                    'start': 156,
                    'end': 360,
                    'description': 'AAL119 silent comm/datalink failure'
                }
            ],
            'key_measurements': [
                'AAL119 comm loss detection time',
                'AAL119 comm loss resolution time',
                'SAGAT situation awareness scores'
            ]
        }

    def initialize(self) -> None:
        """Initialize scenario L1"""
        print("Initializing Scenario L1: Baseline Emergency")

        # Initialize aircraft
        self._initialize_aircraft()

        # Schedule events
        self._schedule_events()

        # Setup SAGAT probes
        self._setup_sagat_probes()

        # Set phase descriptions
        self.phase_descriptions = [
            'Phase 1: Low-Density Routine',
            'Phase 2: Primary Emergency (UAL238)',
            'Phase 3: Peripheral Comm Loss (AAL119)'
        ]

        print(f"  Initialized {len(self.aircraft)} aircraft")
        print(f"  Scheduled {len(self.events)} events")
        print(f"  Configured {len(self.sagat_probes)} SAGAT probes")

    def _initialize_aircraft(self) -> None:
        """Initialize 5 aircraft with positions and parameters"""
        # UAL238: Will declare emergency at T+1:30
        self.aircraft['UAL238'] = Aircraft(
            callsign='UAL238',
            position=(125.0, 150.0),
            altitude=280,  # FL280
            heading=90,  # East
            speed=450,
            route='ORD-JFK',
            destination='JFK',
            fuel_remaining=30  # Will drop to 15 during emergency
        )

        # SWA456: Normal operations
        self.aircraft['SWA456'] = Aircraft(
            callsign='SWA456',
            position=(75.0, 100.0),
            altitude=300,  # FL300
            heading=180,  # South
            speed=440,
            route='BOS-ATL',
            destination='ATL'
        )

        # DAL789: Normal operations
        self.aircraft['DAL789'] = Aircraft(
            callsign='DAL789',
            position=(175.0, 125.0),
            altitude=320,  # FL320
            heading=270,  # West
            speed=460,
            route='LAX-MIA',
            destination='MIA'
        )

        # AAL119: Will lose comm at T+6:30
        self.aircraft['AAL119'] = Aircraft(
            callsign='AAL119',
            position=(200.0, 175.0),
            altitude=310,  # FL310
            heading=180,  # South
            speed=445,
            route='SEA-DFW',
            destination='DFW'
        )

        # JBU321: Normal operations
        self.aircraft['JBU321'] = Aircraft(
            callsign='JBU321',
            position=(100.0, 75.0),
            altitude=290,  # FL290
            heading=45,  # Northeast
            speed=450,
            route='MCO-BOS',
            destination='BOS'
        )

    def _schedule_events(self) -> None:
        """Schedule timed events for scenario"""

        # Phase 1 -> Phase 2 transition (T+0:36 = 36s)
        self.events.append(ScenarioEvent(
            time_offset=36.0,
            event_type='phase_transition',
            target='system',
            data={'phase': 2}
        ))

        # T+0:36 (36s): UAL238 declares DUAL emergency
        self.events.append(ScenarioEvent(
            time_offset=36.0,
            event_type='emergency',
            target='UAL238',
            data={
                'emergency_type': 'FUEL + MEDICAL',
                'fuel_remaining': 15,  # Critical fuel
                'priority': 'critical',
                'message': 'FUEL + MEDICAL EMERGENCY - UAL238',
                'details': {
                    'fuel': '15 minutes remaining',
                    'medical': 'Passenger cardiac event',
                    'souls_on_board': 187,
                    'requesting': 'Priority landing JFK'
                }
            }
        ))

        # Phase 2 -> Phase 3 transition (T+2:36 = 156s)
        self.events.append(ScenarioEvent(
            time_offset=156.0,
            event_type='phase_transition',
            target='system',
            data={'phase': 3}
        ))

        # T+2:36 (156s): AAL119 loses comm AND datalink (silent failure)
        self.events.append(ScenarioEvent(
            time_offset=156.0,
            event_type='comm_loss',
            target='AAL119',
            data={
                'comm_status': 'lost',
                'datalink_status': 'lost',
                'type': 'silent_failure',
                'priority': 'high',
                'message': 'AAL119 - Comm Loss',
                'details': {
                    'last_contact': 'T+2:36',
                    'type': 'Dual failure (voice + data)'
                }
            }
        ))

    def _setup_sagat_probes(self) -> None:
        """Setup SAGAT situation awareness probes"""

        # Probe 1: T+1:00 (60s) - During emergency
        self.sagat_probes.append(SAGATProbe(
            time_offset=60.0,
            questions=[
                {
                    'id': 'p1_q1',
                    'question': 'How many aircraft are in your sector?',
                    'type': 'number',
                    'correct_answer': 5
                },
                {
                    'id': 'p1_q2',
                    'question': 'What is UAL238\'s altitude?',
                    'type': 'number',
                    'correct_answer': 280,
                    'unit': 'FL'
                },
                {
                    'id': 'p1_q3',
                    'question': 'Which aircraft is furthest north?',
                    'type': 'multiple_choice',
                    'options': ['UAL238', 'SWA456', 'DAL789', 'AAL119', 'JBU321'],
                    'correct_answer': 'AAL119'
                }
            ]
        ))

        # Probe 2: T+2:18 (138s) - Mid-emergency
        self.sagat_probes.append(SAGATProbe(
            time_offset=138.0,
            questions=[
                {
                    'id': 'p2_q1',
                    'question': 'What is UAL238\'s emergency status?',
                    'type': 'multiple_choice',
                    'options': ['Fuel only', 'Medical only', 'Fuel + Medical', 'No emergency'],
                    'correct_answer': 'Fuel + Medical'
                },
                {
                    'id': 'p2_q2',
                    'question': 'Which airport is UAL238 diverting to?',
                    'type': 'multiple_choice',
                    'options': ['ORD', 'JFK', 'LGA', 'EWR'],
                    'correct_answer': 'JFK'
                },
                {
                    'id': 'p2_q3',
                    'question': 'How many other aircraft require attention?',
                    'type': 'number',
                    'correct_answer': 0,
                    'explanation': 'All other aircraft are routine'
                }
            ]
        ))

        # Probe 3: T+2:48 (168s) - After comm loss (CRITICAL for measurement)
        self.sagat_probes.append(SAGATProbe(
            time_offset=168.0,
            questions=[
                {
                    'id': 'p3_q1',
                    'question': 'What is AAL119\'s communication status?',
                    'type': 'multiple_choice',
                    'options': ['Normal', 'Degraded', 'Lost', 'Unknown'],
                    'correct_answer': 'Lost',
                    'critical': True  # Key measurement for awareness
                },
                {
                    'id': 'p3_q2',
                    'question': 'How many aircraft have active comm links?',
                    'type': 'number',
                    'correct_answer': 4,
                    'explanation': 'All except AAL119'
                },
                {
                    'id': 'p3_q3',
                    'question': 'What action is required for AAL119?',
                    'type': 'multiple_choice',
                    'options': [
                        'None - normal operations',
                        'Attempt re-contact on guard frequency',
                        'Clear for landing',
                        'Issue altitude restriction'
                    ],
                    'correct_answer': 'Attempt re-contact on guard frequency',
                    'critical': True
                }
            ]
        ))

    def _update_current_phase(self) -> None:
        """Update current phase based on elapsed time"""
        if self.elapsed_time < 36:
            self.current_phase = 0  # Phase 1: Routine
        elif self.elapsed_time < 156:
            self.current_phase = 1  # Phase 2: Emergency
        else:
            self.current_phase = 2  # Phase 3: Comm Loss

    def check_peripheral_neglect(self) -> bool:
        """
        Check if AAL119 has been neglected during emergency
        
        Returns True if AAL119 has been neglected > 30 seconds
        after comm loss. Used for adaptive alerts.
        """
        # Only relevant in Phase 3 (after comm loss)
        if self.current_phase < 2:
            return False

        # Check if comm loss measurement exists
        measurement = self.measurements.get('AAL119_comm_loss_detection')
        if not measurement:
            return False

        # If not yet detected, check neglect duration
        if measurement['detected_time'] is None:
            time_since_loss = self.elapsed_time - measurement['loss_time']
            return time_since_loss > 30  # Neglected if > 30 seconds

        return False

    def generate_condition_specific_alert(self) -> Dict[str, Any]:
        """
        Generate condition-specific alert for comm loss
        
        Called when AAL119 comm loss should be alerted
        based on condition rules.
        """
        # Determine if neglect alert should be shown
        is_neglected = self.check_peripheral_neglect()

        if self.condition == 1:
            # Traditional: Full-screen modal immediately after emergency alert
            return self.generate_alert(
                alert_type='comm_loss',
                target='AAL119',
                data={
                    'priority': 'high',
                    'message': 'COMMUNICATION LOST - AAL119\n\nAircraft has lost voice and data-link communication.\nAttempt re-contact on guard frequency 121.5'
                }
            )

        elif self.condition == 2:
            # Rule-Based: Banner + peripheral cue if neglect > 30s
            if is_neglected:
                return self.generate_alert(
                    alert_type='comm_loss',
                    target='AAL119',
                    data={
                        'priority': 'high',
                        'message': 'AAL119 - Comm Loss (voice + data)',
                        'peripheral_cue': True,
                        'neglect_duration': self.elapsed_time - self.measurements['AAL119_comm_loss_detection']['loss_time']
                    }
                )
            else:
                # Subtle notification
                return self.generate_alert(
                    alert_type='comm_loss',
                    target='AAL119',
                    data={
                        'priority': 'medium',
                        'message': 'AAL119 - Comm Lost',
                        'peripheral_cue': False
                    }
                )

        elif self.condition == 3:
            # ML-Based: Banner + highlight AAL119 region if predict neglect
            # Use ML model to predict complacency/neglect
            ml_prediction = {
                'complacent': is_neglected,
                'complacency_score': 0.85 if is_neglected else 0.45,
                'confidence': 0.82,
                'explanation': 'Attention focused on UAL238 emergency. Risk of missing AAL119 status change.'
            }

            return self.generate_alert(
                alert_type='comm_loss',
                target='AAL119',
                data={
                    'priority': 'high' if is_neglected else 'medium',
                    'message': 'AAL119 - Communication Lost',
                    'ml_prediction': ml_prediction,
                    'confidence': 0.82,
                    'highlight_regions': [
                        {
                            'center': self.aircraft['AAL119'].position,
                            'radius': 20,  # NM
                            'severity': 'high' if is_neglected else 'medium'
                        }
                    ]
                }
            )

        # Fallback
        return {}

    def get_expected_detection_times(self) -> Dict[str, float]:
        """
        Get expected detection times by condition
        
        Returns:
            Dictionary with expected times in seconds
        """
        return {
            'condition_1_traditional': 42.0,  # seconds
            'condition_2_adaptive': 20.0,
            'condition_3_ml': 14.0
        }

    def analyze_performance(self) -> Dict[str, Any]:
        """
        Analyze participant performance against expected benchmarks
        
        Returns comprehensive performance analysis
        """
        measurement = self.measurements.get('AAL119_comm_loss_detection')
        
        if not measurement:
            return {
                'status': 'incomplete',
                'message': 'Comm loss event not yet triggered'
            }

        expected_times = self.get_expected_detection_times()
        condition_key = f'condition_{self.condition}_{"traditional" if self.condition == 1 else "adaptive" if self.condition == 2 else "ml"}'
        expected_detection = expected_times[condition_key]

        actual_detection = measurement.get('detection_delay')
        actual_resolution = measurement.get('resolution_delay')

        analysis = {
            'condition': self.condition,
            'expected_detection_time': expected_detection,
            'actual_detection_time': actual_detection,
            'actual_resolution_time': actual_resolution,
            'detection_performance': None,
            'resolution_performance': None,
            'sagat_accuracy': self._calculate_sagat_accuracy()
        }

        if actual_detection is not None:
            # Calculate performance relative to expected
            detection_diff = actual_detection - expected_detection
            analysis['detection_performance'] = {
                'faster_than_expected': detection_diff < 0,
                'difference_seconds': detection_diff,
                'percentage': (detection_diff / expected_detection) * 100
            }

        if actual_resolution is not None:
            # Resolution typically 5-10 seconds after detection
            expected_resolution = expected_detection + 7.5  # midpoint
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

                    if user_answer == correct_answer:
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
    print("Scenario L1 Demo")
    print("=" * 60)

    # Create scenario
    scenario = ScenarioL1(session_id='demo_001', condition=2)
    
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
    
    print(f"\nExpected Detection Times:")
    expected = scenario.get_expected_detection_times()
    for condition, time in expected.items():
        print(f"  {condition}: {time}s")
    
    print("\n" + "=" * 60)
