const axios = require('axios');

class TautulliService {
  constructor() {
    this.api = axios.create({
      timeout: 10000,
      headers: { 'Accept-Encoding': 'gzip' }
    });
  }

  async makeRequest(cmd, params = {}) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
          throw new Error('Tautulli configuration missing');
        }

        const response = await this.api.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
          params: {
            apikey: process.env.TAUTULLI_API_KEY,
            cmd,
            ...params
          }
        });

        if (!response.data?.response) {
          throw new Error('Invalid response format from Tautulli');
        }

        return response.data;
      } catch (error) {
        lastError = error;
        
        // Check if this is the last attempt
        if (attempt === MAX_RETRIES) {
          break;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }

    // If we get here, all retries failed
    throw new Error(lastError.response?.data?.response?.message || lastError.message);
  }

  async getBulkData() {
    const [activityResponse, libraryResponse, usersResponse] = await Promise.all([
      this.makeRequest('get_activity'),
      this.makeRequest('get_libraries_table'),
      this.makeRequest('get_users_table')
    ]);

    return {
      activity: activityResponse?.response?.data || {},
      libraries: libraryResponse?.response?.data?.data || [],
      users: usersResponse?.response?.data?.data || []
    };
  }

  // Format time from seconds
  formatDuration(seconds) {
    if (!seconds) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  // Format relative time
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

  // Format count numbers
  formatNumber(number) {
    return new Intl.NumberFormat().format(number || 0);
  }

  // Check if Tautulli is configured
  isConfigured() {
    return !!(process.env.TAUTULLI_BASE_URL && process.env.TAUTULLI_API_KEY);
  }

  // Get Tautulli configuration
  getConfig() {
    return {
      baseUrl: process.env.TAUTULLI_BASE_URL || '',
      apiKey: process.env.TAUTULLI_API_KEY || ''
    };
  }
}

const tautulliService = new TautulliService();

module.exports = { tautulliService };