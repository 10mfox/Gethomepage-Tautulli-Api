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

  formatTitle(item, format, type) {
    if (!format || !item) return item.title || '';
    
    let result = format;
    const variables = {
      title: item.title || '',
      year: item.year || '',
      added_at: this.formatTime(item.added_at),
      duration: item.duration ? `${Math.floor(item.duration / 60)}m` : '',
      ...item
    };
    
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\$\{${key}}`, 'g'), value);
    });
    
    return result;
  }

  async getUsers({ order_column = 'friendly_name', order_dir = 'asc', search = '' } = {}) {
    const data = await this.makeRequest('get_users_table', {
      order_column,
      order_dir,
      search
    });
    return data.response.data;
  }

  async getUserDetails(userId) {
    const [userResponse, watchTimeResponse] = await Promise.all([
      this.makeRequest('get_user', { user_id: userId }),
      this.makeRequest('get_user_watch_time_stats', { user_id: userId, query_days: 'all' })
    ]);
    
    return {
      ...userResponse.response.data,
      watch_stats: watchTimeResponse.response.data
    };
  }

  async getRecentMedia(type, sectionIds, formats, count = 5) {
    const ids = Array.isArray(sectionIds) ? sectionIds : [sectionIds];
    
    const promises = ids.map(id =>
      this.makeRequest('get_recently_added', {
        section_id: id,
        count
      })
    );

    const responses = await Promise.all(promises);
    let allItems = [];

    responses.forEach((response, index) => {
      const items = response.response?.data?.recently_added || [];
      const sectionId = ids[index];
      
      items.forEach(item => {
        allItems.push({
          ...item,
          formatted_title: this.formatTitle(item, formats[sectionId]?.title, type),
          formatted_time: this.formatTime(item.added_at, formats[sectionId]?.added)
        });
      });
    });

    allItems.sort((a, b) => (b.added_at || 0) - (a.added_at || 0));
    return allItems.slice(0, count);
  }
}

exports.tautulliService = new TautulliService();