# OpenMaps Development Guide

## Table of Contents
- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Code Style Guidelines](#code-style-guidelines)
- [Component Development](#component-development)
- [API Development](#api-development)
- [Testing](#testing)
- [Debugging](#debugging)
- [Performance](#performance)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Getting Started

### Prerequisites
- **Node.js** 18.0 or higher
- **npm** 9.0 or higher
- **Git** 2.30 or higher
- **Docker** (optional, for containerized development)
- **Redis** (for caching, can use Docker)

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd openmaps
   ```

2. **Install dependencies**
   ```bash
   # Frontend dependencies
   npm install
   
   # Backend dependencies
   cd backend
   npm install
   cd ..
   ```

3. **Environment Configuration**
   ```bash
   # Copy environment template
   cp backend/.env.example backend/.env
   
   # Edit environment variables
   # Add your API keys and configuration
   ```

4. **Start development servers**
   ```bash
   # Option 1: Manual start
   npm run dev          # Frontend (http://localhost:3000)
   cd backend && npm run dev  # Backend (http://localhost:3001)
   
   # Option 2: Docker
   docker-compose up --build
   ```

## Development Environment

### VSCode Setup

Recommended VSCode extensions:
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-eslint",
    "ms-playwright.playwright",
    "ms-vscode.vscode-json"
  ]
}
```

### Environment Variables

#### Backend (.env)
```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Cache Configuration
REDIS_URL=redis://localhost:6379

# External APIs (Optional - uses default public endpoints)
NOMINATIM_URL=https://nominatim.openstreetmap.org
OSRM_URL=https://router.project-osrm.org
OVERPASS_URL=https://overpass-api.de/api

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=debug
LOG_FILE=logs/backend.log
```

#### Frontend (.env)
```env
# API Configuration
VITE_API_URL=http://localhost:3001/api

# Map Configuration
VITE_DEFAULT_ZOOM=13
VITE_DEFAULT_LAT=40.7128
VITE_DEFAULT_LNG=-74.0060

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_PWA=false
```

## Code Style Guidelines

### TypeScript Guidelines

1. **Use strict TypeScript configuration**
   ```typescript
   // Always define interfaces for complex objects
   interface Location {
     lat: number;
     lng: number;
   }
   
   interface Marker {
     id: string;
     position: Location;
     title: string;
     description?: string;
   }
   ```

2. **Prefer type unions over any**
   ```typescript
   // Good
   type MapView = 'map' | 'satellite' | 'terrain';
   
   // Avoid
   let mapView: any = 'map';
   ```

3. **Use const assertions for readonly data**
   ```typescript
   const MAP_PROVIDERS = ['osm', 'mapbox', 'google'] as const;
   type MapProvider = typeof MAP_PROVIDERS[number];
   ```

### React Guidelines

1. **Component Structure**
   ```typescript
   // Use functional components with hooks
   interface ComponentProps {
     title: string;
     onAction: (data: SomeType) => void;
   }
   
   const Component: React.FC<ComponentProps> = ({ title, onAction }) => {
     const [state, setState] = useState<StateType>(initialState);
     
     const handleAction = useCallback((data: SomeType) => {
       // Logic here
       onAction(data);
     }, [onAction]);
     
     return <div>{/* JSX */}</div>;
   };
   ```

2. **Custom Hooks**
   ```typescript
   // Extract reusable logic into custom hooks
   const useMapInteraction = (mapRef: React.RefObject<Map>) => {
     const [isInteracting, setIsInteracting] = useState(false);
     
     useEffect(() => {
       const map = mapRef.current;
       if (!map) return;
       
       const handleStart = () => setIsInteracting(true);
       const handleEnd = () => setIsInteracting(false);
       
       map.on('movestart', handleStart);
       map.on('moveend', handleEnd);
       
       return () => {
         map.off('movestart', handleStart);
         map.off('moveend', handleEnd);
       };
     }, [mapRef]);
     
     return isInteracting;
   };
   ```

### CSS/Tailwind Guidelines

1. **Component-based styling**
   ```typescript
   // Use Tailwind classes with semantic grouping
   const buttonClasses = clsx(
     // Base styles
     'px-4 py-2 rounded-lg font-medium transition-colors',
     // Interactive states
     'hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500',
     // Conditional styles
     {
       'bg-blue-500 text-white': variant === 'primary',
       'bg-gray-200 text-gray-900': variant === 'secondary',
       'opacity-50 cursor-not-allowed': disabled,
     }
   );
   ```

2. **Responsive Design**
   ```typescript
   // Mobile-first approach
   <div className="
     w-full p-4
     md:w-96 md:p-6
     lg:w-auto lg:p-8
   ">
   ```

## Component Development

### Creating New Components

1. **Component Template**
   ```typescript
   // src/components/Category/ComponentName.tsx
   import React from 'react';
   import { clsx } from 'clsx';
   
   interface ComponentNameProps {
     className?: string;
     // Add other props
   }
   
   const ComponentName: React.FC<ComponentNameProps> = ({
     className,
     // Destructure other props
   }) => {
     return (
       <div className={clsx('base-classes', className)}>
         {/* Component content */}
       </div>
     );
   };
   
   export default ComponentName;
   ```

2. **Index file for exports**
   ```typescript
   // src/components/Category/index.ts
   export { default as ComponentName } from './ComponentName';
   export type { ComponentNameProps } from './ComponentName';
   ```

### Map Component Guidelines

1. **Leaflet Integration**
   ```typescript
   import { useMap, useMapEvents } from 'react-leaflet';
   
   const MapEventHandler: React.FC<{ onMapClick: (lat: number, lng: number) => void }> = ({
     onMapClick
   }) => {
     useMapEvents({
       click: (e) => {
         onMapClick(e.latlng.lat, e.latlng.lng);
       },
     });
     
     return null;
   };
   ```

2. **Performance Considerations**
   ```typescript
   // Memoize expensive calculations
   const processedMarkers = useMemo(() => {
     return markers.map(marker => ({
       ...marker,
       processed: expensiveTransformation(marker)
     }));
   }, [markers]);
   
   // Debounce frequent updates
   const debouncedSearch = useCallback(
     debounce((query: string) => {
       performSearch(query);
     }, 300),
     []
   );
   ```

## API Development

### Creating New Endpoints

1. **Route Structure**
   ```typescript
   // backend/src/routes/feature.ts
   import express from 'express';
   import { validateRequest } from '../middleware/validation';
   import { cacheMiddleware } from '../middleware/cache';
   
   const router = express.Router();
   
   router.get('/endpoint',
     validateRequest(['param1', 'param2']),
     cacheMiddleware(300), // 5 minute cache
     async (req, res, next) => {
       try {
         const { param1, param2 } = req.query;
         
         // Business logic
         const result = await businessLogic(param1, param2);
         
         res.json({
           success: true,
           data: result,
           timestamp: new Date().toISOString()
         });
       } catch (error) {
         next(error);
       }
     }
   );
   
   export default router;
   ```

2. **Service Layer**
   ```typescript
   // backend/src/services/featureService.ts
   export class FeatureService {
     private cache: CacheService;
     
     constructor(cache: CacheService) {
       this.cache = cache;
     }
     
     async getData(params: GetDataParams): Promise<DataResponse> {
       const cacheKey = `feature:${JSON.stringify(params)}`;
       
       // Try cache first
       const cached = await this.cache.get(cacheKey);
       if (cached) return cached;
       
       // Fetch from external API
       const data = await this.fetchFromExternalAPI(params);
       
       // Cache the result
       await this.cache.set(cacheKey, data, 300);
       
       return data;
     }
   }
   ```

### Error Handling

```typescript
// backend/src/middleware/errorHandler.ts
export const errorHandler = (
  error: Error,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const statusCode = error.name === 'ValidationError' ? 400 : 500;
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: error.name,
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    },
    timestamp: new Date().toISOString()
  });
};
```

## Testing

### Frontend Testing

1. **Component Tests**
   ```typescript
   // src/components/__tests__/SearchBar.test.tsx
   import { render, screen, fireEvent, waitFor } from '@testing-library/react';
   import { vi } from 'vitest';
   import SearchBar from '../SearchBar';
   
   describe('SearchBar', () => {
     it('should call onLocationSelect when location is selected', async () => {
       const mockOnLocationSelect = vi.fn();
       
       render(<SearchBar onLocationSelect={mockOnLocationSelect} />);
       
       const input = screen.getByRole('textbox');
       fireEvent.change(input, { target: { value: 'New York' } });
       
       await waitFor(() => {
         expect(mockOnLocationSelect).toHaveBeenCalledWith(
           expect.any(Number),
           expect.any(Number),
           expect.any(String)
         );
       });
     });
   });
   ```

2. **Hook Tests**
   ```typescript
   import { renderHook, act } from '@testing-library/react';
   import { useGeolocation } from '../useGeolocation';
   
   describe('useGeolocation', () => {
     it('should return current location', async () => {
       const { result } = renderHook(() => useGeolocation());
       
       act(() => {
         result.current.getCurrentLocation();
       });
       
       await waitFor(() => {
         expect(result.current.location).toBeDefined();
       });
     });
   });
   ```

### Backend Testing

1. **API Tests**
   ```typescript
   // backend/src/__tests__/geocoding.test.ts
   import request from 'supertest';
   import app from '../server';
   
   describe('Geocoding API', () => {
     it('should geocode address', async () => {
       const response = await request(app)
         .get('/api/geocoding/search')
         .query({ q: 'Empire State Building' })
         .expect(200);
       
       expect(response.body.success).toBe(true);
       expect(response.body.data.results).toHaveLength(1);
       expect(response.body.data.results[0]).toHaveProperty('lat');
       expect(response.body.data.results[0]).toHaveProperty('lon');
     });
   });
   ```

## Debugging

### Frontend Debugging

1. **React Developer Tools**
   ```typescript
   // Add displayName for better debugging
   const MapContainer = React.memo(({ children, ...props }) => {
     // Component logic
   });
   MapContainer.displayName = 'MapContainer';
   ```

2. **Console Debugging**
   ```typescript
   // Use structured logging
   const logger = {
     debug: (message: string, data?: any) => {
       if (process.env.NODE_ENV === 'development') {
         console.log(`[DEBUG] ${message}`, data);
       }
     },
     error: (message: string, error?: Error) => {
       console.error(`[ERROR] ${message}`, error);
     }
   };
   ```

### Backend Debugging

1. **Request Logging**
   ```typescript
   // Enhanced logging middleware
   app.use((req, res, next) => {
     const start = Date.now();
     
     res.on('finish', () => {
       const duration = Date.now() - start;
       console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
     });
     
     next();
   });
   ```

2. **Error Tracking**
   ```typescript
   // Add request ID for tracing
   app.use((req, res, next) => {
     req.id = Math.random().toString(36).substr(2, 9);
     res.setHeader('X-Request-ID', req.id);
     next();
   });
   ```

## Performance

### Frontend Optimization

1. **Code Splitting**
   ```typescript
   // Lazy load heavy components
   const RoutePanel = React.lazy(() => import('./components/Routing/RoutePanel'));
   
   function App() {
     return (
       <Suspense fallback={<div>Loading...</div>}>
         <RoutePanel />
       </Suspense>
     );
   }
   ```

2. **Memoization**
   ```typescript
   // Expensive calculations
   const processedData = useMemo(() => {
     return expensiveProcessing(rawData);
   }, [rawData]);
   
   // Event handlers
   const handleClick = useCallback((id: string) => {
     onClick(id);
   }, [onClick]);
   ```

### Backend Optimization

1. **Caching Strategy**
   ```typescript
   // Multi-level caching
   class CacheService {
     private memory = new Map();
     private redis: Redis;
     
     async get(key: string) {
       // Check memory cache first
       if (this.memory.has(key)) {
         return this.memory.get(key);
       }
       
       // Check Redis cache
       const cached = await this.redis.get(key);
       if (cached) {
         const data = JSON.parse(cached);
         this.memory.set(key, data);
         return data;
       }
       
       return null;
     }
   }
   ```

## Deployment

### Production Build

1. **Frontend Build**
   ```bash
   npm run build
   npm run preview  # Test production build
   ```

2. **Backend Build**
   ```bash
   cd backend
   npm run build
   npm start        # Test production build
   ```

### Docker Deployment

1. **Multi-stage Dockerfile**
   ```dockerfile
   # Build stage
   FROM node:18-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   
   # Production stage
   FROM node:18-alpine
   WORKDIR /app
   COPY --from=builder /app/node_modules ./node_modules
   COPY . .
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

### Environment Setup

1. **Production Environment Variables**
   ```env
   NODE_ENV=production
   PORT=3001
   REDIS_URL=redis://redis:6379
   LOG_LEVEL=warn
   RATE_LIMIT_MAX=1000
   ```

## Contributing

### Pull Request Process

1. **Branch Naming**
   ```
   feature/add-new-component
   fix/geocoding-error-handling
   docs/update-api-documentation
   refactor/improve-performance
   ```

2. **Commit Messages**
   ```
   feat: add route alternatives display
   fix: handle geocoding API errors gracefully
   docs: update component documentation
   refactor: improve map performance with memoization
   test: add unit tests for search functionality
   ```

3. **Code Review Checklist**
   - [ ] Code follows style guidelines
   - [ ] Tests are included and passing
   - [ ] Documentation is updated
   - [ ] Performance impact considered
   - [ ] Error handling implemented
   - [ ] Accessibility requirements met

### Development Workflow

1. Create feature branch from `main`
2. Implement changes with tests
3. Update documentation
4. Submit pull request
5. Address review feedback
6. Merge after approval

---

For more detailed information, refer to:
- [Architecture Documentation](./ARCHITECTURE.md)
- [API Documentation](./API.md)
- [README](./README.md)
