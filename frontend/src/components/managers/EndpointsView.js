import React, { useState, useEffect } from 'react';
import { Globe, ChevronRight, Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

const EndpointsView = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      setConfig(data);
      setError(null);
    } catch (err) {
      setError('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleTest = async (url) => {
    try {
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to open URL:', err);
    }
  };

  const EndpointCard = ({ title, endpoints }) => (
    <div className="bg-gray-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-800 border-b border-gray-600">
        <h3 className="text-sm font-medium text-white">{title}</h3>
      </div>
      <div className="p-4 space-y-3">
        {endpoints.map((endpoint, index) => (
          <div key={index} className="space-y-1">
            <div className="space-y-2">
              <div className="group relative flex items-center gap-2 bg-gray-800 rounded-lg p-2">
                <ChevronRight className="h-4 w-4 text-blue-400 flex-shrink-0" />
                <code className="text-sm text-blue-300 flex-grow break-all">
                  {endpoint.url}
                </code>
                <button
                  onClick={() => handleCopy(endpoint.url)}
                  className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"
                  title="Copy URL"
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
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
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
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return <div className="text-center text-gray-400">Loading endpoints...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const baseUrl = window.location.origin;
  const movieIds = config?.sections?.movies || [];
  const showIds = config?.sections?.shows || [];

  const endpointGroups = [
    {
      title: 'User Endpoints',
      endpoints: [
        {
          url: `${baseUrl}/api/users`,
          description: 'User activity and status information'
        }
      ]
    },
    {
      title: 'Library Endpoints',
      endpoints: [
        {
          url: `${baseUrl}/api/libraries`,
          description: 'Library sections and statistics'
        }
      ]
    },
    {
      title: 'Movie Endpoints',
      endpoints: [
        ...(movieIds.length > 1 ? [{
          url: `${baseUrl}/api/recent/movies?count=5`,
          description: `Get all recently added movies content (combines ${movieIds.length} sections)`
        }] : []),
        ...movieIds.map(id => ({
          url: `${baseUrl}/api/recent/movies/${id}?count=5`,
          description: `Get recently added movies content from section ${id}`
        })),
        ...(movieIds.length === 0 ? [{
          url: `${baseUrl}/api/recent/movies?count=5`,
          description: 'Movies sections not configured'
        }] : [])
      ]
    },
    {
      title: 'TV Show Endpoints',
      endpoints: [
        ...(showIds.length > 1 ? [{
          url: `${baseUrl}/api/recent/shows?count=5`,
          description: `Get all recently added shows content (combines ${showIds.length} sections)`
        }] : []),
        ...showIds.map(id => ({
          url: `${baseUrl}/api/recent/shows/${id}?count=5`,
          description: `Get recently added shows content from section ${id}`
        })),
        ...(showIds.length === 0 ? [{
          url: `${baseUrl}/api/recent/shows?count=5`,
          description: 'TV Show sections not configured'
        }] : [])
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-900/50 border-blue-800 text-blue-100">
        <AlertDescription className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Click the endpoints to test them, or use the copy button to get the URL
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        {endpointGroups.map((group, index) => (
          <EndpointCard
            key={index}
            title={group.title}
            endpoints={group.endpoints}
          />
        ))}
      </div>
    </div>
  );
};

export default EndpointsView;