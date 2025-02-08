import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const LibraryView = () => {
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLibraries = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/libraries');
      if (!response.ok) throw new Error('Failed to fetch libraries');
      const data = await response.json();
      // Sort libraries by section_id
      const sortedLibraries = (data.response?.data || []).sort((a, b) => a.section_id - b.section_id);
      setLibraries(sortedLibraries);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibraries();
  }, []);

  const formatCount = (library) => {
    if (library.section_type === 'movie') {
      return `${library.count} movies`;
    } else if (library.section_type === 'show') {
      return `${library.count} shows, ${library.parent_count} seasons, ${library.child_count} episodes`;
    }
    return library.count;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={fetchLibraries}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

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
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-400">
                    Loading libraries...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-red-400">
                    {error}
                  </td>
                </tr>
              ) : libraries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-400">
                    No libraries found
                  </td>
                </tr>
              ) : (
                libraries.map((library) => (
                  <tr key={library.section_id} className="border-b border-gray-700 hover:bg-gray-700">
                    <td className="p-4 text-gray-300">
                      {library.section_name}
                      <span className="ml-2 text-sm text-gray-500">Section {library.section_id}</span>
                    </td>
                    <td className="p-4 text-gray-300">{formatCount(library)}</td>
                    <td className="p-4 text-gray-300">{capitalizeFirstLetter(library.section_type)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export default LibraryView;