import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { getAuthHeaders } from '../../services/tokenService';
import './ResultsDashboard.css';

const API_URL = getApiBaseUrl();

const ResultsDashboard = () => {
  const navigate = useNavigate();
  const [queues, setQueues] = useState([]);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, completed, active
  const [sortBy, setSortBy] = useState('date'); // date, participant, progress

  // Learning status state
  const [learningStatus, setLearningStatus] = useState({
    isLearning: false,
    lastTrainedAt: null,
    totalSamples: 0,
    lastResult: null,
    mlAvailable: false
  });

  // Load all queues
  const loadQueues = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/queues`, {
        headers: getAuthHeaders()
      });
      if (response.data.status === 'success') {
        setQueues(response.data.queues);
      }
    } catch (err) {
      console.error('Error loading queues:', err);
      setError(err.response?.data?.detail || 'Failed to load queues');
    } finally {
      setLoading(false);
    }
  };

  // Fetch ML learning status
  const fetchLearningStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/ml/learning-status`);
      if (response.data.status === 'success') {
        const learning = response.data.learning;
        setLearningStatus({
          isLearning: learning.is_learning,
          lastTrainedAt: learning.last_trained_at,
          totalSamples: learning.total_samples,
          lastResult: learning.last_result,
          mlAvailable: response.data.ml_available,
          error: learning.error
        });
      }
    } catch (err) {
      console.error('Error fetching learning status:', err);
    }
  }, []);

  // Trigger manual training
  const triggerManualTraining = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/ml/trigger-training`, {}, {
        headers: getAuthHeaders()
      });
      if (response.data.status === 'triggered') {
        setLearningStatus(prev => ({ ...prev, isLearning: true }));
      }
    } catch (err) {
      console.error('Error triggering training:', err);
      alert('Failed to trigger training: ' + (err.response?.data?.detail || err.message));
    }
  };

  useEffect(() => {
    loadQueues();
    fetchLearningStatus();

    // Poll learning status every 5 seconds while learning is in progress
    const interval = setInterval(() => {
      fetchLearningStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchLearningStatus]);

  // Filter queues
  const getFilteredQueues = () => {
    let filtered = [...queues];

    // Apply filter
    if (filter === 'completed') {
      filtered = filtered.filter(q => q.progress.pending === 0 && q.progress.in_progress === 0);
    } else if (filter === 'active') {
      filtered = filtered.filter(q => q.progress.pending > 0 || q.progress.in_progress > 0);
    }

    // Apply sort
    if (sortBy === 'date') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortBy === 'participant') {
      filtered.sort((a, b) => a.participant_id.localeCompare(b.participant_id));
    } else if (sortBy === 'progress') {
      filtered.sort((a, b) => b.progress.percentage - a.progress.percentage);
    }

    return filtered;
  };

  // Calculate aggregate statistics
  const getAggregateStats = () => {
    if (queues.length === 0) {
      return {
        totalQueues: 0,
        totalSessions: 0,
        completedSessions: 0,
        averageCompletion: 0,
        totalErrors: 0
      };
    }

    const totalSessions = queues.reduce((sum, q) => sum + q.progress.total, 0);
    const completedSessions = queues.reduce((sum, q) => sum + q.progress.completed, 0);
    const totalErrors = queues.reduce((sum, q) => sum + q.progress.errors, 0);

    return {
      totalQueues: queues.length,
      totalSessions,
      completedSessions,
      averageCompletion: totalSessions > 0 ? (completedSessions / totalSessions * 100) : 0,
      totalErrors
    };
  };

  // Get condition breakdown
  const getConditionBreakdown = (queue) => {
    const breakdown = { 1: 0, 2: 0, 3: 0 };
    queue.items.forEach(item => {
      if (item.condition in breakdown) {
        breakdown[item.condition]++;
      }
    });
    return breakdown;
  };

  // Get scenario breakdown
  const getScenarioBreakdown = (queue) => {
    const breakdown = {};
    queue.items.forEach(item => {
      if (!breakdown[item.scenario_id]) {
        breakdown[item.scenario_id] = 0;
      }
      breakdown[item.scenario_id]++;
    });
    return breakdown;
  };

  // Export queue data as JSON
  const handleExportQueue = (queue) => {
    const dataStr = JSON.stringify(queue, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `queue_${queue.queue_id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export all results as CSV
  const handleExportAllCSV = () => {
    const rows = [
      ['Queue ID', 'Participant ID', 'Scenario', 'Condition', 'Status', 'Duration (s)', 'Start Time', 'End Time']
    ];

    queues.forEach(queue => {
      queue.items.forEach(item => {
        rows.push([
          queue.queue_id,
          queue.participant_id,
          item.scenario_id,
          item.condition,
          item.status,
          item.duration_seconds || '',
          item.start_time || '',
          item.end_time || ''
        ]);
      });
    });

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all_results_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Delete queue
  const handleDeleteQueue = async (queueId) => {
    if (!window.confirm('Are you sure you want to delete this queue? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/queues/${queueId}`, {
        headers: getAuthHeaders()
      });
      setQueues(queues.filter(q => q.queue_id !== queueId));
      if (selectedQueue?.queue_id === queueId) {
        setSelectedQueue(null);
      }
    } catch (err) {
      console.error('Error deleting queue:', err);
      alert('Failed to delete queue: ' + (err.response?.data?.detail || err.message));
    }
  };

  const stats = getAggregateStats();
  const filteredQueues = getFilteredQueues();

  if (loading) {
    return (
      <div className="results-dashboard">
        <div className="loading">Loading results...</div>
      </div>
    );
  }

  return (
    <div className="results-dashboard">
      <div className="dashboard-header">
        <h2>Results Dashboard</h2>
        <button
          className="btn-export-all"
          onClick={handleExportAllCSV}
          disabled={queues.length === 0}
        >
          Export All as CSV
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Aggregate Statistics */}
      <div className="aggregate-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.totalQueues}</div>
          <div className="stat-label">Total Queues</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalSessions}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.completedSessions}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.averageCompletion.toFixed(1)}%</div>
          <div className="stat-label">Avg Completion</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalErrors}</div>
          <div className="stat-label">Errors</div>
        </div>
      </div>

      {/* ML Learning Status */}
      {learningStatus.mlAvailable && (
        <div className="ml-learning-status">
          <div className="learning-header">
            <h3>🧠 ML Model Status</h3>
            {learningStatus.isLearning ? (
              <span className="learning-badge learning">
                <span className="pulse-dot"></span>
                System Learning...
              </span>
            ) : learningStatus.lastResult?.status === 'success' ? (
              <span className="learning-badge updated">
                ✓ Model Updated
              </span>
            ) : (
              <span className="learning-badge idle">
                Ready
              </span>
            )}
          </div>

          <div className="learning-details">
            <div className="learning-stat">
              <span className="label">Training Samples:</span>
              <span className="value">{learningStatus.totalSamples || 0}</span>
            </div>
            {learningStatus.lastResult?.accuracy && (
              <div className="learning-stat">
                <span className="label">Model Accuracy:</span>
                <span className="value">{(learningStatus.lastResult.accuracy * 100).toFixed(1)}%</span>
              </div>
            )}
            {learningStatus.lastTrainedAt && (
              <div className="learning-stat">
                <span className="label">Last Trained:</span>
                <span className="value">{new Date(learningStatus.lastTrainedAt).toLocaleString()}</span>
              </div>
            )}
            {learningStatus.error && (
              <div className="learning-error">
                ⚠️ {learningStatus.error}
              </div>
            )}
          </div>

          <button
            className="btn-train"
            onClick={triggerManualTraining}
            disabled={learningStatus.isLearning}
          >
            {learningStatus.isLearning ? 'Training...' : 'Trigger Retraining'}
          </button>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="controls-bar">
        <div className="filter-group">
          <label>Filter:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Queues</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date">Date</option>
            <option value="participant">Participant</option>
            <option value="progress">Progress</option>
          </select>
        </div>

        <button className="btn-refresh" onClick={loadQueues}>
          Refresh
        </button>
      </div>

      {/* Queue List */}
      {filteredQueues.length === 0 ? (
        <div className="empty-state">
          <h3>No queues found</h3>
          <p>Create a queue to start collecting results.</p>
        </div>
      ) : (
        <div className="queue-list">
          {filteredQueues.map(queue => (
            <div
              key={queue.queue_id}
              className={`queue-card ${selectedQueue?.queue_id === queue.queue_id ? 'selected' : ''}`}
              onClick={() => setSelectedQueue(queue)}
            >
              <div className="queue-card-header">
                <div className="queue-info">
                  <h3>{queue.participant_id}</h3>
                  <span className="queue-id">{queue.queue_id}</span>
                </div>
                <div className="queue-actions">
                  <button
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/queue/${queue.queue_id}`);
                    }}
                    title="View Queue"
                  >
                    View
                  </button>
                  <button
                    className="btn-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportQueue(queue);
                    }}
                    title="Export Queue"
                  >
                    Export
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteQueue(queue.queue_id);
                    }}
                    title="Delete Queue"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="queue-card-body">
                <div className="queue-meta">
                  <span>Created: {new Date(queue.created_at).toLocaleString()}</span>
                  <span className={`status-badge ${queue.status}`}>{queue.status}</span>
                </div>

                <div className="progress-mini">
                  <div className="progress-bar-mini">
                    <div
                      className="progress-fill-mini"
                      style={{ width: `${queue.progress.percentage}%` }}
                    />
                  </div>
                  <div className="progress-text-mini">
                    {queue.progress.completed} / {queue.progress.total} sessions
                    ({queue.progress.percentage.toFixed(0)}%)
                  </div>
                </div>

                <div className="queue-breakdown">
                  <div className="breakdown-item">
                    <span className="breakdown-label">Scenarios:</span>
                    <span className="breakdown-value">
                      {Object.keys(getScenarioBreakdown(queue)).join(', ')}
                    </span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">Conditions:</span>
                    <span className="breakdown-value">
                      {Object.keys(getConditionBreakdown(queue)).join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detailed View */}
      {selectedQueue && (
        <div className="queue-details">
          <div className="details-header">
            <h3>Queue Details: {selectedQueue.participant_id}</h3>
            <button
              className="btn-close"
              onClick={() => setSelectedQueue(null)}
            >
              &times;
            </button>
          </div>

          <div className="details-body">
            {/* Session Items */}
            <div className="sessions-table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Scenario</th>
                    <th>Condition</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedQueue.items.map((item, index) => (
                    <tr key={index} className={item.status}>
                      <td>{index + 1}</td>
                      <td>{item.scenario_id}</td>
                      <td>Condition {item.condition}</td>
                      <td>
                        <span className={`status-badge ${item.status}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {item.duration_seconds
                          ? `${(item.duration_seconds / 60).toFixed(1)} min`
                          : '-'}
                      </td>
                      <td>
                        {item.start_time
                          ? new Date(item.start_time).toLocaleTimeString()
                          : '-'}
                      </td>
                      <td>
                        {item.end_time
                          ? new Date(item.end_time).toLocaleTimeString()
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Metadata */}
            {selectedQueue.metadata && Object.keys(selectedQueue.metadata).length > 0 && (
              <div className="metadata-section">
                <h4>Metadata</h4>
                <div className="metadata-grid">
                  {Object.entries(selectedQueue.metadata).map(([key, value]) => (
                    <div key={key} className="metadata-item">
                      <span className="metadata-key">{key}:</span>
                      <span className="metadata-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsDashboard;
