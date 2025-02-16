import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { useBackgroundRefresh } from '../../hooks/useBackgroundRefresh';

const LibraryView = () => {
  const fetchLibraries = async () => {
    try {
      const response = await fetch('/api/libraries');
      if (!response.ok) {
        throw new Error('Failed to fetch library data');
      }
      return await response.json();
    } catch (error) {
      throw new Error('Failed to fetch libraries');
    }
  };

  const { 
    data: libraries, 
    loading, 
    error, 
    lastUpdated, 
    refresh 
  } = useBackgroundRefresh(fetchLibraries);

  const formatCount = (library) => {
    if (library.section_type === 'movie') {
      return library.count_formatted + ' movies';
    } else if (library.section_type === 'show') {
      return `${library.count_formatted} shows, ${library.parent_count_formatted} seasons, ${library.child_count_formatted} episodes`;
    }
    return library.count_formatted;
  };

  if (loading && !libraries) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const sections = libraries?.response?.sections || [];
  const totals = libraries?.response?.totals;
  const numConfigured = sections.filter(section => section.configured).length;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-400">
          {numConfigured === 0 ? (
            'No libraries configured'
          ) : (
            `${numConfigured} configured ${numConfigured === 1 ? 'library' : 'libraries'}`
          )}
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-3 py-2 rounded text-white bg-blue-600 hover:bg-blue-700 relative group"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
          {lastUpdated && (
            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs bg-gray-900 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
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
                <th className="p-4 text-left text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((library) => (
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
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      library.configured
                        ? 'bg-green-900 text-green-100'
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      {library.configured ? 'Configured' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
              {/* Totals Row - Movies */}
              {totals && (
                <>
                  <tr className="bg-gray-750">
                    <td className="p-4 text-gray-300 font-medium" colSpan="2">
                      Movies Total
                    </td>
                    <td className="p-4 text-gray-300" colSpan="2">
                      {totals.movies.sections} {totals.movies.sections === 1 ? 'section' : 'sections'}, {totals.movies.total_items_formatted} movies
                    </td>
                  </tr>
                  <tr className="bg-gray-750">
                    <td className="p-4 text-gray-300 font-medium" colSpan="2">
                      Shows Total
                    </td>
                    <td className="p-4 text-gray-300" colSpan="2">
                      {totals.shows.sections} {totals.shows.sections === 1 ? 'section' : 'sections'}, {totals.shows.total_items_formatted} shows, {totals.shows.total_seasons_formatted} seasons, {totals.shows.total_episodes_formatted} episodes
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LibraryView;