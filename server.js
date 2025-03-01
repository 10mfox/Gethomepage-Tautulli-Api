/**
 * Main application server for Tautulli Unified Manager
 * Handles API routes, static file serving, and server initialization
 * @module server
 */
const express = require('express');
const path = require('path');
const os = require('os');
const compression = require('compression');
const logger = require('./logger');
const axios = require('axios');
const { userRouter } = require('./backend/api/users');
const { mediaRouter } = require('./backend/api/media');
const { initSettings, getSettings, saveSettings } = require('./backend/services/settings');
const { cache, initializeCache, startBackgroundUpdates } = require('./backend/services/cacheService');

/**
 * Gets the local IP address of the server
 * Searches network interfaces for the first non-internal IPv4 address
 * 
 * @returns {string} Local IP address or 127.0.0.1 if none found
 */
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

const app = express();
const PORT = process.env.TAUTULLI_CUSTOM_PORT || 3010;

// Compression middleware - apply to all routes
app.use(compression({
  level: 6, // Balanced compression level (1-9, where 9 is max compression but slower)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Skip compression for already compressed assets
    if (req.headers['content-type'] && 
        (req.headers['content-type'].includes('image/') || 
         req.headers['content-type'].includes('video/'))) {
      return false;
    }
    // Apply compression for everything else
    return compression.filter(req, res);
  }
}));

app.use(express.json());

/**
 * Cache control middleware
 * Sets appropriate cache headers based on route patterns
 */
app.use((req, res, next) => {
  // Only apply cache headers to GET requests
  if (req.method === 'GET') {
    if (req.path.startsWith('/api/media/recent')) {
      // Media data can be cached longer
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    } else if (req.path.startsWith('/api/users')) {
      // User activity changes more frequently
      res.setHeader('Cache-Control', 'public, max-age=60'); // 1 minute
    } else if (req.path.startsWith('/api/health') || req.path.startsWith('/api/config')) {
      // Configuration and health checks should not be cached
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else if (req.path.startsWith('/static/')) {
      // Static assets can be cached longer
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
  }
  next();
});

/**
 * Request logger middleware
 * Logs HTTP method, path, status code, and request duration
 */
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req.method, req.originalUrl, res.statusCode, duration);
  });
  next();
});

// API Routes
app.use('/api/users', userRouter);
app.use('/api/media', mediaRouter);

/**
 * Clear cache endpoint
 * 
 * @route POST /api/cache/clear
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
app.post('/api/cache/clear', (req, res) => {
  initializeCache()
    .then(() => res.json({ success: true }))
    .catch(error => res.status(500).json({ error: error.message }));
});

/**
 * Get cache statistics endpoint
 * 
 * @route GET /api/cache/stats
 * @param {Object} req - Express request object 
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with cache statistics
 */
app.get('/api/cache/stats', (req, res) => {
  const stats = cache.getStats();
  const hitRate = cache.getHitRate();
  const lastUpdated = cache.getLastSuccessfulTimestamp();
  const keys = cache.keys();
  
  res.json({
    keys: keys.length,
    keyList: keys,
    hits: stats.hits,
    misses: stats.misses,
    hitRate: hitRate.hitRate,
    lastUpdated: lastUpdated ? new Date(lastUpdated).toISOString() : null
  });
});

/**
 * Health check endpoint
 * Verifies Tautulli connection configuration
 * 
 * @route GET /api/health
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with health status
 */
app.get('/api/health', async (req, res) => {
  try {
    const settings = await getSettings();
    const { TAUTULLI_BASE_URL: baseUrl, TAUTULLI_API_KEY: apiKey } = settings.env;
    
    let status = 'ok';
    let configured = true;
    let message = null;
    let cacheHealth = {};

    if (!baseUrl || !apiKey) {
      status = 'unconfigured';
      configured = false;
      message = 'Tautulli connection not configured';
    }

    // Add cache health information
    if (configured) {
      const cacheStats = cache.getStats();
      const hitRate = cache.getHitRate();
      cacheHealth = {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: hitRate.hitRate,
        lastUpdated: cache.getLastSuccessfulTimestamp() || null
      };
    }

    res.json({ 
      status,
      configured,
      message,
      cache: cacheHealth,
      server_time: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to check configuration status'
    });
  }
});

/**
 * Test Tautulli connection endpoint
 * Verifies connection to Tautulli API server
 * 
 * @route POST /api/test-connection
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.baseUrl - Tautulli base URL to test
 * @param {string} req.body.apiKey - Tautulli API key to test
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating connection success or failure
 */
app.post('/api/test-connection', async (req, res) => {
  const { baseUrl, apiKey } = req.body;
  
  if (!baseUrl || !apiKey) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing baseUrl or apiKey' 
    });
  }

  try {
    // Use a lightweight API command for fast response
    const testUrl = `${baseUrl}/api/v2?apikey=${encodeURIComponent(apiKey)}&cmd=get_server_info`;
    
    // Set a short timeout (3 seconds)
    const response = await axios.get(testUrl, {
      timeout: 3000
    });
    
    // Verify we got a valid response
    if (response.data?.response?.result === 'success') {
      return res.json({ success: true });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid Tautulli response'
      });
    }
  } catch (error) {
    console.error('Tautulli connection test failed:', error.message);
    let errorMessage = 'Failed to connect to Tautulli';
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Connection timed out. Please check the URL and try again.';
    } else if (error.response) {
      errorMessage = `Tautulli returned error: ${error.response.status}`;
    } else if (error.request) {
      errorMessage = 'No response from server. Please check the URL.';
    }
    
    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * Get configuration endpoint
 * Returns system configuration including Tautulli settings
 * 
 * @route GET /api/config
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with system configuration
 */
app.get('/api/config', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      baseUrl: settings.env.TAUTULLI_BASE_URL || '',
      apiKey: settings.env.TAUTULLI_API_KEY || '',
      port: process.env.TAUTULLI_CUSTOM_PORT || 3010,
      localIp: getLocalIpAddress(),
      sections: settings.sections || {},
      formats: settings.mediaFormats || {}
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

/**
 * Update configuration endpoint
 * Saves Tautulli connection settings
 * 
 * @route POST /api/config
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.baseUrl - Tautulli base URL
 * @param {string} req.body.apiKey - Tautulli API key
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
app.post('/api/config', express.json(), async (req, res) => {
  try {
    const { baseUrl, apiKey } = req.body;
    
    // Get current settings
    const settings = await getSettings();
    
    // Update environment settings
    settings.env = {
      ...settings.env,
      TAUTULLI_BASE_URL: baseUrl?.replace(/\/+$/, '') || '',
      TAUTULLI_API_KEY: apiKey || ''
    };
    
    // Save settings to file
    await saveSettings(settings);

    // Force cache refresh
    await initializeCache();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static frontend with cache headers
app.use(express.static(path.join(__dirname, 'frontend', 'build'), {
  maxAge: '1d', // Cache static assets for 1 day
  etag: true,    // Enable ETag for efficient caching
  lastModified: true
}));

/**
 * Catch-all route for SPA
 * Serves the React frontend for all other routes
 * 
 * @route GET *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

/**
 * Starts the server and initializes required services
 * Sets up settings, cache, and background updates
 * 
 * @async
 */
async function startServer() {
  try {
    // Initialize settings first
    await initSettings();
    const settings = await getSettings();

    // Set environment variables from settings
    if (settings.env) {
      process.env.TAUTULLI_BASE_URL = settings.env.TAUTULLI_BASE_URL || '';
      process.env.TAUTULLI_API_KEY = settings.env.TAUTULLI_API_KEY || '';
    }

    // Initialize cache but don't fail if it doesn't succeed
    logger.log('Initializing cache with initial data...');
    try {
      await initializeCache();
    } catch (error) {
      logger.logError('Cache Initialization', error);
      // Continue server startup
    }

    // Start background updates
    startBackgroundUpdates();
    
    // Start the server
    app.listen(PORT, () => {
      logger.logServerStart(PORT, {
        baseUrl: settings.env.TAUTULLI_BASE_URL || null,
        sections: settings.sections || {}
      });
    });
  } catch (error) {
    logger.logError('Server Startup', error);
    process.exit(1);
  }
}

// Start the server
startServer();