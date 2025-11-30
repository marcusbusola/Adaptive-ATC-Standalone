/**
 * Rule-Based Adaptive Alert Component (Condition 2)
 * Adapts presentation based on predefined rules
 */

import React from 'react';
import '../styles/alerts.css';

function AdaptiveAlert({ alert, workload, onAcknowledge, onDismiss }) {
  if (!alert) return null;

  /**
   * Determine presentation style based on rules:
   * - High priority + high workload = modal
   * - Low priority + low workload = peripheral
   * - Medium conditions = banner
   */
  const getPresentationStyle = () => {
    if (alert.priority === 'critical') {
      return 'modal';
    }

    if (workload > 0.7 && alert.priority === 'warning') {
      return 'modal';
    }

    if (workload < 0.3 && alert.priority === 'info') {
      return 'peripheral';
    }

    return 'banner';
  };

  const style = getPresentationStyle();

  const handleAcknowledge = () => {
    if (onAcknowledge) {
      onAcknowledge(alert.id, 'acknowledged', style);
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss(alert.id, style);
    }
  };

  // Modal presentation (high priority)
  if (style === 'modal') {
    return (
      <div className="modal-overlay">
        <div className={`modal-alert alert-${alert.priority}`}>
          <div className="alert-header">
            <h3>{alert.title}</h3>
            <span className="adaptive-badge">ADAPTIVE: Modal</span>
          </div>
          <div className="alert-body">
            <p>{alert.message}</p>
          </div>
          <div className="alert-actions">
            <button className="btn btn-primary" onClick={handleAcknowledge}>
              Acknowledge
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Banner presentation (medium priority)
  if (style === 'banner') {
    return (
      <div className={`banner-alert alert-${alert.priority}`}>
        <div className="banner-content">
          <strong>{alert.title}:</strong> {alert.message}
          <span className="adaptive-badge">ADAPTIVE: Banner</span>
        </div>
        <div className="banner-actions">
          <button className="btn-small btn-primary" onClick={handleAcknowledge}>
            OK
          </button>
          <button className="btn-small btn-secondary" onClick={handleDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Peripheral presentation (low priority)
  return (
    <div className={`peripheral-alert alert-${alert.priority}`}>
      <div className="peripheral-icon">!</div>
      <div className="peripheral-content">
        <div className="peripheral-title">{alert.title}</div>
        <div className="peripheral-message">{alert.message}</div>
        <span className="adaptive-badge">ADAPTIVE: Peripheral</span>
      </div>
      <button className="peripheral-close" onClick={handleDismiss}>
        &times;
      </button>
    </div>
  );
}

export default AdaptiveAlert;
