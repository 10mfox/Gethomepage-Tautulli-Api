/**
 * Debug cache operation endpoints
 * Provides endpoints for cache refreshing, clearing, and settings
 * @module api/debug/debugCache
 */
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { cache } = require('../../services/cacheService');
const { logError, log, colors } = require('../../../logger');

const router = express.Router();

/**
 * Force refresh all data with improved feedback
 * 
 * @route POST /api/debug/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    log('Force refresh requested from debug endpoint');
    const startTime = Date.now();
    await require('../../services/cacheService').initializeCache();
    const duration = Date.now() - startTime;
    
    res.json({ 
      success: true, 
      message: "Successfully refreshed all cache data",
      timestamp: new Date().toISOString(),
      durationMs: duration
    });
  } catch (error) {
    logError('Debug Force Refresh', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Force refresh specific cache data with improved feedback
 * 
 * @route POST /api/debug/refresh/:key
 * @param {string} key - Cache key to refresh (users, libraries, recent_media)
 */
router.post('/refresh/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const validKeys = ['users', 'libraries', 'recent_media'];
    
    if (!key || !validKeys.includes(key)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid cache key. Must be one of: ${validKeys.join(', ')}`,
        validKeys: validKeys
      });
    }
    
    log(`Force refresh requested for ${key} from debug endpoint`);
    const startTime = Date.now();
    const success = await cache.forceUpdate(key);
    const duration = Date.now() - startTime;
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Successfully refreshed ${key} data`,
        timestamp: new Date().toISOString(),
        durationMs: duration
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: `Failed to refresh ${key} data. The service may not be properly configured.`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logError('Debug Force Refresh', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Clear entire cache
 * 
 * @route POST /api/debug/clear-cache
 */
router.post('/clear-cache', async (req, res) => {
  try {
    log('Cache clear requested from debug endpoint');
    cache.flushAll();
    
    res.json({
      success: true,
      message: "Cache cleared successfully",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logError('Cache Clear', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Update cache settings with immediate application
 * Modified to simply return a message that cache settings are fixed
 * 
 * @route POST /api/debug/cache-settings
 */
router.post('/cache-settings', async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Cache settings are now fixed at 60-second refresh intervals for optimal performance.",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logError('Cache Settings Update', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = { cacheRoutes: router };