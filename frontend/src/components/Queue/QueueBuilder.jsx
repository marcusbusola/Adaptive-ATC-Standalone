import React, { useState } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { getAuthHeaders } from '../../services/tokenService';
import './QueueBuilder.css';

const API_URL = getApiBaseUrl();

const SCENARIOS = [
  { id: 'L1', name: 'L1: Baseline Emergency', duration: '6 min', workload: 'Low' },
  { id: 'L2', name: 'L2: System Failure / Irony of Automation', duration: '6 min', workload: 'Low' },
  { id: 'L3', name: 'L3: Automation Complacency', duration: '6 min', workload: 'Low' },
  { id: 'H4', name: 'H4: Conflict-Driven Tunneling', duration: '6 min', workload: 'High' },
  { id: 'H5', name: 'H5: Multi-Crisis Management', duration: '6 min', workload: 'High' },
  { id: 'H6', name: 'H6: Cry Wolf Effect', duration: '6 min', workload: 'High' }
];

const CONDITIONS = [
  { id: 1, name: 'Traditional Modal Alerts', description: 'Baseline blocking alerts' },
  { id: 2, name: 'Rule-Based Adaptive', description: 'Heuristic adaptive alerts' },
  { id: 3, name: 'ML-Based Adaptive', description: 'Machine learning alerts' }
];

const QueueBuilder = ({ onQueueCreated }) => {
  const [participantId, setParticipantId] = useState('');
  const [selectedScenarios, setSelectedScenarios] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const toggleScenario = (scenarioId) => {
    setSelectedScenarios(prev =>
      prev.includes(scenarioId)
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId]
    );
  };

  const toggleCondition = (conditionId) => {
    setSelectedConditions(prev =>
      prev.includes(conditionId)
        ? prev.filter(id => id !== conditionId)
        : [...prev, conditionId]
    );
  };

  const selectAllScenarios = () => {
    setSelectedScenarios(SCENARIOS.map(s => s.id));
  };

  const clearAllScenarios = () => {
    setSelectedScenarios([]);
  };

  const selectAllConditions = () => {
    setSelectedConditions(CONDITIONS.map(c => c.id));
  };

  const clearAllConditions = () => {
    setSelectedConditions([]);
  };

  const getTotalSessions = () => {
    return selectedScenarios.length * selectedConditions.length;
  };

  const getTotalDuration = () => {
    const minutes = getTotalSessions() * 6; // 6 minutes per session
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getQueuePreview = () => {
    const items = [];
    selectedScenarios.forEach(scenarioId => {
      selectedConditions.forEach(conditionId => {
        const scenario = SCENARIOS.find(s => s.id === scenarioId);
        const condition = CONDITIONS.find(c => c.id === conditionId);
        items.push({
          scenario: scenario.name,
          condition: condition.name,
          duration: scenario.duration
        });
      });
    });
    return items;
  };

  const handleCreateQueue = async () => {
    if (!participantId.trim()) {
      setError('Please enter a participant ID');
      return;
    }

    if (selectedScenarios.length === 0) {
      setError('Please select at least one scenario');
      return;
    }

    if (selectedConditions.length === 0) {
      setError('Please select at least one condition');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/api/queues/create`, {
        participant_id: participantId,
        scenario_ids: selectedScenarios,
        conditions: selectedConditions,
        metadata: {
          created_via: 'QueueBuilder',
          total_sessions: getTotalSessions(),
          estimated_duration: getTotalDuration()
        }
      }, {
        headers: getAuthHeaders()
      });

      if (response.data.status === 'success') {
        // Call callback with queue info
        if (onQueueCreated) {
          onQueueCreated(response.data.queue);
        }

        // Reset form
        setParticipantId('');
        setSelectedScenarios([]);
        setSelectedConditions([]);
        setShowPreview(false);
      }
    } catch (err) {
      console.error('Error creating queue:', err);
      setError(err.response?.data?.detail || 'Failed to create queue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="queue-builder">
      <div className="queue-builder-header">
        <h2>Create Session Queue</h2>
        <p className="subtitle">
          Select scenarios and conditions to create a batch test queue
        </p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Participant ID */}
      <div className="form-section">
        <label htmlFor="participant-id">
          Participant ID <span className="required">*</span>
        </label>
        <input
          id="participant-id"
          type="text"
          value={participantId}
          onChange={(e) => setParticipantId(e.target.value)}
          placeholder="Enter participant identifier (e.g., P001)"
          className="participant-input"
        />
      </div>

      {/* Scenario Selection */}
      <div className="form-section">
        <div className="section-header">
          <label>Select Scenarios <span className="required">*</span></label>
          <div className="quick-actions">
            <button onClick={selectAllScenarios} className="btn-link">
              Select All
            </button>
            <button onClick={clearAllScenarios} className="btn-link">
              Clear All
            </button>
          </div>
        </div>

        <div className="scenario-grid">
          {SCENARIOS.map(scenario => (
            <div
              key={scenario.id}
              className={`scenario-card ${selectedScenarios.includes(scenario.id) ? 'selected' : ''}`}
              onClick={() => toggleScenario(scenario.id)}
            >
              <div className="scenario-header">
                <span className="scenario-id">{scenario.id}</span>
                <span className={`workload-badge ${scenario.workload.toLowerCase()}`}>
                  {scenario.workload}
                </span>
              </div>
              <div className="scenario-name">{scenario.name}</div>
              <div className="scenario-meta">
                <span className="duration">{scenario.duration}</span>
              </div>
              {selectedScenarios.includes(scenario.id) && (
                <div className="selected-indicator">Selected</div>
              )}
            </div>
          ))}
        </div>

        <div className="selection-summary">
          {selectedScenarios.length} scenario{selectedScenarios.length !== 1 ? 's' : ''} selected
        </div>
      </div>

      {/* Condition Selection */}
      <div className="form-section">
        <div className="section-header">
          <label>Select Alert Conditions <span className="required">*</span></label>
          <div className="quick-actions">
            <button onClick={selectAllConditions} className="btn-link">
              Select All
            </button>
            <button onClick={clearAllConditions} className="btn-link">
              Clear All
            </button>
          </div>
        </div>

        <div className="condition-grid">
          {CONDITIONS.map(condition => (
            <div
              key={condition.id}
              className={`condition-card ${selectedConditions.includes(condition.id) ? 'selected' : ''}`}
              onClick={() => toggleCondition(condition.id)}
            >
              <div className="condition-header">
                <span className="condition-number">Condition {condition.id}</span>
                {selectedConditions.includes(condition.id) && (
                  <span className="checkmark">Selected</span>
                )}
              </div>
              <div className="condition-name">{condition.name}</div>
              <div className="condition-description">{condition.description}</div>
            </div>
          ))}
        </div>

        <div className="selection-summary">
          {selectedConditions.length} condition{selectedConditions.length !== 1 ? 's' : ''} selected
        </div>
      </div>

      {/* Queue Summary */}
      {getTotalSessions() > 0 && (
        <div className="queue-summary">
          <h3>Queue Summary</h3>
          <div className="summary-stats">
            <div className="stat">
              <div className="stat-value">{getTotalSessions()}</div>
              <div className="stat-label">Total Sessions</div>
            </div>
            <div className="stat">
              <div className="stat-value">{getTotalDuration()}</div>
              <div className="stat-label">Estimated Duration</div>
            </div>
            <div className="stat">
              <div className="stat-value">{selectedScenarios.length}</div>
              <div className="stat-label">Scenarios</div>
            </div>
            <div className="stat">
              <div className="stat-value">{selectedConditions.length}</div>
              <div className="stat-label">Conditions</div>
            </div>
          </div>

          <button
            className="btn-preview"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Hide' : 'Show'} Session Order
          </button>

          {showPreview && (
            <div className="queue-preview">
              <div className="preview-header">Session Execution Order:</div>
              <div className="preview-list">
                {getQueuePreview().map((item, index) => (
                  <div key={index} className="preview-item">
                    <span className="preview-index">{index + 1}.</span>
                    <span className="preview-scenario">{item.scenario}</span>
                    <span className="preview-separator">-</span>
                    <span className="preview-condition">{item.condition}</span>
                    <span className="preview-duration">({item.duration})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="form-actions">
        <button
          className="btn-create"
          onClick={handleCreateQueue}
          disabled={loading || getTotalSessions() === 0 || !participantId.trim()}
        >
          {loading ? 'Creating Queue...' : `Create Queue (${getTotalSessions()} sessions)`}
        </button>
      </div>
    </div>
  );
};

export default QueueBuilder;
