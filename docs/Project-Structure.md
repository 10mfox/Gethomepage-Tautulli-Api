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
│   │   │   backdrop.jpg
│   │   │   favicon.ico
│   │   │   index.html
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
│       │   │       HomepageView.js
│       │   │       SectionManager.js
│       │   │       UnifiedFormatManager.js
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