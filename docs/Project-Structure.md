Project Folder
│   .dockerignore
│   Dockerfile
│   logger.js
│   package.json
│   README.md
│   server.js
│
├───backend
│   ├───api
│   │   │   debug.js
│   │   │   media.js
│   │   │   users.js
│   │   │   webhook.js
│   │   │
│   │   └───debug
│   │           debugCache.js
│   │           debugDashboard.js
│   │           debugLogging.js
│   │           debugLogs.js
│   │           debugRouter.js
│   │           debugSettings.js
│   │           debugUtils.js
│   │
│   └───services
│           cacheConfig.js
│           cacheDataFetchers.js
│           cacheService.js
│           fix-background-refresh.js
│           PersistentCache.js
│           settings.js
│           tautulli.js
│           webhookService.js
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
│       │       useSharedData.js
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