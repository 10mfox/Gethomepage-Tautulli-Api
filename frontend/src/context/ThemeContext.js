/**
 * Theme context and provider for application-wide theme management
 * @module context/ThemeContext
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * Theme context for accessing theme state and functions
 * @type {React.Context}
 */
const ThemeContext = createContext();

/**
 * Available themes with their color configurations
 * @type {Object.<string, Object>}
 */
export const themes = {
  dark: {
    name: 'dark',
    primary: 'blue',
    accent: 'cyan'
  },
  cyberpunk: {
    name: 'cyberpunk',
    primary: 'pink',
    accent: 'cyan'
  },
  matrix: {
    name: 'matrix',
    primary: 'green',
    accent: 'emerald'
  },
  synthwave: {
    name: 'synthwave',
    primary: 'purple',
    accent: 'pink'
  },
  crimson: {
    name: 'crimson',
    primary: 'red',
    accent: 'orange'
  },
  ocean: {
    name: 'ocean',
    primary: 'cyan',
    accent: 'blue'
  },
  forest: {
    name: 'forest',
    primary: 'emerald',
    accent: 'green'
  },
  sunset: {
    name: 'sunset',
    primary: 'orange',
    accent: 'yellow'
  },
  midnight: {
    name: 'midnight',
    primary: 'indigo',
    accent: 'violet'
  },
  monochrome: {
    name: 'monochrome',
    primary: 'gray',
    accent: 'slate'
  }
};

/**
 * Theme provider component that manages theme state and transparency settings
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Provider component
 */
export function ThemeProvider({ children }) {
  /**
   * Initialize theme state from localStorage or default
   * @type {[Object, React.Dispatch<React.SetStateAction<Object>>]}
   */
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? JSON.parse(saved) : themes.dark;
  });

  /**
   * Initialize transparency settings from localStorage or defaults
   * @type {[Object, React.Dispatch<React.SetStateAction<Object>>]}
   */
  const [transparencySettings, setTransparencySettings] = useState(() => {
    const saved = localStorage.getItem('transparencySettings');
    return saved ? JSON.parse(saved) : {
      panel: 0.2,
      navbar: 0.2,
      footer: 0.2,
      backdrop: 0.6,
      unified: 0.2 // Added unified setting
    };
  });

  // Update localStorage and DOM when theme changes
  useEffect(() => {
    localStorage.setItem('theme', JSON.stringify(theme));
    document.documentElement.setAttribute('data-theme', theme.name);
  }, [theme]);

  // Update localStorage and CSS variables when transparency settings change
  useEffect(() => {
    localStorage.setItem('transparencySettings', JSON.stringify(transparencySettings));
    
    // Apply CSS variables for each transparency setting
    Object.entries(transparencySettings).forEach(([key, value]) => {
      // Skip the unified key as it's just a reference value
      if (key !== 'unified') {
        document.documentElement.style.setProperty(`--${key}-opacity`, value);
      }
    });
    
    // Explicitly set footer-opacity to match panel opacity for consistency
    document.documentElement.style.setProperty('--footer-opacity', transparencySettings.panel);
  }, [transparencySettings]);

  /**
   * Change the current theme
   * 
   * @param {string} newTheme - Theme name to switch to
   */
  const changeTheme = (newTheme) => {
    setTheme(themes[newTheme] || themes.dark);
  };

  /**
   * Update a specific transparency setting
   * 
   * @param {string} key - Setting key to update (panel, navbar, footer, backdrop, unified)
   * @param {number} value - New transparency value (0-1)
   */
  const updateTransparency = (key, value) => {
    if (key === 'unified') {
      // Update all UI element transparencies when unified is changed
      setTransparencySettings(prev => ({
        ...prev,
        panel: value,
        navbar: value,
        footer: value,
        unified: value
      }));
    } else {
      // For individual settings, just update that setting
      setTransparencySettings(prev => ({
        ...prev,
        [key]: value
      }));
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      changeTheme, 
      transparencySettings, 
      updateTransparency 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Custom hook to access the theme context
 * 
 * @returns {Object} Theme context value
 * @returns {Object} returns.theme - Current theme object
 * @returns {Function} returns.changeTheme - Function to change the theme
 * @returns {Object} returns.transparencySettings - Current transparency settings
 * @returns {Function} returns.updateTransparency - Function to update transparency settings
 * @throws {Error} If used outside of a ThemeProvider
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}