import React, { useState, useRef, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { useBackgroundRefresh } from '../../hooks/useBackgroundRefresh';

const RESULTS_PER_SECTION = 15;

const RecentMediaView = () => {
  const [libraryNames, setLibraryNames] = useState({});
  const [config, setConfig] = useState(null);
  const prevDataRef = useRef(null);

  const fetchMedia = async () => {
    try {
      // Fetch libraries first to get section names
      const librariesResponse = await fetch('/api/libraries');
      const librariesData = await librariesResponse.json();
      const names = {};
      if (librariesData?.response?.data) {
        librariesData.response.data.forEach(library => {
          names[library.section_id] = library.section_name;
        });
        setLibraryNames(names);
      }

      // Fetch configuration to get enabled sections
      const configRes = await fetch('/api/config');
      const configData = await configRes.json();
      setConfig(configData);

      if (!configData?.sections) {
        return prevDataRef.current || { movies: [], shows: [] };
      }

      // Fetch data for each section
      const results = await Promise.all(
        Object.entries(config.sections).flatMap(([type, sectionIds]) =>
          (sectionIds || []).map(async sectionId => {
            try {
              const response = await fetch(`/api/recent/${type}/${sectionId}?count=${RESULTS_PER_SECTION}`);
              const data = await response.json();
              return {
                type,
                sectionId,
                data: data?.response?.data || []
              };
            } catch (error) {
              console.error(`Error fetching section ${sectionId}:`, error);
              return { type, sectionId, data: [] };
            }
          })
        )
      );

      // Group results by type and filter out empty sections
      const newData = results.reduce((acc, result) => {
        if (result?.data?.length > 0) {
          if (!acc[result.type]) acc[result.type] = [];
          acc[result.type].push({
            sectionId: result.sectionId,
            items: result.data.map(item => ({
              ...item,
              sectionName: names[result.sectionId]
            }))
          });
        }
        return acc;
      }, { movies: [], shows: [] });

      prevDataRef.current = newData;
      return newData;
    } catch (error) {
      console.error('Error fetching media:', error);
      return prevDataRef.current || { movies: [], shows: [] };
    }
  };

  const { 
    data: fullData, 
    loading, 
    error, 
    lastUpdated, 
    refresh 
  } = useBackgroundRefresh(fetchMedia, 300000); // 5 minute refresh interval

  const MediaSection = React.memo(({ title, items = [], type }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <div className="p-4 bg-gray-700">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      {!items || items.length === 0 ? (
        <div className="p-4 text-gray-400">No recent {type} found</div>
      ) : (
        <div>
          {items.map((section) => {
            if (!section?.items?.length) return null;
            
            return (
              <div key={section.sectionId}>
                <div className="px-6 py-4 bg-gray-900 border-y border-gray-600">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                      {libraryNames[section.sectionId] || `Section ${section.sectionId}`}
                    </h3>
                    <span className="px-2.5 py-1 text-xs rounded-full bg-gray-800 text-gray-300 border border-gray-700">
                      {section.items.length} items
                    </span>
                  </div>
                </div>
                <table className="w-full">
                  <tbody>
                    {section.items.map((item, index) => (
                      <tr 
                        key={`${section.sectionId}-${index}`}
                        className="border-b border-gray-700 hover:bg-gray-700"
                      >
                        <td className="p-4">
                          <div className="flex gap-4">
                            {item.rating_key && (
                              <div className="flex-shrink-0">
                                <img 
                                  src={`${config?.baseUrl}/pms_image_proxy?img=/library/metadata/${item.rating_key}/thumb/${item.thumb || ''}`}
                                  alt=""
                                  className="w-16 h-24 object-cover rounded-md bg-gray-800"
                                  onError={(e) => {
                                    e.target.src = "/api/placeholder/64/96";
                                    e.target.classList.add("opacity-50");
                                  }}
                                />
                              </div>
                            )}
                            <div className="flex-grow">
                              <div className="text-gray-200">
                                {item.field || item.title || 'Untitled'}
                              </div>
                              {(item.additionalfield || item.details) && (
                                <div className="text-gray-400 text-sm mt-1">
                                  {item.additionalfield || item.details}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  ));

  const ContentGrid = useMemo(() => {
    if (!fullData) return null;

    const moviesData = fullData.movies || [];
    const showsData = fullData.shows || [];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-12rem)] pr-2">
          <h2 className="text-xl font-semibold text-white sticky top-0 bg-gray-900 pb-4 z-10">
            Recent Movies
          </h2>
          {moviesData.map((section) => (
            <MediaSection
              key={`movie-${section.sectionId}`}
              title={libraryNames[section.sectionId] || 'Movies'}
              items={[section]}
              type="movies"
            />
          ))}
        </div>

        <div className="space-y-6 overflow-y-auto max-h-[calc(100vh-12rem)] pr-2">
          <h2 className="text-xl font-semibold text-white sticky top-0 bg-gray-900 pb-4 z-10">
            Recent Shows
          </h2>
          {showsData.map((section) => (
            <MediaSection
              key={`show-${section.sectionId}`}
              title={libraryNames[section.sectionId] || 'Shows'}
              items={[section]}
              type="shows"
            />
          ))}
        </div>
      </div>
    );
  }, [fullData, libraryNames]);

  return (
    <div className="p-4 pb-16 space-y-4">
      <div className="flex justify-between items-center sticky top-0 z-20 bg-gray-900 pb-4">
        <div className="flex gap-4">
          <button
            onClick={refresh}
            disabled={loading}
            className={`flex items-center gap-2 px-3 py-2 rounded text-white ${
              loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-center text-red-400 py-8">{error}</div>
      ) : (
        ContentGrid
      )}
    </div>
  );
};

export default RecentMediaView;