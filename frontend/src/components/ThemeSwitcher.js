/**
 * Theme Switcher component with unified transparency controls
 * @module components/ThemeSwitcher
 */
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, themes } from '../context/ThemeContext';

const ThemeSwitcher = () => {
  const { theme, changeTheme, transparencySettings, updateTransparency } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef(null);

  // Calculate dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY,
        right: window.innerWidth - rect.right
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && buttonRef.current && !buttonRef.current.contains(event.target)) {
        // Check if click is inside the dropdown
        const dropdown = document.getElementById('theme-dropdown');
        if (dropdown && !dropdown.contains(event.target)) {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Reset transparency settings to defaults
  const resetToDefaults = () => {
    updateTransparency('unified', 0.2); // 20%
    updateTransparency('backdrop', 0.6); // 60%
  };

  // Handle unified transparency change (affects panel, navbar, and footer)
  const handleUnifiedTransparencyChange = (e) => {
    // Convert percentage value (0-100) to decimal (0-1)
    const value = parseInt(e.target.value) / 100;
    updateTransparency('unified', value);
  };

  // Handle backdrop transparency change with correct opacity mapping
  const handleBackdropTransparencyChange = (e) => {
    // Convert percentage value (0-100) to decimal (0-1)
    // For backdrop, 0% should be completely transparent (0.0)
    const value = parseInt(e.target.value) / 100;
    updateTransparency('backdrop', value);
  };

  // Create portal container if needed
  useEffect(() => {
    if (!document.getElementById('portal-root')) {
      const portalRoot = document.createElement('div');
      portalRoot.id = 'portal-root';
      document.body.appendChild(portalRoot);
    }
    return () => {
      const portalRoot = document.getElementById('portal-root');
      if (portalRoot && portalRoot.childNodes.length === 0) {
        document.body.removeChild(portalRoot);
      }
    };
  }, []);

  return (
    <div className="relative">
      <button 
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4"
      >
        Theme
      </button>
      
      {isOpen && createPortal(
        <div 
          id="theme-dropdown"
          className="fixed shadow-lg border border-white/10 rounded-lg"
          style={{ 
            top: `${position.top}px`, 
            right: `${position.right}px`,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(10px)',
            width: '550px',
            display: 'flex',
            zIndex: 9999999
          }}
        >
          {/* Left side: Transparency Controls */}
          <div className="w-2/5 border-r border-white/10">
            <div className="px-4 py-2 text-sm text-gray-300 border-b border-white/10">
              Transparency Settings
            </div>
            
            <div className="p-4 space-y-4">
              {/* Unified Transparency (Panel, Navbar, Footer) */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">UI Elements</span>
                  <span className="text-xs text-gray-500">
                    {Math.round(transparencySettings.panel * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={Math.round(transparencySettings.panel * 100)}
                  onChange={handleUnifiedTransparencyChange}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-xs text-gray-500 text-center">
                  Controls transparency for panels, navigation bar, and footer
                </div>
              </div>
              
              {/* Backdrop Transparency */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Background Overlay</span>
                  <span className="text-xs text-gray-500">
                    {Math.round(transparencySettings.backdrop * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={Math.round(transparencySettings.backdrop * 100)}
                  onChange={handleBackdropTransparencyChange}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="text-xs text-gray-500 text-center">
                  5% = mostly transparent, 100% = solid black
                </div>
              </div>
              
              {/* Reset Button */}
              <button
                onClick={resetToDefaults}
                className="w-full text-center text-xs text-gray-400 hover:text-white mt-2 pt-2 border-t border-white/10"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
          
          {/* Right side: Theme Selection */}
          <div className="w-3/5">
            <div className="px-4 py-2 text-sm text-gray-300 border-b border-white/10">
              Select Theme
            </div>
            
            <div className="py-1 max-h-80 overflow-y-auto">
              {Object.keys(themes).map((themeName) => (
                <button
                  key={themeName}
                  onClick={() => {
                    changeTheme(themeName);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors hover:bg-white/5 
                            ${theme.name === themeName ? 'text-blue-400' : 'text-gray-300'}`}
                >
                  <span className="capitalize">{themeName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.getElementById('portal-root') || document.body
      )}
    </div>
  );
};

export default ThemeSwitcher;