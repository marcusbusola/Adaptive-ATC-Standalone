/**
 * Radar Viewer Component
 *
 * Canvas-based radar display for ATC simulation
 * Uses built-in simulation engine (no external simulator required)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import useSimulation from '../hooks/useSimulation';
import simulationApi from '../services/simulation-api';
import ErrorNotification from './ErrorNotification';
import {
  latLonToScreen,
  getScenarioCenter,
} from '../utils/radarCoordinates';
import '../styles/radar.css';

function RadarViewer({
  scenario = null,
  condition = null,
  onAircraftUpdate = null,
  onEvent = null,
  onConflict = null,
  showControls = true,
  aircraftConfig = null
}) {
  // Canvas refs
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const sweepAngleRef = useRef(0);
  const audioContextRef = useRef(null);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [localError, setLocalError] = useState(null);

  // Simulation connection via SSE
  const { connected, state, aircraft, conflicts, error: simError } = useSimulation();

  // Radar settings
  const CANVAS_SIZE = 800;
  const RADAR_RANGE_NM = 250; // Extended range to show all scenario aircraft
  const SWEEP_SPEED = 0.02; // Radians per frame (~4 second rotation)
  const SWEEP_TRAIL_LENGTH = 0.5; // Radians of trail

  // Scenario center coordinates
  const scenarioCenter = scenario ? getScenarioCenter(scenario) : getScenarioCenter('L1');

  /**
   * Play radar beep sound using Web Audio API
   */
  const playRadarBeep = useCallback(() => {
    try {
      // Create AudioContext on first use (browsers require user interaction)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Create oscillator for beep
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Radar beep: short, high-pitched tone
      oscillator.frequency.setValueAtTime(1200, ctx.currentTime); // 1200 Hz
      oscillator.type = 'sine';

      // Quick fade in and out for softer sound
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01); // Fade in
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08); // Fade out

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1); // 100ms beep
    } catch (e) {
      // Silently fail if audio isn't available
    }
  }, []);

  /**
   * Initialize and start render loop
   */
  useEffect(() => {
    setIsLoading(false);
    startRenderLoop();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Clean up audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  /**
   * Handle aircraft updates
   */
  useEffect(() => {
    if (aircraft && onAircraftUpdate) {
      onAircraftUpdate(aircraft);
    }
  }, [aircraft, onAircraftUpdate]);

  /**
   * Handle conflicts
   */
  useEffect(() => {
    if (conflicts && conflicts.length > 0 && onConflict) {
      conflicts.forEach(conflict => {
        onConflict(conflict);
      });
    }
  }, [conflicts, onConflict]);

  /**
   * Load scenario when connected and config available
   */
  useEffect(() => {
    if (connected && aircraftConfig && aircraftConfig.length > 0) {
      loadScenario(aircraftConfig);
    }
  }, [connected, aircraftConfig]);

  /**
   * Load scenario with aircraft
   */
  const loadScenario = async (config) => {
    console.log(`[RadarViewer] Loading scenario ${scenario} with ${config.length} aircraft`);

    try {
      await simulationApi.start(config, 1.0);
      console.log('[RadarViewer] Scenario loaded successfully');
    } catch (err) {
      console.error('[RadarViewer] Failed to load scenario:', err);
      setLocalError(`Failed to load scenario: ${err.message}`);
    }
  };

  /**
   * Start canvas render loop
   */
  const startRenderLoop = () => {
    const render = () => {
      // Track previous angle to detect north crossing
      const prevAngle = sweepAngleRef.current;

      // Update sweep angle
      sweepAngleRef.current = (sweepAngleRef.current + SWEEP_SPEED) % (2 * Math.PI);

      // Play beep when sweep crosses north (angle wraps from ~2π back to ~0)
      if (prevAngle > sweepAngleRef.current) {
        playRadarBeep();
      }

      drawRadar();
      animationRef.current = requestAnimationFrame(render);
    };
    render();
  };

  /**
   * Draw radar display
   */
  const drawRadar = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw base layer (range rings, labels)
    drawBaseLayer(ctx);

    // Draw radar sweep
    drawRadarSweep(ctx);

    // Draw aircraft from simulation state
    if (aircraft && aircraft.length > 0) {
      aircraft.forEach(ac => {
        drawAircraft(ctx, ac, ac.callsign === selectedAircraft?.callsign);
      });
    }

    // Draw conflict zones
    if (conflicts && conflicts.length > 0) {
      conflicts.forEach(conflict => {
        drawConflictZone(ctx, conflict);
      });
    }
  }, [aircraft, conflicts, selectedAircraft, scenarioCenter]);

  /**
   * Draw base layer (range rings, labels)
   */
  const drawBaseLayer = (ctx) => {
    const center = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
    const scale = CANVAS_SIZE / (2 * RADAR_RANGE_NM);

    // Range rings (adjusted for 250 NM range)
    const rings = [50, 100, 150, 200, 250];
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.lineWidth = 1;

    rings.forEach(rangeNM => {
      if (rangeNM <= RADAR_RANGE_NM) {
        ctx.beginPath();
        ctx.arc(center.x, center.y, rangeNM * scale, 0, 2 * Math.PI);
        ctx.stroke();

        // Range labels
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.font = '10px monospace';
        ctx.fillText(`${rangeNM}nm`, center.x + rangeNM * scale + 5, center.y);
      }
    });

    // Cardinal directions
    ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', center.x, 20);
    ctx.fillText('S', center.x, CANVAS_SIZE - 10);
    ctx.textAlign = 'left';
    ctx.fillText('E', CANVAS_SIZE - 20, center.y + 5);
    ctx.fillText('W', 10, center.y + 5);

    // Center mark
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(center.x, center.y, 3, 0, 2 * Math.PI);
    ctx.fill();

    // Scenario info
    ctx.textAlign = 'left';
    ctx.font = '12px monospace';
    ctx.fillStyle = '#00ff00';
    ctx.fillText(`Scenario: ${scenario || 'N/A'}`, 10, 20);
    ctx.fillText(`Center: ${scenarioCenter.name}`, 10, 35);
    ctx.fillText(`Range: ${RADAR_RANGE_NM} NM`, 10, 50);

    // Simulation time
    if (state) {
      ctx.fillText(`Sim Time: ${Math.floor(state.sim_time)}s`, 10, 65);
    }
  };

  /**
   * Draw radar sweep with fading trail
   */
  const drawRadarSweep = (ctx) => {
    const center = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
    const radius = CANVAS_SIZE / 2 - 10;
    const angle = sweepAngleRef.current;

    // Draw fading trail (multiple lines with decreasing opacity)
    const trailSteps = 30;
    for (let i = 0; i < trailSteps; i++) {
      const trailAngle = angle - (i / trailSteps) * SWEEP_TRAIL_LENGTH;
      const opacity = 0.4 * (1 - i / trailSteps);

      ctx.strokeStyle = `rgba(0, 255, 0, ${opacity})`;
      ctx.lineWidth = 2 - (i / trailSteps);
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.lineTo(
        center.x + radius * Math.cos(trailAngle - Math.PI / 2),
        center.y + radius * Math.sin(trailAngle - Math.PI / 2)
      );
      ctx.stroke();
    }

    // Draw main sweep line
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(
      center.x + radius * Math.cos(angle - Math.PI / 2),
      center.y + radius * Math.sin(angle - Math.PI / 2)
    );
    ctx.stroke();

    // Draw glow at sweep tip
    const tipX = center.x + radius * Math.cos(angle - Math.PI / 2);
    const tipY = center.y + radius * Math.sin(angle - Math.PI / 2);
    const gradient = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 8);
    gradient.addColorStop(0, 'rgba(0, 255, 0, 0.6)');
    gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 8, 0, 2 * Math.PI);
    ctx.fill();
  };

  /**
   * Draw aircraft symbol
   */
  const drawAircraft = (ctx, ac, isSelected) => {
    const pos = latLonToScreen(
      ac.lat,
      ac.lon,
      scenarioCenter.lat,
      scenarioCenter.lon,
      CANVAS_SIZE,
      CANVAS_SIZE,
      RADAR_RANGE_NM
    );

    // Skip if out of bounds
    if (pos.x < 0 || pos.x > CANVAS_SIZE || pos.y < 0 || pos.y > CANVAS_SIZE) {
      return;
    }

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Draw triangle symbol oriented by heading
    ctx.rotate((ac.heading - 90) * Math.PI / 180);

    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(-5, 5);
    ctx.lineTo(5, 5);
    ctx.closePath();

    // Color based on status
    let fillColor = '#00ff00'; // Green (normal)
    if (ac.emergency) {
      fillColor = '#ffff00'; // Yellow (emergency)
    } else if (ac.comm_loss) {
      fillColor = '#808080'; // Gray (comm loss)
    } else if (isSelected) {
      fillColor = '#00ffff'; // Cyan (selected)
    }

    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    // Draw data block
    drawDataBlock(ctx, ac, pos, isSelected);

    // Draw velocity vector (leader line)
    drawVelocityVector(ctx, ac, pos);
  };

  /**
   * Draw aircraft data block
   */
  const drawDataBlock = (ctx, ac, pos, isSelected) => {
    const offsetX = 12;
    const offsetY = 0;

    ctx.font = '10px monospace';
    ctx.fillStyle = isSelected ? '#00ffff' : '#ffffff';

    // Callsign
    ctx.fillText(ac.callsign, pos.x + offsetX, pos.y + offsetY);

    // Altitude (in hundreds of feet) and speed
    const altHundreds = Math.floor(ac.altitude / 100);
    const speedKnots = Math.floor(ac.speed);
    ctx.fillText(`${altHundreds} ${speedKnots}`, pos.x + offsetX, pos.y + offsetY + 12);

    // Emergency or comm loss indicator
    if (ac.emergency) {
      ctx.fillStyle = '#ffff00';
      ctx.fillText('EMER', pos.x + offsetX, pos.y + offsetY + 24);
    } else if (ac.comm_loss) {
      ctx.fillStyle = '#ff0000';
      ctx.fillText('NORDO', pos.x + offsetX, pos.y + offsetY + 24);
    }
  };

  /**
   * Draw velocity vector (leader line)
   */
  const drawVelocityVector = (ctx, ac, pos) => {
    const speed = ac.speed;
    const heading = ac.heading;
    const projectionNM = speed / 60; // nautical miles in 1 minute

    const scale = CANVAS_SIZE / (2 * RADAR_RANGE_NM);
    const projectionPx = projectionNM * scale;

    const endX = pos.x + projectionPx * Math.sin(heading * Math.PI / 180);
    const endY = pos.y - projectionPx * Math.cos(heading * Math.PI / 180);

    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  };

  /**
   * Draw conflict zone
   */
  const drawConflictZone = (ctx, conflict) => {
    const callsigns = [conflict.callsign1, conflict.callsign2];

    callsigns.forEach(callsign => {
      const ac = aircraft.find(a => a.callsign === callsign);
      if (!ac) return;

      const pos = latLonToScreen(
        ac.lat,
        ac.lon,
        scenarioCenter.lat,
        scenarioCenter.lon,
        CANVAS_SIZE,
        CANVAS_SIZE,
        RADAR_RANGE_NM
      );

      // Draw red circle around conflicting aircraft
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 15, 0, 2 * Math.PI);
      ctx.stroke();
    });
  };

  /**
   * Handle canvas click
   */
  const handleCanvasClick = (event) => {
    const canvas = canvasRef.current;
    if (!canvas || !aircraft) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    let closestAircraft = null;
    let closestDistance = Infinity;

    aircraft.forEach(ac => {
      const pos = latLonToScreen(
        ac.lat,
        ac.lon,
        scenarioCenter.lat,
        scenarioCenter.lon,
        CANVAS_SIZE,
        CANVAS_SIZE,
        RADAR_RANGE_NM
      );

      const distance = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2);
      if (distance < 20 && distance < closestDistance) {
        closestAircraft = ac;
        closestDistance = distance;
      }
    });

    setSelectedAircraft(closestAircraft);
  };

  /**
   * Inject test event
   */
  const injectTestEvent = async (eventType) => {
    if (!aircraft || aircraft.length === 0) {
      console.warn('[RadarViewer] No aircraft available for event injection');
      return;
    }

    const firstAircraft = aircraft[0];

    try {
      switch (eventType) {
        case 'emergency':
          await simulationApi.triggerEmergency(firstAircraft.callsign, 'fuel');
          break;
        case 'comm_failure':
          await simulationApi.triggerCommLoss(firstAircraft.callsign);
          break;
        default:
          console.warn('[RadarViewer] Unknown event type:', eventType);
      }
    } catch (err) {
      console.error('[RadarViewer] Event injection failed:', err);
    }
  };

  const error = localError || simError;

  if (error) {
    return (
      <div className="radar-error">
        <h3>Simulation Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="radar-container">
      {isLoading && (
        <div className="radar-loading">
          <div className="loading-spinner"></div>
          <p>Connecting to Simulation...</p>
        </div>
      )}

      <div className="radar-viewer" style={{ opacity: isLoading ? 0 : 1 }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="radar-canvas"
          onClick={handleCanvasClick}
        />

        {/* Connection status */}
        <div className="connection-status">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '●' : '○'}
          </span>
          <span className="status-text">
            {connected ? 'Simulation Connected' : 'Simulation Disconnected'}
          </span>
        </div>

        {/* Selected aircraft details */}
        {selectedAircraft && (
          <div className="aircraft-details">
            <h4>Selected Aircraft</h4>
            <div className="detail-row">
              <span>Callsign:</span>
              <span>{selectedAircraft.callsign}</span>
            </div>
            <div className="detail-row">
              <span>Altitude:</span>
              <span>{Math.floor(selectedAircraft.altitude)} ft</span>
            </div>
            <div className="detail-row">
              <span>Heading:</span>
              <span>{Math.floor(selectedAircraft.heading)}°</span>
            </div>
            <div className="detail-row">
              <span>Speed:</span>
              <span>{Math.floor(selectedAircraft.speed)} kts</span>
            </div>
            {selectedAircraft.emergency && (
              <div className="detail-row emergency">
                <span>Status:</span>
                <span>EMERGENCY</span>
              </div>
            )}
            {selectedAircraft.comm_loss && (
              <div className="detail-row comm-loss">
                <span>Status:</span>
                <span>COMM LOSS</span>
              </div>
            )}
            <button onClick={() => setSelectedAircraft(null)}>Close</button>
          </div>
        )}

        {/* Controls panel */}
        {showControls && connected && (
          <div className="radar-controls">
            <div className="status-panel">
              <h4>Airspace Status</h4>
              <div className="status-grid">
                <div className="status-item">
                  <label>Aircraft:</label>
                  <span className="status-value">{aircraft?.length || 0}</span>
                </div>

                <div className="status-item">
                  <label>Conflicts:</label>
                  <span className={`status-value ${conflicts?.length > 0 ? 'alert' : ''}`}>
                    {conflicts?.length || 0}
                  </span>
                </div>

                {state && (
                  <div className="status-item">
                    <label>Sim Time:</label>
                    <span className="status-value">
                      {Math.floor(state.sim_time)}s
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="control-panel">
              <h4>Test Events</h4>
              <div className="button-group">
                <button
                  onClick={() => injectTestEvent('emergency')}
                  className="btn-test btn-warning"
                >
                  Inject Emergency
                </button>
                <button
                  onClick={() => injectTestEvent('comm_failure')}
                  className="btn-test btn-warning"
                >
                  Inject Comm Failure
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {simError && <ErrorNotification error={simError} />}
    </div>
  );
}

export default RadarViewer;
