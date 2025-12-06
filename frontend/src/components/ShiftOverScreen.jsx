/**
 * Shift Over Screen Component
 *
 * Displays end-of-session summary with final score, stats, and per-aircraft evaluations.
 * Shown when the 6-minute session ends.
 */

import React from 'react';
import './ShiftOverScreen.css';

const ShiftOverScreen = ({
  safetyScore = 100,
  minSafetyScore = 100,
  elapsedTime = 360,
  aircraft = {},
  needsResolved = 0,
  alertsHandled = 0,
  pilotComplaints = [],
  totalAngryIncidents = 0,
  emergenciesResolved = 0,
  onContinue
}) => {
  // Use minimum score for grading (reflects worst performance during session)
  const displayScore = minSafetyScore;
  // Calculate letter grade based on score
  const getGrade = (score) => {
    if (score >= 90) return { letter: 'A', label: 'Excellent', color: '#4caf50' };
    if (score >= 80) return { letter: 'B', label: 'Good', color: '#8bc34a' };
    if (score >= 70) return { letter: 'C', label: 'Satisfactory', color: '#ffeb3b' };
    if (score >= 60) return { letter: 'D', label: 'Needs Improvement', color: '#ff9800' };
    return { letter: 'F', label: 'Unsatisfactory', color: '#f44336' };
  };

  const grade = getGrade(displayScore);

  // Format time as mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get aircraft list for evaluation
  const aircraftList = Array.isArray(aircraft) ? aircraft : Object.values(aircraft);

  // Calculate stats
  const happyPilots = aircraftList.filter(ac => ac.mood === 'happy').length;
  const angryPilots = aircraftList.filter(ac => ac.mood === 'angry').length;
  const totalAircraft = aircraftList.length;

  // Get mood color
  const getMoodColor = (mood) => {
    if (mood === 'angry') return '#f44336';
    if (mood === 'annoyed') return '#ff9800';
    return '#4caf50';
  };

  // Get mood emoji
  const getMoodEmoji = (mood) => {
    if (mood === 'angry') return '😠';
    if (mood === 'annoyed') return '😐';
    return '😊';
  };

  return (
    <div className="shift-over-screen">
      <div className="shift-over-card">
        <div className="shift-over-header">
          <h1>Shift Complete</h1>
          <p className="shift-duration">Duration: {formatTime(elapsedTime)}</p>
        </div>

        {/* Score Circle - shows MINIMUM score reached (worst performance) */}
        <div className="score-circle-container">
          <div className="score-circle" style={{ borderColor: grade.color }}>
            <div className="score-value">{Math.round(displayScore)}</div>
            <div className="score-label">/ 100</div>
          </div>
          <div className="grade-display" style={{ color: grade.color }}>
            <span className="grade-letter">{grade.letter}</span>
            <span className="grade-label">{grade.label}</span>
          </div>
        </div>

        {/* Score Context */}
        {displayScore < safetyScore && (
          <div className="score-context">
            <span className="min-label">Lowest: {Math.round(displayScore)}</span>
            <span className="recovered-label">Recovered to: {Math.round(safetyScore)}</span>
          </div>
        )}

        {/* Target Indicator */}
        <div className="target-indicator">
          {displayScore >= 90 ? (
            <span className="target-met">Target Met (90+)</span>
          ) : (
            <span className="target-missed">Target: 90+ ({Math.round(90 - displayScore)} points needed)</span>
          )}
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{totalAircraft}</span>
            <span className="stat-label">Aircraft Managed</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{emergenciesResolved}</span>
            <span className="stat-label">Emergencies Resolved</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{needsResolved}</span>
            <span className="stat-label">Needs Resolved</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" style={{ color: totalAngryIncidents > 0 ? '#f44336' : '#4caf50' }}>
              {totalAngryIncidents}
            </span>
            <span className="stat-label">Angry Incidents</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{alertsHandled}</span>
            <span className="stat-label">Alerts Handled</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" style={{ color: pilotComplaints.length > 0 ? '#f44336' : '#4caf50' }}>
              {pilotComplaints.length}
            </span>
            <span className="stat-label">Complaints Filed</span>
          </div>
        </div>

        {/* Pilot Satisfaction */}
        <div className="pilot-satisfaction">
          <h3>Pilot Satisfaction</h3>
          <div className="satisfaction-bar">
            <div
              className="satisfaction-fill happy"
              style={{ width: `${totalAircraft > 0 ? (happyPilots / totalAircraft) * 100 : 0}%` }}
              title={`${happyPilots} happy`}
            />
            <div
              className="satisfaction-fill annoyed"
              style={{ width: `${totalAircraft > 0 ? ((totalAircraft - happyPilots - angryPilots) / totalAircraft) * 100 : 0}%` }}
              title="Annoyed"
            />
            <div
              className="satisfaction-fill angry"
              style={{ width: `${totalAircraft > 0 ? (angryPilots / totalAircraft) * 100 : 0}%` }}
              title={`${angryPilots} angry`}
            />
          </div>
          <div className="satisfaction-legend">
            <span className="legend-item happy">😊 {happyPilots}</span>
            <span className="legend-item annoyed">😐 {totalAircraft - happyPilots - angryPilots}</span>
            <span className="legend-item angry">😠 {angryPilots}</span>
          </div>
        </div>

        {/* Per-Aircraft Evaluations */}
        {aircraftList.length > 0 && (
          <div className="aircraft-evaluations">
            <h3>Aircraft Evaluations</h3>
            <div className="evaluations-list">
              {aircraftList.map((ac) => (
                <div
                  key={ac.callsign}
                  className="evaluation-item"
                  style={{ borderLeftColor: getMoodColor(ac.mood) }}
                >
                  <div className="eval-header">
                    <span className="eval-callsign">{ac.callsign}</span>
                    <span className="eval-mood">{getMoodEmoji(ac.mood)}</span>
                  </div>
                  <div className="eval-score-bar">
                    <div
                      className="eval-score-fill"
                      style={{
                        width: `${ac.safety_score || 100}%`,
                        backgroundColor: getMoodColor(ac.mood)
                      }}
                    />
                  </div>
                  <span className="eval-score-value">{Math.round(ac.safety_score || 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Continue Button */}
        <button className="continue-btn" onClick={onContinue}>
          Continue to Survey
        </button>
      </div>
    </div>
  );
};

export default ShiftOverScreen;
