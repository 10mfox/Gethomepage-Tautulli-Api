const axios = require('axios');

class TautulliService {
  constructor() {
    this.baseUrl = process.env.TAUTULLI_BASE_URL?.replace(/\/+$/, '');
    this.apiKey = process.env.TAUTULLI_API_KEY;
  }

  async makeRequest(cmd, params = {}) {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v2`, {
        params: {
          apikey: this.apiKey,
          cmd,
          ...params
        }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Tautulli API error: ${error.message}`);
    }
  }

  formatTime(timestamp, format = 'relative') {
    if (!timestamp) return '';
    
    const date = new Date(timestamp * 1000);
    switch (format) {
      case 'absolute':
        return date.toLocaleString();
      case 'iso':
        return date.toISOString();
      case 'shortdate':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'relative':
      default:
        const diff = Math.floor(Date.now() / 1000 - timestamp);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
        return `${Math.floor(diff / 86400)} days ago`;
    }
  }

  formatDuration(minutes) {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours > 0) {
      return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}m` : ''}`;
    }
    return `${remainingMinutes}m`;
  }

  formatTitle(item, format, type) {
    if (!format || !item) return item.title || '';
    
    let result = format;
    const variables = {
      title: item.title || '',
      year: item.year || '',
      added_at: this.formatTime(item.added_at),
      duration: this.formatDuration(Math.floor(item.duration / 60)),
      ...item
    };
    
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\$\{${key}}`, 'g'), value || '');
    });
    
    return result;
  }
}

exports.tautulliService = new TautulliService();