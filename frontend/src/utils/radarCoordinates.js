/**
 * Radar Coordinate Utilities
 *
 * Provides coordinate conversion and distance calculation functions
 * for the BlueSky ATC radar display
 */

// Scenario center coordinates (KSFO for all scenarios)
export const SCENARIO_CENTERS = {
  L1: { lat: 37.6213, lon: -122.3790, name: 'KSFO' },
  L2: { lat: 37.6213, lon: -122.3790, name: 'KSFO' },
  L3: { lat: 37.6213, lon: -122.3790, name: 'KSFO' },
  H4: { lat: 37.6213, lon: -122.3790, name: 'KSFO' },
  H5: { lat: 37.6213, lon: -122.3790, name: 'KSFO' },
  H6: { lat: 37.6213, lon: -122.3790, name: 'KSFO' }
};

// Earth radius in nautical miles
const EARTH_RADIUS_NM = 3440.065;

// Conversion constants
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Convert latitude/longitude to screen X/Y coordinates
 *
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {number} centerLat - Center latitude of radar
 * @param {number} centerLon - Center longitude of radar
 * @param {number} canvasWidth - Canvas width in pixels
 * @param {number} canvasHeight - Canvas height in pixels
 * @param {number} rangeNM - Radar range in nautical miles
 * @returns {{x: number, y: number}} Screen coordinates
 */
export function latLonToScreen(lat, lon, centerLat, centerLon, canvasWidth, canvasHeight, rangeNM) {
  // Calculate scale (pixels per NM)
  const scale = canvasWidth / (2 * rangeNM);

  // Convert lat/lon difference to nautical miles
  // 1 degree latitude ≈ 60 NM
  // 1 degree longitude ≈ 60 * cos(latitude) NM
  const x_nm = (lon - centerLon) * 60 * Math.cos(centerLat * DEG_TO_RAD);
  const y_nm = (centerLat - lat) * 60; // Inverted for screen coordinates (y increases downward)

  // Convert to screen coordinates
  const x = (canvasWidth / 2) + (x_nm * scale);
  const y = (canvasHeight / 2) + (y_nm * scale);

  return { x, y };
}

/**
 * Convert screen X/Y coordinates to latitude/longitude
 *
 * @param {number} x - Screen X coordinate
 * @param {number} y - Screen Y coordinate
 * @param {number} centerLat - Center latitude of radar
 * @param {number} centerLon - Center longitude of radar
 * @param {number} canvasWidth - Canvas width in pixels
 * @param {number} canvasHeight - Canvas height in pixels
 * @param {number} rangeNM - Radar range in nautical miles
 * @returns {{lat: number, lon: number}} Geographic coordinates
 */
export function screenToLatLon(x, y, centerLat, centerLon, canvasWidth, canvasHeight, rangeNM) {
  // Calculate scale (pixels per NM)
  const scale = canvasWidth / (2 * rangeNM);

  // Convert screen coordinates to NM offsets
  const x_nm = (x - (canvasWidth / 2)) / scale;
  const y_nm = (y - (canvasHeight / 2)) / scale;

  // Convert NM offsets to lat/lon
  const lon = centerLon + (x_nm / (60 * Math.cos(centerLat * DEG_TO_RAD)));
  const lat = centerLat - y_nm / 60; // Inverted for screen coordinates

  return { lat, lon };
}

/**
 * Calculate great circle distance between two lat/lon points
 * Uses Haversine formula
 *
 * @param {number} lat1 - First point latitude
 * @param {number} lon1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lon2 - Second point longitude
 * @returns {number} Distance in nautical miles
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;

  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * DEG_TO_RAD) *
            Math.cos(lat2 * DEG_TO_RAD) *
            Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_NM * c;
}

/**
 * Calculate separation between two aircraft
 *
 * @param {object} aircraft1 - First aircraft with {lat, lon, altitude}
 * @param {object} aircraft2 - Second aircraft with {lat, lon, altitude}
 * @returns {{horizontal: number, vertical: number}} Separation in NM and feet
 */
export function calculateSeparation(aircraft1, aircraft2) {
  const horizontal = calculateDistance(
    aircraft1.lat,
    aircraft1.lon,
    aircraft2.lat,
    aircraft2.lon
  );

  const vertical = Math.abs(aircraft1.altitude - aircraft2.altitude);

  return { horizontal, vertical };
}

/**
 * Check if two aircraft are in conflict
 * ATC standards: 3 NM horizontal OR 1000 ft vertical separation minimum
 *
 * @param {object} aircraft1 - First aircraft
 * @param {object} aircraft2 - Second aircraft
 * @returns {boolean} True if in conflict
 */
export function isInConflict(aircraft1, aircraft2) {
  const { horizontal, vertical } = calculateSeparation(aircraft1, aircraft2);

  // Conflict if BOTH horizontal < 3nm AND vertical < 1000ft
  return horizontal < 3 && vertical < 1000;
}

/**
 * Calculate conflict severity based on separation
 *
 * @param {number} horizontalSep - Horizontal separation in NM
 * @param {number} verticalSep - Vertical separation in feet
 * @returns {string} Severity level: 'critical', 'warning', or 'caution'
 */
export function calculateConflictSeverity(horizontalSep, verticalSep) {
  if (horizontalSep < 1 && verticalSep < 500) {
    return 'critical'; // Extremely dangerous
  } else if (horizontalSep < 2 && verticalSep < 750) {
    return 'warning'; // Dangerous
  } else if (horizontalSep < 3 && verticalSep < 1000) {
    return 'caution'; // Violation of separation standards
  }
  return 'none';
}

/**
 * Calculate bearing from one point to another
 *
 * @param {number} lat1 - Origin latitude
 * @param {number} lon1 - Origin longitude
 * @param {number} lat2 - Destination latitude
 * @param {number} lon2 - Destination longitude
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const lat1Rad = lat1 * DEG_TO_RAD;
  const lat2Rad = lat2 * DEG_TO_RAD;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = Math.atan2(y, x) * RAD_TO_DEG;

  // Normalize to 0-360
  bearing = (bearing + 360) % 360;

  return bearing;
}

/**
 * Check if a point is within the radar display bounds
 *
 * @param {number} lat - Point latitude
 * @param {number} lon - Point longitude
 * @param {number} centerLat - Radar center latitude
 * @param {number} centerLon - Radar center longitude
 * @param {number} rangeNM - Radar range in NM
 * @returns {boolean} True if within bounds
 */
export function isWithinRadarBounds(lat, lon, centerLat, centerLon, rangeNM) {
  const distance = calculateDistance(lat, lon, centerLat, centerLon);
  return distance <= rangeNM;
}

/**
 * Project a position along a heading for a given distance
 *
 * @param {number} lat - Origin latitude
 * @param {number} lon - Origin longitude
 * @param {number} heading - Heading in degrees
 * @param {number} distanceNM - Distance in nautical miles
 * @returns {{lat: number, lon: number}} Projected position
 */
export function projectPosition(lat, lon, heading, distanceNM) {
  const latRad = lat * DEG_TO_RAD;
  const lonRad = lon * DEG_TO_RAD;
  const headingRad = heading * DEG_TO_RAD;
  const angularDistance = distanceNM / EARTH_RADIUS_NM;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
    Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(headingRad)
  );

  const newLonRad = lonRad + Math.atan2(
    Math.sin(headingRad) * Math.sin(angularDistance) * Math.cos(latRad),
    Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
  );

  return {
    lat: newLatRad * RAD_TO_DEG,
    lon: newLonRad * RAD_TO_DEG
  };
}

/**
 * Get scenario center for a given scenario ID
 *
 * @param {string} scenarioId - Scenario identifier (L1, L2, etc.)
 * @returns {{lat: number, lon: number, name: string}} Center coordinates
 */
export function getScenarioCenter(scenarioId) {
  return SCENARIO_CENTERS[scenarioId] || SCENARIO_CENTERS.L1; // Default to L1
}
