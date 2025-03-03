/**
 * Users API endpoint handler
 * Provides endpoints for retrieving and managing user data
 * @module api/users
 */
const express = require('express');
const axios = require('axios');
const { cache } = require('../services/cacheService');
const { getSettings, saveSettings } = require('../services/settings');

const router = express.Router();

// Cache TTLs and keys
const USER_CACHE_TTL = 60; // 60 seconds
const USER_HISTORY_CACHE_TTL = 300; // 5 minutes
const USER_LIST_CACHE_PREFIX = 'userList:';
const USER_HISTORY_CACHE_PREFIX = 'userHistory:';

/**
 * Format seconds into hours and minutes display string
 * 
 * @param {number} totalSeconds - Total seconds to format
 * @returns {string} Formatted time string (e.g. "2h 30m" or "45m")
 */
function formatTimeHHMM(totalSeconds) {
  if (!totalSeconds) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * Format show title for consistent display
 * Removes year from title and formats with season/episode info if available
 * 
 * @param {Object} session - Session object containing show information
 * @returns {string} Formatted show title
 */
function formatShowTitle(session) {
  if (!session) return '';
  if (session.grandparent_title && session.parent_media_index && session.media_index) {
    // Remove year from grandparent_title (show name)
    const showTitle = session.grandparent_title.replace(/\s*\(\d{4}\)|\s+[-–]\s+\d{4}/, '');
    return `${showTitle} - S${String(session.parent_media_index).padStart(2, '0')}E${String(session.media_index).padStart(2, '0')}`;
  }
  const title = session.title || '';
  return title.replace(/\s*\(\d{4}\)|\s+[-–]\s+\d{4}/, '');
}

/**
 * Format time difference from now in a human-readable string
 * 
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted time difference (e.g. "5m ago")
 */
function formatTimeDiff(timestamp) {
  if (!timestamp) return 'Never';
  const now = Date.now() / 1000;
  const diff = Math.floor(now - timestamp);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Get user history from Tautulli API with caching
 * 
 * @async
 * @param {string} baseUrl - Tautulli API base URL
 * @param {string} apiKey - Tautulli API key
 * @param {number|string} userId - User ID to get history for
 * @returns {Object|null} User's last played item or null if error
 */
async function getUserHistory(baseUrl, apiKey, userId) {
  // Create a cache key
  const cacheKey = `${USER_HISTORY_CACHE_PREFIX}${userId}`;
  
  // Check cache first
  const cachedHistory = cache.get(cacheKey);
  if (cachedHistory) {
    return cachedHistory;
  }
  
  try {
    const response = await axios.get(`${baseUrl}/api/v2`, {
      params: {
        apikey: apiKey,
        cmd: 'get_history',
        user_id: userId,
        length: 1
      },
      timeout: 5000
    });
    
    const historyData = response.data?.response?.data?.data?.[0] || null;
    
    // Cache the result
    if (historyData) {
      cache.set(cacheKey, historyData, USER_HISTORY_CACHE_TTL);
    }
    
    return historyData;
  } catch (error) {
    console.error(`Error fetching history for user ${userId}:`, error.message);
    return null;
  }
}

/**
 * Register cache refresh callbacks
 */
cache.registerRefreshCallback('users', async () => {
  if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
    return { activity: { sessions: [] }, users: { data: [] } };
  }
  
  try {
    const [activityResponse, usersResponse] = await Promise.all([
      axios.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
        params: {
          apikey: process.env.TAUTULLI_API_KEY,
          cmd: 'get_activity'
        },
        timeout: 5000
      }),
      axios.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
        params: {
          apikey: process.env.TAUTULLI_API_KEY,
          cmd: 'get_users_table',
          length: 1000
        },
        timeout: 5000
      })
    ]);
    
    return {
      activity: activityResponse.data.response.data || { sessions: [] },
      users: usersResponse.data.response.data || { data: [] }
    };
  } catch (error) {
    console.error("Error refreshing user data:", error.message);
    throw error;
  }
});

/**
 * Get all users with activity information
 * 
 * @route GET /api/users
 * @param {Object} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.order_column='friendly_name'] - Column to sort by
 * @param {string} [req.query.order_dir='asc'] - Sort direction (asc/desc)
 * @param {string} [req.query.search=''] - Search filter for usernames
 * @param {string} [req.query.fields=''] - Comma-separated list of fields to include
 * @param {number} [req.query.start=0] - Pagination start index
 * @param {number} [req.query.length=25] - Number of records to return
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with user data
 */
router.get('/', async (req, res) => {
  try {
    const { 
      order_column = 'friendly_name', 
      order_dir = 'asc', 
      search = '',
      fields = '',
      start = 0,
      length = 25
    } = req.query;

    // Force no caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Calculate cache key based on query parameters
    const cacheKey = `${USER_LIST_CACHE_PREFIX}${order_column}:${order_dir}:${search}:${start}:${length}`;
    
    // Clear this key from cache first to ensure fresh data
    cache.cache.del(cacheKey);

    const settings = await getSettings();
    const formatFields = settings.userFormats?.fields || [];

    if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
      throw new Error('Tautulli configuration missing');
    }

    // Get user data from the main cache - ALWAYS REFRESH
    // This ensures we don't use stale data
    const userData = cache.get('users', true);
    if (!userData) {
      throw new Error('User data not available');
    }

    console.log(`Generating fresh user data response with ${userData.activity.sessions?.length || 0} active sessions`);

    const watchingUsers = {};
    userData.activity.sessions?.forEach(session => {
      if (session.state === 'playing') {
        watchingUsers[session.user_id] = {
          current_media: session.grandparent_title ? `${session.grandparent_title} - ${session.title}` : session.title,
          last_played_modified: formatShowTitle(session),
          media_type: session.media_type,
          progress_percent: session.progress_percent || '0',
          view_offset: Math.floor((session.view_offset || 0) / 1000),
          duration: Math.floor((session.duration || 0) / 1000),
          last_seen: Math.floor(Date.now() / 1000),
          parent_media_index: session.parent_media_index,
          media_index: session.media_index,
          stream_container_decision: session.stream_container_decision || 'direct play'
        };
      }
    });

    const allUsers = userData.users.data || [];
    const filteredUsers = search ? 
      allUsers.filter(user => user.friendly_name.toLowerCase().includes(search.toLowerCase())) : 
      allUsers;
    
    const recordsTotal = filteredUsers.length;

    // Process user data with parallel history fetches if needed
    const historyPromises = [];
    const transformedUsers = filteredUsers
      .slice(parseInt(start), parseInt(start) + parseInt(length))
      .map((user, index) => {
        const watching = watchingUsers[user.user_id];
        const lastSeen = watching ? watching.last_seen : parseInt(user.last_seen, 10);

        let lastPlayedModified = '';
        let historyPromise = null;
        
        if (watching) {
          lastPlayedModified = watching.last_played_modified;
        } else if (user.last_played) {
          // We'll need to fetch history. Create a placeholder that will be updated
          lastPlayedModified = user.last_played;
          
          // Create and store a promise to fetch history data
          historyPromise = getUserHistory(
            process.env.TAUTULLI_BASE_URL,
            process.env.TAUTULLI_API_KEY,
            user.user_id
          ).then(lastSession => {
            if (lastSession) {
              return formatShowTitle(lastSession);
            }
            return user.last_played;
          }).catch(() => user.last_played);
          
          historyPromises.push({ index, promise: historyPromise });
        } else {
          lastPlayedModified = 'Nothing';
        }

        const baseUser = {
          friendly_name: user.friendly_name || '',
          total_plays: parseInt(user.plays || '0', 10),
          is_watching: watching ? 'Watching' : 'Watched',
          last_played: watching ? watching.current_media : (user.last_played || 'Nothing'),
          last_played_modified: lastPlayedModified,
          media_type: watching ? watching.media_type.charAt(0).toUpperCase() + watching.media_type.slice(1) : 
                     (user.media_type ? user.media_type.charAt(0).toUpperCase() + user.media_type.slice(1) : ''),
          progress_percent: watching ? `${watching.progress_percent}%` : '',
          progress_time: watching ? `${formatTimeHHMM(watching.view_offset)} / ${formatTimeHHMM(watching.duration)}` : '',
          last_seen_formatted: watching ? '🟢' : (user.last_seen ? formatTimeDiff(user.last_seen) : 'Never'),
          stream_container_decision: watching ? watching.stream_container_decision : '',
          _last_seen: lastSeen,
          _is_watching: !!watching,
          _index: index // Used for updating history data
        };

        return formatFields.reduce((acc, field, fieldIndex) => {
          let result = field.template;
          Object.entries(baseUser).forEach(([key, value]) => {
            if (key.startsWith('_')) return; // Skip internal properties
            result = result.replace(new RegExp(`\\$\{${key}}`, 'g'), value || '');
          });
          
          // Use 'field' as the key for the first field, regardless of its ID in the database
          const fieldKey = fieldIndex === 0 ? 'field' : field.id;
          acc[fieldKey] = result;
          
          acc._last_seen = lastSeen;
          acc._is_watching = !!watching;
          acc._index = index;
          return acc;
        }, {});
      });

    // Wait for all history promises to resolve and update the transformedUsers
    if (historyPromises.length > 0) {
      await Promise.all(historyPromises.map(({ promise }) => promise))
        .then(results => {
          historyPromises.forEach(({ index, promise }, i) => {
            const user = transformedUsers.find(u => u._index === index);
            if (user) {
              // Update the field value with the fetched history
              formatFields.forEach((field, fieldIndex) => {
                const fieldKey = fieldIndex === 0 ? 'field' : field.id;
                if (user[fieldKey]) {
                  user[fieldKey] = user[fieldKey].replace(
                    user.last_played_modified,
                    results[i] || user.last_played_modified
                  );
                }
              });
            }
          });
        });
    }

    // Clean up internal properties
    const sortedUsers = transformedUsers.sort((a, b) => {
      if (a._is_watching && !b._is_watching) return -1;
      if (!a._is_watching && b._is_watching) return 1;
      return (b._last_seen || 0) - (a._last_seen || 0);
    });

    const cleanedUsers = sortedUsers.map(({ _last_seen, _is_watching, _index, ...user }) => user);

    // Filter fields if requested
    let finalUsers = cleanedUsers;
    if (fields) {
      const fieldsList = fields.split(',');
      finalUsers = cleanedUsers.map(user => {
        const filteredUser = {};
        fieldsList.forEach(field => {
          if (user[field] !== undefined) {
            filteredUser[field] = user[field];
          }
        });
        return filteredUser;
      });
    }

    const responseData = { 
      response: {
        result: 'success',
        data: finalUsers,
        recordsTotal: recordsTotal,
        recordsFiltered: filteredUsers.length,
        draw: parseInt(req.query.draw) || 1
      }
    };

    // Cache the response
    cache.set(cacheKey, responseData, USER_CACHE_TTL);

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

/**
 * Get user format settings
 * 
 * @route GET /api/users/format-settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with user format settings
 */
router.get('/format-settings', async (req, res) => {
  try {
    const settings = await getSettings();
    
    // Ensure consistent field IDs - primary field should always be 'field'
    const userFormats = settings.userFormats || { fields: [] };
    
    if (userFormats.fields.length > 0) {
      // If the first field has id 'status_message', change it to 'field'
      if (userFormats.fields[0].id === 'status_message') {
        userFormats.fields[0].id = 'field';
      }
    }
    
    res.json(userFormats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load format settings' });
  }
});

/**
 * Save user format settings
 * 
 * @route POST /api/users/format-settings
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {Array<Object>} req.body.fields - Format field definitions
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
router.post('/format-settings', async (req, res) => {
  try {
    const { fields } = req.body;
    if (!Array.isArray(fields)) {
      throw new Error('Invalid format settings');
    }
    
    // Ensure the first field always has id 'field'
    if (fields.length > 0) {
      fields[0].id = 'field';
    }
    
    const settings = await getSettings();
    await saveSettings({
      ...settings,
      userFormats: { fields }
    });
    
    // Clear user list cache entries
    const keys = cache.keys();
    keys.forEach(key => {
      if (key.startsWith(USER_LIST_CACHE_PREFIX)) {
        cache.cache.del(key);
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = { userRouter: router };