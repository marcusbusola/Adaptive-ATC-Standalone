/**
 * Adaptive Banner Alert Component (Condition 2)
 *
 * Represents the "rule-based adaptive alert" condition in the ATC research system.
 *
 * Key Characteristics:
 * - NON-BLOCKING banner at top of screen (~10% height)
 * - Radar display remains visible and fully interactive
 * - Less anxiety-inducing design (orange/yellow vs red)
 * - Shows recommended actions for controller
 * - Can be dismissed or minimized without acknowledgment
 * - Context-aware presentation based on workload/priority
 *
 * This represents an improvement over traditional blocking alerts (Condition 1)
 * by allowing controllers to maintain situational awareness while being notified.
 */

import React, { useState, useEffect, useRef } from 'react';
import { playBannerNotification } from '../utils/alertAudio';
import '../styles/adaptiveBannerAlert.css';

function AdaptiveBannerAlert({
  title,
  message,
  severity = 'info',
  recommendedActions = [],
  onDismiss,
  onMinimize,
  onActionClick,
  autoDismiss = false,
  autoDismissDelay = 10000, // 10 seconds default
  alertId,
  timestamp = Date.now(),
  showProgress = true,
  visualIntensity = 3, // Visual intensity (1-5 scale)
  audioIntensity = 0, // Audio intensity (0-4 scale, 0=silent by default for banners)
  enableAudio = true // Whether audio is enabled for this banner
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(autoDismissDelay);
  const timerRef = useRef(null);
  const progressRef = useRef(null);

  // Fade in on mount and play audio if enabled
  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);

    // Play audio notification if enabled and intensity > 0
    if (enableAudio && audioIntensity > 0) {
      playBannerNotification(audioIntensity);
    }
  }, [enableAudio, audioIntensity]);

  // Auto-dismiss timer
  useEffect(() => {
    if (!autoDismiss) return;

    const startTime = Date.now();
    const endTime = startTime + autoDismissDelay;

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = endTime - now;

      if (remaining <= 0) {
        handleDismiss();
      } else {
        setTimeRemaining(remaining);
      }
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [autoDismiss, autoDismissDelay]);

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
          wasMinimized: isMinimized
        });
      }
    }, 300); // Wait for fade out animation
  };

  /**
   * Handle minimize/expand toggle
   */
  const handleToggleMinimize = () => {
    const newState = !isMinimized;
    setIsMinimized(newState);

    if (onMinimize) {
      onMinimize({
        alertId,
        isMinimized: newState,
        timestamp: Date.now()
      });
    }
  };

  /**
   * Handle recommended action click
   */
  const handleActionClick = (action, index) => {
    if (action.onClick) {
      action.onClick();
    }

    if (onActionClick) {
      onActionClick({
        alertId,
        action,
        actionIndex: index,
        timestamp: Date.now()
      });
    }
  };

  /**
   * Get severity class
   */
  const getSeverityClass = () => {
    const severityMap = {
      warning: 'adaptive-banner-warning',
      info: 'adaptive-banner-info',
      advisory: 'adaptive-banner-advisory'
    };
    return severityMap[severity] || 'adaptive-banner-info';
  };

  /**
   * Calculate progress percentage
   */
  const getProgressPercentage = () => {
    if (!autoDismiss) return 100;
    return (timeRemaining / autoDismissDelay) * 100;
  };

  return (
    <div
      className={`adaptive-banner-container ${getSeverityClass()} ${
        isVisible ? 'visible' : ''
      } ${isMinimized ? 'minimized' : ''} adaptive-banner-intensity-${Math.max(1, Math.min(5, visualIntensity))}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Minimized View */}
      {isMinimized ? (
        <div className="adaptive-banner-minimized">
          <button
            className="minimize-toggle"
            onClick={handleToggleMinimize}
            aria-label="Expand alert"
          >
            <span className="minimized-title">{title}</span>
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
          <div className="adaptive-banner-header">
            <div className="banner-title-section">
              <span className="severity-badge">{severity.toUpperCase()}</span>
              <h3 className="banner-title">{title}</h3>
            </div>

            <div className="banner-controls">
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
          <div className="adaptive-banner-body">
            <p className="banner-message">{message}</p>

            {/* Recommended Actions */}
            {recommendedActions.length > 0 && (
              <div className="recommended-actions">
                <span className="actions-label">Recommended:</span>
                <div className="actions-list">
                  {recommendedActions.map((action, index) => (
                    <button
                      key={index}
                      className="action-chip"
                      onClick={() => handleActionClick(action, index)}
                      title={action.description}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Auto-dismiss Progress Bar */}
          {autoDismiss && showProgress && (
            <div className="auto-dismiss-progress">
              <div
                className="progress-bar"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * AdaptiveBannerAlertStack Component
 *
 * Manages multiple banner alerts stacked vertically at top of screen
 * Allows independent minimize/dismiss for each banner
 */
export function AdaptiveBannerAlertStack({
  alerts,
  onDismiss,
  onMinimize,
  onActionClick,
  maxVisible = 3
}) {
  const [visibleAlerts, setVisibleAlerts] = useState(alerts);

  useEffect(() => {
    setVisibleAlerts(alerts.slice(0, maxVisible));
  }, [alerts, maxVisible]);

  const handleDismiss = (alertId, data) => {
    if (onDismiss) {
      onDismiss(alertId, data);
    }
  };

  return (
    <div className="adaptive-banner-stack">
      {visibleAlerts.map((alert, index) => (
        <AdaptiveBannerAlert
          key={alert.alertId}
          {...alert}
          onDismiss={(data) => handleDismiss(alert.alertId, data)}
          onMinimize={onMinimize}
          onActionClick={onActionClick}
        />
      ))}

      {/* Overflow Indicator */}
      {alerts.length > maxVisible && (
        <div className="overflow-indicator">
          +{alerts.length - maxVisible} more alert{alerts.length - maxVisible > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

/**
 * AdaptiveBannerAlertManager Component
 *
 * Higher-order component that manages banner alert state and stacking
 * Provides methods to add, remove, and manage alerts programmatically
 */
export class AdaptiveBannerAlertManager extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      alerts: []
    };
  }

  /**
   * Add new alert to stack
   */
  addAlert = (alert) => {
    const newAlert = {
      ...alert,
      alertId: alert.alertId || `alert_${Date.now()}`,
      timestamp: alert.timestamp || Date.now()
    };

    this.setState(prevState => ({
      alerts: [...prevState.alerts, newAlert]
    }));

    return newAlert.alertId;
  };

  /**
   * Remove alert from stack
   */
  removeAlert = (alertId) => {
    this.setState(prevState => ({
      alerts: prevState.alerts.filter(a => a.alertId !== alertId)
    }));
  };

  /**
   * Clear all alerts
   */
  clearAll = () => {
    this.setState({ alerts: [] });
  };

  render() {
    return (
      <>
        <AdaptiveBannerAlertStack
          alerts={this.state.alerts}
          onDismiss={this.removeAlert}
          onMinimize={this.props.onMinimize}
          onActionClick={this.props.onActionClick}
          maxVisible={this.props.maxVisible || 3}
        />
        {this.props.children(this)}
      </>
    );
  }
}

export default AdaptiveBannerAlert;
