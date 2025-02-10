# Tautulli Unified Manager

A modern web application for managing Tautulli user activity and media formats through an intuitive interface. Monitor user activity, customize display formats, and track library statistics in real-time.

## Features

### User Activity Dashboard
- Real-time user activity monitoring with customizable display formats
- Active session tracking with progress indicators
- User status indicators (watching/idle)
- Detailed playback progress and timestamps
- Advanced search and filtering capabilities
- Responsive pagination with adjustable page sizes
- Last seen timestamps and watch history

### Media Management
- Unified view of recently added content across multiple libraries
- Section-based organization for movies and TV shows
- Customizable display formats per media section
- Individual library section statistics
- Dynamic content updates with real-time refresh
- Support for multiple library sections

### Library Statistics
- Comprehensive library overview
- Detailed counts for movies, TV shows, seasons, and episodes
- Section-specific analytics
- Automatic sorting by section ID
- Quick refresh capabilities

### Display Format System

#### User Display Variables
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

#### Media Format Variables

TV Shows:
| Variable | Description | Example |
|----------|-------------|---------|
| ${grandparent_title} | Show name | "Breaking Bad" |
| ${parent_media_index} | Season number | "01" |
| ${media_index} | Episode number | "05" |
| ${title} | Episode title | "Gray Matter" |
| ${duration} | Runtime | "2h 28m" |
| ${content_rating} | Content rating | "TV-MA" |
| ${video_resolution} | Video quality | "1080p" |

Movies:
| Variable | Description | Example |
|----------|-------------|---------|
| ${title} | Movie title | "Inception" |
| ${year} | Release year | "2010" |
| ${duration} | Runtime | "2h 28m" |
| ${content_rating} | Content rating | "PG-13" |
| ${video_resolution} | Video quality | "4K" |

### General Features
- Modern dark mode UI optimized for all screen sizes
- Persistent configuration storage
- Real-time content updates
- Docker deployment support
- Comprehensive API endpoints
- Error handling and loading states
- Responsive design principles

## Prerequisites

- Node.js v18 or higher
- Tautulli server with API access
- Docker (for containerized deployment)

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tautulli-unified-manager.git
cd tautulli-unified-manager
```

2. Create a docker-compose.yml file:
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

3. Build and start the container:
```bash
docker compose up -d
```

4. Access the web interface at http://localhost:3010

## Development Setup

1. Install dependencies:
```bash
npm install
cd frontend && npm install
```

2. Set environment variables:
```bash
TAUTULLI_BASE_URL=http://your-tautulli-host:8181
TAUTULLI_API_KEY=your_api_key
TAUTULLI_CUSTOM_PORT=3010
```

3. Start development servers:
```bash
npm run dev
```

## API Endpoints

### User Management
```
GET /api/users
GET /api/users/format-settings
POST /api/users/format-settings
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

### Configuration
```
GET /api/config
GET /api/health
```

## Docker Support

### Environment Variables
- `TAUTULLI_CUSTOM_PORT`: Port for the web interface (default: 3010)
- `TAUTULLI_BASE_URL`: URL of your Tautulli server
- `TAUTULLI_API_KEY`: Your Tautulli API key

### Volumes
- `/app/config`: Persistent configuration storage

### Health Checks
The container includes health checks for:
- Web server availability
- Tautulli connection status
- Configuration persistence

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details.

## Note

This project is not affiliated with Tautulli or Plex Inc. All trademarks and registered trademarks are the property of their respective owners.