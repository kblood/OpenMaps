# 🌍 OpenMaps - Global Dynamic Offline Map System

**OpenMaps** is an advanced open-source mapping application with a revolutionary dynamic offline map pack system. Features real-time API-driven location loading, custom polygon areas, and intelligent tile management with complete offline functionality.

## ✨ Key Features

### 🗺️ **Global Hierarchical Navigation**
- **7-Level Hierarchy**: World → Continents → Countries → States/Regions → Cities → City Sections → Custom Areas
- **Smart Search**: Global search across 500+ preloaded locations with fuzzy matching
- **Offline Capability**: All capitals, top 1000 cities, and major regions work without internet
- **Dynamic Loading**: Smaller locations load on-demand when online
- **Level Navigation**: Jump directly to any hierarchy level via dropdown menu

### ✏️ **Advanced Polygon Drawing & Editing System**
- **Interactive Drawing**: Click on map to define custom areas with precise polygon boundaries
- **Professional Editing**: Drag vertices, multi-select with Ctrl+Click, insert/delete points
- **Smart Estimation**: Automatic tile count and size calculation based on zoom levels
- **Flexible Configuration**: Choose zoom ranges (1-18), map layers, and custom descriptions
- **Real-time Preview**: See your polygon and estimated download size as you draw
- **Performance Optimized**: Handles large polygons (1000+ points) with zoom-aware rendering
- **Auto-Fit Editing**: Map automatically fits to polygon bounds for optimal editing experience

### ⚡ **Ultra-Fast Download System**
- **20x Parallel Downloads**: Download up to 20 tiles simultaneously for maximum speed
- **Smart Progress Tracking**: Real-time speed monitoring with ETA calculations
- **Tile Deduplication**: Hierarchical areas share common tiles to save storage space
- **Resume Capability**: Automatically resume interrupted downloads

### 🎨 **Advanced 4-Tab Interface**
- **🌍 World Hierarchy**: Navigate the global map structure with breadcrumb navigation
- **� Custom Packs**: Manage and download polygon-based custom areas
- **✏️ Draw Area**: Interactive map polygon drawing with configuration options
- **⬇️ Downloads**: Monitor all active downloads with detailed progress metrics

### � **Enhanced Routing & Search**
- **Multi-modal routing**: Driving (OSRM), Walking/Cycling (Valhalla), specialized profiles
- **Offline Routing**: Mathematical route calculation when internet isn't available
- **Global Search**: Find any location worldwide with smart ranking and GPS coordinate support
- **Recent Locations**: Quick access clipboard with persistent storage

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **npm**
- Modern web browser (Chrome, Firefox, Safari, Edge)
- **For Desktop**: Electron build system

### Installation & Development
```bash
git clone <repository-url>
cd OpenMaps
npm install
npm run dev
```

### Desktop Application
```bash
# Build for Windows
npm run build:electron-win

# Build installer
npm run build:installer

# Quick Electron development
npm run electron:dev
```

## 🗺️ How to Use the Global Map Pack System

### **Exploring the Global Hierarchy**

1. **Open Map Pack Manager**: Click the map pack button (🗺️) in the top-left corner
2. **Navigate Hierarchy**: 
   - Use the level dropdown to jump to continents, countries, cities, etc.
   - Click "Explore" on any location to dive deeper into sub-regions
   - Use breadcrumbs to navigate back up the hierarchy
3. **Search Globally**: Type any location name for instant fuzzy-matched results with population data
4. **Download Areas**: Click "Download" on any location to cache it for offline use

### **Creating & Editing Custom Map Areas**

#### **Drawing New Polygons**
1. **Switch to Draw Area Tab**: Click the "✏️ Draw Area" tab in the Map Pack Manager
2. **Start Drawing**: Click "Start Drawing Polygon" and click points on the map to define your area
3. **Complete Drawing**: Click "Finish Drawing" or the last point to close the polygon
4. **Configure Settings**:
   - Enter a descriptive name and optional description
   - Choose zoom levels (1-18: higher = more detail, larger file size)
   - Select map layers (OpenStreetMap, Satellite, Terrain, etc.)
5. **Create Pack**: Click "Create Custom Pack" to generate your downloadable area

#### **Editing Existing Polygons**
1. **Open Custom Packs Tab**: Navigate to your saved custom polygons
2. **Start Editing**: Click "Edit Shape" button on any custom pack
3. **Edit Vertices**: 
   - **Drag points** to reposition them
   - **Ctrl+Click** to select multiple points
   - **Click gray midpoints** to insert new vertices
   - **Delete button** to remove selected points
4. **Finish Editing**: Click "Finish Editing" to save your changes
5. **Performance**: Large polygons automatically optimize point visibility based on zoom level

#### **Download & Management**
- **Download**: Your custom pack appears in the Custom Packs tab, ready for download
- **Copy Packs**: Use the copy button to create variations with different zoom/layer settings

### **Managing Downloads & Progress**

- **Monitor Progress**: Switch to "Downloads" tab to see real-time progress with speed and ETA
- **Background Processing**: Downloads continue while you navigate and use other features
- **Persistent Storage**: Downloaded areas persist across app restarts in IndexedDB
- **Smart Sharing**: Hierarchical areas automatically share overlapping tiles to save space

## 📊 Performance Improvements

| Feature | Before | After | Improvement |
|---------|--------|-------|-------------|
| Download Speed | 6% in 10 minutes | 100% in 2-3 minutes | **20x faster** |
| Parallel Downloads | 1 tile at a time | 20 tiles simultaneously | **20x parallelization** |
| Tile Deduplication | None | Smart sharing across packs | **50-80% storage savings** |
| Search Performance | Basic text match | Fuzzy search with ranking | **Advanced relevance** |
| Hierarchy Navigation | None | 7-level global structure | **Intuitive browsing** |
| Polygon Drawing | Single point placement | Multi-point sequential drawing | **Fixed drawing workflow** |
| Polygon Editing | Fixed zoom, poor UX | Auto-fit bounds, optimized UI | **Professional editing** |
| Large Polygon Performance | Slow, cluttered | Zoom-aware rendering | **1000+ points supported** |

## 🏗️ Architecture

### **Global Hierarchy Structure**
```
🌍 World (1M+ tiles, ~20GB)
├── 🌎 North America (150K tiles, ~3GB)
│   ├── 🇺🇸 United States (80K tiles, ~1.6GB)
│   │   ├── 🏞️ California (15K tiles, ~300MB)
│   │   │   ├── 🏙️ Los Angeles (8K tiles, ~160MB)
│   │   │   │   ├── 🏘️ Downtown LA (2K tiles, ~40MB)
│   │   │   │   └── 🏘️ Hollywood (2K tiles, ~40MB)
│   │   │   └── 🏙️ San Francisco (6K tiles, ~120MB)
│   │   └── 🏞️ Texas (12K tiles, ~240MB)
│   └── 🇨🇦 Canada (25K tiles, ~500MB)
├── 🌍 Europe (100K tiles, ~2GB)
│   ├── 🇬🇧 United Kingdom (25K tiles, ~500MB)
│   │   ├── 🏞️ England (20K tiles, ~400MB)
│   │   │   ├── 🏙️ London (8K tiles, ~160MB)
│   │   │   │   ├── 🏘️ Central London (2K tiles, ~40MB)
│   │   │   │   └── 🏘️ Westminster (1.5K tiles, ~30MB)
│   │   │   └── 🏙️ Manchester (3K tiles, ~60MB)
│   │   └── 🏞️ Scotland (3K tiles, ~60MB)
│   └── 🇫🇷 France (20K tiles, ~400MB)
└── 🌏 Asia (200K tiles, ~4GB)
    ├── 🇨🇳 China (75K tiles, ~1.5GB)
    ├── 🇯🇵 Japan (30K tiles, ~600MB)
    └── 🇮🇳 India (50K tiles, ~1GB)
```

### **Tech Stack**

#### Frontend
- **React 18** with TypeScript for robust UI development
- **Leaflet** for interactive maps with polygon drawing support
- **Tailwind CSS** for responsive, modern styling
- **Vite** for fast build tooling and hot module replacement

#### Backend
- **Node.js** with Express for API endpoints
- **TypeScript** for type safety across the stack
- **Redis** for intelligent caching of geocoding and routing results
- **Axios** for reliable HTTP requests to external services

#### Data Sources
- **OpenStreetMap** for comprehensive global map tiles
- **Nominatim** for forward and reverse geocoding
- **OSRM** for high-performance driving routes
- **Valhalla** for pedestrian and cycling routes with superior path coverage
- **GraphHopper** for specialized routing profiles (fallback)
- **Overpass API** for places and points of interest data

#### Storage & Performance
- **IndexedDB**: Browser-based persistent storage for offline tiles
- **Service Workers**: PWA capabilities for offline functionality
- **Web Workers**: Background tile processing and downloads
- **Smart Caching**: Hierarchical tile deduplication and sharing

### **Component Architecture**
```
src/
├── components/
│   ├── GlobalMapManager.tsx      # 4-tab hierarchical interface
│   ├── Map/                      # Leaflet map components
│   │   ├── MapContainer.tsx      # Main map wrapper
│   │   └── PolygonDrawing.tsx    # Interactive polygon tools
│   ├── Search/                   # Global search with GPS support
│   │   ├── SearchBar.tsx         # Main search component
│   │   └── RecentLocations.tsx   # Recent locations dropdown
│   ├── Routing/                  # Enhanced routing system
│   │   ├── RoutePanel.tsx        # Multi-modal route interface
│   │   └── OfflineRouting.tsx    # Mathematical route calculation
│   └── UI/                       # Map controls and interface
├── services/
│   ├── globalMapPackSystem.ts    # Hierarchical download system
│   ├── offlineRouting.ts         # Mathematical route calculation
│   ├── geocoding.ts              # Location search and reverse geocoding
│   └── routing.ts                # Multi-modal routing with service selection
├── data/
│   └── globalMapHierarchy.ts     # Preloaded world hierarchy (500+ locations)
├── config/
│   ├── mapLayers.ts              # Map tile layer definitions
│   └── mapPacks.ts               # Legacy pack compatibility
└── hooks/
    ├── useGeolocation.ts         # GPS location tracking
    └── useMediaQuery.ts          # Responsive design utilities
```

### **Data Storage**
- **IndexedDB**: Persistent tile storage with smart indexing by hierarchy and custom packs
- **Hierarchical Indexing**: Tiles indexed by global nodes, custom packs, and visited areas
- **Deduplication**: Multiple areas automatically share common tiles to minimize storage
- **Compression**: Efficient blob-based tile caching with metadata tracking

## 🛠️ Technical Details

### **Global Map Pack System**
- **Zoom Levels**: 1-15 (1=world overview, 15=street-level detail)
- **Tile Format**: Standard 256x256 pixels, ~20KB average per tile
- **Coordinate System**: Web Mercator (EPSG:3857)
- **Sources**: OpenStreetMap, Satellite imagery, Terrain layers

### **Download System**
- **Parallel Processing**: 20 concurrent tile downloads for maximum speed
- **Smart Queuing**: Priority-based download management with resume capability
- **Error Handling**: Automatic retry with exponential backoff for failed tiles
- **Progress Tracking**: Real-time statistics, speed monitoring, and ETA calculation

### **Search & Navigation**
- **Fuzzy Matching**: Token-based search with partial word matching
- **Smart Ranking**: Population, capital status, and hierarchy level-based scoring
- **Preloaded Index**: 500+ locations (capitals, major cities, regions) available offline
- **Dynamic Expansion**: Additional locations loaded on-demand when online

### **Polygon Drawing & Custom Areas**
- **Interactive Drawing**: Click-based polygon definition with real-time preview
- **Precise Tile Calculation**: Polygon-tile intersection algorithms for accurate estimates
- **Configurable Quality**: User-selectable zoom levels for size vs. detail tradeoff
- **Multi-layer Support**: Download custom areas with multiple map layer types

## 🔧 Configuration

### **Environment Variables**
```bash
# Frontend
VITE_BACKEND_URL=http://localhost:3001  # Backend API URL
VITE_FORCE_OFFLINE_ROUTING=true         # Force offline routing mode

# Backend
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
CACHE_TTL=300

# Routing Services
OSRM_BASE_URL=https://router.project-osrm.org/route/v1
VALHALLA_BASE_URL=https://valhalla1.openstreetmap.de
GRAPHHOPPER_BASE_URL=https://graphhopper.com/api/1/route
```

### **Custom Map Layer Configuration**
Edit `src/config/mapLayers.ts` to add custom tile sources:
```typescript
{
  id: 'custom-satellite',
  name: 'Custom Satellite',
  url: 'https://your-tile-server.com/{z}/{x}/{y}.png',
  attribution: '© Your Data Provider',
  maxZoom: 18,
  tileSize: 256
}
```

### **Hierarchy Customization**
Extend `src/data/globalMapHierarchy.ts` to add new regions:
```typescript
{
  id: 'custom_region',
  name: 'Custom Region',
  level: 'region',
  parentId: 'parent_country',
  bounds: { north: 45.0, south: 40.0, east: 10.0, west: 5.0 },
  center: { lat: 42.5, lng: 7.5 },
  estimatedTiles: 5000,
  estimatedSizeMB: 100,
  isPreloaded: true,
  priority: 4,
  tags: ['custom', 'region']
}
```

## 📱 Mobile & Desktop Support

### **Progressive Web App (PWA)**
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Touch Support**: Full gesture support for mobile map interaction
- **Offline Capability**: Service worker caching for core functionality
- **Installable**: Can be installed directly from browser on mobile devices

### **Desktop Application (Electron)**
- **Cross-platform**: Windows, macOS, and Linux support
- **Native Features**: File system access, system notifications, menu integration
- **Enhanced Storage**: Unlimited tile storage compared to browser limitations
- **Background Downloads**: Continue downloads when app is minimized

## 🔍 API Endpoints

### Geocoding
- `GET /api/geocoding/search?q={query}` - Forward geocoding with autocomplete
- `GET /api/geocoding/reverse?lat={lat}&lon={lon}` - Reverse geocoding
- `GET /api/geocoding/autocomplete?q={query}` - Search suggestions

### Routing  
- `GET /api/routing/directions?start={lat,lng}&end={lat,lng}&profile={mode}` - Get route
- `GET /api/routing/alternatives?start={lat,lng}&end={lat,lng}&profile={mode}` - Route alternatives
- `POST /api/routing/matrix` - Route matrix for multiple points

**Supported Profiles**: `driving`, `walking`, `running`, `cycling`, `hiking`, `mountain_biking`, `racing_bike`

### Places
- `GET /api/places/search?q={query}` - Search points of interest
- `GET /api/places/{id}` - Get detailed place information
- `GET /api/places/nearby/{category}?lat={lat}&lon={lon}` - Find nearby places

## 🚀 Troubleshooting

### Map Pack Download Issues

If downloads are slow or failing:
1. **Check Network**: Verify stable internet connection for tile downloads
2. **Browser Storage**: Ensure browser has sufficient storage space available
3. **Clear Cache**: Clear IndexedDB if downloads seem stuck or corrupted
4. **Reduce Parallelism**: Lower concurrent downloads in globalMapPackSystem.ts if experiencing timeouts

### Polygon Drawing Issues

If polygon drawing isn't working:
1. **Map Instance**: Ensure map is fully loaded before starting polygon drawing
2. **Click Detection**: Verify click events aren't being intercepted by other map controls
3. **Browser Console**: Check for JavaScript errors during drawing operations
4. **Clear Drawing**: Use "Clear & Start Over" if polygon state becomes inconsistent

### Search and Navigation Issues

If global search isn't finding locations:
1. **Offline vs Online**: Some locations only available when connected to internet
2. **Search Terms**: Try different spellings or abbreviations for location names
3. **Hierarchy Navigation**: Use breadcrumbs and level selector as alternative navigation
4. **Browser Storage**: Recent searches stored in localStorage may need clearing

### Performance Issues

If the app is running slowly:
1. **Reduce Zoom Levels**: Lower maximum zoom for custom packs to reduce tile count
2. **Limit Download Size**: Start with smaller areas before attempting large regions
3. **Browser Memory**: Close other tabs to free up memory for tile processing
4. **Check Progress**: Use Downloads tab to monitor active operations

## 🤝 Contributing

### Development Setup
1. **Fork the repository** on GitHub
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Install dependencies**: `npm install`
4. **Start development server**: `npm run dev`
5. **Test your changes** thoroughly
6. **Commit changes**: `git commit -m 'Add amazing feature'`
7. **Push to branch**: `git push origin feature/amazing-feature`
8. **Open a Pull Request** with detailed description

### **Development Guidelines**
- **TypeScript**: Maintain strict type safety across all components
- **Component Modularity**: Keep components focused and reusable
- **Error Handling**: Add comprehensive error boundaries and user feedback
- **Performance**: Optimize for both online and offline scenarios
- **Testing**: Include unit tests for critical functionality
- **Documentation**: Update README and inline comments for new features

### **Code Style**
- Use ESLint and Prettier for consistent formatting
- Follow React hooks best practices
- Implement proper cleanup in useEffect hooks
- Use semantic component and variable naming
- Add JSDoc comments for complex functions

### **Areas for Contribution**
- **Additional Map Sources**: Integration with more tile providers
- **Enhanced Routing**: More transportation modes and route optimization
- **Mobile Optimization**: Improved touch interactions and mobile UI
- **Offline Features**: Expanded offline capabilities and data management
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- **Performance**: Further optimization of download speeds and memory usage

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for complete details.

### Key License Points:
- ✅ **Commercial Use**: Free to use in commercial projects
- ✅ **Modification**: Free to modify and distribute modified versions  
- ✅ **Distribution**: Free to distribute original or modified versions
- ✅ **Private Use**: Free to use privately without restriction
- ⚠️ **Attribution**: Must include original license and copyright notice
- ❌ **Warranty**: No warranty provided, use at your own risk

## 🙏 Acknowledgments

### **Mapping & Data Sources**
- **[OpenStreetMap](https://www.openstreetmap.org/)**: Comprehensive global map data and tile services
- **[Nominatim](https://nominatim.org/)**: Reliable geocoding and address lookup services
- **[OSRM](http://project-osrm.org/)**: High-performance driving route calculations
- **[Valhalla](https://valhalla.mapzen.com/)**: Advanced pedestrian and cycling routing

### **Technology Stack**
- **[React](https://reactjs.org/)**: Powerful user interface framework
- **[Leaflet](https://leafletjs.com/)**: Excellent interactive mapping library
- **[TypeScript](https://www.typescriptlang.org/)**: Type safety and enhanced development experience
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first styling framework
- **[Vite](https://vitejs.dev/)**: Fast build tool and development server
- **[Electron](https://www.electronjs.org/)**: Cross-platform desktop app framework

### **Community & Inspiration**
- OpenStreetMap contributors worldwide for creating the global map dataset
- The open-source mapping community for continuous innovation
- Contributors and testers who help improve OpenMaps

---

**🌍 Built with ❤️ for offline-first mapping experiences worldwide**

*OpenMaps - Making global maps accessible everywhere, online or offline* ✨
 
## Dynamic Explorer: backend-only data flow (no fallbacks)

Child loading relies solely on the local backend. No third‑party fallbacks are used.
- Country → Regions/States: http://localhost:3001/api/admin/regions?country=CC
- State/Region → Cities: http://localhost:3001/api/admin/cities?relationId=... or ?bbox=...
- Municipality/City/District: treated as leaves unless explicit backend support is added

Caching and refresh:
- Successful loads are cached in memory and IndexedDB. Empty results are not cached.
- Clicking a node’s Refresh forces a backend fetch. If the request fails, existing cached children are preserved and the UI shows “Refresh failed. Showing cached data.”
- Use the global Refresh Data button to clear caches and reload core data.

Troubleshooting missing cities:
- Ensure the backend is running and healthy on port 3001.
- Check backend logs for the regions/cities endpoints.
- After starting/fixing the backend, use the node Refresh to repopulate children.