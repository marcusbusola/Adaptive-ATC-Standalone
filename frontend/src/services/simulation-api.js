/**
 * Simulation API Service
 *
 * Provides methods to control the backend simulation engine.
 * Replaces bluesky-adapter.js for standalone simulation.
 */

import { getApiUrl } from '../utils/apiConfig';

const API_URL = getApiUrl();

/**
 * API client for simulation control
 */
class SimulationAPI {
  constructor() {
    this.baseUrl = API_URL;
  }

  async fetch(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'API request failed');
    }

    return response.json();
  }

  // ===== Simulation Control =====

  /**
   * Get simulation health/status
   */
  async getHealth() {
    return this.fetch('/api/simulation/health');
  }

  /**
   * Get current simulation state
   */
  async getState() {
    return this.fetch('/api/simulation/state');
  }

  /**
   * Start simulation with aircraft configuration
   * @param {Array} aircraft - List of aircraft configs
   * @param {number} speedMultiplier - Time acceleration (1.0 = real-time)
   */
  async start(aircraft = [], speedMultiplier = 1.0) {
    return this.fetch('/api/simulation/start', {
      method: 'POST',
      body: JSON.stringify({ aircraft, speed_multiplier: speedMultiplier }),
    });
  }

  /**
   * Stop simulation
   */
  async stop() {
    return this.fetch('/api/simulation/stop', { method: 'POST' });
  }

  /**
   * Pause simulation
   */
  async pause() {
    return this.fetch('/api/simulation/pause', { method: 'POST' });
  }

  /**
   * Resume simulation
   */
  async resume() {
    return this.fetch('/api/simulation/resume', { method: 'POST' });
  }

  /**
   * Set simulation speed
   * @param {number} multiplier - Speed multiplier (0.1 to 10.0)
   */
  async setSpeed(multiplier) {
    return this.fetch(`/api/simulation/speed?multiplier=${multiplier}`, {
      method: 'POST',
    });
  }

  // ===== Aircraft Control =====

  /**
   * Spawn a new aircraft
   * @param {Object} config - Aircraft configuration
   */
  async spawnAircraft(config) {
    return this.fetch('/api/aircraft/spawn', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  /**
   * Remove an aircraft
   * @param {string} callsign - Aircraft callsign
   */
  async removeAircraft(callsign) {
    return this.fetch(`/api/aircraft/${callsign}/remove`, {
      method: 'POST',
    });
  }

  /**
   * Issue command to aircraft
   * @param {string} callsign - Aircraft callsign
   * @param {Object} command - Command (altitude, heading, speed)
   */
  async commandAircraft(callsign, command) {
    return this.fetch(`/api/aircraft/${callsign}/command`, {
      method: 'POST',
      body: JSON.stringify(command),
    });
  }

  /**
   * Set aircraft altitude
   * @param {string} callsign - Aircraft callsign
   * @param {number} altitude - Target altitude in feet
   */
  async setAltitude(callsign, altitude) {
    return this.commandAircraft(callsign, { altitude });
  }

  /**
   * Set aircraft heading
   * @param {string} callsign - Aircraft callsign
   * @param {number} heading - Target heading in degrees
   */
  async setHeading(callsign, heading) {
    return this.commandAircraft(callsign, { heading });
  }

  /**
   * Set aircraft speed
   * @param {string} callsign - Aircraft callsign
   * @param {number} speed - Target speed in knots
   */
  async setSpeed(callsign, speed) {
    return this.commandAircraft(callsign, { speed });
  }

  // ===== Events =====

  /**
   * Inject an event (emergency, comm loss)
   * @param {string} eventType - "emergency" or "comm_loss"
   * @param {string} callsign - Aircraft callsign
   * @param {string} details - Optional details
   */
  async injectEvent(eventType, callsign, details = null) {
    return this.fetch('/api/simulation/inject-event', {
      method: 'POST',
      body: JSON.stringify({
        event_type: eventType,
        callsign,
        details,
      }),
    });
  }

  /**
   * Trigger emergency for aircraft
   * @param {string} callsign - Aircraft callsign
   * @param {string} type - Emergency type (fuel, medical, etc.)
   */
  async triggerEmergency(callsign, type = 'general') {
    return this.injectEvent('emergency', callsign, type);
  }

  /**
   * Trigger comm loss for aircraft
   * @param {string} callsign - Aircraft callsign
   */
  async triggerCommLoss(callsign) {
    return this.injectEvent('comm_loss', callsign);
  }
}

// Export singleton instance
const simulationApi = new SimulationAPI();
export default simulationApi;
