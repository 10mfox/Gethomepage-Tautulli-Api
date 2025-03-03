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
├───docs
│       API.md
│       INSTALLATION.md
│       Project-Structure.md
│
├───frontend
│   │   jsconfig.json
│   │   package.json
│   │   postcss.config.js
│   │   tailwind.config.js
│   │
│   ├───public
│   │   │   android-chrome-192x192.png
│   │   │   android-chrome-512x512.png
│   │   │   apple-touch-icon.png
│   │   │   backdrop.jpg
│   │   │   favicon-16x16.png
│   │   │   favicon-32x32.png
│   │   │   favicon.ico
│   │   │   index.html
│   │   │   site.webmanifest
│   │   │
│   │   └───static
│   │           poster-placeholder.jpg
│   │
│   └───src
│       │   App.js
│       │   index.css
│       │   index.js
│       │
│       ├───components
│       │   │   FormatManager.js
│       │   │   ThemeSwitcher.js
│       │   │
│       │   ├───dashboard
│       │   │       LibraryView.js
│       │   │       RecentMediaView.js
│       │   │       UserView.js
│       │   │
│       │   ├───layout
│       │   │       Layout.js
│       │   │
│       │   ├───managers
│       │   │       EndpointsView.js
│       │   │       HomepageConfigManager.js
│       │   │       HomepageView.js
│       │   │       MediaFormatManager.js
│       │   │       SectionManager.js
│       │   │       UnifiedFormatManager.js
│       │   │       UserFormatManager.js
│       │   │
│       │   └───ui
│       │           UIComponents.js
│       │
│       ├───context
│       │       ThemeContext.js
│       │
│       ├───hooks
│       │       useBackgroundRefresh.js
│       │
│       ├───services
│       │       tautulli.js
│       │
│       └───utils
│               utils.js
│
├───homepage docs
│       css for homepage.css
│       example-services.yaml
│
└───screenshots
        Activity.png
        Count.png
        Movies.png
        Recently.png
        Shows.png