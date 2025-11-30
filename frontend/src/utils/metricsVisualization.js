/**
 * Metrics Visualization Utilities
 *
 * Tools for visualizing attention metrics in research dashboards
 */

/**
 * Generate data for crisis fixation ratio chart
 *
 * @param {Object} crisisFixationData - Crisis fixation metrics
 * @returns {Object} Chart data
 */
export function getCrisisFixationChartData(crisisFixationData) {
  return {
    type: 'pie',
    data: {
      labels: ['Crisis Time', 'Radar Time', 'Other'],
      datasets: [{
        data: [
          crisisFixationData.crisisTime,
          crisisFixationData.radarTime,
          crisisFixationData.totalTime - crisisFixationData.crisisTime - crisisFixationData.radarTime
        ],
        backgroundColor: [
          '#ff5722', // Crisis - Red
          '#4caf50', // Radar - Green
          '#9e9e9e'  // Other - Gray
        ]
      }]
    },
    options: {
      title: {
        display: true,
        text: `Crisis Fixation Ratio: ${(crisisFixationData.ratio * 100).toFixed(1)}%`
      },
      legend: {
        position: 'bottom'
      }
    }
  };
}

/**
 * Generate data for response time distribution chart
 *
 * @param {Object} responseTimeData - Response time metrics
 * @returns {Object} Chart data
 */
export function getResponseTimeChartData(responseTimeData) {
  const { byAlert } = responseTimeData;

  const times = Object.values(byAlert)
    .map(a => a.awareness || a.recognition)
    .filter(t => t !== null)
    .sort((a, b) => a - b);

  // Create histogram bins
  const bins = [0, 2000, 4000, 6000, 10000, Infinity];
  const binLabels = ['<2s', '2-4s', '4-6s', '6-10s', '>10s'];
  const binCounts = bins.slice(0, -1).map((_, i) => {
    return times.filter(t => t >= bins[i] && t < bins[i + 1]).length;
  });

  return {
    type: 'bar',
    data: {
      labels: binLabels,
      datasets: [{
        label: 'Number of Alerts',
        data: binCounts,
        backgroundColor: [
          '#4caf50', // <2s - Green (Excellent)
          '#8bc34a', // 2-4s - Light Green (Good)
          '#ffc107', // 4-6s - Yellow (Acceptable)
          '#ff9800', // 6-10s - Orange (Poor)
          '#f44336'  // >10s - Red (Very Poor)
        ]
      }]
    },
    options: {
      title: {
        display: true,
        text: `Response Time Distribution (Avg: ${responseTimeData.statistics.awareness?.mean.toFixed(0)}ms)`
      },
      scales: {
        yAxes: [{
          ticks: { beginAtZero: true }
        }]
      }
    }
  };
}

/**
 * Generate data for peripheral neglect heatmap
 *
 * @param {Object} neglectData - Peripheral neglect metrics
 * @returns {Array} Heatmap cells
 */
export function getPeripheralNeglectHeatmap(neglectData) {
  return Object.entries(neglectData.byRegion).map(([regionId, data]) => {
    let color;
    let severity;

    if (data.neglectStatus === 'never_visited' || data.neglectStatus === 'critical_neglect') {
      color = '#f44336';
      severity = 'critical';
    } else if (data.neglectStatus === 'warning_neglect') {
      color = '#ff9800';
      severity = 'warning';
    } else if (data.neglectStatus === 'acceptable') {
      color = '#ffc107';
      severity = 'acceptable';
    } else {
      color = '#4caf50';
      severity = 'good';
    }

    return {
      regionId,
      regionName: data.regionName,
      timeSinceVisit: data.timeSinceVisit,
      visitCount: data.visitCount,
      color,
      severity,
      label: data.timeSinceVisit
        ? `${(data.timeSinceVisit / 1000).toFixed(1)}s`
        : 'Never'
    };
  });
}

/**
 * Generate data for multi-crisis coordination timeline
 *
 * @param {Object} coordinationData - Coordination metrics
 * @returns {Array} Timeline events
 */
export function getCoordinationTimeline(coordinationData) {
  if (!coordinationData.byWindow) return [];

  return coordinationData.byWindow.map((window, index) => ({
    id: `window_${index}`,
    startTime: window.startTime,
    endTime: window.endTime,
    duration: window.duration,
    crisisCount: window.crisisCount,
    coordinationScore: window.coordinationScore,
    classification: window.classification,
    alertIds: window.alertIds,
    color: _getCoordinationColor(window.coordinationScore),
    label: `${window.crisisCount} crises - Score: ${(window.coordinationScore * 100).toFixed(0)}`
  }));
}

/**
 * Generate data for decision quality scatter plot
 *
 * @param {Object} decisionQualityData - Decision quality metrics
 * @returns {Object} Scatter plot data
 */
export function getDecisionQualityScatter(decisionQualityData) {
  const points = Object.values(decisionQualityData.byAlert).map(decision => ({
    x: decision.responseTime,
    y: decision.qualityScore || 50,
    alertId: decision.alertId,
    category: decision.category,
    color: _getCategoryColor(decision.category)
  }));

  return {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Decisions',
        data: points.map(p => ({ x: p.x, y: p.y })),
        backgroundColor: points.map(p => p.color),
        pointRadius: 6
      }]
    },
    options: {
      title: {
        display: true,
        text: 'Decision Quality: Speed vs. Accuracy'
      },
      scales: {
        xAxes: [{
          scaleLabel: {
            display: true,
            labelString: 'Response Time (ms)'
          }
        }],
        yAxes: [{
          scaleLabel: {
            display: true,
            labelString: 'Quality Score'
          },
          ticks: {
            min: 0,
            max: 100
          }
        }]
      }
    }
  };
}

/**
 * Generate summary dashboard metrics
 *
 * @param {Object} attentionReport - Complete attention report
 * @returns {Array} Dashboard metric cards
 */
export function getDashboardMetrics(attentionReport) {
  const { metrics, summary } = attentionReport;

  return [
    {
      id: 'crisis_fixation',
      title: 'Crisis Fixation Ratio',
      value: `${(metrics.crisisFixation.ratio * 100).toFixed(1)}%`,
      status: metrics.crisisFixation.severity,
      description: metrics.crisisFixation.classification,
      trend: _getTrend(metrics.crisisFixation.ratio, 0.5, true) // Inverse: closer to 0.5 is better
    },
    {
      id: 'peripheral_neglect',
      title: 'Coverage Ratio',
      value: `${(metrics.peripheralNeglect.summary.coverageRatio * 100).toFixed(1)}%`,
      status: metrics.peripheralNeglect.overallStatus,
      description: `${metrics.peripheralNeglect.summary.neglectedRegions} regions neglected`,
      trend: _getTrend(metrics.peripheralNeglect.summary.coverageRatio, 0.85, false)
    },
    {
      id: 'response_time',
      title: 'Avg Response Time',
      value: metrics.responseTimes.statistics.awareness?.mean
        ? `${(metrics.responseTimes.statistics.awareness.mean / 1000).toFixed(2)}s`
        : 'N/A',
      status: _getResponseTimeStatus(metrics.responseTimes.statistics.awareness?.mean),
      description: `${metrics.responseTimes.totalAlerts} alerts`,
      trend: _getTrend(
        metrics.responseTimes.statistics.awareness?.mean || 0,
        4000,
        true // Inverse: lower is better
      )
    },
    {
      id: 'coordination',
      title: 'Coordination Score',
      value: metrics.multiCrisisCoordination.score !== null
        ? `${(metrics.multiCrisisCoordination.score * 100).toFixed(0)}/100`
        : 'N/A',
      status: metrics.multiCrisisCoordination.classification,
      description: metrics.multiCrisisCoordination.hasMultiCrisis
        ? `${metrics.multiCrisisCoordination.concurrentWindows} concurrent windows`
        : 'No multi-crisis events',
      trend: _getTrend(metrics.multiCrisisCoordination.score || 0, 0.7, false)
    },
    {
      id: 'decision_quality',
      title: 'Decision Quality',
      value: metrics.decisionQuality.avgQualityScore !== null
        ? `${metrics.decisionQuality.avgQualityScore.toFixed(0)}/100`
        : 'N/A',
      status: metrics.decisionQuality.qualityLevel,
      description: `${metrics.decisionQuality.profile.optimalPercentage?.toFixed(0)}% optimal decisions`,
      trend: _getTrend(metrics.decisionQuality.avgQualityScore || 0, 70, false)
    },
    {
      id: 'overall',
      title: 'Overall Attention Score',
      value: `${summary.overallAttentionScore.toFixed(0)}/100`,
      status: _getOverallStatus(summary.overallAttentionScore),
      description: 'Composite attention metric',
      trend: _getTrend(summary.overallAttentionScore, 70, false)
    }
  ];
}

/**
 * Generate comparison chart between conditions
 *
 * @param {Object} comparisonData - Condition comparison data
 * @param {String} metric - Metric to compare ('crisisFixationRatio', 'avgResponseTime', etc.)
 * @returns {Object} Chart data
 */
export function getConditionComparisonChart(comparisonData, metric) {
  const conditions = Object.keys(comparisonData.byCondition).sort();

  const metricConfig = {
    crisisFixationRatio: {
      label: 'Crisis Fixation Ratio',
      unit: '',
      inverse: true // Lower is better (closer to balanced)
    },
    avgResponseTime: {
      label: 'Average Response Time',
      unit: 'ms',
      inverse: true // Lower is better
    },
    coordinationScore: {
      label: 'Coordination Score',
      unit: '',
      inverse: false // Higher is better
    },
    peripheralNeglectCoverage: {
      label: 'Coverage Ratio',
      unit: '',
      inverse: false // Higher is better
    },
    decisionQuality: {
      label: 'Decision Quality Score',
      unit: '',
      inverse: false // Higher is better
    }
  };

  const config = metricConfig[metric] || {
    label: metric,
    unit: '',
    inverse: false
  };

  const means = conditions.map(c => comparisonData.byCondition[c][metric].mean);
  const stds = conditions.map(c => comparisonData.byCondition[c][metric].std);

  return {
    type: 'bar',
    data: {
      labels: conditions.map(c => `Condition ${c}`),
      datasets: [{
        label: config.label,
        data: means,
        backgroundColor: conditions.map((_, i) => _getConditionColor(i)),
        errorBars: stds.map((std, i) => ({
          plus: std,
          minus: std
        }))
      }]
    },
    options: {
      title: {
        display: true,
        text: `${config.label} by Condition`
      },
      scales: {
        yAxes: [{
          scaleLabel: {
            display: true,
            labelString: config.unit
          },
          ticks: { beginAtZero: true }
        }]
      },
      legend: {
        display: false
      }
    }
  };
}

/**
 * Generate attention pattern radar chart
 *
 * @param {Object} attentionReport - Attention report
 * @returns {Object} Radar chart data
 */
export function getAttentionRadarChart(attentionReport) {
  const { metrics } = attentionReport;

  // Normalize all metrics to 0-100 scale
  const data = [
    // Crisis fixation (inverse - balanced is best)
    (1 - Math.abs(metrics.crisisFixation.ratio - 0.5) * 2) * 100,

    // Coverage ratio
    metrics.peripheralNeglect.summary.coverageRatio * 100,

    // Response time (normalized inverse)
    Math.max(0, 100 - (metrics.responseTimes.statistics.awareness?.mean || 0) / 100),

    // Coordination score
    (metrics.multiCrisisCoordination.score || 0) * 100,

    // Decision quality
    metrics.decisionQuality.avgQualityScore || 50
  ];

  return {
    type: 'radar',
    data: {
      labels: [
        'Attention Balance',
        'Coverage',
        'Response Speed',
        'Coordination',
        'Decision Quality'
      ],
      datasets: [{
        label: `Condition ${attentionReport.session.condition}`,
        data,
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        borderColor: '#4caf50',
        pointBackgroundColor: '#4caf50',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#4caf50'
      }]
    },
    options: {
      title: {
        display: true,
        text: 'Attention Performance Profile'
      },
      scale: {
        ticks: {
          min: 0,
          max: 100
        }
      }
    }
  };
}

/**
 * Format metric value for display
 *
 * @param {Number} value - Metric value
 * @param {String} type - Metric type
 * @returns {String} Formatted value
 */
export function formatMetricValue(value, type) {
  if (value === null || value === undefined) return 'N/A';

  switch (type) {
    case 'percentage':
      return `${(value * 100).toFixed(1)}%`;

    case 'time_ms':
      return `${value.toFixed(0)}ms`;

    case 'time_s':
      return `${(value / 1000).toFixed(2)}s`;

    case 'score':
      return `${value.toFixed(0)}/100`;

    case 'ratio':
      return value.toFixed(3);

    default:
      return value.toString();
  }
}

/**
 * Get color for metric status
 *
 * @param {String} status - Status string
 * @returns {String} Color hex code
 */
export function getStatusColor(status) {
  const colors = {
    excellent: '#4caf50',
    good: '#8bc34a',
    acceptable: '#ffc107',
    warning: '#ff9800',
    poor: '#ff5722',
    critical: '#f44336',
    unknown: '#9e9e9e'
  };

  return colors[status] || colors.unknown;
}

/**
 * Get icon for metric
 *
 * @param {String} metricId - Metric identifier
 * @returns {String} Emoji icon
 */
export function getMetricIcon(metricId) {
  const icons = {
    crisis_fixation: '',
    peripheral_neglect: '',
    response_time: '',
    coordination: '',
    decision_quality: '',
    overall: ''
  };

  return icons[metricId] || '';
}

/* =========================================================================
   PRIVATE HELPER FUNCTIONS
   ========================================================================= */

function _getCoordinationColor(score) {
  if (score > 0.85) return '#4caf50';
  if (score > 0.70) return '#8bc34a';
  if (score > 0.50) return '#ffc107';
  return '#ff5722';
}

function _getCategoryColor(category) {
  const colors = {
    hasty: '#ff5722',
    optimal: '#4caf50',
    delayed: '#ff9800',
    excessive: '#f44336'
  };
  return colors[category] || '#9e9e9e';
}

function _getConditionColor(index) {
  const colors = ['#2196f3', '#ff9800', '#9c27b0'];
  return colors[index % colors.length];
}

function _getResponseTimeStatus(responseTime) {
  if (!responseTime) return 'unknown';
  if (responseTime < 2000) return 'excellent';
  if (responseTime < 4000) return 'good';
  if (responseTime < 6000) return 'acceptable';
  if (responseTime < 10000) return 'poor';
  return 'critical';
}

function _getOverallStatus(score) {
  if (score > 80) return 'excellent';
  if (score > 65) return 'good';
  if (score > 50) return 'acceptable';
  return 'poor';
}

function _getTrend(value, threshold, inverse) {
  if (value === null || value === undefined) return 'neutral';

  const comparison = inverse ? value < threshold : value > threshold;
  return comparison ? 'positive' : 'negative';
}

export default {
  getCrisisFixationChartData,
  getResponseTimeChartData,
  getPeripheralNeglectHeatmap,
  getCoordinationTimeline,
  getDecisionQualityScatter,
  getDashboardMetrics,
  getConditionComparisonChart,
  getAttentionRadarChart,
  formatMetricValue,
  getStatusColor,
  getMetricIcon
};
