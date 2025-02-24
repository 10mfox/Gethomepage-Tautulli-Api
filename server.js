const express = require('express');
const path = require('path');
const os = require('os');
const logger = require('./logger');
const axios = require('axios');
const { userRouter } = require('./src/api/users');
const { mediaRouter } = require('./src/api/media');
const { initSettings, getSettings, saveSettings } = require('./src/services/settings');
const { initializeCache, startBackgroundUpdates } = require('./src/services/init');

// Function to get local IP address
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

app.use(express.json());
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

app.post('/api/cache/clear', (req, res) => {
  initializeCache()
    .then(() => res.json({ success: true }))
    .catch(error => res.status(500).json({ error: error.message }));
});

app.get('/api/health', async (req, res) => {
  try {
    const settings = await getSettings();
    const { TAUTULLI_BASE_URL: baseUrl, TAUTULLI_API_KEY: apiKey } = settings.env;
    
    let status = 'ok';
    let configured = true;
    let message = null;

    if (!baseUrl || !apiKey) {
      status = 'unconfigured';
      configured = false;
      message = 'Tautulli connection not configured';
    }

    res.json({ 
      status,
      configured,
      message,
      server_time: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to check configuration status'
    });
  }
});

// Fast connection testing endpoint
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

// Serve static frontend
app.use(express.static(path.join(__dirname, 'frontend', 'build')));

// Handle all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

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