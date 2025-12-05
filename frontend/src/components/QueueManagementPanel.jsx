import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import QueueBuilder from './Queue/QueueBuilder';
import QueueRunner from './Queue/QueueRunner';
import ResultsDashboard from './Queue/ResultsDashboard';
import { getApiBaseUrl } from '../utils/apiConfig';
import { getAuthHeaders } from '../services/tokenService';
import './QueueManagementPanel.css';

const API_URL = getApiBaseUrl();

const QueueManagementPanel = () => {
  const { queueId } = useParams(); // Get queueId from URL (/queue/:queueId)
  const [activeTab, setActiveTab] = useState('builder'); // builder, runner, results
  const [activeQueueId, setActiveQueueId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [createdQueue, setCreatedQueue] = useState(null); // For showing share link
  const [linkCopied, setLinkCopied] = useState(false);

  // Load queue from URL on mount
  useEffect(() => {
    if (queueId) {
      loadQueueFromUrl(queueId);
    }
  }, [queueId]);

  const loadQueueFromUrl = async (id) => {
    try {
      // Verify queue exists
      const response = await axios.get(`${API_URL}/api/queues/${id}`, {
        headers: getAuthHeaders()
      });
      if (response.data.status === 'success') {
        setActiveQueueId(id);
        setActiveTab('runner'); // Auto-switch to runner tab
        setNotification({
          type: 'info',
          message: `Loaded queue for ${response.data.queue.participant_id}`
        });

        // Clear notification after 3 seconds
        setTimeout(() => {
          setNotification(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Error loading queue from URL:', err);
      setNotification({
        type: 'error',
        message: `Queue not found: ${id}`
      });
    }
  };

  // Handle queue creation - show share link instead of auto-switching
  const handleQueueCreated = (queue) => {
    setActiveQueueId(queue.queue_id);
    setCreatedQueue(queue); // Show share link modal
    setLinkCopied(false);
    // Don't auto-switch to runner tab - let participant start from lobby
  };

  // Get the participant share link
  const getShareLink = () => {
    if (!createdQueue) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/participant?id=${encodeURIComponent(createdQueue.participant_id)}`;
  };

  // Copy share link to clipboard
  const handleCopyLink = async () => {
    const link = getShareLink();
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Dismiss share link modal
  const handleDismissShareLink = () => {
    setCreatedQueue(null);
    setLinkCopied(false);
  };

  // Handle session start
  const handleSessionStart = (sessionInfo) => {
    setNotification({
      type: 'info',
      message: `Session started: ${sessionInfo.scenarioId} - Condition ${sessionInfo.condition}`
    });

    // Clear notification after 3 seconds
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  // Handle queue completion
  const handleQueueComplete = (queue) => {
    setNotification({
      type: 'success',
      message: `Queue completed! All ${queue.items.length} sessions finished.`
    });

    // Auto-switch to results tab
    setTimeout(() => {
      setActiveTab('results');
    }, 2000);

    // Clear notification after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  // Dismiss notification
  const dismissNotification = () => {
    setNotification(null);
  };

  return (
    <div className="queue-management-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="header-content">
          <h1>Batch Queue Management</h1>
          <p className="header-subtitle">
            Create and manage batch testing sessions for adaptive alert research
          </p>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          <div className="notification-content">
            <span className="notification-message">{notification.message}</span>
          </div>
          <button
            className="notification-close"
            onClick={dismissNotification}
          >
            &times;
          </button>
        </div>
      )}

      {/* Share Link Modal - shown after queue creation */}
      {createdQueue && (
        <div className="share-link-modal">
          <div className="share-link-content">
            <div className="share-link-header">
              <span className="success-icon">&#10003;</span>
              <h3>Queue Created Successfully!</h3>
            </div>

            <div className="share-link-details">
              <div className="detail-item">
                <span className="detail-label">Participant:</span>
                <span className="detail-value">{createdQueue.participant_id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Sessions:</span>
                <span className="detail-value">{createdQueue.items?.length || 0} scenarios queued</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Queue ID:</span>
                <span className="detail-value queue-id">{createdQueue.queue_id}</span>
              </div>
            </div>

            <div className="share-link-section">
              <label>Share this link with the participant:</label>
              <div className="share-link-input-row">
                <input
                  type="text"
                  value={getShareLink()}
                  readOnly
                  className="share-link-input"
                />
                <button
                  className={`copy-btn ${linkCopied ? 'copied' : ''}`}
                  onClick={handleCopyLink}
                >
                  {linkCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="share-link-hint">
                The participant will use this link to access the Participant Lobby and start their session.
              </p>
            </div>

            <div className="share-link-actions">
              <button className="btn-secondary" onClick={handleDismissShareLink}>
                Create Another Queue
              </button>
              <button className="btn-primary" onClick={() => { handleDismissShareLink(); setActiveTab('runner'); }}>
                View Queue Runner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'builder' ? 'active' : ''}`}
          onClick={() => setActiveTab('builder')}
        >
          <span className="tab-label">Build Queue</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'runner' ? 'active' : ''}`}
          onClick={() => setActiveTab('runner')}
          disabled={!activeQueueId}
        >
          <span className="tab-label">Run Sessions</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          <span className="tab-label">View Results</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'builder' && (
          <div className="tab-pane">
            <QueueBuilder onQueueCreated={handleQueueCreated} />
          </div>
        )}

        {activeTab === 'runner' && (
          <div className="tab-pane">
            {activeQueueId ? (
              <QueueRunner
                queueId={activeQueueId}
                onSessionStart={handleSessionStart}
                onQueueComplete={handleQueueComplete}
              />
            ) : (
              <div className="empty-state">
                <h3>No Active Queue</h3>
                <p>Create a queue in the Build Queue tab to start running sessions.</p>
                <button
                  className="btn-primary"
                  onClick={() => setActiveTab('builder')}
                >
                  Go to Build Queue
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'results' && (
          <div className="tab-pane">
            <ResultsDashboard />
          </div>
        )}
      </div>

      {/* Help Footer */}
      <div className="panel-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Quick Start</h4>
            <ol>
              <li>Build a queue by selecting scenarios and conditions</li>
              <li>Run sessions sequentially through the queue</li>
              <li>View and export results for analysis</li>
            </ol>
          </div>
          <div className="footer-section">
            <h4>Scenarios</h4>
            <ul>
              <li><strong>L1-L3:</strong> Low complexity scenarios</li>
              <li><strong>H4-H6:</strong> High complexity scenarios</li>
              <li><strong>Duration:</strong> Each session is 6 minutes</li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Conditions</h4>
            <ul>
              <li><strong>Condition 1:</strong> Traditional modal alerts</li>
              <li><strong>Condition 2:</strong> Rule-based adaptive alerts</li>
              <li><strong>Condition 3:</strong> ML-based adaptive alerts</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueManagementPanel;
