const axios = require('axios');
const cache = require('./cache');
const { logError, log, colors } = require('../../logger');

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const UPDATE_INTERVAL = 60000;

// Pre-configured axios instance with defaults
const api = axios.create({
  timeout: 10000,
  headers: { 'Accept-Encoding': 'gzip' }
});

// Reuse promises for concurrent requests
let currentFetchPromises = {};

async function fetchWithCache(key, fetchFn) {
  // Return existing promise if request is in progress
  if (currentFetchPromises[key]) {
    return currentFetchPromises[key];
  }

  currentFetchPromises[key] = fetchFn().finally(() => {
    delete currentFetchPromises[key];
  });

  return currentFetchPromises[key];
}

async function makeRequest(endpoint, params) {
  if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
    log(`${colors.yellow}⚠${colors.reset} No Tautulli configuration found, using empty data`);
    return null;
  }

  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const response = await api.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
        params: {
          apikey: process.env.TAUTULLI_API_KEY,
          cmd: endpoint,
          ...params
        }
      });

      return response.data;
    } catch (error) {
      retries++;
      if (retries === MAX_RETRIES) {
        throw error;
      }
      log(`${colors.yellow}⚠${colors.reset} Request failed, retrying (${retries}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

async function fetchLibraryData() {
  try {
    const data = await makeRequest('get_libraries_table');
    
    if (!data?.response?.data?.data) {
      log(`${colors.yellow}⚠${colors.reset} Invalid library data format received`);
      return [];
    }

    return data.response.data.data
      .map(library => ({
        section_name: library.section_name,
        section_type: library.section_type,
        count: library.count,
        section_id: library.section_id,
        ...(library.section_type === 'show' ? {
          parent_count: library.parent_count,
          child_count: library.child_count
        } : {})
      }))
      .sort((a, b) => a.section_id - b.section_id);
  } catch (error) {
    const errorMessage = error.response?.data?.response?.message || error.message;
    logError('Library Data Fetch', { message: errorMessage });
    return [];
  }
}

async function fetchUserData() {
  try {
    const [activityResponse, usersResponse] = await Promise.all([
      makeRequest('get_activity'),
      makeRequest('get_users_table')
    ]);

    return {
      activity: activityResponse?.response?.data || { sessions: [] },
      users: usersResponse?.response?.data || { data: [] }
    };
  } catch (error) {
    const errorMessage = error.response?.data?.response?.message || error.message;
    logError('User Data Fetch', { message: errorMessage });
    return { activity: { sessions: [] }, users: { data: [] } };
  }
}

async function fetchRecentMedia(sectionId, mediaType) {
  try {
    const response = await makeRequest('get_recently_added', {
      section_id: sectionId,
      count: 15
    });

    return {
      type: mediaType,
      sectionId,
      data: response?.response?.data?.recently_added || []
    };
  } catch (error) {
    const errorMessage = error.response?.data?.response?.message || error.message;
    logError(`Recent Media Fetch - Section ${sectionId}`, { message: errorMessage });
    return {
      type: mediaType,
      sectionId,
      data: []
    };
  }
}

async function updateCacheItem(key, fetchFunction) {
  try {
    const data = await fetchFunction();
    const success = cache.set(key, key === 'libraries' ? 
      { response: { result: 'success', data } } : 
      data
    );
    
    if (success) {
      log(`${colors.brightGreen}✓${colors.reset} Cache updated successfully for ${key}`);
    } else {
      log(`${colors.yellow}⚠${colors.reset} Failed to update cache for ${key}`);
    }
    
    return success;
  } catch (error) {
    logError(`Cache Update - ${key}`, error);
    return false;
  }
}

let updateInProgress = false;

async function initializeCache() {
  if (updateInProgress) {
    log(`${colors.yellow}⚠${colors.reset} Update already in progress, skipping...`);
    return false;
  }

  try {
    updateInProgress = true;

    // Initialize with empty data if no configuration
    if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
      cache.set('libraries', { response: { result: 'success', data: [] } });
      cache.set('users', { activity: { sessions: [] }, users: { data: [] } });
      cache.set('recent_media', []);
      log(`${colors.yellow}⚠${colors.reset} No Tautulli configuration found, using empty cache`);
      return true;
    }

    const updates = {
      libraries: await updateCacheItem('libraries', fetchLibraryData),
      users: await updateCacheItem('users', fetchUserData)
    };

    if (updates.libraries) {
      const libraryData = cache.get('libraries');
      const sections = libraryData.response.data.reduce((acc, lib) => {
        const type = lib.section_type === 'show' ? 'shows' : 'movies';
        if (!acc[type]) acc[type] = [];
        acc[type].push(lib.section_id);
        return acc;
      }, {});

      const mediaResults = await Promise.allSettled(
        Object.entries(sections).flatMap(([type, sectionIds]) =>
          sectionIds.map(sectionId => fetchRecentMedia(sectionId, type))
        )
      );

      updates.media = cache.set('recent_media', 
        mediaResults
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value)
      );
    }

    const successCount = Object.values(updates).filter(Boolean).length;
    const totalCount = Object.keys(updates).length;

    log(`${successCount === totalCount ? colors.brightGreen + '✓' : colors.yellow + '⚠'}${colors.reset} Cache update: ${successCount}/${totalCount} successful`);

    return successCount > 0;
  } catch (error) {
    logError('Cache Initialization', error);
    return false;
  } finally {
    updateInProgress = false;
  }
}

function startBackgroundUpdates() {
  setInterval(initializeCache, UPDATE_INTERVAL);
}

module.exports = {
  initializeCache,
  startBackgroundUpdates
};