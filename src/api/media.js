const express = require('express');
const { getSettings, saveSettings } = require('../services/settings');
const cache = require('../services/cache');

const router = express.Router();

// Format duration from Plex runtime to human readable string
function formatDuration(duration) {
  if (!duration) return '';
  
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

// Format relative time
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

// Format short date
function formatShortDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  });
}

// Format a single item based on format fields
function formatItem(item, formatFields) {
  if (!formatFields?.length) {
    return {};
  }

  const formattedDuration = formatDuration(item.duration);
  const timestamp = parseInt(item.added_at);

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
      added_at_relative: formatRelativeTime(timestamp),
      added_at_short: formatShortDate(timestamp)
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
    
    // Get settings and cached media data
    const settings = await getSettings();
    const configuredSections = settings.sections?.[type] || [];
    const formats = settings.mediaFormats?.[type] || {};
    
    const cachedMedia = cache.get('recent_media');
    if (!cachedMedia) {
      throw new Error('Media data not available');
    }

    // Handle single section request
    if (sectionId) {
      const section = parseInt(sectionId);
      if (!configuredSections.includes(section)) {
        throw new Error(`Section ${sectionId} not configured for ${type}`);
      }

      const sectionData = cachedMedia.find(
        item => item.type === type && item.sectionId === section
      );

      const formatFields = formats?.[section]?.fields || [];
      const formattedItems = (sectionData?.data || [])
        .slice(0, parseInt(count))
        .map(item => formatItem(item, formatFields));

      return res.json({
        response: {
          result: 'success',
          data: formattedItems,
          section
        }
      });
    }

    // Handle all sections request
    const relevantMedia = cachedMedia.filter(
      item => item.type === type && configuredSections.includes(item.sectionId)
    );

    const allItems = relevantMedia.flatMap(section => 
      section.data.map(item => ({ ...item, section_id: section.sectionId.toString() }))
    );

    const sortedItems = allItems
      .sort((a, b) => parseInt(b.added_at) - parseInt(a.added_at))
      .slice(0, parseInt(count));

    const formattedItems = sortedItems.map(item => 
      formatItem(item, formats?.[item.section_id]?.fields || [])
    );

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