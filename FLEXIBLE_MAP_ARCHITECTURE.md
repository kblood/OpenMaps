# Flexible Map Source Architecture

## Research Findings Summary (2025)

### Best Mapping Libraries:
- **MapLibre GL JS**: Growing fast, excellent vector tile support, user-configurable
- **OpenLayers**: Most comprehensive, supports every format imaginable  
- **Leaflet**: Simple, proven, great for raster tiles

### Optimal Map Data Sources:
- **MBTiles**: SQLite-based, single file per region (50-500MB vs thousands of tiles)
- **Vector Tiles**: Smaller, dynamic styling, better performance
- **Geofabrik**: Daily updated regional extracts, most reliable
- **BBBike**: Custom area extracts up to 24M km²
- **OpenMapTiles**: Pre-built vector tile packages

## Proposed Architecture: User-Configurable Multi-Source System

```typescript
interface MapSourceConfig {
  id: string;
  name: string;
  type: 'raster-tiles' | 'vector-tiles' | 'mbtiles' | 'local-files';
  provider: 'geofabrik' | 'bbbike' | 'osmand' | 'custom' | 'tile-server';
  url?: string;           // For tile servers
  localPath?: string;     // For MBTiles/local files
  region?: string;        // For regional extracts
  bounds?: [number, number, number, number];
  maxZoom: number;
  attribution: string;
  updateFrequency?: 'daily' | 'weekly' | 'manual';
}
```

## User Choice Interface Design

### Beginner Mode: "Quick Setup"
```
🌍 World Maps
  ├── 📦 Download Country Pack (Germany) - 150MB MBTiles  
  ├── 🌐 Online Tiles (requires internet)
  └── 📱 Import from OsmAnd/MAPS.ME

⚡ Quick Downloads:
  • Europe Pack (vector) - 800MB, offline routing included
  • My Country Only - Auto-detect location
  • City Pack (London) - 50MB detailed streets
```

### Advanced Mode: "Custom Sources" 
```typescript
interface UserMapSources {
  // Multiple source types supported
  rasterTiles: TileServerConfig[];     // Current system
  vectorTiles: VectorTileConfig[];     // MapLibre GL
  mbtilesPacks: MBTilesConfig[];       // Regional SQLite files  
  osmExtracts: OSMExtractConfig[];     // Raw OSM data + routing
  
  // User preferences
  preferredType: 'performance' | 'quality' | 'size' | 'offline-first';
  autoUpdate: boolean;
  fallbackChain: string[];             // Fallback order when sources fail
}
```

## Implementation Strategy

### Phase 1: Multi-Source Support (Immediate)
- Keep current tile system for compatibility
- Add MBTiles reader support
- User can choose: "Tiles vs MBTiles vs Both"

### Phase 2: Regional Pack Downloads (Next Sprint)
- Integrate Geofabrik daily download API
- Pre-built country/region packs
- One-click "Download Germany" → single 200MB file

### Phase 3: Vector Tile Integration (Future)
- MapLibre GL JS integration  
- Dynamic styling (day/night, cycling, etc.)
- Smaller file sizes, better performance

### Phase 4: Smart Hybrid System (Future)
- Automatic source selection based on area/zoom
- Vector tiles for cities, raster for rural
- Intelligent caching and updates

## User Interface Mock-up

```
📍 Map Data Sources                                    [Settings ⚙️]

Current Region: Denmark 🇩🇰
├── ✅ Denmark Vector Pack (Local) - 180MB - Updated 3 days ago
├── ⚠️ Online Tiles (Backup) - Rate limited, use sparingly  
└── 📥 Available: Denmark Routing Data (150MB) [Download]

🌍 Add New Region:
┌─────────────────────────────────────────────────────┐
│ 🔍 Search: [Sweden________________] [Find Region]     │
│                                                     │  
│ Popular Downloads:                                  │
│ • 🇬🇧 United Kingdom (Vector + Routing) - 420MB     │
│ • 🇫🇷 France (Vector + Routing) - 680MB             │ 
│ • 🇺🇸 USA West Coast (MBTiles) - 1.2GB             │
│                                                     │
│ Advanced:                                           │
│ • 🔧 Custom Area (BBBike Extract)                   │ 
│ • 📂 Import MBTiles File                           │
│ • 🌐 Add Tile Server                               │
└─────────────────────────────────────────────────────┘

⚡ Performance Mode:
○ Balanced (Vector + Raster fallback)
● Offline First (Local files only) 
○ Online First (Stream tiles, cache locally)
```

## Benefits of This Approach

✅ **User Choice**: Beginners get simple options, power users get full control
✅ **Scalable**: Start with tiles, upgrade to MBTiles/vector as needed
✅ **Future-Proof**: Supports all emerging standards
✅ **Performance**: MBTiles = 100x faster than individual tile requests
✅ **Offline-First**: Works completely offline with regional packs
✅ **Storage Efficient**: Single 200MB file vs 50,000 individual tiles

## Next Implementation Steps

1. **Add MBTiles Support** (1-2 days)
   - npm install mbtiles 
   - Create MBTiles reader service
   - UI toggle: "Use MBTiles when available"

2. **Regional Pack Integration** (3-5 days)
   - Geofabrik API integration
   - Download manager with progress
   - Country/region selection UI

3. **Vector Tile Support** (1-2 weeks)
   - MapLibre GL JS integration
   - Style definitions for different map types
   - Smooth migration from Leaflet

This gives users the **best of all worlds** - simplicity for beginners, power for advanced users, and a clear upgrade path! 🗺️