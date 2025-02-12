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

    // Filter and transform the data
    const filteredData = response.data.response.data.data.map(library => {
      const baseLibrary = {
        section_name: library.section_name,
        section_type: library.section_type,
        count: library.count,
        section_id: library.section_id
      };

      // Only include parent_count and child_count for shows
      if (library.section_type === 'show') {
        return {
          ...baseLibrary,
          parent_count: library.parent_count,
          child_count: library.child_count
        };
      }

      return baseLibrary;
    });

    // Sort the data by section_id
    const sortedData = filteredData.sort((a, b) => a.section_id - b.section_id);

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

    // Filter the response data
    const libraryData = response.data.response.data;
    const baseData = {
      section_name: libraryData.section_name,
      section_type: libraryData.section_type,
      count: libraryData.count,
      section_id: libraryData.section_id
    };

    // Only include parent_count and child_count for shows
    const filteredData = libraryData.section_type === 'show' 
      ? {
          ...baseData,
          parent_count: libraryData.parent_count,
          child_count: libraryData.child_count
        }
      : baseData;

    res.json({ 
      response: {
        result: 'success',
        data: filteredData
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