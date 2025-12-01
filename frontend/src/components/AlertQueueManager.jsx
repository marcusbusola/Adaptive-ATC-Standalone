import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import TraditionalModalAlert from './TraditionalModalAlert';

/**
 * AlertQueueManager - Manages alert queue for Condition 1 (Traditional Modal)
 *
 * Features:
 * - Queues alerts (oldest first)
 * - Shows peek button to view radar between acknowledgments
 * - Handles re-emitted alerts without replaying audio
 * - Tracks unresolved alerts that need attention
 */

const QueueOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: ${props => props.$peeking ? 'transparent' : 'rgba(0, 0, 0, 0.5)'};
  pointer-events: ${props => props.$peeking ? 'none' : 'auto'};
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background 0.3s ease;
`;

const AlertContainer = styled.div`
  pointer-events: auto;
  max-width: 600px;
  width: 90%;
`;

const QueueIndicator = styled.div`
  position: fixed;
  top: 10px;
  right: 10px;
  background: #ff4444;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: bold;
  z-index: 1001;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
`;

const PeekButton = styled.button`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #2196F3;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  z-index: 1002;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);

  &:hover {
    background: #1976D2;
  }

  &:disabled {
    background: #666;
    cursor: not-allowed;
  }
`;

const ResumeButton = styled.button`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #ff9800;
  color: white;
  border: none;
  padding: 16px 32px;
  border-radius: 8px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  z-index: 1002;
  box-shadow: 0 4px 15px rgba(0,0,0,0.4);
  animation: pulse 1.5s infinite;

  @keyframes pulse {
    0% { transform: translateX(-50%) scale(1); }
    50% { transform: translateX(-50%) scale(1.05); }
    100% { transform: translateX(-50%) scale(1); }
  }

  &:hover {
    background: #f57c00;
  }
`;

function AlertQueueManager({
  alerts = [],
  onAcknowledge,
  onDismiss,
  condition = 1,
  children
}) {
  const [alertQueue, setAlertQueue] = useState([]);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [isPeeking, setIsPeeking] = useState(false);
  const [seenAlertIds, setSeenAlertIds] = useState(new Set());

  // Only manage queue for Condition 1 (Traditional Modal)
  const isCondition1 = condition === 1;

  // Process incoming alerts into queue
  useEffect(() => {
    if (!isCondition1) return;

    alerts.forEach(alert => {
      const alertId = alert.alert_id || alert.id;

      // Skip if already in queue or already seen
      if (seenAlertIds.has(alertId)) {
        // Handle re-emit: update existing alert but don't add again
        if (alert.is_reemit) {
          setAlertQueue(prev => prev.map(a =>
            (a.alert_id || a.id) === alertId ? { ...a, ...alert } : a
          ));
        }
        return;
      }

      // Add new alert to queue
      setAlertQueue(prev => [...prev, alert]);
      setSeenAlertIds(prev => new Set([...prev, alertId]));
    });
  }, [alerts, isCondition1, seenAlertIds]);

  // Set current alert from queue (oldest first)
  useEffect(() => {
    if (!isCondition1) return;

    if (alertQueue.length > 0 && !currentAlert && !isPeeking) {
      setCurrentAlert(alertQueue[0]);
    }
  }, [alertQueue, currentAlert, isPeeking, isCondition1]);

  // Handle acknowledgment
  const handleAcknowledge = useCallback((alertId, action) => {
    // Remove from queue
    setAlertQueue(prev => prev.filter(a => (a.alert_id || a.id) !== alertId));
    setCurrentAlert(null);

    // Call parent handler
    if (onAcknowledge) {
      onAcknowledge(alertId, action);
    }
  }, [onAcknowledge]);

  // Handle dismiss (for non-blocking alerts)
  const handleDismiss = useCallback((alertId) => {
    setAlertQueue(prev => prev.filter(a => (a.alert_id || a.id) !== alertId));
    setCurrentAlert(null);

    if (onDismiss) {
      onDismiss(alertId);
    }
  }, [onDismiss]);

  // Handle peek (temporarily view radar)
  const handlePeek = useCallback(() => {
    setIsPeeking(true);
  }, []);

  // Handle resume (return to alert)
  const handleResume = useCallback(() => {
    setIsPeeking(false);
  }, []);

  // For non-Condition 1, just render children and pass alerts through
  if (!isCondition1) {
    return children;
  }

  const hasUnresolvedAlerts = alertQueue.length > 0;
  const showAlert = currentAlert && !isPeeking;

  return (
    <>
      {/* Render the radar/scenario view */}
      {children}

      {/* Queue indicator */}
      {hasUnresolvedAlerts && (
        <QueueIndicator>
          {alertQueue.length} Alert{alertQueue.length > 1 ? 's' : ''} Pending
        </QueueIndicator>
      )}

      {/* Alert overlay */}
      {showAlert && (
        <QueueOverlay $peeking={false}>
          <AlertContainer>
            <TraditionalModalAlert
              alert={currentAlert}
              onAcknowledge={(action) => handleAcknowledge(currentAlert.alert_id || currentAlert.id, action)}
              onDismiss={() => handleDismiss(currentAlert.alert_id || currentAlert.id)}
              suppressAudio={currentAlert.suppress_audio || currentAlert.is_reemit}
            />
          </AlertContainer>

          {/* Peek button - allows temporary view of radar */}
          <PeekButton onClick={handlePeek}>
            Peek at Radar (Alert will remain)
          </PeekButton>
        </QueueOverlay>
      )}

      {/* Peeking state - show resume button */}
      {isPeeking && hasUnresolvedAlerts && (
        <ResumeButton onClick={handleResume}>
          Return to Alert ({alertQueue.length} pending)
        </ResumeButton>
      )}
    </>
  );
}

export default AlertQueueManager;
