# Implementation Roadmap: Flexible Map Sources

## 🚀 Phase 1: MBTiles Support (IMMEDIATE - 1-2 days)

### Goal: Give users single-file regional maps instead of thousands of individual tiles

**Step 1.1: Backend MBTiles Reader**
```bash
cd backend && npm install mbtiles better-sqlite3
```

**Step 1.2: Create MBTiles Service**
```typescript
// backend/src/services/mbtilesService.ts
class MBTilesService {
  async getTile(filePath: string, z: number, x: number, y: number): Promise<Buffer>
  async getMetadata(filePath: string): Promise<MBTilesMetadata>
  async listAvailableMBTiles(): Promise<MBTilesInfo[]>
}
```

**Step 1.3: Add MBTiles Route**
```typescript
// backend/src/routes/mbtiles.ts
router.get('/mbtiles/:filename/:z/:x/:y.:ext', async (req, res) => {
  // Serve tiles from local MBTiles files
});
```

**Step 1.4: Frontend MBTiles Config**
```typescript
// Add to mapPacks.ts
{
  id: 'denmark-local',
  name: 'Denmark (Local MBTiles)',
  url: `${BACKEND_URL}/api/mbtiles/denmark.mbtiles/{z}/{x}/{y}.png`,
  type: 'mbtiles-local',
  size: 180_000_000, // 180MB
  isOffline: true
}
```

**Step 1.5: Download Manager UI**
Simple UI to let users:
- Browse available MBTiles downloads
- Download country packs from Geofabrik
- See progress and manage local files

### Expected Outcome:
- Users can download single 200MB file instead of 50,000 individual tiles
- 100x faster loading (SQLite query vs HTTP request)
- Works completely offline
- Fallback to current tile system if MBTiles not available

---

## 📦 Phase 2: Regional Pack Integration (3-5 days)

### Goal: One-click country/region downloads

**Step 2.1: Geofabrik API Integration**
```typescript
// backend/src/services/geofabrikService.ts
interface GeofabrikExtract {
  name: string;
  region: string;
  pbf_url: string;
  mbtiles_url?: string; // If pre-built
  size: number;
  last_modified: Date;
}

async function getAvailableExtracts(): Promise<GeofabrikExtract[]>
async function downloadExtract(region: string): Promise<DownloadProgress>
```

**Step 2.2: MBTiles Generation**
```typescript
// Use tilemaker or similar to convert PBF → MBTiles
// Or use pre-built MBTiles from BBBike extract service
```

**Step 2.3: Regional Pack Manager UI**
```typescript
// src/components/RegionalPackManager.tsx
const RegionalPackManager = () => {
  return (
    <div className="regional-packs">
      <h3>🌍 Download Regional Maps</h3>
      {availablePacks.map(pack => (
        <RegionCard 
          key={pack.id}
          name={pack.name}
          size={pack.size}
          onDownload={() => downloadPack(pack.id)}
        />
      ))}
    </div>
  );
};
```

### Expected Outcome:
- Users can browse and download country/region packs
- Automated conversion PBF → MBTiles → Ready to use
- Progress tracking for large downloads
- Smart storage management

---

## 🎨 Phase 3: Vector Tile Support (1-2 weeks)

### Goal: Modern vector rendering with MapLibre GL JS

**Step 3.1: MapLibre Integration**
```bash
npm install maplibre-gl @types/maplibre-gl
```

**Step 3.2: Vector Style Definitions**
```typescript
// src/styles/vectorStyles.ts
export const openMapsStyle = {
  version: 8,
  sources: {
    'openmaps-vector': {
      type: 'vector',
      url: 'mbtiles://denmark-vector.mbtiles'
    }
  },
  layers: [
    // Style definitions for roads, buildings, etc.
  ]
};
```

**Step 3.3: Map Component Choice**
```typescript
// Allow users to choose between Leaflet (raster) and MapLibre (vector)
const MapContainer = ({ useVectorTiles = false }) => {
  return useVectorTiles ? 
    <MapLibreMap style={openMapsStyle} /> :
    <LeafletMap layers={rasterLayers} />;
};
```

### Expected Outcome:
- Smaller file sizes (vector data compresses better)
- Dynamic styling (day/night mode, different themes)
- Better performance on high-DPI displays
- Smooth animations and interactions

---

## 🧠 Phase 4: Intelligent Hybrid System (Future)

### Goal: Best-of-all-worlds automatic optimization

**Smart Source Selection:**
- Vector tiles for cities (detailed, dynamic styling)
- Raster tiles for rural areas (satellite imagery)
- Automatic fallback chain based on availability

**User Profiles:**
- **Tourist Mode**: High-detail city centers, basic rural coverage
- **Professional Mode**: Full coverage, routing data, POIs
- **Minimalist Mode**: Essential roads only, smallest file sizes

### Expected Outcome:
- Zero-configuration experience for beginners
- Maximum flexibility for power users
- Optimal performance regardless of use case

---

## 🛠️ Technical Implementation Notes

### Backend Dependencies:
```json
{
  "mbtiles": "^0.12.1",
  "better-sqlite3": "^8.7.0", 
  "node-fetch": "^3.3.2",
  "progress-stream": "^2.0.0"
}
```

### Frontend Dependencies:
```json
{
  "maplibre-gl": "^3.6.2",
  "@types/maplibre-gl": "^1.15.2"
}
```

### File Structure:
```
src/
├── services/
│   ├── mapSourceManager.ts      # Central source management
│   ├── mbtilesReader.ts         # Local MBTiles access
│   └── regionalPackService.ts   # Download management
├── components/
│   ├── MapSourceSelector.tsx    # User source selection UI
│   ├── RegionalPackManager.tsx  # Download interface  
│   └── MapContainer.tsx         # Unified map component
└── types/
    └── mapSources.ts            # Type definitions
```

---

## 📊 Success Metrics

**Performance:**
- Tile loading speed: 100x improvement with MBTiles
- Storage efficiency: 5-10x reduction in total file size
- Offline capability: 100% functionality without internet

**User Experience:**
- Setup time: From 30 minutes (individual tiles) to 30 seconds (region download)
- Reliability: No more rate limiting or access blocked errors
- Flexibility: Support for all user skill levels and use cases

This roadmap transforms OpenMaps from a tile-scraping tool into a modern, flexible offline mapping platform! 🗺️