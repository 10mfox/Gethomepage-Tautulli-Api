const express = require('express');
const axios = require('axios');
const path = require('path');
const logger = require('./logger');
const { userRouter } = require('./src/api/users');
const { mediaRouter } = require('./src/api/media');
const { libraryRouter } = require('./src/api/libraries');
const { initSettings, getSettings } = require('./src/services/settings');

const app = express();
const PORT = process.env.TAUTULLI_CUSTOM_PORT || 3010;

// Global config object
const config = {
  baseUrl: process.env.TAUTULLI_BASE_URL?.replace(/\/+$/, ''),
  apiKey: process.env.TAUTULLI_API_KEY
};

// Format helper functions
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatTitle(item, format, type) {
  if (!format?.title) {
    return type === 'shows' 
      ? `${item.grandparent_title} - S${String(item.parent_media_index).padStart(2, '0')}E${String(item.media_index).padStart(2, '0')} - ${item.title}`
      : `${item.title} (${item.year})`;
  }

  const formattedItem = {
    ...item,
    duration: formatDuration(parseInt(item.duration || 0))
  };

  let result = format.title;
  const variables = {
    title: formattedItem.title || '',
    year: formattedItem.year || '',
    grandparent_title: formattedItem.grandparent_title || '',
    parent_media_index: String(formattedItem.parent_media_index || '').padStart(2, '0'),
    media_index: String(formattedItem.media_index || '').padStart(2, '0'),
    duration: formattedItem.duration,
    ...formattedItem
  };

  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\$\{${key}}`, 'g'), value || '');
  });

  return result;
}

function formatTimeDifference(timestamp) {
  if (!timestamp) return 'Never';
  
  const now = Math.floor(Date.now() / 1000);
  const diffInSeconds = Math.abs(now - timestamp);
  
  if (diffInSeconds < 60) return 'Just Now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
  return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
}

function formatDuration(ms) {
  if (!ms) return '';
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) {
    return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ''}`;
  }
  return `${remainingMinutes}m`;
}

function capitalizeWords(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

// Middleware
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
app.use('/api/libraries', libraryRouter);

// Recent media endpoints
app.get('/api/recent/:type(shows|movies)/:sectionId?', async (req, res) => {
  try {
    const { type, sectionId } = req.params;
    const { count = 5 } = req.query;
    const settings = await getSettings();
    const formats = settings.mediaFormats || {};

    if (!config.baseUrl || !config.apiKey) {
      return res.status(500).json({
        response: {
          result: 'error',
          message: 'Tautulli configuration missing',
          data: []
        }
      });
    }

    const configuredSections = settings.sections?.[type] || [];
    
    if (sectionId) {
      const section = parseInt(sectionId);
      if (!configuredSections.includes(section)) {
        return res.status(404).json({
          response: {
            result: 'error',
            message: `Section ${sectionId} not configured for ${type}`,
            data: []
          }
        });
      }

      const response = await axios.get(`${config.baseUrl}/api/v2`, {
        params: {
          apikey: config.apiKey,
          cmd: 'get_recently_added',
          section_id: section,
          count: parseInt(count)
        }
      });

      const items = response.data?.response?.data?.recently_added || [];
      const format = formats?.[type]?.[section];
      
      const formattedItems = items.map(item => ({
        media_type: type,
        section_id: section,
        added: formatTimeDifference(item.added_at),
        title: formatTitle(item, format, type),
        added_at: item.added_at
      })).sort((a, b) => b.added_at - a.added_at);

      return res.json({
        response: {
          result: 'success',
          message: '',
          data: formattedItems,
          section: section
        }
      });
    }

    if (configuredSections.length === 0) {
      return res.json({
        response: {
          result: 'success',
          message: `No ${type} sections configured`,
          data: []
        }
      });
    }

    // Fetch data for all sections
    const promises = configuredSections.map(section =>
      axios.get(`${config.baseUrl}/api/v2`, {
        params: {
          apikey: config.apiKey,
          cmd: 'get_recently_added',
          section_id: section,
          count: parseInt(count)
        }
      }).catch(error => {
        console.error(`Error fetching section ${section}:`, error.message);
        return { data: { response: { data: { recently_added: [] } } } };
      })
    );

    const responses = await Promise.all(promises);
    
    let allItems = [];
    responses.forEach((response, index) => {
      const items = response.data?.response?.data?.recently_added || [];
      const section = configuredSections[index];
      const format = formats?.[type]?.[section];
      
      items.forEach(item => {
        allItems.push({
          media_type: type,
          section_id: section,
          added: formatTimeDifference(item.added_at),
          title: formatTitle(item, format, type),
          added_at: item.added_at
        });
      });
    });

    allItems.sort((a, b) => b.added_at - a.added_at);
    allItems = allItems.slice(0, parseInt(count));

    res.json({
      response: {
        result: 'success',
        message: '',
        data: allItems,
        sections: configuredSections
      }
    });

  } catch (error) {
    console.error(`Error fetching ${req.params.type}:`, error.message);
    res.status(500).json({
      response: {
        result: 'error',
        message: `Failed to fetch ${req.params.type}`,
        error: error.message
      }
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API settings endpoint
app.get('/api/config', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      baseUrl: config.baseUrl,
      sections: settings.sections || {},
      formats: settings.mediaFormats || {}
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// Static files middleware - must come after API routes
app.use(express.static(path.join(__dirname, 'frontend', 'build')));

// Catch-all route for React frontend - must be last
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'build', 'index.html'));
});

// Initialize settings and start server
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