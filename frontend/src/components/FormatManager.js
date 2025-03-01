/**
 * Format Manager component
 * Provides tabbed navigation between format management views
 * @module components/FormatManager
 */
import React, { useState, useEffect } from 'react';
import { Users, Film, Layout, Globe, Home } from 'lucide-react';
import { Alert, AlertDescription } from './ui/UIComponents';
import UnifiedFormatManager from './managers/UnifiedFormatManager';
import SectionManager from './managers/SectionManager';
import EndpointsView from './managers/EndpointsView';
import HomepageView from './managers/HomepageView';

/**
 * Local storage key for active tab
 * @type {string}
 */
const TAB_STORAGE_KEY = 'tautulli-settings-active-tab';

/**
 * Format management component with tabbed navigation
 * 
 * @returns {JSX.Element} Rendered component
 */
const FormatManager = () => {
  /**
   * Library sections configuration
   * @type {[Object|null, Function]}
   */
  const [sections, setSections] = useState(null);
  
  /**
   * Currently active management view
   * @type {[string, Function]}
   */
  const [activeView, setActiveView] = useState(() => {
    // Initialize from localStorage, default to 'sections' if not found
    return localStorage.getItem(TAB_STORAGE_KEY) || 'sections';
  });
  
  /**
   * Error message state
   * @type {[string, Function]}
   */
  const [error, setError] = useState('');
  
  /**
   * Success message state
   * @type {[boolean, Function]}
   */
  const [success, setSuccess] = useState(false);

  /**
   * Check if sections are configured
   */
  useEffect(() => {
    checkSections();
  }, []);

  /**
   * Save active tab to localStorage when it changes
   */
  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, activeView);
  }, [activeView]);

  /**
   * Fetch section configuration
   * 
   * @async
   */
  const checkSections = async () => {
    try {
      const response = await fetch('/api/media/settings');
      const data = await response.json();
      const sectionsData = data.sections || {};
      setSections(sectionsData);
      
      // If no sections are configured, force 'sections' view
      const hasSections = sectionsData.shows?.length > 0 || sectionsData.movies?.length > 0;
      if (!hasSections) {
        setActiveView('sections');
      }
    } catch (err) {
      console.error('Error checking sections:', err);
      setError('Failed to check configuration status');
    }
  };

  /**
   * Handle error notifications
   * 
   * @param {string} message - Error message
   */
  const handleError = (message) => {
    setError(message);
    setSuccess(false);
  };

  /**
   * Handle success notifications
   * 
   * @async
   */
  const handleSuccess = async () => {
    setError('');
    setSuccess(true);
    await checkSections();
    setTimeout(() => setSuccess(false), 3000);
  };

  const hasSections = sections && 
    (sections.shows?.length > 0 || sections.movies?.length > 0);

  /**
   * Tab definitions
   * @type {Array<{id: string, label: string, icon: React.ComponentType}>}
   */
  const tabs = [
    { id: 'formats', label: 'Format Settings', icon: Users },
    { id: 'sections', label: 'Setup', icon: Layout },
    { id: 'homepage', label: 'Homepage Config', icon: Home },
    { id: 'endpoints', label: 'API Endpoints', icon: Globe }
  ];

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4">
          <AlertDescription>Settings saved successfully</AlertDescription>
        </Alert>
      )}

      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        {hasSections ? (
          <>
            <div className="border-b border-gray-700">
              <div className="flex flex-wrap">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveView(id)}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${
                      activeView === id
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {activeView === 'formats' && (
                <UnifiedFormatManager onError={handleError} onSuccess={handleSuccess} />
              )}
              {activeView === 'sections' && (
                <SectionManager onError={handleError} onSuccess={handleSuccess} />
              )}
              {activeView === 'homepage' && (
                <HomepageView />
              )}
              {activeView === 'endpoints' && (
                <EndpointsView />
              )}
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-gray-700">
              <div className="flex">
                <div className="flex items-center gap-2 px-6 py-3 text-sm font-medium bg-gray-700 text-white">
                  <Layout className="h-4 w-4" />
                  Initial Setup Required
                </div>
              </div>
            </div>

            <div className="p-6">
              <SectionManager 
                onError={handleError} 
                onSuccess={handleSuccess}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FormatManager;