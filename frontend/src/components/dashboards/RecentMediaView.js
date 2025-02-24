import React, { useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useBackgroundRefresh } from '../../hooks/useBackgroundRefresh';

const RESULTS_PER_SECTION = 15;

const MediaItem = React.memo(({ item, libraryName }) => (
  <div className="grid grid-cols-5 table-row">
    <div className="col-span-3">
      <div className="text-white">
        {item.field || 'Untitled'}
      </div>
      {item.additionalfield && (
        <div className="text-gray-400 text-sm mt-1">
          {item.additionalfield}
        </div>
      )}
      <div className="text-sm text-gray-500 mt-1">
        {libraryName} • {item.media_type === 'shows' ? 'TV Show' : 'Movie'}
      </div>
    </div>
    <div className="col-span-2 text-right text-gray-400">
      {item.added_at_relative}
    </div>
  </div>
));

const RecentMediaView = () => {
  const [type, setType] = useState(null);

  const fetchMedia = async () => {
    try {
      const url = new URL('/api/media/recent', window.location.origin);
      if (type) {
        url.searchParams.append('type', type);
      }
      url.searchParams.append('count', RESULTS_PER_SECTION);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch media');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching media:', error);
      throw new Error('Failed to load recent media');
    }
  };

  const { 
    data: mediaData, 
    loading, 
    error, 
    refresh 
  } = useBackgroundRefresh(fetchMedia, 300000); // 5 minute refresh interval

  // Get library names from library data
  const libraryNames = useMemo(() => {
    if (!mediaData?.response?.libraries?.sections) return {};
    return mediaData.response.libraries.sections.reduce((acc, section) => {
      acc[section.section_id] = section.section_name;
      return acc;
    }, {});
  }, [mediaData]);

  return (
    <div className="section-spacing">
      <div className="dark-panel">
        <div className="p-4 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setType(null)}
              className={!type ? 'btn-primary' : 'btn-secondary'}
            >
              All
            </button>
            <button
              onClick={() => setType('movies')}
              className={type === 'movies' ? 'btn-primary' : 'btn-secondary'}
            >
              Movies
            </button>
            <button
              onClick={() => setType('shows')}
              className={type === 'shows' ? 'btn-primary' : 'btn-secondary'}
            >
              TV Shows
            </button>
          </div>
          <button
            onClick={refresh}
            className="btn-primary"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="dark-panel">
        <div className="data-table">
          <div className="grid grid-cols-5 table-header">
            <div className="col-span-3 subheader-text">Title</div>
            <div className="col-span-2 text-right subheader-text">Added</div>
          </div>

          {/* Content */}
          {loading && !mediaData ? (
            <div className="p-8 flex justify-center items-center">
              <div className="loading-spinner" />
            </div>
          ) : error ? (
            <div className="text-center text-red-400 py-8">{error}</div>
          ) : !mediaData?.response?.data?.length ? (
            <div className="text-center text-gray-400 py-8">
              No recent media found
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {mediaData.response.data.map((item, index) => (
                <MediaItem 
                  key={`${item.section_id}-${index}`}
                  item={item}
                  libraryName={libraryNames[item.section_id] || `Section ${item.section_id}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentMediaView;