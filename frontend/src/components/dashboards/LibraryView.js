import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useBackgroundRefresh } from '../../hooks/useBackgroundRefresh';

const LibraryView = () => {
  const fetchLibraries = async () => {
    try {
      const response = await fetch('/api/media/recent');
      if (!response.ok) {
        throw new Error('Failed to fetch library data');
      }
      const data = await response.json();
      return data.response.libraries;
    } catch (error) {
      throw new Error('Failed to fetch libraries');
    }
  };

  const { 
    data: libraryData, 
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

  const { sections = [], totals = {} } = libraryData || {};
  const numConfigured = sections.filter(section => section.configured).length;

  return (
    <div className="section-spacing">
      <div className="dark-panel">
        <div className="p-4 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {numConfigured === 0 ? (
              'No libraries configured'
            ) : (
              `${numConfigured} configured ${numConfigured === 1 ? 'library' : 'libraries'}`
            )}
          </div>
          <button
            onClick={refresh}
            className="btn-primary relative group"
            title={lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : ''}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="dark-panel">
        <div className="data-table">
          {/* Table Header */}
          <div className="grid grid-cols-4 table-header">
            <div className="subheader-text">Section</div>
            <div className="subheader-text">Count</div>
            <div className="subheader-text">Type</div>
            <div className="subheader-text">Status</div>
          </div>

          {/* Table Content */}
          <div className="divide-y divide-white/5">
            {loading && !libraryData ? (
              <div className="p-8 flex justify-center items-center">
                <div className="loading-spinner" />
              </div>
            ) : error ? (
              <div className="text-center text-red-400 py-8">{error}</div>
            ) : sections.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                No libraries found
              </div>
            ) : (
              <>
                {/* Library Sections */}
                {sections.map((library) => (
                  <div 
                    key={library.section_id} 
                    className="grid grid-cols-4 table-row"
                  >
                    <div>
                      <div className="font-medium text-white">{library.section_name}</div>
                      <div className="text-sm text-gray-500">Section {library.section_id}</div>
                    </div>
                    <div className="text-white">{formatCount(library)}</div>
                    <div className="text-white">
                      {library.section_type === 'show' ? 'TV Show' : 'Movie'}
                    </div>
                    <div>
                      <span className={library.configured ? 'status-badge status-configured' : 'status-badge status-disabled'}>
                        {library.configured ? 'Configured' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Totals */}
                {totals.movies && (
                  <div className="grid grid-cols-2 table-row bg-black/40">
                    <div className="font-medium text-white">Movies Total</div>
                    <div className="text-white">
                      {totals.movies.sections} {totals.movies.sections === 1 ? 'section' : 'sections'}, {totals.movies.total_items_formatted} movies
                    </div>
                  </div>
                )}
                {totals.shows && (
                  <div className="grid grid-cols-2 table-row bg-black/40">
                    <div className="font-medium text-white">Shows Total</div>
                    <div className="text-white">
                      {totals.shows.sections} {totals.shows.sections === 1 ? 'section' : 'sections'}, {totals.shows.total_items_formatted} shows, {totals.shows.total_seasons_formatted} seasons, {totals.shows.total_episodes_formatted} episodes
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibraryView;