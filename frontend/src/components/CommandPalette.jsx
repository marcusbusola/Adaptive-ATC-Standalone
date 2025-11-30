import React, { useState } from 'react';
import './CommandPalette.css';

function CommandPalette({ selectedAircraft, onCommand }) {
  const [fixName, setFixName] = useState('FIX01');
  const [runwayName, setRunwayName] = useState('28L');

  if (!selectedAircraft) {
    return (
      <div className="command-palette-container disabled">
        <div className="command-palette-header">
          <h4>Commands</h4>
        </div>
        <div className="command-palette-body">
          <p>Select an aircraft to issue commands.</p>
        </div>
      </div>
    );
  }

  const { callsign, heading, altitude, speed } = selectedAircraft;

  const handleHeadingCommand = (delta) => {
    const newHeading = heading + delta;
    onCommand(`setHeading ${callsign} ${newHeading}`);
  };

  const handleAltitudeCommand = (deltaFt) => {
    // altitude from backend is flight levels; convert +/-1000ft to +/-10 FL
    const deltaFl = Math.round(deltaFt / 100);
    const newAltitude = altitude + deltaFl;
    onCommand(`setAltitude ${callsign} ${newAltitude}`);
  };

  const handleSpeedCommand = (delta) => {
    const newSpeed = speed + delta;
    onCommand(`setSpeed ${callsign} ${newSpeed}`);
  };

  const handleDirectToFix = () => {
    if (!fixName) return;
    onCommand(`directToFix ${callsign} ${fixName}`);
  };

  const handleApproach = () => {
    if (!runwayName) return;
    onCommand(`clearedForApproach ${callsign} ${runwayName}`);
  };

  const handleLand = () => {
    if (!runwayName) return;
    onCommand(`clearedToLand ${callsign} ${runwayName}`);
  };

  return (
    <div className="command-palette-container">
      <div className="command-palette-header">
        <h4>Commands for {callsign}</h4>
      </div>
      <div className="command-palette-body">
        <div className="command-group">
          <h5>Heading</h5>
          <button onClick={() => handleHeadingCommand(-30)}>Turn Left 30°</button>
          <button onClick={() => handleHeadingCommand(30)}>Turn Right 30°</button>
        </div>
        <div className="command-group">
          <h5>Altitude</h5>
          <button onClick={() => handleAltitudeCommand(1000)}>Climb +1000 ft</button>
          <button onClick={() => handleAltitudeCommand(-1000)}>Descend -1000 ft</button>
        </div>
        <div className="command-group">
          <h5>Speed (kts)</h5>
          <button onClick={() => handleSpeedCommand(20)}>+20 kts</button>
          <button onClick={() => handleSpeedCommand(-20)}>-20 kts</button>
        </div>
        <div className="command-group">
          <h5>Navigation</h5>
          <div className="command-input-row">
            <input
              type="text"
              value={fixName}
              onChange={(e) => setFixName(e.target.value.toUpperCase())}
              placeholder="Fix (e.g., FIX01)"
            />
            <button onClick={handleDirectToFix}>Direct to Fix</button>
          </div>
        </div>
        <div className="command-group">
          <h5>Approach / Landing</h5>
          <div className="command-input-row">
            <input
              type="text"
              value={runwayName}
              onChange={(e) => setRunwayName(e.target.value.toUpperCase())}
              placeholder="Runway (e.g., 28L)"
            />
            <button onClick={handleApproach}>Line Up for Landing</button>
            <button onClick={handleLand}>Clear to Land</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
