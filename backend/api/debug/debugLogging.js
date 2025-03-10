/**
 * Debug logging control endpoints
 * Provides endpoints for managing verbose logging settings
 * @module api/debug/debugLogging
 */
const express = require('express');
const { logError } = require('../../../logger');

const router = express.Router();

/**
 * Toggle verbose logging
 * 
 * @route POST /api/debug/toggle-verbose-logging
 */
router.post('/toggle-verbose-logging', async (req, res) => {
  try {
    const cacheService = require('../../services/cacheService');
    // Use the provided method to get the current state
    const currentState = cacheService.isVerboseLoggingEnabled();
    // Toggle the state using the method
    const newState = cacheService.toggleVerboseLogging();
    
    res.json({
      success: true,
      enabled: newState,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logError('Toggle Verbose Logging', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = { loggingRoutes: router };