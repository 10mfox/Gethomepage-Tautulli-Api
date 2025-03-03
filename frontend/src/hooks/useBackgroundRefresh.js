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
 * @returns {Object} Hook state and controls
 * @returns {*} returns.data - The fetched data
 * @returns {boolean} returns.loading - Loading state
 * @returns {string|null} returns.error - Error message if any
 * @returns {Date|null} returns.lastUpdated - Timestamp of last successful update
 * @returns {Function} returns.refresh - Function to manually trigger refresh
 */
export const useBackgroundRefresh = (fetchFn, initialInterval = null) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [serverInterval, setServerInterval] = useState(60000); // Default until fetched
  const previousDataRef = useRef(null);
  const intervalRef = useRef(null);
  const fetchingRef = useRef(false);

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
          setServerInterval(config.refreshInterval);
        }
      } catch (err) {
        console.error('Failed to fetch refresh interval', err);
      }
    };
    
    getRefreshInterval();
  }, []);

  // Use initialInterval if provided, otherwise use the server interval
  const effectiveInterval = initialInterval || serverInterval;

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
   * Fetch data and update state
   * 
   * @async
   * @param {boolean} [force=false] - Force update even if data hasn't changed
   */
  const fetch = useCallback(async (force = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    
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
  }, [fetchFn]);

  // Set up initial fetch and interval
  useEffect(() => {
    // Initial fetch
    fetch(true);
    
    console.log(`Setting up refresh interval: ${effectiveInterval}ms`);

    // Set up interval with a reference to prevent stale closures
    const intervalId = setInterval(() => {
      console.log('Background refresh interval triggered');
      fetch(false);
    }, effectiveInterval);

    // Store the interval ID for cleanup
    intervalRef.current = intervalId;

    // Cleanup
    return () => {
      console.log('Cleaning up interval');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetch, effectiveInterval]);

  // Manual refresh function
  const refresh = useCallback(() => {
    console.log('Manual refresh triggered');
    return fetch(true);
  }, [fetch]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh
  };
};