import React, { useState, useEffect } from 'react';

const MediaFormatView = ({ onError, onSuccess }) => {
  const [sectionTypes, setSectionTypes] = useState([
    { type: 'shows', sections: [] },
    { type: 'movies', sections: [] }
  ]);
  const [formats, setFormats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  const variables = {
    shows: [
      { code: '${grandparent_title}', description: 'Show name' },
      { code: '${parent_media_index}', description: 'Season number' },
      { code: '${media_index}', description: 'Episode number' },
      { code: '${title}', description: 'Episode title' },
      { code: '${duration}', description: 'Runtime' },
      { code: '${content_rating}', description: 'Content rating' },
      { code: '${video_resolution}', description: 'Video quality' }
    ],
    movies: [
      { code: '${title}', description: 'Movie title' },
      { code: '${year}', description: 'Release year' },
      { code: '${duration}', description: 'Runtime' },
      { code: '${content_rating}', description: 'Content rating' },
      { code: '${video_resolution}', description: 'Video quality' }
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

      setSectionTypes(types);
      setFormats(data.formats || {});
      setLoading(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
      onError('Failed to load media settings');
      setLoading(false);
    }
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

  const textareaRefs = React.useRef({});

  const handleInputChange = (type, sectionId, e) => {
    handleFormatChange(type, sectionId, 'title', e.target.value);
  };

  const insertVariable = (code) => {
    if (!selectedSection) return;
    const [type, sectionId] = selectedSection.split('-');
    
    const textarea = textareaRefs.current[`${type}-${sectionId}`];
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const currentFormat = formats[type]?.[sectionId]?.title || '';
    const newFormat = currentFormat.slice(0, start) + code + currentFormat.slice(end);
    
    handleFormatChange(type, sectionId, 'title', newFormat);

    // Set cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + code.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleSave = async () => {
    try {
      const sections = sectionTypes.reduce((acc, { type, sections }) => {
        acc[type] = sections.map(s => parseInt(s.id)).filter(id => !isNaN(id));
        return acc;
      }, {});

      const response = await fetch('/api/media/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sections,
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
                <h4 className="font-medium text-white">
                  Section {section.id}
                </h4>

                <div className="space-y-2">
                  <label className="block text-sm text-gray-300">Title Format</label>
                  <textarea
                    value={formats[type]?.[section.id]?.title || ''}
                    onChange={(e) => handleInputChange(type, section.id, e)}
                    onFocus={() => setSelectedSection(`${type}-${section.id}`)}
                    ref={(el) => textareaRefs.current[`${type}-${section.id}`] = el}
                    className="w-full p-2 bg-gray-800 border border-gray-600 rounded min-h-[60px]"
                    placeholder={`Default format for ${type}`}
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
                        disabled={selectedSection !== `${type}-${section.id}`}
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