const fs = require('fs').promises;
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', '..', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

const defaultSettings = {
  userFormats: {
    fields: [
      {
        id: 'status_message',
        template: '${is_watching} ( ${last_played} )'
      }
    ]
  },
  sections: {
    shows: [],
    movies: []
  },
  mediaFormats: {
    shows: {
      fields: [
        {
          id: 'title',
          template: '${grandparent_title} - S${parent_media_index}E${media_index} - ${title}'
        },
        {
          id: 'details',
          template: '${content_rating} - ${video_resolution}'
        },
        {
          id: 'added',
          template: 'Added ${added_at_relative}'
        }
      ]
    },
    movies: {
      fields: [
        {
          id: 'title',
          template: '${title} (${year})'
        },
        {
          id: 'details',
          template: '${content_rating} - ${video_resolution}'
        },
        {
          id: 'added',
          template: 'Added ${added_at_relative}'
        }
      ]
    }
  }
};

async function initSettings() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    try {
      await fs.access(CONFIG_FILE);
    } catch {
      console.log('Creating default settings file...');
      await saveSettings(defaultSettings);
    }
  } catch (error) {
    console.error('Error initializing settings:', error);
    throw error;
  }
}

async function getSettings() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    const settings = JSON.parse(data);
    
    // Ensure defaults for new settings
    return {
      ...defaultSettings,
      ...settings,
      mediaFormats: {
        ...defaultSettings.mediaFormats,
        ...settings.mediaFormats
      }
    };
  } catch (error) {
    console.error('Error reading settings:', error);
    return defaultSettings;
  }
}

async function saveSettings(settings) {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(
      CONFIG_FILE,
      JSON.stringify(settings, null, 2),
      'utf8'
    );
    return settings;
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}

module.exports = {
  initSettings,
  getSettings,
  saveSettings,
  CONFIG_FILE
};