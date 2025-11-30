/**
 * Behavioral Tracking Service
 *
 * Comprehensive tracking system for ATC research that captures:
 * - Mouse movements (position, velocity)
 * - Click events (position, target, type)
 * - Dwell time per screen region
 * - Attention patterns (scan velocity, peripheral neglect, crisis fixation)
 * - Alert interaction metrics
 *
 * Critical for measuring research outcomes across three alert conditions.
 */

class BehavioralTracker {
  constructor(config = {}) {
    // Configuration
    this.config = {
      mouseTrackingInterval: config.mouseTrackingInterval || 100, // ms
      mouseSampleBufferSize: config.mouseSampleBufferSize || 10000,
      clickBufferSize: config.clickBufferSize || 1000,
      regionDwellThreshold: config.regionDwellThreshold || 500, // ms to count as dwell
      peripheralNeglectThreshold: config.peripheralNeglectThreshold || 5000, // ms
      scanVelocityWindowSize: config.scanVelocityWindowSize || 10, // samples
      exportBatchSize: config.exportBatchSize || 1000,
      enableDebugMode: config.enableDebugMode || false,
      ...config
    };

    // Session metadata
    this.sessionMetadata = {
      sessionId: null,
      participantId: null,
      scenario: null, // L1, L2, H4, H5
      condition: null, // 1, 2, 3
      startTime: null,
      endTime: null,
      browserInfo: this._getBrowserInfo(),
      screenResolution: `${window.screen.width}x${window.screen.height}`
    };

    // Screen regions for dwell time tracking
    this.regions = {};

    // Tracking data buffers
    this.mouseMovements = [];
    this.clickEvents = [];
    this.dwellTimeData = {}; // region -> cumulative time
    this.regionTimestamps = {}; // region -> last entry timestamp
    this.alertInteractions = [];
    this.attentionMetrics = {
      scanVelocities: [],
      peripheralNeglects: {},
      crisisFixations: []
    };

    // Tracking state
    this.isTracking = false;
    this.mouseTrackingTimer = null;
    this.lastMousePosition = { x: 0, y: 0, timestamp: Date.now() };
    this.currentRegion = null;
    this.lastRegionEntry = null;

    // Alert tracking state
    this.activeAlerts = new Map(); // alertId -> alert data
    this.alertResponseTimes = [];

    // Event listeners references (for cleanup)
    this.eventListeners = {
      mousemove: null,
      mousedown: null,
      mouseup: null,
      contextmenu: null,
      visibilitychange: null
    };

    // Performance monitoring
    this.performanceMetrics = {
      trackingDuration: 0,
      sampleCount: 0,
      memoryWarnings: 0
    };
  }

  /**
   * Initialize tracking session
   */
  startSession(metadata = {}) {
    if (this.isTracking) {
      this._log('warn', 'Session already in progress. Stop current session first.');
      return;
    }

    // Set session metadata
    this.sessionMetadata = {
      ...this.sessionMetadata,
      sessionId: metadata.sessionId || this._generateSessionId(),
      participantId: metadata.participantId || 'anonymous',
      scenario: metadata.scenario || 'unknown',
      condition: metadata.condition || 'unknown',
      startTime: Date.now(),
      endTime: null,
      ...metadata
    };

    // Reset data buffers
    this._resetBuffers();

    // Start tracking
    this.isTracking = true;
    this._attachEventListeners();
    this._startMouseTracking();

    this._log('info', `Tracking session started: ${this.sessionMetadata.sessionId}`);

    return this.sessionMetadata.sessionId;
  }

  /**
   * Stop tracking session
   */
  stopSession() {
    if (!this.isTracking) {
      this._log('warn', 'No active tracking session.');
      return null;
    }

    this.sessionMetadata.endTime = Date.now();
    this.isTracking = false;

    // Stop tracking
    this._stopMouseTracking();
    this._detachEventListeners();

    // Finalize dwell times
    this._finalizeDwellTime();

    // Calculate final metrics
    this._calculateFinalMetrics();

    this._log('info', `Tracking session stopped: ${this.sessionMetadata.sessionId}`);

    return this.exportData();
  }

  /**
   * Define screen regions for dwell time tracking
   */
  defineRegions(regionDefinitions) {
    this.regions = {};

    for (const [regionId, definition] of Object.entries(regionDefinitions)) {
      this.regions[regionId] = {
        id: regionId,
        name: definition.name || regionId,
        x: definition.x,
        y: definition.y,
        width: definition.width,
        height: definition.height,
        priority: definition.priority || 0, // For overlapping regions
        category: definition.category || 'general', // e.g., 'radar', 'alert', 'control'
        ...definition
      };

      // Initialize dwell time tracking
      this.dwellTimeData[regionId] = 0;
      this.regionTimestamps[regionId] = null;
      this.attentionMetrics.peripheralNeglects[regionId] = {
        lastVisit: null,
        neglectCount: 0,
        maxNeglectDuration: 0
      };
    }

    this._log('info', `Defined ${Object.keys(this.regions).length} regions`);
  }

  /**
   * Define regions from DOM elements
   */
  defineRegionsFromElements(elementMappings) {
    const regionDefinitions = {};

    for (const [regionId, selector] of Object.entries(elementMappings)) {
      const element = document.querySelector(selector);
      if (!element) {
        this._log('warn', `Element not found for region: ${regionId} (${selector})`);
        continue;
      }

      const rect = element.getBoundingClientRect();
      regionDefinitions[regionId] = {
        name: regionId,
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
        element: selector
      };
    }

    this.defineRegions(regionDefinitions);
  }

  /**
   * Update region definitions (e.g., when layout changes)
   */
  updateRegion(regionId, updates) {
    if (!this.regions[regionId]) {
      this._log('warn', `Region not found: ${regionId}`);
      return;
    }

    this.regions[regionId] = {
      ...this.regions[regionId],
      ...updates
    };
  }

  /**
   * Track alert presentation
   */
  trackAlertPresented(alertData) {
    const alertEvent = {
      alertId: alertData.alertId,
      type: 'presented',
      timestamp: Date.now(),
      severity: alertData.severity,
      condition: this.sessionMetadata.condition,
      title: alertData.title,
      message: alertData.message,
      confidence: alertData.confidence, // For Condition 3
      metadata: alertData
    };

    this.activeAlerts.set(alertData.alertId, alertEvent);
    this.alertInteractions.push(alertEvent);

    this._log('debug', `Alert presented: ${alertData.alertId}`);
  }

  /**
   * Track alert acknowledgment/dismissal
   */
  trackAlertResponse(alertId, responseType, responseData = {}) {
    const alertEvent = this.activeAlerts.get(alertId);
    if (!alertEvent) {
      this._log('warn', `Alert not found: ${alertId}`);
      return;
    }

    const responseTime = Date.now() - alertEvent.timestamp;

    const responseEvent = {
      alertId,
      type: responseType, // 'acknowledged', 'dismissed', 'accepted', 'rejected', 'minimized'
      timestamp: Date.now(),
      responseTime,
      ...responseData
    };

    this.alertInteractions.push(responseEvent);
    this.alertResponseTimes.push({
      alertId,
      responseTime,
      responseType,
      severity: alertEvent.severity
    });

    // Remove from active alerts if dismissed/acknowledged
    if (['acknowledged', 'dismissed'].includes(responseType)) {
      this.activeAlerts.delete(alertId);
    }

    this._log('debug', `Alert response: ${alertId} - ${responseType} (${responseTime}ms)`);

    return responseEvent;
  }

  /**
   * Track alert action click (e.g., recommended action button)
   */
  trackAlertAction(alertId, actionLabel, actionData = {}) {
    const actionEvent = {
      alertId,
      type: 'action_clicked',
      actionLabel,
      timestamp: Date.now(),
      ...actionData
    };

    this.alertInteractions.push(actionEvent);

    this._log('debug', `Alert action: ${alertId} - ${actionLabel}`);

    return actionEvent;
  }

  /**
   * Track custom event
   */
  trackCustomEvent(eventType, eventData) {
    const event = {
      type: eventType,
      timestamp: Date.now(),
      ...eventData
    };

    // Store in appropriate buffer based on event type
    if (eventType.startsWith('alert_')) {
      this.alertInteractions.push(event);
    } else {
      // Generic events array (create if needed)
      if (!this.customEvents) {
        this.customEvents = [];
      }
      this.customEvents.push(event);
    }

    return event;
  }

  /**
   * Get current attention metrics
   */
  getAttentionMetrics() {
    return {
      dwellTimes: { ...this.dwellTimeData },
      currentRegion: this.currentRegion,
      scanVelocity: this._getCurrentScanVelocity(),
      peripheralNeglects: this._getPeripheralNeglects(),
      crisisFixationRatio: this._getCrisisFixationRatio(),
      alertResponseTimes: this._getAlertResponseStats()
    };
  }

  /**
   * Get real-time statistics
   */
  getRealtimeStats() {
    const now = Date.now();
    const duration = this.sessionMetadata.startTime
      ? (now - this.sessionMetadata.startTime) / 1000
      : 0;

    return {
      sessionDuration: duration,
      mouseMovements: this.mouseMovements.length,
      clickEvents: this.clickEvents.length,
      alertInteractions: this.alertInteractions.length,
      activeAlerts: this.activeAlerts.size,
      dwellTimes: this.dwellTimeData,
      currentRegion: this.currentRegion,
      attentionMetrics: this.getAttentionMetrics(),
      memoryUsage: this._estimateMemoryUsage()
    };
  }

  /**
   * Export all tracked data
   */
  exportData(options = {}) {
    const {
      includeRawMouseData = true,
      includeRawClickData = true,
      includeAnalytics = true,
      format = 'json'
    } = options;

    const exportData = {
      // Session metadata
      session: { ...this.sessionMetadata },

      // Region definitions
      regions: { ...this.regions },

      // Tracking data
      tracking: {},

      // Analytics
      analytics: {}
    };

    // Raw tracking data
    if (includeRawMouseData) {
      exportData.tracking.mouseMovements = this.mouseMovements;
    }

    if (includeRawClickData) {
      exportData.tracking.clickEvents = this.clickEvents;
    }

    exportData.tracking.dwellTimes = { ...this.dwellTimeData };
    exportData.tracking.alertInteractions = this.alertInteractions;

    // Analytics
    if (includeAnalytics) {
      exportData.analytics = {
        attentionMetrics: this.getAttentionMetrics(),
        mouseStatistics: this._calculateMouseStatistics(),
        clickStatistics: this._calculateClickStatistics(),
        alertStatistics: this._calculateAlertStatistics(),
        dwellStatistics: this._calculateDwellStatistics(),
        performanceMetrics: this.performanceMetrics
      };
    }

    // Format conversion
    if (format === 'csv') {
      return this._convertToCSV(exportData);
    }

    return exportData;
  }

  /**
   * Export data as JSON file download
   */
  downloadData(filename = null) {
    const data = this.exportData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    const defaultFilename = `behavioral_tracking_${this.sessionMetadata.sessionId}_${Date.now()}.json`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || defaultFilename;
    link.click();

    URL.revokeObjectURL(url);

    this._log('info', `Data exported: ${filename || defaultFilename}`);
  }

  /**
   * Reset all tracking data
   */
  reset() {
    if (this.isTracking) {
      this.stopSession();
    }

    this._resetBuffers();
    this.regions = {};
    this.sessionMetadata.sessionId = null;

    this._log('info', 'Tracker reset');
  }

  /* =========================================================================
     PRIVATE METHODS - Mouse Tracking
     ========================================================================= */

  _startMouseTracking() {
    if (this.mouseTrackingTimer) {
      clearInterval(this.mouseTrackingTimer);
    }

    this.mouseTrackingTimer = setInterval(() => {
      this._sampleMousePosition();
    }, this.config.mouseTrackingInterval);
  }

  _stopMouseTracking() {
    if (this.mouseTrackingTimer) {
      clearInterval(this.mouseTrackingTimer);
      this.mouseTrackingTimer = null;
    }
  }

  _sampleMousePosition() {
    if (!this.isTracking) return;

    const now = Date.now();
    const { x, y } = this.lastMousePosition;
    const timeDelta = now - this.lastMousePosition.timestamp;

    // Calculate velocity (pixels per second)
    const distance = this._calculateDistance(
      this.lastMousePosition,
      { x, y }
    );
    const velocity = timeDelta > 0 ? (distance / timeDelta) * 1000 : 0;

    // Create sample
    const sample = {
      x,
      y,
      timestamp: now,
      velocity,
      region: this.currentRegion
    };

    // Add to buffer
    this.mouseMovements.push(sample);

    // Update scan velocity
    this._updateScanVelocity(velocity);

    // Check buffer size
    if (this.mouseMovements.length > this.config.mouseSampleBufferSize) {
      this._log('warn', 'Mouse buffer size exceeded. Consider exporting data.');
      this.performanceMetrics.memoryWarnings++;
    }

    this.performanceMetrics.sampleCount++;
  }

  _handleMouseMove(event) {
    const now = Date.now();
    const x = event.clientX + window.scrollX;
    const y = event.clientY + window.scrollY;

    this.lastMousePosition = { x, y, timestamp: now };

    // Update current region
    this._updateCurrentRegion(x, y, now);
  }

  _updateCurrentRegion(x, y, timestamp) {
    // Find which region the mouse is in
    let foundRegion = null;
    let highestPriority = -1;

    for (const [regionId, region] of Object.entries(this.regions)) {
      if (
        x >= region.x &&
        x <= region.x + region.width &&
        y >= region.y &&
        y <= region.y + region.height
      ) {
        // Handle overlapping regions by priority
        if (region.priority > highestPriority) {
          foundRegion = regionId;
          highestPriority = region.priority;
        }
      }
    }

    // Region change detection
    if (foundRegion !== this.currentRegion) {
      // Exit previous region
      if (this.currentRegion && this.lastRegionEntry) {
        const dwellTime = timestamp - this.lastRegionEntry;
        if (dwellTime >= this.config.regionDwellThreshold) {
          this.dwellTimeData[this.currentRegion] += dwellTime;
        }
      }

      // Enter new region
      if (foundRegion) {
        this.lastRegionEntry = timestamp;
        this.attentionMetrics.peripheralNeglects[foundRegion].lastVisit = timestamp;

        // Check for peripheral neglect in other regions
        this._checkPeripheralNeglect(timestamp);
      }

      this.currentRegion = foundRegion;
    }
  }

  _finalizeDwellTime() {
    if (this.currentRegion && this.lastRegionEntry) {
      const dwellTime = Date.now() - this.lastRegionEntry;
      if (dwellTime >= this.config.regionDwellThreshold) {
        this.dwellTimeData[this.currentRegion] += dwellTime;
      }
    }
  }

  /* =========================================================================
     PRIVATE METHODS - Click Tracking
     ========================================================================= */

  _handleMouseDown(event) {
    if (!this.isTracking) return;

    const clickData = this._captureClickData(event, 'mousedown');
    this.clickEvents.push(clickData);

    // Check buffer size
    if (this.clickEvents.length > this.config.clickBufferSize) {
      this._log('warn', 'Click buffer size exceeded.');
    }
  }

  _handleMouseUp(event) {
    if (!this.isTracking) return;

    const clickData = this._captureClickData(event, 'mouseup');
    this.clickEvents.push(clickData);
  }

  _handleContextMenu(event) {
    if (!this.isTracking) return;

    const clickData = this._captureClickData(event, 'contextmenu');
    this.clickEvents.push(clickData);
  }

  _captureClickData(event, clickType) {
    const x = event.clientX + window.scrollX;
    const y = event.clientY + window.scrollY;

    return {
      type: clickType,
      button: event.button, // 0: left, 1: middle, 2: right
      x,
      y,
      timestamp: Date.now(),
      target: {
        tagName: event.target.tagName,
        id: event.target.id,
        className: event.target.className,
        textContent: event.target.textContent?.substring(0, 50) // Limit text
      },
      region: this.currentRegion,
      modifiers: {
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        alt: event.altKey,
        meta: event.metaKey
      }
    };
  }

  /* =========================================================================
     PRIVATE METHODS - Attention Analysis
     ========================================================================= */

  _updateScanVelocity(velocity) {
    this.attentionMetrics.scanVelocities.push({
      velocity,
      timestamp: Date.now()
    });

    // Keep window size limited
    const windowSize = this.config.scanVelocityWindowSize * 10; // Keep more for analysis
    if (this.attentionMetrics.scanVelocities.length > windowSize) {
      this.attentionMetrics.scanVelocities.shift();
    }
  }

  _getCurrentScanVelocity() {
    const window = this.attentionMetrics.scanVelocities.slice(
      -this.config.scanVelocityWindowSize
    );

    if (window.length === 0) return 0;

    const sum = window.reduce((acc, s) => acc + s.velocity, 0);
    return sum / window.length;
  }

  _checkPeripheralNeglect(currentTime) {
    for (const [regionId, neglectData] of Object.entries(
      this.attentionMetrics.peripheralNeglects
    )) {
      if (regionId === this.currentRegion) continue;

      if (neglectData.lastVisit) {
        const neglectDuration = currentTime - neglectData.lastVisit;

        if (neglectDuration > this.config.peripheralNeglectThreshold) {
          neglectData.neglectCount++;

          if (neglectDuration > neglectData.maxNeglectDuration) {
            neglectData.maxNeglectDuration = neglectDuration;
          }
        }
      }
    }
  }

  _getPeripheralNeglects() {
    const neglects = {};

    for (const [regionId, data] of Object.entries(
      this.attentionMetrics.peripheralNeglects
    )) {
      const now = Date.now();
      const timeSinceVisit = data.lastVisit ? now - data.lastVisit : null;

      neglects[regionId] = {
        lastVisit: data.lastVisit,
        timeSinceVisit,
        neglectCount: data.neglectCount,
        maxNeglectDuration: data.maxNeglectDuration,
        isNeglected: timeSinceVisit > this.config.peripheralNeglectThreshold
      };
    }

    return neglects;
  }

  _getCrisisFixationRatio() {
    // Calculate ratio of time spent on alerts vs radar
    const totalSessionTime = this.sessionMetadata.startTime
      ? Date.now() - this.sessionMetadata.startTime
      : 1;

    let alertTime = 0;
    let radarTime = 0;

    for (const [regionId, dwellTime] of Object.entries(this.dwellTimeData)) {
      const region = this.regions[regionId];
      if (!region) continue;

      if (region.category === 'alert') {
        alertTime += dwellTime;
      } else if (region.category === 'radar') {
        radarTime += dwellTime;
      }
    }

    return {
      alertTime,
      radarTime,
      totalTime: totalSessionTime,
      ratio: radarTime > 0 ? alertTime / radarTime : 0,
      alertPercentage: (alertTime / totalSessionTime) * 100,
      radarPercentage: (radarTime / totalSessionTime) * 100
    };
  }

  _getAlertResponseStats() {
    if (this.alertResponseTimes.length === 0) {
      return null;
    }

    const times = this.alertResponseTimes.map(a => a.responseTime);
    times.sort((a, b) => a - b);

    return {
      count: times.length,
      mean: times.reduce((sum, t) => sum + t, 0) / times.length,
      median: times[Math.floor(times.length / 2)],
      min: times[0],
      max: times[times.length - 1],
      stdDev: this._calculateStdDev(times)
    };
  }

  /* =========================================================================
     PRIVATE METHODS - Statistics
     ========================================================================= */

  _calculateMouseStatistics() {
    if (this.mouseMovements.length === 0) {
      return null;
    }

    const velocities = this.mouseMovements.map(m => m.velocity);
    const totalDistance = this._calculateTotalDistance();

    return {
      sampleCount: this.mouseMovements.length,
      totalDistance,
      averageVelocity: velocities.reduce((sum, v) => sum + v, 0) / velocities.length,
      maxVelocity: Math.max(...velocities),
      minVelocity: Math.min(...velocities)
    };
  }

  _calculateClickStatistics() {
    if (this.clickEvents.length === 0) {
      return null;
    }

    const byButton = {};
    const byRegion = {};

    for (const click of this.clickEvents) {
      // Count by button
      const buttonKey = `button_${click.button}`;
      byButton[buttonKey] = (byButton[buttonKey] || 0) + 1;

      // Count by region
      if (click.region) {
        byRegion[click.region] = (byRegion[click.region] || 0) + 1;
      }
    }

    return {
      totalClicks: this.clickEvents.length,
      byButton,
      byRegion
    };
  }

  _calculateAlertStatistics() {
    if (this.alertInteractions.length === 0) {
      return null;
    }

    const byType = {};
    const bySeverity = {};

    for (const interaction of this.alertInteractions) {
      byType[interaction.type] = (byType[interaction.type] || 0) + 1;

      if (interaction.severity) {
        bySeverity[interaction.severity] = (bySeverity[interaction.severity] || 0) + 1;
      }
    }

    return {
      totalInteractions: this.alertInteractions.length,
      byType,
      bySeverity,
      responseTimeStats: this._getAlertResponseStats()
    };
  }

  _calculateDwellStatistics() {
    const stats = {};
    const totalDwellTime = Object.values(this.dwellTimeData).reduce(
      (sum, time) => sum + time,
      0
    );

    for (const [regionId, dwellTime] of Object.entries(this.dwellTimeData)) {
      stats[regionId] = {
        dwellTime,
        percentage: totalDwellTime > 0 ? (dwellTime / totalDwellTime) * 100 : 0
      };
    }

    return {
      byRegion: stats,
      totalDwellTime
    };
  }

  _calculateFinalMetrics() {
    this.performanceMetrics.trackingDuration =
      this.sessionMetadata.endTime - this.sessionMetadata.startTime;
  }

  /* =========================================================================
     PRIVATE METHODS - Utilities
     ========================================================================= */

  _attachEventListeners() {
    this.eventListeners.mousemove = this._handleMouseMove.bind(this);
    this.eventListeners.mousedown = this._handleMouseDown.bind(this);
    this.eventListeners.mouseup = this._handleMouseUp.bind(this);
    this.eventListeners.contextmenu = this._handleContextMenu.bind(this);

    document.addEventListener('mousemove', this.eventListeners.mousemove);
    document.addEventListener('mousedown', this.eventListeners.mousedown);
    document.addEventListener('mouseup', this.eventListeners.mouseup);
    document.addEventListener('contextmenu', this.eventListeners.contextmenu);

    // Track visibility changes (user switches tabs)
    this.eventListeners.visibilitychange = () => {
      if (document.hidden) {
        this.trackCustomEvent('visibility_hidden', {});
      } else {
        this.trackCustomEvent('visibility_visible', {});
      }
    };
    document.addEventListener(
      'visibilitychange',
      this.eventListeners.visibilitychange
    );
  }

  _detachEventListeners() {
    document.removeEventListener('mousemove', this.eventListeners.mousemove);
    document.removeEventListener('mousedown', this.eventListeners.mousedown);
    document.removeEventListener('mouseup', this.eventListeners.mouseup);
    document.removeEventListener('contextmenu', this.eventListeners.contextmenu);
    document.removeEventListener(
      'visibilitychange',
      this.eventListeners.visibilitychange
    );

    this.eventListeners = {
      mousemove: null,
      mousedown: null,
      mouseup: null,
      contextmenu: null,
      visibilitychange: null
    };
  }

  _resetBuffers() {
    this.mouseMovements = [];
    this.clickEvents = [];
    this.dwellTimeData = {};
    this.regionTimestamps = {};
    this.alertInteractions = [];
    this.attentionMetrics = {
      scanVelocities: [],
      peripheralNeglects: {},
      crisisFixations: []
    };
    this.activeAlerts.clear();
    this.alertResponseTimes = [];
    this.customEvents = [];
    this.performanceMetrics = {
      trackingDuration: 0,
      sampleCount: 0,
      memoryWarnings: 0
    };
  }

  _calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _calculateTotalDistance() {
    let total = 0;
    for (let i = 1; i < this.mouseMovements.length; i++) {
      total += this._calculateDistance(
        this.mouseMovements[i - 1],
        this.mouseMovements[i]
      );
    }
    return total;
  }

  _calculateStdDev(values) {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    };
  }

  _estimateMemoryUsage() {
    // Rough estimate in KB
    const mouseSize = this.mouseMovements.length * 0.1; // ~100 bytes per sample
    const clickSize = this.clickEvents.length * 0.2; // ~200 bytes per click
    const alertSize = this.alertInteractions.length * 0.3; // ~300 bytes per interaction

    return {
      mouseSamples: mouseSize,
      clickEvents: clickSize,
      alertInteractions: alertSize,
      total: mouseSize + clickSize + alertSize,
      unit: 'KB'
    };
  }

  _convertToCSV(data) {
    // Basic CSV conversion (can be expanded)
    const csvSections = [];

    // Mouse movements
    if (data.tracking.mouseMovements) {
      const headers = ['timestamp', 'x', 'y', 'velocity', 'region'];
      const rows = data.tracking.mouseMovements.map(m =>
        [m.timestamp, m.x, m.y, m.velocity, m.region || ''].join(',')
      );
      csvSections.push(
        'MOUSE_MOVEMENTS',
        headers.join(','),
        ...rows,
        ''
      );
    }

    // Click events
    if (data.tracking.clickEvents) {
      const headers = ['timestamp', 'type', 'button', 'x', 'y', 'region'];
      const rows = data.tracking.clickEvents.map(c =>
        [c.timestamp, c.type, c.button, c.x, c.y, c.region || ''].join(',')
      );
      csvSections.push(
        'CLICK_EVENTS',
        headers.join(','),
        ...rows,
        ''
      );
    }

    return csvSections.join('\n');
  }

  _log(level, message) {
    if (this.config.enableDebugMode) {
      console[level](`[BehavioralTracker] ${message}`);
    }
  }
}

// Export singleton instance and class
const behavioralTracker = new BehavioralTracker();

export default behavioralTracker;
export { BehavioralTracker };
