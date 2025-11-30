import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * WebSocket Hook for Real-Time Session Communication
 *
 * Manages WebSocket connection to backend for:
 * - Real-time scenario events
 * - Alert triggers
 * - ML predictions (Condition 3)
 * - System messages
 *
 * Auto-reconnects on connection loss with exponential backoff
 */
const useWebSocket = (sessionId, websocketUrl = null) => {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [error, setError] = useState(null);

  const ws = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const connectionTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second
  const connectionTimeout = 10000; // 10 seconds

  /**
   * Get WebSocket URL from props, environment, or default
   */
  const getWebSocketUrl = useCallback(() => {
    // If websocketUrl is provided (from backend response), use it
    if (websocketUrl) {
      return websocketUrl;
    }

    // Otherwise, construct from environment variables or defaults
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = process.env.REACT_APP_WS_HOST || window.location.host;
    const wsPath = process.env.REACT_APP_WS_PATH || '/ws';

    return `${wsProtocol}//${wsHost}${wsPath}/${sessionId}`;
  }, [sessionId, websocketUrl]);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (!sessionId) {
      console.log('No session ID, skipping WebSocket connection');
      return;
    }

    if (ws.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    const wsUrl = getWebSocketUrl();
    console.log('Connecting to WebSocket:', wsUrl);

    setConnectionStatus('connecting');

    // Set connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      if (ws.current && ws.current.readyState !== WebSocket.OPEN) {
        console.error('WebSocket connection timeout');
        setError('Connection timeout - please check if backend is running');
        setConnectionStatus('error');
        ws.current.close();

        // Trigger reconnection if we haven't exceeded max attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          attemptReconnect();
        }
      }
    }, connectionTimeout);

    try {
      ws.current = new WebSocket(wsUrl);

      // Connection opened
      ws.current.onopen = () => {
        console.log('WebSocket connected');

        // Clear connection timeout
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }

        setConnected(true);
        setConnectionStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Send initial connection message
        sendMessage({
          type: 'connect',
          session_id: sessionId,
          timestamp: Date.now()
        });
      };

      // Message received
      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          setLastMessage(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      // Connection closed
      ws.current.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnected(false);
        setConnectionStatus('disconnected');

        // Attempt reconnection if not a clean close
        if (!event.wasClean && reconnectAttemptsRef.current < maxReconnectAttempts) {
          attemptReconnect();
        }
      };

      // Connection error
      ws.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
        setConnectionStatus('error');
      };

    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError(err.message);
      setConnectionStatus('error');
    }
  }, [sessionId, getWebSocketUrl]);

  /**
   * Attempt to reconnect with exponential backoff
   */
  const attemptReconnect = useCallback(() => {
    reconnectAttemptsRef.current += 1;
    const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);

    console.log(
      `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
    );

    setConnectionStatus('reconnecting');

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  /**
   * Send message through WebSocket
   */
  const sendMessage = useCallback((message) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }

    try {
      const payload = JSON.stringify(message);
      ws.current.send(payload);
      console.log('WebSocket message sent:', message);
      return true;
    } catch (err) {
      console.error('Failed to send WebSocket message:', err);
      return false;
    }
  }, []);

  /**
   * Close WebSocket connection
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }

    if (ws.current) {
      console.log('Closing WebSocket connection');
      ws.current.close(1000, 'Client disconnect');
      ws.current = null;
    }

    setConnected(false);
    setConnectionStatus('disconnected');
    reconnectAttemptsRef.current = 0;
  }, []);

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    connect();
  }, [disconnect, connect]);

  /**
   * Connect on mount if sessionId exists
   * Note: Only depends on sessionId to avoid circular dependency
   * connect/disconnect are stable refs via useCallback
   */
  useEffect(() => {
    if (sessionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, websocketUrl, connect, disconnect]);

  /**
   * Heartbeat to keep connection alive
   */
  useEffect(() => {
    if (!connected) return;

    const heartbeatInterval = setInterval(() => {
      sendMessage({
        type: 'heartbeat',
        timestamp: Date.now()
      });
    }, 30000); // Every 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [connected, sendMessage]);

  return {
    connected,
    connectionStatus,
    lastMessage,
    error,
    sendMessage,
    disconnect,
    reconnect
  };
};

export default useWebSocket;
