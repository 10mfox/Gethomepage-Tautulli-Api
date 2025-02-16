# Tautulli Unified Manager

A web application that combines user activity monitoring, media format management, and library statistics for Tautulli. Provides customizable display formats, real-time status tracking, and section management through an intuitive interface.

![Homelab (18)](https://github.com/user-attachments/assets/0d8a31e7-59c5-4c19-aa7f-5aa4b9157e82)

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

## Prerequisites

- Tautulli server running and accessible
- Tautulli API key with full access permissions
- Docker and Docker Compose (for containerized deployment)
- Node.js v18+ (for development)

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| TAUTULLI_BASE_URL | Base URL of your Tautulli instance | Yes | - |
| TAUTULLI_API_KEY | API key from Tautulli | Yes | - |
| TAUTULLI_CUSTOM_PORT | Port for the web interface | No | 3010 |

## Quick Start

1. Create a `docker-compose.yml`:

```yaml
version: "3"
services:
  tautulli-manager:
    image: ghcr.io/10mfox/gethomepage-tautulli-api:latest
    container_name: tautulli-api-manager
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

2. Start the container:
```bash
docker compose up -d
```

3. Access the web interface at `http://localhost:3010`

## API Endpoints

### User Management
```
GET /api/users                  # Get all users with activity
GET /api/users/format-settings  # Get user format settings
POST /api/users/format-settings # Update user format settings
```

### Media Management
```
GET /api/recent/movies          # Get all recent movies
GET /api/recent/shows           # Get all recent shows
GET /api/recent/movies/:id      # Get recent movies for section
GET /api/recent/shows/:id       # Get recent shows for section
GET /api/media/settings         # Get media format settings
POST /api/media/settings        # Update media format settings
```

### Library Management
```
GET /api/libraries             # Get all library sections
GET /api/libraries/sections    # Get configured sections
GET /api/libraries/:id        # Get specific library details
```

### System
```
GET /api/health               # Health check endpoint
GET /api/config              # Get system configuration
POST /api/cache/clear        # Clear system cache
```

## Display Format Variables

### User Format Variables
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
| ${stream_container_decision} | Container Steam Type | "Transcode/Direct Play" |

### Media Format Variables

#### Shows
| Variable | Description | Example |
|----------|-------------|---------|
| ${grandparent_title} | Show name | "Breaking Bad" |
| ${parent_media_index} | Season number | "01" |
| ${media_index} | Episode number | "05" |
| ${title} | Episode title | "Gray Matter" |
| ${duration} | Runtime | "1h 51m" |
| ${content_rating} | Content Rating | "TV-MA" |
| ${video_resolution} | Video Quality | "720p" |
| ${added_at_relative} | Relative time | "2d ago" |
| ${added_at_short} | Short date | "Feb 10" |

#### Movies
| Variable | Description | Example |
|----------|-------------|---------|
| ${title} | Movie title | "Inception" |
| ${year} | Release year | "2010" |
| ${duration} | Runtime | "1h 51m" |
| ${content_rating} | Content Rating | "PG-13" |
| ${video_resolution} | Video Quality | "720p" |
| ${added_at_relative} | Relative time | "2d ago" |
| ${added_at_short} | Short date | "Feb 10" |

### Custom CSS for Homepage custom api's 

```css
/*==================================
  LIST STYLES
==================================*/

#list > div > div.relative.flex.flex-row.w-full.service-container > div > div {
  display: block;
  text-align: right;
}

#list
  > div
  > div.relative.flex.flex-row.w-full.service-container
  > div
  > div
  > div.flex.flex-row.text-right
  > div:nth-child(1) {
  text-align: right;
  margin-left: 0.5rem;
}

#list
  > div
  > div.relative.flex.flex-row.w-full.service-container
  > div
  > div
  > div.flex.flex-row.text-right
  > div:nth-child(2) {
  text-align: left;
  margin-left: auto;
}
```

## Docker Volumes and Configuration

### Volumes
- `/app/config`: Persistent configuration storage
  - `settings.json`: User and media format settings
  - Created automatically on first run

### Health Checks
The container includes health checks to monitor:
- Web server availability (port 3010)
- Tautulli connection status
- Configuration persistence

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Tautulli team for their excellent media server monitoring solution
- Homepage team for inspiration on the dashboard design
- React and Node.js communities for their excellent tools and libraries

## Note

This project is not affiliated with Tautulli or Plex Inc. All product names, logos, and brands are property of their respective owners.
