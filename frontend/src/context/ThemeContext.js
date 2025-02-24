import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

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

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? JSON.parse(saved) : themes.dark;
  });

  useEffect(() => {
    localStorage.setItem('theme', JSON.stringify(theme));
    document.documentElement.setAttribute('data-theme', theme.name);
  }, [theme]);

  const changeTheme = (newTheme) => {
    setTheme(themes[newTheme] || themes.dark);
  };

  return (
    <ThemeContext.Provider value={{ theme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}