/**
 * Application entry point
 * Renders the main App component to the DOM
 * @module index
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

/**
 * Get the root DOM element
 * @type {HTMLElement}
 */
const container = document.getElementById('root');

/**
 * Create a React root
 * @type {import('react-dom/client').Root}
 */
const root = createRoot(container);

/**
 * Render the App component to the DOM
 */
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);