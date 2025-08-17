# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
```bash
# Start development - run frontend and backend simultaneously
npm run dev                    # Frontend on port 3000
npm run dev:backend            # Backend on port 3001 (separate terminal)

# Build and check code quality
npm run build                  # TypeScript compile + Vite build
npm run lint                   # ESLint with strict TypeScript rules
npm run typecheck              # TypeScript type checking without emit

# Backend commands (from backend/ directory)
cd backend && npm run dev      # Backend development server
cd backend && npm run build    # Backend TypeScript compilation
cd backend && npm run lint     # Backend ESLint
cd backend && npm run typecheck # Backend type checking
```

### Platform-Specific Builds
```bash
# Desktop applications
npm run electron:dev           # Electron development mode
npm run build:electron-win     # Windows desktop app build

# Other platforms (require additional setup)
npm run build:pwa             # Progressive Web App build
npm run build:docker          # Docker containerized build
```

## Architecture Overview

### Core System: Dynamic Location Explorer
The application features a revolutionary **Dynamic Location Explorer** that provides API-driven hierarchical navigation:

- **Hierarchical Structure**: World → Continents → Countries → States/Regions → Cities
- **API Integration**: Uses Overpass API, Nominatim, REST Countries API for real-time data
- **Persistent Caching**: IndexedDB-based caching with manual refresh control
- **Tree Structure**: Expandable tree navigation with proper parent-child relationships

**Key Service**: `src/services/dynamicLocationService.ts`
- Manages the entire hierarchical location loading system
- Handles API calls to multiple geographic data sources
- Implements persistent caching strategy (no time expiration)
- Prevents recursive loading and cross-border data pollution
- Provides proper geographical containment validation

### Map Pack System Architecture
Two complementary systems work together:

1. **Dynamic Location Explorer** (`DynamicLocationExplorer.tsx`)
   - Real-time API-driven location discovery
   - Hierarchical tree navigation
   - Persistent caching until manual refresh

2. **Global Map Pack System** (`GlobalMapManager.tsx`)
   - Pre-defined map pack downloads
   - 4-tab interface: World Hierarchy, Custom Packs, Draw Area, Downloads
   - Advanced polygon drawing and editing for custom areas
   - Parallel tile downloading (20x speed improvement)

### Polygon Editing System
Revolutionary polygon editing system for precise map pack boundary management:

**Key Component**: `src/components/PolygonEditor.tsx`
- **Draggable Vertices**: Each polygon point can be dragged to reposition
- **Multi-Selection**: Ctrl+Click to select multiple points for batch operations
- **Point Insertion**: Click gray midpoint markers to add new vertices
- **Point Deletion**: Remove individual or multiple points with validation
- **Visual Feedback**: Color-coded editing states and real-time polygon updates

**User Interface Features**:
- 🔵 **Draggable Points**: Blue/purple markers for existing vertices
- 🟢 **Selected Points**: Green highlighting for selected vertices
- ⚪ **Insertion Points**: Gray midpoint markers for adding new vertices
- 📐 **Selection Outline**: Dashed line connecting multi-selected points
- 🔧 **Floating Toolbar**: Context-sensitive editing instructions

**Integration Points**:
- Custom map pack editing via "Edit Shape" button
- Real-time polygon validation and saving
- Seamless integration with existing map pack system
- Support for complex administrative boundary polygons

### Frontend Architecture
```
src/
├── components/
│   ├── DynamicLocationExplorer.tsx    # API-driven hierarchical explorer
│   ├── GlobalMapManager.tsx           # Pre-defined map pack system
│   ├── Map/MapContainer.tsx           # Main Leaflet map wrapper
│   ├── Search/SearchBar.tsx           # Global location search
│   ├── Routing/RoutePanel.tsx         # Multi-modal routing interface
│   └── UI/                            # Map controls and mobile interface
├── services/
│   ├── dynamicLocationService.ts      # Core hierarchical location system
│   ├── globalMapPackSystem.ts         # Pre-defined map pack management
│   ├── offlineTileCache.ts            # IndexedDB tile storage
│   ├── geocoding.ts                   # Location search services
│   └── routing.ts                     # Multi-modal routing (OSRM, Valhalla)
├── data/
│   └── globalMapHierarchy.ts          # Pre-loaded location hierarchy
└── config/
    ├── mapLayers.ts                   # Tile layer definitions
    └── mapPacks.ts                    # Legacy map pack configuration
```

### Backend Architecture
```
backend/src/
├── server.ts                          # Express server setup
├── routes/
│   ├── geocoding.ts                   # Nominatim proxy with caching
│   ├── routing.ts                     # OSRM/Valhalla routing proxy
│   └── places.ts                      # Places search and POI data
├── services/
│   └── cache.ts                       # Redis caching layer
└── middleware/
    ├── errorHandler.ts                # Centralized error handling
    └── logger.ts                      # Request logging
```

## Key Technical Concepts

### Dynamic Location Loading
The system uses a sophisticated API strategy:
- **Primary APIs**: Overpass API for administrative boundaries, Nominatim for cities
- **Fallback Strategy**: Hardcoded data when APIs fail
- **Geographical Filtering**: Strict bounds checking to prevent cross-border pollution
- **Request Deduplication**: Promise caching to prevent duplicate API calls

### Caching Strategy
- **Persistent Cache**: No time-based expiration, only manual refresh
- **Hierarchical Storage**: Parent-child relationships preserved in IndexedDB
- **Memory + Database**: Two-layer caching for optimal performance
- **Smart Invalidation**: Automatic clearing of problematic cached data

### Map Tile Management
- **Parallel Downloads**: 20 concurrent tile downloads for speed
- **Tile Deduplication**: Shared tiles across overlapping map packs
- **IndexedDB Storage**: Browser-based persistent tile storage
- **Progress Tracking**: Real-time download progress with ETA

### Offline Functionality
- **Offline Routing**: Mathematical route calculation when APIs unavailable
- **Cached Geocoding**: Reverse geocoding from cached tile data
- **Service Workers**: PWA capabilities for offline map usage
- **Persistent State**: Map position, layer selection, and downloaded areas survive app restarts

## Development Guidelines

### Working with Dynamic Location Explorer
When modifying the location hierarchy system:
- Always test with `npm run typecheck` after changes
- Use browser console `testDynamicLocationService.testDenmark()` for debugging
- Check browser DevTools → Application → IndexedDB → `openmaps_locations` for cache state
- Clear cache with `testDynamicLocationService.clearCache()` when testing changes

### Working with Polygon Editing System
When modifying the polygon editing features:
- Test with both simple (4-point) and complex (50+ point) polygons
- Verify multi-selection works with Ctrl+Click on different browsers
- Test point insertion by clicking midpoint markers
- Ensure polygon validation prevents invalid shapes (< 3 points)
- Check that drag operations update polygon data correctly
- Verify "Edit Shape" button toggles editing mode properly
- Test floating toolbar appears/disappears correctly

### API Integration
- The system uses multiple APIs: Overpass, Nominatim, REST Countries, OSRM, Valhalla
- All API calls go through the backend proxy for CORS and caching
- Backend runs on port 3001, configure `backend/.env` for API endpoints
- Redis caching improves API response times significantly

### Map Pack Development
- Pre-defined packs in `src/data/globalMapHierarchy.ts`
- Custom polygon areas created through interactive drawing
- Tile estimation algorithms in `globalMapPackSystem.ts`
- Download progress tracked in `OfflineStatusIndicator.tsx`

### Mobile Responsiveness
- `MobileBottomSheet.tsx` provides mobile-optimized UI
- `useMediaQuery.ts` hook for responsive behavior
- Touch gestures supported through Leaflet mobile plugins
- PWA capabilities for mobile app-like experience

## Environment Configuration

### Frontend (.env.local)
```bash
VITE_BACKEND_URL=http://localhost:3001
VITE_FORCE_OFFLINE_ROUTING=true
```

### Backend (backend/.env)
```bash
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
CACHE_TTL=300

# API Endpoints
OSRM_BASE_URL=https://router.project-osrm.org/route/v1
VALHALLA_BASE_URL=https://valhalla1.openstreetmap.de
GRAPHHOPPER_BASE_URL=https://graphhopper.com/api/1/route
```

## Common Development Tasks

### Adding New Administrative Regions
1. Extend bounds in `dynamicLocationService.ts` → `calculateCountryBounds()`
2. Test with browser console: `testDynamicLocationService.testCountry()`
3. Verify geographical containment in browser DevTools

### Debugging Location Loading Issues
1. Check browser console for API errors and geographical bounds
2. Inspect network tab for failed API requests
3. Use `testDynamicLocationService.nuclearClear()` to reset all data
4. Verify API responses with direct URL testing

### Performance Optimization
- Monitor tile download speeds in Downloads tab
- Adjust parallel download count in `globalMapPackSystem.ts`
- Use browser DevTools → Performance to profile map rendering
- Check IndexedDB storage usage in DevTools → Application

### Testing Offline Functionality
1. Download a small map pack first
2. Disconnect internet or use DevTools offline mode
3. Test map navigation, routing, and search functionality
4. Verify persistent storage across browser restarts

## Troubleshooting

### Common Issues
- **Port conflicts**: Frontend 3000, Backend 3001 - ensure both are available
- **API failures**: Check backend logs for external API connectivity issues
- **Cache corruption**: Use `testDynamicLocationService.clearCache()` to reset
- **TypeScript errors**: Run `npm run typecheck` to identify type issues
- **Build failures**: Ensure all dependencies installed with `npm install`

### Polygon Editing Issues
- **Points not draggable**: Check that `editingPolygonId` state is set correctly
- **Multi-selection not working**: Verify Ctrl+Click event handling in browser
- **Insertion points not visible**: Ensure polygon has enough points (≥3) and editing mode is active
- **Polygon not saving**: Check `globalMapPackSystem.updateCustomPack()` calls in browser console
- **Floating toolbar missing**: Verify `editingPolygonId` state is not null
- **Performance issues**: Test with simplified polygons (use polygon simplification for 1000+ points)

### Development Environment
- Node.js 18+ required for optimal performance
- Modern browser with IndexedDB support essential
- Redis optional but recommended for backend caching
- Stable internet connection needed for API-dependent features