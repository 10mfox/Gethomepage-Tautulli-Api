# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install
RUN cd frontend && npm install

# Copy source files
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Production stage
FROM node:18-alpine

# Install tini
RUN apk add --no-cache tini

WORKDIR /app

# Create app directory and config directory with proper permissions
RUN mkdir -p /app/config && chown -R node:node /app

# Copy package files and install production dependencies
COPY --chown=node:node package*.json ./
RUN npm install --omit=dev

# Copy application files
COPY --from=builder --chown=node:node /app/frontend/build ./frontend/build
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/server.js ./
COPY --from=builder --chown=node:node /app/logger.js ./

# Create config volume
VOLUME /app/config

# Switch to non-root user
USER node

# Expose port
EXPOSE 3010

# Use tini as init
ENTRYPOINT ["/sbin/tini", "--"]

# Start command
CMD ["node", "server.js"]