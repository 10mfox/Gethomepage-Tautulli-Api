const axios = require('axios');
const cache = require('./cache');
const { logError, log, colors } = require('../../logger');

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const UPDATE_INTERVAL = 60000;

// Pre-configured axios instance with defaults
const api = axios.create({
  timeout: 10000,
  headers: { 'Accept-Encoding': 'gzip' } // Enable compression
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

async function fetchLibraryData() {
  return fetchWithCache('libraries', async () => {
    const response = await api.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
      params: {
        apikey: process.env.TAUTULLI_API_KEY,
        cmd: 'get_libraries_table'
      }
    });

    if (!response.data?.response?.data?.data) {
      throw new Error('Invalid library data format');
    }

    return response.data.response.data.data
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
  });
}

async function fetchUserData() {
  return fetchWithCache('users', async () => {
    const [activityResponse, usersResponse] = await Promise.all([
      api.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
        params: {
          apikey: process.env.TAUTULLI_API_KEY,
          cmd: 'get_activity'
        }
      }),
      api.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
        params: {
          apikey: process.env.TAUTULLI_API_KEY,
          cmd: 'get_users_table'
        }
      })
    ]);

    return {
      activity: activityResponse.data.response.data,
      users: usersResponse.data.response.data
    };
  });
}

async function fetchRecentMedia(sectionId, mediaType) {
  return fetchWithCache(`media-${sectionId}`, async () => {
    const response = await api.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
      params: {
        apikey: process.env.TAUTULLI_API_KEY,
        cmd: 'get_recently_added',
        section_id: sectionId,
        count: 15
      }
    });

    return {
      type: mediaType,
      sectionId,
      data: response.data.response.data.recently_added || []
    };
  });
}

async function updateCacheItem(key, fetchFunction) {
  try {
    const data = await fetchFunction();
    return cache.set(key, key === 'libraries' ? 
      { response: { result: 'success', data } } : 
      data
    );
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