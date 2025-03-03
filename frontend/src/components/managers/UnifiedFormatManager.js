/**
 * Unified Format Manager component
 * Parent component for user format, media format, and homepage configuration
 * @module components/managers/UnifiedFormatManager
 */
import React, { useState, useEffect, useRef } from 'react';
import { Film, Users, Home } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/UIComponents';
import UserFormatManager from './UserFormatManager';
import MediaFormatManager from './MediaFormatManager';
import HomepageConfigManager from './HomepageConfigManager';

/**
 * Main component that manages all format configuration views
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
    movies: [],
    music: []
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
   * References to textarea elements for variable insertion
   * @type {React.MutableRefObject<Object>}
   */
  const textareaRefs = useRef({});

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
        movies: mediaData.sections?.movies.map(id => ({ id: id.toString() })) || [],
        music: mediaData.sections?.music.map(id => ({ id: id.toString() })) || []
      };
      setSectionTypes(sections);
      
      // Initialize media formats
      const initialMediaFormats = {};
      ['shows', 'movies', 'music'].forEach(type => {
        initialMediaFormats[type] = {};
        (mediaData.sections?.[type] || []).forEach(sectionId => {
          const sectionStrId = sectionId.toString();
          // Get existing fields or use format from mediaData.formats properly
          const existingFields = mediaData.formats?.[type]?.[sectionId]?.fields || 
                              mediaData.formats?.[type]?.[sectionStrId]?.fields || [];
          
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
      } else if (sections.music.length > 0) {
        setSelectedSection(`music-${sections.music[0].id}`);
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
      console.log('Saving section types:', sectionTypes);
      console.log('Saving media formats:', mediaFormats);
      
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
      
      // Format the sections and formats for the API
      const formattedSections = Object.entries(sectionTypes).reduce((acc, [type, sections]) => {
        acc[type] = sections.map(s => parseInt(s.id));
        return acc;
      }, {});
      
      const formattedFormats = Object.entries(mediaFormats).reduce((acc, [type, sections]) => {
        acc[type] = {};
        Object.entries(sections).forEach(([sectionId, data]) => {
          // Convert to number ID for consistency with API
          acc[type][parseInt(sectionId)] = data;
        });
        return acc;
      }, {});
      
      console.log('Formatted media formats for API:', formattedFormats);
      
      // Body for API call
      const mediaBody = { 
        sections: formattedSections,
        formats: formattedFormats
      };
      console.log('Media API request body:', JSON.stringify(mediaBody));
      
      // Save media format settings
      const mediaResponse = await fetch('/api/media/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mediaBody)
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
      
      setUserFields(prev => 
        prev.map(f => f.id === field.id ? { ...f, template: newTemplate } : f)
      );
      
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
      
      setMediaFormats(prev => {
        const newFormats = { ...prev };
        const fields = newFormats[type][sectionId].fields;
        const fieldIndex = fields.findIndex(f => f.id === field.id);
        if (fieldIndex !== -1) {
          fields[fieldIndex] = { ...fields[fieldIndex], template: newTemplate };
        }
        return newFormats;
      });
      
      setTimeout(() => {
        textarea.focus();
        const newPosition = start + code.length;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    }
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

      {activeCategory === 'user' && (
        <UserFormatManager 
          userFields={userFields} 
          setUserFields={setUserFields} 
          selectedFieldIndex={selectedFieldIndex}
          setSelectedFieldIndex={setSelectedFieldIndex}
          textareaRefs={textareaRefs}
          insertVariable={insertVariable}
        />
      )}
      
      {activeCategory === 'media' && (
        <MediaFormatManager 
          sectionTypes={sectionTypes}
          mediaFormats={mediaFormats}
          setMediaFormats={setMediaFormats}
          selectedSection={selectedSection}
          setSelectedSection={setSelectedSection}
          selectedFieldIndex={selectedFieldIndex}
          setSelectedFieldIndex={setSelectedFieldIndex}
          textareaRefs={textareaRefs}
          insertVariable={insertVariable}
        />
      )}
      
      {activeCategory === 'homepage' && (
        <HomepageConfigManager 
          sectionTypes={sectionTypes}
          libraryNames={libraryNames}
          mediaFormats={mediaFormats}
          userFields={userFields}
          localIp={localIp}
        />
      )}
    </div>
  );
};

export default UnifiedFormatManager;