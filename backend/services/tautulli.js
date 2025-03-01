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
const RETRY_DELAY = 2000;

/**
 * Maximum number of retry attempts for API requests
 * @type {number}
 */
const MAX_RETRIES = 3;

/**
 * Enhanced service for interacting with Tautulli API
 * Includes batch processing, metrics, and advanced retries
 * @class
 */
class TautulliService {
  /**
   * Create a new TautulliService instance
   * Initializes axios with appropriate defaults
   */
  constructor() {
    this.api = axios.create({
      timeout: 10000,
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
      avgResponseTime: 0
    };
    
    // Track active requests to avoid duplicates
    this.activeRequests = new Map();
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
   * @returns {Promise<Object>} API response data
   * @throws {Error} If all retries fail or configuration is missing
   */
  async makeRequest(cmd, params = {}, options = {}) {
    // Default options
    const { 
      maxRetries = MAX_RETRIES, 
      timeout = 10000,
      deduplicate = true
    } = options;
    
    // Validate configuration
    if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
      throw new Error('Tautulli configuration missing');
    }
    
    // Create a request ID for deduplication
    const requestId = `${cmd}:${JSON.stringify(params)}`;
    
    // If deduplication is enabled and this request is already in progress, reuse the promise
    if (deduplicate && this.activeRequests.has(requestId)) {
      return this.activeRequests.get(requestId);
    }
    
    // Create the request promise
    const request = this._executeRequest(cmd, params, {
      maxRetries,
      timeout,
      requestId
    });
    
    // Store for deduplication if enabled
    if (deduplicate) {
      this.activeRequests.set(requestId, request);
      // Clean up after the request completes
      request.finally(() => {
        this.activeRequests.delete(requestId);
      });
    }
    
    return request;
  }
  
  /**
   * Execute the actual API request with retries
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
    const { maxRetries, timeout, requestId } = options;
    let lastError;
    
    // Update metrics
    this.metrics.totalRequests++;
    
    // Start timing
    const startTime = Date.now();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.api.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
          params: {
            apikey: process.env.TAUTULLI_API_KEY,
            cmd,
            ...params
          },
          timeout: timeout
        });

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

        // Wait before retrying with exponential backoff
        const backoffDelay = RETRY_DELAY * Math.pow(1.5, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    // All retries failed - update metrics
    this.metrics.failedRequests++;
    
    // Format a helpful error message
    throw new Error(this._getErrorMessage(lastError, cmd));
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
   * Execute multiple API requests in batch
   * More efficient than individual calls for bulk operations
   * 
   * @async
   * @param {Array<{command: string, params: Object}>} requests - Array of request objects
   * @param {Object} [options={}] - Batch options
   * @param {number} [options.maxConcurrent=5] - Maximum concurrent requests
   * @param {number} [options.timeout=15000] - Request timeout
   * @returns {Promise<Array<Object>>} Array of response data with same ordering as requests
   */
  async batchRequests(requests, options = {}) {
    const { 
      maxConcurrent = 5,
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
            deduplicate: true
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
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    return results;
  }

  /**
   * Get bulk data from multiple Tautulli endpoints
   * Optimized to fetch all required data in a single batch
   * 
   * @async
   * @returns {Promise<Object>} Combined data from multiple endpoints
   */
  async getBulkData() {
    // Define the batch of requests
    const requests = [
      { command: 'get_activity', params: {} },
      { command: 'get_libraries_table', params: {} },
      { command: 'get_users_table', params: {} }
    ];
    
    // Execute the batch
    const results = await this.batchRequests(requests);
    
    // Process and format the results
    return {
      activity: results[0]?.response?.data || {},
      libraries: results[1]?.response?.data?.data || [],
      users: results[2]?.response?.data?.data || []
    };
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
      activeRequests: this.activeRequests.size
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
      avgResponseTime: 0
    };
  }
}

const tautulliService = new TautulliService();

module.exports = { tautulliService };