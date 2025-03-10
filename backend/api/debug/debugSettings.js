/**
 * Debug settings operations endpoints
 * Provides endpoints for managing application settings
 * @module api/debug/debugSettings
 */
const express = require('express');
const { saveSettings, defaultSettings } = require('../../services/settings');
const { logError, log } = require('../../../logger');

const router = express.Router();

/**
 * Reset settings to default values
 * 
 * @route POST /api/debug/reset-settings
 */
router.post('/reset-settings', async (req, res) => {
  try {
    log('Settings reset requested from debug endpoint');
    
    // Save default settings
    await saveSettings(defaultSettings);
    
    // Force cache refresh after settings reset
    await require('../../services/cacheService').initializeCache();
    
    res.json({
      success: true,
      message: "All settings have been reset to default values",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logError('Settings Reset', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = { settingsRoutes: router };