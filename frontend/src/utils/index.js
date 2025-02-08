import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Combine class names with Tailwind
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format duration in seconds to human readable string
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

// Format large numbers with commas
export function formatNumber(num) {
  return new Intl.NumberFormat().format(num || 0);
}

// Format relative time (e.g., "2 hours ago")
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

// Format date to specified format
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

// Debounce function for limiting rate of function calls
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

// Safely fetch data from API with error handling
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

// Parse and validate section IDs from string
export function parseSectionIds(input) {
  return input
    .split(',')
    .map(id => id.trim())
    .filter(id => /^\d+$/.test(id))
    .map(Number);
}

// Create table sort comparator
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