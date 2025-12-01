/**
 * Success Toast Component
 *
 * Displays a green notification when the operator successfully resolves an alert.
 * Auto-dismisses after a configurable duration.
 */

import React, { useState, useEffect } from 'react';
import './SuccessToast.css';

function SuccessToast({
  message,
  aircraft,
  actionTaken,
  alertType,
  duration = 3000,
  onDismiss
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Fade in
    requestAnimationFrame(() => setIsVisible(true));

    // Start exit animation before dismissal
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 300);

    // Auto-dismiss
    const dismissTimer = setTimeout(() => {
      onDismiss?.();
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [duration, onDismiss]);

  // Format alert type for display
  const formatAlertType = (type) => {
    if (!type) return null;
    return type.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className={`success-toast ${isVisible ? 'visible' : ''} ${isExiting ? 'exiting' : ''}`}>
      <div className="success-toast-icon-wrapper">
        <div className="success-toast-icon">✓</div>
      </div>
      <div className="success-toast-content">
        <div className="success-toast-header">
          <div className="success-toast-title">Alert Resolved</div>
          {alertType && (
            <div className="success-toast-type">{formatAlertType(alertType)}</div>
          )}
        </div>
        <div className="success-toast-message">
          {message || `${aircraft} situation handled correctly`}
        </div>
        {actionTaken && (
          <div className="success-toast-action">
            <span className="action-label">Action taken:</span> {actionTaken}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * SuccessToastContainer - Manages multiple toast notifications
 */
export function SuccessToastContainer({ toasts, onDismiss }) {
  return (
    <div className="success-toast-container">
      {toasts.map((toast) => (
        <SuccessToast
          key={toast.id}
          message={toast.message}
          aircraft={toast.aircraft}
          actionTaken={toast.actionTaken}
          alertType={toast.alertType}
          duration={toast.duration || 3000}
          onDismiss={() => onDismiss(toast.id)}
        />
      ))}
    </div>
  );
}

export default SuccessToast;
