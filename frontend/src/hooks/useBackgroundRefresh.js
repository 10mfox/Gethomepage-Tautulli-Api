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
 * @param {number} [initialInterval=60000] - Refresh interval in milliseconds
 * @returns {Object} Hook state and controls
 * @returns {*} returns.data - The fetched data
 * @returns {boolean} returns.loading - Loading state
 * @returns {string|null} returns.error - Error message if any
 * @returns {Date|null} returns.lastUpdated - Timestamp of last successful update
 * @returns {Function} returns.refresh - Function to manually trigger refresh
 */
export const useBackgroundRefresh = (fetchFn, initialInterval = 60000) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const previousDataRef = useRef(null);
  const intervalRef = useRef(null);
  const fetchingRef = useRef(false);

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
      const result = await fetchFn();
      
      // Only update if data has changed or force refresh
      if (!isEqual(result, previousDataRef.current) || force) {
        setData(result);
        previousDataRef.current = result;
        setLastUpdated(new Date());
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

    // Set up interval
    intervalRef.current = setInterval(() => {
      fetch(false);
    }, initialInterval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetch, initialInterval]);

  // Manual refresh function
  const refresh = useCallback(() => fetch(true), [fetch]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh
  };
};