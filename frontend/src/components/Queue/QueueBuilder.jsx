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
  const [selectedCondition, setSelectedCondition] = useState(null); // Single condition (radio)
  const [randomizeOrder, setRandomizeOrder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const toggleScenario = (scenarioId) => {
    setSelectedScenarios(prev =>
      prev.includes(scenarioId)
        ? prev.filter(id => id !== scenarioId)
        : [...prev, scenarioId]
    );
  };

  const selectAllScenarios = () => {
    setSelectedScenarios(SCENARIOS.map(s => s.id));
  };

  const clearAllScenarios = () => {
    setSelectedScenarios([]);
  };

  const getTotalSessions = () => {
    // One session per scenario (all use the same condition)
    return selectedCondition ? selectedScenarios.length : 0;
  };

  const getTotalDuration = () => {
    const minutes = getTotalSessions() * 6; // 6 minutes per session
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getQueuePreview = () => {
    if (!selectedCondition) return [];
    const condition = CONDITIONS.find(c => c.id === selectedCondition);
    const items = [];
    selectedScenarios.forEach(scenarioId => {
      const scenario = SCENARIOS.find(s => s.id === scenarioId);
      items.push({
        scenario: scenario.name,
        condition: condition.name,
        duration: scenario.duration
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

    if (!selectedCondition) {
      setError('Please select an alert condition');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await axios.post(`${API_URL}/api/queues/create`, {
        participant_id: participantId,
        scenario_ids: selectedScenarios,
        condition: selectedCondition,        // Single condition
        randomize_order: randomizeOrder,     // Randomization option
        metadata: {
          created_via: 'QueueBuilder',
          total_sessions: getTotalSessions(),
          estimated_duration: getTotalDuration()
        }
      }, {
        headers: getAuthHeaders()
      });

      if (response.data.status === 'success') {
        const queue = response.data.queue;

        // Call callback with queue info (for monitoring)
        if (onQueueCreated) {
          onQueueCreated(queue);
        }

        // Show success message - queue stays queued until participant starts it
        setSuccessMessage(`Queue created successfully! Queue ID: ${queue.queue_id}. Participant can start via the Participant Lobby.`);

        // Reset form
        setParticipantId('');
        setSelectedScenarios([]);
        setSelectedCondition(null);
        setRandomizeOrder(false);
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

      {successMessage && (
        <div className="success-message">
          {successMessage}
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

      {/* Condition Selection - Radio Buttons (single select) */}
      <div className="form-section">
        <div className="section-header">
          <label>Select Alert Condition <span className="required">*</span></label>
          <span className="section-hint">(Choose one)</span>
        </div>

        <div className="condition-grid">
          {CONDITIONS.map(condition => (
            <div
              key={condition.id}
              className={`condition-card ${selectedCondition === condition.id ? 'selected' : ''}`}
              onClick={() => setSelectedCondition(condition.id)}
            >
              <div className="condition-header">
                <input
                  type="radio"
                  name="alertCondition"
                  checked={selectedCondition === condition.id}
                  onChange={() => setSelectedCondition(condition.id)}
                  className="condition-radio"
                />
                <span className="condition-number">Condition {condition.id}</span>
              </div>
              <div className="condition-name">{condition.name}</div>
              <div className="condition-description">{condition.description}</div>
            </div>
          ))}
        </div>

        {/* Randomize Order Option */}
        <div className="randomize-option">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={randomizeOrder}
              onChange={(e) => setRandomizeOrder(e.target.checked)}
            />
            <span>Randomize scenario order</span>
            <span className="option-hint">(for counterbalancing)</span>
          </label>
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
              <div className="stat-value">{CONDITIONS.find(c => c.id === selectedCondition)?.name.split(' ')[0] || '-'}</div>
              <div className="stat-label">Alert Type</div>
            </div>
          </div>
          {randomizeOrder && (
            <div className="randomize-notice">
              Scenario order will be randomized
            </div>
          )}

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
