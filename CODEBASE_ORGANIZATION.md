# Codebase Organization

## Directory Structure

```
dz-viz/
├── public/                    # Static assets
│   ├── favicon.ico           # Application icon
│   ├── logo.svg              # Logo file
│   └── manifest.json         # Web app manifest
├── src/                      # Source code
│   ├── assets/               # Vue app assets
│   │   └── vue.svg           # Vue logo
│   ├── components/           # Vue components
│   │   ├── Scene3D/          # 3D scene component (placeholder)
│   │   │   └── index.vue     # Main 3D scene component
│   │   ├── CarButton.vue     # Car control buttons
│   │   ├── CarCamera.vue     # Camera control component
│   │   ├── CarInfo.vue       # Car information display
│   │   ├── CarList.vue       # Car list component
│   │   ├── CarSettings.vue   # Car settings panel
│   │   ├── Dashboard.vue     # Main dashboard
│   │   ├── Header.vue        # App header
│   │   ├── Sensor.vue        # Sensor display component
│   │   └── StatusIndicator.vue # Status indicator
│   ├── icons/                # Icon configuration
│   │   └── index.js          # FontAwesome icon setup
│   ├── router/               # Vue router configuration
│   │   └── index.js          # Route definitions
│   ├── stores/               # Pinia state management
│   │   └── car.js            # Car state store
│   ├── styles/               # Global styles
│   │   ├── animations.css    # CSS animations
│   │   ├── base.css          # Base styles
│   │   ├── customer.scss     # Custom component styles
│   │   ├── main.css          # Main stylesheet
│   │   └── variables.scss    # SCSS variables
│   ├── utils/                # Utility functions
│   │   ├── errorHandler.js   # Error handling utilities
│   │   └── tauri.js          # Tauri API utilities
│   ├── views/                # Vue view components
│   │   ├── AutoDrive.vue     # Auto drive view
│   │   ├── Cars.vue          # Cars management view
│   │   ├── Control.vue       # Control panel view
│   │   ├── Map.vue           # Map view with Scene3D
│   │   └── Settings.vue      # Settings view
│   ├── App.vue               # Root Vue component
│   └── main.js               # Application entry point
├── src-tauri/                # Tauri backend
│   ├── capabilities/         # Tauri capabilities
│   ├── gen/                  # Generated files
│   ├── src/                  # Rust source code
│   ├── target/               # Rust build artifacts
│   ├── Cargo.toml            # Rust dependencies
│   ├── build.rs              # Build script
│   └── tauri.conf.json       # Tauri configuration
├── .gitignore                # Git ignore rules
├── README.md                 # Project documentation
├── index.html                # HTML entry point
├── package.json              # Node.js dependencies
├── package-lock.json         # Locked dependency versions
├── vite.config.js            # Vite build configuration
└── CODEBASE_ORGANIZATION.md  # This file
```

## Technology Stack

### Frontend
- **Vue 3** - Progressive JavaScript framework
- **Vite** - Build tool and development server
- **Vue Router** - Client-side routing
- **Pinia** - State management
- **Element Plus** - Vue 3 component library
- **FontAwesome** - Icon library
- **SCSS** - CSS preprocessor

### Backend
- **Tauri** - Desktop application framework
- **Rust** - Systems programming language

### Future Additions
- **Three.js** - 3D graphics library (to be added)
- **WebGL** - 3D rendering context

## Component Architecture

### Core Components
- `App.vue` - Root component with layout and navigation
- `Header.vue` - Application header with navigation
- `Dashboard.vue` - Main dashboard with metrics

### Feature Components
- `Scene3D/` - 3D visualization component (placeholder)
- `CarList.vue` - Vehicle list management
- `CarInfo.vue` - Individual vehicle information
- `CarButton.vue` - Vehicle control buttons
- `CarCamera.vue` - Camera control interface
- `CarSettings.vue` - Vehicle configuration
- `Sensor.vue` - Sensor data display
- `StatusIndicator.vue` - System status display

### View Components
- `Map.vue` - Main map view with 3D scene
- `Cars.vue` - Vehicle management interface
- `Control.vue` - Control panel interface
- `AutoDrive.vue` - Autonomous driving interface
- `Settings.vue` - Application settings

## State Management

### Stores (Pinia)
- `car.js` - Vehicle state and actions
  - Vehicle list management
  - Vehicle status tracking
  - Control state management

## Styling Architecture

### SCSS Variables (`variables.scss`)
- Color scheme definitions
- Typography settings
- Spacing and layout constants
- Animation timing values

### Style Files
- `base.css` - Base HTML element styles
- `main.css` - Main application styles
- `animations.css` - CSS animations and transitions
- `customer.scss` - Custom component styles

## Build Configuration

### Vite Configuration
- Modern browser targeting (ES2020+)
- Development server with HMR
- Optimized chunking strategy
- SCSS preprocessing
- Tauri integration

### Dependency Chunking
- `vue-vendor` - Vue core libraries
- `element-plus` - UI component library
- `fontawesome` - Icon libraries
- `charts` - Chart.js libraries

## Development Guidelines

### Code Organization
1. Keep components focused and single-purpose
2. Use composition API for Vue components
3. Organize styles using SCSS variables
4. Maintain clear separation between views and components

### File Naming
- Use PascalCase for Vue components
- Use camelCase for JavaScript files
- Use kebab-case for SCSS/CSS files
- Use descriptive names for utilities

### Future Development
1. 3D scene implementation will be added to `Scene3D/` component
2. Three.js integration for 3D visualization
3. Model loading and camera controls
4. WebGL rendering optimizations

## Clean Code Status ✅

- [x] Removed unused Three.js dependencies
- [x] Cleaned up placeholder 3D code
- [x] Organized directory structure
- [x] Removed empty directories
- [x] Updated build configuration
- [x] Created documentation

The codebase is now clean and organized, ready for future 3D implementation.