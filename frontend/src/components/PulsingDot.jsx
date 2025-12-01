import React from 'react';
import '../styles/pulsingDot.css';

/**
 * A simple visual component that displays a pulsing red dot.
 * Used to highlight an aircraft on the radar that has a pending, unresolved alert.
 * @param {object} style - Allows passing inline styles for positioning (e.g., top, left).
 */
const PulsingDot = ({ style }) => {
  return <div className="pulsing-dot" style={style}></div>;
};

export default PulsingDot;
