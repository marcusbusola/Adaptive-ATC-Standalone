/**
 * Scenario Actions Configuration
 *
 * Defines available ATC commands and expected actions for each scenario phase.
 * These are used by the ActionPanel component to guide operators and log responses.
 */

// Available command types
export const COMMAND_TYPES = {
  HEADING: 'heading_change',
  ALTITUDE: 'altitude_change',
  SPEED: 'speed_change',
  FREQUENCY: 'frequency_switch',
  CLEARANCE: 'clearance',
  EMERGENCY: 'emergency_response',
  CONTACT: 'radio_contact',
  INVESTIGATION: 'investigate'
};

// Common ATC commands available in all scenarios
export const COMMON_COMMANDS = [
  { id: 'heading', label: 'Assign Heading', type: COMMAND_TYPES.HEADING, icon: '↻' },
  { id: 'altitude', label: 'Assign Altitude', type: COMMAND_TYPES.ALTITUDE, icon: '↕' },
  { id: 'speed', label: 'Assign Speed', type: COMMAND_TYPES.SPEED, icon: '⏩' },
  { id: 'frequency', label: 'Switch Frequency', type: COMMAND_TYPES.FREQUENCY, icon: '📡' }
];

// Scenario-specific actions organized by scenario and phase
export const SCENARIO_ACTIONS = {
  L1: {
    name: 'Baseline Emergency / Non-Routine Event',
    description: 'Tests peripheral attention during primary emergency management',
    phases: {
      1: {
        name: 'Low-Density Routine Operations',
        context: 'Normal operations with 5 aircraft. Monitor for any unusual activity.',
        availableActions: [],
        expectedActions: []
      },
      2: {
        name: 'Primary Emergency - UAL238',
        context: 'UAL238 has declared DUAL EMERGENCY (low fuel + medical). 145 souls on board. Requesting immediate priority handling.',
        availableActions: [
          {
            id: 'priority_landing',
            label: 'Grant Priority Landing Clearance',
            target: 'UAL238',
            type: COMMAND_TYPES.CLEARANCE,
            command: 'UAL238, cleared ILS approach runway 28L, priority handling approved'
          },
          {
            id: 'emergency_services',
            label: 'Alert Emergency Services',
            target: 'ground',
            type: COMMAND_TYPES.EMERGENCY,
            command: 'Tower, request crash/fire/rescue standby runway 28L'
          },
          {
            id: 'traffic_coordination',
            label: 'Coordinate Traffic',
            target: 'all',
            type: COMMAND_TYPES.CLEARANCE,
            command: 'All aircraft, expect delays, emergency traffic inbound'
          }
        ],
        expectedActions: ['priority_landing']
      },
      3: {
        name: 'Peripheral Comm Loss - AAL119',
        context: 'While managing UAL238 emergency, AAL119 has stopped responding. Last position: FL310, SEA-DFW route. Possible NORDO situation.',
        availableActions: [
          {
            id: 'contact_guard',
            label: 'Contact AAL119 on Guard 121.5',
            target: 'AAL119',
            type: COMMAND_TYPES.CONTACT,
            command: 'AAL119, if you hear Los Angeles Center, contact on 121.5'
          },
          {
            id: 'squawk_ident',
            label: 'Request Squawk Ident',
            target: 'AAL119',
            type: COMMAND_TYPES.CONTACT,
            command: 'AAL119, squawk ident if receiver only'
          },
          {
            id: 'light_signals',
            label: 'Prepare Light Signals',
            target: 'AAL119',
            type: COMMAND_TYPES.EMERGENCY,
            command: 'Tower, prepare light gun signals for possible NORDO aircraft'
          }
        ],
        expectedActions: ['contact_guard']
      }
    }
  },

  L2: {
    name: 'System Failure Overload',
    description: 'Tests detection of silent automation failure and response to VFR intrusion',
    phases: {
      1: {
        name: 'Trust Building Phase',
        context: 'All systems operating normally. 5 aircraft on routine routes. Automation fully functional.',
        availableActions: [],
        expectedActions: []
      },
      2: {
        name: 'Silent Communication Failure',
        context: 'Primary frequency 119.5 MHz may have failed. Check status indicator (top right). No audio warning was given.',
        availableActions: [
          {
            id: 'switch_backup',
            label: 'Switch to Backup Frequency 121.5',
            target: 'system',
            type: COMMAND_TYPES.FREQUENCY,
            command: 'All aircraft, primary frequency failure, switch to 121.5'
          },
          {
            id: 'comm_check',
            label: 'Perform Comm Check',
            target: 'all',
            type: COMMAND_TYPES.CONTACT,
            command: 'All stations, Los Angeles Center, radio check on 121.5'
          },
          {
            id: 'verify_status',
            label: 'Verify System Status',
            target: 'system',
            type: COMMAND_TYPES.INVESTIGATION,
            command: 'Checking communication system status indicators'
          }
        ],
        expectedActions: ['switch_backup']
      },
      3: {
        name: 'VFR Intrusion - N456VF',
        context: 'Unauthorized VFR aircraft N456VF has entered Class A airspace without clearance. Squawking 1200, FL240, climbing.',
        availableActions: [
          {
            id: 'contact_vfr',
            label: 'Contact N456VF',
            target: 'N456VF',
            type: COMMAND_TYPES.CONTACT,
            command: 'N456VF, Los Angeles Center, you are in Class A airspace without clearance'
          },
          {
            id: 'instruct_exit',
            label: 'Instruct to Exit Airspace',
            target: 'N456VF',
            type: COMMAND_TYPES.CLEARANCE,
            command: 'N456VF, turn right heading 180, descend and exit Class A airspace immediately'
          },
          {
            id: 'traffic_alert',
            label: 'Issue Traffic Alert to IFR',
            target: 'all',
            type: COMMAND_TYPES.CONTACT,
            command: 'All aircraft, traffic alert, VFR aircraft in sector, exercise caution'
          }
        ],
        expectedActions: ['contact_vfr', 'instruct_exit']
      }
    }
  },

  L3: {
    name: 'Automation Complacency / Vigilance',
    description: 'Tests ability to detect unalerted conflict when automation fails silently',
    phases: {
      1: {
        name: 'Reliable Automation',
        context: 'Conflict detection system working perfectly. Minor alerts being auto-detected. 5 aircraft on station.',
        availableActions: [],
        expectedActions: []
      },
      2: {
        name: 'Silent System Crash',
        context: 'The TCAS/conflict detection system may have crashed. Check if "TCAS OK" indicator is still visible. Manual vigilance required.',
        availableActions: [
          {
            id: 'manual_scan',
            label: 'Perform Manual Traffic Scan',
            target: 'all',
            type: COMMAND_TYPES.INVESTIGATION,
            command: 'Initiating manual scan of all traffic for potential conflicts'
          },
          {
            id: 'verify_tcas',
            label: 'Verify TCAS Status',
            target: 'system',
            type: COMMAND_TYPES.INVESTIGATION,
            command: 'Checking TCAS system status indicator'
          }
        ],
        expectedActions: []
      },
      3: {
        name: 'Unalerted Conflict - DAL456/JBU567',
        context: 'DAL456 and JBU567 are converging at FL300. Current separation: 4.5nm (minimum is 5nm). NO automatic alert due to system crash.',
        availableActions: [
          {
            id: 'vector_dal456',
            label: 'DAL456: Turn Left Heading 090',
            target: 'DAL456',
            type: COMMAND_TYPES.HEADING,
            command: 'DAL456, turn left heading 090 immediately, traffic'
          },
          {
            id: 'altitude_jbu567',
            label: 'JBU567: Climb to FL320',
            target: 'JBU567',
            type: COMMAND_TYPES.ALTITUDE,
            command: 'JBU567, climb and maintain FL320 immediately'
          },
          {
            id: 'traffic_advisory',
            label: 'Issue Traffic Advisory',
            target: 'both',
            type: COMMAND_TYPES.CONTACT,
            command: 'DAL456, traffic 2 o\'clock, 5 miles, same altitude. JBU567, traffic 10 o\'clock'
          }
        ],
        expectedActions: ['vector_dal456', 'altitude_jbu567']
      }
    }
  },

  H4: {
    name: 'Conflict-Driven Tunneling / VFR Intrusion',
    description: 'Tests peripheral awareness during critical conflict resolution under high workload',
    phases: {
      1: {
        name: 'High-Density Tactical Load',
        context: 'Managing 9 IFR aircraft in high-density traffic. Multiple handoffs and sequencing operations.',
        availableActions: [],
        expectedActions: []
      },
      2: {
        name: 'Imminent Separation Violation - DAL332/AAL908',
        context: 'CRITICAL: DAL332 and AAL908 are converging at FL340. Separation 8nm and closing at 18nm/min. Immediate action required.',
        availableActions: [
          {
            id: 'vector_dal332',
            label: 'DAL332: Turn Left Heading 270',
            target: 'DAL332',
            type: COMMAND_TYPES.HEADING,
            command: 'DAL332, turn left heading 270 immediately, traffic'
          },
          {
            id: 'climb_aal908',
            label: 'AAL908: Climb to FL360',
            target: 'AAL908',
            type: COMMAND_TYPES.ALTITUDE,
            command: 'AAL908, climb and maintain FL360, expedite'
          },
          {
            id: 'traffic_both',
            label: 'Issue Traffic Advisory to Both',
            target: 'both',
            type: COMMAND_TYPES.CONTACT,
            command: 'Traffic advisory issued to DAL332 and AAL908'
          }
        ],
        expectedActions: ['vector_dal332', 'climb_aal908']
      },
      3: {
        name: 'Peripheral VFR Intrusion - N123AB',
        context: 'While managing IFR conflict, VFR aircraft N123AB has entered controlled airspace in the SOUTHERN sector. Do not lose awareness of peripheral traffic.',
        availableActions: [
          {
            id: 'contact_vfr',
            label: 'Contact N123AB on Guard',
            target: 'N123AB',
            type: COMMAND_TYPES.CONTACT,
            command: 'N123AB, Los Angeles Center on guard, you are in Class A airspace'
          },
          {
            id: 'instruct_exit',
            label: 'Instruct Immediate Descent/Exit',
            target: 'N123AB',
            type: COMMAND_TYPES.CLEARANCE,
            command: 'N123AB, descend and exit Class A airspace immediately, maintain VFR'
          }
        ],
        expectedActions: ['contact_vfr']
      }
    }
  },

  H5: {
    name: 'Compounded Stress / Multi-Crisis',
    description: 'Tests ability to manage multiple simultaneous crises: weather, fuel emergency, and altitude deviation',
    phases: {
      1: {
        name: 'Weather Rerouting',
        context: 'Severe thunderstorm cell at sector center (30nm radius). All 9 aircraft need rerouting. Northern route: narrow. Southern route: adds 40nm.',
        availableActions: [
          {
            id: 'reroute_north',
            label: 'Assign Northern Route',
            target: 'multiple',
            type: COMMAND_TYPES.HEADING,
            command: '[Aircraft], cleared direct NORTH waypoint, expect weather delay'
          },
          {
            id: 'reroute_south',
            label: 'Assign Southern Route',
            target: 'multiple',
            type: COMMAND_TYPES.HEADING,
            command: '[Aircraft], cleared direct SOUTH waypoint, expect extended routing'
          },
          {
            id: 'weather_advisory',
            label: 'Issue Weather Advisory',
            target: 'all',
            type: COMMAND_TYPES.CONTACT,
            command: 'All aircraft, severe weather activity sector center, expect reroutes'
          }
        ],
        expectedActions: ['reroute_north', 'reroute_south']
      },
      2: {
        name: 'Fuel Emergency - UAL345',
        context: 'UAL345 declares MAYDAY FUEL. 45 minutes fuel remaining, 156 souls on board. CONTINUE managing weather reroutes for other aircraft.',
        availableActions: [
          {
            id: 'emergency_descent',
            label: 'UAL345: Emergency Descent',
            target: 'UAL345',
            type: COMMAND_TYPES.EMERGENCY,
            command: 'UAL345, descend pilot\'s discretion, emergency descent approved'
          },
          {
            id: 'divert_nearest',
            label: 'UAL345: Divert to Nearest Airport',
            target: 'UAL345',
            type: COMMAND_TYPES.CLEARANCE,
            command: 'UAL345, cleared direct nearest suitable airport, priority handling'
          },
          {
            id: 'alert_emergency',
            label: 'Alert Emergency Services',
            target: 'ground',
            type: COMMAND_TYPES.EMERGENCY,
            command: 'Tower, fuel emergency UAL345 inbound, request emergency services standby'
          }
        ],
        expectedActions: ['emergency_descent', 'divert_nearest']
      },
      3: {
        name: 'Unauthorized Altitude Deviation - AAL300',
        context: 'AAL300 climbing through FL320 to FL330 WITHOUT CLEARANCE. Assigned altitude was FL310. Traffic at FL330 (DAL200, AAL600). TRIPLE CRISIS ACTIVE.',
        availableActions: [
          {
            id: 'altitude_correction',
            label: 'AAL300: Descend to FL310 Immediately',
            target: 'AAL300',
            type: COMMAND_TYPES.ALTITUDE,
            command: 'AAL300, descend immediately to FL310, you are not cleared FL330'
          },
          {
            id: 'stop_climb',
            label: 'AAL300: Stop Climb at FL320',
            target: 'AAL300',
            type: COMMAND_TYPES.ALTITUDE,
            command: 'AAL300, stop climb, maintain FL320'
          },
          {
            id: 'separation_assurance',
            label: 'Vector FL330 Traffic',
            target: 'multiple',
            type: COMMAND_TYPES.HEADING,
            command: 'FL330 traffic, turn for separation, traffic climbing below'
          }
        ],
        expectedActions: ['altitude_correction']
      }
    }
  },

  H6: {
    name: 'Cry Wolf Effect / Alert Filtering',
    description: 'Tests trust calibration and response after experiencing false alarm',
    phases: {
      1: {
        name: 'Normal High-Workload Operations',
        context: 'Managing 9 aircraft in high-density environment. Conflict detection system active and trusted.',
        availableActions: [],
        expectedActions: []
      },
      2: {
        name: 'FALSE ALARM - UAL600/SWA700',
        context: 'System generated conflict alert: UAL600/SWA700 predicted 4.2nm at FL320. INVESTIGATE: Verify actual separation before taking action.',
        availableActions: [
          {
            id: 'investigate_alert',
            label: 'Investigate Alert - Check Separation',
            target: 'UAL600_SWA700',
            type: COMMAND_TYPES.INVESTIGATION,
            command: 'Investigating UAL600/SWA700 conflict alert, checking actual separation'
          },
          {
            id: 'verify_separation',
            label: 'Verify Actual Separation',
            target: 'UAL600_SWA700',
            type: COMMAND_TYPES.INVESTIGATION,
            command: 'Verified: UAL600/SWA700 actual separation 6.8nm - FALSE ALARM'
          },
          {
            id: 'dismiss_false',
            label: 'Dismiss False Alarm',
            target: 'system',
            type: COMMAND_TYPES.INVESTIGATION,
            command: 'False alarm confirmed and dismissed, system miscalculation noted'
          }
        ],
        expectedActions: ['investigate_alert', 'dismiss_false']
      },
      3: {
        name: 'REAL Conflict - DAL300/AAL900',
        context: 'NEW ALERT: DAL300/AAL900 separation 4.8nm (below 5nm minimum). This is NOT a false alarm. Alert was delayed 20 seconds. TAKE ACTION.',
        availableActions: [
          {
            id: 'vector_dal300',
            label: 'DAL300: Turn Right Heading 180',
            target: 'DAL300',
            type: COMMAND_TYPES.HEADING,
            command: 'DAL300, turn right heading 180 immediately, traffic'
          },
          {
            id: 'altitude_aal900',
            label: 'AAL900: Climb to FL330',
            target: 'AAL900',
            type: COMMAND_TYPES.ALTITUDE,
            command: 'AAL900, climb and maintain FL330 immediately'
          },
          {
            id: 'traffic_advisory',
            label: 'Issue Traffic Advisory',
            target: 'both',
            type: COMMAND_TYPES.CONTACT,
            command: 'DAL300 and AAL900, traffic alert, immediate evasive action required'
          }
        ],
        expectedActions: ['vector_dal300', 'altitude_aal900']
      }
    }
  }
};

export default SCENARIO_ACTIONS;
