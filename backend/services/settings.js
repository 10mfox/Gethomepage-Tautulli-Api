/**
 * Settings management service
 * Handles loading, saving, and validating application settings
 * @module services/settings
 */
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../logger');

/**
 * Configuration directory path
 * @type {string}
 */
const CONFIG_DIR = path.join(__dirname, '..', '..', 'config');

/**
 * Configuration file path
 * @type {string}
 */
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

/**
 * Maximum number of retry attempts for file operations
 * @type {number}
 */
const MAX_RETRIES = 3;

/**
 * Delay between retry attempts in milliseconds
 * @type {number}
 */
const RETRY_DELAY = 1000; // 1 second

/**
 * Default settings used for initialization
 * @type {Object}
 */
const defaultSettings = {
  userFormats: {
    fields: [
      {
        id: 'field', // Changed from 'status_message' to 'field' for consistency
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
        }
      ]
    },
    movies: {
      fields: [
        {
          id: 'title',
          template: '${title} (${year})'
        }
      ]
    }
  },
  env: {
    TAUTULLI_BASE_URL: '',
    TAUTULLI_API_KEY: ''
  }
};

/**
 * Helper function to add delay
 * 
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>} Promise that resolves after the delay
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validate settings object structure
 * 
 * @param {Object} settings - Settings object to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateSettings(settings) {
  const requiredKeys = ['userFormats', 'sections', 'mediaFormats', 'env'];
  return requiredKeys.every(key => key in settings) &&
         Array.isArray(settings.sections.shows) &&
         Array.isArray(settings.sections.movies) &&
         typeof settings.env === 'object' &&
         'TAUTULLI_BASE_URL' in settings.env &&
         'TAUTULLI_API_KEY' in settings.env;
}

/**
 * Normalize user format fields to ensure proper field IDs
 * 
 * @param {Object} settings - Settings object to normalize
 * @returns {Object} Settings with normalized user formats
 */
function normalizeUserFormats(settings) {
  if (settings.userFormats && Array.isArray(settings.userFormats.fields)) {
    // Ensure we have at least one field
    if (settings.userFormats.fields.length === 0) {
      settings.userFormats.fields = [{ 
        id: 'field', 
        template: defaultSettings.userFormats.fields[0].template 
      }];
    }
    
    // Fix the first field ID if it's 'status_message'
    if (settings.userFormats.fields.length > 0) {
      if (settings.userFormats.fields[0].id === 'status_message') {
        logger.log('Normalizing user format field ID from status_message to field');
        settings.userFormats.fields[0].id = 'field';
      }
    }
  }
  
  return settings;
}

/**
 * Retry an operation with exponential backoff
 * 
 * @async
 * @param {Function} operation - Async function to retry
 * @param {number} [retries=MAX_RETRIES] - Maximum number of retry attempts
 * @returns {Promise<*>} Result of the operation
 * @throws {Error} Last error if all retries fail
 */
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

/**
 * Initialize settings
 * Creates config directory and default settings file if necessary
 * 
 * @async
 * @returns {Promise<void>}
 */
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

      // Update environment variables from settings
      if (currentSettings.env) {
        process.env.TAUTULLI_BASE_URL = currentSettings.env.TAUTULLI_BASE_URL || '';
        process.env.TAUTULLI_API_KEY = currentSettings.env.TAUTULLI_API_KEY || '';
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

/**
 * Get settings from file
 * 
 * @async
 * @returns {Promise<Object>} Settings object
 */
async function getSettings() {
  return retryOperation(async () => {
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf8');
      let settings = JSON.parse(data);
      
      // Ensure defaults for new settings and validate
      const mergedSettings = {
        ...defaultSettings,
        ...settings,
        mediaFormats: {
          ...defaultSettings.mediaFormats,
          ...settings.mediaFormats
        },
        env: {
          ...defaultSettings.env,
          ...settings.env
        }
      };

      // Normalize user format fields
      normalizeUserFormats(mergedSettings);

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

/**
 * Save settings to file
 * Uses atomic file operations for reliability
 * 
 * @async
 * @param {Object} settings - Settings object to save
 * @returns {Promise<Object>} Saved settings object
 */
async function saveSettings(settings) {
  return retryOperation(async () => {
    try {
      // Normalize user format fields before saving
      settings = normalizeUserFormats(settings);
      
      // Log what we're about to save
      logger.log('Saving user formats:', JSON.stringify(settings.userFormats, null, 2));
      
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

      // Update environment variables
      if (settings.env) {
        process.env.TAUTULLI_BASE_URL = settings.env.TAUTULLI_BASE_URL || '';
        process.env.TAUTULLI_API_KEY = settings.env.TAUTULLI_API_KEY || '';
      }

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