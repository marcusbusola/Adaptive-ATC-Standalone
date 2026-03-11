import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/App.css';
import './styles/session.css';

// Components
import ErrorBoundary from './components/ErrorBoundary';
import ResearcherControlPanel from './components/ResearcherControlPanel';
import QueueManagementPanel from './components/QueueManagementPanel';
import ParticipantLobby from './components/ParticipantLobby';
import Session from './components/Session';
import Instructions from './components/Instructions';
import ResearcherDashboard from './components/ResearcherDashboard';
import ResearcherSessionView from './components/ResearcherSessionView';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="app">
          <Routes>
            {/* Researcher Dashboard (New Home for Researchers) */}
            <Route path="/" element={<ResearcherDashboard />} />

            {/* Researcher Control Panel (for creating queues, etc.) */}
            <Route path="/researcher/control" element={<ResearcherControlPanel />} />

            {/* Researcher Session Monitoring */}
            <Route path="/researcher/:sessionId" element={<ResearcherSessionView />} />

            {/* Participant Lobby */}
            <Route path="/participant" element={<ParticipantLobby />} />

            {/* Session Execution (Participant View) */}
            <Route path="/session/:sessionId" element={<Session />} />

            {/* Queue Management */}
            <Route path="/queue/:queueId" element={<QueueManagementPanel />} />

            {/* Fallback - Redirect to Researcher Dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
