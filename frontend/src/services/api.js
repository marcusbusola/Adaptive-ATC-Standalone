/**
 * API Service Layer
 *
 * Handles all HTTP requests to the FastAPI backend
 */

import { getApiBaseUrl } from '../utils/apiConfig';
import { getAuthHeaders } from './tokenService';

const API_BASE_URL = getApiBaseUrl();

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers
    }
  };

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required. Please log in as researcher.');
    }
    const error = await response.json().catch(() => ({
      message: `HTTP ${response.status}: ${response.statusText}`
    }));
    throw new Error(error.message || error.detail || 'API request failed');
  }

  return await response.json();
}

// ============ SESSION MANAGEMENT ============

/**
 * Start a new research session
 */
export async function startSession(data) {
  return await apiFetch('/api/sessions/start', {
    method: 'POST',
    body: JSON.stringify({
      scenario: data.scenario,
      condition: data.condition,
      participant_id: data.participant_id
    })
  });
}

/**
 * End an active session
 */
export async function endSession(sessionId, data) {
  return await apiFetch(`/api/sessions/${sessionId}/end`, {
    method: 'POST',
    body: JSON.stringify({
      reason: data.reason || 'completed',
      final_state: data.final_state || {}
    })
  });
}

/**
 * Get session details
 */
export async function getSession(sessionId) {
  return await apiFetch(`/api/sessions/${sessionId}`);
}

/**
 * Update scenario state and get triggered events
 */
export async function updateScenario(sessionId, elapsedTime) {
  return await apiFetch(`/api/sessions/${sessionId}/update`, {
    method: 'POST',
    body: JSON.stringify({
      elapsed_time: elapsedTime
    })
  });
}

/**
 * Export complete session data
 */
export async function exportSessionData(sessionId) {
  return await apiFetch(`/api/sessions/${sessionId}/export`);
}

// ============ CONFIGURATION DATA ============

/**
 * Fetch available scenarios
 */
export async function fetchScenarios() {
  return await apiFetch('/api/scenarios');
}

/**
 * Fetch available conditions
 */
export async function fetchConditions() {
  return await apiFetch('/api/conditions');
}

// ============ BEHAVIORAL TRACKING ============

/**
 * Log behavioral events (batched)
 */
export async function logBehavioralEvent(sessionId, events) {
  return await apiFetch(`/api/sessions/${sessionId}/behavioral-events`, {
    method: 'POST',
    body: JSON.stringify({
      events: Array.isArray(events) ? events : [events]
    })
  });
}

/**
 * Get behavioral events for a session
 */
export async function getBehavioralEvents(sessionId, limit = 100) {
  return await apiFetch(`/api/sessions/${sessionId}/behavioral-events?limit=${limit}`);
}

// ============ ALERTS ============

/**
 * Log alert display
 */
export async function logAlertDisplay(sessionId, alertData) {
  return await apiFetch(`/api/sessions/${sessionId}/alerts`, {
    method: 'POST',
    body: JSON.stringify(alertData)
  });
}

/**
 * Log alert acknowledgment
 */
export async function logAlertAcknowledgment(sessionId, alertId, data) {
  return await apiFetch(`/api/sessions/${sessionId}/alerts/${alertId}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({
      acknowledged_at: data.acknowledged_at,
      response_time_ms: data.response_time_ms
    })
  });
}

/**
 * Log alert dismissal
 */
export async function logAlertDismissal(sessionId, alertId, data) {
  return await apiFetch(`/api/sessions/${sessionId}/alerts/${alertId}/dismiss`, {
    method: 'POST',
    body: JSON.stringify({
      dismissed_at: data.dismissed_at,
      time_displayed_ms: data.time_displayed_ms
    })
  });
}

/**
 * Get alerts for a session
 */
export async function getAlerts(sessionId) {
  return await apiFetch(`/api/sessions/${sessionId}/alerts`);
}

// ============ SURVEYS ============

/**
 * Submit survey response (single survey)
 */
export async function submitSurveyResponse(sessionId, surveyData) {
  // Transform to backend expected format
  const { survey_type, phase, survey_phase, duration_seconds, ...rest } = surveyData;
  const payload = {
    survey_type: survey_type || 'unknown',
    survey_phase: survey_phase || phase || 'post',
    responses: rest,
    duration_seconds: duration_seconds || null
  };

  return await apiFetch(`/api/sessions/${sessionId}/surveys`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Submit post-session survey (legacy - use submitSurveyResponse)
 */
export async function submitSurvey(sessionId, surveyData) {
  return await submitSurveyResponse(sessionId, surveyData);
}

/**
 * Get all survey responses for a session
 */
export async function getSurveyResponses(sessionId) {
  return await apiFetch(`/api/sessions/${sessionId}/surveys`);
}

// ============ METRICS ============

/**
 * Get session metrics
 */
export async function getSessionMetrics(sessionId) {
  return await apiFetch(`/api/sessions/${sessionId}/metrics`);
}

/**
 * Get performance summary
 */
export async function getPerformanceSummary(sessionId) {
  return await apiFetch(`/api/sessions/${sessionId}/performance`);
}

// ============ ML PREDICTIONS (Condition 3) ============

/**
 * Get ML complacency prediction
 */
export async function getMLPrediction(sessionId) {
  return await apiFetch(`/api/sessions/${sessionId}/ml-prediction`);
}

/**
 * Get ML prediction history
 */
export async function getMLPredictionHistory(sessionId) {
  return await apiFetch(`/api/sessions/${sessionId}/ml-predictions`);
}

// ============ HEALTH CHECK ============

/**
 * Check API health
 */
export async function healthCheck() {
  return await apiFetch('/health');
}

export default {
  startSession,
  endSession,
  getSession,
  updateScenario,
  exportSessionData,
  fetchScenarios,
  fetchConditions,
  logBehavioralEvent,
  getBehavioralEvents,
  logAlertDisplay,
  logAlertAcknowledgment,
  logAlertDismissal,
  getAlerts,
  submitSurvey,
  getSessionMetrics,
  getPerformanceSummary,
  getMLPrediction,
  getMLPredictionHistory,
  healthCheck
};
