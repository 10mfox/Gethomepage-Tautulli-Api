/**
 * Main application component
 * Handles routing, view management, and application state
 * @module App
 */
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { Nav, Footer, StaticBackdrop } from './components/layout/Layout';
import UserView from './components/dashboard/UserView';
import RecentMediaView from './components/dashboard/RecentMediaView';
import LibraryView from './components/dashboard/LibraryView';
import UnifiedFormatManager from './components/managers/UnifiedFormatManager';
import SectionManager from './components/managers/SectionManager';
import EndpointsView from './components/managers/EndpointsView';

/**
 * Main application component
 * 
 * @returns {JSX.Element} Rendered application
 */
function App() {
  const [sections, setSections] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('sectionManager');
  const [isConfigured, setIsConfigured] = useState(false);

  /**
   * Left navigation items definition
   * @type {Array<{id: string, label: string, component: React.ComponentType}>}
   */
  const leftNavItems = [
    { id: 'users', label: 'Users', component: UserView },
    { id: 'recent', label: 'Recent Media', component: RecentMediaView },
    { id: 'libraries', label: 'Libraries', component: LibraryView }
  ];

  /**
   * Right navigation items definition
   * @type {Array<{id: string, label: string, component: React.ComponentType}>}
   */
  const rightNavItems = [
    { id: 'formatManager', label: 'Format Settings', component: UnifiedFormatManager },
    { id: 'sectionManager', label: 'Setup', component: SectionManager },
    { id: 'apiEndpoints', label: 'API Endpoints', component: EndpointsView }
  ];

  /**
   * Fetch configuration and check if app is configured
   */
  useEffect(() => {
    const fetchConfiguration = async () => {
      try {
        setLoading(true);
        
        // Fetch both configuration and settings in parallel
        const [configResponse, settingsResponse] = await Promise.all([
          fetch('/api/config'),
          fetch('/api/media/settings')
        ]);
        
        const configData = await configResponse.json();
        const settingsData = await settingsResponse.json();
        
        setConfig(configData);
        setSections(settingsData.sections || {});
        
        // Check if Tautulli is configured and sections exist
        const hasTautulliConfig = !!(configData.baseUrl && configData.apiKey);
        const hasSections = !!(
          settingsData.sections?.movies?.length > 0 || 
          settingsData.sections?.shows?.length > 0
        );
        
        setIsConfigured(hasTautulliConfig && hasSections);
        
        // If we're not configured, force the section manager view
        if (!hasTautulliConfig || !hasSections) {
          setActiveView('sectionManager');
        }
      } catch (err) {
        console.error('Error fetching configuration:', err);
        // On error, show section manager
        setIsConfigured(false);
        setActiveView('sectionManager');
      } finally {
        setLoading(false);
      }
    };

    fetchConfiguration();
  }, []);

  /**
   * Handle changing the active view
   * 
   * @param {string} view - View ID to activate
   */
  const handleViewChange = (view) => {
    if (!isConfigured && view !== 'sectionManager') {
      // If not configured, only allow section manager
      return;
    }
    setActiveView(view);
  };

  /**
   * Get component based on active view
   * Only allow SectionManager if not configured
   * 
   * @returns {React.ComponentType} Component for active view
   */
  const getActiveComponent = () => {
    if (!isConfigured) {
      return SectionManager;
    }
    
    return [...leftNavItems, ...rightNavItems]
      .find(item => item.id === activeView)?.component || SectionManager;
  };

  const ActiveComponent = getActiveComponent();

  if (loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen flex items-center justify-center">
          <StaticBackdrop />
          <div className="loading-spinner" />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Router>
        <div className="page-container">
          <StaticBackdrop />
          {isConfigured ? (
            // Show full navigation when configured
            <Nav
              leftItems={leftNavItems}
              rightItems={rightNavItems}
              activeView={activeView}
              onViewChange={handleViewChange}
            />
          ) : (
            // Show limited navigation when not configured
            <div className="nav-container">
              <div className="nav-content">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-8">
                    <div className="text-xl font-semibold text-white">
                      Tautulli Manager
                    </div>
                  </div>
                  <div>
                    <div className="tab-button active">Initial Setup Required</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <main className="main-content">
            <ActiveComponent 
              onError={() => {}} 
              onSuccess={() => {
                // Refresh configuration after successful save
                window.location.reload();
              }} 
            />
          </main>
          <Footer />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;