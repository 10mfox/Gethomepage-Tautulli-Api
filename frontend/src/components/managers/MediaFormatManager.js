/**
 * Media Format Manager component
 * Handles configuration of media display formats
 * @module components/managers/MediaFormatManager
 */
import React from 'react';
import { Film, Tv, Music } from 'lucide-react';
import { variables } from '../../utils/utils';

/**
 * Media format configuration component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.sectionTypes - Section types with their configured sections
 * @param {Object} props.mediaFormats - Media format configurations by type and section
 * @param {Function} props.setMediaFormats - Function to update media formats
 * @param {string|null} props.selectedSection - Currently selected section
 * @param {Function} props.setSelectedSection - Function to update selected section
 * @param {number|null} props.selectedFieldIndex - Currently selected field index
 * @param {Function} props.setSelectedFieldIndex - Function to update selected field index
 * @param {Object} props.textareaRefs - Refs for textarea elements
 * @param {Function} props.insertVariable - Function to insert variable at cursor position
 * @returns {JSX.Element} Rendered component
 */
const MediaFormatManager = ({
  sectionTypes,
  mediaFormats,
  setMediaFormats,
  selectedSection,
  setSelectedSection,
  selectedFieldIndex, 
  setSelectedFieldIndex,
  textareaRefs,
  insertVariable
}) => {
  /**
   * Toggle additional field for media formats
   * 
   * @param {string} type - Media type (shows, movies, music)
   * @param {string} sectionId - Section ID
   */
  const toggleMediaAdditionalField = (type, sectionId) => {
    setMediaFormats(prev => {
      const newFormats = { ...prev };
      // Ensure the type and section exist
      if (!newFormats[type]) newFormats[type] = {};
      if (!newFormats[type][sectionId]) newFormats[type][sectionId] = { fields: [] };
      
      const fields = newFormats[type][sectionId].fields;
      
      if (fields.some(f => f.id === 'additionalfield')) {
        newFormats[type][sectionId].fields = fields.filter(f => f.id !== 'additionalfield');
      } else {
        newFormats[type][sectionId].fields.push({
          id: 'additionalfield',
          template: ''
        });
      }
      
      return newFormats;
    });
  };

  /**
   * Update media format field
   * 
   * @param {string} type - Media type (shows, movies, music)
   * @param {string} sectionId - Section ID
   * @param {string} fieldId - Field ID
   * @param {string} template - New template value
   */
  const updateMediaField = (type, sectionId, fieldId, template) => {
    setMediaFormats(prev => {
      const newFormats = { ...prev };
      if (!newFormats[type]) newFormats[type] = {};
      if (!newFormats[type][sectionId]) newFormats[type][sectionId] = { fields: [] };
      
      const fields = newFormats[type][sectionId].fields;
      const fieldIndex = fields.findIndex(f => f.id === fieldId);
      if (fieldIndex !== -1) {
        fields[fieldIndex] = { ...fields[fieldIndex], template };
      } else if (fieldId === 'field') {
        // If primary field doesn't exist, add it
        fields.unshift({ id: 'field', template });
      }
      return newFormats;
    });
  };

  /**
   * Renders the template variable selection panel
   * 
   * @returns {JSX.Element} Variable selection panel
   */
  const renderVariablePanel = () => {
    if (!selectedSection) return null;
    
    const [type] = selectedSection.split('-');
    const variablesToUse = variables[type] || [];
    
    return (
      <div className="dark-panel">
        <div className="table-header">
          <h3 className="header-text">Available Variables</h3>
        </div>
        <div className="p-4 bg-black/20 rounded-lg">
          <div className="description-text mb-3">
            Click on a variable to insert it at the cursor position:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {variablesToUse.map(({ code, description }) => (
              <button
                key={code}
                onClick={() => insertVariable(code)}
                disabled={selectedFieldIndex === null}
                className="text-left text-sm p-2 hover:bg-white/5 rounded transition-colors flex items-center gap-2"
              >
                <code className="text-theme-accent">{code}</code>
                <span className="text-gray-400">- {description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const allSections = [
    ...sectionTypes.movies.map(section => ({ type: 'movies', section })),
    ...sectionTypes.shows.map(section => ({ type: 'shows', section })),
    ...sectionTypes.music.map(section => ({ type: 'music', section }))
  ];
  
  if (allSections.length === 0) {
    return (
      <div className="dark-panel p-8 text-center text-gray-400">
        No library sections configured. Please add sections in the Section Manager.
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="dark-panel">
        <div className="table-header">
          <h3 className="header-text">Media Section</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 gap-4">
            {allSections.map(({ type, section }) => (
              <button
                key={`${type}-${section.id}`}
                onClick={() => setSelectedSection(`${type}-${section.id}`)}
                className={`dark-panel p-4 flex items-center gap-3 text-left hover:bg-white/5 transition-colors ${
                  selectedSection === `${type}-${section.id}` ? 'border-theme' : ''
                }`}
              >
                {type === 'movies' ? (
                  <Film className="h-5 w-5 text-theme-accent" />
                ) : type === 'shows' ? (
                  <Tv className="h-5 w-5 text-theme-accent" />
                ) : (
                  <Music className="h-5 w-5 text-theme-accent" />
                )}
                <div>
                  <div className="text-white">Section {section.id}</div>
                  <div className="text-xs text-gray-400 capitalize">{type}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {selectedSection && (
        <div className="dark-panel">
          <div className="table-header flex items-center justify-between">
            <h3 className="header-text">Format Template</h3>
            {(() => {
              const [type, sectionId] = selectedSection.split('-');
              return (
                <button
                  onClick={() => toggleMediaAdditionalField(type, sectionId)}
                  className={mediaFormats[type]?.[sectionId]?.fields?.some(f => f.id === 'additionalfield')
                    ? 'btn-secondary'
                    : 'btn-primary'
                  }
                >
                  {mediaFormats[type]?.[sectionId]?.fields?.some(f => f.id === 'additionalfield')
                    ? 'Remove Additional Field'
                    : 'Add Additional Field'
                  }
                </button>
              );
            })()}
          </div>
          <div className="p-4 space-y-6">
            {(() => {
              const [type, sectionId] = selectedSection.split('-');
              let fields = [];
              
              // Ensure mediaFormats structure exists
              if (!mediaFormats[type]) {
                console.log(`Type ${type} not found in mediaFormats`);
                return <div className="text-red-400">Error: Format type not initialized properly</div>;
              }
              
              if (!mediaFormats[type][sectionId]) {
                console.log(`Section ${sectionId} not found in mediaFormats[${type}]`);
                // Initialize if needed
                setMediaFormats(prev => {
                  const newFormats = { ...prev };
                  if (!newFormats[type]) newFormats[type] = {};
                  newFormats[type][sectionId] = { 
                    fields: [{ id: 'field', template: '' }]
                  };
                  return newFormats;
                });
                fields = [{ id: 'field', template: '' }];
              } else {
                fields = mediaFormats[type][sectionId].fields || [];
                if (fields.length === 0) {
                  // If no fields, add a default field
                  fields = [{ id: 'field', template: '' }];
                  setMediaFormats(prev => {
                    const newFormats = { ...prev };
                    newFormats[type][sectionId].fields = fields;
                    return newFormats;
                  });
                }
              }

              return fields.map((field, index) => (
                <div key={field.id} className="dark-panel p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="subheader-text capitalize">
                      {field.id === 'field' ? 'Primary Field' : 'Additional Field'}
                    </h4>
                  </div>
                  <div className="space-y-2">
                    <label className="form-label">Display Format</label>
                    <textarea
                      value={field.template}
                      onChange={(e) => updateMediaField(type, sectionId, field.id, e.target.value)}
                      onFocus={() => {
                        setSelectedFieldIndex(index);
                      }}
                      ref={(el) => textareaRefs.current[`${type}-${sectionId}-${field.id}`] = el}
                      className="input-field min-h-[60px]"
                      placeholder="Enter display format template"
                    />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
      
      {renderVariablePanel()}
    </div>
  );
};

export default MediaFormatManager;