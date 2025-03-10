/**
 * Enhanced persistent cache service for Tautulli data
 * Provides caching with stale-while-revalidate pattern, validation, and background updates
 * @module services/cacheService
 */
const { logError, log, colors } = require('../../logger');
const PersistentCache = require('./PersistentCache');
const { 
  fetchLibraryData, 
  fetchUserData, 
  fetchRecentMedia,
  updateActiveUserData 
} = require('./cacheDataFetchers');
const cacheConfig = require('./cacheConfig');

/**
 * Track consecutive failures for backoff strategy
 * @type {number}
 */
let consecutiveFailures = 0;

/**
 * Flag to track if an update is currently in progress
 * @type {boolean}
 */
let updateInProgress = false;

/**
 * Reference to the interval timer for background updates
 * @type {NodeJS.Timeout|null}
 */
let updateTimer = null;

/**
 * Reference to the interval timer for active user updates
 * @type {NodeJS.Timeout|null}
 */
let activeUserUpdateTimer = null;

/**
 * Reference to the interval timer for media updates
 * @type {NodeJS.Timeout|null}
 */
let mediaUpdateTimer = null;

/**
 * Reference to the interval timer for library updates
 * @type {NodeJS.Timeout|null}
 */
let libraryUpdateTimer = null;

/**
 * Update queue for batching multiple update requests
 * @type {Set<string>}
 */
const updateQueue = new Set();

/**
 * Timer for processing the update queue
 * @type {NodeJS.Timeout|null}
 */
let queueProcessTimer = null;

// Create a singleton instance
const cache = new PersistentCache();

/**
 * Process media updates in the background with batching
 * This allows critical data to load quickly while media data loads asynchronously
 * 
 * @async
 * @param {Array} libraryData - Library data from Tautulli
 */
async function processMediaUpdates(libraryData) {
  try {
    // Get settings to determine which sections are configured for which type
    const { getSettings } = require('./settings');
    const settings = await getSettings();
    const configuredSections = {
      shows: settings.sections?.shows || [],
      movies: settings.sections?.movies || [],
      music: settings.sections?.music || []
    };

    const verboseLogging = cache.isVerboseLoggingEnabled();

    // Extract all section IDs organized by type
    const sections = libraryData.reduce((acc, lib) => {
      // Determine correct type based on configuration, not just section_type
      let type;
      const sectionId = parseInt(lib.section_id);
      
      if (configuredSections.music.includes(sectionId)) {
        type = 'music';
      } else if (configuredSections.shows.includes(sectionId)) {
        type = 'shows';
      } else if (configuredSections.movies.includes(sectionId)) {
        type = 'movies';
      } else {
        // Default to original section type mapping
        type = lib.section_type === 'show' ? 'shows' : 
               lib.section_type === 'artist' || lib.section_type === 'music' ? 'music' :
               'movies';
      }
      
      if (!acc[type]) acc[type] = [];
      acc[type].push(sectionId);
      return acc;
    }, {});
    
    // Prepare all media requests
    const mediaRequests = [];
    
    Object.entries(sections).forEach(([type, sectionIds]) => {
      sectionIds.forEach(sectionId => {
        mediaRequests.push({
          type,
          sectionId,
          configuredSections
        });
      });
    });
    
    if (verboseLogging) {
      log(`${colors.brightBlue}ℹ${colors.reset} Processing ${mediaRequests.length} media update requests`);
    }
    
    // Process in optimized batches with throttling
    const batchSize = 2; // Reduced batch size for better resource management
    const results = [];
    
    for (let i = 0; i < mediaRequests.length; i += batchSize) {
      // Create batch
      const batch = mediaRequests.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(request => {
        const { type, sectionId, configuredSections } = request;
        return fetchRecentMedia(sectionId, type, configuredSections, verboseLogging);
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Throttle between batches to prevent overwhelming the server
      if (i + batchSize < mediaRequests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Filter and update cache with valid results only
    const validResults = results.filter(result => result.data.length > 0);
    
    if (cacheConfig.DEBUG_MUSIC && verboseLogging) {
      const musicResults = validResults.filter(r => r.type === 'music');
      if (musicResults.length > 0) {
        console.log('Music results being cached:', 
          musicResults.map(r => `${r.type}-${r.sectionId} (${r.data.length} items)`));
      }
    }
    
    // Set with a shorter TTL for recent media (changed from 60 to match our refresh requirements)
    cache.set('recent_media', validResults, 60); // 60 seconds TTL
    
    if (verboseLogging) {
      log(`${colors.brightGreen}✓${colors.reset} Media cache updated successfully with ${validResults.length} sections`);
    }
  } catch (error) {
    logError('Media Update Process', error);
    throw error;
  }
}

/**
 * Update a specific cache item with improved error handling
 * 
 * @async
 * @param {string} key - Cache key
 * @param {Function} fetchFunction - Async function to fetch data
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function updateCacheItem(key, fetchFunction) {
  try {
    const verboseLogging = cache.isVerboseLoggingEnabled();
    const data = await fetchFunction(verboseLogging);
    
    if (!data) {
      log(`${colors.yellow}⚠${colors.reset} Empty data returned for ${key}, skipping cache update`);
      return false;
    }
    
    const success = cache.set(key, 
      key === 'libraries' ? { response: { result: 'success', data } } : data,
      undefined,  // Use default TTL based on key type
      true        // Set silent=true to suppress logging in set() method
    );
    
    if (success) {
      log(`${colors.brightGreen}✓${colors.reset} Cache updated successfully for ${key}`);
    } else {
      log(`${colors.yellow}⚠${colors.reset} Failed to update cache for ${key}`);
    }
    
    return success;
  } catch (error) {
    logError(`Cache Update - ${key}`, error);
    return false;
  }
}

/**
 * Update active user sessions without a full refresh
 * 
 * @async
 * @returns {Promise<boolean>} True if successful
 */
async function updateActiveUsers() {
  try {
    const verboseLogging = cache.isVerboseLoggingEnabled();
    
    // Only update if there's someone listening for user data
    if (cache.getListenerCount('users') > 0) {
      if (verboseLogging) {
        log(`${colors.brightBlue}ℹ${colors.reset} Updating active user sessions`);
      }
      
      const success = await updateActiveUserData(verboseLogging);
      
      if (success && verboseLogging) {
        log(`${colors.brightGreen}✓${colors.reset} Active user sessions updated`);
      }
      
      return success;
    }
    
    if (verboseLogging) {
      log(`${colors.brightBlue}ℹ${colors.reset} No listeners for user data, skipping active user update`);
    }
    
    return false;
  } catch (error) {
    logError('Active User Update', error);
    return false;
  }
}

/**
 * Process the update queue to batch updates
 * 
 * @async
 */
async function processUpdateQueue() {
  if (updateQueue.size === 0) return;
  
  const itemsToUpdate = [...updateQueue];
  updateQueue.clear();
  
  for (const key of itemsToUpdate) {
    if (cache.refreshCallbacks[key]) {
      await cache.forceUpdate(key).catch(err => {
        logError(`Queue Update Error - ${key}`, err);
      });
    }
  }
}

/**
 * Queue an item for update, with batching for efficiency
 * 
 * @param {string} key - Cache key to update
 */
function queueUpdate(key) {
  updateQueue.add(key);
  
  // Set a timer to process the queue if not already scheduled
  if (!queueProcessTimer) {
    queueProcessTimer = setTimeout(() => {
      processUpdateQueue();
      queueProcessTimer = null;
    }, 100); // Process queue after a short delay to allow batching
  }
}

/**
 * Initialize cache with data from Tautulli
 * Fetches libraries, users, and recent media in stages to optimize startup time
 * 
 * @async
 * @returns {Promise<boolean>} True if at least one cache update was successful
 */
async function initializeCache() {
  if (updateInProgress) {
    log(`${colors.yellow}⚠${colors.reset} Update already in progress, skipping...`);
    return false;
  }

  try {
    updateInProgress = true;

    // Initialize with empty data if no configuration
    if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
      cache.set('libraries', { response: { result: 'success', data: [] } });
      cache.set('users', { activity: { sessions: [] }, users: { data: [] } });
      cache.set('recent_media', []);
      log(`${colors.yellow}⚠${colors.reset} No Tautulli configuration found, using empty cache`);
      return true;
    }

    const startTime = Date.now();
    log(`${colors.brightBlue}ℹ${colors.reset} Cache update starting...`);

    // Stage 1: Fetch critical data first (libraries and users)
    const criticalPromises = [
      updateCacheItem('libraries', fetchLibraryData),
      updateCacheItem('users', fetchUserData)
    ];
    
    // Wait for critical data to load before proceeding
    const criticalResults = await Promise.all(criticalPromises);
    const criticalSuccess = criticalResults.some(Boolean);
    
    // Stage 2: Process media updates in the background for faster initial load
    const libraryData = cache.get('libraries');
    if (libraryData?.response?.data) {
      // We don't wait for media data to complete initialization
      processMediaUpdates(libraryData.response.data).catch(err => {
        logError('Background Media Update', err);
      });
    }
    
    // Reset consecutive failures on success
    if (criticalSuccess) {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures++;
    }

    const elapsed = Date.now() - startTime;
    log(`${colors.brightGreen}✓${colors.reset} Cache initialization completed in ${elapsed}ms`);
    
    return criticalSuccess;
  } catch (error) {
    logError('Cache Initialization', error);
    consecutiveFailures++;
    return false;
  } finally {
    updateInProgress = false;
  }
}

/**
 * Register refresh callbacks for different cache data types
 * Sets up functions to be called when cache data needs refreshing
 */
function registerCacheCallbacks() {
  log(`${colors.brightBlue}ℹ${colors.reset} Registering cache refresh callbacks`);
  
  // Register callback for user data refresh
  cache.registerRefreshCallback('users', async () => {
    try {
      log(`${colors.brightBlue}ℹ${colors.reset} Refreshing user data`);
      return await fetchUserData(cache.isVerboseLoggingEnabled());
    } catch (error) {
      logError('User Refresh Callback', error);
      throw error;
    }
  });
  
  // Register callback for library data refresh
  cache.registerRefreshCallback('libraries', async () => {
    try {
      log(`${colors.brightBlue}ℹ${colors.reset} Refreshing library data`);
      return await fetchLibraryData(cache.isVerboseLoggingEnabled());
    } catch (error) {
      logError('Library Refresh Callback', error);
      throw error;
    }
  });
  
  // Register callback for media data refresh
  cache.registerRefreshCallback('recent_media', async () => {
    try {
      log(`${colors.brightBlue}ℹ${colors.reset} Refreshing recent media data`);
      
      // Get library data to process media updates
      let libraryData = cache.get('libraries');
      
      // If library data isn't in cache, try to fetch it directly
      if (!libraryData?.response?.data) {
        log(`${colors.yellow}⚠${colors.reset} Library data not found in cache, attempting direct fetch`);
        
        try {
          // Fetch library data directly
          const fetchedLibraryData = await fetchLibraryData(cache.isVerboseLoggingEnabled());
          
          if (fetchedLibraryData && Array.isArray(fetchedLibraryData) && fetchedLibraryData.length > 0) {
            // Construct proper format expected by processMediaUpdates
            libraryData = { 
              response: { 
                result: 'success', 
                data: fetchedLibraryData 
              } 
            };
            
            // Update the cache with the fetched data
            cache.set('libraries', libraryData);
            log(`${colors.brightGreen}✓${colors.reset} Successfully fetched library data directly`);
          } else {
            log(`${colors.yellow}⚠${colors.reset} Failed to fetch library data directly`);
          }
        } catch (fetchError) {
          log(`${colors.yellow}⚠${colors.reset} Error fetching library data: ${fetchError.message}`);
        }
      }
      
      // Check if we now have library data
      if (libraryData?.response?.data) {
        // Process media updates from library data
        await processMediaUpdates(libraryData.response.data);
      } else {
        // Log warning but don't fail completely
        log(`${colors.yellow}⚠${colors.reset} Unable to refresh media data, library data unavailable`);
      }
      
      // Return the updated or existing media data
      return cache.get('recent_media') || [];
    } catch (error) {
      logError('Media Refresh Callback', error);
      
      // Return existing data instead of failing completely
      const existingData = cache.get('recent_media');
      log(`${colors.yellow}⚠${colors.reset} Returning existing media data due to refresh error`);
      
      return existingData || [];
    }
  });
  
  log(`${colors.brightGreen}✓${colors.reset} Cache refresh callbacks registered`);
}

/**
 * Start background updates for cache data
 * Sets up an interval to periodically refresh cache
 * Uses progressive backoff for failures
 */
function startBackgroundUpdates() {
  // Setup refresh callbacks for cache
  registerCacheCallbacks();
  
  // Clear any existing timers
  if (updateTimer) {
    clearInterval(updateTimer);
    log(`${colors.yellow}⚠${colors.reset} Cleared existing update timer`);
  }
  
  if (activeUserUpdateTimer) {
    clearInterval(activeUserUpdateTimer);
  }
  
  if (mediaUpdateTimer) {
    clearInterval(mediaUpdateTimer);
  }
  
  if (libraryUpdateTimer) {
    clearInterval(libraryUpdateTimer);
  }

  log(`${colors.brightBlue}ℹ${colors.reset} Starting background updates with 60-second intervals`);
  
  // 1. Schedule active user updates every 5 seconds (CHANGED FROM 15 SECONDS)
  // This provides more frequent progress updates for better user experience
  activeUserUpdateTimer = setInterval(async () => {
    try {
      if (!updateInProgress) {
        await updateActiveUsers();
      }
    } catch (error) {
      logError('Active User Update Error', error);
    }
  }, 5000); // Every 5 seconds for more real-time progress updates
  
  // 2. Schedule full user data refresh every 60 seconds
  updateTimer = setInterval(async () => {
    try {
      if (updateInProgress) return;
      
      if (cache.getListenerCount('users') > 0) {
        log(`${colors.brightBlue}ℹ${colors.reset} Scheduled full user data refresh`);
        await cache.forceUpdate('users');
      }
    } catch (error) {
      logError('User Refresh Error', error);
    }
  }, 60000); // Every 60 seconds
  
  // 3. Schedule media data refresh every 60 seconds, offset by 20 seconds
  setTimeout(() => {
    mediaUpdateTimer = setInterval(async () => {
      try {
        if (updateInProgress) return;
        
        if (cache.getListenerCount('recent_media') > 0) {
          log(`${colors.brightBlue}ℹ${colors.reset} Scheduled media data refresh`);
          await cache.forceUpdate('recent_media');
        }
      } catch (error) {
        logError('Media Refresh Error', error);
      }
    }, 60000); // Force 60 seconds
  }, 20000); // Start after 20 seconds offset
  
  // 4. Schedule library data refresh every 60 seconds (changed from 5 minutes)
  setTimeout(() => {
    libraryUpdateTimer = setInterval(async () => {
      try {
        if (updateInProgress) return;
        
        if (cache.getListenerCount('libraries') > 0) {
          log(`${colors.brightBlue}ℹ${colors.reset} Scheduled library data refresh`);
          await cache.forceUpdate('libraries');
        }
      } catch (error) {
        logError('Library Refresh Error', error);
      }
    }, 60000); // Every 60 seconds (changed from 300000)
  }, 40000); // Start after 40 seconds offset
  
  log(`${colors.brightGreen}✓${colors.reset} Background updates started with 60-second intervals`);
}

/**
 * Stop all background update timers
 * Cleans up timer references to prevent memory leaks
 */
function stopBackgroundUpdates() {
  log(`${colors.brightBlue}ℹ${colors.reset} Stopping all background update timers`);
  
  // Clear all interval timers
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
  
  if (activeUserUpdateTimer) {
    clearInterval(activeUserUpdateTimer);
    activeUserUpdateTimer = null;
  }
  
  if (mediaUpdateTimer) {
    clearInterval(mediaUpdateTimer);
    mediaUpdateTimer = null;
  }
  
  if (libraryUpdateTimer) {
    clearInterval(libraryUpdateTimer);
    libraryUpdateTimer = null;
  }
  
  // Clear the queue process timer if active
  if (queueProcessTimer) {
    clearTimeout(queueProcessTimer);
    queueProcessTimer = null;
  }
  
  // Reset update in progress flag
  updateInProgress = false;
  
  // Clear update queue
  updateQueue.clear();
  
  log(`${colors.brightGreen}✓${colors.reset} All background update timers stopped`);
}

/**
 * Restart background timers after they've been stopped
 * Provides a way to reset the timers without recreating the entire system
 */
function restartBackgroundTimers() {
  log(`${colors.brightBlue}ℹ${colors.reset} Restarting background update timers`);
  
  // First stop any existing timers
  stopBackgroundUpdates();
  
  // Then start them again
  startBackgroundUpdates();
  
  log(`${colors.brightGreen}✓${colors.reset} Background update timers restarted`);
}

// Create and export the cache instance and functions
module.exports = {
  cache,
  initializeCache,
  startBackgroundUpdates,
  stopBackgroundUpdates,
  restartBackgroundTimers,
  queueUpdate,  // Explicitly export queueUpdate function
  setVerboseLogging: (enabled) => cache.setVerboseLogging(enabled),
  isVerboseLoggingEnabled: () => cache.isVerboseLoggingEnabled(),
  toggleVerboseLogging: () => cache.toggleVerboseLogging()
};