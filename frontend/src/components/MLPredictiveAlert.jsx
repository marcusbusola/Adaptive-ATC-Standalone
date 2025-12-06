/**
 * ML-Based Predictive Alert Component (Condition 3)
 *
 * Represents the most advanced "ML-based adaptive alert" condition
 * in the ATC research system.
 *
 * Key Characteristics:
 * - NON-BLOCKING banner at top (like Condition 2)
 * - PLUS visual highlighting on radar display
 * - Shows ML confidence score (0-100%)
 * - Provides reasoning/explanation for alert
 * - Predictive (flags issues before they occur)
 * - Highlights specific regions of concern
 * - Allows feedback (accept/reject ML suggestion)
 *
 * This represents the cutting-edge approach: using machine learning
 * to predict and prevent issues before they become critical.
 */

import React, { useState, useEffect, useRef } from 'react';
import RadarHighlight from './RadarHighlight';
import { playBannerNotification, playNudgeSound } from '../utils/alertAudio';
import '../styles/mlPredictiveAlert.css';

function MLPredictiveAlert({
  title,
  message,
  confidence = 85,
  reasoning = '',
  highlightRegions = [],
  predictionTime = 180, // seconds into future
  modelInfo = {
    name: 'Conflict Predictor v2.1',
    version: '2.1.0',
    features: ['traffic_density', 'velocity_vectors', 'historical_patterns']
  },
  onDismiss,
  onAcceptSuggestion,
  onRejectSuggestion,
  onFeedback,
  alertId,
  timestamp = Date.now(),
  suggestedActions = [],
  visualIntensity = 3, // Visual intensity (1-5 scale)
  audioIntensity = 0, // Audio intensity (0-4 scale, 0=silent by default)
  isNudge = false, // Whether this is an idle nudge
  nudgeCount = 0 // Number of times nudged
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [feedback, setFeedback] = useState(null); // 'accept' | 'reject' | null

  // Fade in on mount and play audio
  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);

    // Play audio based on intensity and nudge state
    if (audioIntensity > 0) {
      if (isNudge) {
        playNudgeSound();
      } else {
        playBannerNotification(audioIntensity);
      }
    }
  }, [audioIntensity, isNudge]);

  // Play nudge sound when nudge count increases
  useEffect(() => {
    if (isNudge && nudgeCount > 0) {
      playNudgeSound();
    }
  }, [nudgeCount, isNudge]);

  /**
   * Get confidence level category
   */
  const getConfidenceLevel = () => {
    if (confidence >= 90) return 'very-high';
    if (confidence >= 75) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
  };

  /**
   * Get confidence color
   */
  const getConfidenceColor = () => {
    const level = getConfidenceLevel();
    const colors = {
      'very-high': '#4caf50',
      'high': '#8bc34a',
      'medium': '#ffc107',
      'low': '#ff9800'
    };
    return colors[level];
  };

  /**
   * Handle dismiss
   */
  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      if (onDismiss) {
        onDismiss({
          alertId,
          dismissTime: Date.now(),
          timestamp,
          feedback,
          wasMinimized: isMinimized
        });
      }
    }, 300);
  };

  /**
   * Handle accept suggestion
   */
  const handleAccept = () => {
    setFeedback('accept');

    if (onAcceptSuggestion) {
      onAcceptSuggestion({
        alertId,
        timestamp: Date.now(),
        confidence,
        reasoning
      });
    }

    if (onFeedback) {
      onFeedback({
        alertId,
        action: 'accept',
        confidence,
        timestamp: Date.now()
      });
    }

    // Auto-dismiss after accepting
    setTimeout(handleDismiss, 1000);
  };

  /**
   * Handle reject suggestion
   */
  const handleReject = () => {
    setFeedback('reject');

    if (onRejectSuggestion) {
      onRejectSuggestion({
        alertId,
        timestamp: Date.now(),
        confidence,
        reasoning
      });
    }

    if (onFeedback) {
      onFeedback({
        alertId,
        action: 'reject',
        confidence,
        timestamp: Date.now()
      });
    }

    // Auto-dismiss after rejecting
    setTimeout(handleDismiss, 1000);
  };

  /**
   * Toggle minimize
   */
  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  /**
   * Format prediction time
   */
  const formatPredictionTime = () => {
    const minutes = Math.floor(predictionTime / 60);
    const seconds = predictionTime % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  return (
    <>
      {/* Banner Component */}
      <div
        className={`ml-predictive-banner ${
          isVisible ? 'visible' : ''
        } ${isMinimized ? 'minimized' : ''} ml-banner-intensity-${Math.max(1, Math.min(5, visualIntensity))} ${
          isNudge ? (nudgeCount >= 3 ? 'ml-banner-nudge-urgent' : 'ml-banner-nudge-active') : ''
        }`}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        {/* Minimized View */}
        {isMinimized ? (
          <div className="ml-banner-minimized">
            <button
              className="minimize-toggle"
              onClick={handleToggleMinimize}
              aria-label="Expand alert"
            >
              <span className="minimized-title">{title}</span>
              <span
                className="confidence-mini"
                style={{ color: getConfidenceColor() }}
              >
                {confidence}%
              </span>
              <span className="expand-icon">&#9662;</span>
            </button>
            <button
              className="btn-close-minimized"
              onClick={handleDismiss}
              aria-label="Dismiss alert"
            >
              &times;
            </button>
          </div>
        ) : (
          /* Expanded View */
          <>
            {/* Banner Header */}
            <div className="ml-banner-header">
              <div className="ml-title-section">
                <span className="ml-badge">ML PREDICTION</span>
                <h3 className="ml-title">{title}</h3>
                <span
                  className={`confidence-badge confidence-${getConfidenceLevel()}`}
                >
                  <span className="confidence-value">{confidence}%</span>
                  <span className="confidence-label">confidence</span>
                </span>
              </div>

              <div className="ml-banner-controls">
                <button
                  className="btn-minimize"
                  onClick={handleToggleMinimize}
                  aria-label="Minimize alert"
                  title="Minimize"
                >
                  &#9650;
                </button>
                <button
                  className="btn-close"
                  onClick={handleDismiss}
                  aria-label="Dismiss alert"
                  title="Dismiss"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Banner Body */}
            <div className="ml-banner-body">
              <div className="ml-message-section">
                <p className="ml-message">{message}</p>
                <div className="ml-prediction-info">
                  <span className="prediction-time">
                    Predicted in {formatPredictionTime()}
                  </span>
                  <span className="highlight-count">
                    {highlightRegions.length} region{highlightRegions.length !== 1 ? 's' : ''} highlighted
                  </span>
                </div>
              </div>

              {/* ML Reasoning Section */}
              {reasoning && (
                <div className="ml-reasoning-section">
                  <button
                    className="reasoning-toggle"
                    onClick={() => setShowReasoning(!showReasoning)}
                  >
                    <span className="reasoning-icon">
                      {showReasoning ? '&#9662;' : '&#9654;'}
                    </span>
                    <span className="reasoning-label">
                      Why is this flagged?
                    </span>
                  </button>

                  {showReasoning && (
                    <div className="reasoning-content">
                      <p className="reasoning-text">{reasoning}</p>
                      <div className="model-info">
                        <span className="model-name">
                          Model: {modelInfo.name}
                        </span>
                        <span className="model-features">
                          Features: {modelInfo.features.join(', ')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Suggested Actions */}
              {suggestedActions.length > 0 && (
                <div className="ml-suggested-actions">
                  <span className="actions-label">ML Recommendations:</span>
                  <div className="actions-list">
                    {suggestedActions.map((action, index) => (
                      <button
                        key={index}
                        className="action-chip ml-action"
                        onClick={action.onClick}
                        title={action.description}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback Buttons */}
              {!feedback && (onAcceptSuggestion || onRejectSuggestion) && (
                <div className="ml-feedback-section">
                  <p className="feedback-prompt">Is this prediction useful?</p>
                  <div className="feedback-buttons">
                    {onAcceptSuggestion && (
                      <button
                        className="btn-feedback btn-accept"
                        onClick={handleAccept}
                      >
                        Accept Prediction
                      </button>
                    )}
                    {onRejectSuggestion && (
                      <button
                        className="btn-feedback btn-reject"
                        onClick={handleReject}
                      >
                        Not Useful
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Feedback Confirmation */}
              {feedback && (
                <div className={`feedback-confirmation feedback-${feedback}`}>
                  {feedback === 'accept' ? (
                    <span>Thank you! This helps improve the model.</span>
                  ) : (
                    <span>Feedback recorded. Model will adapt.</span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Radar Highlights */}
      {!isMinimized && highlightRegions.length > 0 && (
        <div className="ml-radar-highlights">
          {highlightRegions.map((region, index) => (
            <RadarHighlight
              key={`${alertId}_${index}`}
              region={region}
              confidence={confidence}
              alertId={alertId}
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * MLPredictiveAlertStack Component
 *
 * Manages multiple ML alerts with their radar highlights
 */
export function MLPredictiveAlertStack({
  alerts,
  onDismiss,
  onAcceptSuggestion,
  onRejectSuggestion,
  onFeedback,
  maxVisible = 2
}) {
  const [visibleAlerts, setVisibleAlerts] = useState(alerts);

  useEffect(() => {
    // Show highest confidence alerts first
    const sortedAlerts = [...alerts].sort((a, b) => b.confidence - a.confidence);
    setVisibleAlerts(sortedAlerts.slice(0, maxVisible));
  }, [alerts, maxVisible]);

  const handleDismiss = (alertId, data) => {
    if (onDismiss) {
      onDismiss(alertId, data);
    }
  };

  return (
    <>
      {visibleAlerts.map((alert) => (
        <MLPredictiveAlert
          key={alert.alertId}
          {...alert}
          onDismiss={(data) => handleDismiss(alert.alertId, data)}
          onAcceptSuggestion={onAcceptSuggestion}
          onRejectSuggestion={onRejectSuggestion}
          onFeedback={onFeedback}
        />
      ))}

      {/* Overflow Indicator */}
      {alerts.length > maxVisible && (
        <div className="ml-overflow-indicator">
          +{alerts.length - maxVisible} more ML prediction{alerts.length - maxVisible > 1 ? 's' : ''}
        </div>
      )}
    </>
  );
}

export default MLPredictiveAlert;
