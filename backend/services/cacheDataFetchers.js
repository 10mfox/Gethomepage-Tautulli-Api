/**
 * Data fetching functions for the cache service
 * @module services/cacheDataFetchers
 */
const { logError, log, colors } = require('../../logger');
const { DEBUG_MUSIC } = require('./cacheConfig');

/**
 * Fetch library data from Tautulli
 * 
 * @async
 * @param {boolean} verboseLogging - Whether verbose logging is enabled
 * @returns {Promise<Array>} Array of library objects
 */
async function fetchLibraryData(verboseLogging) {
  try {
    // Break circular dependency by requiring tautulliService at runtime
    const { tautulliService } = require('./tautulli');
    
    if (verboseLogging) {
      log(`${colors.brightBlue}ℹ${colors.reset} Fetching library data from Tautulli`);
    }
    
    const data = await tautulliService.makeRequest('get_libraries_table', {}, {
      deduplicate: true,
      maxRetries: 2,
      timeout: 10000,
      useConditionalGet: true
    });
    
    if (!data?.response?.data?.data) {
      log(`${colors.yellow}⚠${colors.reset} Invalid library data format received`);
      return [];
    }

    if (verboseLogging) {
      log(`${colors.brightGreen}✓${colors.reset} Fetched library data: ${data.response.data.data.length} libraries`);
    }

    return data.response.data.data
      .map(library => ({
        section_name: library.section_name,
        section_type: library.section_type,
        count: library.count,
        section_id: library.section_id,
        ...(library.section_type === 'show' ? {
          parent_count: library.parent_count,
          child_count: library.child_count
        } : {}),
        ...(library.section_type === 'artist' || library.section_type === 'music' ? {
          parent_count: library.parent_count,
          child_count: library.child_count
        } : {})
      }))
      .sort((a, b) => a.section_id - b.section_id);
  } catch (error) {
    const errorMessage = error.message || 'Unknown error';
    logError('Library Data Fetch', { message: errorMessage });
    return [];
  }
}

/**
 * Fetch user data from Tautulli API
 * 
 * @async
 * @param {boolean} verboseLogging - Whether verbose logging is enabled
 * @returns {Promise<Object>} Object containing activity and users data
 */
async function fetchUserData(verboseLogging) {
  try {
    // Break circular dependency by requiring tautulliService at runtime
    const { tautulliService } = require('./tautulli');
    const { cache } = require('./cacheService');
    
    if (verboseLogging) {
      log(`${colors.brightBlue}ℹ${colors.reset} Fetching user data from Tautulli`);
    }
    
    // Check if we can use cached data with a quick check for changes
    const cacheKey = 'users';
    const cachedData = cache.get(cacheKey);
    const metadata = cache.getMetadata(cacheKey);
    
    if (cachedData && metadata && metadata.lastCheck) {
      // If we checked less than 15 seconds ago, return cached data
      const timeSinceLastCheck = Date.now() - metadata.lastCheck;
      if (timeSinceLastCheck < 15000) {
        if (verboseLogging) {
          log(`${colors.brightBlue}ℹ${colors.reset} Using recently verified user data (${Math.round(timeSinceLastCheck/1000)}s ago)`);
        }
        return cachedData;
      }
      
      // For active users, we can check if any of them have changed status
      // This is much more efficient than a full refresh
      try {
        const activeSessions = await tautulliService.getActiveSessions();
        const lastActiveSessions = metadata.activeSessions || [];
        
        // Compare current sessions to last known sessions
        const sessionsChanged = 
          activeSessions.length !== lastActiveSessions.length ||
          !compareSessionsEqual(activeSessions, lastActiveSessions);
        
        if (!sessionsChanged) {
          // If sessions haven't changed, we can reuse the cached data
          if (verboseLogging) {
            log(`${colors.brightBlue}ℹ${colors.reset} No change in active sessions, reusing cached user data`);
          }
          
          // Update the last check time
          cache.updateMetadata(cacheKey, {
            lastCheck: Date.now(),
            activeSessions
          });
          
          return cachedData;
        }
        
        if (verboseLogging) {
          log(`${colors.brightBlue}ℹ${colors.reset} Active sessions changed, updating user data`);
        }
      } catch (error) {
        // If checking active sessions fails, fallback to full refresh
        if (verboseLogging) {
          log(`${colors.yellow}⚠${colors.reset} Failed to check active sessions: ${error.message}`);
        }
      }
    }
    
    // Use the batching capability of tautulliService
    const requests = [
      { command: 'get_activity', params: {} },
      { command: 'get_users_table', params: { length: 1000 } }
    ];
    
    const [activityResponse, usersResponse] = await tautulliService.batchRequests(requests, {
      maxConcurrent: 2,
      timeout: 10000
    });

    const userData = {
      activity: activityResponse?.response?.data || { sessions: [] },
      users: usersResponse?.response?.data || { data: [] }
    };

    if (verboseLogging) {
      log(`${colors.brightGreen}✓${colors.reset} Fetched user data: ${userData.activity.sessions?.length || 0} active sessions, ${userData.users.data?.length || 0} users`);
    }

    // Store active sessions in metadata for later comparison
    cache.updateMetadata(cacheKey, {
      lastCheck: Date.now(),
      activeSessions: userData.activity.sessions || []
    });

    return userData;
  } catch (error) {
    const errorMessage = error.message || 'Unknown error';
    logError('User Data Fetch', { message: errorMessage });
    return { activity: { sessions: [] }, users: { data: [] } };
  }
}

/**
 * Compare if two sets of sessions are functionally equivalent
 * Used to determine if user data needs to be refreshed
 * 
 * @param {Array} sessionsA - First set of sessions
 * @param {Array} sessionsB - Second set of sessions
 * @returns {boolean} True if sessions are equivalent
 */
function compareSessionsEqual(sessionsA, sessionsB) {
  if (sessionsA.length !== sessionsB.length) return false;
  
  // Create maps of session by user
  const mapA = new Map();
  const mapB = new Map();
  
  sessionsA.forEach(session => {
    mapA.set(session.user_id, {
      state: session.state,
      progress_percent: session.progress_percent
    });
  });
  
  sessionsB.forEach(session => {
    mapB.set(session.user_id, {
      state: session.state,
      progress_percent: session.progress_percent
    });
  });
  
  // Check if all users in A are in B with the same state
  for (const [userId, sessionDataA] of mapA.entries()) {
    const sessionDataB = mapB.get(userId);
    
    // If user isn't in B or state is different, sessions aren't equal
    if (!sessionDataB) return false;
    if (sessionDataB.state !== sessionDataA.state) return false;
    
    // If progress is different by more than 1%, consider it changed
    // CHANGED FROM 5% to 1% for more responsive progress updates
    const progressDiff = Math.abs(sessionDataB.progress_percent - sessionDataA.progress_percent);
    if (progressDiff > 1) return false;
  }
  
  return true;
}

/**
 * Update active user session data without a full refresh
 * 
 * @async
 * @param {boolean} verboseLogging - Whether verbose logging is enabled
 * @returns {Promise<boolean>} True if update was successful
 */
async function updateActiveUserData(verboseLogging) {
  try {
    const { tautulliService } = require('./tautulli');
    const { cache } = require('./cacheService');
    
    // Get the cached user data
    const cacheKey = 'users';
    const userData = cache.get(cacheKey);
    if (!userData) return false;
    
    // Get just the active sessions
    const activeSessions = await tautulliService.getActiveSessions();
    
    // Track progress data to ensure it's being captured
    if (verboseLogging) {
      const progressData = activeSessions.map(s => 
        `${s.user_id}: ${s.progress_percent}% (${s.view_offset}/${s.duration})`
      ).join(', ');
      
      log(`${colors.brightBlue}ℹ${colors.reset} Active sessions progress data: ${progressData}`);
    }
    
    // Update the cached user data with new sessions
    userData.activity.sessions = activeSessions;
    
    // Update the cache
    cache.set(cacheKey, userData);
    
    // Update metadata
    cache.updateMetadata(cacheKey, {
      lastCheck: Date.now(),
      activeSessions,
      partialUpdate: true
    });
    
    if (verboseLogging) {
      log(`${colors.brightGreen}✓${colors.reset} Updated active user sessions: ${activeSessions.length} sessions`);
    }
    
    return true;
  } catch (error) {
    logError('Active User Update', { message: error.message || 'Unknown error' });
    return false;
  }
}

/**
 * Fetch recent media for a specific section
 * 
 * @async
 * @param {number|string} sectionId - Tautulli section ID
 * @param {string} mediaType - Media type (movies, shows, music)
 * @param {Object} configuredSections - All configured section IDs by type
 * @param {boolean} verboseLogging - Whether verbose logging is enabled
 * @returns {Promise<Object>} Object with section media data
 */
async function fetchRecentMedia(sectionId, mediaType, configuredSections, verboseLogging) {
  try {
    // Break circular dependency by requiring tautulliService at runtime
    const { tautulliService } = require('./tautulli');
    const { cache } = require('./cacheService');
    
    const parsedSectionId = parseInt(sectionId);
    
    // Determine correct section type based on configuration
    const actualType = 
      configuredSections.music.includes(parsedSectionId) ? 'music' :
      configuredSections.shows.includes(parsedSectionId) ? 'shows' :
      'movies';
    
    if (DEBUG_MUSIC && actualType === 'music' && verboseLogging) {
      console.log(`Fetching section ${parsedSectionId} as ${actualType} (requested as ${mediaType})`);
    }
    
    if (verboseLogging) {
      log(`${colors.brightBlue}ℹ${colors.reset} Fetching recent media for section ${parsedSectionId} (${actualType})`);
    }
    
    // Check if we have a cached version and if we need to refresh
    const cacheKey = `recentMedia:${parsedSectionId}`;
    const cachedData = cache.get(cacheKey);
    const metadata = cache.getMetadata(cacheKey);
    
    if (cachedData && metadata && metadata.lastCheck) {
      // If we checked less than 30 seconds ago, return cached data
      const timeSinceLastCheck = Date.now() - metadata.lastCheck;
      if (timeSinceLastCheck < 30000) {
        if (verboseLogging) {
          log(`${colors.brightBlue}ℹ${colors.reset} Using recently checked media data for section ${parsedSectionId} (${Math.round(timeSinceLastCheck/1000)}s ago)`);
        }
        return cachedData;
      }
    }
    
    const response = await tautulliService.makeRequest('get_recently_added', {
      section_id: parsedSectionId,
      count: 15
    }, {
      deduplicate: true,
      timeout: 10000,
      useConditionalGet: true
    });

    if (DEBUG_MUSIC && actualType === 'music' && verboseLogging) {
      const itemCount = response?.response?.data?.recently_added?.length || 0;
      console.log(`Section ${parsedSectionId} returned ${itemCount} items`);
    }

    const itemCount = response?.response?.data?.recently_added?.length || 0;
    if (verboseLogging) {
      log(`${colors.brightGreen}✓${colors.reset} Fetched ${itemCount} recent items for section ${parsedSectionId}`);
    }

    const result = {
      type: actualType, // Use the correct type based on configuration
      sectionId: parsedSectionId,
      data: response?.response?.data?.recently_added || []
    };
    
    // Update metadata
    cache.updateMetadata(cacheKey, {
      lastCheck: Date.now()
    });
    
    return result;
  } catch (error) {
    const errorMessage = error.message || 'Unknown error';
    logError(`Recent Media Fetch - Section ${sectionId}`, { message: errorMessage });
    return {
      type: mediaType,
      sectionId,
      data: []
    };
  }
}

module.exports = {
  fetchLibraryData,
  fetchUserData,
  fetchRecentMedia,
  updateActiveUserData,
  compareSessionsEqual
};