/**
 * API Endpoints documentation component
 * Displays information about available API endpoints with examples
 * @module components/managers/EndpointsView
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronRight, Copy, CheckCircle2, ExternalLink, Globe, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/UIComponents';

/**
 * Component for displaying and testing API endpoints
 * 
 * @returns {JSX.Element} Rendered component
 */
const EndpointsView = () => {
  /**
   * Application configuration
   * @type {[Object|null, Function]}
   */
  const [config, setConfig] = useState(null);
  
  /**
   * Loading state
   * @type {[boolean, Function]}
   */
  const [loading, setLoading] = useState(true);
  
  /**
   * Error state
   * @type {[string|null, Function]}
   */
  const [error, setError] = useState(null);
  
  /**
   * URL that was last copied
   * @type {[string|null, Function]}
   */
  const [copiedUrl, setCopiedUrl] = useState(null);

  /**
   * Fetch application configuration
   */
  useEffect(() => {
    fetchConfig();
  }, []);

  /**
   * Load configuration data from API with error handling
   * 
   * @async
   */
  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/config');
      
      if (!response.ok) {
        throw new Error(`Failed to load configuration: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      console.error('Failed to load configuration:', err);
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Copy URL to clipboard with improved error handling
   * 
   * @async
   * @param {string} url - URL to copy
   */
  const handleCopy = useCallback(async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Provide a fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  }, []);

  /**
   * Open URL in new tab for testing with enhanced validation
   * 
   * @param {string} url - URL to test
   */
  const handleTest = useCallback((url) => {
    if (!url) return;
    
    try {
      const testUrl = new URL(url);
      window.open(testUrl.toString(), '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error('Invalid URL:', err);
    }
  }, []);

  /**
   * Memoized base URL to prevent recalculation
   */
  const baseUrl = useMemo(() => window.location.origin, []);

  /**
   * Memoized section IDs
   */
  const { movieIds, showIds, musicIds } = useMemo(() => ({
    movieIds: config?.sections?.movies || [],
    showIds: config?.sections?.shows || [],
    musicIds: config?.sections?.music || []
  }), [config]);

  /**
   * Endpoint group definitions with memoization
   */
  const endpointGroups = useMemo(() => [
    {
      title: 'User Activity Endpoints',
      endpoints: [
        {
          url: `${baseUrl}/api/users`,
          description: 'Get current user activity and status information',
          examples: [
            '?length=25 (limit results)',
            '?search=username (filter by username)',
            '?fields=field,additionalfield (select specific fields)',
            '?order_column=friendly_name&order_dir=desc (sort results)'
          ]
        },
        {
          url: `${baseUrl}/api/users/format-settings`,
          description: 'Get or update user display format settings',
          method: 'GET/POST',
          examples: []
        }
      ]
    },
    {
      title: 'Recent Media Endpoints',
      endpoints: [
        {
          url: `${baseUrl}/api/media/recent`,
          description: 'Get recently added media from configured sections',
          examples: [
            '?type=shows (filter by shows)',
            '?type=movies (filter by movies)',
            '?type=music (filter by music)',
            movieIds.length > 0 ? `?section=${movieIds[0]} (filter by movie section)` : '',
            showIds.length > 0 ? `?section=${showIds[0]} (filter by show section)` : '',
            musicIds.length > 0 ? `?section=${musicIds[0]} (filter by music section)` : '',
            '?count=10 (limit results to 10 per section)'
          ].filter(Boolean)
        },
        {
          url: `${baseUrl}/api/media/settings`,
          description: 'Get or update media format settings',
          method: 'GET/POST',
          examples: []
        }
      ]
    }
  ], [baseUrl, movieIds, showIds, musicIds]);

  /**
   * ConfigSection component for displaying YAML with copy functionality
   */
  const ConfigSection = useCallback(({ group }) => (
    <div className="dark-panel mb-4">
      <div className="table-header">
        <h3 className="header-text">{group.title}</h3>
      </div>
      <div className="divide-y divide-white/5">
        {group.endpoints.map((endpoint, endpointIndex) => (
          <div key={endpointIndex} className="p-4 space-y-4">
            <div className="space-y-2">
              <div className="bg-black/20 rounded-lg p-3 flex items-center gap-2">
                {endpoint.method ? (
                  <span className="px-2 py-1 rounded bg-theme-accent/20 text-xs font-mono text-theme-accent">
                    {endpoint.method}
                  </span>
                ) : (
                  <ChevronRight className="h-4 w-4 text-theme-accent flex-shrink-0" />
                )}
                <code className="text-sm text-theme-accent flex-grow break-all">
                  {endpoint.url}
                </code>
                <button
                  onClick={() => handleCopy(endpoint.url)}
                  className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
                  title="Copy URL"
                  aria-label={`Copy ${endpoint.url}`}
                >
                  {copiedUrl === endpoint.url ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              <button
                onClick={() => handleTest(endpoint.url)}
                className="btn-primary w-full"
                aria-label={`Test ${endpoint.url}`}
              >
                <ExternalLink className="h-4 w-4" />
                Test Endpoint
              </button>
            </div>

            {endpoint.description && (
              <p className="text-sm text-gray-400 ml-6">
                {endpoint.description}
              </p>
            )}

            {endpoint.examples && endpoint.examples.length > 0 && (
              <div className="bg-black/20 rounded-lg p-4 space-y-2">
                <h4 className="subheader-text">Example Parameters:</h4>
                {endpoint.examples.map((example, i) => (
                  <div key={i} className="text-sm">
                    <code className="text-theme-accent">{example}</code>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  ), [handleCopy, handleTest, copiedUrl]);

  /**
   * Debug Dashboard Section
   */
  const DebugDashboard = useCallback(() => (
    <div className="dark-panel mb-4">
      <div className="table-header">
        <h3 className="header-text">Debug Dashboard</h3>
      </div>
      <div className="p-4">
        <p className="text-sm text-gray-300 mb-4">
          The Debug Dashboard provides an interface for monitoring and managing the application's performance and state.
          It can be accessed directly by administrators to perform various debugging and maintenance tasks.
        </p>
        
        <div className="space-y-4">
          <div className="bg-black/20 rounded-lg p-4">
            <h4 className="subheader-text mb-2">Dashboard Features</h4>
            <ul className="text-sm text-gray-400 space-y-2 ml-4 list-disc">
              <li>Server status monitoring and metrics</li>
              <li>Cache statistics and management</li>
              <li>Memory usage and performance data</li>
              <li>Tautulli connection status and configuration</li>
              <li>Library section overview</li>
              <li>Data refresh controls</li>
              <li>Verbose logging toggle</li>
            </ul>
          </div>
          
          <div className="bg-black/20 rounded-lg p-4">
            <h4 className="subheader-text mb-2">Dashboard Access</h4>
            <p className="text-sm text-gray-400">
              The Debug Dashboard is available at:
            </p>
            <div className="mt-2 bg-black/30 rounded-lg p-3 flex items-center gap-2">
              <code className="text-sm text-theme-accent flex-grow break-all">
                {`${baseUrl}/api/debug`}
              </code>
              <button
                onClick={() => handleCopy(`${baseUrl}/api/debug`)}
                className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
                title="Copy URL"
              >
                {copiedUrl === `${baseUrl}/api/debug` ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <button
              onClick={() => handleTest(`${baseUrl}/api/debug`)}
              className="btn-primary w-full mt-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open Debug Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  ), [baseUrl, handleCopy, handleTest, copiedUrl]);

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert className="alert alert-error">
          <AlertCircle className="h-5 w-5 mr-2" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        <button 
          onClick={fetchConfig} 
          className="btn-primary mt-4"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="section-spacing">
      <Alert className="alert alert-info mb-6">
        <AlertDescription className="flex items-center gap-2">
          <Globe className="h-4 w-4 flex-shrink-0" />
          <span>
            These API endpoints are designed for integration with external services. 
            Each endpoint returns JSON data and supports various query parameters for filtering and customization.
          </span>
        </AlertDescription>
      </Alert>

      {endpointGroups.map((group, index) => (
        <ConfigSection key={index} group={group} />
      ))}
      
      <DebugDashboard />
    </div>
  );
};

export default React.memo(EndpointsView);