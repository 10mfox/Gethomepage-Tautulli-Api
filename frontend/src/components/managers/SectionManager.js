import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const SectionManager = ({ onError, onSuccess }) => {
  const [sections, setSections] = useState({
    shows: [],
    movies: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/media/settings');
      const data = await response.json();
      setSections(data.sections || { shows: [], movies: [] });
      setLoading(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
      onError('Failed to load section settings');
      setLoading(false);
    }
  };

  const addSection = (type) => {
    setSections(prev => ({
      ...prev,
      [type]: [...prev[type], '']
    }));
  };

  const removeSection = (type, index) => {
    setSections(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const updateSection = (type, index, value) => {
    setSections(prev => ({
      ...prev,
      [type]: prev[type].map((id, i) => i === index ? value : id)
    }));
  };

  const handleSave = async () => {
    try {
      // First get the current settings to preserve formats
      const currentSettings = await fetch('/api/media/settings');
      const { formats: existingFormats } = await currentSettings.json();

      const cleanedSections = {
        shows: sections.shows.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0),
        movies: sections.movies.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0)
      };

      const response = await fetch('/api/media/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sections: cleanedSections,
          formats: existingFormats || {} // Preserve existing formats
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      onSuccess();
      await fetchSettings();
    } catch (error) {
      console.error('Save error:', error);
      onError('Failed to save section settings');
    }
  };

  if (loading) {
    return <div className="text-center text-gray-400">Loading sections...</div>;
  }

  const SectionColumn = ({ type, sections }) => (
    <div className="flex-1">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white capitalize">
          {type}
        </h3>
        <button
          onClick={() => addSection(type)}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Section
        </button>
      </div>

      <div className="space-y-3">
        {sections.length === 0 ? (
          <div className="p-4 text-center text-gray-400 border border-gray-700 rounded-lg">
            No sections configured
          </div>
        ) : (
          sections.map((sectionId, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="number"
                value={sectionId}
                onChange={(e) => updateSection(type, index, e.target.value)}
                placeholder="Section ID"
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => removeSection(type, index)}
                className="p-2 text-red-400 hover:text-red-300 rounded"
                title="Remove Section"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-8">
        <SectionColumn type="shows" sections={sections.shows} />
        <SectionColumn type="movies" sections={sections.movies} />
      </div>

      <button
        onClick={handleSave}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save Changes
      </button>
    </div>
  );
};

export default SectionManager;