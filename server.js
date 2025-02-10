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

function formatTitle(item, format, type) {
  if (!format?.title) {
    return type === 'shows' 
      ? `${item.grandparent_title} - S${String(item.parent_media_index).padStart(2, '0')}E${String(item.media_index).padStart(2, '0')} - ${item.title}`
      : `${item.title} (${item.year})`;
  }

  const formattedItem = {
    ...item,
    duration: formatDuration(parseInt(item.duration || 0)),
    video_resolution: item.media_info?.[0]?.video_full_resolution || item.media_info?.[0]?.video_resolution || '',
    parent_media_index: String(item.parent_media_index || '').padStart(2, '0'),
    media_index: String(item.media_index || '').padStart(2, '0')
  };

  let result = format.title;
  const variables = {
    title: formattedItem.title || '',
    year: formattedItem.year || '',
    grandparent_title: formattedItem.grandparent_title || '',
    parent_media_index: formattedItem.parent_media_index,
    media_index: formattedItem.media_index,
    duration: formattedItem.duration,
    content_rating: formattedItem.content_rating || '',
    video_resolution: formattedItem.video_resolution || '',
    ...formattedItem
  };

  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\$\{${key}}`, 'g'), value || '');
  });

  return result;
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

// Helper function to get metadata for a specific item
async function getItemMetadata(ratingKey, baseUrl, apiKey) {
  try {
    const metadata = await axios.get(`${baseUrl}/api/v2`, {
      params: {
        apikey: apiKey,
        cmd: 'get_metadata',
        rating_key: ratingKey
      }
    });
    
    return metadata.data?.response?.data;
  } catch (error) {
    console.error(`Error fetching metadata for item ${ratingKey}:`, error.message);
    return null;
  }
}

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
      
      const itemsWithMetadata = await Promise.all(
        items.map(async (item) => {
          const metadataInfo = await getItemMetadata(item.rating_key, config.baseUrl, config.apiKey);
          const added_at = parseInt(item.added_at);

          return {
            media_type: type,
            section_id: section.toString(), // Ensure section_id is a string
            title: formatTitle(item, formats?.[type]?.[section], type),
            content_rating: metadataInfo?.content_rating || '',
            video_resolution: metadataInfo?.media_info?.[0]?.video_full_resolution || metadataInfo?.media_info?.[0]?.video_resolution || '',
            added_at_relative: formatTimeDifference(added_at),
            added_at_short: new Date(added_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          };
        })
      );

      return res.json({
        response: {
          result: 'success',
          message: '',
          data: itemsWithMetadata,
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

    // Make the request number larger to ensure we get enough items after sorting
    const requestCount = parseInt(count) * configuredSections.length;

    const promises = configuredSections.map(section =>
      axios.get(`${config.baseUrl}/api/v2`, {
        params: {
          apikey: config.apiKey,
          cmd: 'get_recently_added',
          section_id: section,
          count: requestCount
        }
      }).catch(error => {
        console.error(`Error fetching section ${section}:`, error.message);
        return { 
          data: { 
            response: { 
              data: { 
                recently_added: [],
                section_id: section  // Preserve section ID even in error case
              } 
            } 
          },
          section_id: section // Additional backup of section ID
        };
      })
    );

    // Get items from all sections first
    const responses = await Promise.all(promises);
    
    // Collect all items and add section info
    let allRecentItems = [];
    responses.forEach((response, index) => {
      const items = response.data?.response?.data?.recently_added || [];
      const section = configuredSections[index]; // Get section from original array
      items.forEach(item => {
        allRecentItems.push({
          ...item,
          section_id: section.toString(), // Ensure section_id is a string and always present
          format: formats?.[type]?.[section]
        });
      });
    });

    // Sort all items by added_at before processing metadata
    allRecentItems.sort((a, b) => parseInt(b.added_at) - parseInt(a.added_at));

    // Take top N items
    allRecentItems = allRecentItems.slice(0, parseInt(count));

    // Now get metadata for only the items we need
    const itemsWithMetadata = await Promise.all(
      allRecentItems.map(async (item) => {
        const metadataInfo = await getItemMetadata(item.rating_key, config.baseUrl, config.apiKey);
        const added_at = parseInt(item.added_at);

        return {
          media_type: type,
          section_id: item.section_id, // Section ID is already a string from above
          title: formatTitle(item, item.format, type),
          content_rating: metadataInfo?.content_rating || '',
          video_resolution: metadataInfo?.media_info?.[0]?.video_full_resolution || metadataInfo?.media_info?.[0]?.video_resolution || '',
          added_at_relative: formatTimeDifference(added_at),
          added_at_short: new Date(added_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        };
      })
    );

    res.json({
      response: {
        result: 'success',
        message: '',
        data: itemsWithMetadata,
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