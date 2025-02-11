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

1. Create a docker-compose.yml:
```yaml
version: '3'
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

2. Build and start:
```bash
docker compose up -d
```

3. Access the web interface at `http://localhost:3010`

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

### Example Homepage Integration

## Please Do Not Copy And Paste this may not work for you it is just a guide

Here's an example services.yaml configuration for integrating with Homepage:

```yaml
- Recently Added:
     - Movies:
        icon: mdi-filmstrip
        id: list
        widget:
          type: customapi
          url: http://your-tautulli-host:3010/api/recent/movies/2
          method: GET
          display: list
          mappings:
            - field:
                response:
                  data:
                    0: title
              additionalField:
                field:
                  response:
                    data:
                      0: added_at_short
                color: theme
     - Shows:
         icon: mdi-television-classic
         id: list
         widget:
           type: customapi
           url: http://your-tautulli-host:3010/api/recent/shows/3
           method: GET
           display: list
           mappings:
              - field:
                  response:
                    data:
                      0: title
                additionalField:
                  field:
                    response:
                      data:
                        0: added_at_short
                  color: theme
- Media Count:
    - Media Count:
         widgets:
           - type: customapi
             url: http://your-tautulli-host:3010/api/libraries
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   data:
                     0: count
               format: numbers 
               label: Movies
           - type: customapi
             url: http://your-tautulli-host:3010/api/libraries
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   data:
                     1: count
               format: numbers
               label: Shows
             - field:
                 response:
                   data:
                     1: parent_count
               format: numbers
               label: Seasons
             - field:
                 response:
                   data:
                     1: child_count
               format: numbers
               label: Episodes
- Activity:                     
    - Activity:
         id: list2
         widgets:
           - type: customapi
             url: http://your-tautulli-host:3010/api/users
             method: GET
             display: list
             mappings:
               - field:
                   response:
                     data:
                       0: name
                 additionalField:
                   field:
                     response:
                       data:
                         0: watched
               - field:
                   response:
                     data:
                       1: name
                 additionalField:
                   field:
                     response:
                       data:
                         1: watched
               - field:
                   response:
                     data:
                       2: name
                 additionalField:
                   field:
                     response:
                       data:
                         2: watched
               - field:
                   response:
                     data:
                       3: name
                 additionalField:
                   field:
                     response:
                       data:
                         3: watched
               - field:
                   response:
                     data:
                       4: name
                 additionalField:
                   field:
                     response:
                       data:
                         4: watched
               - field:
                   response:
                     data:
                       5: name
                 additionalField:
                   field:
                     response:
                       data:
                         5: watched
```

Example API responses:

Movies Response:
```json
{
  "response": {
    "result": "success",
    "message": "",
    "data": [
      {
        "media_type": "movies",
        "section_id": "2",
        "title": "Homestead -  (2024) 1h 51m",
        "content_rating": "PG-13",
        "video_resolution": "720p",
        "added_at_relative": "9h ago",
        "added_at_short": "Feb 10"
      }
    ],
    "section": 2
  }
}
```

Shows Response:
```json
{
  "response": {
    "result": "success",
    "message": "",
    "data": [
      {
        "media_type": "shows",
        "section_id": "10",
        "title": "Blue Exorcist - (S05E06) 23m",
        "content_rating": "TV-14",
        "video_resolution": "720p",
        "added_at_relative": "2d ago",
        "added_at_short": "Feb 8"
      }
    ],
    "sections": [3, 10]
  }
}
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
