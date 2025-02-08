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
    shows: {},
    movies: {}
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
    return {
      ...defaultSettings,
      ...settings,
      userFormats: {
        ...defaultSettings.userFormats,
        ...settings.userFormats
      },
      sections: {
        ...defaultSettings.sections,
        ...settings.sections
      },
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
    
    const currentSettings = await getSettings();
    const newSettings = {
      ...currentSettings,
      ...settings,
      userFormats: {
        ...currentSettings.userFormats,
        ...settings.userFormats
      },
      sections: {
        ...currentSettings.sections,
        ...settings.sections
      },
      mediaFormats: {
        ...currentSettings.mediaFormats,
        ...settings.mediaFormats
      }
    };

    await fs.writeFile(
      CONFIG_FILE,
      JSON.stringify(newSettings, null, 2),
      'utf8'
    );

    console.log('Settings saved successfully');
    return newSettings;
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