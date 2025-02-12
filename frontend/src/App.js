import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav';
import Dashboard from './components/Dashboard';
import FormatManager from './components/FormatManager';

function App() {
  const [sections, setSections] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Add event listener for settings updates
    const checkSections = async () => {
      try {
        const response = await fetch('/api/media/settings');
        const data = await response.json();
        setSections(data.sections || {});
      } catch (err) {
        console.error('Error fetching sections:', err);
      } finally {
        setLoading(false);
      }
    };

    // Listen for settings updates
    window.addEventListener('settingsUpdated', checkSections);
    
    // Initial check
    checkSections();

    // Cleanup
    return () => {
      window.removeEventListener('settingsUpdated', checkSections);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  const hasSections = sections && 
    (sections.shows?.length > 0 || sections.movies?.length > 0);

  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <Nav />
        <div className="container mx-auto">
          <Routes>
            <Route 
              path="/" 
              element={
                !hasSections ? 
                <Navigate to="/format" replace /> : 
                <Dashboard />
              } 
            />
            <Route path="/format" element={<FormatManager />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;