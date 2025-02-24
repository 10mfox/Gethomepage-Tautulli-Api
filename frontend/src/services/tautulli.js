class TautulliService {
  async makeRequest(endpoint, params = {}) {
    const response = await fetch(`/api/media/recent?${new URLSearchParams(params)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch from ${endpoint}`);
    }
    const data = await response.json();
    return data;
  }

  async getUsersTable(params = {}) {
    const response = await fetch(`/api/users?${new URLSearchParams(params)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    const data = await response.json();
    return data.response;
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
}

export const tautulliService = new TautulliService();