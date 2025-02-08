const express = require('express');
const axios = require('axios');
const { getSettings, saveSettings } = require('../services/settings');

const router = express.Router();

// Helper function to format time
function formatTime(timestamp, format = 'relative') {
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
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
  }
}

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

// Recent media endpoints
router.get('/recent/:type(shows|movies)', async (req, res) => {
  try {
    const { type } = req.params;
    const { count = 5 } = req.query;
    const settings = await getSettings();
    
    // Get Tautulli configuration
    const tautulliBaseUrl = process.env.TAUTULLI_BASE_URL?.replace(/\/+$/, '');
    const tautulliApiKey = process.env.TAUTULLI_API_KEY;

    if (!tautulliBaseUrl || !tautulliApiKey) {
      return res.status(500).json({ 
        error: 'Tautulli configuration missing',
        message: 'Tautulli URL or API key not configured'
      });
    }

    // Get section IDs for the media type
    const sectionIds = settings.sections?.[type] || [];

    // If no sections configured, return empty array with message
    if (sectionIds.length === 0) {
      return res.json({
        response: {
          result: 'success',
          message: `No ${type} sections configured`,
          data: []
        }
      });
    }

    // Fetch data from Tautulli
    const response = await axios.get(`${tautulliBaseUrl}`, {
      params: {
        apikey: tautulliApiKey,
        cmd: 'get_recently_added',
        section_id: sectionIds[0], // Just use first section for now
        count: parseInt(count)
      }
    });

    // Return the data
    res.json({
      response: {
        result: 'success',
        data: response.data?.response?.data?.recently_added || []
      }
    });
  } catch (error) {
    console.error('Recent media error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch recent media',
      message: error.message
    });
  }
});

// Save media settings
router.post('/settings', async (req, res) => {
  try {
    const { sections, formats } = req.body;
    const settings = await getSettings();

    // Clean and validate sections
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

module.exports = { mediaRouter: router };