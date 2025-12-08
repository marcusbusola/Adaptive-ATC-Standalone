"""
Scenario L2: System Failure Overload / Irony of Automation

WORKLOAD: Low (5 aircraft)
DURATION: 6 minutes (360 seconds)

PHASE 1 (T+0:00 to T+1:12): Trust Building
- 5 aircraft operating normally
- Everything works perfectly
- High automation reliability
- Purpose: Build controller trust in system

PHASE 2 (T+1:12 to T+2:00): SILENT Communication Failure
- Frequency 119.5 MHz goes OFFLINE
- NO warning, NO alert (silent failure)
- Visual indicator: GREEN → RED (subtle, top right corner)
- Controller must discover failure themselves
- Tests: Irony of automation - reliable system fails silently

PHASE 3 (T+2:00 to end): VFR Intrusion
- Unauthorized VFR aircraft N456VF enters controlled airspace
- Position: (50, 100), FL240, climbing
- No transponder, unauthorized entry
- Tests: Can controller handle intruder during comm failure?

KEY MEASUREMENTS:
- Time to detect comm failure: T+1:12 to first detection
- Response to VFR intrusion
- Expected Results:
  * Traditional: Slow/variable detection (30-60s)
  * Rule-Based: Immediate detection at T+1:12
  * ML: Pre-failure prediction at T+1:06 (based on complacency)
"""

from typing import Dict, Any
from .base_scenario import BaseScenario, Aircraft, ScenarioEvent


class ScenarioL2(BaseScenario):
    """
    L2: System Failure Overload / Irony of Automation

    Tests controller's ability to detect silent automation failures
    and respond to emergencies while managing system degradation.
    """
    duration = 360 # seconds

    @property
    def scenario_id(self) -> str:
        """Return scenario identifier"""
        return "L2"

    def get_scenario_info(self) -> Dict[str, Any]:
        """Get scenario metadata"""
        return {
            'scenario_id': 'L2',
            'name': 'System Failure Overload / Irony of Automation',
            'workload': 'Low',
            'aircraft_count': 5,
            'duration_seconds': 360,  # 6 minutes
            'duration_minutes': 6,
            'phases': [
                {
                    'phase': 1,
                    'name': 'Trust Building',
                    'start': 0,
                    'end': 72,  # 1:12 minutes
                    'description': 'Everything works perfectly to build trust'
                },
                {
                    'phase': 2,
                    'name': 'Silent Communication Failure',
                    'start': 72,
                    'end': 120,  # 2:00 minutes
                    'description': 'Frequency 119.5 goes offline (no alert)'
                },
                {
                    'phase': 3,
                    'name': 'VFR Intrusion',
                    'start': 120,
                    'end': 360,  # 6 minutes
                    'description': 'Unauthorized VFR aircraft enters airspace'
                }
            ],
            'key_features': [
                'Silent automation failure',
                'Subtle visual indicator only',
                'VFR intrusion compound event',
                'Complacency detection'
            ]
        }

    def initialize(self) -> None:
        """Initialize scenario L2"""
        print(f"Initializing Scenario L2: System Failure / Irony of Automation")

        self._initialize_aircraft()
        self._schedule_events()
        self._setup_sagat_probes()

        # Initialize communication system state
        self.comm_system_status = 'operational'
        self.primary_frequency = 119.5
        self.backup_frequency = 121.5
        self.comm_failure_time = None
        self.comm_failure_detected = False
        self.vfr_intruder_spawned = False

        # Initialize measurements
        self.measurements['comm_failure_detection'] = {
            'failure_time': 72.0,  # T+1:12
            'detected_time': None,
            'detection_delay': None,
            'detection_method': None  # 'manual_check', 'comm_attempt', 'alert'
        }

        self.measurements['vfr_intrusion_response'] = {
            'intrusion_time': 120.0,  # T+2:00
            'detected_time': None,
            'first_action_time': None,
            'detection_delay': None,
            'action_delay': None
        }

        print(f"  Initialized {len(self.aircraft)} aircraft")
        print(f"  Scheduled {len(self.events)} events")
        print(f"  Configured {len(self.sagat_probes)} SAGAT probes")

    def _initialize_aircraft(self) -> None:
        """Initialize all aircraft for L2"""
        # UAL500: Northeast sector
        self.add_aircraft('UAL500', position=(100.0, 125.0), altitude=280, heading=90,
                          speed=450, route='DEN-EWR', destination='EWR', fuel_remaining=120)

        # SWA600: Southeast sector
        self.add_aircraft('SWA600', position=(150.0, 100.0), altitude=300, heading=180,
                          speed=445, route='PHX-MDW', destination='MDW', fuel_remaining=90)

        # AAL700: North sector
        self.add_aircraft('AAL700', position=(125.0, 175.0), altitude=320, heading=270,
                          speed=440, route='JFK-LAX', destination='LAX', fuel_remaining=180)

        # DAL800: Central-east sector
        self.add_aircraft('DAL800', position=(175.0, 150.0), altitude=310, heading=180,
                          speed=455, route='MSP-ATL', destination='ATL', fuel_remaining=140)

        # JBU900: Southwest sector
        self.add_aircraft('JBU900', position=(75.0, 75.0), altitude=290, heading=45,
                          speed=450, route='FLL-BOS', destination='BOS', fuel_remaining=110)

    def _schedule_events(self) -> None:
        """Schedule all timed events for L2"""
        # T+1:12 (72s): Phase 2 - Silent Communication Failure
        self.add_event('phase_transition', 72.0, target='system', phase=2,
                       description='Entering Phase 2: Silent Communication Failure')

        self.add_event('comm_failure', 72.0, target='system',
                       failure_type='silent',
                       affected_frequency=119.5,
                       backup_frequency=121.5,
                       visual_indicator='status_light',
                       indicator_change='GREEN → RED',
                       indicator_location='top_right_corner',
                       audio_alert=False,
                       modal_alert=False,
                       priority='high',
                       message='PRIMARY FREQUENCY 119.5 OFFLINE',
                       details={
                           'type': 'Silent failure - no alert',
                           'affected_systems': ['Voice communication on 119.5 MHz'],
                           'backup_available': 'Emergency frequency 121.5 MHz',
                           'detection_method': 'Controller must notice indicator change'
                       })

        # T+2:00 (120s): Phase 3 - VFR Intrusion
        self.add_event('phase_transition', 120.0, target='system', phase=3,
                       description='Entering Phase 3: VFR Intrusion')

        self.add_event('vfr_intrusion', 120.0, target='N456VF',
                       aircraft_type='VFR',
                       transponder=False,
                       unauthorized=True,
                       priority='critical',
                       message='VFR INTRUSION - N456VF UNAUTHORIZED ENTRY',
                       details={
                           'callsign': 'N456VF',
                           'initial_position': (50.0, 100.0),
                           'altitude': 240,
                           'heading': 90,
                           'speed': 120,
                           'climbing': True,
                           'rate_of_climb': 500,
                           'no_transponder': True,
                           'no_flight_plan': True,
                           'status': 'Unauthorized entry into controlled airspace'
                       })

        # ML PREDICTIONS (Condition 3 only) - predict events before they occur
        # Predict comm failure 50 seconds before it occurs (at T+22s, predicting T+72s)
        self.add_event('ml_prediction', 22.0, target='system',
                       predicted_event='comm_failure',
                       predicted_time=72.0,
                       confidence=0.78,
                       reasoning='Primary frequency 119.5 MHz showing signal degradation. Communication reliability decreasing, recommend monitoring status indicator.',
                       suggested_action_ids=['check_comm_status', 'prepare_backup_freq'])

        # Predict VFR intrusion 50 seconds before it occurs (at T+70s, predicting T+120s)
        self.add_event('ml_prediction', 70.0, target='N456VF',
                       predicted_event='vfr_intrusion',
                       predicted_time=120.0,
                       confidence=0.75,
                       reasoning='Radar detecting unidentified aircraft approaching controlled airspace boundary from southwest. Pattern consistent with VFR traffic.',
                       suggested_action_ids=['monitor_boundary', 'prepare_contact'])

    def _setup_sagat_probes(self) -> None:
        """Configure SAGAT probes for situation awareness measurement"""
        # Probe 1: T+1:00 (60s) - During trust building phase
        self.add_sagat_probe(60.0, [
            {'id': 'p1_q1', 'question': 'What is the primary communication frequency?',
             'type': 'number', 'correct_answer': 119.5, 'unit': 'MHz'},
            {'id': 'p1_q2', 'question': 'How many aircraft are on frequency?',
             'type': 'number', 'correct_answer': 5},
            {'id': 'p1_q3', 'question': 'What is the status of the communication system?',
             'type': 'multiple_choice',
             'options': ['Operational', 'Degraded', 'Failed', 'Unknown'],
             'correct_answer': 'Operational'}
        ])

        # Probe 2: T+2:18 (138s) - After comm failure and VFR intrusion
        self.add_sagat_probe(138.0, [
            {'id': 'p2_q1', 'question': 'Is the communication system operational?',
             'type': 'multiple_choice', 'options': ['Yes', 'No', 'Partially', 'Unknown'],
             'correct_answer': 'No'},
            {'id': 'p2_q2', 'question': 'How long has the system been offline (in seconds)?',
             'type': 'number', 'correct_answer': 66, 'tolerance': 10, 'unit': 'seconds'},
            {'id': 'p2_q3', 'question': 'What is the backup frequency?',
             'type': 'number', 'correct_answer': 121.5, 'unit': 'MHz'}
        ])

        # Probe 3: T+2:48 (168s) - During VFR intrusion management
        self.add_sagat_probe(168.0, [
            {'id': 'p3_q1', 'question': 'How many unauthorized aircraft are present?',
             'type': 'number', 'correct_answer': 1},
            {'id': 'p3_q2', 'question': "What is N456VF's approximate position?",
             'type': 'text', 'correct_answer': 'Southwest sector',
             'note': 'Accept general position descriptions'},
            {'id': 'p3_q3', 'question': 'What action is required for the VFR intrusion?',
             'type': 'multiple_choice',
             'options': ['Ignore - VFR are self-separating', 'Contact on emergency frequency',
                        'Vector other aircraft away', 'Both contact and vector', 'Declare emergency'],
             'correct_answer': 'Both contact and vector'}
        ])

    def _update_current_phase(self) -> None:
        """Update current phase based on elapsed time"""
        if self.elapsed_time < 72:
            self.current_phase = 0  # Phase 1: Trust Building
        elif self.elapsed_time < 120:
            self.current_phase = 1  # Phase 2: Silent Comm Failure
        else:
            self.current_phase = 2  # Phase 3: VFR Intrusion

    def _handle_comm_failure_event(self, event) -> None:
        """Handle silent communication failure"""
        self.comm_system_status = 'failed'
        self.comm_failure_time = self.elapsed_time

        print(f"  PRIMARY FREQUENCY 119.5 OFFLINE (SILENT FAILURE)")
        print(f"  Visual indicator: GREEN → RED (top right corner)")
        print(f"  No audio alert, no modal - controller must discover failure")

        # Record failure time in measurements
        self.measurements['comm_failure_detection']['failure_time'] = self.elapsed_time

        # For Condition 1 (Traditional): This is a SILENT failure - visual indicator only
        # Add presentation flag so frontend knows not to show a modal alert
        if self.condition == 1:
            event.data['presentation'] = 'visual_only'
            event.data['silent_failure'] = True
            print(f"  Condition 1: Silent failure - visual indicator only (no alert)")
        elif self.condition == 2:
            # Rule-based: May show alert after delay if not detected
            event.data['presentation'] = 'delayed_banner'
        # Condition 3 (ML) would have predicted this earlier

    def _handle_vfr_intrusion_event(self, event: ScenarioEvent) -> None:
        """Handle VFR intrusion"""
        # Spawn VFR aircraft
        details = event.data['details']
        self.aircraft['N456VF'] = Aircraft(
            callsign='N456VF',
            position=tuple(details['initial_position']),
            altitude=details['altitude'],
            heading=details['heading'],
            speed=details['speed'],
            emergency=False,
            comm_status='none',  # VFR, no comm established
            datalink_status='none',  # No transponder
            route=None,
            destination=None,
            fuel_remaining=None
        )

        self.vfr_intruder_spawned = True

        print(f"  VFR INTRUSION: N456VF entered controlled airspace")
        print(f"  Position: {details['initial_position']}, FL{details['altitude']}")
        print(f"  NO TRANSPONDER - Unauthorized entry")

        # Record intrusion time
        self.measurements['vfr_intrusion_response']['intrusion_time'] = self.elapsed_time

    def check_comm_failure_detected(self) -> bool:
        """Check if communication failure has been detected by controller"""
        if self.comm_failure_time is None:
            return False

        measurement = self.measurements.get('comm_failure_detection')
        if measurement and measurement['detected_time'] is not None:
            return True

        return False

    def record_interaction(self, interaction_type: str, target: str, data: Dict[str, Any]) -> None:
        """Record participant interaction (override to track detection)"""
        # Call parent to record interaction
        super().record_interaction(interaction_type, target, data)

        # Check if this interaction indicates comm failure detection
        if not self.comm_failure_detected and self.comm_failure_time is not None:
            # Check for comm system check or frequency change
            if interaction_type in ['comm_check', 'frequency_check', 'status_check']:
                self.comm_failure_detected = True
                measurement = self.measurements['comm_failure_detection']
                measurement['detected_time'] = self.elapsed_time
                measurement['detection_delay'] = self.elapsed_time - self.comm_failure_time
                measurement['detection_method'] = interaction_type

                print(f"  Comm failure DETECTED at T+{self.elapsed_time:.1f}s")
                print(f"  Detection delay: {measurement['detection_delay']:.1f}s")

        # Check for VFR intrusion response
        if self.vfr_intruder_spawned and target == 'N456VF':
            measurement = self.measurements['vfr_intrusion_response']

            if measurement['detected_time'] is None:
                measurement['detected_time'] = self.elapsed_time
                measurement['detection_delay'] = self.elapsed_time - measurement['intrusion_time']
                print(f"  VFR intrusion DETECTED at T+{self.elapsed_time:.1f}s")

            if measurement['first_action_time'] is None and interaction_type in ['command', 'vector', 'contact']:
                measurement['first_action_time'] = self.elapsed_time
                measurement['action_delay'] = self.elapsed_time - measurement['intrusion_time']
                print(f"  First action on VFR at T+{self.elapsed_time:.1f}s")

    def generate_condition_specific_alert(self, alert_type: str, target: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate condition-specific alerts for L2 events"""

        if alert_type == 'comm_failure':
            return self._generate_comm_failure_alert(data)
        elif alert_type == 'vfr_intrusion':
            return self._generate_vfr_intrusion_alert(data)
        else:
            # Use base alert generation
            return self.generate_alert(alert_type, target, data)

    def _generate_comm_failure_alert(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate alert for communication failure (condition-dependent)"""

        if self.condition == 1:
            # Traditional: NO ALERT for silent failure (that's the point!)
            # Only visual indicator change
            return self.generate_alert('comm_failure', 'system', {
                **data,
                'presentation': 'visual_only',
                'visual_indicator': 'status_light',
                'indicator_color': 'red',
                'blocking': False,
                'audio': False,
                'requires_acknowledgment': False
            })

        elif self.condition == 2:
            # Rule-Based: Alert if no comm attempts for 30s after failure
            time_since_failure = self.elapsed_time - (self.comm_failure_time or 0)

            if time_since_failure > 30 and not self.comm_failure_detected:
                return self.generate_alert('comm_failure', 'system', {
                    **data,
                    'presentation': 'banner',
                    'message': 'COMM CHECK RECOMMENDED - No activity on 119.5',
                    'priority': 'high',
                    'blocking': False,
                    'audio': True,
                    'adaptive_reason': 'No communication attempts detected'
                })
            else:
                # Just visual indicator
                return self.generate_alert('comm_failure', 'system', {
                    **data,
                    'presentation': 'visual_only',
                    'visual_indicator': 'status_light',
                    'indicator_color': 'red'
                })

        elif self.condition == 3:
            # ML: Predict complacency BEFORE failure (at T+1:06)
            # Or highlight comm status if failure already occurred

            if self.elapsed_time >= 66 and self.elapsed_time < 72:
                # Pre-failure warning based on complacency prediction
                ml_prediction = {
                    'complacent': True,
                    'complacency_score': 0.78,
                    'confidence': 0.85,
                    'explanation': 'High trust + low workload → complacency risk',
                    'predicted_issue': 'Potential missed system failure'
                }

                return self.generate_alert('complacency_warning', 'system', {
                    'message': 'System Check Recommended',
                    'priority': 'medium',
                    'ml_prediction': ml_prediction,
                    'highlight_regions': [{
                        'element': 'comm_status_indicator',
                        'reason': 'Monitor for changes'
                    }]
                })
            else:
                # Post-failure: Highlight comm status
                ml_prediction = {
                    'issue_detected': True,
                    'confidence': 0.92,
                    'explanation': 'Communication system offline'
                }

                return self.generate_alert('comm_failure', 'system', {
                    **data,
                    'message': 'PRIMARY FREQUENCY OFFLINE',
                    'priority': 'high',
                    'ml_prediction': ml_prediction,
                    'highlight_regions': [{
                        'element': 'comm_status_indicator',
                        'severity': 'high'
                    }, {
                        'element': 'frequency_display',
                        'severity': 'high'
                    }]
                })

    def _generate_vfr_intrusion_alert(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate alert for VFR intrusion (condition-dependent)"""

        if self.condition == 1:
            # Traditional: Full-screen modal
            return self.generate_alert('vfr_intrusion', 'N456VF', {
                **data,
                'presentation': 'modal',
                'blocking': True,
                'requires_acknowledgment': True,
                'audio': True
            })

        elif self.condition == 2:
            # Rule-Based: Banner (less intrusive during comm failure)
            return self.generate_alert('vfr_intrusion', 'N456VF', {
                **data,
                'presentation': 'banner',
                'blocking': False,
                'audio': True,
                'adaptive_reason': 'Banner style due to ongoing comm failure'
            })

        elif self.condition == 3:
            # ML: Banner + highlight VFR position
            aircraft_pos = self.aircraft.get('N456VF', {})
            position = getattr(aircraft_pos, 'position', (50, 100))

            ml_prediction = {
                'threat_level': 'high',
                'confidence': 0.95,
                'explanation': 'Unauthorized VFR in controlled airspace'
            }

            return self.generate_alert('vfr_intrusion', 'N456VF', {
                **data,
                'ml_prediction': ml_prediction,
                'highlight_regions': [{
                    'center': position,
                    'radius': 15,
                    'severity': 'critical',
                    'label': 'UNAUTHORIZED VFR'
                }]
            })

    def get_expected_detection_times(self) -> Dict[str, float]:
        """Get expected detection times for performance comparison"""
        return {
            'comm_failure': {
                'condition_1_traditional': 45.0,      # Slow, variable detection
                'condition_2_rule_based': 0.0,        # Immediate (at T+3:00)
                'condition_3_ml': -15.0               # Pre-failure at T+2:45
            },
            'vfr_intrusion': {
                'condition_1_traditional': 20.0,      # Modal catches attention
                'condition_2_rule_based': 15.0,       # Banner noticed quickly
                'condition_3_ml': 10.0                # Highlight speeds detection
            }
        }

    def analyze_performance(self) -> Dict[str, Any]:
        """Analyze controller performance against expected benchmarks"""

        comm_detection = self.measurements.get('comm_failure_detection', {})
        vfr_response = self.measurements.get('vfr_intrusion_response', {})
        expected = self.get_expected_detection_times()

        # Calculate SAGAT accuracy
        sagat_scores = []
        for probe in self.sagat_probes:
            if probe.response:
                correct = 0
                total = len(probe.questions)
                for q in probe.questions:
                    if q.get('correct_answer') == probe.response.get(q['id']):
                        correct += 1
                accuracy = correct / total if total > 0 else 0
                sagat_scores.append(accuracy)

        avg_sagat = sum(sagat_scores) / len(sagat_scores) if sagat_scores else 0

        analysis = {
            'scenario': 'L2',
            'condition': self.condition,
            'duration': self.elapsed_time,

            'comm_failure_detection': {
                'detected': comm_detection.get('detected_time') is not None,
                'detection_delay': comm_detection.get('detection_delay'),
                'expected_delay': expected['comm_failure'].get(f'condition_{self.condition}_traditional' if self.condition == 1 else f'condition_{self.condition}_rule_based' if self.condition == 2 else f'condition_{self.condition}_ml'),
                'performance': 'good' if comm_detection.get('detection_delay', 999) < 30 else 'adequate' if comm_detection.get('detection_delay', 999) < 60 else 'needs_improvement'
            },

            'vfr_intrusion_response': {
                'detected': vfr_response.get('detected_time') is not None,
                'detection_delay': vfr_response.get('detection_delay'),
                'action_delay': vfr_response.get('action_delay'),
                'expected_delay': expected['vfr_intrusion'].get(f'condition_{self.condition}_traditional' if self.condition == 1 else f'condition_{self.condition}_rule_based' if self.condition == 2 else f'condition_{self.condition}_ml'),
                'performance': 'good' if vfr_response.get('detection_delay', 999) < 20 else 'adequate' if vfr_response.get('detection_delay', 999) < 40 else 'needs_improvement'
            },

            'situation_awareness': {
                'sagat_average': avg_sagat,
                'probe_count': len(self.sagat_probes),
                'probes_completed': len([p for p in self.sagat_probes if p.response]),
                'performance': 'excellent' if avg_sagat >= 0.8 else 'good' if avg_sagat >= 0.6 else 'needs_improvement'
            },

            'overall_assessment': self._calculate_overall_assessment(
                comm_detection.get('detection_delay'),
                vfr_response.get('action_delay'),
                avg_sagat
            )
        }

        return analysis

    def _calculate_overall_assessment(self, comm_delay, vfr_delay, sagat_score) -> str:
        """Calculate overall performance assessment"""

        # Score components (0-100)
        # Handle None values for undetected events
        if comm_delay is None:
            comm_score = 0
        elif comm_delay < 30:
            comm_score = 100
        elif comm_delay < 60:
            comm_score = 70
        else:
            comm_score = 40

        if vfr_delay is None:
            vfr_score = 0
        elif vfr_delay < 20:
            vfr_score = 100
        elif vfr_delay < 40:
            vfr_score = 70
        else:
            vfr_score = 40

        sagat_pct = sagat_score * 100

        # Weighted average
        overall = (comm_score * 0.4 + vfr_score * 0.3 + sagat_pct * 0.3)

        if overall >= 85:
            return 'Excellent - Quick detection and high situation awareness'
        elif overall >= 70:
            return 'Good - Adequate response times and awareness'
        elif overall >= 55:
            return 'Adequate - Some delays in detection'
        else:
            return 'Needs Improvement - Significant delays or low awareness'


# Demo/Test function
if __name__ == '__main__':
    print("=" * 70)
    print("SCENARIO L2 DEMO")
    print("=" * 70)

    # Initialize scenario
    scenario = ScenarioL2('demo-session', condition=2)
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
    print(f"\nExpected Detection Times:")
    for key, times in scenario.get_expected_detection_times().items():
        print(f"  {key}:")
        for cond, time in times.items():
            print(f"    {cond}: {time}s")
