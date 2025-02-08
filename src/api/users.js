const express = require('express');
const axios = require('axios');
const { getSettings, saveSettings } = require('../services/settings');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { order_column = 'friendly_name', order_dir = 'asc', search = '' } = req.query;
    const settings = await getSettings();
    const formatFields = settings.userFormats?.fields || [];

    if (!process.env.TAUTULLI_BASE_URL || !process.env.TAUTULLI_API_KEY) {
      throw new Error('Tautulli configuration missing');
    }

    // Get current activity data first
    const activityResponse = await axios.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
      params: {
        apikey: process.env.TAUTULLI_API_KEY,
        cmd: 'get_activity'
      }
    });

    // Create map of currently watching users
    const watchingUsers = {};
    activityResponse.data.response.data.sessions?.forEach(session => {
      if (session.state === 'playing') {
        watchingUsers[session.user_id] = {
          current_media: session.grandparent_title ? `${session.grandparent_title} - ${session.title}` : session.title,
          media_type: session.media_type,
          progress_percent: session.progress_percent || '0',
          view_offset: parseFloat(session.view_offset || 0),
          duration: parseFloat(session.duration || 0)
        };
      }
    });

    // Get users data
    const response = await axios.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
      params: {
        apikey: process.env.TAUTULLI_API_KEY,
        cmd: 'get_users_table',
        order_column,
        order_dir,
        search
      }
    });

    const users = response.data.response.data.data;

    // Transform users data
    const transformedUsers = users.map(user => {
      const watching = watchingUsers[user.user_id];

      // Base user data with all available variables
      const baseUser = {
        friendly_name: user.friendly_name || '',
        total_plays: parseInt(user.plays || '0', 10),
        is_watching: watching ? 'Watching' : 'Watched',
        last_played: watching ? watching.current_media : (user.last_played || 'Nothing'),
        media_type: watching ? watching.media_type.charAt(0).toUpperCase() + watching.media_type.slice(1) : (user.media_type ? user.media_type.charAt(0).toUpperCase() + user.media_type.slice(1) : ''),
        progress_percent: watching ? `${watching.progress_percent}%` : '',
        progress_time: watching ? `${Math.floor(watching.view_offset/60)}:${String(watching.view_offset%60).padStart(2,'0')} / ${Math.floor(watching.duration/60)}:${String(watching.duration%60).padStart(2,'0')}` : '',
        last_seen_formatted: watching ? '🟢' : (user.last_seen ? formatTimeDiff(user.last_seen) : 'Never')
      };

      return formatFields.reduce((acc, field) => {
        let result = field.template;
        Object.entries(baseUser).forEach(([key, value]) => {
          result = result.replace(new RegExp(`\\$\{${key}}`, 'g'), value || '');
        });
        acc[field.id] = result;
        return acc;
      }, {});
    });

    res.json({ 
      response: {
        result: 'success',
        data: transformedUsers
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

function formatTimeDiff(timestamp) {
  if (!timestamp) return 'Never';
  const now = Date.now() / 1000;
  const diff = Math.floor(now - timestamp);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

router.get('/format-settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings.userFormats || { fields: [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load format settings' });
  }
});

router.post('/format-settings', async (req, res) => {
  try {
    const { fields } = req.body;
    if (!Array.isArray(fields)) {
      throw new Error('Invalid format settings');
    }
    
    const settings = await getSettings();
    await saveSettings({
      ...settings,
      userFormats: { fields }
    });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = { userRouter: router };