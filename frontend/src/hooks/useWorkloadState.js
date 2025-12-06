import { useState, useEffect, useCallback } from 'react';

/**
 * Workload State Hook
 *
 * Computes and exposes real-time workload state based on behavioral events.
 * Used by the alert presentation engine to adapt alert intrusiveness.
 *
 * Workload States:
 * - 'idle': <1 event per 5 seconds (low activity, may need nudging)
 * - 'busy': 1-5 events per 5 seconds (normal engagement)
 * - 'overwhelmed': >5 events per 5 seconds (high activity, reduce interruptions)
 */

// Workload thresholds (events per 5 seconds)
const WORKLOAD_THRESHOLDS = {
  IDLE_MAX: 1,      // <1 event per 5s = idle
  BUSY_MAX: 5       // 1-5 events = busy, >5 = overwhelmed
};

const WINDOW_MS = 5000; // 5-second sliding window
const UPDATE_INTERVAL_MS = 1000; // Update workload state every second

/**
 * @param {Object} options
 * @param {Function} options.getRecentEventCount - Function to get event count in a time window
 * @param {string|null} options.selectedAircraft - Currently selected aircraft callsign
 * @param {string} options.activePanel - Currently active UI panel ('radar', 'alerts', 'commands')
 * @param {Array} options.pendingAlerts - Acknowledged but unresolved alerts
 * @param {Array} options.conflicts - Active aircraft conflicts
 */
const useWorkloadState = ({
  getRecentEventCount,
  selectedAircraft = null,
  activePanel = 'radar',
  pendingAlerts = [],
  conflicts = []
}) => {
  const [workloadState, setWorkloadState] = useState('idle');
  const [currentFocus, setCurrentFocus] = useState({
    selectedAircraft: null,
    activePanel: 'radar'
  });
  const [unresolvedCount, setUnresolvedCount] = useState(0);

  // Update workload state every second
  useEffect(() => {
    if (!getRecentEventCount) return;

    const updateWorkload = () => {
      const eventCount = getRecentEventCount(WINDOW_MS);

      if (eventCount < WORKLOAD_THRESHOLDS.IDLE_MAX) {
        setWorkloadState('idle');
      } else if (eventCount <= WORKLOAD_THRESHOLDS.BUSY_MAX) {
        setWorkloadState('busy');
      } else {
        setWorkloadState('overwhelmed');
      }
    };

    // Initial update
    updateWorkload();

    // Set up interval
    const interval = setInterval(updateWorkload, UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [getRecentEventCount]);

  // Track focus changes
  useEffect(() => {
    setCurrentFocus({
      selectedAircraft,
      activePanel
    });
  }, [selectedAircraft, activePanel]);

  // Track unresolved items count
  useEffect(() => {
    setUnresolvedCount(pendingAlerts.length + conflicts.length);
  }, [pendingAlerts, conflicts]);

  /**
   * Check if player should be nudged (idle with unresolved issues)
   */
  const shouldNudge = useCallback(() => {
    return workloadState === 'idle' && unresolvedCount > 0;
  }, [workloadState, unresolvedCount]);

  /**
   * Check if player is focused on a specific aircraft
   */
  const isFocusedOn = useCallback((aircraftCallsign) => {
    return currentFocus.selectedAircraft === aircraftCallsign;
  }, [currentFocus.selectedAircraft]);

  return {
    workloadState,
    currentFocus,
    unresolvedCount,
    shouldNudge,
    isFocusedOn
  };
};

export default useWorkloadState;
