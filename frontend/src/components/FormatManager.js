import React, { useState, useEffect } from 'react';
import { Users, Film, Layout } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import UserFormatView from './managers/UserFormatView';
import MediaFormatView from './managers/MediaFormatView';
import SectionManager from './managers/SectionManager';

const TAB_STORAGE_KEY = 'tautulli-settings-active-tab';

const FormatManager = () => {
  const [sections, setSections] = useState(null);
  const [activeView, setActiveView] = useState(() => {
    // Initialize from localStorage, default to 'sections' if not found
    return localStorage.getItem(TAB_STORAGE_KEY) || 'sections';
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    checkSections();
  }, []);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, activeView);
  }, [activeView]);

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

  const handleError = (message) => {
    setError(message);
    setSuccess(false);
  };

  const handleSuccess = async () => {
    setError('');
    setSuccess(true);
    await checkSections();
    setTimeout(() => setSuccess(false), 3000);
  };

  const hasSections = sections && 
    (sections.shows?.length > 0 || sections.movies?.length > 0);

  const tabs = [
    { id: 'user', label: 'User Display', icon: Users },
    { id: 'media', label: 'Media Display', icon: Film },
    { id: 'sections', label: 'Section Manager', icon: Layout }
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
              <div className="flex">
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
              {activeView === 'user' && (
                <UserFormatView onError={handleError} onSuccess={handleSuccess} />
              )}
              {activeView === 'media' && (
                <MediaFormatView onError={handleError} onSuccess={handleSuccess} />
              )}
              {activeView === 'sections' && (
                <SectionManager onError={handleError} onSuccess={handleSuccess} />
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