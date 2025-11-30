const TOKEN_KEY = 'researcher_token';

export function setToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token');
  }
  sessionStorage.setItem(TOKEN_KEY, token.trim());
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getAuthHeaders() {
  const token = getToken();
  if (!token) {
    return {};
  }
  return {
    'Authorization': `Bearer ${token}`
  };
}
