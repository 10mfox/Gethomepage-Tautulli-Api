// src/api/libraries.js
const express = require('express');
const axios = require('axios');

const router = express.Router();

// Get all libraries with their details
router.get('/', async (req, res) => {
  try {
    if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
      throw new Error('Tautulli configuration missing');
    }

    const response = await axios.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
      params: {
        apikey: process.env.TAUTULLI_API_KEY,
        cmd: 'get_libraries_table'
      }
    });

    // Sort the data by section_id
    const sortedData = response.data.response.data.data.sort((a, b) => a.section_id - b.section_id);

    res.json({ 
      response: {
        result: 'success',
        data: sortedData
      }
    });

  } catch (error) {
    res.status(500).json({ 
      response: {
        result: 'error',
        message: error.message 
      }
    });
  }
});

// Get available library sections
router.get('/sections', async (req, res) => {
  try {
    if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
      throw new Error('Tautulli configuration missing');
    }

    const response = await axios.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
      params: {
        apikey: process.env.TAUTULLI_API_KEY,
        cmd: 'get_library_names'
      }
    });

    // Transform the data to include section type
    const sections = response.data.response.data.map(section => ({
      id: section.section_id,
      name: section.section_name,
      type: section.section_type === 'movie' ? 'movies' : 
            section.section_type === 'show' ? 'shows' : 'other'
    })).filter(section => section.type !== 'other');

    res.json({ 
      response: {
        result: 'success',
        data: sections
      }
    });

  } catch (error) {
    res.status(500).json({ 
      response: {
        result: 'error',
        message: error.message 
      }
    });
  }
});

// Get individual library details
router.get('/:sectionId', async (req, res) => {
  try {
    if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
      throw new Error('Tautulli configuration missing');
    }

    const response = await axios.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
      params: {
        apikey: process.env.TAUTULLI_API_KEY,
        cmd: 'get_library',
        section_id: req.params.sectionId
      }
    });

    res.json({ 
      response: {
        result: 'success',
        data: response.data.response.data
      }
    });

  } catch (error) {
    res.status(500).json({ 
      response: {
        result: 'error',
        message: error.message 
      }
    });
  }
});

// Get library watch statistics
router.get('/:sectionId/stats', async (req, res) => {
  try {
    if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
      throw new Error('Tautulli configuration missing');
    }

    const response = await axios.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
      params: {
        apikey: process.env.TAUTULLI_API_KEY,
        cmd: 'get_library_watch_time_stats',
        section_id: req.params.sectionId
      }
    });

    res.json({ 
      response: {
        result: 'success',
        data: response.data.response.data
      }
    });

  } catch (error) {
    res.status(500).json({ 
      response: {
        result: 'error',
        message: error.message 
      }
    });
  }
});

module.exports = { libraryRouter: router };