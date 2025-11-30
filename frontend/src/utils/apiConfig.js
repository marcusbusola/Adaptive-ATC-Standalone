// Centralized API/WebSocket URL helpers to avoid localhost-only defaults.
import { getApiUrl } from '../config/runtime';

export function getApiBaseUrl() {
  return getApiUrl();
}

export function buildWebSocketUrl(path) {
  const apiBase = getApiBaseUrl();

  try {
    const url = new URL(apiBase);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}${path}`;
  } catch (err) {
    // Fallback if URL parsing fails
    const protocol = apiBase.startsWith('https') ? 'wss:' : 'ws:';
    const host = apiBase.replace(/^https?:\/\//, '');
    return `${protocol}//${host}${path}`;
  }
}
