const express = require('express');
const path = require('path');
const os = require('os');
const logger = require('./logger');
const { userRouter } = require('./src/api/users');
const { mediaRouter } = require('./src/api/media');
const { libraryRouter } = require('./src/api/libraries');
const { initSettings, getSettings } = require('./src/services/settings');
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

const config = {
  baseUrl: process.env.TAUTULLI_BASE_URL?.replace(/\/+$/, ''),
  baseHttpsUrl: process.env.TAUTULLI_BASE_HTTPS_URL?.replace(/\/+$/, ''),
  apiKey: process.env.TAUTULLI_API_KEY,
  localIp: getLocalIpAddress()
};

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
app.use('/api/recent', mediaRouter);  // Keep old path for backward compatibility
app.use('/api/media', mediaRouter);   // New path
app.use('/api/libraries', libraryRouter);

app.post('/api/cache/clear', (req, res) => {
  initializeCache()
    .then(() => res.json({ success: true }))
    .catch(error => res.status(500).json({ error: error.message }));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/config', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      baseUrl: config.baseUrl,
      port: process.env.TAUTULLI_CUSTOM_PORT || 3010,
      localIp: config.localIp,
      sections: settings.sections || {},
      formats: settings.mediaFormats || {}
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load configuration' });
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

    // Initialize cache with initial data
    logger.log('Initializing cache with initial data...');
    const cacheInitialized = await initializeCache();
    if (!cacheInitialized) {
      throw new Error('Failed to initialize cache');
    }

    // Start background updates
    startBackgroundUpdates();
    
    // Start the server
    app.listen(PORT, () => {
      logger.logServerStart(PORT, {
        baseUrl: config.baseUrl,
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