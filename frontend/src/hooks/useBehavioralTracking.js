import { useState, useEffect, useRef, useCallback } from 'react';
import { logBehavioralEvent } from '../services/api';

/**
 * Behavioral Tracking Hook
 *
 * Tracks participant interactions for research analysis:
 * - Mouse movements and clicks
 * - Hover events and dwell times
 * - Keyboard interactions
 * - Focus changes
 * - Alert interactions
 * - Response times
 *
 * Sends batched events to backend for ML feature extraction
 */
const useBehavioralTracking = (sessionId) => {
  const [trackingActive, setTrackingActive] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [lastEventTimestamp, setLastEventTimestamp] = useState(null);

  const eventsBufferRef = useRef([]);
  const lastMousePositionRef = useRef({ x: 0, y: 0 });
  const lastMouseMoveTimeRef = useRef(Date.now());
  const hoverStartTimeRef = useRef(null);
  const currentHoverTargetRef = useRef(null);
  const batchIntervalRef = useRef(null);

  // Recent events buffer for workload state computation
  const recentEventsRef = useRef([]);

  // Configuration
  const BATCH_SIZE = 50; // Send events in batches
  const BATCH_INTERVAL = 5000; // Send every 5 seconds
  const MOUSE_MOVE_THROTTLE = 100; // Track mouse every 100ms
  const HOVER_THRESHOLD = 500; // Consider hover after 500ms

  /**
   * Send buffered events to backend
   */
  const sendBatch = useCallback(async () => {
    if (eventsBufferRef.current.length === 0) return;

    const batch = [...eventsBufferRef.current];
    eventsBufferRef.current = [];

    try {
      await logBehavioralEvent(sessionId, batch);
      console.log(`Sent ${batch.length} behavioral events`);
    } catch (err) {
      console.error('Failed to send behavioral events:', err);
      // Re-add failed events to buffer (with limit to prevent memory issues)
      if (eventsBufferRef.current.length < BATCH_SIZE * 2) {
        eventsBufferRef.current.unshift(...batch);
      }
    }
  }, [sessionId]);

  /**
   * Add event to buffer
   */
  const addEvent = useCallback((eventType, eventData = {}) => {
    const allowIfDisabled = eventType === 'tracking_started' || eventType === 'tracking_stopped';
    if ((!trackingActive && !allowIfDisabled) || !sessionId) return;
    // Avoid noisy events when tab is hidden to reduce unnecessary processing
    if (document.hidden && !allowIfDisabled) return;

    const event = {
      session_id: sessionId,
      event_type: eventType,
      timestamp: Date.now(),
      data: eventData
    };

    eventsBufferRef.current.push(event);
    setEventCount(prev => prev + 1);
    setLastEventTimestamp(event.timestamp);

    // Add to recent events buffer for workload tracking
    const now = Date.now();
    recentEventsRef.current.push({ timestamp: now, type: eventType });
    // Prune old events (keep last 10 seconds)
    recentEventsRef.current = recentEventsRef.current.filter(
      e => now - e.timestamp < 10000
    );

    // Send batch if buffer is full
    if (eventsBufferRef.current.length >= BATCH_SIZE) {
      sendBatch();
    }
  }, [trackingActive, sessionId, sendBatch]);

  /**
   * Mouse move handler
   */
  const handleMouseMove = useCallback((e) => {
    const now = Date.now();

    // Throttle mouse move events
    if (now - lastMouseMoveTimeRef.current < MOUSE_MOVE_THROTTLE) {
      return;
    }

    const { clientX, clientY } = e;
    const lastPos = lastMousePositionRef.current;

    // Calculate velocity
    const dx = clientX - lastPos.x;
    const dy = clientY - lastPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const velocity = distance / (now - lastMouseMoveTimeRef.current);

    addEvent('mouse_move', {
      x: clientX,
      y: clientY,
      velocity,
      distance,
      target: e.target.className || e.target.tagName
    });

    lastMousePositionRef.current = { x: clientX, y: clientY };
    lastMouseMoveTimeRef.current = now;
  }, [addEvent]);

  /**
   * Mouse click handler
   */
  const handleClick = useCallback((e) => {
    addEvent('click', {
      x: e.clientX,
      y: e.clientY,
      button: e.button,
      target: e.target.className || e.target.tagName,
      target_id: e.target.id,
      ctrl_key: e.ctrlKey,
      shift_key: e.shiftKey,
      alt_key: e.altKey
    });
  }, [addEvent]);

  /**
   * Mouse enter handler (for hover tracking)
   */
  const handleMouseEnter = useCallback((e) => {
    hoverStartTimeRef.current = Date.now();
    currentHoverTargetRef.current = e.target;
  }, []);

  /**
   * Mouse leave handler (for hover tracking)
   */
  const handleMouseLeave = useCallback((e) => {
    if (hoverStartTimeRef.current) {
      const dwellTime = Date.now() - hoverStartTimeRef.current;

      if (dwellTime > HOVER_THRESHOLD) {
        addEvent('hover', {
          target: e.target.className || e.target.tagName,
          target_id: e.target.id,
          dwell_time_ms: dwellTime
        });
      }

      hoverStartTimeRef.current = null;
      currentHoverTargetRef.current = null;
    }
  }, [addEvent]);

  /**
   * Keyboard handler
   */
  const handleKeyPress = useCallback((e) => {
    addEvent('keypress', {
      key: e.key,
      code: e.code,
      ctrl_key: e.ctrlKey,
      shift_key: e.shiftKey,
      alt_key: e.altKey,
      target: e.target.className || e.target.tagName
    });
  }, [addEvent]);

  /**
   * Focus change handler
   */
  const handleFocus = useCallback((e) => {
    addEvent('focus', {
      target: e.target.className || e.target.tagName,
      target_id: e.target.id
    });
  }, [addEvent]);

  /**
   * Blur handler
   */
  const handleBlur = useCallback((e) => {
    addEvent('blur', {
      target: e.target.className || e.target.tagName,
      target_id: e.target.id
    });
  }, [addEvent]);

  /**
   * Scroll handler
   */
  const handleScroll = useCallback((e) => {
    addEvent('scroll', {
      scroll_x: window.scrollX,
      scroll_y: window.scrollY,
      target: e.target.className || e.target.tagName
    });
  }, [addEvent]);

  /**
   * Start tracking
   */
  const startTracking = useCallback(() => {
    if (!sessionId) {
      console.warn('Cannot start tracking: no session ID');
      return;
    }

    console.log('Starting behavioral tracking');
    setTrackingActive(true);
    setEventCount(0);
    eventsBufferRef.current = [];

    // Add event listeners
    const passiveOpts = { passive: true };
    window.addEventListener('mousemove', handleMouseMove, passiveOpts);
    window.addEventListener('click', handleClick, passiveOpts);
    window.addEventListener('mouseenter', handleMouseEnter, true);
    window.addEventListener('mouseleave', handleMouseLeave, true);
    window.addEventListener('keypress', handleKeyPress, passiveOpts);
    window.addEventListener('focus', handleFocus, true);
    window.addEventListener('blur', handleBlur, true);
    window.addEventListener('scroll', handleScroll, passiveOpts);

    // Start batch interval
    batchIntervalRef.current = setInterval(sendBatch, BATCH_INTERVAL);

    // Log tracking start event
    addEvent('tracking_started', {
      session_id: sessionId
    });
  }, [
    handleMouseMove,
    handleClick,
    handleMouseEnter,
    handleMouseLeave,
    handleKeyPress,
    handleFocus,
    handleBlur,
    handleScroll,
    sendBatch,
    sessionId,
    addEvent
  ]);

  /**
   * Stop tracking
   */
  const stopTracking = useCallback(() => {
    if (!sessionId) {
      console.warn('Cannot stop tracking: no session ID');
      return;
    }

    console.log('Stopping behavioral tracking');

    // Remove event listeners first to prevent new events
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('click', handleClick);
    window.removeEventListener('mouseenter', handleMouseEnter, true);
    window.removeEventListener('mouseleave', handleMouseLeave, true);
    window.removeEventListener('keypress', handleKeyPress);
    window.removeEventListener('focus', handleFocus, true);
    window.removeEventListener('blur', handleBlur, true);
    window.removeEventListener('scroll', handleScroll);

    // Clear batch interval
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }

    // Add tracking stop event BEFORE sending final batch (so it's included)
    // Note: We add directly to buffer since addEvent checks trackingActive
    const stopEvent = {
      session_id: sessionId,
      event_type: 'tracking_stopped',
      timestamp: Date.now(),
      data: {
        session_id: sessionId,
        total_events: eventCount
      }
    };
    eventsBufferRef.current.push(stopEvent);

    // Now set tracking inactive
    setTrackingActive(false);

    // Send all remaining events including the stop event
    if (eventsBufferRef.current.length > 0) {
      sendBatch();
    }
  }, [
    handleMouseMove,
    handleClick,
    handleMouseEnter,
    handleMouseLeave,
    handleKeyPress,
    handleFocus,
    handleBlur,
    handleScroll,
    sendBatch,
    sessionId,
    eventCount
  ]);

  /**
   * Get tracked events (for final session data)
   */
  const getTrackedEvents = useCallback(() => {
    return eventsBufferRef.current;
  }, []);

  /**
   * Track custom event
   */
  const trackEvent = useCallback((eventType, eventData = {}) => {
    addEvent(eventType, eventData);
  }, [addEvent]);

  /**
   * Get count of recent events within a time window
   * Used for workload state computation
   *
   * @param {number} windowMs - Time window in milliseconds (default 5000ms)
   * @returns {number} Count of events in the window
   */
  const getRecentEventCount = useCallback((windowMs = 5000) => {
    const cutoff = Date.now() - windowMs;
    return recentEventsRef.current.filter(e => e.timestamp >= cutoff).length;
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (trackingActive) {
        stopTracking();
      }
    };
  }, [trackingActive, stopTracking]);

  return {
    trackingActive,
    eventCount,
    lastEventTimestamp,
    startTracking,
    stopTracking,
    trackEvent,
    getTrackedEvents,
    getRecentEventCount
  };
};

export default useBehavioralTracking;
