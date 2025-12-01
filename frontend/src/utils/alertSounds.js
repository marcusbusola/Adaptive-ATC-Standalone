/**
 * Alert Sound Utility
 *
 * Provides audio alert capabilities for the Traditional Modal Alert component.
 * Uses Web Audio API to generate alert tones or plays audio files.
 *
 * Research Note: Audio alerts can be enabled/disabled per participant
 * to study the impact of multimodal alerts on controller performance.
 */

// Audio context (lazy initialization)
let audioContext = null;

/**
 * Initialize Web Audio API context
 * @private
 */
function getAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
      return null;
    }
  }
  return audioContext;
}

/**
 * Play alert sound based on severity
 *
 * @param {string} severity - 'escalated', 'critical', or 'warning'
 * @param {object} options - Sound configuration options
 * @returns {Promise<void>}
 */
export async function playAlertSound(severity = 'warning', options = {}) {
  const {
    volume = 0.3,           // Volume (0.0 to 1.0)
    duration = 200,         // Duration in milliseconds
    useFile = false,        // Use audio file instead of generated tone
    audioFile = null        // Path to audio file
  } = options;

  try {
    // If audio file specified, play it
    if (useFile && audioFile) {
      return playAudioFile(audioFile, volume);
    }

    // Otherwise generate tone based on severity
    if (severity === 'escalated') {
      return playEscalatedAlert(volume, duration);
    } else if (severity === 'critical') {
      return playCriticalAlert(volume, duration);
    } else {
      return playWarningAlert(volume, duration);
    }
  } catch (error) {
    console.error('Error playing alert sound:', error);
  }
}

/**
 * Play critical alert sound
 * Urgent, attention-grabbing triple beep
 *
 * @private
 * @param {number} volume - Volume level (0.0 to 1.0)
 * @param {number} duration - Duration of each beep in ms
 */
async function playCriticalAlert(volume, duration) {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Triple beep pattern: high frequency, rapid succession
  const beepPattern = [
    { frequency: 880, delay: 0 },      // First beep (A5)
    { frequency: 880, delay: 150 },    // Second beep
    { frequency: 880, delay: 300 }     // Third beep
  ];

  for (const beep of beepPattern) {
    await new Promise(resolve => {
      setTimeout(() => {
        playTone(ctx, beep.frequency, duration, volume);
        resolve();
      }, beep.delay);
    });
  }
}

/**
 * Play escalated alert sound
 * Most urgent - alternating high/low siren pattern
 *
 * @private
 * @param {number} volume - Volume level (0.0 to 1.0)
 * @param {number} duration - Duration of each tone in ms
 */
async function playEscalatedAlert(volume, duration) {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Siren-like alternating pattern: high and low frequencies
  const sirenPattern = [
    { frequency: 1000, delay: 0 },      // High tone
    { frequency: 700, delay: 120 },     // Low tone
    { frequency: 1000, delay: 240 },    // High tone
    { frequency: 700, delay: 360 },     // Low tone
    { frequency: 1000, delay: 480 },    // High tone
    { frequency: 700, delay: 600 }      // Low tone
  ];

  // Play at higher volume for escalated alerts
  const escalatedVolume = Math.min(volume * 1.5, 1.0);

  for (const tone of sirenPattern) {
    await new Promise(resolve => {
      setTimeout(() => {
        playTone(ctx, tone.frequency, duration * 0.8, escalatedVolume);
        resolve();
      }, tone.delay);
    });
  }
}

/**
 * Play warning alert sound
 * Less urgent, single or double beep
 *
 * @private
 * @param {number} volume - Volume level (0.0 to 1.0)
 * @param {number} duration - Duration of beep in ms
 */
async function playWarningAlert(volume, duration) {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Double beep pattern: medium frequency
  const beepPattern = [
    { frequency: 660, delay: 0 },      // First beep (E5)
    { frequency: 660, delay: 200 }     // Second beep
  ];

  for (const beep of beepPattern) {
    await new Promise(resolve => {
      setTimeout(() => {
        playTone(ctx, beep.frequency, duration, volume);
        resolve();
      }, beep.delay);
    });
  }
}

/**
 * Generate and play a single tone using Web Audio API
 *
 * @private
 * @param {AudioContext} ctx - Web Audio context
 * @param {number} frequency - Frequency in Hz
 * @param {number} duration - Duration in milliseconds
 * @param {number} volume - Volume (0.0 to 1.0)
 */
function playTone(ctx, frequency, duration, volume) {
  // Create oscillator (tone generator)
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  // Configure oscillator
  oscillator.type = 'sine'; // Sine wave for clean tone
  oscillator.frequency.value = frequency;

  // Configure volume with envelope (fade in/out to avoid clicks)
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
  gainNode.gain.linearRampToValueAtTime(
    volume,
    ctx.currentTime + duration / 1000 - 0.01
  );
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration / 1000);

  // Connect nodes: oscillator -> gain -> output
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  // Play tone
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration / 1000);
}

/**
 * Play audio file
 *
 * @private
 * @param {string} filePath - Path to audio file
 * @param {number} volume - Volume (0.0 to 1.0)
 * @returns {Promise<void>}
 */
async function playAudioFile(filePath, volume) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(filePath);
    audio.volume = volume;

    audio.addEventListener('ended', resolve);
    audio.addEventListener('error', reject);

    audio.play().catch(error => {
      console.error('Error playing audio file:', error);
      reject(error);
    });
  });
}

/**
 * Play success confirmation sound
 * A gentle ascending chime to indicate alert resolution
 *
 * @param {number} volume - Volume level (0.0 to 1.0), defaults to 0.25
 * @returns {Promise<void>}
 */
export async function playSuccessSound(volume = 0.25) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Gentle ascending chime: C5 -> E5 -> G5
    const chimePattern = [
      { frequency: 523, delay: 0 },      // C5
      { frequency: 659, delay: 100 },    // E5
      { frequency: 784, delay: 200 }     // G5
    ];

    for (const note of chimePattern) {
      await new Promise(resolve => {
        setTimeout(() => {
          playSuccessTone(ctx, note.frequency, 150, volume);
          resolve();
        }, note.delay);
      });
    }
  } catch (error) {
    console.error('Error playing success sound:', error);
  }
}

/**
 * Generate and play a single success tone (softer than alert tones)
 *
 * @private
 * @param {AudioContext} ctx - Web Audio context
 * @param {number} frequency - Frequency in Hz
 * @param {number} duration - Duration in milliseconds
 * @param {number} volume - Volume (0.0 to 1.0)
 */
function playSuccessTone(ctx, frequency, duration, volume) {
  // Create oscillator (tone generator)
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  // Use triangle wave for softer, more pleasant tone
  oscillator.type = 'triangle';
  oscillator.frequency.value = frequency;

  // Configure volume with smooth envelope
  const durationSec = duration / 1000;
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
  gainNode.gain.setValueAtTime(volume, ctx.currentTime + durationSec * 0.3);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationSec);

  // Connect nodes: oscillator -> gain -> output
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  // Play tone
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + durationSec);
}

/**
 * Test alert sounds
 * Useful for development and participant calibration
 *
 * @param {string} severity - 'critical' or 'warning'
 */
export function testAlertSound(severity = 'warning') {
  console.log(`Playing ${severity} alert sound...`);
  playAlertSound(severity, { volume: 0.5 });
}

/**
 * Test success sound
 * Useful for development and participant calibration
 */
export function testSuccessSound() {
  console.log('Playing success sound...');
  playSuccessSound(0.4);
}

/**
 * Stop all currently playing sounds
 * Useful for emergency situations or test cleanup
 */
export function stopAllSounds() {
  if (audioContext && audioContext.state === 'running') {
    audioContext.suspend();
    setTimeout(() => {
      if (audioContext) {
        audioContext.resume();
      }
    }, 100);
  }
}

/**
 * Check if audio is supported and enabled
 *
 * @returns {boolean}
 */
export function isAudioSupported() {
  return !!(window.AudioContext || window.webkitAudioContext);
}

/**
 * Preload audio files
 * Call this during app initialization to avoid delays
 *
 * @param {string[]} audioFiles - Array of audio file paths
 * @returns {Promise<void>}
 */
export async function preloadAudioFiles(audioFiles) {
  const promises = audioFiles.map(file => {
    return new Promise((resolve) => {
      const audio = new Audio(file);
      audio.addEventListener('canplaythrough', resolve);
      audio.addEventListener('error', resolve); // Resolve even on error
      audio.preload = 'auto';
    });
  });

  return Promise.all(promises);
}

// Example usage:
// import { playAlertSound, testAlertSound } from './utils/alertSounds';
//
// // In component
// playAlertSound('critical');
//
// // Test in console
// testAlertSound('warning');
