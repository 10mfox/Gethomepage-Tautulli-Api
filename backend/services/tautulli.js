/**
 * Tautulli API service
 * Provides methods for interacting with the Tautulli API
 * @module services/tautulli
 */
const axios = require('axios');
const { cache } = require('./cacheService');

/**
 * Retry delay in milliseconds
 * @type {number}
 */
// CHANGE: Increased from 1000ms to 2000ms for better recovery
const RETRY_DELAY = 2000;

/**
 * Maximum number of retry attempts for API requests
 * @type {number}
 */
// CHANGE: Increased from 2 to 3 retries
const MAX_RETRIES = 3;

/**
 * Request timeout in milliseconds
 * @type {number}
 */
// CHANGE: Increased from 5000ms to 15000ms
const DEFAULT_TIMEOUT = 15000;

/**
 * Enhanced service for interacting with Tautulli API
 * Includes batch processing, connection pooling, metrics, and request deduplication
 * @class
 */
class TautulliService {
  /**
   * Create a new TautulliService instance
   * Initializes axios with appropriate defaults
   */
  constructor() {
    this.api = axios.create({
      timeout: DEFAULT_TIMEOUT,
      headers: { 
        'Accept-Encoding': 'gzip',
        'User-Agent': 'TautulliManager/1.0'
      }
    });
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retries: 0,
      avgResponseTime: 0,
      deduplicatedRequests: 0
    };
    
    // Track active requests to avoid duplicates
    this.pendingRequests = new Map();
    
    // Connection pool for better connection reuse
    this.connectionPool = {
      maxSize: 10,  // Maximum connections to keep open
      idle: [],     // Idle connections
      active: 0     // Currently active connections
    };
    
    // Command queue for throttling
    this.commandQueue = [];
    this.isProcessingQueue = false;
    this.commandRateLimits = {
      'get_activity': { max: 2, interval: 5000, current: 0, lastReset: Date.now() },
      'get_users_table': { max: 2, interval: 5000, current: 0, lastReset: Date.now() },
      'get_recently_added': { max: 5, interval: 5000, current: 0, lastReset: Date.now() },
      'get_libraries_table': { max: 2, interval: 5000, current: 0, lastReset: Date.now() },
      'get_history': { max: 10, interval: 5000, current: 0, lastReset: Date.now() }
    };
    
    // Create etag cache for conditional requests
    this.etagCache = new Map();
  }

  /**
   * Get a connection from the pool or create a new one
   * 
   * @private
   * @returns {Object} Connection object
   */
  _getConnection() {
    // Check for an idle connection
    if (this.connectionPool.idle.length > 0) {
      return this.connectionPool.idle.pop();
    }
    
    // If we're at the pool limit, create a temporary connection
    if (this.connectionPool.active >= this.connectionPool.maxSize) {
      return { api: this.api, temporary: true };
    }
    
    // Create a new persistent connection
    this.connectionPool.active++;
    return { api: this.api, temporary: false };
  }
  
  /**
   * Return a connection to the pool
   * 
   * @private
   * @param {Object} connection - Connection object
   */
  _releaseConnection(connection) {
    if (!connection.temporary) {
      this.connectionPool.idle.push(connection);
      
      // Cap the idle pool size
      while (this.connectionPool.idle.length > this.connectionPool.maxSize) {
        this.connectionPool.idle.shift();
        this.connectionPool.active--;
      }
    }
  }
  
  /**
   * Check and update command rate limits
   * 
   * @private
   * @param {string} cmd - API command
   * @returns {boolean} True if rate limit allows the command
   */
  _checkCommandRateLimit(cmd) {
    const now = Date.now();
    const limit = this.commandRateLimits[cmd] || { max: 10, interval: 5000, current: 0, lastReset: now };
    
    // Reset counter if interval has passed
    if (now - limit.lastReset > limit.interval) {
      limit.current = 0;
      limit.lastReset = now;
    }
    
    // Check if we've hit the limit
    if (limit.current >= limit.max) {
      return false;
    }
    
    // Increment counter
    limit.current++;
    
    // Update the limits object if using the default
    if (!this.commandRateLimits[cmd]) {
      this.commandRateLimits[cmd] = limit;
    }
    
    return true;
  }

  /**
   * Queue a command for execution with rate limiting
   * 
   * @private
   * @param {Function} executor - Function to execute the command
   * @param {string} cmd - API command name
   * @returns {Promise<Object>} Promise that resolves to the command result
   */
  async _queueCommand(executor, cmd) {
    // Create a promise that will resolve when the command is executed
    return new Promise((resolve, reject) => {
      this.commandQueue.push({
        execute: async () => {
          try {
            const result = await executor();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        },
        cmd
      });
      
      // Start processing the queue if not already running
      if (!this.isProcessingQueue) {
        this._processCommandQueue();
      }
    });
  }
  
  /**
   * Process the command queue with rate limiting
   * 
   * @private
   * @async
   */
  async _processCommandQueue() {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.commandQueue.length > 0) {
        const { execute, cmd } = this.commandQueue[0];
        
        // Check rate limit for this command
        if (this._checkCommandRateLimit(cmd)) {
          // Remove from queue first to prevent issues if execution throws
          this.commandQueue.shift();
          
          // Execute the command
          await execute();
        } else {
          // Wait for rate limit to reset
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Make a request to the Tautulli API with retry logic and deduplication
   * 
   * @async
   * @param {string} cmd - Tautulli API command
   * @param {Object} [params={}] - Additional request parameters
   * @param {Object} [options={}] - Request options
   * @param {number} [options.maxRetries] - Maximum number of retries
   * @param {number} [options.timeout] - Request timeout in milliseconds
   * @param {boolean} [options.deduplicate=true] - Whether to deduplicate identical requests
   * @param {boolean} [options.useConditionalGet=true] - Whether to use conditional GET with ETag
   * @returns {Promise<Object>} API response data
   * @throws {Error} If all retries fail or configuration is missing
   */
  async makeRequest(cmd, params = {}, options = {}) {
    // Default options
    const { 
      maxRetries = MAX_RETRIES, 
      timeout = DEFAULT_TIMEOUT,
      deduplicate = true,
      useConditionalGet = true
    } = options;
    
    // Validate configuration
    if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
      throw new Error('Tautulli configuration missing');
    }
    
    // Create a request ID for deduplication
    const requestId = `${cmd}:${JSON.stringify(params)}`;
    
    // If deduplication is enabled and this request is already in progress, reuse the promise
    if (deduplicate && this.pendingRequests.has(requestId)) {
      this.metrics.deduplicatedRequests++;
      console.log(`Deduplicating request: ${requestId}`);
      return this.pendingRequests.get(requestId);
    }
    
    // Create the executor function that will make the actual request
    const executor = () => this._executeRequest(cmd, params, {
      maxRetries,
      timeout,
      requestId,
      useConditionalGet
    });
    
    // Queue the command with rate limiting
    const requestPromise = this._queueCommand(executor, cmd);
    
    // Store for deduplication if enabled
    if (deduplicate) {
      this.pendingRequests.set(requestId, requestPromise);
      
      // Clean up after the request completes
      requestPromise.finally(() => {
        this.pendingRequests.delete(requestId);
      });
    }
    
    return requestPromise;
  }
  
  /**
   * Execute the actual API request with retries and conditional GET
   * 
   * @async
   * @private
   * @param {string} cmd - Tautulli API command
   * @param {Object} params - Request parameters
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response data
   * @throws {Error} If all retries fail
   */
  async _executeRequest(cmd, params, options) {
    const { maxRetries, timeout, requestId, useConditionalGet } = options;
    let lastError;
    
    // Get a connection from the pool
    const connection = this._getConnection();
    
    try {
      // Update metrics
      this.metrics.totalRequests++;
      
      // Start timing
      const startTime = Date.now();
      
      // Prepare headers for conditional request
      const headers = {};
      if (useConditionalGet && this.etagCache.has(requestId)) {
        headers['If-None-Match'] = this.etagCache.get(requestId);
        console.log(`Using conditional GET for ${cmd} with ETag: ${headers['If-None-Match']}`);
      }
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const response = await connection.api.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
            params: {
              apikey: process.env.TAUTULLI_API_KEY,
              cmd,
              ...params
            },
            headers,
            timeout: timeout,
            validateStatus: status => (status >= 200 && status <= 304) // Accept 304 Not Modified
          });

          // Handle 304 Not Modified - return cached data
          if (response.status === 304) {
            console.log(`304 Not Modified for ${cmd}, using cached data`);
            const cachedData = cache.get(`apiResponse:${requestId}`);
            if (cachedData) {
              return cachedData;
            }
            // If we got 304 but no cached data, continue to process response as normal
          }
          
          // If we have an ETag in the response, store it for future requests
          if (response.headers.etag) {
            this.etagCache.set(requestId, response.headers.etag);
            // Update the cache with this response for future 304 responses
            cache.set(`apiResponse:${requestId}`, response.data, 3600); // Cache for 1 hour
          }

          if (!response.data?.response) {
            throw new Error('Invalid response format from Tautulli');
          }
          
          // Request succeeded - update metrics
          this.metrics.successfulRequests++;
          
          // Update average response time
          const elapsed = Date.now() - startTime;
          this.metrics.avgResponseTime = 
            (this.metrics.avgResponseTime * (this.metrics.successfulRequests - 1) + elapsed) / 
            this.metrics.successfulRequests;

          return response.data;
        } catch (error) {
          lastError = error;
          
          // Track retry metrics
          if (attempt > 1) {
            this.metrics.retries++;
          }
          
          // Check if this is the last attempt
          if (attempt === maxRetries) {
            break;
          }

          // CHANGE: Improved backoff strategy with exponential backoff
          const backoffDelay = RETRY_DELAY * Math.pow(1.5, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }

      // All retries failed - update metrics
      this.metrics.failedRequests++;
      
      // Format a helpful error message
      throw new Error(this._getErrorMessage(lastError, cmd));
    } finally {
      // Return the connection to the pool
      this._releaseConnection(connection);
    }
  }
  
  /**
   * Extract a meaningful error message from an API error
   * 
   * @private
   * @param {Error} error - The error object
   * @param {string} cmd - The API command that failed
   * @returns {string} A formatted error message
   */
  _getErrorMessage(error, cmd) {
    // Extract most useful error information
    if (error.response?.data?.response?.message) {
      return `Tautulli API error (${cmd}): ${error.response.data.response.message}`;
    } else if (error.response?.status) {
      return `Tautulli API returned status ${error.response.status} (${cmd})`;
    } else if (error.code === 'ECONNABORTED') {
      return `Tautulli API request timed out (${cmd})`;
    } else if (error.code === 'ECONNREFUSED') {
      return `Could not connect to Tautulli (${cmd}): Connection refused`;
    } else {
      return error.message || `Unknown error in Tautulli API request (${cmd})`;
    }
  }

  /**
   * Execute multiple API requests in batch with improved efficiency
   * 
   * @async
   * @param {Array<{command: string, params: Object}>} requests - Array of request objects
   * @param {Object} [options={}] - Batch options
   * @param {number} [options.maxConcurrent=5] - Maximum concurrent requests
   * @param {number} [options.timeout=8000] - Request timeout
   * @returns {Promise<Array<Object>>} Array of response data with same ordering as requests
   */
  async batchRequests(requests, options = {}) {
    const { 
      maxConcurrent = 5,
      // CHANGE: Increased timeout from 8000ms to 15000ms
      timeout = 15000
    } = options;
    
    // Group requests to process in batches
    const batches = [];
    for (let i = 0; i < requests.length; i += maxConcurrent) {
      batches.push(requests.slice(i, i + maxConcurrent));
    }
    
    // Process each batch sequentially to avoid overloading the server
    const results = [];
    for (const batch of batches) {
      const batchPromises = batch.map(async ({ command, params }) => {
        try {
          return await this.makeRequest(command, params, { 
            timeout,
            deduplicate: true,
            useConditionalGet: true
          });
        } catch (error) {
          console.error(`Error in batch request for ${command}:`, error.message);
          return { error: error.message };
        }
      });
      
      // Wait for the current batch to complete before starting the next
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add a small delay between batches to avoid overloading the server
      if (batches.length > 1) {
        // CHANGE: Increased from 100 to 300ms for more breathing room between batches
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    return results;
  }

  /**
   * Get bulk data from multiple Tautulli endpoints in a single efficient batch
   * 
   * @async
   * @param {Array<string>} endpointTypes - Array of endpoint types to fetch ('activity', 'libraries', 'users')
   * @returns {Promise<Object>} Combined data from multiple endpoints
   */
  async getBulkData(endpointTypes = ['activity', 'libraries', 'users']) {
    // Define the batch of requests
    const requests = [];
    
    if (endpointTypes.includes('activity')) {
      requests.push({ command: 'get_activity', params: {} });
    }
    
    if (endpointTypes.includes('libraries')) {
      requests.push({ command: 'get_libraries_table', params: {} });
    }
    
    if (endpointTypes.includes('users')) {
      requests.push({ command: 'get_users_table', params: {} });
    }
    
    // Execute the batch
    const results = await this.batchRequests(requests);
    
    // Process and format the results
    const data = {};
    
    if (endpointTypes.includes('activity')) {
      data.activity = results[0]?.response?.data || {};
    }
    
    if (endpointTypes.includes('libraries')) {
      data.libraries = results[endpointTypes.indexOf('libraries')]?.response?.data?.data || [];
    }
    
    if (endpointTypes.includes('users')) {
      data.users = results[endpointTypes.indexOf('users')]?.response?.data || {};
    }
    
    return data;
  }

  /**
   * Get user history with caching
   * 
   * @async
   * @param {number|string} userId - User ID
   * @param {Object} [options={}] - Request options
   * @returns {Promise<Object|null>} User's last played item or null if error
   */
  async getUserHistory(userId, options = {}) {
    try {
      // Use the standard API request method
      const response = await this.makeRequest('get_history', {
        user_id: userId,
        length: 1
      }, {
        deduplicate: true,
        ...options
      });
      
      return response?.response?.data?.data?.[0] || null;
    } catch (error) {
      console.error(`Error fetching history for user ${userId}:`, error.message);
      return null;
    }
  }

  /**
   * Get active user sessions only - more efficient than full activity
   * 
   * @async
   * @returns {Promise<Array>} Array of active sessions
   */
  async getActiveSessions() {
    try {
      const response = await this.makeRequest('get_activity', {}, {
        deduplicate: true,
        useConditionalGet: true,
        // CHANGE: Increased from 3000 to 8000ms
        timeout: 8000
      });
      
      return response?.response?.data?.sessions || [];
    } catch (error) {
      console.error('Error fetching active sessions:', error.message);
      return [];
    }
  }

  /**
   * Format duration in seconds to a human-readable string
   * 
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration string (e.g. "2h 30m")
   */
  formatDuration(seconds) {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  /**
   * Format relative time from timestamp
   * 
   * @param {number} timestamp - Unix timestamp in seconds
   * @returns {string} Relative time string (e.g. "2h ago")
   */
  formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    const now = Math.floor(Date.now() / 1000);
    const diff = Math.abs(now - timestamp);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 604800)}w ago`;
  }

  /**
   * Format number with thousands separators
   * 
   * @param {number} number - Number to format
   * @returns {string} Formatted number string
   */
  formatNumber(number) {
    return new Intl.NumberFormat().format(number || 0);
  }

  /**
   * Check if Tautulli is configured
   * 
   * @returns {boolean} True if configured, false otherwise
   */
  isConfigured() {
    return !!(process.env.TAUTULLI_BASE_URL && process.env.TAUTULLI_API_KEY);
  }

  /**
   * Get Tautulli configuration
   * 
   * @returns {Object} Configuration object
   * @returns {string} returns.baseUrl - Tautulli base URL
   * @returns {string} returns.apiKey - Tautulli API key
   */
  getConfig() {
    return {
      baseUrl: process.env.TAUTULLI_BASE_URL || '',
      apiKey: process.env.TAUTULLI_API_KEY || ''
    };
  }
  
  /**
   * Get performance metrics
   * 
   * @returns {Object} Service metrics
   */
  getMetrics() {
    const successRate = this.metrics.totalRequests > 0 ? 
      (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : 
      '0%';
      
    return {
      ...this.metrics,
      successRate,
      activeRequests: this.pendingRequests.size,
      connectionPool: {
        active: this.connectionPool.active,
        idle: this.connectionPool.idle.length,
        max: this.connectionPool.maxSize
      }
    };
  }
  
  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retries: 0,
      avgResponseTime: 0,
      deduplicatedRequests: 0
    };
  }
}

/**
 * Helper function to fetch user history from Tautulli
 * 
 * @async
 * @param {number|string} userId - User ID
 * @returns {Promise<Object|null>} User history data
 */
async function fetchUserHistory(userId) {
  return tautulliService.getUserHistory(userId);
}

const tautulliService = new TautulliService();

module.exports = { 
  tautulliService,
  fetchUserHistory 
};