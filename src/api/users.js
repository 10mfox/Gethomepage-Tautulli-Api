const express = require('express');
const { getSettings, saveSettings } = require('../services/settings');
const cache = require('../services/cache');

const router = express.Router();

function formatTimeHHMM(totalSeconds) {
  if (!totalSeconds) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatShowTitle(session) {
  if (!session) return '';
  if (session.grandparent_title && session.parent_media_index && session.media_index) {
    const showTitle = session.grandparent_title.replace(/\s*\(\d{4}\)|\s+[-–]\s+\d{4}/, '');
    return `${showTitle} - S${String(session.parent_media_index).padStart(2, '0')}E${String(session.media_index).padStart(2, '0')}`;
  }
  const title = session.title || '';
  return title.replace(/\s*\(\d{4}\)|\s+[-–]\s+\d{4}/, '');
}

function formatTimeDiff(timestamp) {
  if (!timestamp) return 'Never';
  const now = Date.now() / 1000;
  const diff = Math.floor(now - timestamp);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

router.get('/', async (req, res) => {
  try {
    const { 
      order_column = 'friendly_name', 
      order_dir = 'asc', 
      search = '',
      start = 0,
      length = 25
    } = req.query;

    const settings = await getSettings();
    const formatFields = settings.userFormats?.fields || [];

    // Get user data from cache
    const cachedData = cache.get('users');
    if (!cachedData) {
      throw new Error('User data not available');
    }

    const { activity, users } = cachedData;
    const watchingUsers = {};

    // Process active sessions
    activity.sessions?.forEach(session => {
      if (session.state === 'playing') {
        watchingUsers[session.user_id] = {
          current_media: session.grandparent_title ? `${session.grandparent_title} - ${session.title}` : session.title,
          last_played_modified: formatShowTitle(session),
          media_type: session.media_type,
          progress_percent: session.progress_percent || '0',
          view_offset: Math.floor((session.view_offset || 0) / 1000),
          duration: Math.floor((session.duration || 0) / 1000),
          last_seen: Math.floor(Date.now() / 1000),
          parent_media_index: session.parent_media_index,
          media_index: session.media_index,
          stream_container_decision: session.stream_container_decision || 'direct play'
        };
      }
    });

    // Transform user data
    const transformedUsers = users.data.map(user => {
      const watching = watchingUsers[user.user_id];
      const lastSeen = watching ? watching.last_seen : parseInt(user.last_seen, 10);

      const baseUser = {
        friendly_name: user.friendly_name || '',
        total_plays: parseInt(user.plays || '0', 10),
        is_watching: watching ? 'Watching' : 'Watched',
        last_played: watching ? watching.current_media : (user.last_played || 'Nothing'),
        last_played_modified: watching ? watching.last_played_modified : user.last_played || 'Nothing',
        media_type: watching ? watching.media_type.charAt(0).toUpperCase() + watching.media_type.slice(1) : 
                   (user.media_type ? user.media_type.charAt(0).toUpperCase() + user.media_type.slice(1) : ''),
        progress_percent: watching ? `${watching.progress_percent}%` : '',
        progress_time: watching ? `${formatTimeHHMM(watching.view_offset)} / ${formatTimeHHMM(watching.duration)}` : '',
        last_seen_formatted: watching ? '🟢' : (user.last_seen ? formatTimeDiff(user.last_seen) : 'Never'),
        stream_container_decision: watching ? watching.stream_container_decision : '',
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

    // Sort users
    const sortedUsers = transformedUsers.sort((a, b) => {
      if (a._is_watching && !b._is_watching) return -1;
      if (!a._is_watching && b._is_watching) return 1;
      return (b._last_seen || 0) - (a._last_seen || 0);
    });

    // Apply search filter
    const filteredUsers = search
      ? sortedUsers.filter(user => 
          Object.values(user)
            .filter(val => typeof val === 'string')
            .some(val => val.toLowerCase().includes(search.toLowerCase()))
        )
      : sortedUsers;

    // Apply pagination
    const paginatedUsers = filteredUsers.slice(
      parseInt(start), 
      parseInt(start) + parseInt(length)
    );

    // Clean up internal properties
    const cleanedUsers = paginatedUsers.map(({ _last_seen, _is_watching, ...user }) => user);

    res.json({ 
      response: {
        result: 'success',
        data: cleanedUsers,
        recordsTotal: sortedUsers.length,
        recordsFiltered: filteredUsers.length,
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