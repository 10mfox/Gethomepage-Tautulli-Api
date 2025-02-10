const express = require('express');
const axios = require('axios');
const { getSettings, saveSettings } = require('../services/settings');

const router = express.Router();

// Get media settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      formats: settings.mediaFormats || {},
      sections: settings.sections || { shows: [], movies: [] }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load media settings' });
  }
});

// Save media settings
router.post('/settings', async (req, res) => {
  try {
    const { sections, formats } = req.body;
    const settings = await getSettings();

    const cleanedSections = Object.entries(sections).reduce((acc, [type, ids]) => {
      const idArray = Array.isArray(ids) ? ids : [ids];
      acc[type] = idArray
        .map(id => parseInt(id))
        .filter(id => !isNaN(id) && id > 0);
      return acc;
    }, {});

    await saveSettings({
      ...settings,
      sections: cleanedSections,
      mediaFormats: formats
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save media settings' });
  }
});

// Format timestamp to relative time
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  
  const now = Math.floor(Date.now() / 1000);
  const diffInSeconds = Math.abs(now - timestamp);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
  return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
}

// Format timestamp to short date
function formatShortDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Helper function to get metadata for a specific item
async function getItemMetadata(ratingKey, tautulliBaseUrl, tautulliApiKey) {
  try {
    const response = await axios.get(`${tautulliBaseUrl}/api/v2`, {
      params: {
        apikey: tautulliApiKey,
        cmd: 'get_metadata',
        rating_key: ratingKey
      }
    });
    
    const metadata = response.data?.response?.data;
    return {
      content_rating: metadata?.content_rating || '',
      video_resolution: metadata?.media_info?.[0]?.video_full_resolution || metadata?.media_info?.[0]?.video_resolution || ''
    };
  } catch (error) {
    console.error(`Error fetching metadata for item ${ratingKey}:`, error.message);
    return { content_rating: '', video_resolution: '' };
  }
}

// Helper function to format titles
function formatTitle(item, format, type) {
  if (!format?.title) {
    return type === 'shows' 
      ? `${item.grandparent_title} - S${String(item.parent_media_index).padStart(2, '0')}E${String(item.media_index).padStart(2, '0')} - ${item.title}`
      : `${item.title} (${item.year})`;
  }

  let result = format.title;
  const variables = {
    title: item.title || '',
    year: item.year || '',
    grandparent_title: item.grandparent_title || '',
    parent_media_index: String(item.parent_media_index || '').padStart(2, '0'),
    media_index: String(item.media_index || '').padStart(2, '0'),
    duration: item.duration || '',
    content_rating: item.content_rating || '',
    video_resolution: item.video_resolution || '',
    ...item
  };

  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\$\{${key}}`, 'g'), value || '');
  });

  return result;
}

// Debug endpoint
router.get('/:type(shows|movies)/debug', async (req, res) => {
  try {
    const { type } = req.params;
    const { count = 5 } = req.query;
    const settings = await getSettings();
    const formats = settings.mediaFormats || {};
    const debugSteps = [];

    const tautulliBaseUrl = process.env.TAUTULLI_BASE_URL?.replace(/\/+$/, '');
    const tautulliApiKey = process.env.TAUTULLI_API_KEY;

    if (!tautulliBaseUrl || !tautulliApiKey) {
      return res.status(500).json({ error: 'Tautulli configuration missing' });
    }

    const configuredSections = settings.sections?.[type] || [];
    debugSteps.push({ step: 'configuredSections', data: configuredSections });

    const promises = configuredSections.map(section =>
      axios.get(`${tautulliBaseUrl}/api/v2`, {
        params: {
          apikey: tautulliApiKey,
          cmd: 'get_recently_added',
          section_id: section,
          count: parseInt(count) * configuredSections.length
        }
      }).then(response => {
        debugSteps.push({
          step: `rawResponse-section-${section}`,
          data: response.data?.response?.data?.recently_added || []
        });
        return {
          section_id: section,
          data: response.data
        };
      }).catch(error => {
        debugSteps.push({
          step: `error-section-${section}`,
          error: error.message
        });
        return { 
          section_id: section,
          data: { response: { data: { recently_added: [] } } }
        };
      })
    );

    const responses = await Promise.all(promises);
    debugSteps.push({ step: 'allResponses', data: responses });

    const allItems = responses.flatMap(({ section_id, data }) => {
      const items = data?.response?.data?.recently_added || [];
      return items.map(item => ({
        ...item,
        section_id: section_id.toString()
      }));
    });

    debugSteps.push({ step: 'allItemsPreSort', data: allItems });

    const sortedItems = allItems
      .sort((a, b) => parseInt(b.added_at) - parseInt(a.added_at))
      .slice(0, parseInt(count));

    debugSteps.push({ step: 'sortedItems', data: sortedItems });

    const itemsWithMetadata = await Promise.all(
      sortedItems.map(async (item) => {
        const metadata = await getItemMetadata(item.rating_key, tautulliBaseUrl, tautulliApiKey);
        const added_at = parseInt(item.added_at);

        const transformedItem = {
          media_type: type,
          section_id: item.section_id,
          title: formatTitle(item, formats?.[type]?.[item.section_id], type),
          content_rating: metadata.content_rating || '',
          video_resolution: metadata.video_resolution || '',
          added_at_relative: formatRelativeTime(added_at),
          added_at_short: formatShortDate(added_at)
        };

        debugSteps.push({
          step: `transformedItem-${item.rating_key}`,
          original: item,
          transformed: transformedItem
        });

        return transformedItem;
      })
    );

    debugSteps.push({ step: 'finalItems', data: itemsWithMetadata });

    res.json({
      debugSteps,
      finalResponse: {
        response: {
          result: 'success',
          message: '',
          data: itemsWithMetadata,
          sections: configuredSections
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Main media endpoint
router.get('/:type(shows|movies)/:sectionId?', async (req, res) => {
  try {
    const { type, sectionId } = req.params;
    const { count = 5 } = req.query;
    const settings = await getSettings();
    const formats = settings.mediaFormats || {};

    const tautulliBaseUrl = process.env.TAUTULLI_BASE_URL?.replace(/\/+$/, '');
    const tautulliApiKey = process.env.TAUTULLI_API_KEY;

    if (!tautulliBaseUrl || !tautulliApiKey) {
      return res.status(500).json({
        response: {
          result: 'error',
          message: 'Tautulli configuration missing',
          data: []
        }
      });
    }

    const configuredSections = settings.sections?.[type] || [];
    
    // Handle single section request
    if (sectionId) {
      const section = parseInt(sectionId);
      if (!configuredSections.includes(section)) {
        return res.status(404).json({
          response: {
            result: 'error',
            message: `Section ${sectionId} not configured for ${type}`,
            data: []
          }
        });
      }

      const response = await axios.get(`${tautulliBaseUrl}/api/v2`, {
        params: {
          apikey: tautulliApiKey,
          cmd: 'get_recently_added',
          section_id: section,
          count: parseInt(count)
        }
      });

      const items = response.data?.response?.data?.recently_added || [];
      
      const itemsWithMetadata = await Promise.all(
        items.map(async (item) => {
          const metadata = await getItemMetadata(item.rating_key, tautulliBaseUrl, tautulliApiKey);
          const added_at = parseInt(item.added_at);

          return {
            media_type: type,
            section_id: section.toString(),
            title: formatTitle(item, formats?.[type]?.[section], type),
            content_rating: metadata.content_rating || '',
            video_resolution: metadata.video_resolution || '',
            added_at_relative: formatRelativeTime(added_at),
            added_at_short: formatShortDate(added_at)
          };
        })
      );

      return res.json({
        response: {
          result: 'success',
          message: '',
          data: itemsWithMetadata,
          section: section
        }
      });
    }

    // Handle no sections configured
    if (configuredSections.length === 0) {
      return res.json({
        response: {
          result: 'success',
          message: `No ${type} sections configured`,
          data: []
        }
      });
    }

    // Get data from all sections
    const promises = configuredSections.map(section =>
      axios.get(`${tautulliBaseUrl}/api/v2`, {
        params: {
          apikey: tautulliApiKey,
          cmd: 'get_recently_added',
          section_id: section,
          count: parseInt(count) * configuredSections.length
        }
      }).then(response => ({
        section_id: section,
        data: response.data
      })).catch(error => {
        console.error(`Error fetching section ${section}:`, error.message);
        return { 
          section_id: section,
          data: { response: { data: { recently_added: [] } } }
        };
      })
    );

    const responses = await Promise.all(promises);
    
    // Process all items
    const allItems = responses.flatMap(({ section_id, data }) => {
      const items = data?.response?.data?.recently_added || [];
      return items.map(item => ({
        ...item,
        section_id: section_id.toString()
      }));
    });

    // Sort and slice items
    const sortedItems = allItems
      .sort((a, b) => parseInt(b.added_at) - parseInt(a.added_at))
      .slice(0, parseInt(count));

    // Add metadata to items
    const itemsWithMetadata = await Promise.all(
      sortedItems.map(async (item) => {
        const metadata = await getItemMetadata(item.rating_key, tautulliBaseUrl, tautulliApiKey);
        const added_at = parseInt(item.added_at);

        return {
          media_type: type,
          section_id: item.section_id,
          title: formatTitle(item, formats?.[type]?.[item.section_id], type),
          content_rating: metadata.content_rating || '',
          video_resolution: metadata.video_resolution || '',
          added_at_relative: formatRelativeTime(added_at),
          added_at_short: formatShortDate(added_at)
        };
      })
    );

    res.json({
      response: {
        result: 'success',
        message: '',
        data: itemsWithMetadata,
        sections: configuredSections
      }
    });

  } catch (error) {
    console.error(`Error fetching ${req.params.type}:`, error.message);
    res.status(500).json({
      response: {
        result: 'error',
        message: `Failed to fetch ${req.params.type}`,
        error: error.message
      }
    });
  }
});

module.exports = { mediaRouter: router };