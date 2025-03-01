/**
 * Media API endpoint handler
 * Provides endpoints for retrieving and managing media data
 * @module api/media
 */
const express = require('express');
const { getSettings, saveSettings } = require('../services/settings');
const { cache } = require('../services/cacheService');
const { tautulliService } = require('../services/tautulli');

const router = express.Router();

// Cache TTLs and keys
const MEDIA_CACHE_TTL = 300; // 5 minutes
const RECENT_MEDIA_CACHE_PREFIX = 'recentMedia:';

/**
 * Format duration from Plex runtime to human readable string
 * Cached for performance with a memorization technique
 * 
 * @param {number} duration - Duration in milliseconds
 * @returns {string} Formatted duration string (e.g. "1h 30m")
 */
const durationCache = new Map();
function formatDuration(duration) {
  if (!duration) return '';
  
  // Check if we have a cached result
  const cachedResult = durationCache.get(duration);
  if (cachedResult) return cachedResult;
  
  // Calculate the formatted duration
  const seconds = Math.floor(parseInt(duration) / 1000);
  const minutes = Math.floor(seconds / 60);
  
  let result;
  if (minutes < 60) {
    result = `${minutes}m`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) {
      result = `${hours}h`;
    } else {
      result = `${hours}h ${remainingMinutes}m`;
    }
  }
  
  // Cache the result (limit cache size to prevent memory leaks)
  if (durationCache.size > 1000) {
    const firstKey = durationCache.keys().next().value;
    durationCache.delete(firstKey);
  }
  durationCache.set(duration, result);
  
  return result;
}

/**
 * Format relative time from timestamp with memoization
 * 
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Relative time string (e.g. "2h ago")
 */
const relativeTimeCache = new Map();
const RELATIVE_TIME_CACHE_TTL = 60000; // 1 minute in milliseconds

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  
  const now = Math.floor(Date.now() / 1000);
  const cacheKey = `${timestamp}:${Math.floor(now / 60)}`; // Update every minute
  
  // Check cache
  const cachedResult = relativeTimeCache.get(cacheKey);
  if (cachedResult) return cachedResult;
  
  const diff = Math.abs(now - timestamp);
  
  let result;
  if (diff < 60) result = 'Just now';
  else if (diff < 3600) result = `${Math.floor(diff / 60)}m ago`;
  else if (diff < 86400) result = `${Math.floor(diff / 3600)}h ago`;
  else if (diff < 604800) result = `${Math.floor(diff / 86400)}d ago`;
  else result = `${Math.floor(diff / 604800)}w ago`;
  
  // Clean up old cache entries
  const now_ms = Date.now();
  for (const [key, {value, timestamp}] of relativeTimeCache.entries()) {
    if (now_ms - timestamp > RELATIVE_TIME_CACHE_TTL) {
      relativeTimeCache.delete(key);
    }
  }
  
  // Store in cache with timestamp
  relativeTimeCache.set(cacheKey, result);
  
  return result;
}

/**
 * Format timestamp to short date string
 * 
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Short date string (e.g. "Jan 15")
 */
function formatShortDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  });
}

/**
 * Format a single media item based on format fields with performance optimizations
 * 
 * @param {Object} item - Media item object
 * @param {Array<Object>} formatFields - Format field definitions
 * @returns {Object} Formatted media item with all fields populated
 */
function formatItem(item, formatFields) {
  if (!formatFields?.length) {
    return {};
  }

  const formattedDuration = formatDuration(item.duration);
  const timestamp = parseInt(item.added_at);

  // For TV shows, prioritize the show thumbnail (grandparent) over episode thumbnail
  let ratingKey;
  if (item.media_type === 'episode' || (item.grandparent_title && item.grandparent_rating_key)) {
    // This is a TV show episode, use the show's rating key
    ratingKey = item.grandparent_rating_key;
  } else {
    // For movies or when grandparent isn't available
    ratingKey = item.rating_key || item.parent_rating_key;
  }

  // Create result with necessary metadata - precompute commonly used values
  const relativeTime = formatRelativeTime(timestamp);
  const shortDate = formatShortDate(timestamp);
  
  const result = {
    // Include the appropriate rating key for image proxy URL construction
    ratingKey,
    // Include additional info for display
    added_at_relative: relativeTime
  };
  
  // Use a pattern-based approach to reduce repeated replacements
  const variableValues = {
    title: item.title || '',
    year: item.year || '',
    grandparent_title: item.grandparent_title || '',
    parent_media_index: String(item.parent_media_index || '').padStart(2, '0'),
    media_index: String(item.media_index || '').padStart(2, '0'),
    duration: formattedDuration,
    content_rating: item.content_rating || '',
    video_resolution: item.video_resolution || '',
    added_at_relative: relativeTime,
    added_at_short: shortDate
  };

  // Apply templates
  for (const field of formatFields) {
    if (!field.id || !field.template) continue;

    let value = field.template;
    for (const [key, val] of Object.entries(variableValues)) {
      // Only replace if the pattern exists to avoid unnecessary operations
      if (value.includes(`\${${key}}`)) {
        value = value.replace(new RegExp(`\\$\{${key}}`, 'g'), val);
      }
    }

    result[field.id] = value;
  }

  return result;
}

/**
 * Get library sections data with configuration status
 * 
 * @async
 * @returns {Object} Library data with sections and totals
 * @returns {Array} returns.sections - Array of library sections
 * @returns {Object} returns.totals - Aggregated library statistics
 */
async function getLibraryData() {
  try {
    // Check cache first
    const cachedLibraries = cache.get('libraries');
    if (cachedLibraries?.response?.data) {
      const libraryData = await processLibraryData(cachedLibraries.response.data);
      return libraryData;
    }
    
    const response = await tautulliService.makeRequest('get_libraries_table');
    if (!response?.response?.data?.data) {
      throw new Error('Invalid library data format');
    }

    const libraryData = await processLibraryData(response.response.data.data);
    return libraryData;
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

/**
 * Process library data with configuration status
 * Extracted to a separate function for reusability
 * 
 * @async
 * @param {Array} libraryData - Raw library data from Tautulli
 * @returns {Object} Processed library data with sections and totals
 */
async function processLibraryData(libraryData) {
  const settings = await getSettings();
  const configuredSections = {
    movies: settings.sections?.movies || [],
    shows: settings.sections?.shows || []
  };

  // Process sections and mark configured ones
  const sections = libraryData
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
}

/**
 * Register cache refresh callbacks
 */
cache.registerRefreshCallback('recent_media', async () => {
  const settings = await getSettings();
  const configuredSections = {
    shows: settings.sections?.shows || [],
    movies: settings.sections?.movies || []
  };

  // Fetch each section's recent media in parallel
  const promises = [];
  
  for (const type of ['shows', 'movies']) {
    for (const sectionId of configuredSections[type]) {
      promises.push(
        tautulliService.makeRequest('get_recently_added', {
          section_id: sectionId,
          count: 15
        }).then(response => ({
          type,
          sectionId,
          data: response?.response?.data?.recently_added || []
        })).catch(error => {
          console.error(`Error fetching recent media for section ${sectionId}:`, error.message);
          return {
            type,
            sectionId,
            data: []
          };
        })
      );
    }
  }

  const results = await Promise.all(promises);
  return results.filter(result => result.data.length > 0);
});

/**
 * Get media format settings
 * 
 * @route GET /api/media/settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with media format settings
 */
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

/**
 * Save media format settings
 * 
 * @route POST /api/media/settings
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body containing sections and formats
 * @param {Object} req.body.sections - Section configuration
 * @param {Object} req.body.formats - Format configuration
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
router.post('/settings', async (req, res) => {
  try {
    const { sections, formats } = req.body;
    const settings = await getSettings();

    await saveSettings({
      ...settings,
      sections: sections || { shows: [], movies: [] },
      mediaFormats: formats || {}
    });

    // Clear recent media cache to force a refresh with new settings
    const keys = cache.keys();
    keys.forEach(key => {
      if (key.startsWith(RECENT_MEDIA_CACHE_PREFIX)) {
        cache.cache.del(key);
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save media settings' });
  }
});

/**
 * Get recent media from configured sections
 * 
 * @route GET /api/media/recent
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.type] - Filter by media type (movies, shows)
 * @param {number} [req.query.count=15] - Number of items to return per section
 * @param {string} [req.query.section] - Comma-separated list of section IDs
 * @param {string} [req.query.fields] - Comma-separated list of fields to include
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with recent media items
 */
router.get('/recent', async (req, res) => {
  try {
    const { type, count = 15, section, fields } = req.query;
    
    // Ensure count doesn't exceed max
    const itemCount = Math.min(parseInt(count) || 15, 15);
    
    // Create a unique cache key based on query parameters
    const cacheKey = `${RECENT_MEDIA_CACHE_PREFIX}${type || 'all'}:${itemCount}:${section || 'all'}:${fields || 'all'}`;
    
    // Check cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
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

    // Get all media items in a single array - use more efficient concatenation
    let allItems = [];
    
    // Process requested fields if provided
    const requestedFields = fields ? fields.split(',') : null;
    
    for (const mediaType of typesToInclude) {
      const sectionsForType = sectionsToUse[mediaType] || [];
      
      for (const sectionId of sectionsForType) {
        const sectionMedia = cachedMedia.find(
          item => item.type === mediaType && item.sectionId === sectionId
        );
        
        if (!sectionMedia || !sectionMedia.data.length) continue;
        
        const formatFields = formats[mediaType]?.[sectionId]?.fields || [];
        
        // Process each item and add to results
        const formattedItems = sectionMedia.data
          .slice(0, itemCount) // Limit items per section
          .map(item => {
            const formatted = formatItem(item, formatFields);
            return {
              ...formatted,
              added_at: parseInt(item.added_at),
              media_type: mediaType,
              section_id: sectionId
            };
          });
          
        allItems = allItems.concat(formattedItems);
      }
    }

    // Sort all items by added_at
    allItems.sort((a, b) => b.added_at - a.added_at);
    
    // Filter fields if requested
    if (requestedFields) {
      allItems = allItems.map(item => {
        const filteredItem = {};
        requestedFields.forEach(field => {
          if (field === 'added_at' || field === 'media_type' || field === 'section_id' || item[field] !== undefined) {
            filteredItem[field] = item[field];
          }
        });
        return filteredItem;
      });
    }

    // Get library data
    const libraryData = await getLibraryData();

    const responseData = {
      response: {
        result: 'success',
        data: allItems,
        libraries: libraryData
      }
    };
    
    // Cache the result
    cache.set(cacheKey, responseData, MEDIA_CACHE_TTL);

    res.json(responseData);
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