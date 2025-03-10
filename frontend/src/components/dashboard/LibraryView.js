/**
 * Library sections dashboard component
 * Displays library statistics and section information
 * @module components/dashboard/LibraryView
 */
import React, { useState, useEffect } from 'react';
import { Film, Tv, Music } from 'lucide-react';
import { useBackgroundRefresh } from '../../hooks/useBackgroundRefresh';

/**
 * Displays library sections with counts and configured status
 * 
 * @returns {JSX.Element} Rendered component
 */
const LibraryView = () => {
  /**
   * Server refresh interval
   * @type {[number, Function]}
   */
  const [refreshInterval, setRefreshInterval] = useState(300000); // Increased to 5 minutes

  /**
   * Fetch configuration when component mounts
   */
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        const data = await response.json();
        if (data.refreshInterval) {
          console.log(`Setting refresh interval to ${data.refreshInterval}ms`);
          setRefreshInterval(data.refreshInterval);
        }
      } catch (error) {
        console.error('Error fetching configuration:', error);
      }
    };
    
    fetchConfig();
  }, []);

  /**
   * Fetches library data from the API
   * 
   * @async
   * @returns {Promise<Object>} Library data
   * @throws {Error} If fetch fails
   */
  const fetchLibraries = async () => {
    try {
      console.log('Fetching library data...');
      const response = await fetch('/api/media/recent', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch library data');
      }
      const data = await response.json();
      console.log(`Fetched library data: ${data.response.libraries.sections?.length || 0} sections`);
      return data.response.libraries;
    } catch (error) {
      console.error('Error fetching libraries:', error);
      throw new Error('Failed to fetch libraries');
    }
  };

  /**
   * Background refresh hook for library data
   */
  const { 
    data: libraryData, 
    loading, 
    error,
    refresh,
    lastUpdated
  } = useBackgroundRefresh(fetchLibraries, refreshInterval);

  /**
   * Set up visibility-based refreshing
   * Only refresh when the tab is visible and on a reasonable schedule
   */
  useEffect(() => {
    console.log(`Setting up optimized refresh strategy (${refreshInterval}ms)`);
    
    // Force refresh immediately on mount
    refresh();
    
    // Set up a timer with 3x the server interval to reduce frequency
    const refreshTimer = setInterval(() => {
      // Only refresh if the page is visible to the user
      if (document.visibilityState === 'visible') {
        console.log('Periodic refresh - page is visible');
        refresh();
      } else {
        console.log('Skipping refresh - page not visible');
      }
    }, refreshInterval * 3); // Triple the interval to reduce cache hits
    
    // Add visibility change listener to refresh when user returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if data is stale (older than refresh interval)
        const now = Date.now();
        const timeSinceLastUpdate = now - (lastUpdated || 0);
        
        if (timeSinceLastUpdate > refreshInterval) {
          console.log('Page became visible and data is stale, refreshing');
          refresh();
        } else {
          console.log('Page became visible but data is fresh, not refreshing');
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      console.log('Cleaning up refresh timers');
      clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refresh, refreshInterval, lastUpdated]);

  /**
   * Format count display based on library type
   * 
   * @param {Object} library - Library section object
   * @returns {string} Formatted count string
   */
  const formatCount = (library) => {
    if (library.section_type === 'movie') {
      return library.count_formatted + ' movies';
    } else if (library.section_type === 'show') {
      return `${library.count_formatted} shows, ${library.parent_count_formatted} seasons, ${library.child_count_formatted} episodes`;
    } else if (['artist', 'music', 'audio'].includes(library.section_type)) {
      return `${library.count_formatted} artists, ${library.parent_count_formatted} albums, ${library.child_count_formatted} tracks`;
    }
    return library.count_formatted;
  };

  /**
   * Get icon component based on library type
   * 
   * @param {string} sectionType - Section type
   * @returns {React.ReactElement} Icon component
   */
  const getSectionIcon = (sectionType) => {
    switch(sectionType) {
      case 'movie':
        return <Film className="h-4 w-4 text-theme-accent mr-2" />;
      case 'show':
        return <Tv className="h-4 w-4 text-theme-accent mr-2" />;
      case 'artist':
      case 'music':
      case 'audio':
        return <Music className="h-4 w-4 text-theme-accent mr-2" />;
      default:
        return null;
    }
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
          <div className="text-xs text-gray-400">
            Updates every {Math.round(refreshInterval/60000)} minutes
          </div>
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
                      <div className="font-medium text-white flex items-center">
                        {getSectionIcon(library.section_type)}
                        {library.section_name}
                      </div>
                      <div className="text-sm text-gray-500">Section {library.section_id}</div>
                    </div>
                    <div className="text-white">{formatCount(library)}</div>
                    <div className="text-white capitalize">
                      {['artist', 'music', 'audio'].includes(library.section_type) ? 'Music' : library.section_type}
                    </div>
                    <div>
                      <span className={library.configured ? 'status-badge status-configured' : 'status-badge status-disabled'}>
                        {library.configured ? 'Configured' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Totals */}
                {totals.movies && totals.movies.sections > 0 && (
                  <div className="grid grid-cols-2 table-row bg-black/40">
                    <div className="font-medium text-white flex items-center">
                      <Film className="h-4 w-4 text-theme-accent mr-2" />
                      Movies Total
                    </div>
                    <div className="text-white">
                      {totals.movies.sections} {totals.movies.sections === 1 ? 'section' : 'sections'}, {totals.movies.total_items_formatted} movies
                    </div>
                  </div>
                )}
                {totals.shows && totals.shows.sections > 0 && (
                  <div className="grid grid-cols-2 table-row bg-black/40">
                    <div className="font-medium text-white flex items-center">
                      <Tv className="h-4 w-4 text-theme-accent mr-2" />
                      Shows Total
                    </div>
                    <div className="text-white">
                      {totals.shows.sections} {totals.shows.sections === 1 ? 'section' : 'sections'}, {totals.shows.total_items_formatted} shows, {totals.shows.total_seasons_formatted} seasons, {totals.shows.total_episodes_formatted} episodes
                    </div>
                  </div>
                )}
                {totals.music && totals.music.sections > 0 && (
                  <div className="grid grid-cols-2 table-row bg-black/40">
                    <div className="font-medium text-white flex items-center">
                      <Music className="h-4 w-4 text-theme-accent mr-2" />
                      Music Total
                    </div>
                    <div className="text-white">
                      {totals.music.sections} {totals.music.sections === 1 ? 'section' : 'sections'}, {totals.music.total_items_formatted} artists, {totals.music.total_albums_formatted} albums, {totals.music.total_tracks_formatted} tracks
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