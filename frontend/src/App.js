import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav';
import Footer from './components/Footer';
import Dashboard from './components/Dashboard';
import FormatManager from './components/FormatManager';

function App() {
  const [sections, setSections] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    window.addEventListener('settingsUpdated', checkSections);
    
    checkSections();

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
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <Nav />
        <main className="flex-grow container mx-auto pb-16">
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
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;