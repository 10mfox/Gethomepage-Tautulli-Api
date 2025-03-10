/**
 * Custom hook for shared data management across components
 * Implements efficient data sharing with centralized fetching
 * @module hooks/useSharedData
 */
import { useState, useEffect, useCallback } from 'react';

// Global store for shared data
const dataStore = {
  users: { data: null, timestamp: 0, listeners: [], loading: false, error: null },
  media: { data: null, timestamp: 0, listeners: [], loading: false, error: null },
  libraries: { data: null, timestamp: 0, listeners: [], loading: false, error: null }
};

// Function to notify all listeners when data changes
function notifyListeners(dataType, updates) {
  const store = dataStore[dataType];
  
  // Update the store
  Object.assign(store, updates);
  
  // Notify all listeners
  store.listeners.forEach(listener => listener(updates));
}

// Fetch functions for each data type
const fetchers = {
  users: async () => {
    try {
      // Mark as loading
      notifyListeners('users', { loading: true, error: null });
      
      const response = await fetch('/api/users', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Update store and notify listeners
      notifyListeners('users', { 
        data: data.response?.data || [], 
        loading: false,
        timestamp: Date.now()
      });
      
      return data.response?.data || [];
    } catch (error) {
      console.error('Error fetching users:', error);
      notifyListeners('users', { loading: false, error: error.message });
      return dataStore.users.data || []; // Return existing data on error
    }
  },
  
  media: async () => {
    try {
      // Mark as loading
      notifyListeners('media', { loading: true, error: null });
      
      const response = await fetch('/api/media/recent', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch media: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Update store and notify listeners
      notifyListeners('media', { 
        data: data.response?.data || [], 
        loading: false,
        timestamp: Date.now()
      });
      
      return data.response?.data || [];
    } catch (error) {
      console.error('Error fetching media:', error);
      notifyListeners('media', { loading: false, error: error.message });
      return dataStore.media.data || []; // Return existing data on error
    }
  },
  
  libraries: async () => {
    try {
      // Mark as loading
      notifyListeners('libraries', { loading: true, error: null });
      
      const response = await fetch('/api/media/recent', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch libraries: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const libraryData = data.response?.libraries || { sections: [], totals: {} };
      
      // Update store and notify listeners
      notifyListeners('libraries', { 
        data: libraryData, 
        loading: false,
        timestamp: Date.now()
      });
      
      return libraryData;
    } catch (error) {
      console.error('Error fetching libraries:', error);
      notifyListeners('libraries', { loading: false, error: error.message });
      return dataStore.libraries.data || { sections: [], totals: {} }; // Return existing data on error
    }
  }
};

// Set up staggered refresh intervals
let userRefreshTimer = null;
let mediaRefreshTimer = null;
let libraryRefreshTimer = null;

function setupRefreshTimers() {
  // Clear any existing timers
  if (userRefreshTimer) clearInterval(userRefreshTimer);
  if (mediaRefreshTimer) clearInterval(mediaRefreshTimer);
  if (libraryRefreshTimer) clearInterval(libraryRefreshTimer);
  
  // Setup user data refresh - every 60 seconds
  userRefreshTimer = setInterval(() => {
    if (dataStore.users.listeners.length > 0 && document.visibilityState === 'visible') {
      console.log('Refreshing shared user data');
      fetchers.users();
    }
  }, 60000);
  
  // Setup media data refresh - every 60 seconds, offset by 20 seconds
  setTimeout(() => {
    mediaRefreshTimer = setInterval(() => {
      if (dataStore.media.listeners.length > 0 && document.visibilityState === 'visible') {
        console.log('Refreshing shared media data');
        fetchers.media();
      }
    }, 60000);
  }, 20000);
  
  // Setup library data refresh - every 60 seconds, offset by 40 seconds
  setTimeout(() => {
    libraryRefreshTimer = setInterval(() => {
      if (dataStore.libraries.listeners.length > 0 && document.visibilityState === 'visible') {
        console.log('Refreshing shared library data');
        fetchers.libraries();
      }
    }, 60000);
  }, 40000);
  
  // Handle visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    clearInterval(userRefreshTimer);
    clearInterval(mediaRefreshTimer);
    clearInterval(libraryRefreshTimer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

// Handle tab visibility changes
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    // Check if data is stale (older than 15 seconds)
    const now = Date.now();
    
    // Refresh user data if stale and has listeners
    if (dataStore.users.listeners.length > 0 && 
        (!dataStore.users.timestamp || now - dataStore.users.timestamp > 15000)) {
      console.log('Tab visible, refreshing stale user data');
      fetchers.users();
    }
    
    // Refresh media data if stale and has listeners
    if (dataStore.media.listeners.length > 0 && 
        (!dataStore.media.timestamp || now - dataStore.media.timestamp > 15000)) {
      console.log('Tab visible, refreshing stale media data');
      fetchers.media();
    }
    
    // Refresh library data if stale and has listeners
    if (dataStore.libraries.listeners.length > 0 && 
        (!dataStore.libraries.timestamp || now - dataStore.libraries.timestamp > 15000)) {
      console.log('Tab visible, refreshing stale library data');
      fetchers.libraries();
    }
  }
}

// Initialize timers
setupRefreshTimers();

/**
 * Custom hook to use shared data
 * 
 * @param {string} dataType - Type of data to use (users, media, libraries)
 * @returns {Object} Data state and controls
 * @returns {*} returns.data - The shared data
 * @returns {boolean} returns.loading - Loading state
 * @returns {string|null} returns.error - Error message if any
 * @returns {Function} returns.refresh - Function to manually refresh data
 */
export function useSharedData(dataType) {
  // Validate data type
  if (!dataStore[dataType]) {
    throw new Error(`Invalid data type: ${dataType}. Must be one of: users, media, libraries`);
  }
  
  // Initialize local state from the data store
  const [state, setState] = useState({
    data: dataStore[dataType].data,
    loading: dataStore[dataType].loading || !dataStore[dataType].data,
    error: dataStore[dataType].error
  });
  
  // Handle updates from the data store
  const handleUpdate = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);
  
  // Register as a listener when the component mounts
  useEffect(() => {
    dataStore[dataType].listeners.push(handleUpdate);
    
    // Initial data fetch if needed
    if (!dataStore[dataType].data && !dataStore[dataType].loading) {
      console.log(`Initial fetch for ${dataType} data`);
      fetchers[dataType]();
    }
    
    // Cleanup: remove the listener when the component unmounts
    return () => {
      const index = dataStore[dataType].listeners.indexOf(handleUpdate);
      if (index !== -1) {
        dataStore[dataType].listeners.splice(index, 1);
      }
    };
  }, [dataType, handleUpdate]);
  
  // Manual refresh function
  const refresh = useCallback(() => {
    console.log(`Manual refresh for ${dataType} data`);
    return fetchers[dataType]();
  }, [dataType]);
  
  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    refresh
  };
}

/**
 * Get the number of components using a specific data type
 * 
 * @param {string} dataType - Type of data (users, media, libraries)
 * @returns {number} Number of listeners
 */
export function getListenerCount(dataType) {
  return dataStore[dataType]?.listeners.length || 0;
}

/**
 * Stop all refresh timers (useful for cleanup)
 */
export function stopAllRefreshes() {
  if (userRefreshTimer) clearInterval(userRefreshTimer);
  if (mediaRefreshTimer) clearInterval(mediaRefreshTimer);
  if (libraryRefreshTimer) clearInterval(libraryRefreshTimer);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  console.log('All shared data refresh timers stopped');
}