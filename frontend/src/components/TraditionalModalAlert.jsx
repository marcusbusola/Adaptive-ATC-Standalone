/**
 * Traditional Modal Alert Component (Condition 1)
 *
 * Represents the baseline "traditional interrupt-driven alert" condition
 * in the ATC Adaptive Alert Research System.
 *
 * Key Characteristics:
 * - FULL-SCREEN blocking modal that completely covers radar display
 * - Anxiety-inducing visual design (red background, yellow border)
 * - Demands immediate attention and acknowledgment
 * - Prevents all interaction with underlying interface
 * - Tracks acknowledgment timing for research metrics
 *
 * This is the control condition against which adaptive alerts (Conditions 2 & 3)
 * are compared to measure improvements in workload and performance.
 */

import React, { useState, useEffect, useRef } from 'react';
import { playAlertSound } from '../utils/alertSounds';
import '../styles/traditionalModalAlert.css';

function TraditionalModalAlert({
  title,
  message,
  severity = 'warning',
  requiresAcknowledgment = true,
  onAcknowledge,
  onDismiss,
  alertId,
  timestamp = Date.now(),
  details = null,
  enableAudio = true,
  zIndex = 0, // For stacking multiple alerts
  isEscalated = false, // Alert has reappeared after being acknowledged but not resolved
  reappearCount = 0, // Number of times alert has reappeared
  escalationLevel = 1, // Progressive urgency level (1 = normal, 2+ = escalated)
  visualIntensity = 4, // Visual intensity (1-5 scale)
  audioIntensity = 3 // Audio intensity (0-4 scale, 0=silent)
}) {
  const [responseTime, setResponseTime] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const acknowledgeButtonRef = useRef(null);
  const mountTimeRef = useRef(Date.now());

  // Fade in animation on mount
  useEffect(() => {
    setIsVisible(true);

    // Play audio alert if enabled and audioIntensity > 0
    if (enableAudio && audioIntensity > 0) {
      // Play escalated sound for reappearing alerts, otherwise normal severity sound
      const soundSeverity = isEscalated ? 'escalated' : severity;
      // Calculate volume based on audioIntensity (0.2 base + 0.15 per level)
      const volume = 0.2 + (audioIntensity * 0.15);
      playAlertSound(soundSeverity, { volume: Math.min(volume, 1.0) });
    }

    // Auto-focus acknowledge button for keyboard accessibility
    if (acknowledgeButtonRef.current) {
      acknowledgeButtonRef.current.focus();
    }

    // Track time from prop timestamp (actual alert time) not mount time
    mountTimeRef.current = Date.now();
  }, [severity, enableAudio, isEscalated, audioIntensity]);

  /**
   * Handle acknowledgment
   * Records response time from alert timestamp to acknowledgment
   */
  const handleAcknowledge = () => {
    const acknowledgeTime = Date.now();
    const timeSinceAlert = acknowledgeTime - timestamp;

    setResponseTime(timeSinceAlert);

    if (onAcknowledge) {
      onAcknowledge({
        alertId,
        responseTime: timeSinceAlert,
        acknowledgeTime,
        timestamp
      });
    }
  };

  /**
   * Handle dismiss (only if acknowledgment not required)
   */
  const handleDismiss = () => {
    if (!requiresAcknowledgment && onDismiss) {
      onDismiss(alertId);
    }
  };

  /**
   * Handle keyboard events
   * Enter/Space = Acknowledge
   * Escape = Dismiss (if allowed)
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAcknowledge();
    } else if (e.key === 'Escape' && !requiresAcknowledgment) {
      e.preventDefault();
      handleDismiss();
    }
  };

  /**
   * Get severity-specific class names
   * Escalated alerts always show as critical with additional escalated styling
   * Higher escalation levels get progressively more urgent styling
   */
  const getSeverityClass = () => {
    const classes = [];

    // Base severity
    if (isEscalated || escalationLevel >= 2) {
      classes.push('traditional-modal-critical');
      classes.push('traditional-modal-escalated');
    } else if (severity === 'critical') {
      classes.push('traditional-modal-critical');
    } else {
      classes.push('traditional-modal-warning');
    }

    // Progressive urgency levels
    if (escalationLevel >= 3) {
      classes.push('escalation-level-3');
    } else if (escalationLevel >= 2) {
      classes.push('escalation-level-2');
    }

    // Visual intensity class
    classes.push(`modal-intensity-${Math.max(1, Math.min(5, visualIntensity))}`);

    return classes.join(' ');
  };

  /**
   * Get escalation badge text based on level
   */
  const getEscalationBadge = () => {
    if (escalationLevel >= 3) {
      return `CRITICAL - LEVEL ${escalationLevel}`;
    } else if (escalationLevel === 2) {
      return 'ESCALATED';
    }
    return null;
  };

  return (
    <div
      className={`traditional-modal-overlay ${isVisible ? 'visible' : ''}`}
      style={{ zIndex: 9999 + zIndex }}
      onKeyDown={handleKeyDown}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-title"
      aria-describedby="alert-message"
    >
      <div className={`traditional-modal-container ${getSeverityClass()}`}>
        {/* Alert Header */}
        <div className="traditional-modal-header">
          {/* Escalation level badge */}
          {escalationLevel >= 2 && (
            <div className={`escalation-badge escalation-badge-${Math.min(escalationLevel, 3)}`}>
              {getEscalationBadge()}
            </div>
          )}

          {isEscalated && (
            <div className="escalated-indicator">
              ⚠️ UNRESOLVED - REQUIRES IMMEDIATE ACTION ⚠️
              {reappearCount >= 1 && (
                <span className="reappear-count">Reappeared: {reappearCount}x</span>
              )}
            </div>
          )}
          {severity === 'critical' && !isEscalated && escalationLevel < 2 && (
            <div className="critical-indicator">
              CRITICAL ALERT
            </div>
          )}
          <h1 id="alert-title" className="traditional-modal-title">
            {title}
          </h1>
        </div>

        {/* Alert Body */}
        <div className="traditional-modal-body">
          <p id="alert-message" className="traditional-modal-message">
            {message}
          </p>

          {/* Additional Details */}
          {details && (
            <div className="traditional-modal-details">
              <div className="details-label">Alert Details:</div>
              {Object.entries(details).map(([key, value]) => (
                <div key={key} className="detail-row">
                  <span className="detail-key">{key}:</span>
                  <span className="detail-value">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="traditional-modal-actions">
          <button
            ref={acknowledgeButtonRef}
            className="btn-acknowledge"
            onClick={handleAcknowledge}
            autoFocus
          >
            {requiresAcknowledgment ? 'ACKNOWLEDGE ALERT' : 'OK'}
          </button>

          {!requiresAcknowledgment && (
            <button
              className="btn-dismiss"
              onClick={handleDismiss}
            >
              DISMISS
            </button>
          )}
        </div>

        {/* Alert Metadata (for development/debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="traditional-modal-metadata">
            <small>
              Alert ID: {alertId} |
              Severity: {severity} |
              Time: {new Date(timestamp).toLocaleTimeString()}
            </small>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * TraditionalModalAlertStack Component
 *
 * Manages multiple simultaneous alerts by stacking them vertically
 * Most recent alert appears on top
 */
export function TraditionalModalAlertStack({ alerts, onAcknowledge, onDismiss }) {
  return (
    <>
      {alerts.map((alert, index) => (
        <TraditionalModalAlert
          key={alert.alertId}
          {...alert}
          zIndex={alerts.length - index}
          onAcknowledge={(data) => onAcknowledge(alert.alertId, data)}
          onDismiss={() => onDismiss(alert.alertId)}
        />
      ))}
    </>
  );
}

export default TraditionalModalAlert;
