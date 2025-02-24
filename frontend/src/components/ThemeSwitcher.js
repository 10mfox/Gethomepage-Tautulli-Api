import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Palette } from 'lucide-react';
import { useTheme, themes } from '../context/ThemeContext';

const ThemeSwitcher = () => {
  const { theme, changeTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  // Handle positioning of the dropdown
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        right: window.innerWidth - rect.right
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isOpen && 
        buttonRef.current && 
        !buttonRef.current.contains(event.target) &&
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const themePreview = (themeName) => {
    const themeColor = themes[themeName].primary;
    return (
      <div 
        className="w-4 h-4 rounded-full"
        style={{ 
          backgroundColor: `rgb(var(--${themeColor}))`,
          boxShadow: `0 0 8px rgb(var(--${themeColor}))`
        }}
      />
    );
  };

  // Create portal element
  const portalElement = document.getElementById('theme-portal');
  if (!portalElement) {
    const newPortalElement = document.createElement('div');
    newPortalElement.id = 'theme-portal';
    document.body.appendChild(newPortalElement);
  }

  return (
    <div className="relative">
      <button 
        ref={buttonRef}
        className="flex items-center gap-2 text-gray-400 hover:text-white px-3 py-2 rounded-md"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Palette className="h-4 w-4" />
        <span className="text-sm">Theme</span>
      </button>
      
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed py-2 bg-black/90 backdrop-blur-md rounded-lg border border-white/10 
                    divide-y divide-white/10 shadow-lg w-56"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
            zIndex: 99999
          }}
        >
          <div className="px-3 py-2 text-xs text-gray-400">Select Theme</div>
          <div className="py-1">
            {Object.keys(themes).map((themeName) => (
              <button
                key={themeName}
                onClick={() => {
                  changeTheme(themeName);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-white/10 
                          flex items-center justify-between gap-2
                          ${theme.name === themeName ? 'text-white' : 'text-gray-400'}`}
              >
                <span className="capitalize">{themeName}</span>
                {themePreview(themeName)}
              </button>
            ))}
          </div>
        </div>,
        document.getElementById('theme-portal') || document.body
      )}
    </div>
  );
};

export default ThemeSwitcher;