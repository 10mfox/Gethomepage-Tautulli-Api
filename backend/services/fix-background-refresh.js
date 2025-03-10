/**
 * Background refresh fix for Tautulli API Manager
 * Provides browser-compatible background refresh implementation
 * @module services/fix-background-refresh
 */
const { log, logError, colors } = require('../../logger');
const { cache, startBackgroundUpdates } = require('./cacheService');

/**
 * Modified startBackgroundRefresh function that avoids browser-specific APIs
 * Replaces the function in server.js to prevent document.visibilityState errors
 */
function startBackgroundRefresh() {
  // Start the main background update service
  startBackgroundUpdates();
  
  // Schedule additional optimized refresh for active users
  setTimeout(() => {
    setInterval(async () => {
      try {
        // Only refresh active user data
        const userData = cache.get('users');
        if (userData && userData.activity && userData.activity.sessions && userData.activity.sessions.length > 0) {
          log(`${colors.brightYellow}${colors.reset} Refreshing ${userData.activity.sessions.length} active user sessions`);
          
          // Directly trigger a force update instead of using queueUpdate
          if (typeof cache.forceUpdate === 'function') {
            await cache.forceUpdate('users');
          } else {
            // Fallback if forceUpdate is not available
            log(`${colors.yellow}⚠${colors.reset} cache.forceUpdate not available, skipping active user refresh`);
          }
        }
      } catch (error) {
        logError('Active User Refresh', error);
      }
    }, 20000); // Every 20 seconds, check for active users
  }, 10000); // Start after 10 seconds
}

module.exports = { startBackgroundRefresh };