/**
 * Homepage Configuration Manager component
 * Generates YAML configurations for Homepage integration
 * @module components/managers/HomepageConfigManager
 */
import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Monitor, Hash, Layers, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/UIComponents';
import { 
  generateActivityYaml, 
  generateRecentMediaYaml, 
  generateMediaCountYaml 
} from '../../utils/utils';

/**
 * ConfigSection component for displaying YAML with copy functionality
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Section title
 * @param {string} props.yaml - YAML configuration
 * @param {string} props.section - Section identifier
 * @param {string|null} props.copiedSection - Currently copied section
 * @param {Function} props.copyToClipboard - Function to copy text to clipboard
 * @returns {JSX.Element} Rendered component
 */
const ConfigSection = ({ title, yaml, section, copiedSection, copyToClipboard }) => (
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
 * Homepage configuration component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.sectionTypes - Section types with their configured sections
 * @param {Object} props.libraryNames - Library names by section ID
 * @param {Object} props.mediaFormats - Media format configurations
 * @param {Array} props.userFields - User format fields
 * @param {string} props.localIp - Local IP address
 * @param {string} props.port - Custom port from configuration
 * @returns {JSX.Element} Rendered component
 */
const HomepageConfigManager = ({ 
  sectionTypes, 
  libraryNames, 
  mediaFormats, 
  userFields,
  localIp,
  port
}) => {
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
   * Currently copied section ID
   * @type {[string|null, Function]}
   */
  const [copiedSection, setCopiedSection] = useState(null);

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

  // Convert sectionTypes to the format expected by the YAML generation functions
  const processedSectionTypes = {
    movies: sectionTypes.movies.map(s => parseInt(s.id)),
    shows: sectionTypes.shows.map(s => parseInt(s.id)),
    music: sectionTypes.music.map(s => parseInt(s.id))
  };

  // Ensure we're using integer section IDs consistently
  console.log('Section types for YAML generation:', processedSectionTypes);
  console.log('Media formats:', mediaFormats);

  const hasNoSections = Object.values(processedSectionTypes).every(
    list => !Array.isArray(list) || list.length === 0
  );

  const activityConfig = generateActivityYaml(
    { users: userFields }, 
    mappingLengths, 
    localIp,
    port
  );
  
  const recentMediaConfig = generateRecentMediaYaml(
    processedSectionTypes, 
    mediaFormats,
    libraryNames, 
    mappingLengths, 
    localIp,
    combineSections,
    showCount,
    useFormattedNumbers,
    port
  );
  
  const mediaCountConfig = generateMediaCountYaml(
    processedSectionTypes, 
    libraryNames, 
    localIp, 
    showIndividualCounts, 
    useFormattedNumbers,
    port
  );

  return (
    <div className="space-y-6">
      {!localIp && (
        <Alert className="alert alert-warning mb-4">
          <AlertDescription className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>
              <strong>No Homepage IP configured.</strong> Please set a Homepage IP in the Setup tab for
              the YAML configuration to work properly. Homepage integration requires a valid IP address.
            </span>
          </AlertDescription>
        </Alert>
      )}
      
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
          URLs are automatically configured using your Homepage IP.
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
              copiedSection={copiedSection}
              copyToClipboard={copyToClipboard}
            />
          )}
          {recentMediaConfig && (
            <ConfigSection 
              title="Recent Media Configuration" 
              yaml={recentMediaConfig} 
              section="recent"
              copiedSection={copiedSection}
              copyToClipboard={copyToClipboard}
            />
          )}
          {mediaCountConfig && (
            <ConfigSection 
              title="Media Count Configuration" 
              yaml={mediaCountConfig} 
              section="count"
              copiedSection={copiedSection}
              copyToClipboard={copyToClipboard}
            />
          )}
        </>
      )}
    </div>
  );
};

export default HomepageConfigManager;