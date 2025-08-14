# OpenMaps Architecture Documentation

## Overview

OpenMaps is a modern, open-source alternative to Google Maps built with a microservices architecture. The application consists of a React frontend and a Node.js backend API, designed for scalability, maintainability, and performance.

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   Frontend      │────│   Backend API   │────│   External APIs │
│   (React)       │    │   (Node.js)     │    │   (OSM, OSRM)   │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                │
                       ┌─────────────────┐
                       │                 │
                       │     Redis       │
                       │    (Cache)      │
                       │                 │
                       └─────────────────┘
```

## Technology Stack

### Frontend
- **React 18** - Modern React with Hooks and Concurrent Features
- **TypeScript** - Type safety and better developer experience
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Leaflet** - Interactive map library
- **React-Leaflet** - React components for Leaflet

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Type safety for backend code
- **Redis** - In-memory cache for API responses
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - API protection

### External Services
- **OpenStreetMap** - Map tiles and comprehensive geographic data
- **Nominatim** - Advanced geocoding and reverse geocoding service
- **OSRM (Open Source Routing Machine)** - High-performance driving route calculations
- **Valhalla** - Pedestrian and cycling routes with superior path coverage
- **GraphHopper** - Specialized routing profiles with fallback capabilities
- **Overpass API** - Places and points of interest data

## Project Structure

```
openmaps/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── Map/                 # Map-related components
│   │   │   └── MapContainer.tsx # Main map component
│   │   ├── Routing/             # Navigation components
│   │   │   └── RoutePanel.tsx   # Route planning interface
│   │   ├── Search/              # Search functionality
│   │   │   └── SearchBar.tsx    # Location search component
│   │   └── UI/                  # General UI components
│   │       ├── MapControls.tsx  # Map control buttons
│   │       └── MobileBottomSheet.tsx # Mobile interface
│   ├── hooks/                   # Custom React hooks
│   │   ├── useGeolocation.ts    # Location detection
│   │   └── useMediaQuery.ts     # Responsive design
│   ├── services/                # API communication
│   │   ├── geocoding.ts         # Geocoding API calls
│   │   └── routing.ts           # Routing API calls
│   ├── types/                   # TypeScript type definitions
│   │   └── index.ts             # Shared type definitions
│   ├── App.tsx                  # Main application component
│   ├── main.tsx                 # Application entry point
│   └── index.css                # Global styles
├── backend/                     # Backend source code
│   ├── src/
│   │   ├── routes/              # API route handlers
│   │   │   ├── geocoding.ts     # Geocoding endpoints
│   │   │   ├── places.ts        # Places/POI endpoints
│   │   │   └── routing.ts       # Routing endpoints
│   │   ├── middleware/          # Express middleware
│   │   │   ├── errorHandler.ts  # Error handling
│   │   │   └── logger.ts        # Request logging
│   │   ├── services/            # Business logic
│   │   │   └── cache.ts         # Redis cache service
│   │   └── server.ts            # Express server setup
│   ├── package.json             # Backend dependencies
│   └── tsconfig.json            # TypeScript config
├── docker-compose.yml           # Multi-container setup
├── Dockerfile.frontend          # Frontend container
├── package.json                 # Frontend dependencies
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind CSS config
└── tsconfig.json               # Frontend TypeScript config
```

## Core Components

### Frontend Components

#### MapContainer (`src/components/Map/MapContainer.tsx`)
- Main map rendering component using React-Leaflet
- Handles map interactions (clicks, drags, zoom)
- Manages markers and route visualization
- Integrates with external tile providers

#### SearchBar (`src/components/Search/SearchBar.tsx`)
- Advanced location search with real-time autocomplete
- Recent locations clipboard with persistent storage
- Intelligent dropdown handling with mousedown events
- Geocoding integration with caching
- Responsive design optimized for mobile/desktop
- Debug logging and error handling

#### RoutePanel (`src/components/Routing/RoutePanel.tsx`)
- Comprehensive multi-modal route planning interface
- Enhanced start/end point selection with map integration
- Seven transportation modes (driving, walking, running, cycling, hiking, mountain biking, racing bike)
- Route alternatives with intelligent service selection
- Recent locations clipboard integration
- Route history and saved routes functionality
- Real-time route metrics and analytics
- Turn-by-turn directions with detailed instructions

#### MapControls (`src/components/UI/MapControls.tsx`)
- Zoom in/out controls
- Location detection button
- Layer switching
- Accessibility features

### Backend Services

#### Geocoding Service (`backend/src/routes/geocoding.ts`)
- Forward geocoding (address → coordinates)
- Reverse geocoding (coordinates → address)
- Search suggestions and autocomplete
- Integration with Nominatim API

#### Routing Service (`backend/src/routes/routing.ts`)
- Multi-service routing with intelligent service selection
- Support for seven transportation profiles
- OSRM integration for high-performance driving routes
- Valhalla integration for enhanced pedestrian and cycling routes
- GraphHopper integration with API key fallback
- Automatic service failover and error handling
- Route alternatives with comprehensive metrics
- Advanced pedestrian routing with footway preferences
- Cycling-specific optimizations for different bike types
- Polyline decoding and format conversion

#### Places Service (`backend/src/routes/places.ts`)
- Points of Interest search
- Category-based filtering
- Nearby places discovery
- Business information display

#### Cache Service (`backend/src/services/cache.ts`)
- Redis-based caching layer
- API response caching
- Performance optimization
- Cache invalidation strategies

## Data Flow

### Search Flow
1. User enters search query in SearchBar
2. Frontend sends request to `/api/geocoding/search`
3. Backend queries Nominatim API
4. Results cached in Redis
5. Response sent to frontend
6. Map centers on selected location

### Enhanced Routing Flow
1. User selects start and end points via SearchBar or map clicks
2. User chooses transportation mode (driving, walking, cycling, etc.)
3. Frontend sends request to `/api/routing/directions` with profile parameter
4. Backend intelligently selects routing service:
   - OSRM for driving routes (fastest performance)
   - Valhalla for pedestrian/cycling (superior path coverage)
   - GraphHopper as fallback with specialized profiles
5. Service-specific optimizations applied (footway preferences, bike types)
6. Route data processed, formatted, and cached with service attribution
7. Multiple route alternatives calculated if requested
8. Route displayed on map with detailed turn-by-turn directions
9. Route metrics and analytics displayed in RoutePanel

### Places Flow
1. User searches for places or categories
2. Frontend sends request to `/api/places/search`
3. Backend queries Overpass API
4. Results filtered and formatted
5. POI markers displayed on map

## Security Features

- **Helmet.js** - Security headers and XSS protection
- **CORS** - Controlled cross-origin requests
- **Rate Limiting** - API abuse prevention
- **Input Validation** - Request parameter sanitization
- **Environment Variables** - Secure configuration management

## Performance Optimizations

- **Intelligent Service Selection** - Route requests to optimal routing services
- **Multi-layer Redis Caching** - API response caching with TTL management
- **Automatic Service Failover** - Fallback routing when primary services fail
- **Recent Locations Persistence** - localStorage for instant clipboard access
- **Code Splitting** - Lazy loading of components and route chunks
- **Image Optimization** - Optimized map tiles and icon delivery
- **Compression** - Gzip compression for API responses
- **Bundle Optimization** - Tree-shaking and minification with Vite
- **Debounced Search** - Reduced API calls during typing
- **Event Optimization** - mousedown vs click for better UX timing

## Recent Improvements and Bug Fixes

### Enhanced Multi-Modal Routing (v1.2.0)
- **Intelligent Service Selection**: Automatically routes pedestrian/cycling requests to Valhalla for superior path coverage
- **Seven Transportation Modes**: Added hiking, mountain biking, and racing bike profiles
- **Service Attribution**: Route results show which service was used (OSRM/Valhalla/GraphHopper)
- **Automatic Fallback**: Seamless fallback to OSRM when specialized services fail
- **Advanced Pedestrian Options**: Walkway factor, sidewalk preferences, step penalties
- **Cycling Optimizations**: Different bike types with speed and road usage preferences

### Search and UI Improvements (v1.1.5)
- **Recent Locations Clipboard**: Persistent storage of recent searches and map clicks
- **Dropdown Click Fix**: Resolved event timing issue where blur events prevented clicks
- **Enhanced SearchBar**: Real-time autocomplete with improved UX
- **Visual Debug Features**: Added debugging indicators for development
- **Map Integration**: Click-to-route functionality with marker management

### Performance and Reliability (v1.1.0)
- **Caching Strategy**: Extended Redis caching to all routing services
- **Error Handling**: Comprehensive error handling with graceful degradation
- **Event Timing**: mousedown vs onClick optimization for dropdown interactions
- **Debug Logging**: Extensive logging for troubleshooting complex interactions
- **Type Safety**: Enhanced TypeScript definitions across all components

## Development Workflow

1. **Local Development**
   ```bash
   npm run dev          # Start frontend
   cd backend && npm run dev  # Start backend
   ```

2. **Docker Development**
   ```bash
   docker-compose up --build
   ```

3. **Testing**
   ```bash
   npm run test         # Frontend tests
   npm run lint         # Code linting
   npm run typecheck    # TypeScript validation
   ```

4. **Production Build**
   ```bash
   npm run build        # Frontend build
   cd backend && npm run build  # Backend build
   ```

## Deployment Strategies

### Docker Deployment
- Multi-stage builds for optimization
- Container orchestration with docker-compose
- Environment-specific configurations
- Health checks and monitoring

### Cloud Deployment
- Frontend: Static hosting (Vercel, Netlify)
- Backend: Container platforms (Railway, Heroku)
- Cache: Managed Redis (Redis Cloud, AWS ElastiCache)
- CDN: Map tile caching and delivery

## Monitoring and Logging

- **Request Logging** - HTTP request tracking
- **Error Handling** - Centralized error management
- **Performance Metrics** - Response time monitoring
- **Health Checks** - Service availability monitoring

## Future Enhancements

- **Offline Support** - Service Worker implementation
- **Real-time Updates** - WebSocket integration
- **Advanced Routing** - Public transit integration
- **User Accounts** - Personalization features
- **Mobile Apps** - React Native implementation
- **Analytics** - Usage tracking and insights

## API Documentation

Detailed API documentation is available in the [API.md](./API.md) file, including:
- Endpoint specifications
- Request/response formats
- Authentication requirements
- Rate limiting details
- Error codes and handling
