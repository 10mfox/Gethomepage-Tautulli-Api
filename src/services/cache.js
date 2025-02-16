const NodeCache = require('node-cache');
const { logError, log, colors } = require('../../logger');

// Cache validation schemas for quick type checking
const VALIDATION_SCHEMAS = {
  libraries: (value) => value?.response?.data && Array.isArray(value.response.data),
  users: (value) => value?.activity && value?.users,
  recent_media: (value) => Array.isArray(value) && value.every(item => 
    item?.type && item?.sectionId && Array.isArray(item?.data)
  )
};

class PersistentCache {
  constructor() {
    this.cache = new NodeCache({ 
      stdTTL: 30,
      checkperiod: 60,
      useClones: false // Disable cloning for better performance
    });
    
    this.lastSuccessful = {
      libraries: null,
      users: null,
      recent_media: null,
      timestamp: null
    };
  }

  get(key) {
    return this.cache.get(key) || this.lastSuccessful[key];
  }

  set(key, value) {
    try {
      // Use pre-defined validation schema for faster validation
      const isValid = VALIDATION_SCHEMAS[key] ? 
        VALIDATION_SCHEMAS[key](value) : 
        true;

      if (isValid) {
        // Store directly without cloning
        this.cache.set(key, value);
        this.lastSuccessful[key] = value;
        this.lastSuccessful.timestamp = Date.now(); // Use Date.now() instead of new Date()

        log(`${colors.brightGreen}✓${colors.reset} Cache updated successfully for ${key}`);
        return true;
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

  getLastSuccessfulTimestamp() {
    return this.lastSuccessful.timestamp;
  }

  flushAll() {
    this.cache.flushAll();
  }

  // Get all cache keys - use native keys() method
  keys() {
    return this.cache.keys();
  }

  // Get cache statistics - use native getStats() method
  getStats() {
    return this.cache.getStats();
  }
}

module.exports = new PersistentCache();