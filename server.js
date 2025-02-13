const express = require('express');
const axios = require('axios');
const path = require('path');
const NodeCache = require('node-cache');
const logger = require('./logger');
const { userRouter } = require('./src/api/users');
const { mediaRouter } = require('./src/api/media');
const { libraryRouter } = require('./src/api/libraries');
const { initSettings, getSettings } = require('./src/services/settings');

const app = express();
const PORT = process.env.TAUTULLI_CUSTOM_PORT || 3010;
const CACHE_TTL = 30;
const RESULTS_PER_SECTION = 15;
const BATCH_SIZE = 10;
const cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 60 });

const config = {
  baseUrl: process.env.TAUTULLI_BASE_URL?.replace(/\/+$/, ''),
  apiKey: process.env.TAUTULLI_API_KEY
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

app.use('/api/users', userRouter);
app.use('/api/recent', mediaRouter);  // Keep old path for backward compatibility
app.use('/api/media', mediaRouter);   // New path
app.use('/api/libraries', libraryRouter);

app.post('/api/cache/clear', (req, res) => {
  cache.flushAll();
  res.json({ success: true });
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
      sections: settings.sections || {},
      formats: settings.mediaFormats || {}
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

app.use(express.static(path.join(__dirname, 'frontend', 'build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

async function startServer() {
  try {
    await initSettings();
    const settings = await getSettings();
    
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

startServer();