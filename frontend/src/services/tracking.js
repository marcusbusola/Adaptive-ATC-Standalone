/**
 * Behavioral Tracking Service
 * Tracks user interactions, response times, and behavioral metrics
 */

class BehavioralTracker {
  constructor(sessionId, participantId) {
    this.sessionId = sessionId;
    this.participantId = participantId;
    this.events = [];
    this.startTime = Date.now();
  }

  /**
   * Track alert presentation
   */
  trackAlertPresented(alertId, alertType, priority, presentationStyle) {
    const event = {
      type: 'alert_presented',
      alertId,
      alertType,
      priority,
      presentationStyle,
      timestamp: Date.now(),
      relativeTime: Date.now() - this.startTime,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Track alert acknowledgment
   */
  trackAlertAcknowledged(alertId, responseAction) {
    const presentEvent = this.events.find(
      e => e.type === 'alert_presented' && e.alertId === alertId
    );

    const responseTime = presentEvent
      ? Date.now() - presentEvent.timestamp
      : null;

    const event = {
      type: 'alert_acknowledged',
      alertId,
      responseAction,
      responseTime,
      timestamp: Date.now(),
      relativeTime: Date.now() - this.startTime,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Track mouse movement (sample rate limited)
   */
  trackMouseMovement(x, y) {
    const event = {
      type: 'mouse_movement',
      x,
      y,
      timestamp: Date.now(),
      relativeTime: Date.now() - this.startTime,
    };
    this.events.push(event);
  }

  /**
   * Track click events
   */
  trackClick(target, x, y) {
    const event = {
      type: 'click',
      target,
      x,
      y,
      timestamp: Date.now(),
      relativeTime: Date.now() - this.startTime,
    };
    this.events.push(event);
  }

  /**
   * Track task completion
   */
  trackTaskCompleted(taskId, success, metrics = {}) {
    const event = {
      type: 'task_completed',
      taskId,
      success,
      metrics,
      timestamp: Date.now(),
      relativeTime: Date.now() - this.startTime,
    };
    this.events.push(event);
  }

  /**
   * Get all tracked events
   */
  getEvents() {
    return this.events;
  }

  /**
   * Get events of specific type
   */
  getEventsByType(eventType) {
    return this.events.filter(e => e.type === eventType);
  }

  /**
   * Calculate metrics
   */
  getMetrics() {
    const alertEvents = this.getEventsByType('alert_acknowledged');
    const responseTimes = alertEvents
      .map(e => e.responseTime)
      .filter(rt => rt !== null);

    return {
      totalAlerts: this.getEventsByType('alert_presented').length,
      acknowledgedAlerts: alertEvents.length,
      averageResponseTime: responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : null,
      minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : null,
      maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : null,
      totalEvents: this.events.length,
      sessionDuration: Date.now() - this.startTime,
    };
  }

  /**
   * Export data for backend storage
   */
  exportData() {
    return {
      sessionId: this.sessionId,
      participantId: this.participantId,
      startTime: this.startTime,
      endTime: Date.now(),
      events: this.events,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Clear all events (use with caution)
   */
  clear() {
    this.events = [];
    this.startTime = Date.now();
  }
}

export default BehavioralTracker;
