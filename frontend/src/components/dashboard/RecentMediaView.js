/**
 * Recent Media dashboard component with section-based layout and vertical poster cards
 * Displays recently added media items grouped by library section
 * @module components/dashboard/RecentMediaView
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Film, Tv, Music, RefreshCw } from 'lucide-react';

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
  
  // Determine if this is a music item
  const isMusicItem = item.media_type === 'music' || item.media_type === 'album';
  
  // Extract title/artist information
  let title, subtitle;
  if (isMusicItem) {
    // For music, split "Artist - Album" format
    const parts = item.field?.split(' - ');
    title = parts?.[1] || item.field || 'Unknown Album'; // Album name as primary title
    subtitle = parts?.[0] || 'Unknown Artist'; // Artist name as subtitle
  } else {
    // For movies/shows, use the field directly
    title = item.field || 'Untitled';
    
    // Extract year from item data if available
    subtitle = item.additionalfield?.match(/\d{4}/) || item.field?.match(/\((\d{4})\)/)?.at(1) || '';
    
    // Add duration if available
    const duration = item.additionalfield?.includes('min') ? 
      item.additionalfield.match(/\d+min/) : '';
      
    if (duration && subtitle) {
      subtitle = `${subtitle} • ${duration}`;
    } else if (duration) {
      subtitle = duration;
    }
  }

  return (
    <div className="dark-panel flex flex-col overflow-hidden h-full">
      {/* Poster Image - use square aspect ratio for music, 2:3 for movies/shows */}
      <div className={`relative w-full ${isMusicItem ? 'aspect-square' : 'aspect-[2/3]'} bg-black/40 overflow-hidden group`}>
        <img 
          src={posterUrl} 
          alt={title} 
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = '/static/poster-placeholder.jpg' }}
        />
        {item.added_at_relative && (
          <div className="absolute top-2 right-2 bg-black/70 text-xs text-theme-accent px-2 py-1 rounded-full">
            {item.added_at_relative}
          </div>
        )}
      </div>
      
      {/* Content Details - Standardized for all media types */}
      <div className="p-3 flex flex-col flex-grow">
        <div className="text-white font-medium text-sm line-clamp-2 mb-1">
          {title}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {isMusicItem ? (
            <span className="text-theme-accent">{subtitle}</span>
          ) : (
            <span>{subtitle}</span>
          )}
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
            key={`${item.section_id}-${item.added_at}-${index}`}
            item={item} 
            tautulliBaseUrl={tautulliBaseUrl}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Helper function to generate a unique ID for media data to detect changes
 * 
 * @param {Array} mediaData - Media data to create fingerprint from
 * @returns {string} Unique fingerprint string
 */
function createMediaFingerprint(mediaData) {
  if (!mediaData?.response?.data || !Array.isArray(mediaData.response.data)) {
    return 'empty';
  }
  
  // Create a fingerprint based on item IDs, add times, and lengths
  const mediaItems = mediaData.response.data;
  const itemCount = mediaItems.length;
  
  // Get the most recent 5 items (or fewer if there aren't enough)
  const recentItems = mediaItems.slice(0, 5);
  
  // Create strings from key properties to detect additions/removals
  const idString = recentItems.map(item => `${item.section_id}-${item.added_at}`).join(',');
  
  return `count:${itemCount}|ids:${idString}`;
}

/**
 * Recent Media dashboard component with section-based layout and optimized refresh
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
   * Media data state
   * @type {[Object|null, Function]} 
   */
  const [mediaData, setMediaData] = useState(null);
  
  /**
   * Loading state
   * @type {[boolean, Function]}
   */
  const [loading, setLoading] = useState(true);
  
  /**
   * Error state
   * @type {[string|null, Function]}
   */
  const [error, setError] = useState(null);
  
  /**
   * Tautulli base URL for image proxy
   * @type {[string, Function]}
   */
  const [tautulliBaseUrl, setTautulliBaseUrl] = useState('');
  
  /**
   * Timestamp of last data update
   * @type {React.MutableRefObject<number>}
   */
  const lastUpdatedRef = useRef(0);
  
  /**
   * Timer reference for refresh interval
   * @type {React.MutableRefObject<NodeJS.Timeout|null>}
   */
  const timerRef = useRef(null);
  
  /**
   * Flag to check if component is mounted
   * @type {React.MutableRefObject<boolean>}
   */
  const isMountedRef = useRef(true);
  
  /**
   * Flag to check if data is being fetched
   * @type {React.MutableRefObject<boolean>}
   */
  const isFetchingRef = useRef(false);
  
  /**
   * Previous type value to detect changes
   * @type {React.MutableRefObject<string|null>}
   */
  const prevTypeRef = useRef(type);
  
  /**
   * Stores the previous media data fingerprint to detect changes
   * @type {React.MutableRefObject<string>}
   */
  const dataFingerprintRef = useRef('');

  /**
   * Set up cleanup on component unmount
   */
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  /**
   * Fetch configuration when component mounts
   */
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        const data = await response.json();
        if (isMountedRef.current) {
          setTautulliBaseUrl(data.baseUrl || '');
        }
      } catch (error) {
        console.error('Error fetching configuration:', error);
      }
    };
    
    fetchConfig();
  }, []);

  /**
   * Fetches recent media data from the API with conditional request support
   * 
   * @async
   * @param {boolean} forceRefresh - Whether to force a full refresh
   * @returns {Promise<void>}
   */
  const fetchMedia = async (forceRefresh = false) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    try {
      // Calculate if we need a full refresh or can use a conditional request
      const typeChanged = type !== prevTypeRef.current;
      
      prevTypeRef.current = type;
      
      // Set up headers for conditional request
      const headers = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      console.log(`Fetching media data (${forceRefresh || typeChanged ? 'full refresh' : 'conditional'})...`);
      
      // Only show loading indicator on first load or type change
      if (mediaData === null || typeChanged) {
        setLoading(true);
      }
      
      const url = new URL('/api/media/recent', window.location.origin);
      if (type) {
        url.searchParams.append('type', type);
      }
      url.searchParams.append('count', RESULTS_PER_SECTION);
      
      // Add a timestamp parameter to prevent browser caching
      url.searchParams.append('_t', Date.now());

      const response = await fetch(url.toString(), { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch media');
      }
      
      const data = await response.json();
      
      // Create a fingerprint of the new data to detect actual changes
      const newFingerprint = createMediaFingerprint(data);
      const hasChanged = newFingerprint !== dataFingerprintRef.current;
      
      // Only update state if the data has actually changed or forced
      if (hasChanged || forceRefresh || !mediaData) {
        console.log('Media data has changed, updating view');
        
        // Update the fingerprint reference
        dataFingerprintRef.current = newFingerprint;
        
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setMediaData(data);
          setError(null);
          setLoading(false);
          
          // Update last updated timestamp
          lastUpdatedRef.current = Date.now();
          
          console.log(`Fetched ${data?.response?.data?.length || 0} media items`);
        }
      } else {
        console.log('Media data unchanged, skipping update');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching media:', error);
      if (isMountedRef.current) {
        setError(error.message || 'Failed to load media data');
        setLoading(false);
      }
    } finally {
      isFetchingRef.current = false;
    }
  };

  /**
   * Set up visibility-based refreshing
   * Only refresh when the tab is visible and on a reasonable schedule
   */
  useEffect(() => {
    console.log(`Setting up optimized refresh strategy for media (30 seconds)`);
    
    // Force refresh immediately on mount
    fetchMedia(true);
    
    // Set up a timer with 30 seconds for media updates 
    // More frequent than before to catch library changes sooner
    timerRef.current = setInterval(() => {
      // Only refresh if the page is visible to the user
      if (document.visibilityState === 'visible') {
        console.log('Media data scheduled refresh - page is visible');
        fetchMedia(false); // Allow change detection
      } else {
        console.log('Skipping media refresh - page not visible');
      }
    }, 30000); // Refresh every 30 seconds when visible
    
    // Add visibility change listener to refresh when user returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, refreshing media data immediately');
        fetchMedia(true); // Force refresh
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      console.log('Cleaning up media refresh timers');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Intentionally empty dependency array - we want this to run once

  /**
   * Refresh when type filter changes
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (type !== prevTypeRef.current) {
        console.log(`Media type filter changed to: ${type || 'all'}`);
        fetchMedia(true); // Force refresh on type change
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [type]);

  /**
   * Group media items by type and section
   */
  const groupedItems = useMemo(() => {
    if (!mediaData?.response?.data) return { movies: {}, shows: {}, music: {} };
    
    return mediaData.response.data.reduce((acc, item) => {
      const mediaType = item.media_type;
      const sectionName = mediaData.response.libraries?.sections?.find(
        section => section.section_id === item.section_id
      )?.section_name || `Section ${item.section_id}`;
      
      if (!acc[mediaType]) {
        acc[mediaType] = {};
      }
      
      if (!acc[mediaType][sectionName]) {
        acc[mediaType][sectionName] = [];
      }
      
      acc[mediaType][sectionName].push(item);
      return acc;
    }, { movies: {}, shows: {}, music: {} });
  }, [mediaData]);

  /**
   * Force a manual refresh of the data
   */
  const handleManualRefresh = () => {
    console.log('Manual refresh requested');
    fetchMedia(true); // Force full refresh
  };

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
              <Film className="h-4 w-4 mr-1" />
              Movies
            </button>
            <button
              onClick={() => setType('shows')}
              className={type === 'shows' ? 'btn-primary' : 'btn-secondary'}
            >
              <Tv className="h-4 w-4 mr-1" />
              TV Shows
            </button>
            <button
              onClick={() => setType('music')}
              className={type === 'music' ? 'btn-primary' : 'btn-secondary'}
            >
              <Music className="h-4 w-4 mr-1" />
              Music
            </button>
          </div>
          <div className="flex items-center">
            <div className="text-xs text-gray-400 mr-2">
              Updates every 30 seconds
            </div>
            <button 
              onClick={handleManualRefresh}
              className="btn-secondary !py-1 !px-2"
              title="Refresh now"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {loading && !mediaData ? (
        <div className="dark-panel p-8 flex justify-center items-center">
          <div className="loading-spinner" />
        </div>
      ) : error ? (
        <div className="dark-panel p-8 text-center text-red-400">{error}</div>
      ) : Object.keys(groupedItems.movies).length === 0 && 
          Object.keys(groupedItems.shows).length === 0 && 
          Object.keys(groupedItems.music).length === 0 ? (
        <div className="dark-panel p-8 text-center text-gray-400">
          No recent media found
        </div>
      ) : (
        <div className="space-y-8">
          {/* Movies Sections */}
          {(type === null || type === 'movies') && Object.keys(groupedItems.movies).length > 0 && (
            <div className="space-y-8">
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 flex items-center">
                <Film className="h-5 w-5 mr-2 text-theme-accent" />
                Movies
              </h2>
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
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 flex items-center">
                <Tv className="h-5 w-5 mr-2 text-theme-accent" />
                TV Shows
              </h2>
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
          
          {/* Music Sections */}
          {(type === null || type === 'music') && Object.keys(groupedItems.music).length > 0 && (
            <div className="space-y-8">
              <h2 className="text-xl font-semibold text-white border-b border-white/10 pb-2 flex items-center">
                <Music className="h-5 w-5 mr-2 text-theme-accent" />
                Music
              </h2>
              {Object.entries(groupedItems.music).map(([sectionName, items]) => (
                <MediaSection 
                  key={`music-${sectionName}`}
                  title={sectionName}
                  subtitle="Music"
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