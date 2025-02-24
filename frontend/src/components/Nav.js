import React from 'react';
import { Link } from 'react-router-dom';
import ThemeSwitcher from './ThemeSwitcher';

const Nav = ({ leftItems, rightItems, activeView, onViewChange }) => {
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

          <div className="flex items-center gap-8">
            {/* Right Navigation */}
            <div className="flex gap-8">
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

            {/* Theme Switcher */}
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Nav;