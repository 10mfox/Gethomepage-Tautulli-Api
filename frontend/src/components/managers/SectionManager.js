/**
 * Section Manager component
 * Manages Tautulli connection settings and library section configuration
 * @module components/managers/SectionManager
 */
import React, { useState, useEffect } from 'react';
import { RefreshCw, Eye, EyeOff, AlertCircle, Shield, Globe, Key, Film, Tv, Music } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/UIComponents';

/**
 * Component for configuring Tautulli connection and library sections
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onError - Callback for error notifications
 * @param {Function} props.onSuccess - Callback for success notifications
 * @returns {JSX.Element} Rendered component
 */
const SectionManager = ({ onError, onSuccess }) => {
  /**
   * Selected library sections by type
   * @type {[{shows: Array<number>, movies: Array<number>, music: Array<number>}, Function]}
   */
  const [sections, setSections] = useState({
    shows: [],
    movies: [],
    music: []
  });
  
  /**
   * Tautulli environment variables
   * @type {[{TAUTULLI_BASE_URL: string, TAUTULLI_API_KEY: string}, Function]}
   */
  const [envVars, setEnvVars] = useState({
    TAUTULLI_BASE_URL: '',
    TAUTULLI_API_KEY: ''
  });
  
  /**
   * Available sections from Tautulli
   * @type {[Array<Object>, Function]}
   */
  const [availableSections, setAvailableSections] = useState([]);
  
  /**
   * Loading state
   * @type {[boolean, Function]}
   */
  const [loading, setLoading] = useState(true);
  
  /**
   * Refreshing state
   * @type {[boolean, Function]}
   */
  const [refreshing, setRefreshing] = useState(false);
  
  /**
   * Connection save in progress state
   * @type {[boolean, Function]}
   */
  const [savingConnection, setSavingConnection] = useState(false);
  
  /**
   * Sections save in progress state
   * @type {[boolean, Function]}
   */
  const [savingSections, setSavingSections] = useState(false);
  
  /**
   * Connection test status
   * @type {[string|null, Function]}
   */
  const [testStatus, setTestStatus] = useState(null);
  
  /**
   * Specific connection error message
   * @type {[string|null, Function]}
   */
  const [connectionError, setConnectionError] = useState(null);
  
  /**
   * Specific connection error type for detailed guidance
   * @type {[string|null, Function]}
   */
  const [errorType, setErrorType] = useState(null);
  
  /**
   * API key visibility state
   * @type {[boolean, Function]}
   */
  const [showApiKey, setShowApiKey] = useState(false);
  
  /**
   * Test connection start timestamp
   * @type {[number|null, Function]}
   */
  const [testStartTime, setTestStartTime] = useState(null);

  /**
   * Load data when component mounts
   */
  useEffect(() => {
    fetchData();
  }, []);

  /**
   * Fetch data from API
   * 
   * @async
   */
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
      
      setSections(settingsData.sections || { shows: [], movies: [], music: [] });
      setEnvVars({
        TAUTULLI_BASE_URL: configData.baseUrl || '',
        TAUTULLI_API_KEY: configData.apiKey || ''
      });

      if (mediaData?.response?.libraries?.sections) {
        const available = mediaData.response.libraries.sections.map(library => ({
          id: library.section_id,
          name: library.section_name,
          type: library.section_type === 'movie' ? 'movies' : 
                library.section_type === 'show' ? 'shows' : 
                library.section_type === 'artist' || library.section_type === 'music' ? 'music' : // Add 'music' as possible identifier
                'other',
          section_type: library.section_type,
          count: library.count,
          count_formatted: library.count_formatted,
          extra: library.section_type === 'show' || 
                 library.section_type === 'artist' || 
                 library.section_type === 'music' ? { // Add 'music' type here too
            parent_count: library.parent_count_formatted,
            child_count: library.child_count_formatted
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

  /**
   * Refresh data from API
   * 
   * @async
   */
  const handleRefresh = async () => {
    if (!refreshing) {
      setRefreshing(true);
      await fetchData();
    }
  };

  /**
   * Add a section to selected sections
   * 
   * @param {string} type - Section type (shows, movies, music)
   * @param {number} sectionId - Section ID to add
   */
  const addSection = (type, sectionId) => {
    setSections(prev => ({
      ...prev,
      [type]: [...new Set([...prev[type], sectionId])]
    }));
  };

  /**
   * Remove a section from selected sections
   * 
   * @param {string} type - Section type (shows, movies, music)
   * @param {number} sectionId - Section ID to remove
   */
  const removeSection = (type, sectionId) => {
    setSections(prev => ({
      ...prev,
      [type]: prev[type].filter(id => id !== sectionId)
    }));
  };

  /**
   * Determine error type from error message for targeted guidance
   * 
   * @param {string} errorMessage - The error message
   * @returns {string} Error type identifier
   */
  const determineErrorType = (errorMessage) => {
    if (!errorMessage) return 'unknown';
    
    const lowerErrorMsg = errorMessage.toLowerCase();
    
    if (lowerErrorMsg.includes('please enter both')) return 'missing_fields';
    if (lowerErrorMsg.includes('timeout') || lowerErrorMsg.includes('econnaborted')) return 'timeout';
    if (lowerErrorMsg.includes('refused') || lowerErrorMsg.includes('econnrefused')) return 'connection_refused';
    if (lowerErrorMsg.includes('network') || lowerErrorMsg.includes('unreachable')) return 'network';
    if (lowerErrorMsg.includes('api key') || lowerErrorMsg.includes('invalid key') || lowerErrorMsg.includes('unauthorized')) return 'invalid_api_key';
    if (lowerErrorMsg.includes('https://') || lowerErrorMsg.includes('http://') || lowerErrorMsg.includes('url') || lowerErrorMsg.includes('uri')) return 'invalid_url';
    if (lowerErrorMsg.includes('not found') || lowerErrorMsg.includes('404')) return 'not_found';
    if (lowerErrorMsg.includes('500') || lowerErrorMsg.includes('server error')) return 'server_error';
    
    return 'unknown';
  };

  /**
   * Validate URL format
   * 
   * @param {string} url - URL to validate
   * @returns {boolean} True if URL is valid
   */
  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  };

  /**
   * Test Tautulli connection with current settings
   * 
   * @async
   */
  const handleTestConnection = async () => {
    try {
      // Reset error states
      setErrorType(null);
      
      // Validate inputs before sending request
      if (!envVars.TAUTULLI_BASE_URL && !envVars.TAUTULLI_API_KEY) {
        setTestStatus('error');
        setConnectionError('Please enter both Base URL and API Key');
        setErrorType('missing_fields');
        onError('Please enter both Base URL and API Key');
        return;
      }
      
      if (!envVars.TAUTULLI_BASE_URL) {
        setTestStatus('error');
        setConnectionError('Tautulli Base URL is required');
        setErrorType('missing_url');
        onError('Tautulli Base URL is required');
        return;
      }
      
      if (!envVars.TAUTULLI_API_KEY) {
        setTestStatus('error');
        setConnectionError('Tautulli API Key is required');
        setErrorType('missing_api_key');
        onError('Tautulli API Key is required');
        return;
      }
      
      // Validate URL format
      if (!isValidUrl(envVars.TAUTULLI_BASE_URL)) {
        setTestStatus('error');
        setConnectionError('Invalid URL format. URL must include http:// or https://');
        setErrorType('invalid_url');
        onError('Invalid URL format');
        return;
      }

      setTestStatus('testing');
      setConnectionError(null);
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server returned ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Calculate test duration
        const testDuration = Date.now() - testStartTime;
        
        // Ensure the success message appears for at least 1.5 seconds
        if (testDuration < 1500) {
          await new Promise(resolve => setTimeout(resolve, 1500 - testDuration));
        }
        
        setTestStatus('success');
        setConnectionError(null);
        setErrorType(null);
        setTimeout(() => setTestStatus(null), 3000);
      } else {
        throw new Error(data.error || 'Connection verification failed');
      }
    } catch (error) {
      setTestStatus('error');
      
      // Set the specific error message
      const errorMessage = error.message || 'Failed to connect to Tautulli';
      setConnectionError(errorMessage);
      
      // Determine the error type for targeted guidance
      setErrorType(determineErrorType(errorMessage));
      
      onError(errorMessage);
    }
  };

  /**
   * Save Tautulli connection settings
   * 
   * @async
   */
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

  /**
   * Save selected sections
   * 
   * @async
   */
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

  /**
   * Render error guidance based on error type
   * 
   * @returns {JSX.Element|null} Error guidance component
   */
  const renderErrorGuidance = () => {
    if (!errorType) return null;

    switch (errorType) {
      case 'timeout':
        return (
          <div className="flex items-start gap-2 mt-2 border-t border-red-900/20 pt-2">
            <Globe className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-400 text-xs">
              The connection timed out. This usually means the server is unreachable or taking too long to respond. Make sure your Tautulli server is running and accessible from this location.
            </p>
          </div>
        );
      
      case 'connection_refused':
        return (
          <div className="flex items-start gap-2 mt-2 border-t border-red-900/20 pt-2">
            <Shield className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-400 text-xs">
              Connection was actively refused. This typically means the server is not running, the port is incorrect, or a firewall is blocking the connection. Check that:
              <br />- Your Tautulli server is running
              <br />- The port number is correct (default is 8181)
              <br />- No firewall is blocking the connection
            </p>
          </div>
        );
        
      case 'invalid_api_key':
        return (
          <div className="flex items-start gap-2 mt-2 border-t border-red-900/20 pt-2">
            <Key className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-400 text-xs">
              Your API key appears to be invalid. To locate your Tautulli API key:
              <br />1. Go to Tautulli web interface
              <br />2. Navigate to "Settings" → "Web Interface" → "API"
              <br />3. Copy your API key or generate a new one
            </p>
          </div>
        );
        
      case 'invalid_url':
        return (
          <div className="flex items-start gap-2 mt-2 border-t border-red-900/20 pt-2">
            <Globe className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-400 text-xs">
              The URL format is invalid. Please ensure:
              <br />- URL begins with http:// or https://
              <br />- Include the port number if not using the default port (e.g., http://localhost:8181)
              <br />- Do not include trailing paths like /api or /web
            </p>
          </div>
        );
        
      case 'not_found':
        return (
          <div className="flex items-start gap-2 mt-2 border-t border-red-900/20 pt-2">
            <Globe className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-400 text-xs">
              The server was reached but the page was not found (404). This usually means:
              <br />- The URL path is incorrect
              <br />- Tautulli is installed but not running at the specified path
              <br />- Try removing any trailing paths and only use the base URL (e.g., http://server:8181)
            </p>
          </div>
        );
        
      case 'server_error':
        return (
          <div className="flex items-start gap-2 mt-2 border-t border-red-900/20 pt-2">
            <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-400 text-xs">
              The Tautulli server encountered an internal error. Try these steps:
              <br />- Check your Tautulli logs for errors
              <br />- Restart your Tautulli server
              <br />- Ensure your Tautulli installation is up-to-date
            </p>
          </div>
        );
        
      case 'network':
        return (
          <div className="flex items-start gap-2 mt-2 border-t border-red-900/20 pt-2">
            <Globe className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-400 text-xs">
              A network error occurred. Check that:
              <br />- Your device has internet connectivity
              <br />- The hostname in the URL is correct and can be resolved
              <br />- If using a local address, ensure both systems are on the same network
            </p>
          </div>
        );
        
      case 'missing_fields':
      case 'missing_url':
      case 'missing_api_key':
        return (
          <div className="flex items-start gap-2 mt-2 border-t border-red-900/20 pt-2">
            <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-400 text-xs">
              Please fill in all required fields. You need both a valid Tautulli base URL and API key to connect.
            </p>
          </div>
        );
        
      default:
        return (
          <div className="flex items-start gap-2 mt-2 border-t border-red-900/20 pt-2">
            <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-400 text-xs">
              An unexpected error occurred. Please check:
              <br />- Your Tautulli server is running and accessible
              <br />- The URL and API key are correct
              <br />- Your network configuration allows this connection
            </p>
          </div>
        );
    }
  };

  /**
   * Section column component
   * 
   * @param {Object} props - Component props
   * @param {string} props.type - Section type (shows, movies, music)
   * @returns {JSX.Element} Rendered component
   */
  const SectionColumn = ({ type }) => {
    const availableForType = availableSections.filter(section => {
      // Map Tautulli's 'artist' type to our 'music' type
      if (type === 'music') {
        return section.type === 'music' || section.section_type === 'artist';
      }
      return section.type === type;
    });
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

    // Get icon based on type
    const TypeIcon = type === 'movies' ? Film : type === 'shows' ? Tv : Music;

    return (
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-4 w-4 text-theme-accent" />
            <h3 className="header-text capitalize">
              {type}
            </h3>
          </div>
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
                        {type === 'shows' ? 
                          `${section.extra.parent_count} seasons, ${section.extra.child_count} episodes` : 
                          type === 'music' ? 
                          `${section.extra.parent_count} albums, ${section.extra.child_count} tracks` : 
                          ''}
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
    (sections.shows?.length > 0 || sections.movies?.length > 0 || sections.music?.length > 0);

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

            {testStatus === 'error' && connectionError && (
              <div className="mt-4 p-3 bg-red-950/30 border border-red-700/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="text-red-400 mt-0.5 flex-shrink-0">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-red-400 font-medium mb-1">Connection Failed</h4>
                    <p className="text-red-200 text-sm">{connectionError}</p>
                    
                    {renderErrorGuidance()}
                  </div>
                </div>
              </div>
            )}

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <SectionColumn type="movies" />
              <SectionColumn type="shows" />
              <SectionColumn type="music" />
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

          {testStatus === 'error' && connectionError && (
            <div className="mt-4 p-3 bg-red-950/30 border border-red-700/50 rounded-lg">
              <div className="flex items-start gap-2">
                <div className="text-red-400 mt-0.5 flex-shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-red-400 font-medium mb-1">Connection Failed</h4>
                  <p className="text-red-200 text-sm">{connectionError}</p>
                  
                  {renderErrorGuidance()}
                </div>
              </div>
            </div>
          )}

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <SectionColumn type="movies" />
            <SectionColumn type="shows" />
            <SectionColumn type="music" />
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