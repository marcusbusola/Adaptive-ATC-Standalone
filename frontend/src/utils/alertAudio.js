/**
 * Alert Audio Utility
 *
 * Extended audio functions for variable intensity alerts.
 * Provides sounds for banner alerts (Conditions 2 & 3) and idle nudging.
 *
 * Audio Intensity Levels:
 * 0 = Silent
 * 1 = Soft chime (gentle notification)
 * 2 = Moderate tone (standard notification)
 * 3 = Loud alarm (urgent)
 * 4 = Siren (critical/escalated)
 */

import { getAudioContext, playTone, playAlertSound } from './alertSounds';

/**
 * Audio intensity level constants
 */
export const AUDIO_INTENSITIES = {
  SILENT: 0,
  SOFT_CHIME: 1,
  MODERATE_TONE: 2,
  LOUD_ALARM: 3,
  SIREN: 4
};

/**
 * Play a soft chime for low-intensity alerts
 * Single gentle tone suitable for non-urgent notifications
 *
 * @param {number} volume - Volume level (0.0 to 1.0), default 0.2
 */
export async function playSoftChime(volume = 0.2) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Single gentle A4 tone
    playTone(ctx, 440, 150, volume);
  } catch (error) {
    console.error('Error playing soft chime:', error);
  }
}

/**
 * Play a moderate notification tone for medium-intensity alerts
 * Double beep suitable for standard notifications
 *
 * @param {number} volume - Volume level (0.0 to 1.0), default 0.3
 */
export async function playModerateTone(volume = 0.3) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Double beep pattern at C5
    playTone(ctx, 523, 120, volume);
    setTimeout(() => playTone(ctx, 523, 120, volume), 180);
  } catch (error) {
    console.error('Error playing moderate tone:', error);
  }
}

/**
 * Play a nudge sound for ML idle nudging
 * Subtle rising pulse to draw attention without being alarming
 *
 * @param {number} volume - Volume level (0.0 to 1.0), default 0.25
 */
export async function playNudgeSound(volume = 0.25) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Rising pulse: G4 -> A4 -> B4
    playTone(ctx, 392, 100, volume * 0.7);
    setTimeout(() => playTone(ctx, 440, 100, volume * 0.85), 120);
    setTimeout(() => playTone(ctx, 494, 100, volume), 240);
  } catch (error) {
    console.error('Error playing nudge sound:', error);
  }
}

/**
 * Play an urgent nudge sound for persistent idle state
 * More insistent pattern for higher nudge intensity
 *
 * @param {number} volume - Volume level (0.0 to 1.0), default 0.3
 */
export async function playUrgentNudge(volume = 0.3) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // More insistent: A4 -> C5 -> A4 -> C5
    playTone(ctx, 440, 80, volume);
    setTimeout(() => playTone(ctx, 523, 80, volume), 100);
    setTimeout(() => playTone(ctx, 440, 80, volume), 200);
    setTimeout(() => playTone(ctx, 523, 80, volume), 300);
  } catch (error) {
    console.error('Error playing urgent nudge:', error);
  }
}

/**
 * Play banner notification sound based on intensity
 * Used by AdaptiveBannerAlert and MLPredictiveAlert components
 *
 * @param {number} intensity - Audio intensity level (0-4)
 * @param {number} volume - Base volume level (0.0 to 1.0), default 0.3
 */
export async function playBannerNotification(intensity, volume = 0.3) {
  switch (intensity) {
    case AUDIO_INTENSITIES.SILENT:
      return; // No sound
    case AUDIO_INTENSITIES.SOFT_CHIME:
      return playSoftChime(volume * 0.8);
    case AUDIO_INTENSITIES.MODERATE_TONE:
      return playModerateTone(volume);
    case AUDIO_INTENSITIES.LOUD_ALARM:
      return playModerateTone(volume * 1.2);
    case AUDIO_INTENSITIES.SIREN:
      // For highest intensity, use the warning sound from alertSounds
      return playAlertSound('warning', { volume: volume * 1.3 });
    default:
      return;
  }
}

/**
 * Play alert by intensity level
 * Unified function that maps intensity to appropriate sound
 *
 * @param {number} intensity - Audio intensity level (0-4)
 * @param {Object} options - Configuration options
 * @param {number} options.volume - Volume level (0.0 to 1.0)
 * @param {boolean} options.isEscalated - If true, use escalated sound at intensity >= 3
 * @param {boolean} options.isNudge - If true, use nudge sounds
 */
export async function playAlertByIntensity(intensity, options = {}) {
  const { volume = 0.3, isEscalated = false, isNudge = false } = options;

  // Handle nudge sounds separately
  if (isNudge && intensity > 0) {
    if (intensity >= 3) {
      return playUrgentNudge(volume);
    } else {
      return playNudgeSound(volume);
    }
  }

  // Handle escalated alerts
  if (isEscalated && intensity >= 3) {
    return playAlertSound('escalated', { volume });
  }

  // Normal intensity mapping
  switch (intensity) {
    case 0:
      return; // Silent
    case 1:
      return playSoftChime(volume);
    case 2:
      return playModerateTone(volume);
    case 3:
      return playAlertSound('warning', { volume });
    case 4:
      return playAlertSound('critical', { volume });
    default:
      return;
  }
}

/**
 * Calculate volume from intensity
 * Maps intensity levels to appropriate volume values
 *
 * @param {number} intensity - Audio intensity level (0-4)
 * @param {number} baseVolume - Base volume level, default 0.3
 * @returns {number} Calculated volume (0.0 to 1.0)
 */
export function calculateVolume(intensity, baseVolume = 0.3) {
  // Linear scaling: intensity 1 = 80%, 2 = 100%, 3 = 120%, 4 = 150%
  const multiplier = 0.6 + (intensity * 0.2);
  return Math.min(baseVolume * multiplier, 1.0);
}
