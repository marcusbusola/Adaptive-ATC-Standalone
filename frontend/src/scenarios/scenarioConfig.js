/**
 * ATC Scenario Configurations
 * Defines the characteristics of each research scenario
 */

export const scenarios = {
  L1: {
    id: 'L1',
    name: 'Low Complexity, Low Traffic',
    description: 'Baseline scenario with minimal workload',
    complexity: 'low',
    traffic: 'low',
    aircraftCount: 4,
    conflictProbability: 0.08,
    weatherCondition: 'clear',
    specialProcedures: [],
    alertFrequency: 2.5, // alerts per 10 minutes
    duration: 600, // seconds
    objectives: [
      'Maintain safe separation',
      'Process routine clearances',
      'Monitor aircraft progress'
    ]
  },

  L2: {
    id: 'L2',
    name: 'Low Complexity, High Traffic',
    description: 'High traffic density with straightforward procedures',
    complexity: 'low',
    traffic: 'high',
    aircraftCount: 13,
    conflictProbability: 0.18,
    weatherCondition: 'clear',
    specialProcedures: ['standard_arrivals', 'standard_departures'],
    alertFrequency: 7, // alerts per 10 minutes
    duration: 600,
    objectives: [
      'Manage high traffic flow',
      'Sequence arrivals efficiently',
      'Maintain separation standards',
      'Coordinate with adjacent sectors'
    ]
  },

  H4: {
    id: 'H4',
    name: 'High Complexity, Low Traffic',
    description: 'Complex situations with moderate traffic',
    complexity: 'high',
    traffic: 'low',
    aircraftCount: 5,
    conflictProbability: 0.22,
    weatherCondition: 'adverse',
    specialProcedures: ['emergency_handling', 'weather_deviations', 'diversions'],
    alertFrequency: 6, // alerts per 10 minutes
    duration: 600,
    objectives: [
      'Handle emergency situations',
      'Manage weather deviations',
      'Coordinate diversions',
      'Maintain situational awareness',
      'Prioritize traffic appropriately'
    ]
  },

  H5: {
    id: 'H5',
    name: 'High Complexity, High Traffic',
    description: 'Maximum workload scenario combining high traffic and complexity',
    complexity: 'high',
    traffic: 'high',
    aircraftCount: 17,
    conflictProbability: 0.28,
    weatherCondition: 'adverse',
    specialProcedures: [
      'multiple_emergencies',
      'weather_deviations',
      'runway_changes',
      'holds'
    ],
    alertFrequency: 11, // alerts per 10 minutes
    duration: 600,
    objectives: [
      'Manage high traffic density',
      'Handle multiple simultaneous emergencies',
      'Navigate weather constraints',
      'Coordinate complex reroutes',
      'Maintain safety under high stress',
      'Prioritize conflicting demands'
    ]
  }
};

/**
 * Get scenario by ID
 */
export function getScenario(scenarioId) {
  return scenarios[scenarioId] || null;
}

/**
 * Get all scenarios as array
 */
export function getAllScenarios() {
  return Object.values(scenarios);
}

/**
 * Calculate workload score for a scenario (0-1)
 */
export function calculateWorkload(scenarioId) {
  const scenario = getScenario(scenarioId);
  if (!scenario) return 0;

  const complexityScore = scenario.complexity === 'high' ? 0.6 : 0.2;
  const trafficScore = (scenario.aircraftCount / 20) * 0.4;

  return Math.min(complexityScore + trafficScore, 1);
}

/**
 * Get alert timing distribution for scenario
 */
export function getAlertDistribution(scenarioId) {
  const scenario = getScenario(scenarioId);
  if (!scenario) return [];

  const totalAlerts = Math.round((scenario.alertFrequency / 10) * (scenario.duration / 60));
  const alerts = [];

  // Distribute alerts semi-randomly throughout the scenario
  for (let i = 0; i < totalAlerts; i++) {
    const baseTime = (scenario.duration / totalAlerts) * i;
    const variance = (scenario.duration / totalAlerts) * 0.4;
    const time = baseTime + (Math.random() - 0.5) * variance;

    alerts.push({
      time: Math.max(0, Math.min(scenario.duration, time)),
      priority: getRandomPriority(scenario.complexity),
      type: getRandomAlertType(scenario)
    });
  }

  return alerts.sort((a, b) => a.time - b.time);
}

/**
 * Get random priority based on scenario complexity
 */
function getRandomPriority(complexity) {
  const rand = Math.random();

  if (complexity === 'high') {
    if (rand < 0.3) return 'critical';
    if (rand < 0.6) return 'warning';
    return 'info';
  } else {
    if (rand < 0.1) return 'critical';
    if (rand < 0.4) return 'warning';
    return 'info';
  }
}

/**
 * Get random alert type based on scenario
 */
function getRandomAlertType(scenario) {
  const types = [
    'conflict_alert',
    'minimum_safe_altitude',
    'coordination_required',
    'equipment_failure',
    'weather_advisory'
  ];

  if (scenario.complexity === 'high') {
    types.push('emergency_declared', 'airspace_violation');
  }

  return types[Math.floor(Math.random() * types.length)];
}

export default scenarios;
