# Build stage
FROM node:18-alpine AS builder

# Important: Do NOT set NODE_ENV=production for the build stage
# We need development dependencies to build the React app

WORKDIR /app

# Copy dependency files first for better caching
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install all dependencies (including dev dependencies)
RUN npm install
RUN cd frontend && npm install

# Copy source files
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Production stage
FROM node:18-alpine

# Set production environment for the final image
ENV NODE_ENV=production

# Set application-specific environment variables
ENV TAUTULLI_CUSTOM_PORT=3010
ENV TAUTULLI_REFRESH_INTERVAL=60000
ENV NODE_OPTIONS="--max-old-space-size=256"

WORKDIR /app

# Install tini for better process management and curl for health checks
RUN apk add --no-cache tini curl

# Copy package files and install ONLY production dependencies
COPY package*.json ./
RUN npm install --production --silent

# Create app directory and config directory with proper permissions
RUN mkdir -p /app/config && chown -R node:node /app

# Copy only production files from builder
COPY --from=builder /app/frontend/build ./frontend/build
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/server.js ./
COPY --from=builder /app/logger.js ./

# Create config volume
VOLUME /app/config

# Healthcheck to verify application is running properly
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${TAUTULLI_CUSTOM_PORT:-3010}/api/health || exit 1

# Switch to non-root user for security
USER node

# Expose port
EXPOSE 3010

# Use tini as init for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start command
CMD ["node", "server.js"]