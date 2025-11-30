/**
 * Tracking Analysis Utilities
 *
 * Provides analysis and visualization tools for behavioral tracking data
 */

/**
 * Generate heat map data from mouse movements
 *
 * @param {Array} mouseMovements - Array of mouse movement samples
 * @param {Object} bounds - { width, height } of the area
 * @param {Number} gridSize - Size of heat map grid cells (default: 20px)
 * @returns {Object} Heat map data
 */
export function generateHeatMap(mouseMovements, bounds, gridSize = 20) {
  const { width, height } = bounds;
  const cols = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);

  // Initialize grid
  const grid = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  // Accumulate mouse positions into grid cells
  for (const movement of mouseMovements) {
    const col = Math.floor(movement.x / gridSize);
    const row = Math.floor(movement.y / gridSize);

    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      grid[row][col]++;
    }
  }

  // Find max value for normalization
  const maxValue = Math.max(...grid.flat());

  // Normalize to 0-1 range
  const normalizedGrid = grid.map(row =>
    row.map(cell => (maxValue > 0 ? cell / maxValue : 0))
  );

  return {
    grid: normalizedGrid,
    rows,
    cols,
    gridSize,
    maxValue,
    totalSamples: mouseMovements.length
  };
}

/**
 * Convert heat map to canvas rendering data
 *
 * @param {Object} heatMapData - Heat map data from generateHeatMap
 * @param {String} colorScheme - 'hot' | 'cool' | 'viridis'
 * @returns {Array} Array of {x, y, width, height, color, intensity} objects
 */
export function heatMapToRenderData(heatMapData, colorScheme = 'hot') {
  const { grid, rows, cols, gridSize } = heatMapData;
  const renderData = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const intensity = grid[row][col];

      if (intensity > 0) {
        renderData.push({
          x: col * gridSize,
          y: row * gridSize,
          width: gridSize,
          height: gridSize,
          color: getHeatMapColor(intensity, colorScheme),
          intensity
        });
      }
    }
  }

  return renderData;
}

/**
 * Get color for heat map intensity
 *
 * @param {Number} intensity - Value between 0 and 1
 * @param {String} scheme - Color scheme
 * @returns {String} RGBA color string
 */
export function getHeatMapColor(intensity, scheme = 'hot') {
  const alpha = Math.min(intensity * 0.8, 0.8); // Max 80% opacity

  switch (scheme) {
    case 'hot':
      // Black -> Red -> Yellow -> White
      if (intensity < 0.25) {
        const t = intensity * 4;
        return `rgba(${Math.floor(255 * t)}, 0, 0, ${alpha})`;
      } else if (intensity < 0.5) {
        const t = (intensity - 0.25) * 4;
        return `rgba(255, ${Math.floor(255 * t)}, 0, ${alpha})`;
      } else if (intensity < 0.75) {
        const t = (intensity - 0.5) * 4;
        return `rgba(255, 255, ${Math.floor(255 * t)}, ${alpha})`;
      } else {
        return `rgba(255, 255, 255, ${alpha})`;
      }

    case 'cool':
      // Black -> Blue -> Cyan -> White
      if (intensity < 0.33) {
        const t = intensity * 3;
        return `rgba(0, 0, ${Math.floor(255 * t)}, ${alpha})`;
      } else if (intensity < 0.67) {
        const t = (intensity - 0.33) * 3;
        return `rgba(0, ${Math.floor(255 * t)}, 255, ${alpha})`;
      } else {
        const t = (intensity - 0.67) * 3;
        return `rgba(${Math.floor(255 * t)}, 255, 255, ${alpha})`;
      }

    case 'viridis':
      // Purple -> Blue -> Green -> Yellow
      const r = Math.floor(255 * Math.min(Math.max(intensity * 1.5 - 0.5, 0), 1));
      const g = Math.floor(255 * Math.sin(intensity * Math.PI));
      const b = Math.floor(255 * (1 - intensity));
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;

    default:
      return `rgba(255, 0, 0, ${alpha})`;
  }
}

/**
 * Generate click density map
 *
 * @param {Array} clickEvents - Array of click events
 * @param {Object} bounds - { width, height }
 * @param {Number} radius - Radius around each click (default: 30px)
 * @returns {Array} Click density data
 */
export function generateClickDensityMap(clickEvents, bounds, radius = 30) {
  const clusters = [];

  for (const click of clickEvents) {
    // Find existing cluster within radius
    let foundCluster = false;

    for (const cluster of clusters) {
      const distance = Math.sqrt(
        Math.pow(cluster.x - click.x, 2) + Math.pow(cluster.y - click.y, 2)
      );

      if (distance <= radius) {
        cluster.count++;
        cluster.clicks.push(click);
        foundCluster = true;
        break;
      }
    }

    if (!foundCluster) {
      clusters.push({
        x: click.x,
        y: click.y,
        count: 1,
        clicks: [click],
        radius
      });
    }
  }

  return clusters;
}

/**
 * Calculate gaze path (simplified eye tracking proxy)
 *
 * @param {Array} mouseMovements - Mouse movement samples
 * @param {Number} fixationThreshold - Velocity threshold for fixation (pixels/sec)
 * @param {Number} minFixationDuration - Minimum fixation duration (ms)
 * @returns {Array} Array of fixations and saccades
 */
export function calculateGazePath(
  mouseMovements,
  fixationThreshold = 50,
  minFixationDuration = 200
) {
  const gazePath = [];
  let currentFixation = null;

  for (let i = 0; i < mouseMovements.length; i++) {
    const movement = mouseMovements[i];

    if (movement.velocity < fixationThreshold) {
      // Potential fixation
      if (!currentFixation) {
        currentFixation = {
          type: 'fixation',
          startTime: movement.timestamp,
          endTime: movement.timestamp,
          x: movement.x,
          y: movement.y,
          region: movement.region,
          samples: [movement]
        };
      } else {
        currentFixation.endTime = movement.timestamp;
        currentFixation.samples.push(movement);

        // Update centroid
        const n = currentFixation.samples.length;
        currentFixation.x =
          (currentFixation.x * (n - 1) + movement.x) / n;
        currentFixation.y =
          (currentFixation.y * (n - 1) + movement.y) / n;
      }
    } else {
      // Saccade (rapid eye movement)
      if (currentFixation) {
        const duration = currentFixation.endTime - currentFixation.startTime;

        if (duration >= minFixationDuration) {
          currentFixation.duration = duration;
          gazePath.push(currentFixation);
        }

        currentFixation = null;
      }

      gazePath.push({
        type: 'saccade',
        timestamp: movement.timestamp,
        x: movement.x,
        y: movement.y,
        velocity: movement.velocity,
        region: movement.region
      });
    }
  }

  // Add final fixation if exists
  if (currentFixation) {
    const duration = currentFixation.endTime - currentFixation.startTime;
    if (duration >= minFixationDuration) {
      currentFixation.duration = duration;
      gazePath.push(currentFixation);
    }
  }

  return gazePath;
}

/**
 * Analyze attention patterns across regions
 *
 * @param {Object} trackingData - Exported tracking data
 * @returns {Object} Attention analysis
 */
export function analyzeAttentionPatterns(trackingData) {
  const { regions, tracking } = trackingData;
  const dwellTimes = tracking.dwellTimes || {};

  // Calculate total time
  const totalTime = Object.values(dwellTimes).reduce((sum, time) => sum + time, 0);

  // Analyze by region category
  const byCategory = {};
  const byRegion = {};

  for (const [regionId, dwellTime] of Object.entries(dwellTimes)) {
    const region = regions[regionId];
    if (!region) continue;

    const category = region.category || 'unknown';

    if (!byCategory[category]) {
      byCategory[category] = {
        totalTime: 0,
        percentage: 0,
        regions: []
      };
    }

    byCategory[category].totalTime += dwellTime;
    byCategory[category].regions.push(regionId);

    byRegion[regionId] = {
      name: region.name,
      category,
      dwellTime,
      percentage: totalTime > 0 ? (dwellTime / totalTime) * 100 : 0
    };
  }

  // Calculate percentages by category
  for (const category of Object.keys(byCategory)) {
    byCategory[category].percentage =
      totalTime > 0 ? (byCategory[category].totalTime / totalTime) * 100 : 0;
  }

  return {
    totalTime,
    byCategory,
    byRegion,
    dominantCategory: Object.entries(byCategory).reduce((max, [cat, data]) =>
      data.totalTime > (max.data?.totalTime || 0) ? { category: cat, data } : max
    , {}).category
  };
}

/**
 * Calculate workload metrics from tracking data
 *
 * @param {Object} trackingData - Exported tracking data
 * @returns {Object} Workload metrics
 */
export function calculateWorkloadMetrics(trackingData) {
  const { tracking, analytics } = trackingData;

  // Click rate (clicks per minute)
  const sessionDuration = (trackingData.session.endTime - trackingData.session.startTime) / 1000 / 60;
  const clickRate = sessionDuration > 0 ? tracking.clickEvents.length / sessionDuration : 0;

  // Mouse movement intensity (total distance per minute)
  const totalDistance = analytics?.mouseStatistics?.totalDistance || 0;
  const movementIntensity = sessionDuration > 0 ? totalDistance / sessionDuration : 0;

  // Scan velocity (average)
  const scanVelocity = analytics?.mouseStatistics?.averageVelocity || 0;

  // Alert load (alerts per minute)
  const alertPresentations = tracking.alertInteractions.filter(
    a => a.type === 'presented'
  ).length;
  const alertRate = sessionDuration > 0 ? alertPresentations / sessionDuration : 0;

  // Response time consistency (lower is more consistent)
  const responseTimes = analytics?.alertStatistics?.responseTimeStats;
  const responseConsistency = responseTimes
    ? responseTimes.stdDev / responseTimes.mean
    : 0;

  // Calculate composite workload score (0-100)
  const workloadScore = Math.min(
    100,
    (clickRate / 10) * 20 + // Click rate contribution (20%)
    (movementIntensity / 1000) * 20 + // Movement contribution (20%)
    (scanVelocity / 100) * 20 + // Scan velocity contribution (20%)
    (alertRate / 2) * 30 + // Alert rate contribution (30%)
    responseConsistency * 10 // Response consistency contribution (10%)
  );

  return {
    clickRate,
    movementIntensity,
    scanVelocity,
    alertRate,
    responseConsistency,
    workloadScore,
    workloadLevel:
      workloadScore > 70 ? 'high' :
      workloadScore > 40 ? 'medium' : 'low'
  };
}

/**
 * Compare tracking data between conditions
 *
 * @param {Object} condition1Data - Tracking data for condition 1
 * @param {Object} condition2Data - Tracking data for condition 2
 * @returns {Object} Comparison results
 */
export function compareConditions(condition1Data, condition2Data) {
  const metrics1 = {
    responseTime: condition1Data.analytics?.alertStatistics?.responseTimeStats?.mean || 0,
    workload: calculateWorkloadMetrics(condition1Data).workloadScore,
    radarAttention: condition1Data.analytics?.attentionMetrics?.crisisFixationRatio?.radarPercentage || 0
  };

  const metrics2 = {
    responseTime: condition2Data.analytics?.alertStatistics?.responseTimeStats?.mean || 0,
    workload: calculateWorkloadMetrics(condition2Data).workloadScore,
    radarAttention: condition2Data.analytics?.attentionMetrics?.crisisFixationRatio?.radarPercentage || 0
  };

  return {
    responseTimeDifference: metrics2.responseTime - metrics1.responseTime,
    responseTimeImprovement: metrics1.responseTime > 0
      ? ((metrics1.responseTime - metrics2.responseTime) / metrics1.responseTime) * 100
      : 0,
    workloadDifference: metrics2.workload - metrics1.workload,
    workloadReduction: metrics1.workload > 0
      ? ((metrics1.workload - metrics2.workload) / metrics1.workload) * 100
      : 0,
    radarAttentionDifference: metrics2.radarAttention - metrics1.radarAttention,
    radarAttentionImprovement: metrics1.radarAttention > 0
      ? ((metrics2.radarAttention - metrics1.radarAttention) / metrics1.radarAttention) * 100
      : 0,
    condition1: metrics1,
    condition2: metrics2
  };
}

/**
 * Calculate situational awareness score
 *
 * @param {Object} trackingData - Exported tracking data
 * @returns {Object} Situational awareness metrics
 */
export function calculateSituationalAwareness(trackingData) {
  const attention = analyzeAttentionPatterns(trackingData);
  const peripheralNeglects = trackingData.analytics?.attentionMetrics?.peripheralNeglects || {};

  // Count regions with excessive neglect
  const neglectedRegions = Object.values(peripheralNeglects).filter(
    n => n.isNeglected
  ).length;

  const totalRegions = Object.keys(trackingData.regions || {}).length;
  const coverageRatio = totalRegions > 0
    ? (totalRegions - neglectedRegions) / totalRegions
    : 0;

  // Radar attention percentage (should be high for good SA)
  const radarAttention = attention.byCategory?.radar?.percentage || 0;

  // Response time (faster = better SA)
  const responseStats = trackingData.analytics?.alertStatistics?.responseTimeStats;
  const avgResponseTime = responseStats?.mean || 0;
  const responseScore = avgResponseTime > 0
    ? Math.max(0, 100 - (avgResponseTime / 100)) // Lower time = higher score
    : 0;

  // Calculate composite SA score (0-100)
  const saScore = (
    coverageRatio * 30 + // Coverage contribution (30%)
    (radarAttention / 100) * 40 + // Radar attention contribution (40%)
    (responseScore / 100) * 30 // Response time contribution (30%)
  );

  return {
    score: saScore,
    level:
      saScore > 80 ? 'excellent' :
      saScore > 60 ? 'good' :
      saScore > 40 ? 'adequate' : 'poor',
    coverageRatio,
    radarAttentionPercentage: radarAttention,
    neglectedRegions,
    avgResponseTime
  };
}

/**
 * Generate statistical summary for research reporting
 *
 * @param {Object} trackingData - Exported tracking data
 * @returns {Object} Statistical summary
 */
export function generateStatisticalSummary(trackingData) {
  const workload = calculateWorkloadMetrics(trackingData);
  const attention = analyzeAttentionPatterns(trackingData);
  const sa = calculateSituationalAwareness(trackingData);

  const alertStats = trackingData.analytics?.alertStatistics;
  const mouseStats = trackingData.analytics?.mouseStatistics;

  return {
    session: {
      participantId: trackingData.session.participantId,
      scenario: trackingData.session.scenario,
      condition: trackingData.session.condition,
      duration: (trackingData.session.endTime - trackingData.session.startTime) / 1000
    },

    performance: {
      avgResponseTime: alertStats?.responseTimeStats?.mean || 0,
      medianResponseTime: alertStats?.responseTimeStats?.median || 0,
      responseTimeStdDev: alertStats?.responseTimeStats?.stdDev || 0,
      totalAlerts: alertStats?.totalInteractions || 0
    },

    workload: {
      score: workload.workloadScore,
      level: workload.workloadLevel,
      clickRate: workload.clickRate,
      movementIntensity: workload.movementIntensity
    },

    attention: {
      radarPercentage: attention.byCategory?.radar?.percentage || 0,
      alertPercentage: attention.byCategory?.alert?.percentage || 0,
      dominantCategory: attention.dominantCategory
    },

    situationalAwareness: {
      score: sa.score,
      level: sa.level,
      coverageRatio: sa.coverageRatio
    },

    interactions: {
      mouseMovements: mouseStats?.sampleCount || 0,
      totalDistance: mouseStats?.totalDistance || 0,
      avgVelocity: mouseStats?.averageVelocity || 0,
      totalClicks: trackingData.tracking?.clickEvents?.length || 0
    }
  };
}

/**
 * Export functions for external use
 */
export default {
  generateHeatMap,
  heatMapToRenderData,
  getHeatMapColor,
  generateClickDensityMap,
  calculateGazePath,
  analyzeAttentionPatterns,
  calculateWorkloadMetrics,
  compareConditions,
  calculateSituationalAwareness,
  generateStatisticalSummary
};
