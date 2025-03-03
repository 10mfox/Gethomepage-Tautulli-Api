# Tautulli Unified Manager

A comprehensive web application that provides a centralized interface for monitoring Plex media server activities through Tautulli. This application combines user activity monitoring, media format management, and library statistics with an intuitive interface featuring multiple theme options and customizable display formats.

## Features

### User Activity Management
- Real-time status tracking for currently watching users
- Customizable user status messages and display formats
- Progress tracking with timestamps and percentages
- Watch time statistics and play counts
- User search and filtering capabilities
- Detailed user activity history
- Online/offline status indicators
- Transcode/Direct Play status indicators

### Media Management
- Section-based organization for movies, TV shows, and music
- Customizable display formats for each media type
- Recently added content tracking per section
- Multiple section support with individual views
- Dynamic template system for media titles
- Individual section statistics and filtering

### Library Statistics
- Complete library section overview with detailed counts
- Movie count per library section
- TV show, season, and episode counts
- Music artist, album, and track counts
- Section-specific statistics with numerical breakdowns
- Combined totals for all libraries
- Configurable display options

### System Features
- Dark mode responsive UI optimized for all devices
- Multiple theme options with customizable transparency settings
- Real-time updates and live status indicators
- Persistent configuration storage
- Comprehensive API endpoints with documentation
- Homepage integration with YAML configuration generator
- Docker deployment with volume support
- Background data refresh with configurable intervals

## Prerequisites

- Tautulli server running and accessible
- Tautulli API key with full access permissions
- Docker and Docker Compose (for containerized deployment)
- Node.js v18+ (for development)

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| TAUTULLI_CUSTOM_PORT | Port for the web interface | No | 3010 |
| TAUTULLI_REFRESH_INTERVAL | Data refresh interval in milliseconds | No | 60000 |

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
    ports:
      - "3010:3010"
    volumes:
      - ./config:/app/config
    restart: unless-stopped
```

Alternative configuration for Linux systems:

```yaml
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
```bash
docker compose up -d
```

3. Access the web interface at `http://localhost:3010`

4. Enter your Tautulli base URL and API key, then select which library sections to include

## API Endpoints

### User Management
```
GET /api/users                  # Get all users with activity
GET /api/users/format-settings  # Get user format settings
POST /api/users/format-settings # Update user format settings
```

### Media Management
```
GET /api/media/recent           # Get recent media from all configured sections
GET /api/media/recent?type=movies    # Filter by media type
GET /api/media/recent?type=shows     # Filter by media type
GET /api/media/recent?type=music     # Filter by music type
GET /api/media/recent?section=1,2    # Filter by specific section IDs
GET /api/media/settings              # Get media format settings
POST /api/media/settings             # Update media format settings
```

### System
```
GET /api/health               # Health check endpoint
GET /api/config               # Get system configuration
POST /api/config              # Update system configuration
POST /api/cache/clear         # Clear system cache
POST /api/test-connection     # Test Tautulli connection
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

#### Music
| Variable | Description | Example |
|----------|-------------|---------|
| ${parent_title} | Artist name | "Pink Floyd" |
| ${title} | Album/Track title | "Dark Side of the Moon" |
| ${year} | Release year | "1973" |
| ${studio} | Record label/Studio | "Harvest Records" |
| ${genres} | Music genres | "Progressive Rock" |
| ${added_at_relative} | Relative time | "2d ago" |
| ${added_at_short} | Short date | "Feb 10" |

## Homepage Integration

Tautulli Unified Manager provides built-in configuration generation for the [Homepage](https://gethomepage.dev/) dashboard. The application automatically generates YAML configuration based on your configured sections and formatting preferences.

### Available Widgets
- **User Activity**: Display current watching users with status
- **Recently Added Media**: Show recently added content per section or combined
- **Media Count**: Display library statistics with formatted numbers

### Configuration Options
- Combine/split sections in Recently Added view
- Include/exclude count statistics in section views
- Use formatted/raw numbers for statistics
- Adjust the number of items displayed in each section

## Docker Volumes and Configuration

### Volumes
- `/app/config`: Persistent configuration storage
  - Created automatically on first run
  - Contains settings.json with format preferences and section configurations

### Health Checks
The container includes health checks to monitor:
- Web server availability (port 3010)
- Tautulli connection status
- Configuration persistence

## Theme Options

Tautulli Unified Manager includes multiple theme options:

- Dark (Blue/Cyan)
- Cyberpunk (Pink/Cyan)
- Matrix (Green/Emerald)
- Synthwave (Purple/Pink)
- Crimson (Red/Orange)
- Ocean (Cyan/Blue)
- Forest (Emerald/Green)
- Sunset (Orange/Yellow)
- Midnight (Indigo/Violet)
- Monochrome (Gray/Slate)

Themes can be changed via the theme switcher in the navigation bar and are persisted between sessions. Each theme also supports customizable transparency settings for UI elements.

## Development

### Project Structure
```
Project Folder
│   Dockerfile
│   logger.js
│   package.json
│   README.md
│   server.js
│
├───backend
│   ├───api
│   │       media.js
│   │       users.js
│   │
│   └───services
│           cacheService.js
│           settings.js
│           tautulli.js
│
├───config
│       defaults.json
│
└───frontend
    │   jsconfig.json
    │   package.json
    │   postcss.config.js
    │   tailwind.config.js
    │
    ├───public
    │   │   android-chrome-192x192.png
    │   │   android-chrome-512x512.png
    │   │   apple-touch-icon.png
    │   │   backdrop.jpg
    │   │   favicon-16x16.png
    │   │   favicon-32x32.png
    │   │   favicon.ico
    │   │   index.html
    │   │   site.webmanifest
    │   │
    │   └───static
    │           poster-placeholder.jpg
    │
    └───src
        │   App.js
        │   index.css
        │   index.js
        │
        ├───components
        │   │   FormatManager.js
        │   │   ThemeSwitcher.js
        │   │
        │   ├───dashboard
        │   │       LibraryView.js
        │   │       RecentMediaView.js
        │   │       UserView.js
        │   │
        │   ├───layout
        │   │       Layout.js
        │   │
        │   ├───managers
        │   │       EndpointsView.js
        │   │       HomepageConfigManager.js
        │   │       HomepageView.js
        │   │       MediaFormatManager.js
        │   │       SectionManager.js
        │   │       UnifiedFormatManager.js
        │   │       UserFormatManager.js
        │   │
        │   └───ui
        │           UIComponents.js
        │
        ├───context
        │       ThemeContext.js
        │
        ├───hooks
        │       useBackgroundRefresh.js
        │
        ├───services
        │       tautulli.js
        │
        └───utils
                utils.js
```

### Local Development
1. Clone the repository
2. Install dependencies:
```bash
npm install
cd frontend && npm install
```
3. Start development servers:
```bash
npm run dev
```

## License

This project is licensed under the MIT License.

## Acknowledgments

- Tautulli team for their excellent media server monitoring solution
- Homepage team for inspiration on the dashboard design
- React and Node.js communities for their excellent tools and libraries

## Note

This project is not affiliated with Tautulli or Plex Inc. All product names, logos, and brands are property of their respective owners.