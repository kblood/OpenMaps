# OpenMaps Code Structure Documentation

## Overview

This document provides a detailed breakdown of the OpenMaps codebase structure, explaining the purpose and functionality of each file and directory. The project follows a modern full-stack architecture with clear separation of concerns.

## Project Root Structure

```
openmaps/
├── 📁 src/                      # Frontend source code (React + TypeScript)
├── 📁 backend/                  # Backend source code (Node.js + Express)
├── 📁 logs/                     # Application logs (git-ignored)
├── 📄 package.json              # Frontend dependencies and scripts
├── 📄 vite.config.ts           # Vite configuration for frontend build
├── 📄 tsconfig.json            # TypeScript configuration for frontend
├── 📄 tailwind.config.js       # Tailwind CSS configuration
├── 📄 postcss.config.js        # PostCSS configuration
├── 📄 docker-compose.yml       # Multi-service Docker setup
├── 📄 Dockerfile.frontend      # Frontend container configuration
├── 📄 nginx.conf               # Nginx configuration for production
├── 📄 index.html               # HTML template for frontend
├── 📄 .gitignore               # Git ignore patterns
├── 📄 README.md                # Project overview and setup
├── 📄 ARCHITECTURE.md          # Architecture documentation
├── 📄 API.md                   # API reference documentation
├── 📄 DEVELOPMENT.md           # Development guidelines
└── 📄 quick-start.md           # Quick setup guide
```

---

## Frontend Structure (`/src/`)

### Main Application Files

#### `src/main.tsx`
**Purpose**: Application entry point
```typescript
// Renders the root React component and sets up the DOM
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

#### `src/App.tsx`
**Purpose**: Main application component and state management
- **State Management**: Centralized state for map, markers, routes, UI
- **Component Coordination**: Orchestrates interaction between all major components
- **Event Handling**: Manages map clicks, searches, routing requests
- **Key Features**:
  - Map center and zoom control
  - Marker management (search results, user clicks, route points)
  - Route calculation and display
  - UI panel state management (search/directions toggle)

```typescript
// Core state managed in App.tsx
const [mapCenter, setMapCenter] = useState<Location>(DEFAULT_CENTER);
const [markers, setMarkers] = useState<Marker[]>([]);
const [route, setRoute] = useState<Route | null>(null);
const [showSearch, setShowSearch] = useState(true);
const [showDirections, setShowDirections] = useState(false);
```

#### `src/index.css`
**Purpose**: Global styles and Tailwind CSS imports
- Tailwind CSS directives
- Global CSS resets
- Custom utility classes
- Component-specific global overrides

### Component Architecture (`/src/components/`)

#### Map Components (`/src/components/Map/`)

##### `MapContainer.tsx`
**Purpose**: Core map rendering and interaction handling
- **Map Rendering**: Leaflet map with OpenStreetMap tiles
- **Marker Display**: Shows search results, user clicks, route waypoints
- **Route Visualization**: Displays calculated routes as polylines
- **Event Handling**: Map clicks, drags, zoom events
- **Performance**: Optimized re-rendering with React.memo

```typescript
interface MapContainerProps {
  center: Location;
  zoom: number;
  markers: Marker[];
  route: Route | null;
  routeStartMarker: RouteMarker | null;
  routeEndMarker: RouteMarker | null;
  onMapClick: (location: Location) => void;
  onMapReady: (map: LeafletMap) => void;
  onRouteMarkerDrag: (isStart: boolean, location: Location) => void;
}
```

#### Search Components (`/src/components/Search/`)

##### `SearchBar.tsx`
**Purpose**: Location search and geocoding interface
- **Search Input**: Text input with autocomplete
- **Geocoding Integration**: Calls backend geocoding API
- **Results Display**: Dropdown with search suggestions
- **Location Selection**: Handles user selection and map navigation
- **Responsive Design**: Adapts to mobile/desktop layouts

```typescript
interface SearchBarProps {
  onLocationSelect: (lat: number, lng: number, name: string) => void;
  onMapCenter: (location: Location, zoom?: number) => void;
  placeholder?: string;
  showMapOptions?: boolean;
}
```

#### Routing Components (`/src/components/Routing/`)

##### `RoutePanel.tsx`
**Purpose**: Route planning and navigation interface
- **Route Input**: Start/end point selection
- **Route Calculation**: Integration with routing API
- **Route Display**: Distance, duration, turn-by-turn directions
- **Map Integration**: Click-to-set destinations
- **Alternative Routes**: Multiple route options

```typescript
interface RoutePanelProps {
  onRouteCalculated: (route: Route | null) => void;
  onClose: () => void;
  onMapCenter: (location: Location, zoom?: number) => void;
  onSetDestinationFromMap: (callback: MapClickCallback) => void;
  recentMapClick: RecentMapClick | null;
  onSetRouteMarkers: (start: RouteMarker | null, end: RouteMarker | null) => void;
}
```

#### UI Components (`/src/components/UI/`)

##### `MapControls.tsx`
**Purpose**: Map control buttons and user interactions
- **Zoom Controls**: In/out zoom buttons
- **Location Button**: GPS/geolocation access
- **Mode Toggles**: Search/directions panel toggles
- **Accessibility**: Keyboard navigation and screen reader support

```typescript
interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocateUser: () => void;
  onToggleDirections: () => void;
  onToggleSearch: () => void;
  showDirections: boolean;
  showSearch: boolean;
  isLocating: boolean;
}
```

##### `MobileBottomSheet.tsx`
**Purpose**: Mobile-optimized slide-up interface
- **Touch Gestures**: Swipe to open/close
- **Responsive Behavior**: Only displays on mobile devices
- **Content Container**: Houses search/routing panels on mobile
- **Animation**: Smooth slide transitions

### Custom Hooks (`/src/hooks/`)

#### `useGeolocation.ts`
**Purpose**: Browser geolocation API wrapper
```typescript
interface GeolocationHook {
  location: Location | null;
  loading: boolean;
  error: string | null;
  getCurrentLocation: () => void;
}

// Features:
// - Permission handling
// - Error management
// - Loading states
// - Position watching
```

#### `useMediaQuery.ts`
**Purpose**: Responsive design hook for screen size detection
```typescript
const useMediaQuery = (query: string): boolean => {
  // Returns true/false based on CSS media query
  // Used for responsive component behavior
}

// Usage:
const isMobile = useMediaQuery('(max-width: 768px)');
```

### Services (`/src/services/`)

#### `geocoding.ts`
**Purpose**: Frontend geocoding API integration
```typescript
// API functions for location services
export async function searchLocations(query: string): Promise<GeocodingResult[]>
export async function reverseGeocode(lat: number, lng: number): Promise<string>
export async function getAutocompleteSuggestions(query: string): Promise<Suggestion[]>
```

#### `routing.ts`
**Purpose**: Frontend routing API integration
```typescript
// API functions for route calculation
export async function calculateRoute(start: Location, end: Location): Promise<Route>
export async function getRouteAlternatives(start: Location, end: Location): Promise<Route[]>
export async function getRouteMatrix(points: Location[]): Promise<RouteMatrix>
```

### Type Definitions (`/src/types/`)

#### `index.ts`
**Purpose**: Shared TypeScript interfaces and types
```typescript
// Core data structures
export interface Location {
  lat: number;
  lng: number;
}

export interface Marker {
  id: string;
  position: Location;
  title: string;
  description?: string;
}

export interface Route {
  distance: number;
  duration: number;
  geometry: GeoJSON.LineString;
  instructions: RouteInstruction[];
}

export interface GeocodingResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  importance: number;
}
```

---

## Backend Structure (`/backend/`)

### Main Server File

#### `src/server.ts`
**Purpose**: Express server setup and configuration
- **Middleware Setup**: Security, CORS, rate limiting, logging
- **Route Registration**: API endpoint mounting
- **Error Handling**: Global error handler
- **Health Checks**: Service status endpoint

```typescript
// Key middleware stack:
app.use(helmet());           // Security headers
app.use(compression());      // Response compression
app.use(cors());            // Cross-origin requests
app.use(rateLimit());       // Rate limiting
app.use(logger);            // Request logging
```

### API Routes (`/src/routes/`)

#### `geocoding.ts`
**Purpose**: Geocoding and reverse geocoding endpoints
```typescript
// Endpoints:
GET /api/geocoding/search         // Forward geocoding
GET /api/geocoding/reverse        // Reverse geocoding  
GET /api/geocoding/autocomplete   // Search suggestions

// Features:
// - Nominatim API integration
// - Response caching
// - Input validation
// - Error handling
```

#### `routing.ts`
**Purpose**: Route calculation and navigation endpoints
```typescript
// Endpoints:
GET /api/routing/directions       // Calculate route
GET /api/routing/alternatives     // Alternative routes
POST /api/routing/matrix         // Route matrix calculation

// Features:
// - OSRM API integration
// - Multiple transportation modes
// - Route optimization
// - Waypoint support
```

#### `places.ts`
**Purpose**: Points of interest and places search
```typescript
// Endpoints:
GET /api/places/search           // Search places
GET /api/places/{id}             // Place details
GET /api/places/nearby/{category} // Nearby places

// Features:
// - Overpass API integration
// - Category filtering
// - Proximity search
// - Place details enrichment
```

### Middleware (`/src/middleware/`)

#### `errorHandler.ts`
**Purpose**: Centralized error handling
```typescript
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Features:
  // - Error logging
  // - Client-safe error messages
  // - HTTP status code mapping
  // - Development vs production responses
}
```

#### `logger.ts`
**Purpose**: Request logging and monitoring
```typescript
export const logger = (req: Request, res: Response, next: NextFunction) => {
  // Features:
  // - Request/response logging
  // - Performance timing
  // - User agent tracking
  // - Error correlation
}
```

### Services (`/src/services/`)

#### `cache.ts`
**Purpose**: Redis caching service
```typescript
export class CacheService {
  // Features:
  // - Redis connection management
  // - Automatic serialization
  // - TTL (Time To Live) support
  // - Cache invalidation
  // - Error fallback to direct API calls
}
```

---

## Configuration Files

### Build and Development

#### `vite.config.ts`
**Purpose**: Vite build tool configuration
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': 'http://localhost:3001'  // Development API proxy
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
```

#### `tsconfig.json` (Frontend)
**Purpose**: TypeScript compilation settings for frontend
- Strict type checking enabled
- Modern ES target (ES2020)
- React JSX support
- Path mapping for imports

#### `backend/tsconfig.json`
**Purpose**: TypeScript compilation settings for backend
- Node.js target environment
- CommonJS module system
- Strict type checking
- Source map generation

### Styling

#### `tailwind.config.js`
**Purpose**: Tailwind CSS customization
```javascript
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Custom colors, fonts, spacing
      colors: {
        primary: '#3B82F6',
        secondary: '#6B7280'
      }
    }
  },
  plugins: []
}
```

#### `postcss.config.js`
**Purpose**: PostCSS processing configuration
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
}
```

### Containerization

#### `docker-compose.yml`
**Purpose**: Multi-service container orchestration
```yaml
services:
  frontend:    # React development server
  backend:     # Node.js API server  
  redis:       # Cache storage
```

#### `Dockerfile.frontend`
**Purpose**: Frontend container build instructions
- Multi-stage build for optimization
- Node.js base image
- Dependency installation
- Production build creation

#### `backend/Dockerfile`
**Purpose**: Backend container build instructions
- Node.js runtime environment
- TypeScript compilation
- Production dependencies only

---

## Data Flow Architecture

### Request Flow
```
User Interaction → React Component → Service Function → API Endpoint → External API → Cache → Response
```

### State Management Flow
```
User Action → Event Handler → State Update → Component Re-render → UI Update
```

### Map Interaction Flow
```
Map Click → Leaflet Event → React Handler → Geocoding API → Marker Update → Map Re-render
```

---

## Development Patterns

### Component Patterns
- **Functional Components**: All components use hooks
- **Props Interface**: TypeScript interfaces for all props
- **Event Handling**: useCallback for performance
- **State Management**: useState with proper typing

### API Patterns
- **RESTful Design**: Standard HTTP methods and status codes
- **Error Handling**: Consistent error response format
- **Caching Strategy**: Redis-based caching with TTL
- **Validation**: Input validation on all endpoints

### Performance Patterns
- **Code Splitting**: Lazy loading for heavy components
- **Memoization**: React.memo and useMemo for expensive operations
- **Debouncing**: Search input debouncing
- **Caching**: Multi-level caching (memory + Redis)

---

This code structure provides a scalable, maintainable foundation for the OpenMaps application with clear separation of concerns and modern development practices.
