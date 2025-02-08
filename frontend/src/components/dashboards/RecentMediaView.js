import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const RecentMediaView = () => {
  const [sections, setSections] = useState({
    movies: [],
    shows: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMedia = async () => {
    try {
      // First fetch config to get all configured sections
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
      
      // Organize results by media type
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
      setLoading(false);
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const MediaSection = ({ title, sections }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <div className="p-4 bg-gray-700 border-b border-gray-600">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      {sections.map(section => (
        <div key={section.sectionId} className="border-b border-gray-700 last:border-b-0">
          <div className="p-4 bg-gray-750">
            <h3 className="text-sm font-medium text-gray-300">Section {section.sectionId}</h3>
          </div>
          <div className="divide-y divide-gray-700">
            {section.items.map((item, index) => (
              <div key={index} className="p-4 hover:bg-gray-700">
                <div className="flex flex-col gap-1">
                  <h3 className="text-gray-200 font-medium">{item.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{item.added}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={fetchMedia}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Loading media...</div>
      ) : error ? (
        <div className="text-center text-red-400 py-8">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MediaSection title="Recent Movies" sections={sections.movies} />
          <MediaSection title="Recent Shows" sections={sections.shows} />
        </div>
      )}
    </div>
  );
};

export default RecentMediaView;