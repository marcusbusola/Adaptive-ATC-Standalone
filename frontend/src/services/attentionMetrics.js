/**
 * Attention Metrics Service
 *
 * Specialized research metrics for comparing alert presentation conditions
 * in ATC adaptive alerts research.
 *
 * Key metrics:
 * - Crisis Fixation Ratio (tunnel vision detection)
 * - Peripheral Neglect Duration (awareness gaps)
 * - Response Time Analysis (multiple variants)
 * - Multi-crisis Coordination Score (attention distribution)
 * - Decision Quality Metrics (speed vs accuracy)
 */

/**
 * Research Thresholds (configurable)
 */
export const THRESHOLDS = {
  // Crisis Fixation
  CRISIS_FIXATION_TUNNEL_VISION: 0.70, // >70% indicates tunnel vision
  CRISIS_FIXATION_MODERATE: 0.50,
  CRISIS_FIXATION_BALANCED: 0.30,

  // Peripheral Neglect
  PERIPHERAL_NEGLECT_CRITICAL: 30000, // 30 seconds
  PERIPHERAL_NEGLECT_WARNING: 15000,  // 15 seconds
  PERIPHERAL_NEGLECT_ACCEPTABLE: 5000, // 5 seconds

  // Response Time (milliseconds)
  RESPONSE_EXCELLENT: 2000,  // <2s
  RESPONSE_GOOD: 4000,       // <4s
  RESPONSE_ACCEPTABLE: 6000, // <6s
  RESPONSE_POOR: 10000,      // <10s

  // Coordination Score
  COORDINATION_EXCELLENT: 0.85,
  COORDINATION_GOOD: 0.70,
  COORDINATION_ADEQUATE: 0.50,

  // Decision Quality
  DECISION_OPTIMAL_MIN_TIME: 1000, // Minimum time for quality decision
  DECISION_HASTY_THRESHOLD: 500,   // <500ms may be hasty
};

/**
 * Calculate Crisis Fixation Ratio
 *
 * Measures tunnel vision by calculating ratio of time spent on crisis
 * regions vs total time. Higher ratios indicate potential tunnel vision.
 *
 * Formula: time_on_crisis / total_time
 *
 * @param {Object} trackingData - Exported tracking data
 * @param {Array} crisisAlertIds - IDs of crisis alerts
 * @returns {Object} Crisis fixation analysis
 */
export function calculateCrisisFixationRatio(trackingData, crisisAlertIds = []) {
  const { regions, tracking, session } = trackingData;
  const dwellTimes = tracking.dwellTimes || {};

  // Calculate total session time
  const totalTime = session.endTime - session.startTime;

  // Identify crisis regions (alerts + highlighted areas)
  const crisisRegions = Object.keys(regions).filter(regionId => {
    const region = regions[regionId];
    return region.category === 'alert' || region.isCrisis || region.isHighlighted;
  });

  // Calculate time on crisis regions
  let crisisTime = 0;
  let nonCrisisTime = 0;

  for (const [regionId, dwellTime] of Object.entries(dwellTimes)) {
    if (crisisRegions.includes(regionId)) {
      crisisTime += dwellTime;
    } else {
      nonCrisisTime += dwellTime;
    }
  }

  // Calculate ratio
  const ratio = totalTime > 0 ? crisisTime / totalTime : 0;

  // Calculate time-based metrics
  const radarTime = Object.entries(dwellTimes)
    .filter(([regionId]) => regions[regionId]?.category === 'radar')
    .reduce((sum, [, time]) => sum + time, 0);

  // Determine classification
  let classification;
  let severity;

  if (ratio > THRESHOLDS.CRISIS_FIXATION_TUNNEL_VISION) {
    classification = 'tunnel_vision';
    severity = 'critical';
  } else if (ratio > THRESHOLDS.CRISIS_FIXATION_MODERATE) {
    classification = 'crisis_focused';
    severity = 'warning';
  } else if (ratio > THRESHOLDS.CRISIS_FIXATION_BALANCED) {
    classification = 'balanced';
    severity = 'acceptable';
  } else {
    classification = 'crisis_neglect';
    severity = 'warning';
  }

  return {
    ratio,
    percentage: ratio * 100,
    classification,
    severity,
    crisisTime,
    nonCrisisTime,
    radarTime,
    totalTime,
    crisisRegions: crisisRegions.length,
    metrics: {
      crisisAttentionPercentage: (crisisTime / totalTime) * 100,
      radarAttentionPercentage: (radarTime / totalTime) * 100,
      balanceScore: 1 - Math.abs(ratio - 0.5) * 2, // Score 0-1, peak at 50/50
    },
    interpretation: _interpretCrisisFixation(ratio, radarTime, totalTime)
  };
}

/**
 * Calculate Peripheral Neglect Duration
 *
 * Identifies regions that haven't received attention for concerning periods.
 * Critical for detecting loss of situational awareness.
 *
 * @param {Object} trackingData - Exported tracking data
 * @param {Number} currentTime - Current timestamp (for real-time analysis)
 * @returns {Object} Peripheral neglect analysis
 */
export function calculatePeripheralNeglect(trackingData, currentTime = Date.now()) {
  const { regions, tracking } = trackingData;
  const mouseMovements = tracking.mouseMovements || [];

  // Find last visit to each region
  const regionLastVisit = {};
  const regionVisitCount = {};

  for (const movement of mouseMovements) {
    if (movement.region) {
      regionLastVisit[movement.region] = movement.timestamp;
      regionVisitCount[movement.region] = (regionVisitCount[movement.region] || 0) + 1;
    }
  }

  // Analyze neglect for each region
  const neglectAnalysis = {};
  const criticalNeglects = [];
  const warningNeglects = [];

  for (const [regionId, region] of Object.entries(regions)) {
    const lastVisit = regionLastVisit[regionId];
    const visitCount = regionVisitCount[regionId] || 0;

    if (!lastVisit) {
      // Never visited
      neglectAnalysis[regionId] = {
        regionName: region.name,
        category: region.category,
        lastVisit: null,
        timeSinceVisit: null,
        visitCount: 0,
        neglectStatus: 'never_visited',
        severity: 'critical',
        isNeglected: true
      };
      criticalNeglects.push(regionId);
    } else {
      const timeSinceVisit = currentTime - lastVisit;
      let neglectStatus;
      let severity;
      let isNeglected = false;

      if (timeSinceVisit > THRESHOLDS.PERIPHERAL_NEGLECT_CRITICAL) {
        neglectStatus = 'critical_neglect';
        severity = 'critical';
        isNeglected = true;
        criticalNeglects.push(regionId);
      } else if (timeSinceVisit > THRESHOLDS.PERIPHERAL_NEGLECT_WARNING) {
        neglectStatus = 'warning_neglect';
        severity = 'warning';
        isNeglected = true;
        warningNeglects.push(regionId);
      } else if (timeSinceVisit > THRESHOLDS.PERIPHERAL_NEGLECT_ACCEPTABLE) {
        neglectStatus = 'acceptable';
        severity = 'acceptable';
      } else {
        neglectStatus = 'recently_visited';
        severity = 'good';
      }

      neglectAnalysis[regionId] = {
        regionName: region.name,
        category: region.category,
        lastVisit,
        timeSinceVisit,
        visitCount,
        neglectStatus,
        severity,
        isNeglected
      };
    }
  }

  // Calculate aggregate metrics
  const totalRegions = Object.keys(regions).length;
  const neglectedRegions = criticalNeglects.length + warningNeglects.length;
  const coverageRatio = totalRegions > 0 ? (totalRegions - neglectedRegions) / totalRegions : 0;

  // Find most neglected region
  const mostNeglected = Object.entries(neglectAnalysis)
    .filter(([, data]) => data.timeSinceVisit !== null)
    .sort(([, a], [, b]) => (b.timeSinceVisit || 0) - (a.timeSinceVisit || 0))[0];

  return {
    byRegion: neglectAnalysis,
    summary: {
      totalRegions,
      neglectedRegions,
      criticalNeglects: criticalNeglects.length,
      warningNeglects: warningNeglects.length,
      coverageRatio,
      coveragePercentage: coverageRatio * 100
    },
    mostNeglected: mostNeglected ? {
      regionId: mostNeglected[0],
      ...mostNeglected[1]
    } : null,
    criticalNeglects,
    warningNeglects,
    overallStatus: _determineNeglectStatus(criticalNeglects.length, warningNeglects.length, totalRegions),
    interpretation: _interpretPeripheralNeglect(coverageRatio, criticalNeglects.length)
  };
}

/**
 * Calculate Response Time Metrics
 *
 * Multiple response time variants for different research questions:
 * - Time to first interaction (awareness)
 * - Time to acknowledgment (recognition)
 * - Time to corrective action (decision)
 * - Time to resolution (completion)
 *
 * @param {Object} trackingData - Exported tracking data
 * @returns {Object} Response time analysis
 */
export function calculateResponseTimes(trackingData) {
  const { tracking } = trackingData;
  const alertInteractions = tracking.alertInteractions || [];

  // Group interactions by alert
  const alertTimelines = {};

  for (const interaction of alertInteractions) {
    const { alertId } = interaction;

    if (!alertTimelines[alertId]) {
      alertTimelines[alertId] = {
        alertId,
        presented: null,
        firstInteraction: null,
        acknowledged: null,
        firstAction: null,
        resolved: null,
        interactions: []
      };
    }

    alertTimelines[alertId].interactions.push(interaction);

    // Track key timestamps
    switch (interaction.type) {
      case 'presented':
        alertTimelines[alertId].presented = interaction.timestamp;
        alertTimelines[alertId].severity = interaction.severity;
        alertTimelines[alertId].confidence = interaction.confidence;
        break;

      case 'acknowledged':
      case 'dismissed':
        if (!alertTimelines[alertId].acknowledged) {
          alertTimelines[alertId].acknowledged = interaction.timestamp;
        }
        if (!alertTimelines[alertId].firstInteraction) {
          alertTimelines[alertId].firstInteraction = interaction.timestamp;
        }
        break;

      case 'action_clicked':
        if (!alertTimelines[alertId].firstAction) {
          alertTimelines[alertId].firstAction = interaction.timestamp;
        }
        if (!alertTimelines[alertId].firstInteraction) {
          alertTimelines[alertId].firstInteraction = interaction.timestamp;
        }
        break;

      case 'accepted':
      case 'rejected':
        if (!alertTimelines[alertId].firstInteraction) {
          alertTimelines[alertId].firstInteraction = interaction.timestamp;
        }
        break;

      case 'resolved':
        alertTimelines[alertId].resolved = interaction.timestamp;
        break;
    }
  }

  // Calculate response times for each alert
  const responseTimesByAlert = {};
  const allResponseTimes = {
    awareness: [],      // Time to first interaction
    recognition: [],    // Time to acknowledgment
    decision: [],       // Time to first action
    resolution: []      // Time to resolution
  };

  for (const [alertId, timeline] of Object.entries(alertTimelines)) {
    if (!timeline.presented) continue;

    const times = {
      alertId,
      severity: timeline.severity,
      confidence: timeline.confidence,
      awareness: null,
      recognition: null,
      decision: null,
      resolution: null
    };

    // Time to awareness (first interaction)
    if (timeline.firstInteraction) {
      times.awareness = timeline.firstInteraction - timeline.presented;
      allResponseTimes.awareness.push(times.awareness);
    }

    // Time to recognition (acknowledgment)
    if (timeline.acknowledged) {
      times.recognition = timeline.acknowledged - timeline.presented;
      allResponseTimes.recognition.push(times.recognition);
    }

    // Time to decision (first action)
    if (timeline.firstAction) {
      times.decision = timeline.firstAction - timeline.presented;
      allResponseTimes.decision.push(times.decision);
    }

    // Time to resolution
    if (timeline.resolved) {
      times.resolution = timeline.resolved - timeline.presented;
      allResponseTimes.resolution.push(times.resolution);
    }

    // Classify response speed
    times.classification = _classifyResponseTime(times.awareness || times.recognition);

    responseTimesByAlert[alertId] = times;
  }

  // Calculate statistics for each response type
  const statistics = {
    awareness: _calculateTimeStats(allResponseTimes.awareness),
    recognition: _calculateTimeStats(allResponseTimes.recognition),
    decision: _calculateTimeStats(allResponseTimes.decision),
    resolution: _calculateTimeStats(allResponseTimes.resolution)
  };

  // Analyze by severity
  const bySeverity = _analyzeResponseTimeBySeverity(responseTimesByAlert);

  return {
    byAlert: responseTimesByAlert,
    statistics,
    bySeverity,
    totalAlerts: Object.keys(alertTimelines).length,
    interpretation: _interpretResponseTimes(statistics.awareness)
  };
}

/**
 * Calculate Multi-Crisis Coordination Score
 *
 * Measures how effectively attention is distributed across multiple
 * concurrent crises. Higher scores indicate better coordination.
 *
 * @param {Object} trackingData - Exported tracking data
 * @param {Array} concurrentCrisisWindows - Time windows with multiple crises
 * @returns {Object} Coordination analysis
 */
export function calculateMultiCrisisCoordination(trackingData, concurrentCrisisWindows = null) {
  const { tracking, session } = trackingData;
  const alertInteractions = tracking.alertInteractions || [];
  const mouseMovements = tracking.mouseMovements || [];

  // Identify concurrent crisis periods if not provided
  if (!concurrentCrisisWindows) {
    concurrentCrisisWindows = _identifyConcurrentCrisisWindows(alertInteractions);
  }

  if (concurrentCrisisWindows.length === 0) {
    return {
      score: null,
      hasMultiCrisis: false,
      interpretation: 'No concurrent crises detected during session'
    };
  }

  // Analyze each concurrent crisis window
  const windowAnalyses = [];

  for (const window of concurrentCrisisWindows) {
    const { startTime, endTime, alertIds, crisisCount } = window;

    // Filter mouse movements during this window
    const windowMovements = mouseMovements.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );

    // Calculate attention distribution across crises
    const attentionDistribution = {};
    let totalAttentionTime = 0;

    // Group movements by alert region
    for (const movement of windowMovements) {
      if (movement.region && movement.region.startsWith('alert_')) {
        if (!attentionDistribution[movement.region]) {
          attentionDistribution[movement.region] = 0;
        }
        // Approximate dwell time using sample interval
        attentionDistribution[movement.region] += 100; // 100ms per sample
        totalAttentionTime += 100;
      }
    }

    // Calculate distribution evenness (entropy)
    const attentionProportions = Object.values(attentionDistribution).map(
      time => time / totalAttentionTime
    );

    const entropy = _calculateEntropy(attentionProportions);
    const maxEntropy = Math.log2(crisisCount);
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

    // Calculate switching rate (transitions between crises)
    let switchCount = 0;
    let lastRegion = null;

    for (const movement of windowMovements) {
      if (movement.region && movement.region !== lastRegion) {
        if (lastRegion && movement.region.startsWith('alert_')) {
          switchCount++;
        }
        lastRegion = movement.region;
      }
    }

    const windowDuration = endTime - startTime;
    const switchRate = windowDuration > 0 ? (switchCount / windowDuration) * 1000 : 0; // switches per second

    // Calculate response times during window
    const windowAlertInteractions = alertInteractions.filter(
      i => i.timestamp >= startTime && i.timestamp <= endTime && alertIds.includes(i.alertId)
    );

    const responseTimes = windowAlertInteractions
      .filter(i => i.responseTime !== undefined)
      .map(i => i.responseTime);

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : null;

    // Calculate coordination score (0-1)
    // Higher entropy = better distribution
    // Moderate switch rate = good (not too scattered, not too fixated)
    const optimalSwitchRate = 0.5; // 0.5 switches per second
    const switchRateScore = 1 - Math.min(Math.abs(switchRate - optimalSwitchRate) / optimalSwitchRate, 1);

    const coordinationScore = (
      normalizedEntropy * 0.6 +        // 60% weight on attention distribution
      switchRateScore * 0.3 +          // 30% weight on switching behavior
      (responseTimes.length / crisisCount) * 0.1  // 10% weight on response coverage
    );

    windowAnalyses.push({
      startTime,
      endTime,
      duration: windowDuration,
      crisisCount,
      alertIds,
      attentionDistribution,
      entropy: normalizedEntropy,
      switchCount,
      switchRate,
      avgResponseTime,
      coordinationScore,
      classification: _classifyCoordination(coordinationScore)
    });
  }

  // Calculate overall coordination score
  const overallScore = windowAnalyses.length > 0
    ? windowAnalyses.reduce((sum, w) => sum + w.coordinationScore, 0) / windowAnalyses.length
    : 0;

  return {
    score: overallScore,
    classification: _classifyCoordination(overallScore),
    hasMultiCrisis: true,
    concurrentWindows: windowAnalyses.length,
    byWindow: windowAnalyses,
    summary: {
      avgCrisisCount: windowAnalyses.reduce((sum, w) => sum + w.crisisCount, 0) / windowAnalyses.length,
      avgSwitchRate: windowAnalyses.reduce((sum, w) => sum + w.switchRate, 0) / windowAnalyses.length,
      avgEntropy: windowAnalyses.reduce((sum, w) => sum + w.entropy, 0) / windowAnalyses.length
    },
    interpretation: _interpretCoordination(overallScore, windowAnalyses.length)
  };
}

/**
 * Calculate Decision Quality Metrics
 *
 * Analyzes speed-accuracy trade-offs in decision making.
 * Considers response time, action appropriateness, and outcomes.
 *
 * @param {Object} trackingData - Exported tracking data
 * @param {Array} decisionOutcomes - Array of {alertId, wasCorrect, wasOptimal}
 * @returns {Object} Decision quality analysis
 */
export function calculateDecisionQuality(trackingData, decisionOutcomes = []) {
  const responseTimes = calculateResponseTimes(trackingData);

  // Categorize decisions
  const decisions = {
    hasty: [],      // <500ms (potentially hasty)
    optimal: [],    // 1-4s (good balance)
    delayed: [],    // 4-10s (slower)
    excessive: []   // >10s (too slow)
  };

  const decisionsByAlert = {};

  for (const [alertId, times] of Object.entries(responseTimes.byAlert)) {
    const responseTime = times.awareness || times.recognition;
    if (!responseTime) continue;

    // Find outcome data if provided
    const outcome = decisionOutcomes.find(o => o.alertId === alertId);

    const decision = {
      alertId,
      responseTime,
      severity: times.severity,
      wasCorrect: outcome?.wasCorrect,
      wasOptimal: outcome?.wasOptimal,
      category: null,
      qualityScore: null
    };

    // Categorize decision speed
    if (responseTime < THRESHOLDS.DECISION_HASTY_THRESHOLD) {
      decision.category = 'hasty';
      decisions.hasty.push(decision);
    } else if (responseTime <= THRESHOLDS.RESPONSE_GOOD) {
      decision.category = 'optimal';
      decisions.optimal.push(decision);
    } else if (responseTime <= THRESHOLDS.RESPONSE_POOR) {
      decision.category = 'delayed';
      decisions.delayed.push(decision);
    } else {
      decision.category = 'excessive';
      decisions.excessive.push(decision);
    }

    // Calculate quality score (0-100)
    // Considers both speed and correctness
    let speedScore = 100;

    if (responseTime < THRESHOLDS.DECISION_HASTY_THRESHOLD) {
      speedScore = 50; // Penalty for hasty decisions
    } else if (responseTime <= THRESHOLDS.RESPONSE_EXCELLENT) {
      speedScore = 100;
    } else if (responseTime <= THRESHOLDS.RESPONSE_GOOD) {
      speedScore = 85;
    } else if (responseTime <= THRESHOLDS.RESPONSE_ACCEPTABLE) {
      speedScore = 70;
    } else if (responseTime <= THRESHOLDS.RESPONSE_POOR) {
      speedScore = 50;
    } else {
      speedScore = 30;
    }

    // Factor in correctness if known
    if (outcome) {
      const correctnessScore = outcome.wasCorrect ? 100 : 0;
      const optimalityBonus = outcome.wasOptimal ? 10 : 0;

      decision.qualityScore = (speedScore * 0.4 + correctnessScore * 0.5 + optimalityBonus);
    } else {
      decision.qualityScore = speedScore;
    }

    decisionsByAlert[alertId] = decision;
  }

  // Calculate aggregate metrics
  const totalDecisions = Object.keys(decisionsByAlert).length;

  const speedAccuracyProfile = {
    hasty: decisions.hasty.length,
    optimal: decisions.optimal.length,
    delayed: decisions.delayed.length,
    excessive: decisions.excessive.length,
    hastyPercentage: (decisions.hasty.length / totalDecisions) * 100,
    optimalPercentage: (decisions.optimal.length / totalDecisions) * 100
  };

  // Calculate average quality score
  const qualityScores = Object.values(decisionsByAlert)
    .filter(d => d.qualityScore !== null)
    .map(d => d.qualityScore);

  const avgQualityScore = qualityScores.length > 0
    ? qualityScores.reduce((sum, s) => sum + s, 0) / qualityScores.length
    : null;

  // Analyze speed-accuracy correlation (if outcomes provided)
  let speedAccuracyCorrelation = null;

  if (decisionOutcomes.length > 0) {
    const dataPoints = Object.values(decisionsByAlert)
      .filter(d => d.wasCorrect !== undefined)
      .map(d => ({
        speed: d.responseTime,
        correct: d.wasCorrect ? 1 : 0
      }));

    if (dataPoints.length > 2) {
      speedAccuracyCorrelation = _calculateCorrelation(
        dataPoints.map(p => p.speed),
        dataPoints.map(p => p.correct)
      );
    }
  }

  return {
    byAlert: decisionsByAlert,
    profile: speedAccuracyProfile,
    avgQualityScore,
    qualityLevel: _classifyDecisionQuality(avgQualityScore),
    speedAccuracyCorrelation,
    totalDecisions,
    interpretation: _interpretDecisionQuality(speedAccuracyProfile, avgQualityScore)
  };
}

/**
 * Generate Comprehensive Attention Report
 *
 * Combines all attention metrics into a single comprehensive report
 * suitable for research analysis and publication.
 *
 * @param {Object} trackingData - Exported tracking data
 * @param {Object} options - Analysis options
 * @returns {Object} Comprehensive attention metrics report
 */
export function generateAttentionReport(trackingData, options = {}) {
  const {
    crisisAlertIds = [],
    concurrentCrisisWindows = null,
    decisionOutcomes = [],
    includeInterpretations = true
  } = options;

  const report = {
    session: {
      participantId: trackingData.session.participantId,
      scenario: trackingData.session.scenario,
      condition: trackingData.session.condition,
      duration: trackingData.session.endTime - trackingData.session.startTime
    },

    metrics: {
      crisisFixation: calculateCrisisFixationRatio(trackingData, crisisAlertIds),
      peripheralNeglect: calculatePeripheralNeglect(trackingData),
      responseTimes: calculateResponseTimes(trackingData),
      multiCrisisCoordination: calculateMultiCrisisCoordination(trackingData, concurrentCrisisWindows),
      decisionQuality: calculateDecisionQuality(trackingData, decisionOutcomes)
    },

    summary: {},
    recommendations: []
  };

  // Generate summary scores
  report.summary = {
    overallAttentionScore: _calculateOverallAttentionScore(report.metrics),
    crisisFixationStatus: report.metrics.crisisFixation.classification,
    neglectStatus: report.metrics.peripheralNeglect.overallStatus,
    avgResponseTime: report.metrics.responseTimes.statistics.awareness?.mean || null,
    coordinationScore: report.metrics.multiCrisisCoordination.score,
    decisionQuality: report.metrics.decisionQuality.avgQualityScore
  };

  // Generate recommendations
  if (includeInterpretations) {
    report.recommendations = _generateRecommendations(report.metrics);
  }

  return report;
}

/**
 * Compare Attention Metrics Across Conditions
 *
 * Statistical comparison of attention metrics between different conditions
 *
 * @param {Array} reports - Array of attention reports from different conditions
 * @returns {Object} Comparison analysis
 */
export function compareConditionMetrics(reports) {
  if (reports.length < 2) {
    throw new Error('At least 2 reports required for comparison');
  }

  // Group by condition
  const byCondition = {};
  for (const report of reports) {
    const condition = report.session.condition;
    if (!byCondition[condition]) {
      byCondition[condition] = [];
    }
    byCondition[condition].push(report);
  }

  // Calculate aggregate metrics per condition
  const conditionAggregates = {};

  for (const [condition, conditionReports] of Object.entries(byCondition)) {
    conditionAggregates[condition] = {
      n: conditionReports.length,
      crisisFixationRatio: {
        mean: _mean(conditionReports.map(r => r.metrics.crisisFixation.ratio)),
        std: _std(conditionReports.map(r => r.metrics.crisisFixation.ratio))
      },
      peripheralNeglectCoverage: {
        mean: _mean(conditionReports.map(r => r.metrics.peripheralNeglect.summary.coverageRatio)),
        std: _std(conditionReports.map(r => r.metrics.peripheralNeglect.summary.coverageRatio))
      },
      avgResponseTime: {
        mean: _mean(conditionReports.map(r => r.metrics.responseTimes.statistics.awareness?.mean || 0)),
        std: _std(conditionReports.map(r => r.metrics.responseTimes.statistics.awareness?.mean || 0))
      },
      coordinationScore: {
        mean: _mean(conditionReports.map(r => r.metrics.multiCrisisCoordination.score || 0)),
        std: _std(conditionReports.map(r => r.metrics.multiCrisisCoordination.score || 0))
      },
      decisionQuality: {
        mean: _mean(conditionReports.map(r => r.metrics.decisionQuality.avgQualityScore || 0)),
        std: _std(conditionReports.map(r => r.metrics.decisionQuality.avgQualityScore || 0))
      }
    };
  }

  // Pairwise comparisons
  const pairwiseComparisons = [];
  const conditions = Object.keys(conditionAggregates).sort();

  for (let i = 0; i < conditions.length; i++) {
    for (let j = i + 1; j < conditions.length; j++) {
      const cond1 = conditions[i];
      const cond2 = conditions[j];

      pairwiseComparisons.push({
        conditions: [cond1, cond2],
        crisisFixationDiff: conditionAggregates[cond2].crisisFixationRatio.mean -
                           conditionAggregates[cond1].crisisFixationRatio.mean,
        responseTimeImprovement: ((conditionAggregates[cond1].avgResponseTime.mean -
                                  conditionAggregates[cond2].avgResponseTime.mean) /
                                 conditionAggregates[cond1].avgResponseTime.mean) * 100,
        coordinationImprovement: ((conditionAggregates[cond2].coordinationScore.mean -
                                  conditionAggregates[cond1].coordinationScore.mean) /
                                 conditionAggregates[cond1].coordinationScore.mean) * 100
      });
    }
  }

  return {
    byCondition: conditionAggregates,
    pairwiseComparisons,
    totalParticipants: reports.length,
    conditionCounts: Object.fromEntries(
      Object.entries(byCondition).map(([cond, reps]) => [cond, reps.length])
    )
  };
}

/* =========================================================================
   PRIVATE HELPER FUNCTIONS
   ========================================================================= */

function _interpretCrisisFixation(ratio, radarTime, totalTime) {
  const radarPercentage = (radarTime / totalTime) * 100;

  if (ratio > 0.70) {
    return `CRITICAL: Severe tunnel vision detected (${(ratio * 100).toFixed(1)}% on crisis). ` +
           `Radar attention only ${radarPercentage.toFixed(1)}%. Risk of missing peripheral threats.`;
  } else if (ratio > 0.50) {
    return `WARNING: High crisis fixation (${(ratio * 100).toFixed(1)}%). ` +
           `Consider improving peripheral awareness.`;
  } else if (ratio > 0.30) {
    return `ACCEPTABLE: Balanced attention distribution. ` +
           `Good situational awareness maintained.`;
  } else {
    return `WARNING: Low crisis attention (${(ratio * 100).toFixed(1)}%). ` +
           `May indicate crisis neglect or delayed recognition.`;
  }
}

function _interpretPeripheralNeglect(coverageRatio, criticalCount) {
  if (criticalCount > 0) {
    return `CRITICAL: ${criticalCount} region(s) severely neglected (>30s). ` +
           `Situational awareness compromised.`;
  } else if (coverageRatio < 0.70) {
    return `WARNING: Low coverage ratio (${(coverageRatio * 100).toFixed(1)}%). ` +
           `Multiple regions not adequately monitored.`;
  } else if (coverageRatio < 0.85) {
    return `ACCEPTABLE: Moderate coverage (${(coverageRatio * 100).toFixed(1)}%). ` +
           `Room for improvement in peripheral monitoring.`;
  } else {
    return `EXCELLENT: High coverage ratio (${(coverageRatio * 100).toFixed(1)}%). ` +
           `Strong situational awareness demonstrated.`;
  }
}

function _interpretResponseTimes(awarenessStats) {
  if (!awarenessStats || !awarenessStats.mean) {
    return 'No response time data available.';
  }

  const mean = awarenessStats.mean;

  if (mean < THRESHOLDS.RESPONSE_EXCELLENT) {
    return `EXCELLENT: Very fast response times (${mean.toFixed(0)}ms average). ` +
           `High alertness and rapid threat recognition.`;
  } else if (mean < THRESHOLDS.RESPONSE_GOOD) {
    return `GOOD: Fast response times (${mean.toFixed(0)}ms average). ` +
           `Effective alert awareness.`;
  } else if (mean < THRESHOLDS.RESPONSE_ACCEPTABLE) {
    return `ACCEPTABLE: Moderate response times (${mean.toFixed(0)}ms average). ` +
           `Within acceptable range but could improve.`;
  } else {
    return `POOR: Slow response times (${mean.toFixed(0)}ms average). ` +
           `May indicate alert fatigue or workload issues.`;
  }
}

function _interpretCoordination(score, windowCount) {
  if (!score) {
    return 'No multi-crisis coordination data available.';
  }

  if (score > THRESHOLDS.COORDINATION_EXCELLENT) {
    return `EXCELLENT: Superior multi-crisis coordination (${(score * 100).toFixed(1)}/100). ` +
           `Effectively distributed attention across ${windowCount} concurrent crisis window(s).`;
  } else if (score > THRESHOLDS.COORDINATION_GOOD) {
    return `GOOD: Effective coordination (${(score * 100).toFixed(1)}/100). ` +
           `Managed concurrent crises adequately.`;
  } else if (score > THRESHOLDS.COORDINATION_ADEQUATE) {
    return `ADEQUATE: Basic coordination (${(score * 100).toFixed(1)}/100). ` +
           `Some difficulty managing multiple simultaneous crises.`;
  } else {
    return `POOR: Weak coordination (${(score * 100).toFixed(1)}/100). ` +
           `Struggled with concurrent crisis management. May indicate cognitive overload.`;
  }
}

function _interpretDecisionQuality(profile, avgScore) {
  const hastyPct = profile.hastyPercentage || 0;
  const optimalPct = profile.optimalPercentage || 0;

  let interpretation = `Decision quality: ${avgScore?.toFixed(1) || 'N/A'}/100. `;

  if (hastyPct > 20) {
    interpretation += `WARNING: ${hastyPct.toFixed(1)}% hasty decisions (<500ms). ` +
                     `May indicate impulsive responses. `;
  }

  if (optimalPct > 60) {
    interpretation += `GOOD: ${optimalPct.toFixed(1)}% decisions in optimal time window (1-4s). `;
  } else {
    interpretation += `${optimalPct.toFixed(1)}% optimal decisions. Room for improvement. `;
  }

  return interpretation;
}

function _determineNeglectStatus(critical, warning, total) {
  if (critical > 0) return 'critical';
  if (warning > total * 0.3) return 'warning';
  if (warning > 0) return 'acceptable';
  return 'good';
}

function _classifyResponseTime(responseTime) {
  if (!responseTime) return 'unknown';
  if (responseTime < THRESHOLDS.RESPONSE_EXCELLENT) return 'excellent';
  if (responseTime < THRESHOLDS.RESPONSE_GOOD) return 'good';
  if (responseTime < THRESHOLDS.RESPONSE_ACCEPTABLE) return 'acceptable';
  if (responseTime < THRESHOLDS.RESPONSE_POOR) return 'poor';
  return 'very_poor';
}

function _classifyCoordination(score) {
  if (!score) return 'unknown';
  if (score > THRESHOLDS.COORDINATION_EXCELLENT) return 'excellent';
  if (score > THRESHOLDS.COORDINATION_GOOD) return 'good';
  if (score > THRESHOLDS.COORDINATION_ADEQUATE) return 'adequate';
  return 'poor';
}

function _classifyDecisionQuality(score) {
  if (!score) return 'unknown';
  if (score > 85) return 'excellent';
  if (score > 70) return 'good';
  if (score > 55) return 'acceptable';
  return 'poor';
}

function _calculateTimeStats(times) {
  if (times.length === 0) return null;

  const sorted = [...times].sort((a, b) => a - b);

  return {
    count: times.length,
    mean: _mean(times),
    median: sorted[Math.floor(times.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
    std: _std(times),
    p25: sorted[Math.floor(times.length * 0.25)],
    p75: sorted[Math.floor(times.length * 0.75)]
  };
}

function _analyzeResponseTimeBySeverity(responseTimesByAlert) {
  const bySeverity = {};

  for (const times of Object.values(responseTimesByAlert)) {
    const severity = times.severity || 'unknown';

    if (!bySeverity[severity]) {
      bySeverity[severity] = [];
    }

    if (times.awareness) {
      bySeverity[severity].push(times.awareness);
    } else if (times.recognition) {
      bySeverity[severity].push(times.recognition);
    }
  }

  const stats = {};
  for (const [severity, times] of Object.entries(bySeverity)) {
    stats[severity] = _calculateTimeStats(times);
  }

  return stats;
}

function _identifyConcurrentCrisisWindows(alertInteractions) {
  // Find time periods with multiple active alerts
  const presentations = alertInteractions.filter(i => i.type === 'presented');
  const dismissals = alertInteractions.filter(i =>
    ['acknowledged', 'dismissed', 'resolved'].includes(i.type)
  );

  const activeAlerts = new Map(); // timestamp -> Set of active alert IDs
  const allTimestamps = [...presentations, ...dismissals]
    .map(i => i.timestamp)
    .sort((a, b) => a - b);

  let currentActive = new Set();

  for (const timestamp of allTimestamps) {
    // Add presentations
    presentations
      .filter(p => p.timestamp === timestamp)
      .forEach(p => currentActive.add(p.alertId));

    // Remove dismissals
    dismissals
      .filter(d => d.timestamp === timestamp)
      .forEach(d => currentActive.delete(d.alertId));

    if (currentActive.size > 0) {
      activeAlerts.set(timestamp, new Set(currentActive));
    }
  }

  // Identify windows with multiple concurrent crises
  const windows = [];
  let windowStart = null;
  let windowAlerts = new Set();

  for (const [timestamp, alerts] of activeAlerts) {
    if (alerts.size >= 2) {
      if (!windowStart) {
        windowStart = timestamp;
        windowAlerts = new Set(alerts);
      } else {
        // Extend window
        alerts.forEach(a => windowAlerts.add(a));
      }
    } else {
      if (windowStart) {
        windows.push({
          startTime: windowStart,
          endTime: timestamp,
          alertIds: Array.from(windowAlerts),
          crisisCount: windowAlerts.size
        });
        windowStart = null;
        windowAlerts = new Set();
      }
    }
  }

  return windows;
}

function _calculateEntropy(proportions) {
  return -proportions.reduce((sum, p) => {
    return p > 0 ? sum + p * Math.log2(p) : sum;
  }, 0);
}

function _calculateCorrelation(x, y) {
  const n = x.length;
  const meanX = _mean(x);
  const meanY = _mean(y);

  const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
  const denominatorX = Math.sqrt(x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0));
  const denominatorY = Math.sqrt(y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0));

  return numerator / (denominatorX * denominatorY);
}

function _calculateOverallAttentionScore(metrics) {
  // Composite score (0-100) combining all metrics
  const components = [];

  // Crisis fixation (balanced is best, score peaks at 50%)
  const fixationScore = (1 - Math.abs(metrics.crisisFixation.ratio - 0.5) * 2) * 100;
  components.push(fixationScore * 0.2);

  // Peripheral neglect (higher coverage = better)
  const neglectScore = metrics.peripheralNeglect.summary.coverageRatio * 100;
  components.push(neglectScore * 0.25);

  // Response time (faster = better, normalized)
  const responseTime = metrics.responseTimes.statistics.awareness?.mean || 0;
  const responseScore = responseTime > 0 ? Math.max(0, 100 - (responseTime / 100)) : 0;
  components.push(responseScore * 0.25);

  // Coordination (if available)
  if (metrics.multiCrisisCoordination.score !== null) {
    components.push(metrics.multiCrisisCoordination.score * 100 * 0.15);
  }

  // Decision quality (if available)
  if (metrics.decisionQuality.avgQualityScore !== null) {
    components.push(metrics.decisionQuality.avgQualityScore * 0.15);
  }

  return components.reduce((sum, c) => sum + c, 0);
}

function _generateRecommendations(metrics) {
  const recommendations = [];

  // Crisis fixation recommendations
  if (metrics.crisisFixation.ratio > 0.70) {
    recommendations.push({
      category: 'crisis_fixation',
      severity: 'high',
      recommendation: 'Implement periodic radar scanning protocols to combat tunnel vision. ' +
                     'Consider using timer-based reminders to check peripheral regions.'
    });
  }

  // Peripheral neglect recommendations
  if (metrics.peripheralNeglect.summary.criticalNeglects > 0) {
    recommendations.push({
      category: 'peripheral_neglect',
      severity: 'high',
      recommendation: 'Critical regions are being neglected. Implement systematic scanning ' +
                     'patterns. Consider visual cues or alerts for unmonitored regions.'
    });
  }

  // Response time recommendations
  const avgResponse = metrics.responseTimes.statistics.awareness?.mean || 0;
  if (avgResponse > THRESHOLDS.RESPONSE_ACCEPTABLE) {
    recommendations.push({
      category: 'response_time',
      severity: 'medium',
      recommendation: 'Response times are slow. Consider alert design improvements to ' +
                     'enhance visibility and urgency communication.'
    });
  }

  // Coordination recommendations
  if (metrics.multiCrisisCoordination.score !== null &&
      metrics.multiCrisisCoordination.score < THRESHOLDS.COORDINATION_ADEQUATE) {
    recommendations.push({
      category: 'coordination',
      severity: 'medium',
      recommendation: 'Multi-crisis coordination needs improvement. Consider training on ' +
                     'priority assessment and attention management strategies.'
    });
  }

  // Decision quality recommendations
  const hastyPct = metrics.decisionQuality.profile?.hastyPercentage || 0;
  if (hastyPct > 20) {
    recommendations.push({
      category: 'decision_quality',
      severity: 'medium',
      recommendation: 'High percentage of hasty decisions detected. Encourage brief ' +
                     'situation assessment before action selection.'
    });
  }

  return recommendations;
}

// Statistical helper functions
function _mean(values) {
  return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

function _std(values) {
  const mean = _mean(values);
  const squareDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquareDiff = _mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

export default {
  THRESHOLDS,
  calculateCrisisFixationRatio,
  calculatePeripheralNeglect,
  calculateResponseTimes,
  calculateMultiCrisisCoordination,
  calculateDecisionQuality,
  generateAttentionReport,
  compareConditionMetrics
};
