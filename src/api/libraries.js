const express = require('express');
const cache = require('../services/cache');
const { initializeCache } = require('../services/init');
const { logError } = require('../../logger');
const { getSettings } = require('../services/settings');
const { tautulliService } = require('../services/tautulli');

const router = express.Router();

// Utility function to format numbers with commas
function formatNumber(num) {
  return num.toLocaleString('en-US');
}

// Utility function to get configured sections
async function getConfiguredSections() {
  try {
    const settings = await getSettings();
    return {
      movies: settings.sections?.movies || [],
      shows: settings.sections?.shows || []
    };
  } catch (error) {
    logError('Get Configured Sections', error);
    return { movies: [], shows: [] };
  }
}

// Utility function to get data from cache with retry
async function getCachedDataWithRetry(attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    const cachedData = cache.get('libraries');
    if (cachedData?.response?.data) {
      return cachedData;
    }

    // If cache miss and not last attempt, try to reinitialize cache
    if (i < attempts - 1) {
      try {
        await initializeCache();
        // Add a small delay before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logError('Cache Reinitialization', error);
      }
    }
  }
  
  // If we still don't have data after retries, check Tautulli directly
  try {
    const response = await tautulliService.makeRequest('get_libraries_table');
    if (response?.response?.data?.data) {
      // Store in cache
      cache.set('libraries', response);
      return response;
    }
  } catch (error) {
    logError('Direct Tautulli Request', error);
  }
  
  return {
    response: {
      result: 'success',
      data: []
    }
  };
}

// Get all libraries with their details
router.get('/', async (req, res) => {
  try {
    const [cachedData, configuredSections] = await Promise.all([
      getCachedDataWithRetry(),
      getConfiguredSections()
    ]);
    
    // Return all sections but mark which ones are configured
    const sections = cachedData.response.data.map(library => {
      const isConfigured = library.section_type === 'movie' ? 
        configuredSections.movies.includes(library.section_id) :
        library.section_type === 'show' ? 
        configuredSections.shows.includes(library.section_id) : 
        false;
      const formattedLibrary = {
        section_name: library.section_name,
        section_type: library.section_type,
        count: parseInt(library.count) || 0,
        section_id: library.section_id,
        count_formatted: formatNumber(parseInt(library.count) || 0),
        configured: isConfigured
      };

      // Add TV show specific fields
      if (library.section_type === 'show') {
        const parentCount = parseInt(library.parent_count) || 0;
        const childCount = parseInt(library.child_count) || 0;
        formattedLibrary.parent_count = parentCount;
        formattedLibrary.child_count = childCount;
        formattedLibrary.parent_count_formatted = formatNumber(parentCount);
        formattedLibrary.child_count_formatted = formatNumber(childCount);
      }

      return formattedLibrary;
    });

    // Calculate totals only for configured sections
    const totals = {
      movies: {
        sections: 0,
        total_items: 0,
        total_items_formatted: '0'
      },
      shows: {
        sections: 0,
        total_items: 0,
        total_items_formatted: '0',
        total_seasons: 0,
        total_seasons_formatted: '0',
        total_episodes: 0,
        total_episodes_formatted: '0'
      }
    };

    sections.forEach(library => {
      if (!library.configured) return;
      
      if (library.section_type === 'movie') {
        totals.movies.sections++;
        totals.movies.total_items += library.count;
      } else if (library.section_type === 'show') {
        totals.shows.sections++;
        totals.shows.total_items += library.count;
        totals.shows.total_seasons += library.parent_count;
        totals.shows.total_episodes += library.child_count;
      }
    });

    // Format total numbers
    totals.movies.total_items_formatted = formatNumber(totals.movies.total_items);
    totals.shows.total_items_formatted = formatNumber(totals.shows.total_items);
    totals.shows.total_seasons_formatted = formatNumber(totals.shows.total_seasons);
    totals.shows.total_episodes_formatted = formatNumber(totals.shows.total_episodes);

    res.json({
      response: {
        result: 'success',
        sections,
        totals
      }
    });
  } catch (error) {
    res.status(503).json({ 
      response: {
        result: 'error',
        message: error.message,
        retry_after: 5
      }
    });
  }
});

// Get available library sections
router.get('/sections', async (req, res) => {
  try {
    const [cachedData, configuredSections] = await Promise.all([
      getCachedDataWithRetry(),
      getConfiguredSections()
    ]);
    
    const sections = cachedData.response.data
      .filter(section => {
        if (section.section_type === 'movie') {
          return configuredSections.movies.includes(section.section_id);
        } else if (section.section_type === 'show') {
          return configuredSections.shows.includes(section.section_id);
        }
        return false;
      })
      .map(section => ({
        id: section.section_id,
        name: section.section_name,
        type: section.section_type === 'movie' ? 'movies' : 'shows'
      }));

    res.json({ 
      response: {
        result: 'success',
        data: sections
      }
    });
  } catch (error) {
    res.status(503).json({ 
      response: {
        result: 'error',
        message: error.message,
        retry_after: 5
      }
    });
  }
});

// Get individual library details
router.get('/:sectionId', async (req, res) => {
  try {
    const [cachedData, configuredSections] = await Promise.all([
      getCachedDataWithRetry(),
      getConfiguredSections()
    ]);
    
    const library = cachedData.response.data.find(
      lib => lib && lib.section_id === parseInt(req.params.sectionId)
    );

    if (!library) {
      throw new Error('Library section not found');
    }

    // Check if section is configured
    if (library.section_type === 'movie' && !configuredSections.movies.includes(library.section_id)) {
      throw new Error('Library section not configured');
    } else if (library.section_type === 'show' && !configuredSections.shows.includes(library.section_id)) {
      throw new Error('Library section not configured');
    }

    // Format library data
    const formattedLibrary = {
      section_name: library.section_name,
      section_type: library.section_type,
      count: parseInt(library.count) || 0,
      section_id: library.section_id,
      count_formatted: formatNumber(parseInt(library.count) || 0)
    };

    // Add TV show specific fields
    if (library.section_type === 'show') {
      const parentCount = parseInt(library.parent_count) || 0;
      const childCount = parseInt(library.child_count) || 0;
      formattedLibrary.parent_count = parentCount;
      formattedLibrary.child_count = childCount;
      formattedLibrary.parent_count_formatted = formatNumber(parentCount);
      formattedLibrary.child_count_formatted = formatNumber(childCount);
    }

    res.json({ 
      response: {
        result: 'success',
        data: formattedLibrary
      }
    });
  } catch (error) {
    const status = error.message.includes('not found') || error.message.includes('not configured') ? 404 : 503;
    res.status(status).json({ 
      response: {
        result: 'error',
        message: error.message,
        retry_after: status === 503 ? 5 : undefined
      }
    });
  }
});

module.exports = { libraryRouter: router };