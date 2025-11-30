/**
 * Traditional Modal Alert Component (Condition 1)
 * Standard pop-up modal that interrupts workflow
 */

import React from 'react';
import '../styles/alerts.css';

function ModalAlert({ alert, onAcknowledge, onDismiss }) {
  if (!alert) return null;

  const handleAcknowledge = () => {
    if (onAcknowledge) {
      onAcknowledge(alert.id, 'acknowledged');
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss(alert.id);
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'critical':
        return 'alert-critical';
      case 'warning':
        return 'alert-warning';
      default:
        return 'alert-info';
    }
  };

  return (
    <div className="modal-overlay">
      <div className={`modal-alert ${getPriorityClass(alert.priority)}`}>
        <div className="alert-header">
          <h3>{alert.title}</h3>
          {alert.priority === 'critical' && (
            <span className="critical-badge">CRITICAL</span>
          )}
        </div>

        <div className="alert-body">
          <p className="alert-message">{alert.message}</p>

          {alert.details && (
            <div className="alert-details">
              {Object.entries(alert.details).map(([key, value]) => (
                <div key={key} className="detail-row">
                  <strong>{key}:</strong> {value}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="alert-actions">
          <button
            className="btn btn-primary"
            onClick={handleAcknowledge}
          >
            Acknowledge
          </button>
          {alert.priority !== 'critical' && (
            <button
              className="btn btn-secondary"
              onClick={handleDismiss}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModalAlert;
