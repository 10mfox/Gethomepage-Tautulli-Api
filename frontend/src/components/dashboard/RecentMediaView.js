/**
 * Recent Media dashboard component with section-based layout and vertical poster cards
 * Displays recently added media items grouped by library section
 * @module components/dashboard/RecentMediaView
 */
import React, { useState, useMemo, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useBackgroundRefresh } from '../../hooks/useBackgroundRefresh';

/**
 * Maximum number of results to display per section
 * @type {number}
 */
const RESULTS_PER_SECTION = 15;

/**
 * Individual media item component with vertical poster layout
 * 
 * @param {Object} props - Component props
 * @param {Object} props.item - Media item data
 * @param {string} props.tautulliBaseUrl - Tautulli server base URL
 * @returns {JSX.Element} Rendered component
 */
const MediaItem = React.memo(({ item, tautulliBaseUrl }) => {
  // Construct thumbnail URL using the Tautulli image proxy format
  let posterUrl = '/static/poster-placeholder.jpg';
  
  if (item.ratingKey && tautulliBaseUrl) {
    posterUrl = `${tautulliBaseUrl}/pms_image_proxy?img=/library/metadata/${item.ratingKey}/thumb`;
  }
  
  // Extract year from item data if available
  const year = item.additionalfield?.match(/\d{4}/) || item.field?.match(/\((\d{4})\)/)?.at(1) || '';
  
  // Format for duration or runtime
  const duration = item.additionalfield?.includes('min') ? 
    item.additionalfield.match(/\d+min/) : '';

  return (
    <div className="dark-panel flex flex-col overflow-hidden h-full">
      {/* Poster Image */}
      <div className="relative w-full aspect-[2/3] bg-black/40 overflow-hidden group">
        <img 
          src={posterUrl} 
          alt={item.field || 'Media poster'} 
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = '/static/poster-placeholder.jpg' }}
        />
        {item.added_at_relative && (
          <div className="absolute top-2 right-2 bg-black/70 text-xs text-theme-accent px-2 py-1 rounded-full">
            {item.added_at_relative}
          </div>
        )}
      </div>
      
      {/* Content Details */}
      <div className="p-3 flex flex-col flex-grow">
        <div className="text-white font-medium text-sm line-clamp-2 mb-1">
          {item.field || 'Untitled'}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {year && <span>{year}</span>}
          {duration && <span>{duration}</span>}
        </div>
      </div>
    </div>
  );
});

/**
 * Section component to display media items from a specific library section
 * 
 * @param {Object} props - Component props
 * @param {string} props.title - Section title
 * @param {string} props.subtitle - Section subtitle (e.g., "Movie" or "Show")
 * @param {Array} props.items - Media items to display
 * @param {string} props.tautulliBaseUrl - Tautulli server base URL
 * @returns {JSX.Element} Rendered component
 */
const MediaSection = ({ title, subtitle, items, tautulliBaseUrl }) => {
  if (!items || items.length === 0) return null;
  
  return (
    <div className="space-y-4">
      <div className="flex items-baseline">
        <h3 className="text-lg font-medium text-white">{title}</h3>
        {subtitle && (
          <span className="ml-2 text-sm text-gray-400">{subtitle}</span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item, index) => (
          <MediaItem 
            key={`${item.section_id}-${index}`} 
            item={item} 
            tautulliBaseUrl={tautulliBaseUrl}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Recent Media dashboard component with section-based layout
 * 
 * @returns {JSX.Element} Rendered component
 */
const RecentMediaView = () => {
  /**
   * Selected media type filter state
   * @type {[string|null, Function]}
   */
  const [type, setType] = useState(null);
  
  /**
   * Tautulli base URL for image proxy
   * @type {[string, Function]}
   */
  const [tautulliBaseUrl, setTautulliBaseUrl] = useState('');

  /**
   * Fetch configuration when component mounts
   */
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        setTautulliBaseUrl(data.baseUrl || '');
      } catch (error) {
        console.error('Error fetching configuration:', error);
      }
    };
    
    fetchConfig();
  }, []);

  /**
   * Fetches recent media data from the API
   * 
   * @async
   * @returns {Promise<Object>} Recent media data
   * @throws {Error} If fetch fails
   */
  const fetchMedia = async () => {
    try {
      const url = new URL('/api/media/recent', window.location.origin);
      if (type) {
        url.searchParams.append('type', type);
      }
      url.searchParams.append('count', RESULTS_PER_SECTION);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch media');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching media:', error);
      throw new Error('Failed to load recent media');
    }
  };

  /**
   * Background refresh hook for media data
   */
  const { 
    data: mediaData, 
    loading, 
    error, 
    refresh 
  } = useBackgroundRefresh(fetchMedia, 300000); // 5 minute refresh interval

  /**
   * Map of library section IDs to names
   */
  const libraryNames = useMemo(() => {
    if (!mediaData?.response?.libraries?.sections) return {};
    return mediaData.response.libraries.sections.reduce((acc, section) => {
      acc[section.section_id] = section.section_name;
      return acc;
    }, {});
  }, [mediaData]);

  /**
   * Group media items by type and section
   */
  const groupedItems = useMemo(() => {
    if (!mediaData?.response?.data) return { movies: {}, shows: {} };
    
    return mediaData.response.data.reduce((acc, item) => {
      const mediaType = item.media_type === 'movies' ? 'movies' : 'shows';
      const sectionName = libraryNames[item.section_id] || `Section ${item.section_id}`;
      
      if (!acc[mediaType]) {
        acc[mediaType] = {};
      }
      
      if (!acc[mediaType][sectionName]) {
        acc[mediaType][sectionName] = [];
      }
      
      acc[mediaType][sectionName].push(item);
      return acc;
    }, { movies: {}, shows: {} });
  }, [mediaData, libraryNames]);

  return (
    <div className="section-spacing">
      <div className="dark-panel mb-6">
        <div className="p-4 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setType(null)}
              className={!type ? 'btn-primary' : 'btn-secondary'}
            >
              All
            </button>
            <button
              onClick={() => setType('movies')}
              className={type === 'movies' ? 'btn-primary' : 'btn-secondary'}
            >
              Movies
            </button>
            <button
              onClick={() => setType('shows')}
              className={type === 'shows' ? 'btn-primary' : 'btn-secondary'}
            >
              TV Shows
            </button>
          </div>
          <button
            onClick={refresh}
            className="btn-primary !px-3"
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="ml-2">Refresh</span>
          </button>
        </div>
      </div>

      {loading && !mediaData ? (
        <div className="dark-panel p-8 flex justify-center items-center">
          <div className="loading-spinner" />
        </div>
      ) : error ? (
        <div className="dark-panel p-8 text-center text-red-400">{error}</div>
      ) : Object.keys(groupedItems.movies).length === 0 && Object.keys(groupedItems.shows).length === 0 ? (
        <div className="dark-panel p-8 text-center text-gray-400">
          No recent media found
        </div>
      ) : (
        <div className="space-y-8">
          {/* Movies Sections */}
          {(type === null || type === 'movies') && Object.keys(groupedItems.movies).length > 0 && (
            <div className="space-y-8">
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2">Movies</h2>
              {Object.entries(groupedItems.movies).map(([sectionName, items]) => (
                <MediaSection 
                  key={`movies-${sectionName}`}
                  title={sectionName}
                  subtitle="Movie"
                  items={items}
                  tautulliBaseUrl={tautulliBaseUrl}
                />
              ))}
            </div>
          )}
          
          {/* TV Shows Sections */}
          {(type === null || type === 'shows') && Object.keys(groupedItems.shows).length > 0 && (
            <div className="space-y-8">
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2">TV Shows</h2>
              {Object.entries(groupedItems.shows).map(([sectionName, items]) => (
                <MediaSection 
                  key={`shows-${sectionName}`}
                  title={sectionName}
                  subtitle="Show"
                  items={items}
                  tautulliBaseUrl={tautulliBaseUrl}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecentMediaView;