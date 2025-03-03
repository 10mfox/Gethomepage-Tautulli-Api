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

// Enable music-specific debugging
const DEBUG_MUSIC = true;

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
  // For music, prioritize the artist thumbnail or album art
  let ratingKey;
  if (item.media_type === 'episode' || (item.grandparent_title && item.grandparent_rating_key)) {
    // This is a TV show episode, use the show's rating key
    ratingKey = item.grandparent_rating_key;
  } else if (item.media_type === 'track' || item.media_type === 'album' || 
            (item.grandparent_title && item.parent_rating_key)) {
    // This is a music track or album, use the appropriate rating key
    ratingKey = item.media_type === 'album' ? item.rating_key : item.parent_rating_key;
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
  
  // Special handling for music items to ensure proper fields are set
  const isMusicItem = item.media_type === 'track' || 
                      item.media_type === 'album' || 
                      item.section_type === 'artist' ||
                      item.section_type === 'music';
  
  // Use a pattern-based approach to reduce repeated replacements
  const variableValues = {
    title: item.title || '',
    year: item.year || '',
    grandparent_title: item.grandparent_title || '',
    parent_title: item.parent_title || '',
    parent_media_index: String(item.parent_media_index || '').padStart(2, '0'),
    media_index: String(item.media_index || '').padStart(2, '0'),
    duration: formattedDuration,
    content_rating: item.content_rating || '',
    video_resolution: item.video_resolution || '',
    added_at_relative: relativeTime,
    added_at_short: shortDate,
    child_count: item.child_count || '0',
    
    // Music-specific attributes with enhanced reliability
    artist: isMusicItem ? (item.grandparent_title || item.parent_title || item.artist || '') : '',
    album: isMusicItem ? (item.parent_title || item.title || item.album || '') : '',
    studio: item.studio || '',
    genres: Array.isArray(item.genres) ? item.genres.join(', ') : (item.genre || ''),
    rating: item.rating || '',
    tracks_count: isMusicItem ? (item.child_count || '0') : '0'
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
    const cachedLibraries = cache.get('libraries', true);
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
        shows: { sections: 0, total_items: 0, total_items_formatted: '0', total_seasons: 0, total_seasons_formatted: '0', total_episodes: 0, total_episodes_formatted: '0' },
        music: { sections: 0, total_items: 0, total_items_formatted: '0', total_albums: 0, total_albums_formatted: '0', total_tracks: 0, total_tracks_formatted: '0' }
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
    shows: settings.sections?.shows || [],
    movies: settings.sections?.movies || [],
    music: settings.sections?.music || []
  };

  if (DEBUG_MUSIC) {
    console.log('Configured music sections:', configuredSections.music);
    console.log('Library data sections:', libraryData.map(lib => 
      `${lib.section_id} (${lib.section_type}): ${lib.section_name}`
    ));
  }

  // Process sections and mark configured ones
  const sections = libraryData
    .map(library => {
      // Fix the isConfigured check to ensure proper type conversion
      const sectionId = parseInt(library.section_id);
      const isConfigured = library.section_type === 'movie' ? 
        configuredSections.movies.includes(sectionId) :
        library.section_type === 'show' ? 
        configuredSections.shows.includes(sectionId) : 
        (library.section_type === 'artist' || library.section_type === 'music') ? 
        configuredSections.music.includes(sectionId) : 
        false;

      // Ensure parent_count and child_count are properly parsed
      const parsedParentCount = parseInt(library.parent_count) || 0;
      const parsedChildCount = parseInt(library.child_count) || 0;

      if (DEBUG_MUSIC && (library.section_type === 'artist' || library.section_type === 'music')) {
        console.log(`Music library ${library.section_name} (${sectionId}): configured=${isConfigured}`);
        console.log(`  Artists: ${library.count}, Albums: ${parsedParentCount}, Tracks: ${parsedChildCount}`);
      }

      return {
        section_name: library.section_name,
        section_type: library.section_type,
        count: parseInt(library.count) || 0,
        section_id: sectionId,
        count_formatted: new Intl.NumberFormat().format(parseInt(library.count) || 0),
        configured: isConfigured,
        ...(library.section_type === 'show' || 
           library.section_type === 'artist' || 
           library.section_type === 'music' ? {
          parent_count: parsedParentCount,
          child_count: parsedChildCount,
          parent_count_formatted: new Intl.NumberFormat().format(parsedParentCount),
          child_count_formatted: new Intl.NumberFormat().format(parsedChildCount)
        } : {})
      };
    })
    .sort((a, b) => a.section_id - b.section_id); // Sort by section ID

  // Calculate totals with explicit type checking
  const totals = {
    movies: { sections: 0, total_items: 0, total_items_formatted: '0' },
    shows: { sections: 0, total_items: 0, total_items_formatted: '0', total_seasons: 0, total_seasons_formatted: '0', total_episodes: 0, total_episodes_formatted: '0' },
    music: { sections: 0, total_items: 0, total_items_formatted: '0', total_albums: 0, total_albums_formatted: '0', total_tracks: 0, total_tracks_formatted: '0' }
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
    } else if (library.section_type === 'artist' || library.section_type === 'music') {
      if (DEBUG_MUSIC) {
        console.log(`Adding to music totals - Section ${library.section_id} (${library.section_name}):`);
        console.log(`  Artists: ${library.count}, Albums: ${library.parent_count}, Tracks: ${library.child_count}`);
      }
      totals.music.sections++;
      totals.music.total_items += library.count;
      totals.music.total_albums += library.parent_count;
      totals.music.total_tracks += library.child_count;
    }
  });

  // Format total numbers
  totals.movies.total_items_formatted = new Intl.NumberFormat().format(totals.movies.total_items);
  totals.shows.total_items_formatted = new Intl.NumberFormat().format(totals.shows.total_items);
  totals.shows.total_seasons_formatted = new Intl.NumberFormat().format(totals.shows.total_seasons);
  totals.shows.total_episodes_formatted = new Intl.NumberFormat().format(totals.shows.total_episodes);
  totals.music.total_items_formatted = new Intl.NumberFormat().format(totals.music.total_items);
  totals.music.total_albums_formatted = new Intl.NumberFormat().format(totals.music.total_albums);
  totals.music.total_tracks_formatted = new Intl.NumberFormat().format(totals.music.total_tracks);

  if (DEBUG_MUSIC) {
    console.log("Final music totals:", {
      sections: totals.music.sections,
      artists: totals.music.total_items_formatted,
      albums: totals.music.total_albums_formatted, 
      tracks: totals.music.total_tracks_formatted
    });
  }

  return { sections, totals };
}

/**
 * Register cache refresh callbacks
 */
cache.registerRefreshCallback('recent_media', async () => {
  const settings = await getSettings();
  const configuredSections = {
    shows: settings.sections?.shows || [],
    movies: settings.sections?.movies || [],
    music: settings.sections?.music || []
  };

  if (DEBUG_MUSIC) {
    console.log('Configured sections for refresh:', configuredSections);
  }

  // Fetch each section's recent media in parallel
  const promises = [];
  
  for (const type of ['shows', 'movies', 'music']) {
    for (const sectionId of configuredSections[type]) {
      // Format section ID consistently
      const parsedSectionId = parseInt(sectionId);
      
      if (DEBUG_MUSIC && type === 'music') {
        console.log(`Adding promise for music section ${parsedSectionId}`);
      }
      
      promises.push(
        tautulliService.makeRequest('get_recently_added', {
          section_id: parsedSectionId,
          count: 15
        }).then(response => {
          const hasItems = response?.response?.data?.recently_added?.length > 0;
          
          if (DEBUG_MUSIC && type === 'music') {
            console.log(`Got ${hasItems ? response.response.data.recently_added.length : 0} items for music section ${parsedSectionId}`);
          }
          
          return {
            type,
            sectionId: parsedSectionId,
            data: response?.response?.data?.recently_added || []
          };
        }).catch(error => {
          console.error(`Error fetching recent media for ${type} section ${parsedSectionId}:`, error.message);
          return {
            type,
            sectionId: parsedSectionId,
            data: []
          };
        })
      );
    }
  }

  const results = await Promise.all(promises);
  const filteredResults = results.filter(result => result.data.length > 0);
  
  if (DEBUG_MUSIC) {
    console.log('Music results after refresh:', 
      filteredResults.filter(r => r.type === 'music')
        .map(r => `Section ${r.sectionId}: ${r.data.length} items`));
  }
  
  return filteredResults;
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
      sections: settings.sections || { shows: [], movies: [], music: [] }
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

    if (DEBUG_MUSIC) {
      console.log('Saving media settings:');
      console.log('- Sections:', sections);
      console.log('- Formats:', formats);
    }

    await saveSettings({
      ...settings,
      sections: sections || { shows: [], movies: [], music: [] },
      mediaFormats: formats || {}
    });

    // Clear recent media cache entries
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
 * @param {string} [req.query.type] - Filter by media type (movies, shows, music)
 * @param {number} [req.query.count=15] - Number of items to return per section
 * @param {string} [req.query.section] - Comma-separated list of section IDs
 * @param {string} [req.query.fields] - Comma-separated list of fields to include
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with recent media items
 */
router.get('/recent', async (req, res) => {
  try {
    const { type, count = 15, section, fields } = req.query;
    
    // Force no caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Enable additional logging for debugging
    if (DEBUG_MUSIC) {
      console.log('Media request:', { type, count, section });
    }
    
    // Ensure count doesn't exceed max
    const itemCount = Math.min(parseInt(count) || 15, 15);
    
    // Create a unique cache key based on query parameters
    const cacheKey = `${RECENT_MEDIA_CACHE_PREFIX}${type || 'all'}:${itemCount}:${section || 'all'}:${fields || 'all'}`;
    
    // Clear this key from cache first to ensure fresh data
    cache.cache.del(cacheKey);
    
    // Get settings and cached media data - ALWAYS REFRESH
    // This ensures we don't use stale data
    const settings = await getSettings();
    const formats = settings.mediaFormats || {};
    const cachedMedia = cache.get('recent_media', true);
    
    if (!cachedMedia) {
      throw new Error('Media data not available');
    }

    console.log(`Generating fresh media response with ${cachedMedia.length} sections`);

    // Determine which types to include
    const validTypes = ['shows', 'movies', 'music'];
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
      
      if (DEBUG_MUSIC && mediaType === 'music') {
        console.log(`Processing music sections: ${sectionsForType.join(', ')}`);
        console.log('Available media sections in cache:', 
          cachedMedia.map(m => `${m.type}-${m.sectionId} (${m.data.length} items)`));
      }
      
      for (const sectionId of sectionsForType) {
        // Find the media for this section in cache with type conversion check
        const sectionMedia = cachedMedia.find(
          item => item.type === mediaType && 
                 (item.sectionId === sectionId || 
                  parseInt(item.sectionId) === parseInt(sectionId))
        );
        
        if (!sectionMedia || !sectionMedia.data.length) {
          if (DEBUG_MUSIC && mediaType === 'music') {
            console.log(`No data found for music section ${sectionId}`);
          }
          continue;
        }
        
        // Make sure format fields exist, if not use defaults
        let formatFields = formats[mediaType]?.[sectionId]?.fields || [];
        
        // If no format fields exist, check if we need to use a default
        if (formatFields.length === 0) {
          if (DEBUG_MUSIC && mediaType === 'music') {
            console.log(`No format fields for ${mediaType} section ${sectionId}, using default`);
          }
          if (mediaType === 'music') {
            formatFields = [{ id: 'field', template: '${parent_title} - ${title}' }];
          } else if (mediaType === 'shows') {
            formatFields = [{ id: 'field', template: '${grandparent_title} - S${parent_media_index}E${media_index} - ${title}' }];
          } else if (mediaType === 'movies') {
            formatFields = [{ id: 'field', template: '${title} (${year})' }];
          }
        }
        
        // Process items with more robustness for music items
        const formattedItems = sectionMedia.data
          .slice(0, itemCount)
          .map(item => {
            try {
              const formatted = formatItem(item, formatFields);
              return {
                ...formatted,
                added_at: parseInt(item.added_at),
                media_type: mediaType,
                section_id: sectionId
              };
            } catch (err) {
              console.error(`Error formatting ${mediaType} item:`, err);
              // Return a minimal item to avoid breaking the whole response
              return {
                field: item.title || 'Unknown Item',
                added_at: parseInt(item.added_at) || Date.now()/1000,
                media_type: mediaType,
                section_id: sectionId
              };
            }
          });
          
        if (DEBUG_MUSIC && mediaType === 'music') {
          console.log(`Added ${formattedItems.length} music items from section ${sectionId}`);
        }
        
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
    console.error('Error in media/recent endpoint:', error);
    res.status(500).json({
      response: {
        result: 'error',
        message: error.message
      }
    });
  }
});

module.exports = { mediaRouter: router };