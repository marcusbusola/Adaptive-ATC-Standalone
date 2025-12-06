/**
 * Radar Viewer Component
 *
 * Canvas-based radar display for ATC simulation
 * Uses built-in simulation engine (no external simulator required)
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import useSimulation from '../hooks/useSimulation';
import simulationApi from '../services/simulation-api';
import ErrorNotification from './ErrorNotification';
import PulsingDot from './PulsingDot';
import {
  latLonToScreen,
  gridToScreen,
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
  aircraftConfig = null,
  liveAircraft = null,
  pendingAlerts = [],
  selectedAircraft: externalSelectedAircraft = null, // External selection control
  onAircraftSelect = null, // Callback when aircraft is selected
}) {
  // Canvas refs
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const sweepAngleRef = useRef(0);
  const audioContextRef = useRef(null);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [internalSelectedAircraft, setInternalSelectedAircraft] = useState(null);
  const [localError, setLocalError] = useState(null);

  // Use external selection if provided, otherwise use internal state
  const selectedAircraft = externalSelectedAircraft !== null ? externalSelectedAircraft : internalSelectedAircraft;

  // Handle selection change - update internal state and notify parent
  const handleAircraftSelection = useCallback((aircraft) => {
    setInternalSelectedAircraft(aircraft);
    if (onAircraftSelect) {
      onAircraftSelect(aircraft);
    }
  }, [onAircraftSelect]);

  // Simulation connection via SSE (fallback if no liveAircraft)
  const { connected, state, aircraft: sseAircraft, conflicts, error: simError } = useSimulation();

  // Convert liveAircraft object to array for rendering
  // Prefer liveAircraft from Session polling over SSE aircraft
  const aircraft = useMemo(() => {
    if (liveAircraft && Object.keys(liveAircraft).length > 0) {
      return Object.values(liveAircraft);
    }
    // Fallback to SSE aircraft if no liveAircraft
    if (sseAircraft && sseAircraft.length > 0) {
      return sseAircraft;
    }
    return [];
  }, [liveAircraft, sseAircraft]);

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

  // Clean up audio context on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
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
    try {
      await simulationApi.start(config, 1.0);
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
   * Initialize and start render loop.
   * Dependency on drawRadar ensures the loop gets the latest aircraft data
   * instead of capturing the initial empty state.
   */
  useEffect(() => {
    setIsLoading(false);

    // Cancel any existing loop before starting a new one (e.g., after dependency changes)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

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

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [drawRadar, playRadarBeep]);

  /**
   * Draw subtle rectangular grid pattern (lowest layer)
   */
  const drawSectorGrid = (ctx, center, scale) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.05)';
    ctx.lineWidth = 0.5;

    const gridSpacingNM = 25;
    const gridSpacingPx = gridSpacingNM * scale;

    // Vertical lines
    for (let x = 0; x <= CANVAS_SIZE; x += gridSpacingPx) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_SIZE);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= CANVAS_SIZE; y += gridSpacingPx) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_SIZE, y);
      ctx.stroke();
    }

    ctx.restore();
  };

  /**
   * Draw radial tick marks around outer ring
   */
  const drawRadialTicks = (ctx, center, scale) => {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.15)';
    ctx.lineWidth = 1;

    const outerRadius = RADAR_RANGE_NM * scale;
    const majorTickLength = 8;  // every 30 degrees
    const minorTickLength = 4;  // every 10 degrees

    for (let deg = 0; deg < 360; deg += 10) {
      const isMajor = deg % 30 === 0;
      const tickLength = isMajor ? majorTickLength : minorTickLength;
      const angleRad = (deg - 90) * Math.PI / 180;

      const innerRadius = outerRadius - tickLength;

      ctx.beginPath();
      ctx.moveTo(
        center.x + innerRadius * Math.cos(angleRad),
        center.y + innerRadius * Math.sin(angleRad)
      );
      ctx.lineTo(
        center.x + outerRadius * Math.cos(angleRad),
        center.y + outerRadius * Math.sin(angleRad)
      );
      ctx.stroke();
    }

    ctx.restore();
  };

  /**
   * Draw bearing labels (degrees) around outer ring
   */
  const drawBearingLabels = (ctx, center, scale) => {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const labelRadius = RADAR_RANGE_NM * scale + 12;
    const skipAngles = [0, 90, 180, 270]; // N/E/S/W labels exist here

    for (let deg = 0; deg < 360; deg += 30) {
      if (skipAngles.includes(deg)) continue;

      const angleRad = (deg - 90) * Math.PI / 180;
      const x = center.x + labelRadius * Math.cos(angleRad);
      const y = center.y + labelRadius * Math.sin(angleRad);

      ctx.fillText(`${deg}°`, x, y);
    }

    ctx.restore();
  };

  /**
   * Draw ruler bar at top of radar
   */
  const drawRulerBar = (ctx, scale) => {
    ctx.save();

    const barHeight = 20;

    // Background
    ctx.fillStyle = 'rgba(0, 40, 0, 0.6)';
    ctx.fillRect(0, 0, CANVAS_SIZE, barHeight);

    // Border line
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barHeight);
    ctx.lineTo(CANVAS_SIZE, barHeight);
    ctx.stroke();

    // Text styling
    ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.font = '9px monospace';
    ctx.textBaseline = 'middle';

    // Left: "RNG"
    ctx.textAlign = 'left';
    ctx.fillText('RNG 250NM', 8, barHeight / 2);

    // Center: scale tick marks
    ctx.textAlign = 'center';
    const center = CANVAS_SIZE / 2;
    [-200, -100, 0, 100, 200].forEach(nm => {
      const x = center + nm * scale;
      if (x > 80 && x < CANVAS_SIZE - 80) {
        // Tick mark
        ctx.beginPath();
        ctx.moveTo(x, barHeight - 4);
        ctx.lineTo(x, barHeight);
        ctx.stroke();
        // Label
        if (nm !== 0) {
          ctx.fillText(`${Math.abs(nm)}`, x, barHeight / 2);
        }
      }
    });

    // Right: Sector ID
    ctx.textAlign = 'right';
    ctx.fillText('KSFO TRACON', CANVAS_SIZE - 8, barHeight / 2);

    ctx.restore();
  };

  /**
   * Draw decorative info blocks at bottom corners
   */
  const drawInfoBlocks = (ctx, aircraftCount, simTime) => {
    ctx.save();

    const blockWidth = 75;
    const blockHeight = 40;
    const padding = 5;
    const cornerRadius = 3;

    // Helper for rounded rect (fallback for older browsers)
    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    // === LEFT BLOCK: Traffic Count ===
    const leftX = 10;
    const leftY = CANVAS_SIZE - blockHeight - 10;

    roundRect(leftX, leftY, blockWidth, blockHeight, cornerRadius);
    ctx.fillStyle = 'rgba(0, 40, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('TRAFFIC', leftX + padding, leftY + padding);

    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${aircraftCount}`, leftX + padding, leftY + 18);

    // === RIGHT BLOCK: Sim Time ===
    const rightX = CANVAS_SIZE - blockWidth - 10;
    const rightY = CANVAS_SIZE - blockHeight - 10;

    roundRect(rightX, rightY, blockWidth, blockHeight, cornerRadius);
    ctx.fillStyle = 'rgba(0, 40, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SIM TIME', rightX + padding, rightY + padding);

    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.font = 'bold 16px monospace';
    const mins = Math.floor(simTime / 60);
    const secs = Math.floor(simTime % 60);
    ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, rightX + padding, rightY + 18);

    ctx.restore();
  };

  /**
   * Draw base layer (range rings, labels, visual enhancements)
   */
  const drawBaseLayer = (ctx) => {
    const center = { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };
    const scale = CANVAS_SIZE / (2 * RADAR_RANGE_NM);

    // === BACKGROUND ELEMENTS (lowest opacity, drawn first) ===
    drawSectorGrid(ctx, center, scale);
    drawRadialTicks(ctx, center, scale);
    drawBearingLabels(ctx, center, scale);

    // === RANGE RINGS (existing, 0.30 opacity) ===
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

    // === CARDINAL DIRECTIONS (existing, 0.70 opacity) ===
    ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', center.x, 35); // Adjusted for ruler bar
    ctx.fillText('S', center.x, CANVAS_SIZE - 10);
    ctx.textAlign = 'left';
    ctx.fillText('E', CANVAS_SIZE - 20, center.y + 5);
    ctx.fillText('W', 10, center.y + 5);

    // === CENTER MARK (existing, 0.80 opacity) ===
    ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
    ctx.beginPath();
    ctx.arc(center.x, center.y, 3, 0, 2 * Math.PI);
    ctx.fill();

    // === RULER BAR (top of screen) ===
    drawRulerBar(ctx, scale);

    // === INFO BLOCKS (bottom corners) ===
    const aircraftCount = aircraft ? Object.keys(aircraft).length : 0;
    const simTime = state?.sim_time || 0;
    drawInfoBlocks(ctx, aircraftCount, simTime);

    // === SCENARIO INFO (moved below ruler bar) ===
    ctx.textAlign = 'left';
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
    ctx.fillText(`${scenario || 'N/A'} | ${scenarioCenter.name}`, 10, CANVAS_SIZE - 60);
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
   * Get screen position from aircraft data
   * Supports both grid (x,y) and lat/lon formats
   */
  const getAircraftScreenPos = (ac) => {
    // Check if aircraft has grid position (from scenario state)
    if (ac.position && typeof ac.position.x === 'number' && typeof ac.position.y === 'number') {
      return gridToScreen(
        ac.position.x,
        ac.position.y,
        CANVAS_SIZE,
        CANVAS_SIZE,
        RADAR_RANGE_NM
      );
    }
    // Fallback to lat/lon format (from simulation SSE)
    if (typeof ac.lat === 'number' && typeof ac.lon === 'number') {
      return latLonToScreen(
        ac.lat,
        ac.lon,
        scenarioCenter.lat,
        scenarioCenter.lon,
        CANVAS_SIZE,
        CANVAS_SIZE,
        RADAR_RANGE_NM
      );
    }
    // No valid position data
    console.warn(`Aircraft ${ac.callsign} missing position data:`, ac);
    return null;
  };

  /**
   * Draw aircraft symbol
   */
  const drawAircraft = (ctx, ac, isSelected) => {
    const pos = getAircraftScreenPos(ac);

    // Skip if no valid position or out of bounds
    if (!pos || pos.x < 0 || pos.x > CANVAS_SIZE || pos.y < 0 || pos.y > CANVAS_SIZE) {
      return;
    }

    // Draw mood ring FIRST (behind the aircraft symbol)
    // Mood colors: happy=green, annoyed=yellow, angry=red
    const moodColors = {
      happy: '#00ff00',
      annoyed: '#ffaa00',
      angry: '#ff4444'
    };
    const mood = ac.mood || 'happy';
    const moodColor = moodColors[mood] || moodColors.happy;

    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
    ctx.strokeStyle = moodColor;
    ctx.lineWidth = mood === 'angry' ? 3 : 2;
    ctx.stroke();

    // Add pulsing glow for angry pilots
    if (mood === 'angry') {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 68, 68, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

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

      const pos = getAircraftScreenPos(ac);
      if (!pos) return;

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
   * Accounts for CSS scaling by converting click coordinates to internal canvas coordinates
   */
  const handleCanvasClick = (event) => {
    const canvas = canvasRef.current;
    if (!canvas || !aircraft || aircraft.length === 0) return;

    const rect = canvas.getBoundingClientRect();

    // Scale click coordinates to internal canvas coordinates
    // This is necessary because CSS may scale the canvas display size differently from its internal size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    let closestAircraft = null;
    let closestDistance = Infinity;
    // Scale the click radius based on display scaling (use larger of the two scales)
    const clickRadius = 25 * Math.max(scaleX, scaleY);

    aircraft.forEach(ac => {
      const pos = getAircraftScreenPos(ac);
      if (!pos) return;

      const distance = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2);
      if (distance < clickRadius && distance < closestDistance) {
        closestAircraft = ac;
        closestDistance = distance;
      }
    });

    handleAircraftSelection(closestAircraft);
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

        {/* Pulsing dots for pending alerts */}
        {aircraft && aircraft.length > 0 && pendingAlerts && pendingAlerts.length > 0 && (
          <div className="pulsing-dot-layer">
            {aircraft.map(ac => {
              const hasPendingAlert = pendingAlerts.some(p => p.target === ac.callsign);
              if (!hasPendingAlert) {
                return null;
              }

              const pos = getAircraftScreenPos(ac);
              if (!pos) {
                return null;
              }

              return (
                <PulsingDot
                  key={`dot-${ac.callsign}`}
                  style={{
                    top: `${pos.y}px`,
                    left: `${pos.x}px`,
                  }}
                />
              );
            })}
          </div>
        )}

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
            <button onClick={() => handleAircraftSelection(null)}>Close</button>
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
