/**
 * Radar Highlight Component
 *
 * Visual overlay component that highlights specific regions on the radar display
 * for ML-based predictive alerts (Condition 3).
 *
 * Creates pulsing, semi-transparent boxes that draw attention to areas of concern
 * predicted by the machine learning model.
 */

import React, { useState, useEffect } from 'react';
import '../styles/radarHighlight.css';

function RadarHighlight({
  region,
  confidence = 85,
  alertId,
  radarRef = null // Optional ref to radar container for relative positioning
}) {
  const {
    x = 0,
    y = 0,
    width = 100,
    height = 100,
    label = '',
    severity = 'medium',
    description = ''
  } = region;

  const [isVisible, setIsVisible] = useState(false);
  const [isPulsing, setIsPulsing] = useState(true);

  // Fade in animation
  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  // Stop pulsing after 10 seconds to reduce distraction
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPulsing(false);
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  /**
   * Get severity class for styling
   */
  const getSeverityClass = () => {
    const severityMap = {
      high: 'highlight-high',
      medium: 'highlight-medium',
      low: 'highlight-low'
    };
    return severityMap[severity] || 'highlight-medium';
  };

  /**
   * Get pulse speed based on severity
   */
  const getPulseSpeed = () => {
    const speeds = {
      high: '1s',
      medium: '1.5s',
      low: '2s'
    };
    return speeds[severity] || '1.5s';
  };

  /**
   * Calculate opacity based on confidence
   */
  const getOpacity = () => {
    // Higher confidence = more visible
    // Scale: 60% confidence = 0.3 opacity, 100% confidence = 0.7 opacity
    return 0.3 + ((confidence - 60) / 40) * 0.4;
  };

  const highlightStyle = {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`,
    opacity: isVisible ? getOpacity() : 0,
    animationDuration: isPulsing ? getPulseSpeed() : 'none'
  };

  return (
    <div
      className={`radar-highlight ${getSeverityClass()} ${
        isPulsing ? 'pulsing' : 'static'
      }`}
      style={highlightStyle}
      role="presentation"
      aria-label={`Highlighted region: ${label || 'Area of concern'}`}
      data-alert-id={alertId}
      title={description || label}
    >
      {/* Highlight Border */}
      <div className="highlight-border" />

      {/* Corner Markers */}
      <div className="highlight-corner corner-tl" />
      <div className="highlight-corner corner-tr" />
      <div className="highlight-corner corner-bl" />
      <div className="highlight-corner corner-br" />

      {/* Label */}
      {label && (
        <div className="highlight-label">
          <span className="label-text">{label}</span>
        </div>
      )}

      {/* Confidence Indicator */}
      {confidence >= 90 && (
        <div className="highlight-confidence-indicator">
          <span className="confidence-text">{confidence}%</span>
        </div>
      )}

      {/* Animated Scan Line (for high severity) */}
      {severity === 'high' && isPulsing && (
        <div className="highlight-scanline" />
      )}
    </div>
  );
}

/**
 * RadarHighlightGroup Component
 *
 * Manages multiple highlights that should be grouped together
 * (e.g., two aircraft involved in the same predicted conflict)
 */
export function RadarHighlightGroup({
  regions,
  confidence,
  alertId,
  showConnectingLine = false
}) {
  return (
    <div className="radar-highlight-group">
      {regions.map((region, index) => (
        <RadarHighlight
          key={`${alertId}_${index}`}
          region={region}
          confidence={confidence}
          alertId={alertId}
        />
      ))}

      {/* Optional connecting line between highlights */}
      {showConnectingLine && regions.length === 2 && (
        <svg
          className="highlight-connector"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
        >
          <line
            x1={regions[0].x + regions[0].width / 2}
            y1={regions[0].y + regions[0].height / 2}
            x2={regions[1].x + regions[1].width / 2}
            y2={regions[1].y + regions[1].height / 2}
            stroke="#ffc107"
            strokeWidth="2"
            strokeDasharray="5,5"
            opacity="0.6"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="10"
              dur="1s"
              repeatCount="indefinite"
            />
          </line>
        </svg>
      )}
    </div>
  );
}

/**
 * RadarOverlay Component
 *
 * Container component that wraps the radar display and manages all highlights
 * Provides positioning context for highlights
 */
export function RadarOverlay({ children, highlights = [] }) {
  return (
    <div className="radar-overlay-container">
      {/* Radar content */}
      <div className="radar-content">{children}</div>

      {/* Highlight overlays */}
      <div className="radar-overlay-highlights">
        {highlights.map((highlight) => (
          <RadarHighlight
            key={highlight.alertId || Math.random()}
            {...highlight}
          />
        ))}
      </div>
    </div>
  );
}

export default RadarHighlight;
