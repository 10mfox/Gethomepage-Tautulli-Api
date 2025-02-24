import React from 'react';
import { useTheme } from '../context/ThemeContext';

const StaticBackdrop = () => {
  const { theme } = useTheme();
  
  // Get theme-specific overlay colors
  const getPrimaryColor = () => {
    return `rgba(var(--primary) / 0.1)`;
  };
  
  const getAccentColor = () => {
    return `rgba(var(--accent) / 0.1)`;
  };

  return (
    <div className="fixed inset-0 -z-50">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img src="/backdrop.jpg" alt="" className="object-cover w-full h-full" />
      </div>
      
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />
      
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

export default StaticBackdrop;