import React, { useState, useEffect } from 'react';
import '../styles/instructions.css';

const InstructionsScreen = ({ condition, scenario, onContinue }) => {
  const [readTime, setReadTime] = useState(0);
  const [canContinue, setCanContinue] = useState(false);
  const [understood, setUnderstood] = useState(false);

  // Minimum read time: 30 seconds
  const MIN_READ_TIME = 30;

  useEffect(() => {
    const interval = setInterval(() => {
      setReadTime(prev => {
        const newTime = prev + 1;
        if (newTime >= MIN_READ_TIME) {
          setCanContinue(true);
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleContinue = () => {
    if (canContinue && understood) {
      onContinue();
    }
  };

  const getConditionSpecificInstructions = () => {
    switch (condition) {
      case 1:
        return {
          title: 'Traditional Modal Alerts',
          description: 'You will receive conflict alerts as blocking modal dialogs',
          features: [
            'Alerts will appear as pop-up windows that require your acknowledgment',
            'You must click "Acknowledge" to dismiss each alert',
            'The alert will block your view until acknowledged',
            'All alerts are presented with the same urgency level'
          ],
          alertExample: 'traditional'
        };

      case 2:
        return {
          title: 'Rule-Based Adaptive Alerts',
          description: 'Alerts appear as non-blocking banners that vary by priority level',
          features: [
            'Alerts appear as banner notifications at the top of the screen',
            'You can continue working while alerts are displayed',
            'Critical alerts stay visible until you respond',
            'Lower priority alerts may auto-dismiss after 10-15 seconds',
            'You can dismiss alerts by clicking the X button'
          ],
          alertExample: 'adaptive'
        };

      case 3:
        return {
          title: 'ML-Based Predictive Alerts',
          description: 'Machine learning monitors your attention and adjusts alert presentation',
          features: [
            'The system monitors your interaction patterns in real-time',
            'Alerts appear as non-blocking banners with confidence scores',
            'Visual highlighting may appear on the radar for high-risk aircraft',
            'Alerts include explanations of why they were triggered',
            'You can dismiss alerts or take suggested actions'
          ],
          alertExample: 'predictive'
        };

      default:
        return {
          title: 'Alert System',
          description: 'You will receive conflict alerts during the scenario',
          features: [],
          alertExample: 'traditional'
        };
    }
  };

  const conditionInfo = getConditionSpecificInstructions();

  return (
    <div className="instructions-screen">
      <div className="instructions-container">
        <header className="instructions-header">
          <h1>Pre-Session Instructions</h1>
          <p className="subtitle">Please read carefully before continuing</p>
        </header>

        <div className="instructions-content">
          {/* Scenario Information */}
          <section className="instruction-section">
            <h2>Scenario Information</h2>
            <div className="scenario-info-box">
              <div className="info-row">
                <span className="info-label">Scenario:</span>
                <span className="info-value">{scenario}</span>
              </div>
              <p className="scenario-description">
                You will be controlling air traffic in a simulated airspace.
                Your task is to manage aircraft safely and efficiently while
                responding to any conflict alerts that appear.
              </p>
            </div>
          </section>

          {/* Condition-Specific Instructions */}
          <section className="instruction-section">
            <h2>Alert System: {conditionInfo.title}</h2>
            <p className="section-description">{conditionInfo.description}</p>

            <div className="features-list">
              <h3>How alerts will work:</h3>
              <ul>
                {conditionInfo.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* General Instructions */}
          <section className="instruction-section">
            <h2>Your Task</h2>
            <div className="task-instructions">
              <ol>
                <li>
                  <strong>Monitor the radar display</strong> for all aircraft
                  in your sector
                </li>
                <li>
                  <strong>Respond to alerts</strong> according to the alert
                  system described above
                </li>
                <li>
                  <strong>Manage conflicts</strong> by taking appropriate
                  action when alerted
                </li>
                <li>
                  <strong>Maintain awareness</strong> of the overall traffic
                  situation
                </li>
                <li>
                  <strong>Work naturally</strong> - perform the task as you
                  normally would
                </li>
              </ol>
            </div>
          </section>

          {/* Important Notes */}
          <section className="instruction-section important-notes">
            <h2>Important Notes</h2>
            <div className="notes-box">
              <div className="note-item">
                <span className="note-text">
                  The scenario will run for approximately 6 minutes
                </span>
              </div>
              <div className="note-item">
                <span className="note-text">
                  Focus on accuracy and safety over speed
                </span>
              </div>
              <div className="note-item">
                <span className="note-text">
                  Your interactions are being recorded for research purposes
                </span>
              </div>
              <div className="note-item">
                <span className="note-text">
                  If you have questions, ask the researcher before starting
                </span>
              </div>
            </div>
          </section>

          {/* Confirmation Checkbox */}
          <section className="instruction-section confirmation-section">
            <label className="confirmation-checkbox">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
              />
              <span className="checkbox-label">
                I have read and understood these instructions
              </span>
            </label>
          </section>
        </div>

        {/* Footer with Continue Button */}
        <footer className="instructions-footer">
          <div className="timer-info">
            {!canContinue && (
              <p className="read-timer">
                Please read for at least {MIN_READ_TIME} seconds
                ({MIN_READ_TIME - readTime}s remaining)
              </p>
            )}
          </div>

          <button
            className="btn btn-primary btn-large"
            onClick={handleContinue}
            disabled={!canContinue || !understood}
          >
            {!canContinue
              ? `Continue (${MIN_READ_TIME - readTime}s)`
              : !understood
              ? 'Please confirm you understand'
              : 'Begin Scenario'}
          </button>

          {canContinue && !understood && (
            <p className="help-text">
              Please check the box above to confirm you understand the instructions
            </p>
          )}
        </footer>
      </div>
    </div>
  );
};

export default InstructionsScreen;
