# Map Pack Architecture Upgrade Plan

## Current Issues
- Individual tile downloading is slow and gets blocked
- Rate limiting from tile servers
- Large storage overhead
- Network intensive

## Recommended Architecture: MBTiles + Vector Tiles

### Phase 1: MBTiles Integration
```typescript
interface MBTilesMapPack {
  id: string;
  name: string;
  region: string;
  mbtilesPaths: {
    raster?: string;    // .mbtiles file for raster tiles
    vector?: string;    // .mbtiles file for vector tiles
  };
  bounds: [number, number, number, number]; // [west, south, east, north]
  minZoom: number;
  maxZoom: number;
  source: 'geofabrik' | 'bbbike' | 'custom';
  lastUpdated: Date;
}
```

### Phase 2: Regional Extract Downloads
Instead of tile-by-tile downloads:
1. **Geofabrik Daily Extracts**: Download country/region PBF files
2. **Convert to MBTiles**: Use tilemaker or similar tools
3. **Store Locally**: Single file per region instead of thousands of tiles

### Phase 3: Vector Tile Rendering
- Use MapLibre GL JS for vector tile rendering
- Better performance, smaller file sizes
- Dynamic styling (day/night mode, different themes)

## Implementation Priority
1. ✅ Fix current tile proxy (immediate)
2. 🔄 Add MBTiles support (next sprint)  
3. 🔄 Integrate Geofabrik downloads (future)
4. 🔄 Vector tile rendering (future)

## Benefits
- 📦 Single file per region (easier distribution)
- 🚀 Much faster loading (SQLite queries vs HTTP requests)
- 💾 Smaller total file sizes
- 🌐 Works completely offline
- 🔄 Easy updates (replace single file)
- 🎨 Dynamic styling options

## Tools Integration
- **Node.js**: `mbtiles` npm package for reading MBTiles
- **Frontend**: `maplibre-gl` for vector tile rendering
- **Backend**: SQLite queries instead of HTTP tile requests
- **Downloads**: Direct regional extract downloads instead of tile scraping