/**
 * Comprehensive Format Manager component
 * Combines user formats, media formats, and homepage configuration in a unified interface
 * @module components/managers/UnifiedFormatManager
 */
import React, { useState, useEffect, useRef } from 'react';
import { Tabs, Film, Tv, Users, Monitor, Hash, Layers, Home, Copy, Check } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/UIComponents';
import { generateActivityYaml, generateRecentMediaYaml, generateMediaCountYaml } from '../../utils/utils';

/**
 * Component for managing all display format configurations and homepage settings
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onError - Callback for error notifications
 * @param {Function} props.onSuccess - Callback for success notifications
 * @returns {JSX.Element} Rendered component
 */
const UnifiedFormatManager = ({ onError, onSuccess }) => {
  /**
   * Format type categories
   * @type {[string, Function]}
   */
  const [activeCategory, setActiveCategory] = useState('user');
  
  /**
   * Section types and their configured sections
   * @type {[Object, Function]}
   */
  const [sectionTypes, setSectionTypes] = useState({
    shows: [],
    movies: []
  });
  
  /**
   * User format fields
   * @type {[Array<{id: string, template: string}>, Function]}
   */
  const [userFields, setUserFields] = useState([]);
  
  /**
   * Media display format configurations by type and section
   * @type {[Object, Function]}
   */
  const [mediaFormats, setMediaFormats] = useState({});
  
  /**
   * Currently selected format section
   * @type {[string|null, Function]}
   */
  const [selectedSection, setSelectedSection] = useState(null);
  
  /**
   * Currently selected field index for variable insertion
   * @type {[number|null, Function]}
   */
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(null);
  
  /**
   * Loading state
   * @type {[boolean, Function]}
   */
  const [loading, setLoading] = useState(true);
  
  /**
   * Saving in progress state
   * @type {[boolean, Function]}
   */
  const [saving, setSaving] = useState(false);

  /**
   * Library section names by ID
   * @type {[Object.<string, string>, Function]}
   */
  const [libraryNames, setLibraryNames] = useState({});
  
  /**
   * Tautulli base URL
   * @type {[string, Function]}
   */
  const [baseUrl, setBaseUrl] = useState('');
  
  /**
   * Local IP address
   * @type {[string, Function]}
   */
  const [localIp, setLocalIp] = useState('');
  
  /**
   * Application port
   * @type {[string, Function]}
   */
  const [port, setPort] = useState('');
  
  /**
   * Number of items to include in each mapping
   * @type {[{users: number, movies: number, shows: number}, Function]}
   */
  const [mappingLengths, setMappingLengths] = useState({
    users: 15,
    movies: 15,
    shows: 15
  });
  
  /**
   * Whether to show individual counts
   * @type {[boolean, Function]}
   */
  const [showIndividualCounts, setShowIndividualCounts] = useState(true);
  
  /**
   * Whether to use formatted numbers
   * @type {[boolean, Function]}
   */
  const [useFormattedNumbers, setUseFormattedNumbers] = useState(true);
  
  /**
   * Whether to combine sections
   * @type {[boolean, Function]}
   */
  const [combineSections, setCombineSections] = useState(false);
  
  /**
   * Whether to show count
   * @type {[boolean, Function]}
   */
  const [showCount, setShowCount] = useState(false);
  
  /**
   * Currently copied section ID
   * @type {[string|null, Function]}
   */
  const [copiedSection, setCopiedSection] = useState(null);

  /**
   * References to textarea elements for variable insertion
   * @type {React.MutableRefObject<Object>}
   */
  const textareaRefs = useRef({});

  /**
   * Template variables by format type
   * @type {Object}
   */
  const variables = {
    user: [
      { code: '${friendly_name}', description: 'Display name' },
      { code: '${total_plays}', description: 'Total play count' },
      { code: '${last_played}', description: 'Currently watching/last watched' },
      { code: '${media_type}', description: 'Type of media' },
      { code: '${progress_percent}', description: 'Current progress' },
      { code: '${progress_time}', description: 'Progress timestamp' },
      { code: '${is_watching}', description: 'Current status' },
      { code: '${last_seen_formatted}', description: 'Last activity timestamp' },
      { code: '${stream_container_decision}', description: 'Transcode or Direct Play' }
    ],
    movies: [
      { code: '${title}', description: 'Movie title' },
      { code: '${year}', description: 'Release year' },
      { code: '${duration}', description: 'Runtime' },
      { code: '${content_rating}', description: 'Content rating' },
      { code: '${video_resolution}', description: 'Video quality' },
      { code: '${added_at_relative}', description: 'Relative time (2d ago)' },
      { code: '${added_at_short}', description: 'Short date (Feb 10)' }
    ],
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
    ]
  };

  /**
   * Fetch settings data when component mounts
   */
  useEffect(() => {
    fetchSettings();
  }, []);

  /**
   * Fetch all format settings from APIs
   * 
   * @async
   */
  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      // Fetch user format settings
      const userResponse = await fetch('/api/users/format-settings');
      if (!userResponse.ok) throw new Error('Failed to fetch user format settings');
      const userData = await userResponse.json();
      
      // Initialize user fields with at least one field
      let initialUserFields = userData.fields || [];
      if (initialUserFields.length === 0) {
        initialUserFields = [{ id: 'field', template: '' }];
      }
      
      // Ensure the first field has id 'field'
      if (initialUserFields.length > 0 && initialUserFields[0].id !== 'field') {
        initialUserFields[0].id = 'field';
      }
      
      setUserFields(initialUserFields);
      
      // Fetch media format settings and configuration data
      const [mediaResponse, configResponse, mediaRecentResponse] = await Promise.all([
        fetch('/api/media/settings'),
        fetch('/api/config'),
        fetch('/api/media/recent')
      ]);
      
      if (!mediaResponse.ok) throw new Error('Failed to fetch media format settings');
      if (!configResponse.ok) throw new Error('Failed to fetch configuration');
      
      const mediaData = await mediaResponse.json();
      const configData = await configResponse.json();
      const mediaRecentData = await mediaRecentResponse.json();
      
      // Extract sections and formats
      const sections = {
        shows: mediaData.sections?.shows.map(id => ({ id: id.toString() })) || [],
        movies: mediaData.sections?.movies.map(id => ({ id: id.toString() })) || []
      };
      setSectionTypes(sections);
      
      // Initialize media formats
      const initialMediaFormats = {};
      ['shows', 'movies'].forEach(type => {
        initialMediaFormats[type] = {};
        (mediaData.sections?.[type] || []).forEach(sectionId => {
          const sectionStrId = sectionId.toString();
          const existingFields = mediaData.formats?.[type]?.[sectionId]?.fields || [];
          
          // Ensure we have at least one field
          if (existingFields.length === 0) {
            existingFields.push({ id: 'field', template: '' });
          }
          
          initialMediaFormats[type][sectionStrId] = {
            fields: existingFields
          };
        });
      });
      setMediaFormats(initialMediaFormats);
      
      // Set configuration data for homepage
      setBaseUrl(configData.baseUrl || '');
      setLocalIp(configData.localIp || '');
      setPort(configData.port || '3010');
      
      // Get library names from media recent data
      const libraryNamesMap = {};
      if (mediaRecentData?.response?.libraries?.sections) {
        mediaRecentData.response.libraries.sections.forEach(library => {
          libraryNamesMap[library.section_id] = library.section_name;
        });
      }
      setLibraryNames(libraryNamesMap);
      
      // Set initial selected section if available
      if (sections.movies.length > 0) {
        setSelectedSection(`movies-${sections.movies[0].id}`);
      } else if (sections.shows.length > 0) {
        setSelectedSection(`shows-${sections.shows[0].id}`);
      }
      
    } catch (error) {
      onError(error.message || 'Failed to load format settings');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save all format settings to APIs with improved error handling
   * 
   * @async
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Log what we're about to save for debugging
      console.log('Saving user fields:', userFields);
      
      // Save user format settings first and wait for the response
      const userResponse = await fetch('/api/users/format-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: userFields })
      });
      
      // Check if user format save failed
      if (!userResponse.ok) {
        const errorData = await userResponse.json().catch(() => ({}));
        console.error('Failed to save user format settings:', errorData);
        throw new Error(`Failed to save user format settings: ${errorData.error || userResponse.statusText}`);
      }
      
      // Save media format settings
      const mediaResponse = await fetch('/api/media/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sections: Object.entries(sectionTypes).reduce((acc, [type, sections]) => {
            acc[type] = sections.map(s => parseInt(s.id));
            return acc;
          }, {}),
          formats: mediaFormats
        })
      });
      
      // Check if media format save failed
      if (!mediaResponse.ok) {
        const errorData = await mediaResponse.json().catch(() => ({}));
        console.error('Failed to save media format settings:', errorData);
        throw new Error(`Failed to save media format settings: ${errorData.error || mediaResponse.statusText}`);
      }
      
      // Force a refresh of the data after saving
      await fetchSettings();
      
      onSuccess();
    } catch (error) {
      console.error('Save error:', error);
      onError(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Toggle additional field for user formats
   */
  const toggleUserAdditionalField = () => {
    setUserFields(prev => {
      if (prev.some(f => f.id === 'additionalfield')) {
        return prev.filter(f => f.id !== 'additionalfield');
      }
      return [...prev, { id: 'additionalfield', template: '' }];
    });
  };

  /**
   * Toggle additional field for media formats
   * 
   * @param {string} type - Media type (shows, movies)
   * @param {string} sectionId - Section ID
   */
  const toggleMediaAdditionalField = (type, sectionId) => {
    setMediaFormats(prev => {
      const newFormats = { ...prev };
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
   * Update user format field
   * 
   * @param {string} id - Field ID
   * @param {string} template - New template value
   */
  const updateUserField = (id, template) => {
    setUserFields(prev => 
      prev.map(field => 
        field.id === id ? { ...field, template } : field
      )
    );
  };

  /**
   * Update media format field
   * 
   * @param {string} type - Media type (shows, movies)
   * @param {string} sectionId - Section ID
   * @param {string} fieldId - Field ID
   * @param {string} template - New template value
   */
  const updateMediaField = (type, sectionId, fieldId, template) => {
    setMediaFormats(prev => {
      const newFormats = { ...prev };
      const fields = newFormats[type][sectionId].fields;
      const fieldIndex = fields.findIndex(f => f.id === fieldId);
      if (fieldIndex !== -1) {
        fields[fieldIndex] = { ...fields[fieldIndex], template };
      }
      return newFormats;
    });
  };

  /**
   * Insert variable code at cursor position
   * 
   * @param {string} code - Variable code to insert
   */
  const insertVariable = (code) => {
    if (activeCategory === 'user') {
      // User format variable insertion
      if (selectedFieldIndex === null) return;
      
      const field = userFields[selectedFieldIndex];
      const textarea = textareaRefs.current[`user-${field.id}`];
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const template = field.template;
      const newTemplate = template.slice(0, start) + code + template.slice(end);
      
      updateUserField(field.id, newTemplate);
      
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + code.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    } else if (activeCategory === 'media') {
      // Media format variable insertion
      if (!selectedSection) return;
      const [type, sectionId] = selectedSection.split('-');
      
      const fields = mediaFormats[type]?.[sectionId]?.fields;
      if (!fields || selectedFieldIndex === null) return;
      
      const field = fields[selectedFieldIndex];
      const textarea = textareaRefs.current[`${type}-${sectionId}-${field.id}`];
      if (!textarea) return;
      
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const template = field.template;
      const newTemplate = template.slice(0, start) + code + template.slice(end);
      
      updateMediaField(type, sectionId, field.id, newTemplate);
      
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + code.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    }
  };

  /**
   * Copy text to clipboard
   * 
   * @async
   * @param {string} text - Text to copy
   * @param {string} section - Section identifier
   */
  const copyToClipboard = async (text, section) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  /**
   * Handle mapping length change
   * 
   * @param {string} type - Mapping type (users, movies, shows)
   * @param {string|number} value - New length value
   */
  const handleLengthChange = (type, value) => {
    setMappingLengths(prev => ({
      ...prev,
      [type]: parseInt(value) || 1
    }));
  };

  /**
   * Renders the template variable selection panel
   * 
   * @returns {JSX.Element} Variable selection panel
   */
  const renderVariablePanel = () => {
    let variablesToUse = [];
    
    if (activeCategory === 'user') {
      variablesToUse = variables.user;
    } else if (activeCategory === 'media' && selectedSection) {
      const [type] = selectedSection.split('-');
      variablesToUse = variables[type] || [];
    }
    
    if (activeCategory === 'homepage') {
      return null;
    }
    
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
                className="text-left text-sm p-2 hover:bg-white/5 rounded transition-colors flex items-center gap-2"
                disabled={selectedFieldIndex === null}
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

  /**
   * Renders user format fields configuration
   * 
   * @returns {JSX.Element} User format configuration section
   */
  const renderUserFormatSection = () => {
    return (
      <div className="space-y-6">
        <div className="dark-panel">
          <div className="table-header flex items-center justify-between">
            <h3 className="header-text">User Display Format</h3>
            <button
              onClick={toggleUserAdditionalField}
              className={userFields.some(f => f.id === 'additionalfield') ? 'btn-secondary' : 'btn-primary'}
            >
              {userFields.some(f => f.id === 'additionalfield') ? 'Remove Additional Field' : 'Add Additional Field'}
            </button>
          </div>
          <div className="p-4 space-y-6">
            {userFields.map((field, index) => (
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
                    onChange={(e) => updateUserField(field.id, e.target.value)}
                    onFocus={() => {
                      setSelectedFieldIndex(index);
                    }}
                    ref={(el) => textareaRefs.current[`user-${field.id}`] = el}
                    className="input-field min-h-[60px]"
                    placeholder="Enter display format template"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        {renderVariablePanel()}
      </div>
    );
  };

  /**
   * Renders media format fields configuration
   * 
   * @returns {JSX.Element} Media format configuration section
   */
  const renderMediaFormatSection = () => {
    const allSections = [
      ...sectionTypes.movies.map(section => ({ type: 'movies', section })),
      ...sectionTypes.shows.map(section => ({ type: 'shows', section }))
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
                  ) : (
                    <Tv className="h-5 w-5 text-theme-accent" />
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
                return mediaFormats[type]?.[sectionId]?.fields.map((field, index) => (
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

  /**
   * Configuration section component for Homepage YAML
   * 
   * @param {Object} props - Component props
   * @param {string} props.title - Section title
   * @param {string} props.yaml - YAML configuration
   * @param {string} props.section - Section identifier
   * @returns {JSX.Element} Rendered component
   */
  const ConfigSection = ({ title, yaml, section }) => (
    <div className="dark-panel">
      <div className="table-header flex items-center justify-between">
        <h3 className="header-text">{title}</h3>
        <button
          onClick={() => copyToClipboard(yaml, section)}
          className="btn-primary"
        >
          {copiedSection === section ? (
            <>
              <Check className="h-4 w-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </button>
      </div>
      <div className="p-4">
        <pre className="code-block">
          <code className="text-gray-300 whitespace-pre">{yaml}</code>
        </pre>
      </div>
    </div>
  );

  /**
   * Renders homepage configuration section
   * 
   * @returns {JSX.Element} Homepage configuration section
   */
  const renderHomepageSection = () => {
    const hasNoSections = Object.values(sectionTypes).every(
      list => !Array.isArray(list) || list.length === 0
    );

    const activityConfig = generateActivityYaml(
      { users: userFields }, 
      mappingLengths, 
      localIp
    );
    
    const recentMediaConfig = generateRecentMediaYaml(
      sectionTypes, 
      mediaFormats, 
      libraryNames, 
      mappingLengths, 
      localIp,
      combineSections,
      showCount,
      useFormattedNumbers
    );
    
    const mediaCountConfig = generateMediaCountYaml(
      sectionTypes, 
      libraryNames, 
      localIp, 
      showIndividualCounts, 
      useFormattedNumbers
    );

    return (
      <div className="space-y-6">
        <div className="dark-panel">
          <div className="table-header">
            <h3 className="header-text">Display Settings</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-300">Recently Added Display</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCombineSections(false);
                    setShowCount(false);
                  }}
                  className={!combineSections && !showCount ? 'btn-primary' : 'btn-secondary'}
                >
                  Split
                </button>
                <button
                  onClick={() => {
                    setCombineSections(false);
                    setShowCount(true);
                  }}
                  className={!combineSections && showCount ? 'btn-primary' : 'btn-secondary'}
                >
                  Split with Count
                </button>
                <button
                  onClick={() => {
                    setCombineSections(true);
                    setShowCount(false);
                  }}
                  className={combineSections && !showCount ? 'btn-primary' : 'btn-secondary'}
                >
                  Combined
                </button>
                <button
                  onClick={() => {
                    setCombineSections(true);
                    setShowCount(true);
                  }}
                  className={combineSections && showCount ? 'btn-primary' : 'btn-secondary'}
                >
                  Combined with Count
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-300">Library Count Display</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowIndividualCounts(true)}
                  className={showIndividualCounts ? 'btn-primary' : 'btn-secondary'}
                >
                  Individual
                </button>
                <button
                  onClick={() => setShowIndividualCounts(false)}
                  className={!showIndividualCounts ? 'btn-primary' : 'btn-secondary'}
                >
                  Totals Only
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-300">Number Format</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setUseFormattedNumbers(true)}
                  className={useFormattedNumbers ? 'btn-primary' : 'btn-secondary'}
                >
                  Formatted
                </button>
                <button
                  onClick={() => setUseFormattedNumbers(false)}
                  className={!useFormattedNumbers ? 'btn-primary' : 'btn-secondary'}
                >
                  Raw
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="dark-panel">
          <div className="table-header">
            <h3 className="header-text">Mapping Length Settings</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="form-label mb-1">Users</label>
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={mappingLengths.users}
                  onChange={(e) => handleLengthChange('users', e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label mb-1">Movies</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={mappingLengths.movies}
                  onChange={(e) => handleLengthChange('movies', e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="form-label mb-1">Shows</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={mappingLengths.shows}
                  onChange={(e) => handleLengthChange('shows', e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>
        </div>

        <Alert className="alert alert-info">
          <AlertDescription>
            Below are example Homepage configurations based on your current section settings.
            URLs are automatically configured using your Tautulli base URL.
          </AlertDescription>
        </Alert>

        {hasNoSections ? (
          <div className="dark-panel">
            <div className="p-8 text-center text-gray-400">
              No sections configured. Add sections in the Section Manager tab to see Homepage configuration examples.
            </div>
          </div>
        ) : (
          <>
            {userFields.length > 0 && (
              <ConfigSection 
                title="User Activity Configuration" 
                yaml={activityConfig} 
                section="activity"
              />
            )}
            {recentMediaConfig && (
              <ConfigSection 
                title="Recent Media Configuration" 
                yaml={recentMediaConfig} 
                section="recent"
              />
            )}
            {mediaCountConfig && (
              <ConfigSection 
                title="Media Count Configuration" 
                yaml={mediaCountConfig} 
                section="count"
              />
            )}
          </>
        )}
      </div>
    );
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
      <Alert className="alert alert-info">
        <AlertDescription className="flex items-center gap-2">
          Configure display formats for users and media items, and generate Homepage integration YAML.
        </AlertDescription>
      </Alert>

      <div className="dark-panel mb-6">
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveCategory('user')}
              className={`flex items-center gap-2 pb-4 -mb-4 text-sm font-medium transition-colors ${
                activeCategory === 'user'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>User Formats</span>
            </button>
            <button
              onClick={() => setActiveCategory('media')}
              className={`flex items-center gap-2 pb-4 -mb-4 text-sm font-medium transition-colors ${
                activeCategory === 'media'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Film className="h-4 w-4" />
              <span>Media Formats</span>
            </button>
            <button
              onClick={() => setActiveCategory('homepage')}
              className={`flex items-center gap-2 pb-4 -mb-4 text-sm font-medium transition-colors ${
                activeCategory === 'homepage'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Homepage Config</span>
            </button>
          </div>
          
          {activeCategory !== 'homepage' && (
            <button 
              onClick={handleSave} 
              className="btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {activeCategory === 'user' && renderUserFormatSection()}
      {activeCategory === 'media' && renderMediaFormatSection()}
      {activeCategory === 'homepage' && renderHomepageSection()}
    </div>
  );
};

export default UnifiedFormatManager;