const express = require('express');
const { getSettings, saveSettings } = require('../services/settings');
const cache = require('../services/cache');
const { tautulliService } = require('../services/tautulli');

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

// Helper function to process library data
async function getLibraryData() {
  try {
    const response = await tautulliService.makeRequest('get_libraries_table');
    if (!response?.response?.data?.data) {
      throw new Error('Invalid library data format');
    }

    const settings = await getSettings();
    const configuredSections = {
      movies: settings.sections?.movies || [],
      shows: settings.sections?.shows || []
    };

    // Process sections and mark configured ones
    const sections = response.response.data.data
      .map(library => {
        const isConfigured = library.section_type === 'movie' ? 
          configuredSections.movies.includes(library.section_id) :
          library.section_type === 'show' ? 
          configuredSections.shows.includes(library.section_id) : 
          false;

        return {
          section_name: library.section_name,
          section_type: library.section_type,
          count: parseInt(library.count) || 0,
          section_id: parseInt(library.section_id), // Ensure numeric sorting
          count_formatted: new Intl.NumberFormat().format(parseInt(library.count) || 0),
          configured: isConfigured,
          ...(library.section_type === 'show' ? {
            parent_count: parseInt(library.parent_count) || 0,
            child_count: parseInt(library.child_count) || 0,
            parent_count_formatted: new Intl.NumberFormat().format(parseInt(library.parent_count) || 0),
            child_count_formatted: new Intl.NumberFormat().format(parseInt(library.child_count) || 0)
          } : {})
        };
      })
      .sort((a, b) => a.section_id - b.section_id); // Sort by section ID

    // Calculate totals
    const totals = {
      movies: { sections: 0, total_items: 0, total_items_formatted: '0' },
      shows: { sections: 0, total_items: 0, total_items_formatted: '0', total_seasons: 0, total_seasons_formatted: '0', total_episodes: 0, total_episodes_formatted: '0' }
    };

    sections.forEach(library => {
      if (!library.configured) return;
      
      if (library.section_type === 'movie') {
        totals.movies.sections++;
        totals.movies.total_items += library.count;
      } else if (library.section_type === 'show') {
        totals.shows.sections++;
        totals.shows.total_items += library.count;
        totals.shows.total_seasons += library.parent_count;
        totals.shows.total_episodes += library.child_count;
      }
    });

    // Format total numbers
    totals.movies.total_items_formatted = new Intl.NumberFormat().format(totals.movies.total_items);
    totals.shows.total_items_formatted = new Intl.NumberFormat().format(totals.shows.total_items);
    totals.shows.total_seasons_formatted = new Intl.NumberFormat().format(totals.shows.total_seasons);
    totals.shows.total_episodes_formatted = new Intl.NumberFormat().format(totals.shows.total_episodes);

    return { sections, totals };
  } catch (error) {
    console.error('Library data error:', error);
    return {
      sections: [],
      totals: {
        movies: { sections: 0, total_items: 0, total_items_formatted: '0' },
        shows: { sections: 0, total_items: 0, total_items_formatted: '0', total_seasons: 0, total_seasons_formatted: '0', total_episodes: 0, total_episodes_formatted: '0' }
      }
    };
  }
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

// Unified media endpoint
router.get('/recent', async (req, res) => {
  try {
    const { type, count = 15, section } = req.query;
    
    // Ensure count doesn't exceed max
    const itemCount = Math.min(parseInt(count) || 15, 15);
    
    // Get settings and cached media data
    const settings = await getSettings();
    const formats = settings.mediaFormats || {};
    const cachedMedia = cache.get('recent_media');
    
    if (!cachedMedia) {
      throw new Error('Media data not available');
    }

    // Determine which types to include
    const validTypes = ['shows', 'movies'];
    let typesToInclude = type ? 
      type.split(',').filter(t => validTypes.includes(t)) : 
      validTypes;

    if (typesToInclude.length === 0) {
      throw new Error('No valid media types specified');
    }

    // Get all sections for included types
    const sectionsToUse = {};
    typesToInclude.forEach(mediaType => {
      const configuredSections = settings.sections?.[mediaType] || [];
      // Filter by section if provided
      if (section) {
        const requestedSections = section.split(',').map(s => parseInt(s.trim()));
        sectionsToUse[mediaType] = configuredSections.filter(s => requestedSections.includes(s));
      } else {
        sectionsToUse[mediaType] = configuredSections;
      }
    });

    // Get all media items in a single array
    const allItems = [];
    
    typesToInclude.forEach(mediaType => {
      const relevantMedia = cachedMedia.filter(
        item => item.type === mediaType && sectionsToUse[mediaType].includes(item.sectionId)
      );

      relevantMedia.forEach(section => {
        const formatFields = formats[mediaType]?.[section.sectionId]?.fields || [];
        const items = section.data
          .map(item => ({
            ...formatItem(item, formatFields),
            added_at: parseInt(item.added_at),
            media_type: mediaType,
            section_id: section.sectionId
          }))
          .slice(0, itemCount); // Limit items per section

        allItems.push(...items);
      });
    });

    // Sort all items by added_at and take top items
    const sortedItems = allItems.sort((a, b) => b.added_at - a.added_at);

    // Get library data
    const libraryData = await getLibraryData();

    res.json({
      response: {
        result: 'success',
        data: sortedItems,
        libraries: libraryData
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