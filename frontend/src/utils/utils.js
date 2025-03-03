/**
 * Unified utility functions for application
 * Includes formatting, data processing, and UI helpers
 * @module utils/utils
 */
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with Tailwind's class merging strategy
 * 
 * @param {...string} inputs - Class names to combine
 * @returns {string} Merged class names
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Formats duration in seconds to human readable string
 * 
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g. "2d 5h 30m")
 */
export function formatDuration(seconds) {
  if (!seconds) return '0m';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  
  return parts.join(' ');
}

/**
 * Formats a number with thousands separators
 * 
 * @param {number} num - Number to format
 * @returns {string} Formatted number with commas
 */
export function formatNumber(num) {
  return new Intl.NumberFormat().format(num || 0);
}

/**
 * Formats a timestamp as relative time
 * 
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Relative time string (e.g. "2 hours ago")
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Never';
  
  const now = Date.now() / 1000;
  const diff = Math.floor(now - timestamp);
  
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

/**
 * Formats a timestamp to specified format
 * 
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {string} [format='relative'] - Format type
 * @returns {string} Formatted date string
 */
export function formatDate(timestamp, format = 'relative') {
  if (!timestamp) return '';
  
  const date = new Date(timestamp * 1000);
  
  switch (format) {
    case 'absolute':
      return date.toLocaleString();
    case 'iso':
      return date.toISOString();
    case 'shortdate':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'relative':
    default:
      return formatRelativeTime(timestamp);
  }
}

/**
 * Creates a debounced function that delays invoking the provided function
 * 
 * @param {Function} func - Function to debounce
 * @param {number} [wait=300] - Debounce wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Fetch JSON data with error handling
 * 
 * @async
 * @param {string} url - URL to fetch
 * @param {RequestInit} [options={}] - Fetch options
 * @returns {Promise<*>} Parsed JSON response
 * @throws {Error} If fetch fails or response is not ok
 */
export async function fetchJson(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Parse comma-separated section IDs into an array of numbers
 * 
 * @param {string} input - Comma-separated section IDs
 * @returns {Array<number>} Array of section IDs
 */
export function parseSectionIds(input) {
  if (!input || typeof input !== 'string') return [];
  
  return input
    .split(',')
    .map(id => id.trim())
    .filter(id => /^\d+$/.test(id))
    .map(Number);
}

/**
 * Create a table sort comparator function
 * 
 * @param {string} key - Object key to sort by
 * @param {string} [direction='asc'] - Sort direction ('asc' or 'desc')
 * @returns {Function} Comparator function for Array.sort()
 */
export function createSortComparator(key, direction = 'asc') {
  return (a, b) => {
    let aVal = a[key];
    let bVal = b[key];
    
    // Handle numeric values
    if (typeof aVal === 'string' && !isNaN(aVal)) {
      aVal = parseFloat(aVal);
      bVal = parseFloat(bVal);
    }
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  };
}

/**
 * Helper function to safely extract section ID from potentially object value
 * 
 * @param {*} section - Section ID or object
 * @returns {number|string} Extracted section ID
 */
function extractSectionId(section) {
  if (section === null || section === undefined) {
    return '';
  }
  
  if (typeof section === 'object') {
    // Try to extract ID from object if it's an object
    return section.id || section.section_id || section.sectionId || '';
  }
  
  // Return as is if it's already a primitive
  return section;
}

/**
 * Template variables by format type
 * @type {Object}
 */
export const variables = {
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
  ],
  music: [
    { code: '${parent_title}', description: 'Artist name' },
    { code: '${title}', description: 'Album title' },
    { code: '${year}', description: 'Release year' },
    { code: '${studio}', description: 'Record label/Studio' },
    { code: '${genres}', description: 'Music genres' },
    { code: '${added_at_relative}', description: 'Relative time (2d ago)' },
    { code: '${added_at_short}', description: 'Short date (Feb 10)' }
  ]
};

/************** Homepage Configuration Functions **************/

/**
 * Generate user mappings for Homepage configuration
 * 
 * @param {number} length - Number of mappings to generate
 * @param {Object} formatFields - Format field settings
 * @returns {string} Generated YAML mappings
 */
export function generateUserMappings(length, formatFields) {
  if (!formatFields || !formatFields.users || !Array.isArray(formatFields.users)) {
    return "";
  }
  
  return Array.from({ length: Number(length) || 0 }, (_, index) => {
    const baseMapping = `               - field:
                   response:
                     data:
                       ${index}: field`;
    
    const hasAdditionalField = formatFields.users.some(f => f && f.id === 'additionalfield');
    const additionalFieldMapping = hasAdditionalField ? `
                 additionalField:
                   field:
                     response:
                       data:
                         ${index}: additionalfield` : '';
    
    return baseMapping + additionalFieldMapping;
  }).join('\n');
}

/**
 * Generate media mappings for Homepage configuration
 * 
 * @param {number} length - Number of mappings to generate
 * @param {boolean} [hasAdditionalField=false] - Whether to include additional field
 * @returns {string} Generated YAML mappings
 */
export function generateMediaMappings(length, hasAdditionalField = false) {
  return Array.from({ length: Number(length) || 0 }, (_, index) => {
    const baseMapping = `              - field:
                  response:
                    data:
                      ${index}: field`;
    
    const additionalFieldMapping = hasAdditionalField ? `
                additionalField:
                  field:
                    response:
                      data:
                        ${index}: additionalfield
                  color: theme` : '';
    
    return baseMapping + additionalFieldMapping;
  }).join('\n');
}

/**
 * Generate Activity YAML configuration for Homepage
 * 
 * @param {Object} formatFields - Format field settings
 * @param {Object} mappingLengths - Number of mappings for each type
 * @param {string} localIp - Local IP address
 * @returns {string} Generated YAML configuration
 */
export function generateActivityYaml(formatFields, mappingLengths, localIp) {
  if (!formatFields || !formatFields.users || !Array.isArray(formatFields.users)) {
    return "";
  }
  
  const hasField = formatFields.users.some(f => f && f.id === 'field');
  
  if (!hasField) {
    return '';
  }

  // Ensure localIp is a string
  const ipAddress = localIp && typeof localIp === 'string' ? localIp : '127.0.0.1';
  
  // Ensure users count is a number
  const userCount = mappingLengths && typeof mappingLengths === 'object' && mappingLengths.users ? 
                   Number(mappingLengths.users) : 15;

  const mappings = generateUserMappings(userCount, formatFields);
  return `- Activity:                     
    - Activity:
         id: list
         widgets:
           - type: customapi
             url: http://${ipAddress}:3010/api/users
             method: GET
             display: list
             mappings:
${mappings}`;
}

/**
 * Generate Recent Media YAML configuration for Homepage
 * 
 * @param {Object} sections - Section configuration
 * @param {Object} formatFields - Format field settings
 * @param {Object} libraryNames - Library name mapping
 * @param {Object} mappingLengths - Number of mappings for each type
 * @param {string} localIp - Local IP address
 * @param {boolean} [combineSections=false] - Whether to combine sections
 * @param {boolean} [showCount=false] - Whether to show counts
 * @param {boolean} [useFormattedNumbers=true] - Whether to use formatted numbers
 * @returns {string} Generated YAML configuration
 */
export function generateRecentMediaYaml(
  sections, 
  formatFields, 
  libraryNames, 
  mappingLengths, 
  localIp,
  combineSections = false,
  showCount = false,
  useFormattedNumbers = true
) {
  const yaml = [];
  const valueParam = useFormattedNumbers ? '_formatted' : '';
  
  // Extract and normalize section IDs
  const movieSections = Array.isArray(sections.movies) ? 
    sections.movies.map(extractSectionId) : [];
  
  const showSections = Array.isArray(sections.shows) ? 
    sections.shows.map(extractSectionId) : [];
    
  const musicSections = Array.isArray(sections.music) ? 
    sections.music.map(extractSectionId) : [];
  
  // Log for debugging
  console.log("Normalized section IDs:", { movies: movieSections, shows: showSections, music: musicSections });
  
  if (movieSections.length > 0 || showSections.length > 0 || musicSections.length > 0) {
    if (combineSections) {
      // Combined movies section
      if (movieSections.length > 0) {
        const movieSectionIds = movieSections.join(',');
        
        // Check for additional fields
        let hasAdditionalField = false;
        try {
          hasAdditionalField = movieSections.some(id => {
            const fields = formatFields?.movies?.[id]?.fields;
            return Array.isArray(fields) && fields.some(f => f && f.id === 'additionalfield');
          });
        } catch (e) {
          console.error("Error checking for additional fields:", e);
        }
        
        const mappings = generateMediaMappings(mappingLengths.movies, hasAdditionalField);
        
        let movieYaml = `    - Movies:
        icon: mdi-filmstrip
        id: list
        widgets:
          - type: customapi
            url: http://${localIp}:3010/api/media/recent?type=movies&section=${movieSectionIds}
            method: GET
            display: list
            mappings:
${mappings}`;

        if (showCount) {
          movieYaml += `
          - type: customapi
            url: http://${localIp}:3010/api/media/recent
            method: GET
            display: block
            mappings:
            - field:
                response:
                  libraries:
                    totals:
                      movies: total_items${valueParam}
              format: numbers
              label: Movies`;
        }
        
        yaml.push(movieYaml);
      }

      // Combined shows section
      if (showSections.length > 0) {
        const showSectionIds = showSections.join(',');
        
        // Check for additional fields
        let hasAdditionalField = false;
        try {
          hasAdditionalField = showSections.some(id => {
            const fields = formatFields?.shows?.[id]?.fields;
            return Array.isArray(fields) && fields.some(f => f && f.id === 'additionalfield');
          });
        } catch (e) {
          console.error("Error checking for additional fields:", e);
        }
        
        const mappings = generateMediaMappings(mappingLengths.shows, hasAdditionalField);
        
        let showYaml = `    - TV Shows:
        icon: mdi-television-classic
        id: list
        widgets:
          - type: customapi
            url: http://${localIp}:3010/api/media/recent?type=shows&section=${showSectionIds}
            method: GET
            display: list
            mappings:
${mappings}`;

        if (showCount) {
          showYaml += `
          - type: customapi
            url: http://${localIp}:3010/api/media/recent
            method: GET
            display: block
            mappings:
            - field:
                response:
                  libraries:
                    totals:
                      shows: total_items${valueParam}
              format: numbers
              label: Shows
            - field:
                response:
                  libraries:
                    totals:
                      shows: total_seasons${valueParam}
              format: numbers
              label: Seasons
            - field:
                response:
                  libraries:
                    totals:
                      shows: total_episodes${valueParam}
              format: numbers
              label: Episodes`;
        }
        
        yaml.push(showYaml);
      }
      
      // Combined music section
      if (musicSections.length > 0) {
        const musicSectionIds = musicSections.join(',');
        
        // Check for additional fields
        let hasAdditionalField = false;
        try {
          hasAdditionalField = musicSections.some(id => {
            const fields = formatFields?.music?.[id]?.fields;
            return Array.isArray(fields) && fields.some(f => f && f.id === 'additionalfield');
          });
        } catch (e) {
          console.error("Error checking for additional fields:", e);
        }
        
        const mappings = generateMediaMappings(mappingLengths.music, hasAdditionalField);
        
        let musicYaml = `    - Music:
        icon: mdi-music
        id: list
        widgets:
          - type: customapi
            url: http://${localIp}:3010/api/media/recent?type=music&section=${musicSectionIds}
            method: GET
            display: list
            mappings:
${mappings}`;

        if (showCount) {
          musicYaml += `
          - type: customapi
            url: http://${localIp}:3010/api/media/recent
            method: GET
            display: block
            mappings:
            - field:
                response:
                  libraries:
                    totals:
                      music: total_items${valueParam}
              format: numbers
              label: Artists
            - field:
                response:
                  libraries:
                    totals:
                      music: total_albums${valueParam}
              format: numbers
              label: Albums
            - field:
                response:
                  libraries:
                    totals:
                      music: total_tracks${valueParam}
              format: numbers
              label: Tracks`;
        }
        
        yaml.push(musicYaml);
      }
    } else {
      let sectionIndex = 0;
      // Individual section for each library section
      if (movieSections.length > 0) {
        movieSections.forEach(sectionId => {
          // Get section fields
          let sectionFields = [];
          let hasAdditionalField = false;
          
          try {
            sectionFields = formatFields?.movies?.[sectionId]?.fields || [];
            hasAdditionalField = sectionFields.some(f => f && f.id === 'additionalfield');
          } catch (e) {
            console.error(`Error accessing fields for movie section ${sectionId}:`, e);
          }
          
          // Get section name
          let sectionName = `Movies Section ${sectionId}`;
          try {
            if (libraryNames && (libraryNames[sectionId] || libraryNames[String(sectionId)])) {
              sectionName = libraryNames[sectionId] || libraryNames[String(sectionId)];
            }
          } catch (e) {
            console.error(`Error getting name for section ${sectionId}:`, e);
          }
          
          const mappings = generateMediaMappings(mappingLengths.movies, hasAdditionalField);

          let sectionYaml = `    - ${sectionName}:
        icon: mdi-filmstrip
        id: list
        widgets:
          - type: customapi
            url: http://${localIp}:3010/api/media/recent?type=movies&section=${sectionId}
            method: GET
            display: list
            mappings:
${mappings}`;

          if (showCount) {
            sectionYaml += `
          - type: customapi
            url: http://${localIp}:3010/api/media/recent
            method: GET
            display: block
            mappings:
            - field:
                response:
                  libraries:
                    sections:
                      ${sectionIndex}: count${valueParam}
              format: numbers
              label: Movies`;
          }

          yaml.push(sectionYaml);
          sectionIndex++;
        });
      }

      if (showSections.length > 0) {
        showSections.forEach(sectionId => {
          // Get section fields
          let sectionFields = [];
          let hasAdditionalField = false;
          
          try {
            sectionFields = formatFields?.shows?.[sectionId]?.fields || [];
            hasAdditionalField = sectionFields.some(f => f && f.id === 'additionalfield');
          } catch (e) {
            console.error(`Error accessing fields for show section ${sectionId}:`, e);
          }
          
          // Get section name
          let sectionName = `Shows Section ${sectionId}`;
          try {
            if (libraryNames && (libraryNames[sectionId] || libraryNames[String(sectionId)])) {
              sectionName = libraryNames[sectionId] || libraryNames[String(sectionId)];
            }
          } catch (e) {
            console.error(`Error getting name for section ${sectionId}:`, e);
          }
          
          const mappings = generateMediaMappings(mappingLengths.shows, hasAdditionalField);

          let sectionYaml = `    - ${sectionName}:
        icon: mdi-television-classic
        id: list
        widgets:
          - type: customapi
            url: http://${localIp}:3010/api/media/recent?type=shows&section=${sectionId}
            method: GET
            display: list
            mappings:
${mappings}`;

          if (showCount) {
            sectionYaml += `
          - type: customapi
            url: http://${localIp}:3010/api/media/recent
            method: GET
            display: block
            mappings:
            - field:
                response:
                  libraries:
                    sections:
                      ${sectionIndex}: count${valueParam}
              format: numbers
              label: Shows
            - field:
                response:
                  libraries:
                    sections:
                      ${sectionIndex}: parent_count${valueParam}
              format: numbers
              label: Seasons
            - field:
                response:
                  libraries:
                    sections:
                      ${sectionIndex}: child_count${valueParam}
              format: numbers
              label: Episodes`;
          }

          yaml.push(sectionYaml);
          sectionIndex++;
        });
      }
      
      if (musicSections.length > 0) {
        musicSections.forEach(sectionId => {
          // Get section fields
          let sectionFields = [];
          let hasAdditionalField = false;
          
          try {
            sectionFields = formatFields?.music?.[sectionId]?.fields || [];
            hasAdditionalField = sectionFields.some(f => f && f.id === 'additionalfield');
          } catch (e) {
            console.error(`Error accessing fields for music section ${sectionId}:`, e);
          }
          
          // Get section name
          let sectionName = `Music Section ${sectionId}`;
          try {
            if (libraryNames && (libraryNames[sectionId] || libraryNames[String(sectionId)])) {
              sectionName = libraryNames[sectionId] || libraryNames[String(sectionId)];
            }
          } catch (e) {
            console.error(`Error getting name for section ${sectionId}:`, e);
          }
          
          const mappings = generateMediaMappings(mappingLengths.music, hasAdditionalField);

          let sectionYaml = `    - ${sectionName}:
        icon: mdi-music
        id: list
        widgets:
          - type: customapi
            url: http://${localIp}:3010/api/media/recent?type=music&section=${sectionId}
            method: GET
            display: list
            mappings:
${mappings}`;

          if (showCount) {
            sectionYaml += `
          - type: customapi
            url: http://${localIp}:3010/api/media/recent
            method: GET
            display: block
            mappings:
            - field:
                response:
                  libraries:
                    sections:
                      ${sectionIndex}: count${valueParam}
              format: numbers
              label: Artists
            - field:
                response:
                  libraries:
                    sections:
                      ${sectionIndex}: parent_count${valueParam}
              format: numbers
              label: Albums
            - field:
                response:
                  libraries:
                    sections:
                      ${sectionIndex}: child_count${valueParam}
              format: numbers
              label: Tracks`;
          }

          yaml.push(sectionYaml);
          sectionIndex++;
        });
      }
    }
  }

  return yaml.length > 0 ? `- Recently Added:\n${yaml.join('\n\n')}` : '';
}

/**
 * Generate Media Count YAML configuration for Homepage
 * 
 * @param {Object} sections - Section configuration
 * @param {Object} libraryNames - Library name mapping
 * @param {string} localIp - Local IP address
 * @param {boolean} showIndividualCounts - Whether to show individual counts
 * @param {boolean} useFormattedNumbers - Whether to use formatted numbers
 * @returns {string} Generated YAML configuration
 */
export function generateMediaCountYaml(
  sections, 
  libraryNames, 
  localIp, 
  showIndividualCounts, 
  useFormattedNumbers
) {
  const valueParam = useFormattedNumbers ? '_formatted' : '';
  
  // Extract and normalize section IDs
  const movieSections = Array.isArray(sections.movies) ? 
    sections.movies.map(extractSectionId) : [];
  
  const showSections = Array.isArray(sections.shows) ? 
    sections.shows.map(extractSectionId) : [];
    
  const musicSections = Array.isArray(sections.music) ? 
    sections.music.map(extractSectionId) : [];
  
  if (showIndividualCounts) {
    const yaml = [];

    // Add Movies sections
    if (movieSections.length > 0) {
      movieSections.forEach((sectionId, index) => {
        // Get section name
        let sectionName = `Movies Section ${sectionId}`;
        try {
          if (libraryNames && (libraryNames[sectionId] || libraryNames[String(sectionId)])) {
            sectionName = libraryNames[sectionId] || libraryNames[String(sectionId)];
          }
        } catch (e) {
          console.error(`Error getting name for section ${sectionId}:`, e);
        }
        
        yaml.push(`    - ${sectionName}:
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/media/recent
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   libraries:
                     sections:
                       ${index}: count${valueParam}
               format: numbers
               label: Movies`);
      });
    }

    // Add Shows sections
    if (showSections.length > 0) {
      showSections.forEach((sectionId, index) => {
        // Get section name
        let sectionName = `Shows Section ${sectionId}`;
        try {
          if (libraryNames && (libraryNames[sectionId] || libraryNames[String(sectionId)])) {
            sectionName = libraryNames[sectionId] || libraryNames[String(sectionId)];
          }
        } catch (e) {
          console.error(`Error getting name for section ${sectionId}:`, e);
        }
        
        const showIndex = movieSections.length + index;
        
        yaml.push(`    - ${sectionName}:
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/media/recent
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   libraries:
                     sections:
                       ${showIndex}: count${valueParam}
               format: numbers
               label: Shows
             - field:
                 response:
                   libraries:
                     sections:
                       ${showIndex}: parent_count${valueParam}
               format: numbers
               label: Seasons
             - field:
                 response:
                   libraries:
                     sections:
                       ${showIndex}: child_count${valueParam}
               format: numbers
               label: Episodes`);
      });
    }
    
    // Add Music sections
    if (musicSections.length > 0) {
      musicSections.forEach((sectionId, index) => {
        // Get section name
        let sectionName = `Music Section ${sectionId}`;
        try {
          if (libraryNames && (libraryNames[sectionId] || libraryNames[String(sectionId)])) {
            sectionName = libraryNames[sectionId] || libraryNames[String(sectionId)];
          }
        } catch (e) {
          console.error(`Error getting name for section ${sectionId}:`, e);
        }
        
        const musicIndex = movieSections.length + showSections.length + index;
        
        yaml.push(`    - ${sectionName}:
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/media/recent
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   libraries:
                     sections:
                       ${musicIndex}: count${valueParam}
               format: numbers
               label: Artists
             - field:
                 response:
                   libraries:
                     sections:
                       ${musicIndex}: parent_count${valueParam}
               format: numbers
               label: Albums
             - field:
                 response:
                   libraries:
                     sections:
                       ${musicIndex}: child_count${valueParam}
               format: numbers
               label: Tracks`);
      });
    }

    return `- Media Count:\n${yaml.join('\n\n')}`;
  } else {
    // Return combined totals YAML
    let yaml = `- Media Count:
    - Movies:
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/media/recent
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   libraries:
                     totals:
                       movies: total_items${valueParam}
               format: numbers
               label: Movies

    - Shows:
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/media/recent
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   libraries:
                     totals:
                       shows: total_items${valueParam}
               format: numbers
               label: Shows
             - field:
                 response:
                   libraries:
                     totals:
                       shows: total_seasons${valueParam}
               format: numbers
               label: Seasons
             - field:
                 response:
                   libraries:
                     totals:
                       shows: total_episodes${valueParam}
               format: numbers
               label: Episodes`;
               
    // Add Music section if we have music sections
    if (musicSections.length > 0) {
      yaml += `
        - Music:
             widgets:
               - type: customapi
                 url: http://${localIp}:3010/api/media/recent
                 method: GET
                 display: block
                 mappings:
                 - field:
                     response:
                       libraries:
                         totals:
                           music: total_items${valueParam}
                   format: numbers
                   label: Artists
                 - field:
                     response:
                       libraries:
                         totals:
                           music: total_albums${valueParam}
                   format: numbers
                   label: Albums
                 - field:
                     response:
                       libraries:
                         totals:
                           music: total_tracks${valueParam}
                   format: numbers
                   label: Tracks`;
    }
    
    return yaml;
  }
}