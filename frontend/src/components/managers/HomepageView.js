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
  const [mappingLengths, setMappingLengths] = useState({
    users: 1,
    movies: 1,
    shows: 1
  });
  const [showIndividualCounts, setShowIndividualCounts] = useState(true);
  const [useFormattedNumbers, setUseFormattedNumbers] = useState(true);
  const [combineSections, setCombineSections] = useState(false);

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
      const [settingsResponse, configResponse, userResponse, librariesResponse] = await Promise.all([
        fetch('/api/media/settings'),
        fetch('/api/config'),
        fetch('/api/users/format-settings'),
        fetch('/api/libraries')
      ]);
      
      const settingsData = await settingsResponse.json();
      const configData = await configResponse.json();
      const userFormatData = await userResponse.json();
      const librariesData = await librariesResponse.json();
      
      // Get library names and build sections object
      const names = {};
      const processedSections = { shows: [], movies: [] };

      librariesData.response.sections.forEach(library => {
        names[library.section_id] = library.section_name;
        
        if (library.configured) {
          if (library.section_type === 'movie') {
            processedSections.movies.push(library.section_id);
          } else if (library.section_type === 'show') {
            processedSections.shows.push(library.section_id);
          }
        }
      });
      
      setSections(processedSections);
      setLibraryNames(names);
      setFormatFields({
        users: userFormatData.fields || [],
        movies: settingsData.formats?.movies || {},
        shows: settingsData.formats?.shows || {}
      });
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">{title}</h3>
        <button
          onClick={() => copyToClipboard(yaml, section)}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
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
      <pre className="p-4 bg-gray-800 rounded-lg overflow-x-auto">
        <code className="text-sm text-gray-300 whitespace-pre">{yaml}</code>
      </pre>
    </div>
  );

  if (loading) {
    return <div className="text-center text-gray-400">Loading configuration...</div>;
  }

  const hasNoSections = !Object.values(sections).some(list => list.length > 0);

  const activityConfig = generateActivityYaml(formatFields, mappingLengths, localIp);
  const recentMediaConfig = generateRecentMediaYaml(
    sections, 
    formatFields, 
    libraryNames, 
    mappingLengths, 
    localIp,
    combineSections
  );
  const mediaCountConfig = generateMediaCountYaml(
    sections, 
    libraryNames, 
    localIp, 
    showIndividualCounts, 
    useFormattedNumbers
  );

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Display Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-300">Recently Added Display</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCombineSections(false)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  !combineSections 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                Split
              </button>
              <button
                onClick={() => setCombineSections(true)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  combineSections 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                Combined
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
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  showIndividualCounts 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                Individual
              </button>
              <button
                onClick={() => setShowIndividualCounts(false)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  !showIndividualCounts 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
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
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  useFormattedNumbers 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                Formatted
              </button>
              <button
                onClick={() => setUseFormattedNumbers(false)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  !useFormattedNumbers 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                }`}
              >
                Raw
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Mapping Length Settings</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Users</label>
            <input
              type="number"
              min="1"
              max="25"
              value={mappingLengths.users}
              onChange={(e) => handleLengthChange('users', e.target.value)}
              className="w-full px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Movies</label>
            <input
              type="number"
              min="1"
              max="15"
              value={mappingLengths.movies}
              onChange={(e) => handleLengthChange('movies', e.target.value)}
              className="w-full px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Shows</label>
            <input
              type="number"
              min="1"
              max="15"
              value={mappingLengths.shows}
              onChange={(e) => handleLengthChange('shows', e.target.value)}
              className="w-full px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white"
            />
          </div>
        </div>
      </div>

      <Alert className="bg-blue-900/50 border-blue-800">
        <AlertDescription className="text-blue-100">
          Below are example Homepage configurations based on your current section settings.
          URLs are automatically configured using your Tautulli base URL.
        </AlertDescription>
      </Alert>

      {hasNoSections ? (
        <div className="text-center text-gray-400 p-8 bg-gray-800 rounded-lg">
          No sections configured. Add sections in the Section Manager tab to see Homepage configuration examples.
        </div>
      ) : (
        <>
          {activityConfig && (
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