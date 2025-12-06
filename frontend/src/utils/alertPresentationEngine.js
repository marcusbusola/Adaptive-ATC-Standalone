/**
 * Alert Presentation Engine
 *
 * Central logic for determining alert visual and audio intensity based on:
 * - Event severity
 * - Alert condition (1=Traditional, 2=Rule-Based, 3=ML-Based)
 * - Player workload state (idle/busy/overwhelmed)
 * - Player current focus (selected aircraft)
 * - Unresolved items count (for idle nudging)
 *
 * Intensity Levels:
 * - Visual: 1-5 scale (1=subtle, 5=maximum prominence)
 * - Audio: 0-4 scale (0=silent, 1=soft chime, 2=moderate, 3=loud, 4=siren)
 */

/**
 * Predefined intensity levels
 */
export const INTENSITY_LEVELS = {
  MINIMAL: { visual: 1, audio: 0 },
  LOW: { visual: 2, audio: 1 },
  MEDIUM: { visual: 3, audio: 2 },
  HIGH: { visual: 4, audio: 3 },
  CRITICAL: { visual: 5, audio: 4 }
};

/**
 * Map severity string to base intensity levels
 * @param {string} severity - 'critical', 'high', 'medium', 'low', 'info'
 * @returns {Object} { visual: number, audio: number }
 */
function getBaseIntensity(severity) {
  switch (severity) {
    case 'critical':
      return { ...INTENSITY_LEVELS.CRITICAL };
    case 'high':
      return { ...INTENSITY_LEVELS.HIGH };
    case 'medium':
    case 'warning':
      return { ...INTENSITY_LEVELS.MEDIUM };
    case 'low':
    case 'info':
      return { ...INTENSITY_LEVELS.LOW };
    default:
      return { ...INTENSITY_LEVELS.MEDIUM };
  }
}

/**
 * Mode A: Traditional Alert Presentation
 *
 * Presentation is determined solely by event severity.
 * Workload state and focus are ignored.
 *
 * @param {string} severity - Event severity level
 * @returns {Object} Presentation configuration
 */
export function getTraditionalPresentation(severity) {
  const base = getBaseIntensity(severity);

  return {
    visual: base.visual,
    audio: base.audio,
    componentType: 'modal',
    logicMode: 'traditional',
    styleModifiers: {},
    shouldNudge: false,
    nudgeIntensity: 0
  };
}

/**
 * Mode B: Rule-Based Adaptive Presentation
 *
 * Uses handcrafted rules to adapt presentation based on context:
 * - If overwhelmed AND non-critical: reduce intrusiveness
 * - If idle AND high-severity: increase prominence
 * - If focused on affected aircraft: reduce global alert intensity
 *
 * @param {string} severity - Event severity level
 * @param {string} workloadState - 'idle', 'busy', or 'overwhelmed'
 * @param {Object} currentFocus - { selectedAircraft, activePanel }
 * @param {string} affectedAircraft - Aircraft callsign affected by this alert
 * @returns {Object} Presentation configuration
 */
export function getRuleBasedPresentation(severity, workloadState, currentFocus, affectedAircraft) {
  const base = getBaseIntensity(severity);
  const styleModifiers = {};

  // Rule 1: If overwhelmed AND event is non-critical, reduce intrusiveness
  if (workloadState === 'overwhelmed' && severity !== 'critical') {
    base.visual = Math.max(1, base.visual - 2);
    base.audio = Math.max(0, base.audio - 1);
    styleModifiers.workloadReduced = true;
  }

  // Rule 2: If idle AND high-severity event, increase prominence
  if (workloadState === 'idle' && (severity === 'high' || severity === 'critical')) {
    base.visual = Math.min(5, base.visual + 1);
    base.audio = Math.min(4, base.audio + 1);
    styleModifiers.idleBoost = true;
  }

  // Rule 3: If player is already focused on the affected aircraft, reduce global intensity
  if (currentFocus?.selectedAircraft === affectedAircraft && affectedAircraft) {
    base.visual = Math.max(1, base.visual - 1);
    // Keep audio for peripheral awareness
    styleModifiers.focusReduced = true;
  }

  return {
    visual: base.visual,
    audio: base.audio,
    componentType: 'banner',
    logicMode: 'rule_based',
    styleModifiers,
    shouldNudge: false,
    nudgeIntensity: 0
  };
}

/**
 * Mode C: ML-Based Adaptive Presentation
 *
 * Extends rule-based logic with idle nudging:
 * - When player is idle AND there are unresolved alerts/conflicts,
 *   increase salience to draw attention back to the interface.
 *
 * @param {string} severity - Event severity level
 * @param {string} workloadState - 'idle', 'busy', or 'overwhelmed'
 * @param {Object} currentFocus - { selectedAircraft, activePanel }
 * @param {number} unresolvedItems - Count of unresolved alerts + conflicts
 * @param {string} affectedAircraft - Aircraft callsign affected by this alert
 * @returns {Object} Presentation configuration
 */
export function getMLBasedPresentation(severity, workloadState, currentFocus, unresolvedItems, affectedAircraft) {
  // Start with rule-based logic
  const presentation = getRuleBasedPresentation(severity, workloadState, currentFocus, affectedAircraft);
  presentation.logicMode = 'ml_based';

  // Idle Nudging: when idle AND unresolved items exist
  if (workloadState === 'idle' && unresolvedItems > 0) {
    presentation.shouldNudge = true;
    // Nudge intensity scales with unresolved count (max 3 levels)
    presentation.nudgeIntensity = Math.min(unresolvedItems, 3);
    presentation.styleModifiers.nudgeActive = true;
  }

  return presentation;
}

/**
 * Main entry point - compute presentation based on condition
 *
 * @param {Object} params
 * @param {string} params.eventType - Type of event (emergency, conflict, etc.)
 * @param {string} params.severity - Event severity level
 * @param {number} params.condition - Alert condition (1, 2, or 3)
 * @param {string} params.workloadState - Player workload state
 * @param {Object} params.currentFocus - Player focus info
 * @param {number} params.unresolvedItems - Count of unresolved items
 * @param {string} params.affectedAircraft - Aircraft affected by alert
 * @returns {Object} Complete presentation configuration
 */
export function computePresentation({
  eventType,
  severity,
  condition,
  workloadState = 'busy',
  currentFocus = {},
  unresolvedItems = 0,
  affectedAircraft = null
}) {
  let presentation;

  switch (condition) {
    case 1:
      presentation = getTraditionalPresentation(severity);
      break;
    case 2:
      presentation = getRuleBasedPresentation(severity, workloadState, currentFocus, affectedAircraft);
      break;
    case 3:
      presentation = getMLBasedPresentation(severity, workloadState, currentFocus, unresolvedItems, affectedAircraft);
      break;
    default:
      presentation = getTraditionalPresentation(severity);
  }

  // Add metadata for logging
  presentation.eventType = eventType;
  presentation.severity = severity;
  presentation.condition = condition;
  presentation.workloadStateAtPresentation = workloadState;
  presentation.timestamp = Date.now();

  return presentation;
}

/**
 * Get CSS class suffix based on visual intensity
 * @param {number} intensity - Visual intensity (1-5)
 * @returns {string} CSS class suffix
 */
export function getIntensityClass(intensity) {
  return `intensity-${Math.max(1, Math.min(5, intensity))}`;
}

/**
 * Determine if alert should play audio based on intensity
 * @param {number} audioIntensity - Audio intensity (0-4)
 * @returns {boolean} Whether audio should play
 */
export function shouldPlayAudio(audioIntensity) {
  return audioIntensity > 0;
}
