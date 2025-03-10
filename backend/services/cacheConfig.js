/**
 * Cache configuration and settings
 * Contains constants and helper functions for the cache system
 * @module services/cacheConfig
 */
const fs = require('fs').promises;
const path = require('path');
const { logError, log, colors } = require('../../logger');

/**
 * Enable music-specific debugging
 * @type {boolean}
 */
const DEBUG_MUSIC = false; // Disabled by default to reduce console spam

/**
 * Cache TTL settings by key type (in seconds)
 * These values will be updated at runtime from persistent settings
 * @type {Object.<string, number>}
 */
let CACHE_TTL_SETTINGS = {
  users: 60,              // User data expires after 60 seconds
  libraries: 60,          // Library data expires after 60 seconds
  recent_media: 60,       // Recent media data expires after 60 seconds
  userHistory: 60,        // User history expires after 60 seconds
  userList: 60,           // User lists expire after 60 seconds
  recentMedia: 60,        // Media views expire after 60 seconds
  default: 60             // Default TTL for other cache types
};

/**
 * Interval for background updates in milliseconds
 * Can be updated at runtime from persistent settings
 * @type {number}
 */
let UPDATE_INTERVAL = 60000; // 60 seconds default

/**
 * Maximum requests allowed per minute to prevent excess API calls
 * Can be updated at runtime from persistent settings
 * @type {number}
 */
let MAX_REQUESTS_PER_MINUTE = 20;

/**
 * Progressive retry intervals for failed updates (in ms)
 * @type {Array<number>}
 */
const RETRY_INTERVALS = [10000, 30000, 60000, 120000]; // Backoff times

/**
 * Validation schemas for cache entries
 * Ensure data is in the expected format before caching
 * @type {Object.<string, Function>}
 */
const VALIDATION_SCHEMAS = {
  // More flexible validation for library data
  libraries: (value) => {
    // Accept various library data formats
    if (Array.isArray(value)) return true;
    if (value?.response?.data && Array.isArray(value.response.data)) return true;
    if (value?.response?.data?.data && Array.isArray(value.response.data.data)) return true;
    return false;
  },
  users: (value) => value?.activity && value?.users,
  recent_media: (value) => Array.isArray(value) && value.every(item => 
    item?.type && item?.sectionId && Array.isArray(item?.data)
  )
};

// Settings file path
const CACHE_SETTINGS_PATH = path.join(__dirname, '..', '..', 'config', 'cache-settings.json');

/**
 * Load cache settings from config file
 * 
 * @async
 * @returns {Promise<boolean>} True if settings were loaded successfully
 */
async function loadCacheSettings() {
  try {
    const data = await fs.readFile(CACHE_SETTINGS_PATH, 'utf8');
    const settings = JSON.parse(data);
    
    // Force 60 seconds for all TTL settings regardless of what's in the file
    CACHE_TTL_SETTINGS.users = 60;
    CACHE_TTL_SETTINGS.libraries = 60;
    CACHE_TTL_SETTINGS.recent_media = 60;
    CACHE_TTL_SETTINGS.default = 60;
    CACHE_TTL_SETTINGS.userHistory = 60;
    CACHE_TTL_SETTINGS.userList = 60;
    CACHE_TTL_SETTINGS.recentMedia = 60;
    
    // Keep the max requests setting but force refresh interval to 60 seconds
    MAX_REQUESTS_PER_MINUTE = settings.max_requests || 20;
    UPDATE_INTERVAL = 60000;
    
    // Update environment variable for consistency
    process.env.TAUTULLI_REFRESH_INTERVAL = "60000";
    
    log(`${colors.brightGreen}✓${colors.reset} Loaded cache settings with 60-second refresh enforced`);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logError('Loading Cache Settings', error);
    }
    return false;
  }
}

// Try loading settings at module initialization
loadCacheSettings().catch(() => {
  log(`${colors.yellow}⚠${colors.reset} Using default cache settings`);
});

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
 * @param {boolean} verboseLogging - Whether verbose logging is enabled
 * @returns {boolean} True if logging should be suppressed
 */
function shouldSuppressLogging(key, verboseLogging) {
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

module.exports = {
  DEBUG_MUSIC,
  get UPDATE_INTERVAL() { return UPDATE_INTERVAL; },
  get CACHE_TTL_SETTINGS() { return CACHE_TTL_SETTINGS; },
  get MAX_REQUESTS_PER_MINUTE() { return MAX_REQUESTS_PER_MINUTE; },
  RETRY_INTERVALS,
  VALIDATION_SCHEMAS,
  getTTLForKey,
  shouldSuppressLogging,
  loadCacheSettings // Export so it can be called when settings are updated
};