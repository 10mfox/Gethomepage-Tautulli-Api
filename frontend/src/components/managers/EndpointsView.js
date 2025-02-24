import React, { useState, useEffect } from 'react';
import { ChevronRight, Copy, CheckCircle2, ExternalLink, Globe } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

const EndpointsView = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      console.error('Failed to load configuration:', err);
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

  const handleTest = (url) => {
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  const baseUrl = window.location.origin;
  const movieIds = config?.sections?.movies || [];
  const showIds = config?.sections?.shows || [];

  const endpointGroups = [
    {
      title: 'User Activity Endpoints',
      endpoints: [
        {
          url: `${baseUrl}/api/users`,
          description: 'Get current user activity and status information',
          examples: [
            '?length=25 (limit results)',
            '?search=username (filter by username)',
          ]
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
            `?section=${movieIds[0]},${showIds[0]} (filter by sections)`,
            '?type=shows,movies&section=1,2 (combine filters)'
          ]
        }
      ]
    }
  ];

  return (
    <div className="section-spacing">
      <Alert className="alert alert-info">
        <AlertDescription className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Returns up to 15 items per section in a single combined list, sorted by date added. Filter results using the type and section parameters.
        </AlertDescription>
      </Alert>

      {endpointGroups.map((group, index) => (
        <div key={index} className="dark-panel">
          <div className="table-header">
            <h3 className="header-text">{group.title}</h3>
          </div>
          <div className="divide-y divide-white/5">
            {group.endpoints.map((endpoint, endpointIndex) => (
              <div key={endpointIndex} className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="bg-black/20 rounded-lg p-3 flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-theme-accent flex-shrink-0" />
                    <code className="text-sm text-theme-accent flex-grow break-all">
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
                    className="btn-primary w-full"
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

                {endpoint.examples && (
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
      ))}
    </div>
  );
};

export default EndpointsView;