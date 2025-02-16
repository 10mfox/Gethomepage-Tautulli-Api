import { useState, useEffect, useRef, useCallback } from 'react';

export const useBackgroundRefresh = (fetchFn, initialInterval = 60000) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const previousDataRef = useRef(null);
  const intervalRef = useRef(null);
  const fetchingRef = useRef(false);

  const isEqual = (a, b) => {
    if (!a || !b) return false;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch (e) {
      return false;
    }
  };

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