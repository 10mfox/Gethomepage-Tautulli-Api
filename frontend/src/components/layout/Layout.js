/**
 * Unified layout components for application
 * Includes navigation, footer, and backdrop elements
 * @module components/layout/Layout
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import ThemeSwitcher from '../ThemeSwitcher';
import { useTheme } from '../../context/ThemeContext';

/**
 * Main navigation component
 * 
 * @param {Object} props - Component props
 * @param {Array<{id: string, label: string}>} props.leftItems - Left navigation items
 * @param {Array<{id: string, label: string}>} props.rightItems - Right navigation items
 * @param {string} props.activeView - Currently active view ID
 * @param {Function} props.onViewChange - Callback for view change
 * @returns {JSX.Element} Rendered component
 */
export const Nav = ({ leftItems, rightItems, activeView, onViewChange }) => {
  return (
    <div className="nav-container">
      <div className="nav-content">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-semibold text-white">
              Tautulli Manager
            </Link>
            
            {/* Left Navigation */}
            <div className="flex gap-8">
              {leftItems.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onViewChange(id)}
                  className={`tab-button ${activeView === id ? 'active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Right Navigation */}
            <div className="flex gap-8 mr-2">
              {rightItems.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onViewChange(id)}
                  className={`tab-button ${activeView === id ? 'active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Theme Switcher with Integrated Transparency Controls */}
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Footer component for application
 * 
 * @returns {JSX.Element} Rendered component
 */
export const Footer = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 p-2 bg-black/20 backdrop-blur-sm border-t border-white/5 text-center z-10">
      <div className="container mx-auto flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Created by <a href="https://github.com/10mfox" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors duration-200" style={{ color: `rgb(var(--accent))` }}>10mfox</a>
        </div>
        <a href="https://github.com/10mfox/Gethomepage-Tautulli-Api" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors duration-200">
          <Github className="h-5 w-5" />
        </a>
      </div>
    </footer>
  );
};

/**
 * Background backdrop component with theme-based gradient overlays
 * 
 * @returns {JSX.Element} Rendered component
 */
export const StaticBackdrop = () => {
  const { theme, transparencySettings } = useTheme();
  
  /**
   * Get theme-specific primary color for gradient
   * 
   * @returns {string} CSS rgba color value
   */
  const getPrimaryColor = () => {
    return `rgba(var(--primary) / 0.1)`;
  };
  
  /**
   * Get theme-specific accent color for gradient
   * 
   * @returns {string} CSS rgba color value
   */
  const getAccentColor = () => {
    return `rgba(var(--accent) / 0.1)`;
  };

  return (
    <div className="fixed inset-0 -z-50">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img src="/backdrop.jpg" alt="" className="object-cover w-full h-full" />
      </div>
      
      {/* Dark overlay with configurable transparency */}
      <div 
        className="absolute inset-0" 
        style={{ 
          backgroundColor: `rgba(0, 0, 0, ${transparencySettings?.backdrop || 0.6})`
        }}
      />
      
      {/* Theme-colored gradient overlays */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 0% 0%, ${getPrimaryColor()} 0px, transparent 50%),
            radial-gradient(circle at 100% 100%, ${getAccentColor()} 0px, transparent 50%)
          `
        }}
      />
      
      {/* Top and bottom gradients for better readability */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />
    </div>
  );
};