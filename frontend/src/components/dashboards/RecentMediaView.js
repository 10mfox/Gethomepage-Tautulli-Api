import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const RecentMediaView = () => {
  const [sections, setSections] = useState({
    movies: [],
    shows: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMedia = async () => {
    try {
      setIsRefreshing(true);
      const configRes = await fetch('/api/config');
      const config = await configRes.json();
      
      const mediaTypes = ['movies', 'shows'];
      const sectionPromises = [];

      mediaTypes.forEach(type => {
        const sectionIds = config.sections[type] || [];
        sectionIds.forEach(sectionId => {
          sectionPromises.push(
            fetch(`/api/recent/${type}/${sectionId}?count=5`)
              .then(res => res.json())
              .then(data => ({
                type,
                sectionId,
                data: data.response?.data || []
              }))
          );
        });
      });

      const results = await Promise.all(sectionPromises);
      
      const organizedSections = {
        movies: [],
        shows: []
      };

      results.forEach(result => {
        if (result.data.length > 0) {
          organizedSections[result.type].push({
            sectionId: result.sectionId,
            items: result.data
          });
        }
      });

      setSections(organizedSections);
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
      await fetchMedia();
    }
  };

  const formatMediaName = (item) => {
    if (!item) return '';
    return item.title || '';
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
              <div className="px-4 py-2 bg-gray-750">
                <h3 className="text-sm font-medium text-gray-300">Section {section.sectionId}</h3>
              </div>
              <div className="divide-y divide-gray-700">
                {section.items.map((item, index) => (
                  <div key={`${item.media_type}-${section.sectionId}-${index}`} className="p-4 hover:bg-gray-700">
                    <div className="text-gray-200">{formatMediaName(item)}</div>
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
      <div className="flex justify-end">
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
        <div className="text-center text-gray-400 py-8">Loading media...</div>
      ) : error ? (
        <div className="text-center text-red-400 py-8">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MediaSection 
            title="Recent Movies" 
            items={sections.movies} 
            type="movies" 
          />
          <MediaSection 
            title="Recent Shows" 
            items={sections.shows} 
            type="shows" 
          />
        </div>
      )}
    </div>
  );
};

export default RecentMediaView;