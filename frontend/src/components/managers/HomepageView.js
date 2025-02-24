import React, { useState, useEffect } from 'react';
import { Copy, Check, Monitor, Hash, Layers } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  generateActivityYaml, 
  generateRecentMediaYaml, 
  generateMediaCountYaml 
} from './utils/homepageConfig';

const HomepageView = () => {
  const [sections, setSections] = useState({ shows: [], movies: [] });
  const [libraryNames, setLibraryNames] = useState({});
  const [formatFields, setFormatFields] = useState({
    users: [],
    movies: {},
    shows: {}
  });
  const [loading, setLoading] = useState(true);
  const [copiedSection, setCopiedSection] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [localIp, setLocalIp] = useState('');
  const [port, setPort] = useState('');
  const [userFormatFields, setUserFormatFields] = useState([]);
  const [mappingLengths, setMappingLengths] = useState({
    users: 15,
    movies: 15,
    shows: 15
  });
  const [showIndividualCounts, setShowIndividualCounts] = useState(true);
  const [useFormattedNumbers, setUseFormattedNumbers] = useState(true);
  const [combineSections, setCombineSections] = useState(false);
  const [showCount, setShowCount] = useState(false);

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
      
      // Get library names and build sections object
      const names = {};
      const processedSections = { shows: [], movies: [] };

      if (mediaData?.response?.libraries?.sections) {
        mediaData.response.libraries.sections.forEach(library => {
          names[library.section_id] = library.section_name;
          
          if (library.configured) {
            if (library.section_type === 'movie') {
              processedSections.movies.push(library.section_id);
            } else if (library.section_type === 'show') {
              processedSections.shows.push(library.section_id);
            }
          }
        });

        // If we got library data but no processed sections, use settings sections
        if (!processedSections.movies.length && !processedSections.shows.length) {
          processedSections.movies = settingsData.sections?.movies || [];
          processedSections.shows = settingsData.sections?.shows || [];
        }
      } else {
        // Fallback to settings sections
        processedSections.movies = settingsData.sections?.movies || [];
        processedSections.shows = settingsData.sections?.shows || [];
      }
      
      setSections(processedSections);
      setLibraryNames(names);
      setFormatFields({
        users: userFormatData.fields || [],
        movies: settingsData.formats?.movies || {},
        shows: settingsData.formats?.shows || {}
      });
      setUserFormatFields(userFormatData.fields || []);
      setBaseUrl(configData.baseUrl || '');
      setLocalIp(configData.localIp || '');
      setPort(configData.port || '3010');
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch configuration:', error);
      setLoading(false);
    }
  };

  const copyToClipboard = async (text, section) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleLengthChange = (type, value) => {
    setMappingLengths(prev => ({
      ...prev,
      [type]: parseInt(value) || 1
    }));
  };

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
    localIp
  );
  
  const recentMediaConfig = generateRecentMediaYaml(
    sections, 
    formatFields, 
    libraryNames, 
    mappingLengths, 
    localIp,
    combineSections,
    showCount,
    useFormattedNumbers
  );
  
  const mediaCountConfig = generateMediaCountYaml(
    sections, 
    libraryNames, 
    localIp, 
    showIndividualCounts, 
    useFormattedNumbers
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
          <div className="grid-3-cols">
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