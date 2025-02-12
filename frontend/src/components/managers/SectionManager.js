import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

const SectionManager = ({ onError, onSuccess }) => {
  const [sections, setSections] = useState({
    shows: [],
    movies: []
  });
  const [availableSections, setAvailableSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingsResponse, sectionsResponse] = await Promise.all([
        fetch('/api/media/settings'),
        fetch('/api/libraries/sections')
      ]);

      if (!settingsResponse.ok || !sectionsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const settingsData = await settingsResponse.json();
      const sectionsData = await sectionsResponse.json();

      setSections(settingsData.sections || { shows: [], movies: [] });
      setAvailableSections(sectionsData.response.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      onError('Failed to load section settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (!refreshing) {
      setRefreshing(true);
      await fetchData();
    }
  };

  const addSection = (type, sectionId) => {
    setSections(prev => ({
      ...prev,
      [type]: [...new Set([...prev[type], sectionId])]
    }));
  };

  const removeSection = (type, sectionId) => {
    setSections(prev => ({
      ...prev,
      [type]: prev[type].filter(id => id !== sectionId)
    }));
  };

  const handleSave = async () => {
    try {
      const currentSettings = await fetch('/api/media/settings');
      const { formats: existingFormats } = await currentSettings.json();

      const response = await fetch('/api/media/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sections,
          formats: existingFormats || {}
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      onSuccess();
      window.dispatchEvent(new Event('settingsUpdated'));
      await fetchData();
    } catch (error) {
      console.error('Save error:', error);
      onError('Failed to save section settings');
    }
  };

  const SectionColumn = ({ type }) => {
    const availableForType = availableSections.filter(section => section.type === type);
    const selectedIds = sections[type];

    return (
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white capitalize">
            {type}
          </h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`flex items-center gap-2 px-2 py-1 rounded text-gray-300 hover:text-white ${
              refreshing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title="Refresh Sections"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-3">
          {availableForType.length === 0 ? (
            <div className="p-4 text-center text-gray-400 border border-gray-700 rounded-lg">
              No {type} libraries found in Tautulli
            </div>
          ) : (
            availableForType.map(section => (
              <div key={section.id} className="flex items-center gap-2">
                <label className="flex-1 flex items-center gap-3 px-3 py-2 bg-gray-800 border border-gray-700 rounded hover:bg-gray-750 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(section.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        addSection(type, section.id);
                      } else {
                        removeSection(type, section.id);
                      }
                    }}
                    className="rounded border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-300 flex-1">{section.name}</span>
                  <span className="text-sm text-gray-500">ID: {section.id}</span>
                </label>
              </div>
            ))
          )}
        </div>

        {availableForType.length > 0 && (
          <div className="mt-3 text-sm text-gray-400">
            {selectedIds.length} of {availableForType.length} libraries selected
          </div>
        )}
      </div>
    );
  };

  if (loading && !refreshing) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-900/50 border-blue-800 text-blue-100">
        <AlertDescription>
          Select which Tautulli libraries to include in your dashboard. Changes will take effect after saving.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-8">
        <SectionColumn type="shows" />
        <SectionColumn type="movies" />
      </div>

      <button
        onClick={handleSave}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900"
      >
        Save Changes
      </button>
    </div>
  );
};

export default SectionManager;