/**
 * Unified layout components for application
 * Includes navigation, footer, and backdrop elements
 * @module components/layout/Layout
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Github } from 'lucide-react';

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
    <div className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <div className="flex-shrink-0 flex items-center">
              <img src="/favicon.ico" alt="Logo" className="h-8 w-8 mr-3" />
              <span className="text-xl font-bold text-white">Audiobookshelf Manager</span>
            </div>
            
            {/* Left Navigation */}
            <div className="hidden md:flex gap-4">
              {leftItems.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onViewChange(id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeView === id 
                      ? 'bg-blue-700 text-white' 
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Right Navigation */}
            <div className="hidden md:flex gap-4">
              {rightItems.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onViewChange(id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeView === id 
                      ? 'bg-blue-700 text-white' 
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile navigation */}
      <div className="md:hidden border-t border-gray-800">
        <div className="grid grid-cols-6 gap-1 p-1">
          {[...leftItems, ...rightItems].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              className={`flex flex-col items-center justify-center p-2 rounded-md text-xs ${
                activeView === id 
                  ? 'bg-blue-700 text-white' 
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span className="mt-1">{label}</span>
            </button>
          ))}
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
    <footer className="fixed bottom-0 left-0 right-0 p-2 bg-gray-900 border-t border-gray-800 text-center z-10">
      <div className="container mx-auto flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Created by <a href="https://github.com/10mfox" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-white transition-colors duration-200">10mfox</a>
        </div>
        <a href="https://github.com/10mfox/Gethomepage-Tautulli-Api" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors duration-200">
          <Github className="h-5 w-5" />
        </a>
      </div>
    </footer>
  );
};

/**
 * Background backdrop component with solid background
 * 
 * @returns {JSX.Element} Rendered component
 */
export const StaticBackdrop = () => {
  return (
    <div className="fixed inset-0 -z-50">
      {/* Solid background */}
      <div className="absolute inset-0 bg-gray-900"></div>
    </div>
  );
};