import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const MediaFormatView = ({ onError, onSuccess }) => {
  const [sectionTypes, setSectionTypes] = useState([
    { type: 'shows', sections: [] },
    { type: 'movies', sections: [] }
  ]);
  const [formats, setFormats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);

  const variables = {
    shows: [
      { code: '${grandparent_title}', description: 'Show name' },
      { code: '${parent_media_index}', description: 'Season number' },
      { code: '${media_index}', description: 'Episode number' },
      { code: '${title}', description: 'Episode title' },
      { code: '${duration}', description: 'Runtime' },
      { code: '${content_rating}', description: 'Content rating' },
      { code: '${video_resolution}', description: 'Video quality' },
      { code: '${added_at_relative}', description: 'Relative time (e.g. "2d ago")' },
      { code: '${added_at_short}', description: 'Short date (e.g. "Feb 10")' }
    ],
    movies: [
      { code: '${title}', description: 'Movie title' },
      { code: '${year}', description: 'Release year' },
      { code: '${duration}', description: 'Runtime' },
      { code: '${content_rating}', description: 'Content rating' },
      { code: '${video_resolution}', description: 'Video quality' },
      { code: '${added_at_relative}', description: 'Relative time (e.g. "2d ago")' },
      { code: '${added_at_short}', description: 'Short date (e.g. "Feb 10")' }
    ]
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/media/settings');
      const data = await response.json();
      
      const types = [
        { 
          type: 'shows', 
          sections: (data.sections?.shows || []).map(id => ({ id: id.toString() }))
        },
        {
          type: 'movies',
          sections: (data.sections?.movies || []).map(id => ({ id: id.toString() }))
        }
      ];

      // Ensure each section has a fields array
      const cleanedFormats = {};
      Object.entries(data.formats || {}).forEach(([type, sectionFormats]) => {
        cleanedFormats[type] = {};
        Object.entries(sectionFormats).forEach(([sectionId, format]) => {
          cleanedFormats[type][sectionId] = {
            fields: format.fields || []
          };
        });
      });

      setSectionTypes(types);
      setFormats(cleanedFormats);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
      onError('Failed to load media settings');
      setLoading(false);
    }
  };

  const addField = (type, sectionId) => {
    setFormats(prev => {
      const newFormats = { ...prev };
      if (!newFormats[type]) newFormats[type] = {};
      if (!newFormats[type][sectionId]) {
        newFormats[type][sectionId] = {
          fields: []
        };
      }
      if (!newFormats[type][sectionId].fields) {
        newFormats[type][sectionId].fields = [];
      }
      
      newFormats[type][sectionId].fields.push({
        id: '',
        template: ''
      });
      
      return newFormats;
    });
  };

  const removeField = (type, sectionId, index) => {
    setFormats(prev => {
      const newFormats = { ...prev };
      newFormats[type][sectionId].fields.splice(index, 1);
      return newFormats;
    });
    setSelectedFieldIndex(null);
  };

  const updateField = (type, sectionId, index, key, value) => {
    setFormats(prev => {
      const newFormats = { ...prev };
      if (!newFormats[type][sectionId].fields) newFormats[type][sectionId].fields = [];
      newFormats[type][sectionId].fields[index] = {
        ...newFormats[type][sectionId].fields[index],
        [key]: value
      };
      return newFormats;
    });
  };

  const textareaRefs = React.useRef({});

  const handleTemplateChange = (type, sectionId, index, e) => {
    updateField(type, sectionId, index, 'template', e.target.value);
  };

  const insertVariable = (code) => {
    if (!selectedSection || selectedFieldIndex === null) return;
    const [type, sectionId] = selectedSection.split('-');
    
    const textarea = textareaRefs.current[`${type}-${sectionId}-${selectedFieldIndex}`];
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const field = formats[type]?.[sectionId]?.fields?.[selectedFieldIndex];
    const template = field?.template || '';
    const newTemplate = template.slice(0, start) + code + template.slice(end);
    
    updateField(type, sectionId, selectedFieldIndex, 'template', newTemplate);

    setTimeout(() => {
      textarea.focus();
      const newPosition = start + code.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleSave = async () => {
    try {
      // Get all configured sections
      const sections = sectionTypes.reduce((acc, { type, sections }) => {
        acc[type] = sections.map(s => parseInt(s.id)).filter(id => !isNaN(id));
        return acc;
      }, {});

      // Ensure each section has a fields array
      const cleanedFormats = {};
      Object.entries(formats).forEach(([type, sectionFormats]) => {
        cleanedFormats[type] = {};
        Object.entries(sectionFormats).forEach(([sectionId, format]) => {
          cleanedFormats[type][sectionId] = {
            fields: format.fields || []
          };
        });
      });

      const response = await fetch('/api/media/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sections,
          formats: cleanedFormats
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      onSuccess();
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
      {sectionTypes.map(({ type, sections }) => (
        <div key={type} className="space-y-6">
          <h3 className="text-lg font-semibold text-white capitalize">
            {type} Format Settings
          </h3>

          {sections.length === 0 ? (
            <div className="p-4 text-center text-gray-400 border border-gray-700 rounded-lg">
              No {type} sections configured. Add sections in the Section Manager tab.
            </div>
          ) : (
            sections.map(section => (
              <div key={section.id} className="p-4 bg-gray-700 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-white">
                    Section {section.id}
                  </h4>
                  <button
                    onClick={() => addField(type, section.id)}
                    className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Field
                  </button>
                </div>

                {!formats[type]?.[section.id]?.fields?.length ? (
                  <div className="p-4 text-center text-gray-400 border border-gray-700 rounded-lg">
                    No display fields configured. Click "Add Field" to begin.
                  </div>
                ) : (
                  formats[type][section.id].fields.map((field, index) => (
                    <div key={index} className="space-y-4">
                      <div className="flex items-center gap-4">
                        <input
                          type="text"
                          value={field.id}
                          onChange={(e) => updateField(type, section.id, index, 'id', e.target.value)}
                          className="flex-1 p-2 bg-gray-800 border border-gray-600 rounded"
                          placeholder="Field Name"
                        />
                        <button
                          onClick={() => removeField(type, section.id, index)}
                          className="p-2 text-red-400 hover:text-red-300"
                          title="Remove Field"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm text-gray-300">Display Format</label>
                        <textarea
                          value={field.template}
                          onChange={(e) => handleTemplateChange(type, section.id, index, e)}
                          onFocus={() => {
                            setSelectedSection(`${type}-${section.id}`);
                            setSelectedFieldIndex(index);
                          }}
                          ref={(el) => textareaRefs.current[`${type}-${section.id}-${index}`] = el}
                          className="w-full p-2 bg-gray-800 border border-gray-600 rounded min-h-[60px]"
                          placeholder="Enter display format template"
                        />
                      </div>

                      <div className="mt-4 p-3 bg-gray-800 rounded">
                        <p className="text-sm font-medium text-gray-300 mb-2">Available Variables (click to add):</p>
                        <div className="grid grid-cols-2 gap-2">
                          {variables[type].map(({ code, description }) => (
                            <button
                              key={code}
                              onClick={() => insertVariable(code)}
                              className="text-left text-sm p-1 hover:bg-gray-700 rounded transition-colors"
                              disabled={selectedSection !== `${type}-${section.id}` || selectedFieldIndex !== index}
                            >
                              <code className="text-blue-300">{code}</code>
                              <span className="text-gray-400 ml-2">- {description}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))
          )}
        </div>
      ))}

      <button
        onClick={handleSave}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save Changes
      </button>
    </div>
  );
};

export default MediaFormatView;