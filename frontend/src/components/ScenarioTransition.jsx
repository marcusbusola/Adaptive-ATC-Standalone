/**
 * Scenario Transition Component
 *
 * Displays a brief transition screen between scenarios in a multi-scenario queue.
 * Shows progress, next scenario info, and a countdown before auto-starting.
 */

import React, { useState, useEffect } from 'react';
import './ScenarioTransition.css';

const SCENARIO_NAMES = {
  'L1': 'Baseline Emergency',
  'L2': 'System Failure / Irony of Automation',
  'L3': 'Automation Complacency',
  'H4': 'Conflict-Driven Tunneling',
  'H5': 'Multi-Crisis Management',
  'H6': 'Cry Wolf Effect'
};

function ScenarioTransition({
  completedScenarioId,
  nextScenarioId,
  scenarioNumber,
  totalScenarios,
  condition,
  countdownSeconds = 5,
  onCountdownComplete
}) {
  const [countdown, setCountdown] = useState(countdownSeconds);

  useEffect(() => {
    if (countdown <= 0) {
      onCountdownComplete?.();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onCountdownComplete]);

  const getScenarioName = (id) => {
    return SCENARIO_NAMES[id] || id;
  };

  const getConditionName = (cond) => {
    switch (cond) {
      case 1: return 'Traditional Modal Alerts';
      case 2: return 'Rule-Based Adaptive Alerts';
      case 3: return 'ML-Based Adaptive Alerts';
      default: return `Condition ${cond}`;
    }
  };

  return (
    <div className="scenario-transition-overlay">
      <div className="scenario-transition-container">
        {/* Completion Message */}
        <div className="transition-header">
          <div className="checkmark-circle">
            <svg viewBox="0 0 24 24" className="checkmark-icon">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
          <h1 className="transition-title">Scenario Complete!</h1>
        </div>

        {/* Completed Scenario Info */}
        <div className="completed-scenario">
          <div className="scenario-badge completed">
            <span className="badge-label">Completed</span>
            <span className="badge-id">{completedScenarioId}</span>
          </div>
          <p className="scenario-name">{getScenarioName(completedScenarioId)}</p>
        </div>

        {/* Progress Indicator */}
        <div className="progress-section">
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${(scenarioNumber / totalScenarios) * 100}%` }}
            />
          </div>
          <p className="progress-text">
            {scenarioNumber} of {totalScenarios} scenarios completed
          </p>
        </div>

        {/* Next Scenario Preview */}
        <div className="next-scenario">
          <h2 className="next-label">Up Next</h2>
          <div className="scenario-badge next">
            <span className="badge-id">{nextScenarioId}</span>
          </div>
          <p className="scenario-name">{getScenarioName(nextScenarioId)}</p>
          <p className="condition-info">{getConditionName(condition)}</p>
        </div>

        {/* Countdown */}
        <div className="countdown-section">
          <div className="countdown-circle">
            <span className="countdown-number">{countdown}</span>
          </div>
          <p className="countdown-text">
            Starting in {countdown} second{countdown !== 1 ? 's' : ''}...
          </p>
        </div>

        {/* Skip Button */}
        <button
          className="skip-button"
          onClick={onCountdownComplete}
        >
          Start Now
        </button>
      </div>
    </div>
  );
}

export default ScenarioTransition;
