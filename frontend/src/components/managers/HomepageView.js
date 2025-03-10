/**
 * Homepage configuration generator component
 * Generates YAML configurations for Homepage integration
 * @module components/managers/HomepageView
 */
import React, { useState, useEffect } from 'react';
import { Copy, Check, Monitor, Hash, Layers, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/UIComponents';
import { 
  generateActivityYaml, 
  generateRecentMediaYaml, 
  generateMediaCountYaml 
} from '../../utils/utils';

/**
 * Component for generating Homepage integration configuration
 * 
 * @returns {JSX.Element} Rendered component
 */
const HomepageView = () => {
  /**
   * Configured sections by type
   * @type {[{shows: Array<number>, movies: Array<number>, music: Array<number>}, Function]}
   */
  const [sections, setSections] = useState({ shows: [], movies: [], music: [] });
  
  /**
   * Library section names by ID
   * @type {[Object.<string, string>, Function]}
   */
  const [libraryNames, setLibraryNames] = useState({});
  
  /**
   * Format fields for different content types
   * @type {[{users: Array, movies: Object, shows: Object, music: Object}, Function]}
   */
  const [formatFields, setFormatFields] = useState({
    users: [],
    movies: {},
    shows: {},
    music: {}
  });
  
  /**
   * Loading state
   * @type {[boolean, Function]}
   */
  const [loading, setLoading] = useState(true);
  
  /**
   * Currently copied section ID
   * @type {[string|null, Function]}
   */
  const [copiedSection, setCopiedSection] = useState(null);
  
  /**
   * Tautulli base URL
   * @type {[string, Function]}
   */
  const [baseUrl, setBaseUrl] = useState('');
  
  /**
   * Homepage IP address
   * @type {[string, Function]}
   */
  const [localIp, setLocalIp] = useState('');
  
  /**
   * Application port
   * @type {[string, Function]}
   */
  const [port, setPort] = useState('');
  
  /**
   * User format fields
   * @type {[Array, Function]}
   */
  const [userFormatFields, setUserFormatFields] = useState([]);
  
  /**
   * Number of items to include in each mapping
   * @type {[{users: number, movies: number, shows: number, music: number}, Function]}
   */
  const [mappingLengths, setMappingLengths] = useState({
    users: 1,
    movies: 1,
    shows: 1,
    music: 1
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
   * Initialize data when component mounts
   */
  useEffect(() => {
    fetchSections();

    const handleSettingsUpdate = () => {
      fetchSections();
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  /**
   * Fetch configuration data from API
   * 
   * @async
   */
  const fetchSections = async () => {
    try {
      setLoading(true);
      const [settingsResponse, mediaResponse, configResponse, userFormatResponse] = await Promise.all([
        fetch('/api/media/settings'),
        fetch('/api/media/recent'),
        fetch('/api/config'),
        fetch('/api/users/format-settings')
      ]);
      
      const settingsData = await settingsResponse.json();
      const mediaData = await mediaResponse.json();
      const configData = await configResponse.json();
      const userFormatData = await userFormatResponse.json();
      
      // Enhanced debugging for section names
      console.log("Media API Response:", mediaData?.response?.libraries);
      console.log("Library sections:", mediaData?.response?.libraries?.sections);
      
      // Build a clean mapping of library names indexed by section ID
      const names = {};
      const processedSections = { shows: [], movies: [], music: [] };
  
      // Process library sections from the API response
      if (mediaData?.response?.libraries?.sections) {
        mediaData.response.libraries.sections.forEach(library => {
          // Make sure section_id is a primitive value (string or number)
          const sectionId = Number(library.section_id);
          
          // Store section names with different key formats for robust lookups
          names[sectionId] = library.section_name;
          names[String(sectionId)] = library.section_name;
          
          if (library.configured) {
            if (library.section_type === 'movie') {
              // Store only the primitive section ID, not the whole object
              processedSections.movies.push(sectionId);
            } else if (library.section_type === 'show') {
              // Store only the primitive section ID, not the whole object
              processedSections.shows.push(sectionId);
            } else if (library.section_type === 'artist' || library.section_type === 'music') {
              // Store only the primitive section ID, not the whole object
              processedSections.music.push(sectionId);
            }
          }
        });
  
        // If we got library data but no processed sections, use settings sections
        if (!processedSections.movies.length && !processedSections.shows.length && !processedSections.music.length) {
          processedSections.movies = (settingsData.sections?.movies || []).map(Number);
          processedSections.shows = (settingsData.sections?.shows || []).map(Number);
          processedSections.music = (settingsData.sections?.music || []).map(Number);
        }
      } else {
        // Fallback to settings sections
        processedSections.movies = (settingsData.sections?.movies || []).map(Number);
        processedSections.shows = (settingsData.sections?.shows || []).map(Number);
        processedSections.music = (settingsData.sections?.music || []).map(Number);
      }
      
      // Debug the processed data
      console.log("Processed section IDs:", processedSections);
      console.log("Section names mapping:", names);
      
      setSections(processedSections);
      setLibraryNames(names);
      setFormatFields({
        users: userFormatData.fields || [],
        movies: settingsData.formats?.movies || {},
        shows: settingsData.formats?.shows || {},
        music: settingsData.formats?.music || {}
      });
      setUserFormatFields(userFormatData.fields || []);
      
      // Set server configuration values - use the port from the configuration
      setBaseUrl(configData.baseUrl || '');
      setLocalIp(configData.homepageIp || '');
      setPort(configData.port || '3010');
      
      // Log which IP is being used
      console.log("Using IP for Homepage YAML:", configData.homepageIp || '');
      console.log("Using port for Homepage YAML:", configData.port || '3010');
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch configuration:', error);
      setLoading(false);
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
   * @param {string} type - Mapping type (users, movies, shows, music)
   * @param {string|number} value - New length value
   */
  const handleLengthChange = (type, value) => {
    setMappingLengths(prev => ({
      ...prev,
      [type]: parseInt(value) || 1
    }));
  };

  /**
   * Configuration section component
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

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="loading-spinner" />
      </div>
    );
  }

  const hasNoSections = sections &&
    Object.values(sections).every(list => !Array.isArray(list) || list.length === 0);

  const activityConfig = generateActivityYaml(
    { users: userFormatFields }, 
    mappingLengths, 
    localIp,
    port
  );
  
  const recentMediaConfig = generateRecentMediaYaml(
    sections, 
    formatFields, 
    libraryNames, 
    mappingLengths, 
    localIp,
    combineSections,
    showCount,
    useFormattedNumbers,
    port
  );
  
  const mediaCountConfig = generateMediaCountYaml(
    sections, 
    libraryNames, 
    localIp, 
    showIndividualCounts, 
    useFormattedNumbers,
    port
  );

  return (
    <div className="section-spacing">
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
          <div className="grid grid-cols-4 gap-4">
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
            <div>
              <label className="form-label mb-1">Music</label>
              <input
                type="number"
                min="1"
                max="15"
                value={mappingLengths.music}
                onChange={(e) => handleLengthChange('music', e.target.value)}
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

      {!localIp && (
        <Alert className="alert alert-warning mb-4">
          <AlertDescription className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              No Homepage IP set. Please configure the Homepage Integration IP in the Setup tab for Homepage integration to work properly.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {hasNoSections ? (
        <div className="dark-panel">
          <div className="p-8 text-center text-gray-400">
            No sections configured. Add sections in the Section Manager tab to see Homepage configuration examples.
          </div>
        </div>
      ) : (
        <>
          {userFormatFields.length > 0 && (
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

export default HomepageView;