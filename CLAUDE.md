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
   - 5-tab interface: Dynamic Explorer, Offline Tiles, Custom Packs, Draw Area, Downloads
   - Advanced polygon drawing and editing for custom areas
   - Parallel tile downloading (20x speed improvement)
   - Comprehensive offline tile management and storage analytics

### Polygon Editing System
Revolutionary polygon editing system for precise map pack boundary management:

**Key Component**: `src/components/PolygonEditor.tsx`
- **Draggable Vertices**: Each polygon point can be dragged to reposition
- **Multi-Selection**: Ctrl+Click to select multiple points for batch operations
- **Point Insertion**: Click gray midpoint markers to add new vertices
- **Point Deletion**: Remove individual or multiple points with validation
- **Visual Feedback**: Color-coded editing states and real-time polygon updates
- **Performance Optimization**: Adaptive rendering for large polygons (100+ points)
- **Zoom-Aware Display**: Point density adjusts based on map zoom level

**User Interface Features**:
- 🔵 **Draggable Points**: Blue/purple markers for existing vertices
- 🟢 **Selected Points**: Green highlighting for selected vertices
- ⚪ **Insertion Points**: Gray midpoint markers for adding new vertices (optimized for large polygons)
- 📐 **Selection Outline**: Dashed line connecting multi-selected points
- 🔧 **Floating Toolbar**: Context-sensitive editing instructions
- 🎯 **Smart Zoom**: Auto-fits map to polygon bounds when editing starts
- ⚡ **Adaptive UI**: Reduces visual clutter on large polygons at low zoom levels

**Integration Points**:
- Custom map pack editing via "Edit Shape" button
- Real-time polygon validation and saving
- Seamless integration with existing map pack system
- Support for complex administrative boundary polygons
- Optimized for shapes with hundreds of vertices

### Multi-Layer Map Pack System
Advanced multi-layer support with flexible configuration options:

**Key Features**:
- **Multiple Layer Support**: Each map pack can contain multiple map layers (OSM, satellite, terrain, etc.)
- **Copy with Customization**: Copy existing packs with different layer/zoom combinations
- **Layer Selection UI**: Visual interface for selecting multiple layers in copy modal
- **Zoom Level Configuration**: Granular control over zoom levels (1-18) with quick presets
- **Smart Estimation**: Real-time tile count and size estimation based on layer/zoom selection

**Key Component**: `src/components/CopyMapPackModal.tsx`
- **Layer Selection**: Multi-checkbox interface for available layers
- **Zoom Level Grid**: Visual grid interface for selecting zoom levels (1-18)
- **Quick Presets**: Low (1-10), Medium (8-15), High (12-18) zoom level presets
- **Real-time Estimation**: Live updates of estimated tile count and download size
- **Copy Options**: Custom name, description, and configuration for copied packs

**User Interface Elements**:
- 📋 **Copy Button**: Available on each custom pack card
- 🎯 **Layer Display**: Shows layer count and zoom range in pack details
- ⚡ **Quick Selection**: Preset buttons for common zoom level ranges
- 📊 **Size Estimation**: Real-time calculation of download size and tile count
- ⚠️ **Size Warnings**: Alerts for large downloads (>500MB)

### Offline Tile Management System
Revolutionary offline storage management with comprehensive analytics and cleanup tools:

**Key Features**:
- **Real-time Storage Analytics**: Live statistics showing total tiles, storage usage, and organization
- **Layer-based Organization**: View and manage tiles by map layer (OSM, satellite, terrain)
- **Pack Association Tracking**: See which tiles belong to which map packs
- **Orphaned Tile Detection**: Identify and clean up unassociated tiles from deleted packs
- **Granular Deletion**: Remove tiles by layer, pack, or cleanup all orphaned tiles
- **Re-download Capabilities**: Update existing packs when settings change

**Key Components**:
- **Offline Tiles Tab**: Replaces static hierarchy with dynamic tile management interface
- **Storage Overview**: Total tiles and MB usage with real-time refresh
- **Tiles by Layer Section**: Green-coded interface showing tiles organized by map layer
- **Tiles by Pack Section**: Purple-coded interface linking tiles to their originating packs
- **Unassociated Tiles Section**: Orange-coded warning for orphaned tiles needing cleanup

**User Interface Elements**:
- 💾 **Offline Tiles Tab**: New dedicated tab for comprehensive tile management
- 📊 **Storage Overview**: Real-time statistics with tile count and storage size
- 🗺️ **Layer Management**: View and delete tiles by specific map layers
- 📍 **Pack Association**: See which packs own which tiles with pack metadata
- ⚠️ **Orphaned Cleanup**: Identify and remove tiles not belonging to any current pack
- 🔄 **Re-download Button**: Update downloaded packs with current settings
- 🗑️ **Selective Deletion**: Granular control over tile cleanup with confirmation dialogs

**Technical Implementation**:
- **Geographic Validation**: Tiles are associated with packs through boundary checking
- **Layer/Zoom Verification**: Ensures tiles match pack configuration requirements
- **Size Estimation**: Accurate storage calculations using 20KB average per tile
- **Legacy Migration**: Automatic upgrade of old packs missing layer/routing properties
- **Confirmation Safety**: All destructive operations require detailed confirmation dialogs

### Enhanced Custom Pack Features
Advanced map pack configuration with comprehensive layer and routing options:

**Layer Selection Interface**:
- **Multi-layer Support**: Select multiple tile layers (OSM, satellite, terrain) per pack
- **Visual Layer Picker**: Checkbox interface with layer names and IDs
- **Real-time Validation**: Prevents creating packs without selected layers
- **Layer Count Display**: Shows selected layer count in pack details

**Offline Routing Configuration**:
- **Routing Toggle**: Enable/disable offline route finding per pack
- **Engine Selection**: Choose between BRouter (high quality) and Internal (basic) routing
- **Conditional UI**: Routing options appear only when enabled
- **Pack-specific Settings**: Each pack can have different routing configurations

**Re-download Functionality**:
- **Settings-aware Updates**: Re-download packs when layer/zoom/routing settings change
- **Confirmation Workflow**: Shows current pack settings before re-downloading
- **Status Management**: Automatically updates pack download status
- **Progressive Enhancement**: Existing packs continue working while new features are available

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
│   ├── tiles.ts                       # Tile proxy service for CORS resolution
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
- **Performance Testing**: Test with very large polygons (200+ points) to verify:
  - Zoom-aware point rendering works correctly
  - Midpoint optimization reduces visual clutter
  - Selected points remain visible even when others are hidden
- **Drawing Mode Testing**: Verify polygon drawing works correctly:
  - Multiple points can be placed in sequence
  - Map click events don't interfere with point placement
  - Drawing mode indicator shows current progress

### Working with Multi-Layer Map Pack System
When modifying the multi-layer features:
- Test copy functionality with different layer combinations
- Verify estimation calculations update correctly when layers/zoom levels change
- Test quick preset buttons for zoom level selection
- Ensure layer availability detection works with different map pack configurations
- Check that copy modal shows current pack details accurately
- Verify large download warnings appear for >500MB estimates
- Test that copied packs maintain polygon geometry while allowing layer/zoom changes

### Working with Offline Tile Management System
When modifying the offline tile management features:
- Test tile statistics loading with `loadTileStatistics()` function
- Verify tile-to-pack association logic works correctly with `isTileInPack()`
- Test deletion functionality with different tile scenarios (layer-specific, pack-specific, orphaned)
- Ensure confirmation dialogs show accurate impact information before deletion
- Test re-download functionality updates pack settings correctly
- Verify legacy pack migration works for packs missing layer/routing properties
- Check that storage calculations are accurate (20KB average per tile)
- Test empty state handling when no tiles are downloaded
- Verify real-time statistics refresh after tile operations

### Working with Enhanced Custom Pack Features
When modifying the enhanced custom pack features:
- Test layer selection UI with multiple layers selected/deselected
- Verify validation prevents creating packs with zero layers
- Test offline routing toggle and engine selection
- Ensure re-download button appears only for downloaded packs
- Check that pack settings are preserved during editing
- Test form validation for required fields (name, layers)
- Verify layer count display updates correctly in pack details
- Test that routing settings are saved and loaded properly

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
- **Performance issues**: Performance is now optimized for large polygons (up to 1000+ points)
- **Drawing not working**: Check that `isDrawingPolygon` state prevents map click interference
- **Points only show first one**: Verify functional state updates in `onPolygonPointsChange` callback
- **Forced zoom on edit**: Map now auto-fits to polygon bounds instead of fixed zoom level
- **Too many points visible**: Point density now adapts to zoom level for better performance

### Multi-Layer Map Pack Issues
- **Copy button not working**: Check `globalMapPackSystem.copyCustomPack()` method implementation
- **Layer selection not updating**: Verify `availableLayers` state is populated from `getAvailableLayers()`
- **Estimation not updating**: Check that `useEffect` dependencies include `zoomLevels` and `layerIds`
- **Copy modal not opening**: Verify `showCopyModal` state and `copyingPack` are set correctly
- **Large download warnings missing**: Check estimation calculation logic in `CopyMapPackModal`
- **Layer display incorrect**: Verify `pack.layerIds` array is properly populated and displayed

### Offline Tile Management Issues
- **Statistics not loading**: Check `getOfflineTileStatistics()` method and IndexedDB access permissions
- **Tile deletion not working**: Verify `deleteOfflineTilesByLayer()` or `deleteOfflineTilesByPack()` methods in browser console
- **Pack association incorrect**: Check `isTileInPack()` logic for geographic bounds and layer/zoom validation
- **Re-download button missing**: Ensure pack `isDownloaded` property is true and no active downloads
- **Storage calculations wrong**: Verify 20KB average tile size estimation in statistics calculation
- **Orphaned tiles not detected**: Check that pack boundary validation correctly identifies unassociated tiles
- **Confirmation dialogs missing info**: Verify statistics are loaded before showing deletion confirmations

### Enhanced Custom Pack Issues
- **Layer selection not working**: Check `getAvailableLayers()` returns proper layer list from map pack system
- **No layers validation failing**: Verify `customPackForm.layerIds.length === 0` validation in create/edit functions
- **Routing options not saving**: Check `enableOfflineRouting` and `routingEngine` properties in pack interface
- **Re-download not updating settings**: Verify `forceRedownload=true` parameter is passed to `downloadCustomPack()`
- **Legacy packs missing properties**: Check migration logic in `loadCustomPacks()` adds missing layer/routing properties
- **Form validation not preventing submission**: Ensure validation runs before `createCustomPack()` calls

### Development Environment
- Node.js 18+ required for optimal performance
- Modern browser with IndexedDB support essential
- Redis optional but recommended for backend caching
- Stable internet connection needed for API-dependent features