/**
 * Attention Metrics - Usage Examples
 *
 * Demonstrates how to calculate and use attention metrics
 * for research analysis
 */

import React, { useState, useEffect } from 'react';
import attentionMetrics from '../services/attentionMetrics';
import metricsVisualization from '../utils/metricsVisualization';
import behavioralTracker from '../services/behavioralTracker';

/**
 * Example 1: Calculate Crisis Fixation Ratio
 */
export function Example1_CrisisFixation() {
  const [trackingData, setTrackingData] = useState(null);
  const [fixationMetrics, setFixationMetrics] = useState(null);

  // Simulate loading tracking data
  useEffect(() => {
    // In real usage, this would come from behavioralTracker.exportData()
    const mockData = {
      session: {
        participantId: 'P001',
        condition: 1,
        startTime: Date.now() - 300000,
        endTime: Date.now()
      },
      regions: {
        radar_north: { name: 'North Radar', category: 'radar' },
        radar_south: { name: 'South Radar', category: 'radar' },
        alert_banner: { name: 'Alert Banner', category: 'alert', isCrisis: true }
      },
      tracking: {
        dwellTimes: {
          radar_north: 45000,
          radar_south: 38000,
          alert_banner: 120000 // Excessive time on alert
        }
      }
    };

    setTrackingData(mockData);

    // Calculate crisis fixation
    const metrics = attentionMetrics.calculateCrisisFixationRatio(mockData);
    setFixationMetrics(metrics);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 1: Crisis Fixation Ratio</h2>

      {fixationMetrics && (
        <div>
          <div style={{
            background: metricsVisualization.getStatusColor(fixationMetrics.severity),
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3>Crisis Fixation: {(fixationMetrics.ratio * 100).toFixed(1)}%</h3>
            <p><strong>Classification:</strong> {fixationMetrics.classification}</p>
            <p><strong>Status:</strong> {fixationMetrics.severity}</p>
          </div>

          <div style={{
            background: '#f5f5f5',
            padding: '15px',
            borderRadius: '4px',
            marginBottom: '15px'
          }}>
            <h4>Time Breakdown:</h4>
            <p>Crisis Time: {(fixationMetrics.crisisTime / 1000).toFixed(1)}s</p>
            <p>Radar Time: {(fixationMetrics.radarTime / 1000).toFixed(1)}s</p>
            <p>Total Time: {(fixationMetrics.totalTime / 1000).toFixed(1)}s</p>
            <p>Balance Score: {(fixationMetrics.metrics.balanceScore * 100).toFixed(1)}/100</p>
          </div>

          <div style={{
            background: '#e3f2fd',
            padding: '15px',
            borderRadius: '4px'
          }}>
            <h4>Interpretation:</h4>
            <p>{fixationMetrics.interpretation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example 2: Peripheral Neglect Analysis
 */
export function Example2_PeripheralNeglect() {
  const [neglectMetrics, setNeglectMetrics] = useState(null);

  useEffect(() => {
    const mockData = {
      session: {
        participantId: 'P001',
        startTime: Date.now() - 300000,
        endTime: Date.now()
      },
      regions: {
        northern_cluster: { name: 'Northern Cluster', category: 'radar' },
        southern_cluster: { name: 'Southern Cluster', category: 'radar' },
        eastern_sector: { name: 'Eastern Sector', category: 'radar' },
        control_panel: { name: 'Control Panel', category: 'control' }
      },
      tracking: {
        mouseMovements: [
          { x: 100, y: 100, timestamp: Date.now() - 280000, region: 'northern_cluster' },
          { x: 100, y: 300, timestamp: Date.now() - 240000, region: 'southern_cluster' },
          { x: 100, y: 100, timestamp: Date.now() - 60000, region: 'northern_cluster' },
          // eastern_sector never visited - critical neglect
          { x: 500, y: 300, timestamp: Date.now() - 120000, region: 'control_panel' }
        ]
      }
    };

    const metrics = attentionMetrics.calculatePeripheralNeglect(mockData);
    setNeglectMetrics(metrics);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 2: Peripheral Neglect</h2>

      {neglectMetrics && (
        <div>
          <div style={{
            background: metricsVisualization.getStatusColor(neglectMetrics.overallStatus),
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3>Coverage: {(neglectMetrics.summary.coverageRatio * 100).toFixed(1)}%</h3>
            <p><strong>Neglected Regions:</strong> {neglectMetrics.summary.neglectedRegions} / {neglectMetrics.summary.totalRegions}</p>
            <p><strong>Critical Neglects:</strong> {neglectMetrics.summary.criticalNeglects}</p>
          </div>

          <h4>Region Details:</h4>
          {Object.entries(neglectMetrics.byRegion).map(([regionId, data]) => (
            <div
              key={regionId}
              style={{
                background: '#f5f5f5',
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '4px',
                borderLeft: `4px solid ${metricsVisualization.getStatusColor(data.severity)}`
              }}
            >
              <strong>{data.regionName}</strong>
              <p>
                Status: {data.neglectStatus} |
                Time Since Visit: {data.timeSinceVisit
                  ? `${(data.timeSinceVisit / 1000).toFixed(1)}s`
                  : 'Never'} |
                Visits: {data.visitCount}
              </p>
            </div>
          ))}

          {neglectMetrics.mostNeglected && (
            <div style={{
              background: '#ffebee',
              padding: '15px',
              borderRadius: '4px',
              marginTop: '20px'
            }}>
              <h4>Most Neglected Region:</h4>
              <p><strong>{neglectMetrics.mostNeglected.regionName}</strong></p>
              <p>Time since visit: {(neglectMetrics.mostNeglected.timeSinceVisit / 1000).toFixed(1)}s</p>
            </div>
          )}

          <div style={{
            background: '#e3f2fd',
            padding: '15px',
            borderRadius: '4px',
            marginTop: '15px'
          }}>
            <h4>Interpretation:</h4>
            <p>{neglectMetrics.interpretation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example 3: Response Time Analysis
 */
export function Example3_ResponseTimes() {
  const [responseMetrics, setResponseMetrics] = useState(null);

  useEffect(() => {
    const baseTime = Date.now() - 300000;

    const mockData = {
      session: {
        participantId: 'P001',
        startTime: baseTime,
        endTime: Date.now()
      },
      tracking: {
        alertInteractions: [
          // Alert 1 - Quick response
          { alertId: 'alert_001', type: 'presented', timestamp: baseTime + 10000, severity: 'warning' },
          { alertId: 'alert_001', type: 'action_clicked', timestamp: baseTime + 12500 },
          { alertId: 'alert_001', type: 'acknowledged', timestamp: baseTime + 13000 },

          // Alert 2 - Slow response
          { alertId: 'alert_002', type: 'presented', timestamp: baseTime + 60000, severity: 'critical' },
          { alertId: 'alert_002', type: 'acknowledged', timestamp: baseTime + 68000 },

          // Alert 3 - Fast response
          { alertId: 'alert_003', type: 'presented', timestamp: baseTime + 120000, severity: 'advisory' },
          { alertId: 'alert_003', type: 'action_clicked', timestamp: baseTime + 121500 },
          { alertId: 'alert_003', type: 'acknowledged', timestamp: baseTime + 122000 }
        ]
      }
    };

    const metrics = attentionMetrics.calculateResponseTimes(mockData);
    setResponseMetrics(metrics);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 3: Response Time Analysis</h2>

      {responseMetrics && (
        <div>
          <div style={{
            background: '#4caf50',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3>Average Response Time</h3>
            <p style={{ fontSize: '32px', margin: '10px 0' }}>
              {(responseMetrics.statistics.awareness.mean / 1000).toFixed(2)}s
            </p>
            <p>Total Alerts: {responseMetrics.totalAlerts}</p>
          </div>

          <h4>Statistics:</h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '4px' }}>
              <strong>Awareness</strong>
              <p>Mean: {(responseMetrics.statistics.awareness.mean / 1000).toFixed(2)}s</p>
              <p>Median: {(responseMetrics.statistics.awareness.median / 1000).toFixed(2)}s</p>
              <p>Range: {(responseMetrics.statistics.awareness.min / 1000).toFixed(2)}s - {(responseMetrics.statistics.awareness.max / 1000).toFixed(2)}s</p>
            </div>

            {responseMetrics.statistics.recognition && (
              <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '4px' }}>
                <strong>Recognition</strong>
                <p>Mean: {(responseMetrics.statistics.recognition.mean / 1000).toFixed(2)}s</p>
                <p>Median: {(responseMetrics.statistics.recognition.median / 1000).toFixed(2)}s</p>
              </div>
            )}

            {responseMetrics.statistics.decision && (
              <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '4px' }}>
                <strong>Decision</strong>
                <p>Mean: {(responseMetrics.statistics.decision.mean / 1000).toFixed(2)}s</p>
                <p>Median: {(responseMetrics.statistics.decision.median / 1000).toFixed(2)}s</p>
              </div>
            )}
          </div>

          <h4>By Severity:</h4>
          {Object.entries(responseMetrics.bySeverity).map(([severity, stats]) => (
            <div
              key={severity}
              style={{
                background: '#f5f5f5',
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '4px'
              }}
            >
              <strong>{severity.toUpperCase()}</strong>
              <p>
                Mean: {(stats.mean / 1000).toFixed(2)}s |
                Count: {stats.count} |
                Range: {(stats.min / 1000).toFixed(2)}s - {(stats.max / 1000).toFixed(2)}s
              </p>
            </div>
          ))}

          <div style={{
            background: '#e3f2fd',
            padding: '15px',
            borderRadius: '4px',
            marginTop: '15px'
          }}>
            <h4>Interpretation:</h4>
            <p>{responseMetrics.interpretation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example 4: Multi-Crisis Coordination
 */
export function Example4_MultiCrisisCoordination() {
  const [coordinationMetrics, setCoordinationMetrics] = useState(null);

  useEffect(() => {
    const baseTime = Date.now() - 300000;

    const mockData = {
      session: {
        participantId: 'P001',
        startTime: baseTime,
        endTime: Date.now()
      },
      tracking: {
        alertInteractions: [
          // Window 1: Two concurrent crises
          { alertId: 'crisis_A', type: 'presented', timestamp: baseTime + 10000 },
          { alertId: 'crisis_B', type: 'presented', timestamp: baseTime + 12000 },
          { alertId: 'crisis_A', type: 'acknowledged', timestamp: baseTime + 25000 },
          { alertId: 'crisis_B', type: 'acknowledged', timestamp: baseTime + 30000 },

          // Window 2: Three concurrent crises
          { alertId: 'crisis_C', type: 'presented', timestamp: baseTime + 100000 },
          { alertId: 'crisis_D', type: 'presented', timestamp: baseTime + 105000 },
          { alertId: 'crisis_E', type: 'presented', timestamp: baseTime + 108000 },
          { alertId: 'crisis_C', type: 'acknowledged', timestamp: baseTime + 120000 },
          { alertId: 'crisis_D', type: 'acknowledged', timestamp: baseTime + 125000 },
          { alertId: 'crisis_E', type: 'acknowledged', timestamp: baseTime + 130000 }
        ],
        mouseMovements: _generateMockMovements(baseTime)
      }
    };

    const metrics = attentionMetrics.calculateMultiCrisisCoordination(mockData);
    setCoordinationMetrics(metrics);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 4: Multi-Crisis Coordination</h2>

      {coordinationMetrics && coordinationMetrics.hasMultiCrisis && (
        <div>
          <div style={{
            background: metricsVisualization.getStatusColor(coordinationMetrics.classification),
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3>Coordination Score: {(coordinationMetrics.score * 100).toFixed(0)}/100</h3>
            <p><strong>Classification:</strong> {coordinationMetrics.classification}</p>
            <p><strong>Concurrent Windows:</strong> {coordinationMetrics.concurrentWindows}</p>
          </div>

          <h4>Multi-Crisis Windows:</h4>
          {coordinationMetrics.byWindow.map((window, index) => (
            <div
              key={index}
              style={{
                background: '#f5f5f5',
                padding: '15px',
                marginBottom: '15px',
                borderRadius: '4px',
                borderLeft: `4px solid ${metricsVisualization.getStatusColor(window.classification)}`
              }}
            >
              <strong>Window {index + 1}</strong>
              <p>Duration: {(window.duration / 1000).toFixed(1)}s</p>
              <p>Crisis Count: {window.crisisCount}</p>
              <p>Coordination Score: {(window.coordinationScore * 100).toFixed(0)}/100</p>
              <p>Switch Rate: {window.switchRate.toFixed(2)} switches/second</p>
              <p>Attention Entropy: {(window.entropy * 100).toFixed(1)}%</p>
              <p>Alerts: {window.alertIds.join(', ')}</p>
            </div>
          ))}

          <div style={{
            background: '#e3f2fd',
            padding: '15px',
            borderRadius: '4px',
            marginTop: '15px'
          }}>
            <h4>Interpretation:</h4>
            <p>{coordinationMetrics.interpretation}</p>
          </div>
        </div>
      )}

      {coordinationMetrics && !coordinationMetrics.hasMultiCrisis && (
        <p>No multi-crisis events detected during this session.</p>
      )}
    </div>
  );
}

/**
 * Example 5: Decision Quality Analysis
 */
export function Example5_DecisionQuality() {
  const [decisionMetrics, setDecisionMetrics] = useState(null);

  useEffect(() => {
    const baseTime = Date.now() - 300000;

    const mockData = {
      session: {
        participantId: 'P001',
        startTime: baseTime,
        endTime: Date.now()
      },
      tracking: {
        alertInteractions: [
          { alertId: 'alert_001', type: 'presented', timestamp: baseTime + 10000, severity: 'critical' },
          { alertId: 'alert_001', type: 'acknowledged', timestamp: baseTime + 10300 }, // 300ms - hasty

          { alertId: 'alert_002', type: 'presented', timestamp: baseTime + 60000, severity: 'warning' },
          { alertId: 'alert_002', type: 'acknowledged', timestamp: baseTime + 63000 }, // 3s - optimal

          { alertId: 'alert_003', type: 'presented', timestamp: baseTime + 120000, severity: 'advisory' },
          { alertId: 'alert_003', type: 'acknowledged', timestamp: baseTime + 132000 } // 12s - excessive
        ]
      }
    };

    // Mock decision outcomes
    const outcomes = [
      { alertId: 'alert_001', wasCorrect: false, wasOptimal: false }, // Hasty, incorrect
      { alertId: 'alert_002', wasCorrect: true, wasOptimal: true },   // Optimal, correct
      { alertId: 'alert_003', wasCorrect: true, wasOptimal: false }   // Slow, but correct
    ];

    const responseTimes = attentionMetrics.calculateResponseTimes(mockData);
    const metrics = attentionMetrics.calculateDecisionQuality(
      { ...mockData, responseTimes },
      outcomes
    );
    setDecisionMetrics(metrics);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 5: Decision Quality</h2>

      {decisionMetrics && (
        <div>
          <div style={{
            background: metricsVisualization.getStatusColor(decisionMetrics.qualityLevel),
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3>Average Quality Score: {decisionMetrics.avgQualityScore.toFixed(0)}/100</h3>
            <p><strong>Level:</strong> {decisionMetrics.qualityLevel}</p>
            <p><strong>Total Decisions:</strong> {decisionMetrics.totalDecisions}</p>
          </div>

          <h4>Speed-Accuracy Profile:</h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '10px',
            marginBottom: '20px'
          }}>
            <div style={{ background: '#ffebee', padding: '15px', borderRadius: '4px' }}>
              <strong>Hasty</strong>
              <p style={{ fontSize: '24px', margin: '5px 0' }}>{decisionMetrics.profile.hasty}</p>
              <p style={{ fontSize: '12px' }}>{decisionMetrics.profile.hastyPercentage.toFixed(1)}%</p>
            </div>

            <div style={{ background: '#e8f5e9', padding: '15px', borderRadius: '4px' }}>
              <strong>Optimal</strong>
              <p style={{ fontSize: '24px', margin: '5px 0' }}>{decisionMetrics.profile.optimal}</p>
              <p style={{ fontSize: '12px' }}>{decisionMetrics.profile.optimalPercentage.toFixed(1)}%</p>
            </div>

            <div style={{ background: '#fff3e0', padding: '15px', borderRadius: '4px' }}>
              <strong>Delayed</strong>
              <p style={{ fontSize: '24px', margin: '5px 0' }}>{decisionMetrics.profile.delayed}</p>
            </div>

            <div style={{ background: '#fce4ec', padding: '15px', borderRadius: '4px' }}>
              <strong>Excessive</strong>
              <p style={{ fontSize: '24px', margin: '5px 0' }}>{decisionMetrics.profile.excessive}</p>
            </div>
          </div>

          <h4>Individual Decisions:</h4>
          {Object.values(decisionMetrics.byAlert).map((decision, index) => (
            <div
              key={decision.alertId}
              style={{
                background: '#f5f5f5',
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '4px',
                borderLeft: `4px solid ${
                  decision.category === 'hasty' ? '#ff5722' :
                  decision.category === 'optimal' ? '#4caf50' :
                  decision.category === 'delayed' ? '#ff9800' : '#f44336'
                }`
              }}
            >
              <strong>{decision.alertId}</strong>
              <p>
                Time: {(decision.responseTime / 1000).toFixed(2)}s |
                Category: {decision.category} |
                Quality: {decision.qualityScore.toFixed(0)}/100
                {decision.wasCorrect !== undefined && (
                  <span> | Correct: {decision.wasCorrect ? '✓' : '✗'}</span>
                )}
              </p>
            </div>
          ))}

          <div style={{
            background: '#e3f2fd',
            padding: '15px',
            borderRadius: '4px',
            marginTop: '15px'
          }}>
            <h4>Interpretation:</h4>
            <p>{decisionMetrics.interpretation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Example 6: Complete Attention Report
 */
export function Example6_CompleteReport() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    // Generate mock tracking data
    const trackingData = _generateMockTrackingData();

    // Generate comprehensive report
    const attentionReport = attentionMetrics.generateAttentionReport(trackingData, {
      crisisAlertIds: ['alert_001', 'alert_002'],
      includeInterpretations: true
    });

    setReport(attentionReport);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 6: Complete Attention Report</h2>

      {report && (
        <div>
          <div style={{
            background: '#5e35b1',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3>Session Overview</h3>
            <p><strong>Participant:</strong> {report.session.participantId}</p>
            <p><strong>Scenario:</strong> {report.session.scenario}</p>
            <p><strong>Condition:</strong> {report.session.condition}</p>
            <p><strong>Duration:</strong> {(report.session.duration / 1000 / 60).toFixed(1)} minutes</p>
          </div>

          <div style={{
            background: '#f5f5f5',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3>Overall Attention Score</h3>
            <p style={{ fontSize: '48px', margin: '10px 0', textAlign: 'center' }}>
              {report.summary.overallAttentionScore.toFixed(0)}/100
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <div style={{ background: '#fff', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h4>🎯 Crisis Fixation</h4>
              <p>{report.summary.crisisFixationStatus}</p>
              <p style={{ fontSize: '24px' }}>
                {(report.metrics.crisisFixation.ratio * 100).toFixed(1)}%
              </p>
            </div>

            <div style={{ background: '#fff', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h4>👁️ Coverage</h4>
              <p>{report.summary.neglectStatus}</p>
              <p style={{ fontSize: '24px' }}>
                {(report.metrics.peripheralNeglect.summary.coverageRatio * 100).toFixed(1)}%
              </p>
            </div>

            <div style={{ background: '#fff', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h4>⚡ Response Time</h4>
              <p>Average awareness time</p>
              <p style={{ fontSize: '24px' }}>
                {(report.summary.avgResponseTime / 1000).toFixed(2)}s
              </p>
            </div>

            <div style={{ background: '#fff', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h4>🎭 Coordination</h4>
              <p>{report.metrics.multiCrisisCoordination.classification}</p>
              <p style={{ fontSize: '24px' }}>
                {report.summary.coordinationScore !== null
                  ? `${(report.summary.coordinationScore * 100).toFixed(0)}/100`
                  : 'N/A'}
              </p>
            </div>

            <div style={{ background: '#fff', padding: '15px', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              <h4>🧠 Decision Quality</h4>
              <p>{report.metrics.decisionQuality.qualityLevel}</p>
              <p style={{ fontSize: '24px' }}>
                {report.summary.decisionQuality !== null
                  ? `${report.summary.decisionQuality.toFixed(0)}/100`
                  : 'N/A'}
              </p>
            </div>
          </div>

          {report.recommendations.length > 0 && (
            <div style={{
              background: '#fff3e0',
              padding: '20px',
              borderRadius: '8px'
            }}>
              <h3>Recommendations</h3>
              {report.recommendations.map((rec, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: '10px',
                    paddingBottom: '10px',
                    borderBottom: index < report.recommendations.length - 1 ? '1px solid #ccc' : 'none'
                  }}
                >
                  <strong style={{
                    color: rec.severity === 'high' ? '#f44336' : '#ff9800'
                  }}>
                    {rec.category.replace(/_/g, ' ').toUpperCase()}
                  </strong>
                  <p>{rec.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Example 7: Condition Comparison
 */
export function Example7_ConditionComparison() {
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    // Generate mock reports for each condition
    const reports = [
      _generateMockReport(1, 'P001'),
      _generateMockReport(1, 'P002'),
      _generateMockReport(2, 'P003'),
      _generateMockReport(2, 'P004'),
      _generateMockReport(3, 'P005'),
      _generateMockReport(3, 'P006')
    ];

    const comparisonData = attentionMetrics.compareConditionMetrics(reports);
    setComparison(comparisonData);
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Example 7: Condition Comparison</h2>

      {comparison && (
        <div>
          <div style={{
            background: '#f5f5f5',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h3>Study Overview</h3>
            <p><strong>Total Participants:</strong> {comparison.totalParticipants}</p>
            <p><strong>By Condition:</strong></p>
            <ul>
              {Object.entries(comparison.conditionCounts).map(([cond, count]) => (
                <li key={cond}>Condition {cond}: {count} participants</li>
              ))}
            </ul>
          </div>

          {Object.entries(comparison.byCondition).map(([condition, metrics]) => (
            <div
              key={condition}
              style={{
                background: '#fff',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <h3>Condition {condition}</h3>
              <p><strong>n = {metrics.n}</strong></p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '15px'
              }}>
                <div>
                  <strong>Crisis Fixation</strong>
                  <p>{(metrics.crisisFixationRatio.mean * 100).toFixed(1)}% ± {(metrics.crisisFixationRatio.std * 100).toFixed(1)}%</p>
                </div>

                <div>
                  <strong>Coverage</strong>
                  <p>{(metrics.peripheralNeglectCoverage.mean * 100).toFixed(1)}% ± {(metrics.peripheralNeglectCoverage.std * 100).toFixed(1)}%</p>
                </div>

                <div>
                  <strong>Response Time</strong>
                  <p>{(metrics.avgResponseTime.mean / 1000).toFixed(2)}s ± {(metrics.avgResponseTime.std / 1000).toFixed(2)}s</p>
                </div>

                <div>
                  <strong>Coordination</strong>
                  <p>{(metrics.coordinationScore.mean * 100).toFixed(0)} ± {(metrics.coordinationScore.std * 100).toFixed(0)}</p>
                </div>

                <div>
                  <strong>Decision Quality</strong>
                  <p>{metrics.decisionQuality.mean.toFixed(0)} ± {metrics.decisionQuality.std.toFixed(0)}</p>
                </div>
              </div>
            </div>
          ))}

          <div style={{
            background: '#e3f2fd',
            padding: '20px',
            borderRadius: '8px'
          }}>
            <h3>Pairwise Comparisons</h3>
            {comparison.pairwiseComparisons.map((comp, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '15px',
                  paddingBottom: '15px',
                  borderBottom: index < comparison.pairwiseComparisons.length - 1 ? '1px solid #ccc' : 'none'
                }}
              >
                <strong>Condition {comp.conditions[0]} vs {comp.conditions[1]}</strong>
                <p>Response Time Improvement: {comp.responseTimeImprovement.toFixed(1)}%</p>
                <p>Coordination Improvement: {comp.coordinationImprovement.toFixed(1)}%</p>
                <p>Crisis Fixation Difference: {(comp.crisisFixationDiff * 100).toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   HELPER FUNCTIONS
   ========================================================================= */

function _generateMockMovements(baseTime) {
  const movements = [];
  const regions = ['alert_A', 'alert_B', 'radar_north', 'radar_south'];

  for (let i = 0; i < 100; i++) {
    movements.push({
      x: Math.random() * 800,
      y: Math.random() * 600,
      timestamp: baseTime + i * 1000,
      region: regions[Math.floor(Math.random() * regions.length)]
    });
  }

  return movements;
}

function _generateMockTrackingData() {
  const baseTime = Date.now() - 300000;

  return {
    session: {
      participantId: 'P001',
      scenario: 'H4',
      condition: 2,
      startTime: baseTime,
      endTime: Date.now()
    },
    regions: {
      radar_display: { name: 'Radar Display', category: 'radar' },
      alert_area: { name: 'Alert Area', category: 'alert', isCrisis: true },
      northern_cluster: { name: 'Northern Cluster', category: 'radar' },
      southern_cluster: { name: 'Southern Cluster', category: 'radar' }
    },
    tracking: {
      dwellTimes: {
        radar_display: 180000,
        alert_area: 60000,
        northern_cluster: 40000,
        southern_cluster: 20000
      },
      mouseMovements: _generateMockMovements(baseTime),
      alertInteractions: [
        { alertId: 'alert_001', type: 'presented', timestamp: baseTime + 10000, severity: 'warning' },
        { alertId: 'alert_001', type: 'acknowledged', timestamp: baseTime + 13500 },
        { alertId: 'alert_002', type: 'presented', timestamp: baseTime + 60000, severity: 'critical' },
        { alertId: 'alert_002', type: 'acknowledged', timestamp: baseTime + 64000 }
      ]
    }
  };
}

function _generateMockReport(condition, participantId) {
  const trackingData = _generateMockTrackingData();
  trackingData.session.condition = condition;
  trackingData.session.participantId = participantId;

  // Adjust metrics based on condition (simulate research hypothesis)
  if (condition === 1) {
    // Condition 1: Worse metrics (modal blocks radar)
    trackingData.tracking.dwellTimes.alert_area = 150000; // More time on alerts
    trackingData.tracking.dwellTimes.radar_display = 100000; // Less radar time
  } else if (condition === 3) {
    // Condition 3: Better metrics (ML predictive helps)
    trackingData.tracking.dwellTimes.alert_area = 40000; // Less time on alerts
    trackingData.tracking.dwellTimes.radar_display = 220000; // More radar time
  }

  return attentionMetrics.generateAttentionReport(trackingData);
}

export default Example1_CrisisFixation;
