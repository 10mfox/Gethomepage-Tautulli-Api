/**
 * Logger module for application-wide logging with color support
 * Provides formatted console output for various log types
 * @module logger
 */

/**
 * ANSI color and style codes for console output
 * @type {Object.<string, string>}
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  
  // Regular colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Bright colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background colors
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m'
};

/**
 * Gets current timestamp with color formatting
 * 
 * @returns {string} Colored timestamp string
 */
function getColoredTimestamp() {
  const timestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(',', '');

  return `${colors.brightYellow}${timestamp}${colors.reset}`;
}

/**
 * Logs a message to the console with timestamp
 * 
 * @param {string} message - Message to log
 */
function log(message) {
  console.log(`${getColoredTimestamp()} ${message}`);
}

/**
 * ASCII art banner for server startup
 * @type {string}
 */
const banner = `
${colors.brightYellow}${colors.bright}╔════════════════════════════════════════════╗${colors.reset}
${colors.brightYellow}${colors.bright}║${colors.brightWhite}            TAUTULLI API MANAGER            ${colors.brightYellow}║${colors.reset}
${colors.brightYellow}${colors.bright}║${colors.yellow}             Made by ${colors.brightWhite}🔥  Olaf 🔥${colors.yellow}              ${colors.brightYellow}║${colors.reset}
${colors.brightYellow}${colors.bright}╚════════════════════════════════════════════╝${colors.reset}
`;

/**
 * Logs server start with configuration details
 * 
 * @param {number} port - Server port
 * @param {Object} config - Server configuration
 */
function logServerStart(port, config) {
  // Configuration loaded message
  log(`${colors.brightYellow}✓${colors.reset} ${colors.brightWhite}Loaded configuration${colors.reset}`);
  log('');
  
  // Title Banner
  console.log(banner);
  log('');
}

/**
 * Logs error with context
 * 
 * @param {string} context - Error context description
 * @param {Error|Object} error - Error object or message
 */
function logError(context, error) {
  log(`${colors.brightRed}${colors.bright}ERROR: ${context}${colors.reset}`);
  log(`${colors.dim}${error.message}${colors.reset}`);
}

/**
 * Logs HTTP request with timing information
 * Skips logging for static files, favicon, and API calls
 * 
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {number} status - HTTP status code
 * @param {number} duration - Request duration in ms
 */
function logRequest(method, path, status, duration) {
  // Skip logging for static files, favicon, and API calls
  if (path.startsWith('/static/') || path.includes('favicon') || path.startsWith('/api/')) return;
  
  const statusColor = status >= 500 ? colors.brightRed : status >= 400 ? colors.brightYellow : colors.yellow;
  const methodColor = {
    GET: colors.yellow,
    POST: colors.brightYellow,
    PUT: colors.yellow,
    DELETE: colors.brightRed
  }[method] || colors.brightWhite;

  log(`${methodColor}${method}${colors.reset} ${colors.brightWhite}${path}${colors.reset} ${statusColor}${status}${colors.reset} ${colors.dim}${duration}ms${colors.reset}`);
}

module.exports = {
  logServerStart,
  logError,
  logRequest,
  log,
  colors
};