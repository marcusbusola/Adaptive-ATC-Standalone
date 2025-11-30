/**
 * useSimulation Hook
 *
 * Provides real-time simulation state via Server-Sent Events (SSE)
 * Replaces useBlueskyLive.js for standalone simulation
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getApiUrl } from '../utils/apiConfig';

/**
 * Hook to connect to the simulation SSE stream
 * @returns {Object} { connected, state, aircraft, conflicts, error, reconnect }
 */
export default function useSimulation() {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState(null);
  const [aircraft, setAircraft] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [error, setError] = useState(null);

  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiUrl = getApiUrl();
    const sseUrl = `${apiUrl}/api/simulation/stream`;

    console.log('[useSimulation] Connecting to SSE:', sseUrl);

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[useSimulation] SSE connected');
        setConnected(true);
        setError(null);
      };

      eventSource.addEventListener('state', (event) => {
        try {
          const data = JSON.parse(event.data);
          setState(data);
          setAircraft(data.aircraft || []);
          setConflicts(data.conflicts || []);
        } catch (e) {
          console.error('[useSimulation] Failed to parse state:', e);
        }
      });

      eventSource.onerror = (e) => {
        console.error('[useSimulation] SSE error:', e);
        setConnected(false);
        setError('Connection lost');

        // Reconnect after delay
        eventSource.close();
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[useSimulation] Attempting reconnect...');
          connect();
        }, 3000);
      };

    } catch (e) {
      console.error('[useSimulation] Failed to create EventSource:', e);
      setError(e.message);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connected,
    state,
    aircraft,
    conflicts,
    error,
    reconnect: connect,
  };
}
