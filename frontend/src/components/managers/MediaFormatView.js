import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

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

      // Initialize formats with default fields structure
      const initialFormats = {};
      ['shows', 'movies'].forEach(type => {
        initialFormats[type] = {};
        (data.sections?.[type] || []).forEach(sectionId => {
          const existingFields = data.formats?.[type]?.[sectionId]?.fields || [];
          const existingField = existingFields.find(f => f.id === 'field');
          const existingAdditionalField = existingFields.find(f => f.id === 'additionalfield');

          initialFormats[type][sectionId] = {
            fields: [
              {
                id: 'field',
                template: existingField?.template || ''
              }
            ]
          };

          if (existingAdditionalField) {
            initialFormats[type][sectionId].fields.push({
              id: 'additionalfield',
              template: existingAdditionalField.template
            });
          }
        });
      });

      setSectionTypes(types);
      setFormats(initialFormats);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
      onError('Failed to load media settings');
      setLoading(false);
    }
  };

  const toggleAdditionalField = (type, sectionId) => {
    setFormats(prev => {
      const newFormats = { ...prev };
      const fields = newFormats[type][sectionId].fields;
      
      if (fields.some(f => f.id === 'additionalfield')) {
        // Remove additionalfield
        newFormats[type][sectionId].fields = fields.filter(f => f.id === 'field');
      } else {
        // Add additionalfield
        newFormats[type][sectionId].fields.push({
          id: 'additionalfield',
          template: ''
        });
      }
      
      return newFormats;
    });
  };

  const updateField = (type, sectionId, fieldId, template) => {
    setFormats(prev => {
      const newFormats = { ...prev };
      const fields = newFormats[type][sectionId].fields;
      const fieldIndex = fields.findIndex(f => f.id === fieldId);
      if (fieldIndex !== -1) {
        fields[fieldIndex] = { ...fields[fieldIndex], template };
      }
      return newFormats;
    });
  };

  const textareaRefs = React.useRef({});

  const insertVariable = (code) => {
    if (!selectedSection) return;
    const [type, sectionId] = selectedSection.split('-');
    
    const fields = formats[type]?.[sectionId]?.fields;
    if (!fields || selectedFieldIndex === null) return;

    const field = fields[selectedFieldIndex];
    const textarea = textareaRefs.current[`${type}-${sectionId}-${field.id}`];
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const template = field.template;
    const newTemplate = template.slice(0, start) + code + template.slice(end);
    
    updateField(type, sectionId, field.id, newTemplate);

    setTimeout(() => {
      textarea.focus();
      const newPosition = start + code.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/media/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sections: sectionTypes.reduce((acc, { type, sections }) => {
            acc[type] = sections.map(s => parseInt(s.id));
            return acc;
          }, {}),
          formats
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
      <Alert className="bg-blue-900/50 border-blue-800">
        <AlertDescription className="flex items-center gap-2 text-blue-100">
          <AlertCircle className="h-4 w-4" />
          Configure how media information is displayed. Each section requires a primary field and can have an optional additional field.
        </AlertDescription>
      </Alert>

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
                    onClick={() => toggleAdditionalField(type, section.id)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      formats[type]?.[section.id]?.fields?.some(f => f.id === 'additionalfield')
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {formats[type]?.[section.id]?.fields?.some(f => f.id === 'additionalfield')
                      ? 'Remove Additional Field'
                      : 'Add Additional Field'
                    }
                  </button>
                </div>

                {formats[type]?.[section.id]?.fields.map((field, index) => (
                  <div key={field.id} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-medium text-white capitalize">
                        {field.id === 'field' ? 'Primary Field' : 'Additional Field'}
                      </h5>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm text-gray-300">Display Format</label>
                      <textarea
                        value={field.template}
                        onChange={(e) => updateField(type, section.id, field.id, e.target.value)}
                        onFocus={() => {
                          setSelectedSection(`${type}-${section.id}`);
                          setSelectedFieldIndex(index);
                        }}
                        ref={(el) => textareaRefs.current[`${type}-${section.id}-${field.id}`] = el}
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
                ))}
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