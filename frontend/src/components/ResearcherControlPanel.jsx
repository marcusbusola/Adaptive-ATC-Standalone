import React, { useState, useEffect } from 'react';
import QueueManagementPanel from './QueueManagementPanel';
import ResearcherLogin from './ResearcherLogin';
import { isAuthenticated, clearToken } from '../services/tokenService';
import '../styles/control-panel.css';

const ResearcherControlPanel = () => {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    setAuthenticated(isAuthenticated());
  }, []);

  const handleLogout = () => {
    clearToken();
    setAuthenticated(false);
  };

  if (!authenticated) {
    return <ResearcherLogin onLoginSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div className="control-panel">
      <header className="control-panel-header">
        <div>
          <h1>ATC Adaptive Alert Research System</h1>
          <p className="subtitle">Researcher Control Panel</p>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Log Out
        </button>
      </header>

      <QueueManagementPanel />

      <footer className="control-panel-footer">
        <p>Version 2.0.0 | ATC Adaptive Alert Research System</p>
        <p className="shortcuts">
          <strong>Keyboard Shortcuts:</strong> Ctrl+Shift+D (Debug Mode during session)
        </p>
      </footer>
    </div>
  );
};

export default ResearcherControlPanel;
