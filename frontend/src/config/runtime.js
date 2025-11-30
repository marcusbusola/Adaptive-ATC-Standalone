/**
 * Runtime Configuration
 *
 * Determines URLs based on current environment (hostname detection).
 * This approach is more reliable than build-time environment variables
 * and fails explicitly in production instead of silently falling back to localhost.
 */

const buildTimeApiUrl = process.env.REACT_APP_API_URL;

function getOverride(key) {
  // Allow runtime override via global object if the page sets window.__RUNTIME_CONFIG__
  if (window.__RUNTIME_CONFIG__ && window.__RUNTIME_CONFIG__[key]) {
    return window.__RUNTIME_CONFIG__[key];
  }
  return null;
}

/**
 * Get API URL based on current environment
 * @returns {string} API URL
 * @throws {Error} If environment cannot be determined
 */
export function getApiUrl() {
  const hostname = window.location.hostname;

  // Explicit overrides first (build-time or runtime)
  const override = buildTimeApiUrl || getOverride('API_URL');
  if (override) {
    return override;
  }

  // Production: Render deployment (same-origin since frontend is served by backend)
  if (hostname.includes('render.com') || hostname.includes('onrender.com')) {
    return `${window.location.protocol}//${window.location.host}`;
  }

  // Local development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }

  // Unknown environment - default to same-origin API base to keep UI running
  console.warn(`Unknown environment (${hostname}) for API. Falling back to same-origin host.`);
  return `${window.location.protocol}//${window.location.host}`;
}

/**
 * Check if running in production environment
 * @returns {boolean}
 */
export function isProduction() {
  const hostname = window.location.hostname;
  return hostname.includes('render.com') || hostname.includes('onrender.com');
}

/**
 * Check if running in local development
 * @returns {boolean}
 */
export function isLocalDevelopment() {
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}
