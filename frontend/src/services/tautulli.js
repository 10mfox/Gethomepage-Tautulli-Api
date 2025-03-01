/**
 * Tautulli service for frontend
 * Provides methods for interacting with the Tautulli API
 * @module services/tautulli
 */
class TautulliService {
  /**
   * Makes an API request to the backend Tautulli proxy
   * 
   * @async
   * @param {string} endpoint - API endpoint
   * @param {Object} [params={}] - Request parameters
   * @returns {Promise<Object>} Response data
   * @throws {Error} If request fails
   */
  async makeRequest(endpoint, params = {}) {
    const response = await fetch(`/api/media/recent?${new URLSearchParams(params)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch from ${endpoint}`);
    }
    const data = await response.json();
    return data;
  }

  /**
   * Get users table data from the API
   * 
   * @async
   * @param {Object} [params={}] - Request parameters
   * @returns {Promise<Object>} Users data
   * @throws {Error} If request fails
   */
  async getUsersTable(params = {}) {
    const response = await fetch(`/api/users?${new URLSearchParams(params)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    const data = await response.json();
    return data.response;
  }

  /**
   * Format time from seconds to a human-readable string
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
}

/**
 * Singleton instance of the TautulliService
 * @type {TautulliService}
 */
export const tautulliService = new TautulliService();