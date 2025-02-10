import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const MediaFormatView = ({ onError, onSuccess }) => {
  const [sectionTypes, setSectionTypes] = useState([
    { type: 'shows', sections: [] },
    { type: 'movies', sections: [] }
  ]);
  const [formats, setFormats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/media/settings');
      const data = await response.json();
      
      const types = Object.entries(data.sections || {}).map(([type, ids]) => ({
        type,
        sections: (Array.isArray(ids) ? ids : [ids])
          .filter(id => id)
          .map(id => ({ id: id.toString() }))
      }));

      if (!types.find(t => t.type === 'shows')) {
        types.push({ type: 'shows', sections: [] });
      }
      if (!types.find(t => t.type === 'movies')) {
        types.push({ type: 'movies', sections: [] });
      }

      setSectionTypes(types);
      setFormats(data.formats || {});
      setLoading(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
      onError('Failed to load media settings');
      setLoading(false);
    }
  };

  const addSection = (typeIndex) => {
    const newTypes = [...sectionTypes];
    newTypes[typeIndex].sections.push({ id: '' });
    setSectionTypes(newTypes);
  };

  const removeSection = (typeIndex, sectionIndex) => {
    const newTypes = [...sectionTypes];
    newTypes[typeIndex].sections = newTypes[typeIndex].sections.filter((_, i) => i !== sectionIndex);
    setSectionTypes(newTypes);
  };

  const updateSectionId = (typeIndex, sectionIndex, value) => {
    const newTypes = [...sectionTypes];
    newTypes[typeIndex].sections[sectionIndex].id = value;
    setSectionTypes(newTypes);
  };

  const handleFormatChange = (type, sectionId, field, value) => {
    setFormats(prev => {
      const newFormats = { ...prev };
      if (!newFormats[type]) newFormats[type] = {};
      if (!newFormats[type][sectionId]) newFormats[type][sectionId] = {};
      
      newFormats[type][sectionId] = {
        ...newFormats[type][sectionId],
        [field]: value
      };
      
      return newFormats;
    });
  };

  const handleSave = async () => {
    try {
      const sections = sectionTypes.reduce((acc, { type, sections }) => {
        const validIds = sections
          .map(s => parseInt(s.id))
          .filter(id => !isNaN(id) && id > 0);
        
        if (validIds.length > 0) {
          acc[type] = validIds;
        }
        return acc;
      }, {});

      const response = await fetch('/api/media/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sections, 
          formats: formats
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      onSuccess();
      await fetchSettings();
    } catch (error) {
      console.error('Save error:', error);
      onError('Failed to save media settings');
    }
  };

  if (loading) {
    return <div className="text-center text-gray-400">Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      {sectionTypes.map((type, typeIndex) => (
        <div key={type.type} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white capitalize">
              {type.type} Sections
            </h3>
            <button
              onClick={() => addSection(typeIndex)}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Section
            </button>
          </div>

          {type.sections.length === 0 ? (
            <div className="p-4 text-center text-gray-400 border border-gray-700 rounded-lg">
              No sections configured. Click "Add Section" to begin.
            </div>
          ) : (
            type.sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="p-4 bg-gray-700 rounded-lg space-y-4">
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={section.id}
                    onChange={(e) => updateSectionId(typeIndex, sectionIndex, e.target.value)}
                    className="w-32 p-2 bg-gray-800 border border-gray-600 rounded"
                    placeholder="Section ID"
                  />
                  <button
                    onClick={() => removeSection(typeIndex, sectionIndex)}
                    className="p-2 text-red-400 hover:text-red-300"
                    title="Remove Section"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {section.id && (
                  <>
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-300">Title Format</label>
                      <input
                        value={formats[type.type]?.[section.id]?.title || ''}
                        onChange={(e) => handleFormatChange(type.type, section.id, 'title', e.target.value)}
                        className="w-full p-2 bg-gray-800 border border-gray-600 rounded"
                        placeholder={`Default format for ${type.type}`}
                      />
                    </div>

                    <div className="mt-4 p-3 bg-gray-800 rounded">
                      <p className="text-sm font-medium text-gray-300 mb-2">Available Variables:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {type.type === 'shows' ? (
                          <>
                            <div className="text-sm">
                              <code className="text-blue-300">${'{grandparent_title}'}</code>
                              <span className="text-gray-400 ml-2">- Show name</span>
                            </div>
                            <div className="text-sm">
                              <code className="text-blue-300">${'{parent_media_index}'}</code>
                              <span className="text-gray-400 ml-2">- Season number</span>
                            </div>
                            <div className="text-sm">
                              <code className="text-blue-300">${'{media_index}'}</code>
                              <span className="text-gray-400 ml-2">- Episode number</span>
                            </div>
                            <div className="text-sm">
                              <code className="text-blue-300">${'{title}'}</code>
                              <span className="text-gray-400 ml-2">- Episode title</span>
                            </div>
                            <div className="text-sm">
                              <code className="text-blue-300">${'{duration}'}</code>
                              <span className="text-gray-400 ml-2">- Runtime</span>
                            </div>
                            <div className="text-sm">
                              <code className="text-blue-300">${'{content_rating}'}</code>
                              <span className="text-gray-400 ml-2">- Content rating</span>
                            </div>
                            <div className="text-sm">
                              <code className="text-blue-300">${'{video_resolution}'}</code>
                              <span className="text-gray-400 ml-2">- Video quality</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm">
                              <code className="text-blue-300">${'{title}'}</code>
                              <span className="text-gray-400 ml-2">- Movie title</span>
                            </div>
                            <div className="text-sm">
                              <code className="text-blue-300">${'{year}'}</code>
                              <span className="text-gray-400 ml-2">- Release year</span>
                            </div>
                            <div className="text-sm">
                              <code className="text-blue-300">${'{duration}'}</code>
                              <span className="text-gray-400 ml-2">- Runtime</span>
                            </div>
                            <div className="text-sm">
                              <code className="text-blue-300">${'{content_rating}'}</code>
                              <span className="text-gray-400 ml-2">- Content rating</span>
                            </div>
                            <div className="text-sm">
                              <code className="text-blue-300">${'{video_resolution}'}</code>
                              <span className="text-gray-400 ml-2">- Video quality</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      ))}

      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save Changes
      </button>
    </div>
  );
};

export default MediaFormatView;