const express = require('express');
const axios = require('axios');
const { getSettings, saveSettings } = require('../services/settings');

const router = express.Router();

// Helper function to format time in HH:MM:SS format
function formatTimeHHMM(totalSeconds) {
  if (!totalSeconds) return '0m';
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

router.get('/', async (req, res) => {
  try {
    const { 
      order_column = 'friendly_name', 
      order_dir = 'asc', 
      search = '',
      start = 0,
      length = 25 // Default to 25 items per Tautulli's default
    } = req.query;

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
          view_offset: Math.floor((session.view_offset || 0) / 1000),
          duration: Math.floor((session.duration || 0) / 1000),
          last_seen: Math.floor(Date.now() / 1000)
        };
      }
    });

    // Get ALL users first to ensure consistent sorting
    const response = await axios.get(`${process.env.TAUTULLI_BASE_URL}/api/v2`, {
      params: {
        apikey: process.env.TAUTULLI_API_KEY,
        cmd: 'get_users_table',
        order_column,
        order_dir,
        search,
        length: 1000 // Get all users to ensure consistent sorting
      }
    });

    const allUsers = response.data.response.data.data;
    const recordsTotal = response.data.response.data.recordsTotal || allUsers.length;
    const recordsFiltered = response.data.response.data.recordsFiltered || recordsTotal;

    // Transform ALL users data first
    const transformedUsers = allUsers.map(user => {
      const watching = watchingUsers[user.user_id];
      const lastSeen = watching ? watching.last_seen : parseInt(user.last_seen, 10);

      // Base user data with all available variables
      const baseUser = {
        friendly_name: user.friendly_name || '',
        total_plays: parseInt(user.plays || '0', 10),
        is_watching: watching ? 'Watching' : 'Watched',
        last_played: watching ? watching.current_media : (user.last_played || 'Nothing'),
        media_type: watching ? watching.media_type.charAt(0).toUpperCase() + watching.media_type.slice(1) : (user.media_type ? user.media_type.charAt(0).toUpperCase() + user.media_type.slice(1) : ''),
        progress_percent: watching ? `${watching.progress_percent}%` : '',
        progress_time: watching ? `${formatTimeHHMM(watching.view_offset)} / ${formatTimeHHMM(watching.duration)}` : '',
        last_seen_formatted: watching ? '🟢' : (user.last_seen ? formatTimeDiff(user.last_seen) : 'Never'),
        _last_seen: lastSeen,
        _is_watching: !!watching
      };

      return formatFields.reduce((acc, field) => {
        let result = field.template;
        Object.entries(baseUser).forEach(([key, value]) => {
          result = result.replace(new RegExp(`\\$\{${key}}`, 'g'), value || '');
        });
        acc[field.id] = result;
        acc._last_seen = lastSeen;
        acc._is_watching = !!watching;
        return acc;
      }, {});
    });

    // Sort ALL users: active users first, then by last seen timestamp
    const sortedUsers = transformedUsers.sort((a, b) => {
      if (a._is_watching && !b._is_watching) return -1;
      if (!a._is_watching && b._is_watching) return 1;
      return (b._last_seen || 0) - (a._last_seen || 0);
    });

    // Apply pagination AFTER sorting
    const paginatedUsers = sortedUsers.slice(parseInt(start), parseInt(start) + parseInt(length));

    // Remove internal sorting fields before sending response
    const cleanedUsers = paginatedUsers.map(user => {
      const { _last_seen, _is_watching, ...cleanUser } = user;
      return cleanUser;
    });

    res.json({ 
      response: {
        result: 'success',
        data: cleanedUsers,
        recordsTotal: sortedUsers.length,
        recordsFiltered: sortedUsers.length,
        draw: parseInt(req.query.draw) || 1
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