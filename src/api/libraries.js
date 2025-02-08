const express = require('express');
const axios = require('axios');

const router = express.Router();

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

module.exports = { libraryRouter: router };