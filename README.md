# Tautulli Unified Manager

A web application that combines user activity monitoring, media format management, and library statistics for Tautulli. Provides customizable display formats, real-time status tracking, and section management through an intuitive interface.

![Screenshot of Dashboard](path_to_screenshot.png)

## Features

### User Activity Management
- Real-time status updates for currently watching users
- Customizable user status messages and display formats
- Progress tracking with timestamps and percentages
- Watch time statistics and play counts
- User search and filtering capabilities
- Detailed user activity history
- Online/offline status indicators

### Media Management
- Section-based organization for movies and TV shows
- Customizable display formats for each media type
- Recently added content tracking per section
- Multiple section support with individual views
- Dynamic template system for media titles
- Individual section statistics

### Library Statistics
- Complete library section overview
- Movie count per library section
- TV show, season, and episode counts
- Section-specific statistics
- Sorted by section ID for easy reference

### General Features
- Dark mode responsive UI optimized for all devices
- Persistent configuration storage
- Real-time updates and live status indicators
- Docker deployment with volume support
- Comprehensive API endpoints

### Display Format Variables

User Format Variables:
| Variable | Description | Example |
|----------|-------------|---------|
| ${friendly_name} | User's display name | "John Doe" |
| ${total_plays} | Total play count | "150" |
| ${last_played} | Currently watching/last watched | "The Matrix" |
| ${media_type} | Type of media | "Movie" |
| ${progress_percent} | Current progress | "45%" |
| ${progress_time} | Progress timestamp | "1:15:30 / 2:30:00" |
| ${is_watching} | Current status | "Watching/Idle" |
| ${last_seen_formatted} | Last activity timestamp | "2 hours ago" |

Media Format Variables:
Shows:
| Variable | Description | Example |
|----------|-------------|---------|
| ${grandparent_title} | Show name | "Breaking Bad" |
| ${parent_media_index} | Season number | "01" |
| ${media_index} | Episode number | "05" |
| ${title} | Episode title | "Gray Matter" |

Movies:
| Variable | Description | Example |
|----------|-------------|---------|
| ${title} | Movie title | "Inception" |
| ${year} | Release year | "2010" |
| ${duration} | Runtime | "2h 28m" |
| ${genre} | Primary genre | "Sci-Fi" |
| ${rating} | Rating score | "8.8" |

## Prerequisites

- Tautulli server running and accessible
- Tautulli API key with full access permissions
- Docker and Docker Compose (for containerized deployment)
- Node.js v18+ (for development)

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tautulli-unified-manager.git
cd tautulli-unified-manager
```

2. Create a docker-compose.yml:
```yaml
version: '3'
services:
  tautulli-manager:
    image: tautulli-unified-manager:latest
    container_name: tautulli-manager
    environment:
      - TAUTULLI_CUSTOM_PORT=3010
      - TAUTULLI_BASE_URL=http://your-tautulli-host:8181
      - TAUTULLI_API_KEY=your_api_key
    ports:
      - "3010:3010"
    volumes:
      - ./config:/app/config
    restart: unless-stopped
```

3. Build and start:
```bash
docker compose up -d
```

4. Access the web interface at `http://localhost:3010`

## API Endpoints

### User Management
```
GET /api/users
```

### Media Management
```
GET /api/recent/movies
GET /api/recent/shows
GET /api/recent/movies/:sectionId
GET /api/recent/shows/:sectionId
```

### Library Management
```
GET /api/libraries
```

### Dashboard
```
GET /api/config
GET /api/health
```

### Volume Mounts
- `/app/config`: Persistent configuration storage

### Health Checks
The container includes health checks to monitor:
- Web server availability
- Tautulli connection status
- Configuration persistence

## License

MIT License - see LICENSE file for details.

## Note

This project is not affiliated with Tautulli or Plex Inc.