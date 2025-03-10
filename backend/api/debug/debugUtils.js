/**
 * Debug utility functions
 * Shared helper functions for debug routes
 * @module api/debug/debugUtils
 */
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

/**
 * Helper function to get local IP address
 * 
 * @returns {string} Local IP address
 */
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

/**
 * Helper function to format uptime in a human-readable way
 * 
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

/**
 * Helper function to count the number of configured sections
 * 
 * @param {Object} settings - Application settings
 * @returns {string} String showing configured section counts
 */
function countConfiguredSections(settings) {
  if (!settings || !settings.sections) return "0 sections";
  
  const movies = settings.sections.movies?.length || 0;
  const shows = settings.sections.shows?.length || 0;
  const music = settings.sections.music?.length || 0;
  const total = movies + shows + music;
  
  return `${total} sections (${movies} movies, ${shows} shows, ${music} music)`;
}

/**
 * Helper function to check settings file status
 * 
 * @async
 * @returns {string} Settings file status
 */
async function checkSettingsFile() {
  try {
    const configFile = path.join(__dirname, '..', '..', '..', 'config', 'settings.json');
    const stats = await fs.stat(configFile);
    return `Found (${formatFileSize(stats.size)}, modified ${new Date(stats.mtime).toLocaleString()})`;
  } catch (error) {
    return "Not found or inaccessible";
  }
}

/**
 * Helper function to format file size
 * 
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Helper function to get cache TTL settings
 * 
 * @returns {Object} Cache TTL settings
 */
function getCacheTTLSettings() {
  try {
    // Try to get from the module
    const cacheService = require('../../services/cacheService');
    
    // If the module exports the TTL settings directly, use them
    if (cacheService.CACHE_TTL_SETTINGS) {
      return {
        users: cacheService.CACHE_TTL_SETTINGS.users || 300,
        libraries: cacheService.CACHE_TTL_SETTINGS.libraries || 600,
        recent_media: cacheService.CACHE_TTL_SETTINGS.recent_media || 600,
        default: cacheService.CACHE_TTL_SETTINGS.default || 600,
        max_requests: cacheService.MAX_REQUESTS_PER_MINUTE || 20
      };
    }
    
    // Otherwise, use default values
    return {
      users: 300,
      libraries: 600,
      recent_media: 600,
      default: 600,
      max_requests: 20
    };
  } catch (error) {
    // Default values on error
    return {
      users: 300,
      libraries: 600,
      recent_media: 600,
      default: 600,
      max_requests: 20
    };
  }
}

/**
 * Get system data for debug interface
 * 
 * @async
 * @returns {Object} System information data
 */
async function getSystemInfo() {
  const { getSettings } = require('../../services/settings');
  const { cache } = require('../../services/cacheService');
  
  // Get cache statistics
  const stats = cache.getStats();
  const hitRate = cache.getHitRate();
  const lastUpdated = cache.getLastSuccessfulTimestamp();
  const keys = cache.keys();
  
  // Get system information
  const settings = await getSettings();
  const { TAUTULLI_BASE_URL: baseUrl, TAUTULLI_API_KEY: apiKey } = settings.env;
  
  // Get local IP address
  const localIp = getLocalIpAddress();
  
  // Get current cache configuration
  const cacheService = require('../../services/cacheService');
  const verboseLogging = cacheService.isVerboseLoggingEnabled();
  
  // Get system uptime in a more readable format
  const uptime = formatUptime(process.uptime());
  const systemUptime = formatUptime(os.uptime());
  
  return {
    general: {
      title: "Server Information",
      items: [
        { label: "Environment", value: process.env.NODE_ENV || "development" },
        { label: "Server Port", value: process.env.TAUTULLI_CUSTOM_PORT || 3010 },
        { label: "Refresh Interval", value: `${Math.round((process.env.TAUTULLI_REFRESH_INTERVAL || 300000)/1000)} seconds` },
        { label: "Server Time", value: new Date().toLocaleString() },
        { label: "Server Uptime", value: uptime },
        { label: "System Uptime", value: systemUptime },
        { label: "Platform", value: `${os.platform()} (${os.release()})` },
        { label: "Architecture", value: os.arch() },
        { label: "Local IP Address", value: localIp },
        { label: "CPU Cores", value: os.cpus().length }
      ]
    },
    tautulli: {
      title: "Tautulli Connection",
      items: [
        { label: "Connection Status", value: baseUrl ? "Connected" : "Not Configured", 
          status: baseUrl ? "good" : "bad" },
        { label: "Base URL", value: baseUrl || "Not set" },
        { label: "API Key", value: apiKey ? "**********" + apiKey.substr(-4) : "Not set" }
      ]
    },
    cache: {
      title: "Cache Statistics",
      items: [
        { label: "Total Cache Keys", value: keys.length },
        { label: "Cache Hits", value: stats.hits },
        { label: "Cache Misses", value: stats.misses },
        { label: "Hit Rate", value: hitRate.hitRate },
        { label: "Last Updated", value: lastUpdated ? new Date(lastUpdated).toLocaleString() : "Never" },
        { label: "Verbose Logging", value: verboseLogging ? "Enabled" : "Disabled", 
          status: verboseLogging ? "good" : null }
      ]
    },
    memory: {
      title: "Memory Usage",
      items: [
        { label: "System Total", value: `${Math.round(os.totalmem() / (1024 * 1024 * 1024) * 100) / 100} GB` },
        { label: "System Free", value: `${Math.round(os.freemem() / (1024 * 1024 * 1024) * 100) / 100} GB` },
        { label: "Process RSS", value: `${Math.round(process.memoryUsage().rss / (1024 * 1024) * 100) / 100} MB` },
        { label: "Process Heap", value: `${Math.round(process.memoryUsage().heapUsed / (1024 * 1024) * 100) / 100} MB` }
      ]
    },
    config: {
      title: "Application Configuration",
      items: [
        { label: "Configured Libraries", value: countConfiguredSections(settings) },
        { label: "Settings File", value: await checkSettingsFile() },
        { label: "Cache Service", value: "Enabled" }
      ]
    }
  };
}

module.exports = {
  getLocalIpAddress,
  formatUptime,
  countConfiguredSections,
  checkSettingsFile,
  formatFileSize,
  getCacheTTLSettings,
  getSystemInfo
};