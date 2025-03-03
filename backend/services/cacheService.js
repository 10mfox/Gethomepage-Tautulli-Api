/**
 * Enhanced persistent cache service for Tautulli data
 * Provides caching with stale-while-revalidate pattern, validation, and background updates
 * @module services/cacheService
 */
const NodeCache = require('node-cache');
const { logError, log, colors } = require('../../logger');

/**
 * Enable music-specific debugging
 * @type {boolean}
 */
const DEBUG_MUSIC = true;

/**
 * Interval for background updates in milliseconds
 * @type {number}
 */
const UPDATE_INTERVAL = process.env.TAUTULLI_REFRESH_INTERVAL ? 
  parseInt(process.env.TAUTULLI_REFRESH_INTERVAL) : 60000;

/**
 * Cache TTL settings by key type (in seconds)
 * @type {Object.<string, number>}
 */
const CACHE_TTL_SETTINGS = {
  users: 30,              // User data expires after 30 seconds
  libraries: 60,          // Library data expires after 60 seconds
  recent_media: 60,       // Recent media data expires after 60 seconds
  userHistory: 30,        // User history expires after 30 seconds
  userList: 30,           // User lists expire after 30 seconds
  recentMedia: 60,        // Media views expire after 60 seconds
  default: 300            // Default TTL for other cache types
};

/**
 * Progressive retry intervals for failed updates (in ms)
 * @type {Array<number>}
 */
const RETRY_INTERVALS = [5000, 15000, 30000, 60000];

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
 * Flag to control verbose logging of cache operations
 * @type {boolean}
 */
let verboseLogging = true; // Set to true to help diagnose issues

/**
 * Validation schemas for cache entries
 * Ensure data is in the expected format before caching
 * @type {Object.<string, Function>}
 */
const VALIDATION_SCHEMAS = {
  libraries: (value) => value?.response?.data && Array.isArray(value.response.data),
  users: (value) => value?.activity && value?.users,
  recent_media: (value) => Array.isArray(value) && value.every(item => 
    item?.type && item?.sectionId && Array.isArray(item?.data)
  )
};

/**
 * Determines which TTL to use for a given cache key
 * 
 * @param {string} key - Cache key
 * @returns {number} TTL in seconds
 */
function getTTLForKey(key) {
  // Match exact key types
  if (CACHE_TTL_SETTINGS[key]) {
    return CACHE_TTL_SETTINGS[key];
  }
  
  // Match key patterns like userHistory:1234 or recentMedia:all:15
  const keyPrefix = key.split(':')[0];
  if (CACHE_TTL_SETTINGS[keyPrefix]) {
    return CACHE_TTL_SETTINGS[keyPrefix];
  }
  
  // Default TTL for other types
  return CACHE_TTL_SETTINGS.default;
}

/**
 * Determines if logging should be suppressed for a given cache key
 * 
 * @param {string} key - Cache key to check
 * @returns {boolean} True if logging should be suppressed
 */
function shouldSuppressLogging(key) {
  // If verbose logging is enabled, don't suppress anything
  if (verboseLogging) {
    return false;
  }
  
  // Suppress logging for these high-volume cache key patterns
  const suppressPatterns = [
    /^userHistory:/,      // User history entries
    /^userList:/,         // User list with filtering/sorting
    /^recentMedia:/       // Recent media with various filters
  ];
  
  return suppressPatterns.some(pattern => pattern.test(key));
}

/**
 * Toggle verbose logging for all cache operations
 * 
 * @param {boolean} enabled - Whether to enable verbose logging
 */
function setVerboseLogging(enabled) {
  verboseLogging = enabled;
  log(`${colors.brightBlue}ℹ${colors.reset} Cache verbose logging ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Enhanced persistent cache with validation, fallback, and stale-while-revalidate pattern
 * Maintains last successful values for resilience
 * @class
 */
class PersistentCache {
  /**
   * Create a new PersistentCache instance
   * Initializes NodeCache with optimized settings
   */
  constructor() {
    this.cache = new NodeCache({ 
      stdTTL: CACHE_TTL_SETTINGS.default, // Default TTL
      checkperiod: 10,     // Check for expired items more frequently (10 seconds)
      useClones: false,    // Disable cloning for better performance
      deleteOnExpire: true // IMPORTANT: Delete expired items immediately
    });
    
    this.lastSuccessful = {
      libraries: null,
      users: null,
      recent_media: null,
      timestamp: null
    };

    // Track which keys are being refreshed to avoid duplicate refreshes
    this.refreshingKeys = {};
    
    // Callback registry for background refresh operations
    this.refreshCallbacks = {};
    
    // Set up timers for high-priority cache items
    this._setupPriorityRefreshes();
  }
  
  /**
   * Set up timers for high-priority cache items
   * Ensures user and media data are refreshed at appropriate intervals
   * @private
   */
  _setupPriorityRefreshes() {
    // Refresh user data every 30 seconds
    log(`${colors.brightBlue}ℹ${colors.reset} Setting up priority refresh for users data (${CACHE_TTL_SETTINGS.users}s)`);
    setInterval(() => {
      if (this.refreshCallbacks['users'] && !this.refreshingKeys['users']) {
        log(`${colors.brightBlue}ℹ${colors.reset} Triggering priority refresh for users data`);
        this.triggerBackgroundRefresh('users');
      }
    }, CACHE_TTL_SETTINGS.users * 1000);
    
    // Refresh media data every 60 seconds
    log(`${colors.brightBlue}ℹ${colors.reset} Setting up priority refresh for media data (${CACHE_TTL_SETTINGS.recent_media}s)`);
    setInterval(() => {
      if (this.refreshCallbacks['recent_media'] && !this.refreshingKeys['recent_media']) {
        log(`${colors.brightBlue}ℹ${colors.reset} Triggering priority refresh for media data`);
        this.triggerBackgroundRefresh('recent_media');
      }
    }, CACHE_TTL_SETTINGS.recent_media * 1000);
  }

  /**
   * Register a refresh callback for a specific cache key
   * 
   * @param {string} key - Cache key
   * @param {Function} callback - Async function to refresh the data
   */
  registerRefreshCallback(key, callback) {
    if (typeof callback === 'function') {
      this.refreshCallbacks[key] = callback;
      log(`${colors.brightBlue}ℹ${colors.reset} Registered refresh callback for ${key}`);
    }
  }

  /**
   * Trigger background refresh for a specific key
   * 
   * @param {string} key - Cache key to refresh
   * @returns {Promise<boolean>} Promise that resolves to success status
   */
  async triggerBackgroundRefresh(key) {
    if (!this.refreshCallbacks[key]) {
      return false;
    }

    try {
      this.refreshingKeys[key] = true;
      log(`${colors.brightBlue}ℹ${colors.reset} Background refresh started for ${key}`);
      const data = await this.refreshCallbacks[key]();
      this.set(key, data);
      log(`${colors.brightGreen}✓${colors.reset} Background refresh completed for ${key}`);
      return true;
    } catch (error) {
      logError(`Background Refresh - ${key}`, error);
      return false;
    } finally {
      this.refreshingKeys[key] = false;
    }
  }

  /**
   * Force an immediate update of a cache key
   * This is useful for API endpoints to ensure fresh data
   * 
   * @param {string} key - Cache key to update
   * @returns {Promise<boolean>} True if update was successful
   */
  async forceUpdate(key) {
    if (!this.refreshCallbacks[key]) {
      return false;
    }
    
    log(`${colors.brightBlue}ℹ${colors.reset} Forcing immediate update for ${key}`);
    
    try {
      const data = await this.refreshCallbacks[key]();
      this.set(key, data);
      return true;
    } catch (error) {
      logError(`Force Update - ${key}`, error);
      return false;
    }
  }

  /**
   * Get a value from the cache with stale-while-revalidate pattern
   * If value is expired but exists in lastSuccessful, returns stale data
   * and triggers a background refresh
   * 
   * @param {string} key - Cache key to retrieve
   * @param {boolean} [triggerRefresh=true] - Whether to trigger background refresh for stale data
   * @returns {*} Cached value, stale value, or null if not found
   */
  get(key, triggerRefresh = true) {
    // Try to get fresh value from cache
    const value = this.cache.get(key);
    if (value) {
      return value;
    }
    
    // If key exists in lastSuccessful (stale data available)
    if (this.lastSuccessful[key]) {
      // Optionally trigger background refresh if not already happening
      if (triggerRefresh && this.refreshCallbacks[key] && !this.refreshingKeys[key]) {
        this.triggerBackgroundRefresh(key);
        
        if (!shouldSuppressLogging(key)) {
          log(`${colors.yellow}⚠${colors.reset} Serving stale data for ${key} while refreshing in background`);
        }
      }
      
      // Return stale data immediately
      return this.lastSuccessful[key];
    }
    
    return null;
  }

  /**
   * Set a value in the cache with validation
   * 
   * @param {string} key - Cache key
   * @param {*} value - Value to store
   * @param {number} [ttl] - Time to live in seconds (optional)
   * @param {boolean} [silent=false] - Whether to suppress logging
   * @returns {boolean} True if successful, false otherwise
   */
  set(key, value, ttl, silent = false) {
    try {
      // Use pre-defined validation schema for faster validation
      const isValid = VALIDATION_SCHEMAS[key] ? 
        VALIDATION_SCHEMAS[key](value) : 
        true;

      if (isValid) {
        // Determine TTL based on key type if not explicitly provided
        const effectiveTTL = ttl !== undefined ? ttl : getTTLForKey(key);
        
        // Store directly without cloning
        const success = this.cache.set(key, value, effectiveTTL);
        if (success) {
          this.lastSuccessful[key] = value;
          this.lastSuccessful.timestamp = Date.now(); 

          // Only log if not silent and the key doesn't match patterns that generate excessive logs
          if (!silent && !shouldSuppressLogging(key)) {
            log(`${colors.brightGreen}✓${colors.reset} Cache updated successfully for ${key}`);
          }
        }
        return success;
      }

      logError('Cache Update Skipped', { 
        message: `Invalid data format for ${key}`
      });
      return false;
    } catch (error) {
      logError('Cache Set Error', error);
      return false;
    }
  }

  /**
   * Get timestamp of last successful cache update
   * 
   * @returns {number|null} Timestamp or null if no successful updates
   */
  getLastSuccessfulTimestamp() {
    return this.lastSuccessful.timestamp;
  }

  /**
   * Flush all cache entries
   */
  flushAll() {
    this.cache.flushAll();
    log(`${colors.brightBlue}ℹ${colors.reset} Cache flushed`);
  }

  /**
   * Get all cache keys
   * 
   * @returns {Array<string>} Array of cache keys
   */
  keys() {
    return this.cache.keys();
  }

  /**
   * Get cache statistics
   * 
   * @returns {Object} Cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }
  
  /**
   * Get cache hit rate
   * 
   * @returns {Object} Cache hit rate metrics
   */
  getHitRate() {
    const stats = this.cache.getStats();
    const total = stats.gets > 0 ? stats.gets : 1; // Avoid division by zero
    return {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: (stats.hits / total * 100).toFixed(2) + '%'
    };
  }
}

// Create a singleton instance
const cache = new PersistentCache();

// Create and export the cache instance and functions
const cacheExports = {
  cache,
  initializeCache,
  startBackgroundUpdates,
  setVerboseLogging
};

/**
 * Fetch library data from Tautulli
 * 
 * @async
 * @returns {Promise<Array>} Array of library objects
 */
async function fetchLibraryData() {
  try {
    // Break circular dependency by requiring tautulliService at runtime
    const { tautulliService } = require('./tautulli');
    
    log(`${colors.brightBlue}ℹ${colors.reset} Fetching library data from Tautulli`);
    
    const data = await tautulliService.makeRequest('get_libraries_table', {}, {
      deduplicate: true,
      maxRetries: 2,
      timeout: 8000
    });
    
    if (!data?.response?.data?.data) {
      log(`${colors.yellow}⚠${colors.reset} Invalid library data format received`);
      return [];
    }

    log(`${colors.brightGreen}✓${colors.reset} Fetched library data: ${data.response.data.data.length} libraries`);

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
 * @returns {Promise<Object>} Object containing activity and users data
 */
async function fetchUserData() {
  try {
    // Break circular dependency by requiring tautulliService at runtime
    const { tautulliService } = require('./tautulli');
    
    log(`${colors.brightBlue}ℹ${colors.reset} Fetching user data from Tautulli`);
    
    // Use the batching capability of tautulliService
    const requests = [
      { command: 'get_activity', params: {} },
      { command: 'get_users_table', params: { length: 1000 } }
    ];
    
    const [activityResponse, usersResponse] = await tautulliService.batchRequests(requests, {
      maxConcurrent: 2,
      timeout: 8000
    });

    const userData = {
      activity: activityResponse?.response?.data || { sessions: [] },
      users: usersResponse?.response?.data || { data: [] }
    };

    log(`${colors.brightGreen}✓${colors.reset} Fetched user data: ${userData.activity.sessions?.length || 0} active sessions, ${userData.users.data?.length || 0} users`);

    return userData;
  } catch (error) {
    const errorMessage = error.message || 'Unknown error';
    logError('User Data Fetch', { message: errorMessage });
    return { activity: { sessions: [] }, users: { data: [] } };
  }
}

/**
 * Fetch recent media for a specific section
 * 
 * @async
 * @param {number|string} sectionId - Tautulli section ID
 * @param {string} mediaType - Media type (movies, shows, music)
 * @param {Object} configuredSections - All configured section IDs by type
 * @returns {Promise<Object>} Object with section media data
 */
async function fetchRecentMedia(sectionId, mediaType, configuredSections) {
  try {
    // Break circular dependency by requiring tautulliService at runtime
    const { tautulliService } = require('./tautulli');
    
    const parsedSectionId = parseInt(sectionId);
    
    // Determine correct section type based on configuration
    const actualType = 
      configuredSections.music.includes(parsedSectionId) ? 'music' :
      configuredSections.shows.includes(parsedSectionId) ? 'shows' :
      'movies';
    
    if (DEBUG_MUSIC && actualType === 'music') {
      console.log(`Fetching section ${parsedSectionId} as ${actualType} (requested as ${mediaType})`);
    }
    
    log(`${colors.brightBlue}ℹ${colors.reset} Fetching recent media for section ${parsedSectionId} (${actualType})`);
    
    const response = await tautulliService.makeRequest('get_recently_added', {
      section_id: parsedSectionId,
      count: 15
    }, {
      deduplicate: true,
      timeout: 8000
    });

    if (DEBUG_MUSIC && actualType === 'music') {
      const itemCount = response?.response?.data?.recently_added?.length || 0;
      console.log(`Section ${parsedSectionId} returned ${itemCount} items`);
    }

    const itemCount = response?.response?.data?.recently_added?.length || 0;
    log(`${colors.brightGreen}✓${colors.reset} Fetched ${itemCount} recent items for section ${parsedSectionId}`);

    return {
      type: actualType, // Use the correct type based on configuration
      sectionId: parsedSectionId,
      data: response?.response?.data?.recently_added || []
    };
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
 * Process media updates in the background
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
    
    // Use batching for efficient media updates
    const mediaRequests = [];
    
    Object.entries(sections).forEach(([type, sectionIds]) => {
      sectionIds.forEach(sectionId => {
        mediaRequests.push(
          fetchRecentMedia(sectionId, type, configuredSections)
        );
      });
    });
    
    log(`${colors.brightBlue}ℹ${colors.reset} Processing ${mediaRequests.length} media update requests`);
    
    // Fetch media in parallel but with limits
    let mediaResults;
    if (mediaRequests.length <= 4) {
      // For a small number of sections, fetch all in parallel
      mediaResults = await Promise.all(mediaRequests);
    } else {
      // For many sections, process in batches
      const batchSize = 4;
      mediaResults = [];
      
      for (let i = 0; i < mediaRequests.length; i += batchSize) {
        const batch = mediaRequests.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch);
        mediaResults.push(...batchResults);
        
        // Add a small delay between batches
        if (i + batchSize < mediaRequests.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
    
    // Update cache with media results that have data
    const validMediaResults = mediaResults.filter(result => result.data.length > 0);
    
    if (DEBUG_MUSIC) {
      const musicResults = validMediaResults.filter(r => r.type === 'music');
      if (musicResults.length > 0) {
        console.log('Music results being cached:', 
          musicResults.map(r => `${r.type}-${r.sectionId} (${r.data.length} items)`));
      }
    }
    
    cache.set('recent_media', validMediaResults);
    
    log(`${colors.brightGreen}✓${colors.reset} Media cache updated successfully with ${validMediaResults.length} sections`);
  } catch (error) {
    logError('Media Update Process', error);
    throw error;
  }
}

/**
 * Update a specific cache item
 * 
 * @async
 * @param {string} key - Cache key
 * @param {Function} fetchFunction - Async function to fetch data
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function updateCacheItem(key, fetchFunction) {
  try {
    const data = await fetchFunction();
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
 * Start background updates for cache data
 * Sets up an interval to periodically refresh cache
 * Uses progressive backoff for failures
 */
function startBackgroundUpdates() {
  // Setup refresh callbacks for cache
  registerCacheCallbacks();
  
  // Clear any existing timer
  if (updateTimer) {
    clearInterval(updateTimer);
    log(`${colors.yellow}⚠${colors.reset} Cleared existing update timer`);
  }

  // Setup the background update interval
  log(`${colors.brightBlue}ℹ${colors.reset} Starting background updates with interval: ${UPDATE_INTERVAL}ms`);
  
  updateTimer = setInterval(async () => {
    try {
      log(`${colors.brightBlue}ℹ${colors.reset} Background update triggered`);
      
      // Skip update if one is already in progress
      if (updateInProgress) {
        log(`${colors.yellow}⚠${colors.reset} Update already in progress, skipping`);
        return;
      }
      
      // Calculate backoff interval based on consecutive failures
      const backoffIndex = Math.min(consecutiveFailures, RETRY_INTERVALS.length - 1);
      const backoffInterval = RETRY_INTERVALS[backoffIndex];
      
      // If we're in backoff mode, check if it's time to retry
      if (consecutiveFailures > 0) {
        const lastUpdate = cache.getLastSuccessfulTimestamp();
        const now = Date.now();
        
        // Skip this update cycle if we're in backoff
        if (lastUpdate && (now - lastUpdate < backoffInterval)) {
          log(`${colors.yellow}⚠${colors.reset} In backoff mode, next retry in ${Math.ceil((backoffInterval - (now - lastUpdate)) / 1000)}s`);
          return;
        }
        
        log(`${colors.brightBlue}ℹ${colors.reset} Retrying after backoff (failures: ${consecutiveFailures})`);
      }
      
      const success = await initializeCache();
      
      if (success) {
        // Reset consecutive failures counter on success
        consecutiveFailures = 0;
      } else {
        // Increment failure counter
        consecutiveFailures++;
        log(`${colors.yellow}⚠${colors.reset} Background update failed, consecutive failures: ${consecutiveFailures}`);
      }
    } catch (error) {
      logError('Background Update Error', error);
      consecutiveFailures++;
    }
  }, UPDATE_INTERVAL);
  
  log(`${colors.brightBlue}ℹ${colors.reset} Background updates started with ${UPDATE_INTERVAL / 1000}s interval`);
}

/**
 * Register refresh callbacks for cache items
 * These functions are used by the cache's stale-while-revalidate pattern
 */
function registerCacheCallbacks() {
  // Libraries refresh
  cache.registerRefreshCallback('libraries', fetchLibraryData);
  
  // Users refresh
  cache.registerRefreshCallback('users', fetchUserData);
  
  // Recent media refresh
  cache.registerRefreshCallback('recent_media', async () => {
    const { getSettings } = require('./settings');
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
          fetchRecentMedia(parsedSectionId, type, configuredSections)
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
}

module.exports = cacheExports;