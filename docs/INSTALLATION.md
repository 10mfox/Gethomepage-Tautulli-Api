# Installation Guide
## Prerequisites

- Tautulli server running and accessible
- Docker and Docker Compose (for containerized deployment)
- Node.js v18+ (for development)

# Docker Installation

1. Create a `docker-compose.yml` file:
```
version: "3"
services:
  tautulli-manager:
    image: ghcr.io/10mfox/gethomepage-tautulli-api:latest
    container_name: tautulli-api-manager
    environment:
      - TAUTULLI_CUSTOM_PORT=3010
    ports:
      - "3010:3010"
    volumes:
      - ./config:/app/config
    restart: unless-stopped
```
For Linux users experiencing issues:
```
version: "3"
services:
  tautulli-manager:
    image: ghcr.io/10mfox/gethomepage-tautulli-api:latest
    container_name: tautulli-api-manager
    user: "1000:1000"  # Replace with your user ID and group ID	
    environment:
      - TAUTULLI_CUSTOM_PORT=3010
    ports:
      - "3010:3010"
    volumes:
      - ./config:/app/config
    restart: unless-stopped
```
2. Start the container:
```
docker compose up -d
```
# Configuration
On first run, you'll need to:

1. Enter your Tautulli base URL and API key
2. Select which library sections to include in the dashboard
3. Configure display formats for users and media