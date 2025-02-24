import React, { useState, useEffect } from 'react';

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
      { code: '${added_at_relative}', description: 'Relative time (2d ago)' },
      { code: '${added_at_short}', description: 'Short date (Feb 10)' }
    ],
    movies: [
      { code: '${title}', description: 'Movie title' },
      { code: '${year}', description: 'Release year' },
      { code: '${duration}', description: 'Runtime' },
      { code: '${content_rating}', description: 'Content rating' },
      { code: '${video_resolution}', description: 'Video quality' },
      { code: '${added_at_relative}', description: 'Relative time (2d ago)' },
      { code: '${added_at_short}', description: 'Short date (Feb 10)' }
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

      // Initialize formats
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
      onError('Failed to load media settings');
      setLoading(false);
    }
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

      if (!response.ok) throw new Error('Failed to save settings');
      onSuccess();
    } catch (error) {
      onError('Failed to save media settings');
    }
  };

  const toggleAdditionalField = (type, sectionId) => {
    setFormats(prev => {
      const newFormats = { ...prev };
      const fields = newFormats[type][sectionId].fields;
      
      if (fields.some(f => f.id === 'additionalfield')) {
        newFormats[type][sectionId].fields = fields.filter(f => f.id === 'field');
      } else {
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

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="section-spacing">
      {sectionTypes.map(({ type, sections }) => (
        <div key={type} className="dark-panel">
          <div className="table-header">
            <h3 className="header-text capitalize">
              {type} Format Settings
            </h3>
          </div>

          <div className="p-4 space-y-6">
            {sections.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                No {type} sections configured. Add sections in the Section Manager tab.
              </div>
            ) : (
              sections.map(section => (
                <div key={section.id} className="dark-panel">
                  <div className="p-4 border-b border-white/5 flex items-center justify-between">
                    <h4 className="subheader-text">
                      Section {section.id}
                    </h4>
                    <button
                      onClick={() => toggleAdditionalField(type, section.id)}
                      className={formats[type]?.[section.id]?.fields?.some(f => f.id === 'additionalfield')
                        ? 'btn-secondary'
                        : 'btn-primary'
                      }
                    >
                      {formats[type]?.[section.id]?.fields?.some(f => f.id === 'additionalfield')
                        ? 'Remove Additional Field'
                        : 'Add Additional Field'
                      }
                    </button>
                  </div>

                  <div className="p-4 space-y-6">
                    {formats[type]?.[section.id]?.fields.map((field, index) => (
                      <div key={field.id} className="space-y-4">
                        <h5 className="subheader-text capitalize">
                          {field.id === 'field' ? 'Primary Field' : 'Additional Field'}
                        </h5>

                        <div className="space-y-2">
                          <label className="form-label">Display Format</label>
                          <textarea
                            value={field.template}
                            onChange={(e) => updateField(type, section.id, field.id, e.target.value)}
                            onFocus={() => {
                              setSelectedSection(`${type}-${section.id}`);
                              setSelectedFieldIndex(index);
                            }}
                            ref={(el) => textareaRefs.current[`${type}-${section.id}-${field.id}`] = el}
                            className="input-field min-h-[60px]"
                            placeholder="Enter display format template"
                          />
                        </div>

                        <div className="bg-black/20 rounded-lg p-4">
                          <h6 className="subheader-text mb-3">Available Variables (click to add):</h6>
                          <div className="grid grid-cols-2 gap-2">
                            {variables[type].map(({ code, description }) => (
                              <button
                                key={code}
                                onClick={() => insertVariable(code)}
                                className="text-left text-sm p-2 hover:bg-white/5 rounded transition-colors flex items-center gap-2"
                                disabled={selectedSection !== `${type}-${section.id}` || selectedFieldIndex !== index}
                              >
                                <code className="text-theme-accent">{code}</code>
                                <span className="text-gray-400">- {description}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}

      <button onClick={handleSave} className="btn-primary w-full">
        Save Changes
      </button>
    </div>
  );
};

export default MediaFormatView;