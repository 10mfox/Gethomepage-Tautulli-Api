const express = require('express');
const axios = require('axios');
const { getSettings, saveSettings } = require('../services/settings');

const router = express.Router();

// Format duration from Plex runtime to human readable string
function formatDuration(duration) {
  if (!duration) return '';
  
  // Convert to seconds (divide by 1000)
  const seconds = Math.floor(parseInt(duration) / 1000);
  const minutes = Math.floor(seconds / 60);
  
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
}

// Format timestamp to relative time
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

// Format timestamp to short date
function formatShortDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Get metadata for a specific item
async function getItemMetadata(ratingKey, baseUrl, apiKey) {
  try {
    const response = await axios.get(`${baseUrl}/api/v2`, {
      params: {
        apikey: apiKey,
        cmd: 'get_metadata',
        rating_key: ratingKey
      }
    });
    
    const metadata = response.data?.response?.data;
    return {
      content_rating: metadata?.content_rating || '',
      video_resolution: metadata?.media_info?.[0]?.video_full_resolution || metadata?.media_info?.[0]?.video_resolution || ''
    };
  } catch (error) {
    console.error(`Error fetching metadata for item ${ratingKey}:`, error.message);
    return { content_rating: '', video_resolution: '' };
  }
}

// Format a single item based on format fields
function formatItem(item, formatFields) {
  // Return empty object if no format fields configured
  if (!formatFields?.length) {
    return {};
  }

  // Format duration before template processing
  const formattedDuration = formatDuration(item.duration);

  // Apply format fields
  const result = {};
  formatFields.forEach(field => {
    if (!field.id || !field.template) return;

    let value = field.template;
    const variables = {
      title: item.title || '',
      year: item.year || '',
      grandparent_title: item.grandparent_title || '',
      parent_media_index: String(item.parent_media_index || '').padStart(2, '0'),
      media_index: String(item.media_index || '').padStart(2, '0'),
      duration: formattedDuration,
      content_rating: item.content_rating || '',
      video_resolution: item.video_resolution || '',
      added_at_relative: item.added_at_relative || '',
      added_at_short: item.added_at_short || ''
    };

    Object.entries(variables).forEach(([key, val]) => {
      value = value.replace(new RegExp(`\\$\{${key}}`, 'g'), val || '');
    });

    result[field.id] = value;
  });

  return result;
}

// Get media settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      formats: settings.mediaFormats || {},
      sections: settings.sections || { shows: [], movies: [] }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load media settings' });
  }
});

// Save media settings
router.post('/settings', async (req, res) => {
  try {
    const { sections, formats } = req.body;
    const settings = await getSettings();

    await saveSettings({
      ...settings,
      sections: sections || { shows: [], movies: [] },
      mediaFormats: formats || {}
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save media settings' });
  }
});

// Get recently added media
router.get('/:type(shows|movies)/:sectionId?', async (req, res) => {
  try {
    const { type, sectionId } = req.params;
    const { count = 5 } = req.query;
    
    // Get settings
    const settings = await getSettings();
    const configuredSections = settings.sections?.[type] || [];
    const formats = settings.mediaFormats?.[type] || {};

    // Verify Tautulli configuration
    if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
      throw new Error('Tautulli configuration missing');
    }

    const baseUrl = process.env.TAUTULLI_BASE_URL.replace(/\/+$/, '');
    const apiKey = process.env.TAUTULLI_API_KEY;

    // Handle single section request
    if (sectionId) {
      const section = parseInt(sectionId);
      if (!configuredSections.includes(section)) {
        throw new Error(`Section ${sectionId} not configured for ${type}`);
      }

      const response = await axios.get(`${baseUrl}/api/v2`, {
        params: {
          apikey: apiKey,
          cmd: 'get_recently_added',
          section_id: section,
          count: parseInt(count)
        }
      });

      const items = response.data?.response?.data?.recently_added || [];
      const formatFields = formats?.[section]?.fields || [];

      const formattedItems = await Promise.all(items.map(async (item) => {
        const metadata = await getItemMetadata(item.rating_key, baseUrl, apiKey);
        const added_at = parseInt(item.added_at);

        return formatItem({
          ...item,
          ...metadata,
          added_at_relative: formatRelativeTime(added_at),
          added_at_short: formatShortDate(added_at)
        }, formatFields);
      }));

      return res.json({
        response: {
          result: 'success',
          data: formattedItems,
          section
        }
      });
    }

    // Handle all sections request
    const promises = configuredSections.map(section =>
      axios.get(`${baseUrl}/api/v2`, {
        params: {
          apikey: apiKey,
          cmd: 'get_recently_added',
          section_id: section,
          count: parseInt(count)
        }
      }).catch(() => ({
        data: { response: { data: { recently_added: [] } } }
      }))
    );

    const responses = await Promise.all(promises);
    const allItems = responses.flatMap((response, index) => {
      const sectionId = configuredSections[index];
      const items = response.data?.response?.data?.recently_added || [];
      return items.map(item => ({ ...item, section_id: sectionId.toString() }));
    });

    const sortedItems = allItems
      .sort((a, b) => parseInt(b.added_at) - parseInt(a.added_at))
      .slice(0, parseInt(count));

    const formattedItems = await Promise.all(sortedItems.map(async (item) => {
      const metadata = await getItemMetadata(item.rating_key, baseUrl, apiKey);
      const added_at = parseInt(item.added_at);

      return formatItem({
        ...item,
        ...metadata,
        added_at_relative: formatRelativeTime(added_at),
        added_at_short: formatShortDate(added_at)
      }, formats?.[item.section_id]?.fields || []);
    }));

    res.json({
      response: {
        result: 'success',
        data: formattedItems,
        sections: configuredSections
      }
    });

  } catch (error) {
    res.status(500).json({
      response: {
        result: 'error',
        message: error.message
      }
    });
  }
});

module.exports = { mediaRouter: router };