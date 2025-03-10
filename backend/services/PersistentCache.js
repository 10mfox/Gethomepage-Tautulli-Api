/**
 * PersistentCache implementation
 * Provides caching with stale-while-revalidate pattern, validation, and request deduplication
 * @module services/PersistentCache
 */
const NodeCache = require('node-cache');
const { logError, log, colors } = require('../../logger');
const { 
  getTTLForKey, 
  shouldSuppressLogging, 
  VALIDATION_SCHEMAS, 
  RETRY_INTERVALS,
  MAX_REQUESTS_PER_MINUTE,
  CACHE_TTL_SETTINGS
} = require('./cacheConfig');

/**
 * Enhanced persistent cache with validation, fallback, request deduplication,
 * and stale-while-revalidate pattern
 * @class
 */
class PersistentCache {
  /**
   * Create a new PersistentCache instance
   * Initializes NodeCache with optimized settings
   */
  constructor() {
    this.cache = new NodeCache({ 
      stdTTL: 60, // Set default to 60 seconds
      checkperiod: 30, // Check for expired items more frequently (30 seconds)
      useClones: false,    // Disable cloning for better performance
      deleteOnExpire: true, // Delete expired items immediately
      maxKeys: 1000        // Limit maximum number of cached items
    });
    
    this.lastSuccessful = {
      libraries: null,
      users: null,
      recent_media: null,
      timestamp: null
    };
  
    // Track which keys are being refreshed to avoid duplicate refreshes
    this.refreshingKeys = {};
    
    // Track pending requests to enable deduplication
    this.pendingRequests = new Map();
    
    // Callback registry for background refresh operations
    this.refreshCallbacks = {};
    
    // Request rate limiting
    this.requestsInCurrentMinute = 0;
    this.requestRateLimitReset = Date.now() + 60000;
    
    // Tracking for consecutive failures and timestamps
    this.lastRefreshAttempts = {};
    this.keyConsecutiveFailures = {};
    
    // Verbose logging flag
    this.verboseLoggingEnabled = false;
    
    // Stats for monitoring
    this.stats = {
      deduplicatedRequests: 0,
      refreshes: 0,
      staleHits: 0,
      partialUpdates: 0,
      memoryUsage: 0
    };
    
    // Track metadata about cached items
    this.metadata = new Map();
    
    // Track memory usage
    this.memoryUsage = {
      lastCheck: Date.now(),
      estimatedSize: 0,
      lastCleanup: Date.now()
    };
    
    // Listeners for data updates
    this.listeners = {
      users: new Set(),
      libraries: new Set(),
      recent_media: new Set()
    };
    
    // Set up periodic memory usage check
    this._setupMemoryCheck();
  }
  
  /**
   * Set up periodic memory usage check and cleanup
   * 
   * @private
   */
  _setupMemoryCheck() {
    // Check memory usage every minute
    setInterval(() => {
      this._updateMemoryUsage();
      this._cleanupIfNeeded();
    }, 60000);
  }
  
  /**
   * Update estimated memory usage
   * 
   * @private
   */
  _updateMemoryUsage() {
    try {
      const memoryUsage = process.memoryUsage();
      this.stats.memoryUsage = Math.round(memoryUsage.heapUsed / 1024 / 1024); // MB
      
      // Estimate cache memory usage
      let totalSize = 0;
      for (const [key, meta] of this.metadata.entries()) {
        totalSize += meta.size || 0;
      }
      
      this.memoryUsage.estimatedSize = totalSize;
      this.memoryUsage.lastCheck = Date.now();
      
      if (this.verboseLoggingEnabled) {
        log(`${colors.brightBlue}ℹ${colors.reset} Cache memory usage: ${this.stats.memoryUsage}MB (estimated cache: ${Math.round(totalSize/1024/1024)}MB)`);
      }
    } catch (error) {
      // Ignore errors in memory usage calculation
    }
  }
  
  /**
   * Estimate the size of an object in bytes
   * 
   * @param {*} obj - Object to measure
   * @returns {number} Estimated size in bytes
   */
  _estimateObjectSize(obj) {
    const seen = new WeakSet();
    
    const sizeOf = (value) => {
      if (value === null) return 4;
      if (value === undefined) return 0;
      if (typeof value === 'boolean') return 4;
      if (typeof value === 'number') return 8;
      if (typeof value === 'string') return value.length * 2;
      
      if (typeof value === 'object') {
        if (seen.has(value)) return 0;
        seen.add(value);
        
        let size = 0;
        if (Array.isArray(value)) {
          size = 40; // Base array size
          for (const item of value) {
            size += sizeOf(item);
          }
        } else {
          size = 40; // Base object size
          for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
              size += key.length * 2; // Key size
              size += sizeOf(value[key]); // Value size
            }
          }
        }
        return size;
      }
      
      return 8; // Default for functions, etc.
    };
    
    return sizeOf(obj);
  }
  
  /**
   * Clean up least frequently used cache items if memory is high
   * 
   * @private
   */
  _cleanupIfNeeded() {
    const now = Date.now();
    
    // Only run cleanup if it's been at least 5 minutes since last cleanup
    if (now - this.memoryUsage.lastCleanup < 300000) return;
    
    // If memory usage is high (> 200MB) or we have many keys, clean up
    if (this.stats.memoryUsage > 200 || this.cache.keys().length > 500) {
      if (this.verboseLoggingEnabled) {
        log(`${colors.brightYellow}⚠${colors.reset} High memory usage (${this.stats.memoryUsage}MB) or many keys (${this.cache.keys().length}), cleaning up`);
      }
      
      // Get all metadata entries
      const entries = Array.from(this.metadata.entries());
      
      // Sort by access count and last access time (least used first)
      entries.sort((a, b) => {
        // Primary sort by access count
        const accessDiff = (a[1].accessCount || 0) - (b[1].accessCount || 0);
        if (accessDiff !== 0) return accessDiff;
        
        // Secondary sort by last access time
        return (a[1].lastAccessed || 0) - (b[1].lastAccessed || 0);
      });
      
      // Remove the bottom 20% of entries
      const toRemove = Math.ceil(entries.length * 0.2);
      let removedCount = 0;
      let removedSize = 0;
      
      // Never remove critical data types
      const criticalKeys = ['users', 'libraries', 'recent_media'];
      
      for (const [key, meta] of entries) {
        if (criticalKeys.includes(key)) continue;
        
        // Delete from cache and metadata
        this.cache.del(key);
        this.metadata.delete(key);
        
        // Track removed size and count
        removedSize += meta.size || 0;
        removedCount++;
        
        // Stop if we've removed enough
        if (removedCount >= toRemove) break;
      }
      
      if (this.verboseLoggingEnabled) {
        log(`${colors.brightGreen}✓${colors.reset} Removed ${removedCount} items (${Math.round(removedSize/1024/1024)}MB)`);
      }
      
      this.memoryUsage.lastCleanup = now;
    }
  }
  
  /**
   * Register a listener for data updates
   * 
   * @param {string} key - Data type to listen for (users, libraries, recent_media)
   * @param {Function} callback - Callback function
   */
  addListener(key, callback) {
    if (!this.listeners[key]) {
      this.listeners[key] = new Set();
    }
    
    this.listeners[key].add(callback);
    
    if (this.verboseLoggingEnabled) {
      log(`${colors.brightBlue}ℹ${colors.reset} Added listener for ${key}, total listeners: ${this.listeners[key].size}`);
    }
  }
  
  /**
   * Remove a listener for data updates
   * 
   * @param {string} key - Data type
   * @param {Function} callback - Callback function
   */
  removeListener(key, callback) {
    if (!this.listeners[key]) return;
    
    this.listeners[key].delete(callback);
    
    if (this.verboseLoggingEnabled) {
      log(`${colors.brightBlue}ℹ${colors.reset} Removed listener for ${key}, total listeners: ${this.listeners[key].size}`);
    }
  }
  
  /**
   * Get the number of listeners for a data type
   * 
   * @param {string} key - Data type
   * @returns {number} Number of listeners
   */
  getListenerCount(key) {
    return this.listeners[key]?.size || 0;
  }
  
  /**
   * Notify all listeners for a data type
   * 
   * @param {string} key - Data type
   * @param {*} data - Updated data
   */
  notifyListeners(key, data) {
    if (!this.listeners[key]) return;
    
    if (this.verboseLoggingEnabled && this.listeners[key].size > 0) {
      log(`${colors.brightBlue}ℹ${colors.reset} Notifying ${this.listeners[key].size} listeners for ${key}`);
    }
    
    for (const callback of this.listeners[key]) {
      try {
        callback(data);
      } catch (error) {
        logError(`Listener Error - ${key}`, error);
      }
    }
  }
  
  /**
   * Set verbose logging state
   * 
   * @param {boolean} enabled - Whether to enable verbose logging
   * @returns {boolean} New verbose logging state
   */
  setVerboseLogging(enabled) {
    this.verboseLoggingEnabled = !!enabled;
    log(`${colors.brightBlue}ℹ${colors.reset} Cache verbose logging ${this.verboseLoggingEnabled ? 'enabled' : 'disabled'}`);
    return this.verboseLoggingEnabled;
  }
  
  /**
   * Check if verbose logging is enabled
   * 
   * @returns {boolean} Verbose logging state
   */
  isVerboseLoggingEnabled() {
    return this.verboseLoggingEnabled;
  }
  
  /**
   * Toggle verbose logging state
   * 
   * @returns {boolean} New verbose logging state
   */
  toggleVerboseLogging() {
    const newState = !this.verboseLoggingEnabled;
    this.setVerboseLogging(newState);
    return newState;
  }
  
  /**
   * Check if request is within rate limits
   * 
   * @returns {boolean} True if request is allowed, false if rate limited
   */
  checkRateLimit() {
    const now = Date.now();
    if (now > this.requestRateLimitReset) {
      this.requestsInCurrentMinute = 0;
      this.requestRateLimitReset = now + 60000;
    }
    
    if (this.requestsInCurrentMinute >= MAX_REQUESTS_PER_MINUTE) {
      if (this.verboseLoggingEnabled) {
        log(`${colors.yellow}⚠${colors.reset} Rate limit reached, delaying refresh`);
      }
      return false;
    }
    
    this.requestsInCurrentMinute++;
    return true;
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
   * Trigger background refresh for a specific key with improved request deduplication
   * 
   * @param {string} key - Cache key to refresh
   * @returns {Promise<boolean>} Promise that resolves to success status
   */
  async triggerBackgroundRefresh(key) {
    // Skip if no callback or already refreshing
    if (!this.refreshCallbacks[key]) {
      return false;
    }
    
    // Check if this key is already being refreshed
    if (this.refreshingKeys[key]) {
      if (this.verboseLoggingEnabled) {
        log(`${colors.brightBlue}ℹ${colors.reset} Refresh already in progress for ${key}, skipping duplicate refresh`);
      }
      this.stats.deduplicatedRequests++;
      
      // Return the existing Promise if one exists
      if (this.pendingRequests.has(key)) {
        return this.pendingRequests.get(key);
      }
      
      return false;
    }
    
    // Check rate limiting
    if (!this.checkRateLimit()) {
      return false;
    }
    
    // Apply exponential backoff for keys with failures
    const now = Date.now();
    const lastAttempt = this.lastRefreshAttempts[key] || 0;
    const failures = this.keyConsecutiveFailures[key] || 0;
    const backoffIndex = Math.min(failures, RETRY_INTERVALS.length - 1);
    const backoffTime = RETRY_INTERVALS[backoffIndex];
    
    if (failures > 0 && (now - lastAttempt) < backoffTime) {
      if (this.verboseLoggingEnabled) {
        log(`${colors.yellow}⚠${colors.reset} Backoff active for ${key}, skipping refresh`);
      }
      return false;
    }
    
    // Update last attempt time
    this.lastRefreshAttempts[key] = now;
    
    // Create a promise for this refresh operation
    const refreshPromise = this._performRefresh(key);
    
    // Store the promise to enable deduplication of simultaneous requests
    this.pendingRequests.set(key, refreshPromise);
    
    // Remove the promise when it completes
    refreshPromise.finally(() => {
      this.pendingRequests.delete(key);
    });
    
    return refreshPromise;
  }
  
  /**
   * Perform the actual refresh operation
   * 
   * @private
   * @param {string} key - Cache key to refresh
   * @returns {Promise<boolean>} Promise that resolves to success status
   */
  async _performRefresh(key) {
    this.refreshingKeys[key] = true;
    this.stats.refreshes++;
    
    try {
      if (this.verboseLoggingEnabled) {
        log(`${colors.brightBlue}ℹ${colors.reset} Background refresh started for ${key}`);
      }
      
      const data = await this.refreshCallbacks[key]();
      
      // Only update cache if data is valid
      if (data) {
        this.set(key, data);
        
        // Reset failures counter on success
        this.keyConsecutiveFailures[key] = 0;
        
        // Notify listeners about updated data
        this.notifyListeners(key, data);
        
        if (this.verboseLoggingEnabled) {
          log(`${colors.brightGreen}✓${colors.reset} Background refresh completed for ${key}`);
        }
        return true;
      } else {
        throw new Error(`Invalid or empty data returned for ${key}`);
      }
    } catch (error) {
      logError(`Background Refresh - ${key}`, error);
      
      // Increment failures counter
      this.keyConsecutiveFailures[key] = (this.keyConsecutiveFailures[key] || 0) + 1;
      
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
    
    // Clear any existing pending request for this key
    if (this.pendingRequests.has(key)) {
      this.pendingRequests.delete(key);
    }
    
    this.refreshingKeys[key] = false;
    
    return this.triggerBackgroundRefresh(key);
  }

  /**
   * Get a value from the cache with improved stale-while-revalidate pattern
   * Includes optimizations for better backoff and request deduplication
   * 
   * @param {string} key - Cache key to retrieve
   * @param {boolean} [triggerRefresh=true] - Whether to trigger background refresh for stale data
   * @returns {*} Cached value, stale value, or null if not found
   */
  get(key, triggerRefresh = true) {
    // Get the metadata for this key
    const meta = this.metadata.get(key);
    if (meta) {
      // Update access counters
      meta.accessCount = (meta.accessCount || 0) + 1;
      meta.lastAccessed = Date.now();
      this.metadata.set(key, meta);
    }
    
    // Try to get fresh value from cache
    const value = this.cache.get(key);
    if (value) {
      return value;
    }
    
    // If key exists in lastSuccessful (stale data available)
    if (this.lastSuccessful[key]) {
      this.stats.staleHits++;
      
      // Check if we should trigger a refresh
      if (triggerRefresh && this.refreshCallbacks[key]) {
        // Apply rate limiting and backoff
        const now = Date.now();
        const lastAttempt = this.lastRefreshAttempts[key] || 0;
        const timeSinceLastAttempt = now - lastAttempt;
        const failures = this.keyConsecutiveFailures[key] || 0;
        
        // Calculate backoff time based on failures (min 10s, exponential up to 2 min)
        const backoffTime = Math.min(120000, Math.pow(2, failures) * 5000);
        
        // Only refresh if we're past the backoff period and within rate limits
        if (timeSinceLastAttempt > backoffTime && this.checkRateLimit()) {
          this.triggerBackgroundRefresh(key).catch(err => {
            // Silently handle errors as we're returning stale data anyway
            if (this.verboseLoggingEnabled) {
              logError(`Background Refresh Error - ${key}`, err);
            }
          });
          
          if (!shouldSuppressLogging(key, this.verboseLoggingEnabled) && this.verboseLoggingEnabled) {
            log(`${colors.yellow}⚠${colors.reset} Serving stale data for ${key} while refreshing in background`);
          }
        }
      }
      
      // Return stale data immediately
      return this.lastSuccessful[key];
    }
    
    return null;
  }

  /**
   * Set a value in the cache with validation and improved error handling
   * 
   * @param {string} key - Cache key
   * @param {*} value - Value to store
   * @param {number} [ttl] - Time to live in seconds (optional)
   * @param {boolean} [silent=false] - Whether to suppress logging
   * @returns {boolean} True if successful, false otherwise
   */
  set(key, value, ttl, silent = false) {
    try {
      // Skip processing if value is null or undefined
      if (value === null || value === undefined) {
        if (!silent) {
          logError('Cache Update Skipped', { 
            message: `Null or undefined value for ${key}`
          });
        }
        return false;
      }
      
      // Use pre-defined validation schema for faster validation
      const validator = VALIDATION_SCHEMAS[key];
      const isValid = validator ? validator(value) : true;

      if (isValid) {
        // Determine TTL based on key type if not explicitly provided
        const effectiveTTL = ttl !== undefined ? ttl : getTTLForKey(key);
        
        // Calculate estimated size of the value
        const size = this._estimateObjectSize(value);
        
        // Store directly without cloning
        const success = this.cache.set(key, value, effectiveTTL);
        if (success) {
          this.lastSuccessful[key] = value;
          this.lastSuccessful.timestamp = Date.now(); 
          
          // Update or create metadata
          const meta = this.metadata.get(key) || {
            accessCount: 0,
            lastAccessed: Date.now()
          };
          
          meta.size = size;
          meta.ttl = effectiveTTL;
          meta.updated = Date.now();
          
          this.metadata.set(key, meta);

          // Only log if not silent and the key doesn't match patterns that generate excessive logs
          if (!silent && !shouldSuppressLogging(key, this.verboseLoggingEnabled) && this.verboseLoggingEnabled) {
            log(`${colors.brightGreen}✓${colors.reset} Cache updated successfully for ${key} (${Math.round(size/1024)}KB)`);
          }
          
          // Notify listeners about the change
          this.notifyListeners(key, value);
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
   * Update cache metadata without changing the cached value
   * 
   * @param {string} key - Cache key
   * @param {Object} metaUpdates - Metadata updates
   * @returns {boolean} True if successful
   */
  updateMetadata(key, metaUpdates) {
    try {
      const meta = this.metadata.get(key) || {};
      this.metadata.set(key, { ...meta, ...metaUpdates });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get metadata for a cache key
   * 
   * @param {string} key - Cache key
   * @returns {Object|null} Metadata or null if not found
   */
  getMetadata(key) {
    return this.metadata.get(key) || null;
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
    this.metadata.clear();
    log(`${colors.brightBlue}ℹ${colors.reset} Cache flushed`);
    
    // Reset failure tracking
    this.keyConsecutiveFailures = {};
    this.lastRefreshAttempts = {};
    
    // Reset memory usage tracking
    this.memoryUsage = {
      lastCheck: Date.now(),
      estimatedSize: 0,
      lastCleanup: Date.now()
    };
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
    const cacheStats = this.cache.getStats();
    return {
      ...cacheStats,
      deduplicatedRequests: this.stats.deduplicatedRequests,
      refreshes: this.stats.refreshes,
      staleHits: this.stats.staleHits,
      partialUpdates: this.stats.partialUpdates,
      memoryUsage: this.stats.memoryUsage,
      totalKeys: this.cache.keys().length,
      metadataSize: this.metadata.size
    };
  }
  
  /**
   * Get cache hit rate with additional metrics
   * 
   * @returns {Object} Cache hit rate metrics
   */
  getHitRate() {
    const stats = this.cache.getStats();
    const total = stats.gets > 0 ? stats.gets : 1; // Avoid division by zero
    return {
      hits: stats.hits,
      misses: stats.misses,
      staleHits: this.stats.staleHits,
      hitRate: (stats.hits / total * 100).toFixed(2) + '%',
      effectiveHitRate: ((stats.hits + this.stats.staleHits) / total * 100).toFixed(2) + '%'
    };
  }
}

module.exports = PersistentCache;