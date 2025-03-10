/**
 * Custom hook for background data fetching with automatic refresh
 * Provides loading state, error handling, and manual refresh capability
 * @module hooks/useBackgroundRefresh
 */
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for fetching data with periodic background refresh
 * 
 * @param {Function} fetchFn - Async function to fetch data
 * @param {number} [initialInterval=null] - Refresh interval in milliseconds (optional override)
 * @param {boolean} [isUserData=false] - Flag to indicate if this is user data (for special handling)
 * @returns {Object} Hook state and controls
 * @returns {*} returns.data - The fetched data
 * @returns {boolean} returns.loading - Loading state
 * @returns {string|null} returns.error - Error message if any
 * @returns {Date|null} returns.lastUpdated - Timestamp of last successful update
 * @returns {Function} returns.refresh - Function to manually trigger refresh
 */
export const useBackgroundRefresh = (fetchFn, initialInterval = null, isUserData = false) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [serverInterval, setServerInterval] = useState(60000); // Default 60 seconds
  const previousDataRef = useRef(null);
  const intervalRef = useRef(null);
  const fetchingRef = useRef(false);
  const requestCountRef = useRef(0);
  const lastRequestTimeRef = useRef(Date.now());

  // Fetch server refresh interval on hook initialization
  useEffect(() => {
    const getRefreshInterval = async () => {
      try {
        const response = await fetch('/api/config', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        const config = await response.json();
        if (config.refreshInterval) {
          console.log(`Server configured refresh interval: ${config.refreshInterval}ms`);
          // Always use 60 seconds regardless of server config
          setServerInterval(60000);
          console.log('Overriding with 60 seconds for all data');
        }
      } catch (err) {
        console.error('Failed to fetch refresh interval', err);
        // Default to 60 seconds on error
        setServerInterval(60000);
      }
    };
    
    getRefreshInterval();
  }, []);

  // Use 60 seconds for all data types
  const effectiveInterval = 60000;

  /**
   * Check if two data objects are equal
   * 
   * @param {*} a - First data object
   * @param {*} b - Second data object
   * @returns {boolean} True if equal, false otherwise
   */
  const isEqual = (a, b) => {
    if (!a || !b) return false;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
      return false;
    }
  };

  /**
   * Implements request throttling to prevent excessive API requests
   * No more than 10 requests per minute
   * 
   * @returns {boolean} True if request should proceed, false if throttled
   */
  const shouldThrottleRequest = () => {
    // Don't throttle user data requests - they're high priority
    if (isUserData) return false;
    
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Reset counter if more than a minute has passed
    if (lastRequestTimeRef.current < oneMinuteAgo) {
      requestCountRef.current = 0;
      lastRequestTimeRef.current = now;
      return false;
    }
    
    // If we've made 10 or more requests in the last minute, throttle
    if (requestCountRef.current >= 10) {
      console.log('Throttling request due to rate limit');
      return true;
    }
    
    // Otherwise increment counter and allow
    requestCountRef.current++;
    return false;
  };

  /**
   * Fetch data and update state
   * 
   * @async
   * @param {boolean} [force=false] - Force update even if data hasn't changed
   */
  const fetch = useCallback(async (force = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    
    // Apply rate limiting (except for user data)
    if (!isUserData && shouldThrottleRequest()) return;
    
    try {
      fetchingRef.current = true;
      console.log('Fetching data...');
      const result = await fetchFn();
      
      // Only update if data has changed or force refresh
      if (!isEqual(result, previousDataRef.current) || force) {
        console.log('Data changed, updating state');
        setData(result);
        previousDataRef.current = result;
        setLastUpdated(new Date());
      } else {
        console.log('No data changes detected');
      }
      
      setError(null);
    } catch (err) {
      console.error('Background refresh error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [fetchFn, isUserData]);

  // Set up initial fetch and interval
  useEffect(() => {
    // Initial fetch
    fetch(true);
    
    console.log(`Setting up refresh interval: ${effectiveInterval}ms${isUserData ? ' (user data)' : ''}`);

    // Set up interval with a reference to prevent stale closures
    const intervalId = setInterval(() => {
      // Only trigger refresh if document is visible to save resources
      if (document.visibilityState === 'visible') {
        console.log(`Background refresh interval triggered${isUserData ? ' for user data' : ''}`);
        fetch(false);
      } else {
        console.log(`Skipping refresh - page not visible${isUserData ? ' (user data)' : ''}`);
      }
    }, effectiveInterval);

    // Store the interval ID for cleanup
    intervalRef.current = intervalId;

    // Cleanup
    return () => {
      console.log(`Cleaning up interval${isUserData ? ' for user data' : ''}`);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetch, effectiveInterval, isUserData]);

  // Set up visibility change handler to refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceUpdate = lastUpdated ? Date.now() - lastUpdated.getTime() : Infinity;
        
        // For all data types, refresh if it's been more than 15 seconds
        const stalePeriod = 15000;
        
        if (timeSinceUpdate > stalePeriod) {
          console.log(`Tab became visible with stale data${isUserData ? ' (user data)' : ''}, refreshing`);
          fetch(false);
        } else {
          console.log(`Tab became visible but data is fresh${isUserData ? ' (user data)' : ''}, not refreshing yet`);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetch, lastUpdated, isUserData]);

  // Manual refresh function
  const refresh = useCallback(() => {
    console.log(`Manual refresh triggered${isUserData ? ' for user data' : ''}`);
    return fetch(true);
  }, [fetch, isUserData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh
  };
};