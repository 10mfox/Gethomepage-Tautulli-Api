import React, { useState, useEffect } from 'react';
import { RefreshCw, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

const SectionManager = ({ onError, onSuccess }) => {
  const [sections, setSections] = useState({
    shows: [],
    movies: []
  });
  const [envVars, setEnvVars] = useState({
    TAUTULLI_BASE_URL: '',
    TAUTULLI_API_KEY: ''
  });
  const [availableSections, setAvailableSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingConnection, setSavingConnection] = useState(false);
  const [savingSections, setSavingSections] = useState(false);
  const [testStatus, setTestStatus] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStartTime, setTestStartTime] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingsResponse, mediaResponse, configResponse] = await Promise.all([
        fetch('/api/media/settings'),
        fetch('/api/media/recent'),
        fetch('/api/config')
      ]);
      
      const settingsData = await settingsResponse.json();
      const mediaData = await mediaResponse.json();
      const configData = await configResponse.json();
      
      setSections(settingsData.sections || { shows: [], movies: [] });
      setEnvVars({
        TAUTULLI_BASE_URL: configData.baseUrl || '',
        TAUTULLI_API_KEY: configData.apiKey || ''
      });

      if (mediaData?.response?.libraries?.sections) {
        const available = mediaData.response.libraries.sections.map(library => ({
          id: library.section_id,
          name: library.section_name,
          type: library.section_type === 'movie' ? 'movies' : 'shows',
          count: library.count,
          count_formatted: library.count_formatted,
          extra: library.section_type === 'show' ? {
            seasons: library.parent_count_formatted,
            episodes: library.child_count_formatted
          } : null
        }));
        setAvailableSections(available);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      onError('Failed to load settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (!refreshing) {
      setRefreshing(true);
      await fetchData();
    }
  };

  const addSection = (type, sectionId) => {
    setSections(prev => ({
      ...prev,
      [type]: [...new Set([...prev[type], sectionId])]
    }));
  };

  const removeSection = (type, sectionId) => {
    setSections(prev => ({
      ...prev,
      [type]: prev[type].filter(id => id !== sectionId)
    }));
  };

  const handleTestConnection = async () => {
    try {
      if (!envVars.TAUTULLI_BASE_URL || !envVars.TAUTULLI_API_KEY) {
        setTestStatus('error');
        onError('Please enter both Base URL and API Key');
        return;
      }

      setTestStatus('testing');
      setTestStartTime(Date.now());
      
      // Define the endpoint with parameters optimized for quick response
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          baseUrl: envVars.TAUTULLI_BASE_URL,
          apiKey: envVars.TAUTULLI_API_KEY
        }),
      });

      if (!response.ok) {
        throw new Error('Connection test failed');
      }

      const data = await response.json();
      
      if (data.success) {
        // Calculate test duration
        const testDuration = Date.now() - testStartTime;
        
        // Ensure the success message appears for at least 1.5 seconds
        // This gives the user time to see it even if the test is super fast
        if (testDuration < 1500) {
          await new Promise(resolve => setTimeout(resolve, 1500 - testDuration));
        }
        
        setTestStatus('success');
        setTimeout(() => setTestStatus(null), 3000);
      } else {
        throw new Error(data.error || 'Connection verification failed');
      }
    } catch (error) {
      setTestStatus('error');
      onError(error.message || 'Failed to connect to Tautulli');
    }
  };

  const handleSaveConnection = async () => {
    try {
      if (!envVars.TAUTULLI_BASE_URL || !envVars.TAUTULLI_API_KEY) {
        onError('Please enter both Base URL and API Key');
        return;
      }

      setSavingConnection(true);
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          baseUrl: envVars.TAUTULLI_BASE_URL,
          apiKey: envVars.TAUTULLI_API_KEY
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save connection settings');
      }

      onSuccess();
      await fetchData();
    } catch (error) {
      console.error('Connection save error:', error);
      onError('Failed to save connection settings');
    } finally {
      setSavingConnection(false);
    }
  };

  const handleSaveSections = async () => {
    try {
      setSavingSections(true);
      const currentSettings = await fetch('/api/media/settings');
      if (!currentSettings.ok) {
        throw new Error('Failed to fetch current settings');
      }
      const { formats: existingFormats } = await currentSettings.json();

      const response = await fetch('/api/media/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sections,
          formats: existingFormats || {}
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save sections');
      }

      onSuccess();
      window.dispatchEvent(new Event('settingsUpdated'));
    } catch (error) {
      console.error('Sections save error:', error);
      onError('Failed to save sections');
    } finally {
      setSavingSections(false);
    }
  };

  const SectionColumn = ({ type }) => {
    const availableForType = availableSections.filter(section => section.type === type);
    const selectedIds = sections[type];

    if (loading) {
      return (
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="header-text capitalize">
              {type}
            </h3>
          </div>
          <div className="p-4 text-center text-gray-400 border border-white/5 rounded-lg">
            <div className="loading-spinner mx-auto mb-2" />
            Loading...
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="header-text capitalize">
            {type}
          </h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary !p-2"
            title="Refresh Sections"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-3">
          {availableForType.length === 0 ? (
            <div className="p-4 text-center text-gray-400 dark-panel">
              No {type} libraries found in Tautulli
            </div>
          ) : (
            availableForType.map(section => (
              <div key={section.id} className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-3 p-3 dark-panel hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(section.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        addSection(type, section.id);
                      } else {
                        removeSection(type, section.id);
                      }
                    }}
                    className="rounded border-white/10 bg-black/20 text-theme"
                  />
                  <span className="text-white flex-1">{section.name}</span>
                  <div className="text-sm text-gray-500 text-right">
                    <div>{section.count_formatted} items</div>
                    {section.extra && (
                      <div className="text-xs">
                        {section.extra.seasons} seasons, {section.extra.episodes} episodes
                      </div>
                    )}
                  </div>
                </label>
              </div>
            ))
          )}
        </div>

        {availableForType.length > 0 && (
          <div className="mt-3 text-sm text-gray-400">
            {selectedIds.length} of {availableForType.length} libraries selected
          </div>
        )}
      </div>
    );
  };

  const hasSections = sections && 
    (sections.shows?.length > 0 || sections.movies?.length > 0);

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  // Initial setup view
  if (!hasSections) {
    return (
      <div className="section-spacing">
        <Alert className="alert alert-info">
          <AlertDescription className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Initial setup is required. Configure your Tautulli connection, then select which libraries to include.
          </AlertDescription>
        </Alert>

        <div className="dark-panel">
          <div className="table-header">
            <h3 className="header-text">Tautulli Connection</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="form-label">Tautulli Base URL</label>
              <input
                type="url"
                value={envVars.TAUTULLI_BASE_URL}
                onChange={(e) => setEnvVars({
                  ...envVars,
                  TAUTULLI_BASE_URL: e.target.value
                })}
                placeholder="http://localhost:8181"
                className="input-field"
              />
            </div>

            <div className="space-y-2">
              <label className="form-label">Tautulli API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={envVars.TAUTULLI_API_KEY}
                  onChange={(e) => setEnvVars({
                    ...envVars,
                    TAUTULLI_API_KEY: e.target.value
                  })}
                  placeholder="Your Tautulli API key"
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className={`btn-secondary ${
                  testStatus === 'success' ? '!bg-green-600/80 hover:!bg-green-600 text-white' :
                  testStatus === 'error' ? '!bg-red-600/80 hover:!bg-red-600 text-white' :
                  ''
                }`}
              >
                {testStatus === 'success' ? 'Connection Successful!' :
                 testStatus === 'error' ? 'Connection Failed' :
                 testStatus === 'testing' ? 'Testing...' :
                 'Test Connection'}
              </button>
              <button
                onClick={handleSaveConnection}
                disabled={savingConnection}
                className="btn-primary"
              >
                {savingConnection ? 'Saving...' : 'Save Connection'}
              </button>
            </div>
          </div>
        </div>

        <div className="dark-panel">
          <div className="table-header">
            <h3 className="header-text">Library Sections</h3>
          </div>
          
          <div className="p-4 space-y-6">
            <div className="grid grid-cols-2 gap-8">
              <SectionColumn type="shows" />
              <SectionColumn type="movies" />
            </div>

            <button
              onClick={handleSaveSections}
              disabled={savingSections}
              className="btn-primary w-full"
            >
              {savingSections ? 'Saving Sections...' : 'Save Sections'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main view (after initial setup)
  return (
    <div className="section-spacing">
      <Alert className="alert alert-info">
        <AlertDescription className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Configure your Tautulli connection and select which libraries to include in your dashboard.
        </AlertDescription>
      </Alert>

      <div className="dark-panel">
        <div className="table-header">
          <h3 className="header-text">Tautulli Connection</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="form-label">Tautulli Base URL</label>
            <input
              type="url"
              value={envVars.TAUTULLI_BASE_URL}
              onChange={(e) => setEnvVars({
                ...envVars,
                TAUTULLI_BASE_URL: e.target.value
              })}
              placeholder="http://localhost:8181"
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <label className="form-label">Tautulli API Key</label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={envVars.TAUTULLI_API_KEY}
                onChange={(e) => setEnvVars({
                  ...envVars,
                  TAUTULLI_API_KEY: e.target.value
                })}
                placeholder="Your Tautulli API key"
                className="input-field pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleTestConnection}
              disabled={testStatus === 'testing'}
              className={`btn-secondary ${
                testStatus === 'success' ? '!bg-green-600/80 hover:!bg-green-600 text-white' :
                testStatus === 'error' ? '!bg-red-600/80 hover:!bg-red-600 text-white' :
                ''
              }`}
            >
              {testStatus === 'success' ? 'Connection Successful!' :
               testStatus === 'error' ? 'Connection Failed' :
               testStatus === 'testing' ? 'Testing...' :
               'Test Connection'}
            </button>
            <button
              onClick={handleSaveConnection}
              disabled={savingConnection}
              className="btn-primary"
            >
              {savingConnection ? 'Saving...' : 'Save Connection'}
            </button>
          </div>
        </div>
      </div>

      <div className="dark-panel">
        <div className="table-header">
          <h3 className="header-text">Library Sections</h3>
        </div>
        <div className="p-4 space-y-6">
          <div className="grid grid-cols-2 gap-8">
            <SectionColumn type="shows" />
            <SectionColumn type="movies" />
          </div>

          <button
            onClick={handleSaveSections}
            disabled={savingSections}
            className="btn-primary w-full"
          >
            {savingSections ? 'Saving Sections...' : 'Save Sections'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SectionManager;