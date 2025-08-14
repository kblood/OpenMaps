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
- **OpenStreetMap** - Map tiles and geographic data
- **Nominatim** - Geocoding service
- **OSRM (Open Source Routing Machine)** - Routing calculations
- **Overpass API** - Places and POI data

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
- Location search and autocomplete
- Geocoding integration
- Search history and suggestions
- Responsive design for mobile/desktop

#### RoutePanel (`src/components/Routing/RoutePanel.tsx`)
- Route planning interface
- Start/end point selection
- Route alternatives display
- Turn-by-turn directions

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
- Route calculation between points
- Multiple route alternatives
- Distance and duration estimates
- Integration with OSRM

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

### Routing Flow
1. User selects start and end points
2. Frontend sends request to `/api/routing/directions`
3. Backend queries OSRM API
4. Route data processed and cached
5. Route displayed on map with turn-by-turn directions

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

- **Redis Caching** - API response caching
- **Code Splitting** - Lazy loading of components
- **Image Optimization** - Optimized map tiles
- **Compression** - Gzip compression for API responses
- **Bundle Optimization** - Tree-shaking and minification

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
