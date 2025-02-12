// frontend/src/components/dashboards/LibraryView.js
import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

const LibraryView = () => {
  const [libraries, setLibraries] = useState([]);
  const [selectedSections, setSelectedSections] = useState({ shows: [], movies: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      if (refreshing) return;
      setRefreshing(true);

      // Fetch both libraries and settings in parallel
      const [librariesResponse, settingsResponse] = await Promise.all([
        fetch('/api/libraries'),
        fetch('/api/media/settings')
      ]);

      if (!librariesResponse.ok || !settingsResponse.ok) {
        throw new Error('Failed to fetch library data');
      }

      const librariesData = await librariesResponse.json();
      const settingsData = await settingsResponse.json();

      // Get all selected section IDs
      const selectedIds = [
        ...(settingsData.sections?.shows || []),
        ...(settingsData.sections?.movies || [])
      ];

      // Filter and sort libraries to only show selected sections
      const filteredLibraries = librariesData.response.data
        .filter(library => selectedIds.includes(library.section_id))
        .sort((a, b) => a.section_id - b.section_id);

      setLibraries(filteredLibraries);
      setSelectedSections(settingsData.sections || { shows: [], movies: [] });
      setError(null);
    } catch (error) {
      console.error('Error fetching libraries:', error);
      setError('Failed to load library data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCount = (library) => {
    if (library.section_type === 'movie') {
      return `${library.count.toLocaleString()} movies`;
    } else if (library.section_type === 'show') {
      return `${library.count.toLocaleString()} shows, ${library.parent_count.toLocaleString()} seasons, ${library.child_count.toLocaleString()} episodes`;
    }
    return library.count.toLocaleString();
  };

  if (loading && !refreshing) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-400">
          {libraries.length === 0 ? (
            'No libraries configured'
          ) : (
            `Showing ${libraries.length} selected ${libraries.length === 1 ? 'library' : 'libraries'}`
          )}
        </div>
        <button
          onClick={fetchData}
          disabled={refreshing}
          className={`flex items-center gap-2 px-3 py-2 rounded text-white transition-colors ${
            refreshing ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {libraries.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
          <p className="text-gray-400">
            No libraries are currently selected. Visit Format Settings to configure your library sections.
          </p>
        </div>
      ) : (
        <div className="bg-gray-800 border border-gray-700 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="p-4 text-left text-gray-300">Section</th>
                  <th className="p-4 text-left text-gray-300">Count</th>
                  <th className="p-4 text-left text-gray-300">Type</th>
                </tr>
              </thead>
              <tbody>
                {libraries.map((library) => (
                  <tr 
                    key={library.section_id} 
                    className="border-b border-gray-700 hover:bg-gray-700 transition-colors"
                  >
                    <td className="p-4 text-gray-300">
                      <div className="font-medium">{library.section_name}</div>
                      <div className="text-sm text-gray-500">Section {library.section_id}</div>
                    </td>
                    <td className="p-4 text-gray-300">{formatCount(library)}</td>
                    <td className="p-4 text-gray-300">
                      {library.section_type === 'show' ? 'TV Show' : 'Movie'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryView;