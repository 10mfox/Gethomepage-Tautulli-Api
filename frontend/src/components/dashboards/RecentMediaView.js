// frontend/src/components/dashboards/RecentMediaView.js
import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const DATE_FORMAT_KEY = 'tautulli-date-format-preference';
const RESULTS_PER_SECTION = 15;

const RecentMediaView = () => {
  const [fullData, setFullData] = useState({
    movies: [],
    shows: []
  });
  const [libraryNames, setLibraryNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateFormat, setDateFormat] = useState(() => {
    return localStorage.getItem(DATE_FORMAT_KEY) || 'relative';
  });

  useEffect(() => {
    localStorage.setItem(DATE_FORMAT_KEY, dateFormat);
  }, [dateFormat]);

  const fetchLibraryNames = async () => {
    try {
      const response = await fetch('/api/libraries');
      const data = await response.json();
      const names = {};
      data.response.data.forEach(library => {
        names[library.section_id] = library.section_name;
      });
      setLibraryNames(names);
    } catch (error) {
      console.error('Error fetching library names:', error);
    }
  };

  const fetchMedia = async (force = false) => {
    try {
      setIsRefreshing(true);
      await fetchLibraryNames();
      
      const configRes = await fetch('/api/config');
      const config = await configRes.json();
      
      if (force) {
        await fetch('/api/cache/clear', { method: 'POST' });
      }

      const results = await Promise.all(
        Object.entries(config.sections).flatMap(([type, sectionIds]) =>
          sectionIds.map(sectionId => 
            fetch(`/api/recent/${type}/${sectionId}?count=${RESULTS_PER_SECTION}${force ? `&_=${Date.now()}` : ''}`)
              .then(res => res.json())
              .then(data => ({
                type,
                sectionId,
                data: data.response?.data || []
              }))
          )
        )
      );

      const organized = results.reduce((acc, result) => {
        if (result.data.length > 0) {
          if (!acc[result.type]) acc[result.type] = [];
          acc[result.type].push({
            sectionId: result.sectionId,
            items: result.data
          });
        }
        return acc;
      }, {});

      setFullData(organized);
      setError(null);
    } catch (error) {
      console.error('Error fetching media:', error);
      setError('Failed to load media data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleRefresh = async () => {
    if (!isRefreshing) {
      await fetchMedia(true);
    }
  };

  const MediaSection = ({ title, items, type }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <div className="p-4 bg-gray-700">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      {items.length === 0 ? (
        <div className="p-4 text-gray-400">No recent {type} found</div>
      ) : (
        <div className="divide-y divide-gray-700">
          {items.map((section) => (
            <div key={section.sectionId}>
              <div className="px-6 py-4 bg-gray-900 border-y border-gray-600">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    {libraryNames[section.sectionId]}
                  </h3>
                  <span className="px-2.5 py-1 text-xs rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                    {section.items.length} items
                  </span>
                </div>
              </div>
              <div className="divide-y divide-gray-700">
                {section.items.map((item, index) => (
                  <div key={`${item.media_type}-${section.sectionId}-${index}`} 
                       className="p-4 hover:bg-gray-700/50 transition-colors">
                    <div className="text-gray-200">{item.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {item.content_rating && (
                        <span className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-300 rounded">
                          {item.content_rating}
                        </span>
                      )}
                      {item.video_resolution && (
                        <span className="px-1.5 py-0.5 text-xs bg-blue-900 text-blue-100 rounded">
                          {item.video_resolution}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {dateFormat === 'relative' ? item.added_at_relative : item.added_at_short}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <select
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
          >
            <option value="relative">Relative Time</option>
            <option value="short">Short Date</option>
          </select>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={`flex items-center gap-2 px-3 py-2 rounded text-white transition-colors ${
            isRefreshing ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && !isRefreshing ? (
        <div className="text-center py-8">
          <div className="loading-spinner mx-auto" />
        </div>
      ) : error ? (
        <div className="text-center text-red-400 py-8">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MediaSection 
            title="Recent Movies" 
            items={fullData.movies || []} 
            type="movies" 
          />
          <MediaSection 
            title="Recent Shows" 
            items={fullData.shows || []} 
            type="shows" 
          />
        </div>
      )}
    </div>
  );
};

export default RecentMediaView;