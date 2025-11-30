/**
 * useBlueskyLive Hook (Compatibility Layer)
 *
 * Provides backward compatibility for components expecting the old BlueSky interface.
 * Wraps useSimulation to provide { connected, lastMessage } interface.
 */

import useSimulation from './useSimulation';

/**
 * Hook for real-time simulation updates (BlueSky compatibility layer)
 * @returns {Object} { connected, lastMessage }
 */
export default function useBlueskyLive() {
  const { connected, state, aircraft, conflicts, error } = useSimulation();

  // Transform simulation state to lastMessage format expected by components
  const lastMessage = state ? {
    type: 'simulation',
    state: state,
    aircraft: aircraft,
    conflicts: conflicts,
    timestamp: Date.now(),
  } : null;

  return {
    connected,
    lastMessage,
    error,
  };
}
