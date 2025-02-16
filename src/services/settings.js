const fs = require('fs').promises;
const path = require('path');
const logger = require('../../logger');

const CONFIG_DIR = path.join(__dirname, '..', '..', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

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

// Helper function to add delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to validate settings
function validateSettings(settings) {
  const requiredKeys = ['userFormats', 'sections', 'mediaFormats'];
  return requiredKeys.every(key => key in settings) &&
         Array.isArray(settings.sections.shows) &&
         Array.isArray(settings.sections.movies);
}

async function retryOperation(operation, retries = MAX_RETRIES) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      logger.logError('Settings Operation Retry', {
        message: `Attempt ${i + 1} failed: ${error.message}`
      });
      if (i < retries - 1) {
        await delay(RETRY_DELAY);
      }
    }
  }
  
  throw lastError;
}

async function initSettings() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    
    // Check if settings file exists
    try {
      await fs.access(CONFIG_FILE);
      
      // Validate existing settings
      const currentSettings = await getSettings();
      if (!validateSettings(currentSettings)) {
        logger.log('Invalid settings detected, restoring defaults');
        await saveSettings(defaultSettings);
      }
    } catch (error) {
      // File doesn't exist or can't be accessed, create with defaults
      logger.log('Creating default settings file...');
      await saveSettings(defaultSettings);
    }
  } catch (error) {
    logger.logError('Settings Initialization', error);
    throw error;
  }
}

async function getSettings() {
  return retryOperation(async () => {
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf8');
      const settings = JSON.parse(data);
      
      // Ensure defaults for new settings and validate
      const mergedSettings = {
        ...defaultSettings,
        ...settings,
        mediaFormats: {
          ...defaultSettings.mediaFormats,
          ...settings.mediaFormats
        }
      };

      if (!validateSettings(mergedSettings)) {
        throw new Error('Invalid settings format');
      }

      return mergedSettings;
    } catch (error) {
      logger.logError('Settings Read', error);
      throw error;
    }
  });
}

async function saveSettings(settings) {
  return retryOperation(async () => {
    try {
      // Validate settings before saving
      if (!validateSettings(settings)) {
        throw new Error('Invalid settings format');
      }

      await fs.mkdir(CONFIG_DIR, { recursive: true });
      
      // Write to temporary file first
      const tempFile = `${CONFIG_FILE}.tmp`;
      await fs.writeFile(
        tempFile,
        JSON.stringify(settings, null, 2),
        'utf8'
      );

      // Rename temporary file to actual file (atomic operation)
      await fs.rename(tempFile, CONFIG_FILE);

      return settings;
    } catch (error) {
      logger.logError('Settings Save', error);
      throw error;
    }
  });
}

module.exports = {
  initSettings,
  getSettings,
  saveSettings,
  CONFIG_FILE,
  defaultSettings
};