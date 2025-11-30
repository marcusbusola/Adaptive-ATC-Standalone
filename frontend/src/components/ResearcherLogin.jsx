import React, { useState, useRef, useEffect } from 'react';
import { setToken } from '../services/tokenService';
import { getApiBaseUrl } from '../utils/apiConfig';
import './ResearcherLogin.css';

const API_URL = getApiBaseUrl();

const ResearcherLogin = ({ onLoginSuccess }) => {
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Auto-focus the input field when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const validateToken = async (token) => {
    try {
      // Test the token by calling a protected endpoint
      const response = await fetch(`${API_URL}/api/sessions/active`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return true;
      } else if (response.status === 401) {
        return false;
      } else {
        throw new Error('Failed to validate token');
      }
    } catch (err) {
      console.error('Token validation error:', err);
      throw err;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!tokenInput.trim()) {
      setError('Please enter a researcher token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const isValid = await validateToken(tokenInput.trim());

      if (isValid) {
        // Store token in session storage
        setToken(tokenInput.trim());

        // Call success callback
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      } else {
        setError('Invalid researcher token. Please check your credentials.');
        setTokenInput('');
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    } catch (err) {
      setError('Failed to authenticate. Please try again.');
      console.error('Authentication error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading && tokenInput.trim()) {
      handleSubmit(e);
    }
  };

  return (
    <div className="researcher-login-overlay">
      <div className="researcher-login-modal">
        <div className="researcher-login-header">
          <h2>Researcher Authentication</h2>
          <p className="researcher-login-subtitle">
            This area is restricted to authorized researchers
          </p>
        </div>

        <form onSubmit={handleSubmit} className="researcher-login-form">
          <div className="researcher-login-field">
            <label htmlFor="researcher-token">
              Researcher Token
            </label>
            <input
              ref={inputRef}
              id="researcher-token"
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your researcher token"
              disabled={loading}
              className={error ? 'input-error' : ''}
              autoComplete="off"
              aria-label="Researcher token"
              aria-required="true"
              aria-invalid={!!error}
            />
            {error && (
              <div className="researcher-login-error" role="alert">
                {error}
              </div>
            )}
          </div>

          <div className="researcher-login-info">
            <p>
              🔒 Your token is stored securely for this session only
            </p>
            <p className="researcher-login-note">
              Note: The token will expire when you close this tab
            </p>
          </div>

          <button
            type="submit"
            className="researcher-login-button"
            disabled={loading || !tokenInput.trim()}
          >
            {loading ? 'Authenticating...' : 'Log In'}
          </button>
        </form>

        <div className="researcher-login-footer">
          <p>
            Need access? Contact the research team for a token.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResearcherLogin;
