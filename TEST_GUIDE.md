# OpenMaps Test Suite

This document explains how to test the OpenMaps backend features.

## Prerequisites

- Node.js 18+
- npm
- Backend running on `http://localhost:3001`
- Frontend running on `http://localhost:5173`

## Quick Start

### 1. Start the Backend

```bash
cd backend
npm run dev
```

Expected output:
```
🗺️  OpenMaps Backend running on port 3001
📍 Health check available at http://localhost:3001/health
```

### 2. Start the Frontend (optional)

In another terminal:

```bash
npm run dev
```

Expected output:
```
VITE v4.5.14  ready in 150 ms

  ➜  Local:   http://localhost:5173/
```

### 3. Run Tests

In another terminal:

```bash
cd backend
npm test
```

## What Gets Tested

### ✅ Backend Health
- Backend server is running
- All services are initialized

### ✅ MBTiles API
- Health endpoint `/api/mbtiles/health`
- List files endpoint `/api/mbtiles/list`
- Error handling for missing files (404)

### ✅ Geofabrik API
- Health endpoint `/api/geofabrik/health`
- List regions `/api/geofabrik/regions`
- Verify 11 regions are available (Denmark, Germany, France, UK, etc.)
- List downloaded files `/api/geofabrik/downloaded`
- Error handling for non-existent downloads

### ✅ Tile Proxy API
- Health endpoint `/api/tiles/health`
- Proxy OSM tiles from OpenStreetMap
- Proxy satellite tiles from ArcGIS
- Proxy terrain tiles from OpenTopoMap
- v2 versioned route support
- CORS headers validation
- Error handling for invalid coordinates
- Error handling for invalid providers

### ✅ Geocoding API
- Location search (e.g., "London")
- Results include required fields (display_name, lat, lon)

### ✅ Admin Regions API
- Get regions for country (e.g., US states)
- Results include required fields (id, name, adminLevel)

### ✅ Routing API
- Calculate driving routes
- Results include distance, duration, geometry
- Caching works (second request returns cached=true)

## Test Output Example

```
🧪 OpenMaps Backend Test Suite

Testing: http://localhost:3001

✓ Backend health check
✓ MBTiles health
✓ Tile proxy health
✓ Geofabrik health
✓ MBTiles list files
✓ Geofabrik regions
✓ Geofabrik has Denmark
✓ Geofabrik downloaded files
✓ OSM tiles proxy
✓ Satellite tiles proxy
✓ Tile proxy v2 route
✓ Geocoding search
✓ Admin regions for US
✓ Routing directions
✓ Invalid tile coordinates rejected
✓ Invalid provider rejected
✓ Non-existent MBTiles returns 404

==================================================
📊 Results: 18/18 tests passed
==================================================

✅ All tests passed!
```

## Testing Individual Features

### Test Tile Proxy

```bash
curl http://localhost:3001/api/tiles/proxy/osm/10/512/512.png -o tile.png
```

This downloads a single tile. If successful, you'll have a PNG image.

### Test Geofabrik

```bash
curl http://localhost:3001/api/geofabrik/regions | jq '.regions[0]'
```

Returns:
```json
{
  "id": "denmark",
  "name": "Denmark",
  "size": 180000000,
  "sizeFormatted": "171.66 MB",
  "bounds": [8, 54.5, 15.2, 57.8],
  "availableFormats": ["pbf"],
  "estimatedDownloadTime": "2 minutes"
}
```

### Test MBTiles

```bash
curl http://localhost:3001/api/mbtiles/health
```

Returns:
```json
{
  "status": "ok",
  "service": "mbtiles",
  "availableFiles": 0,
  "timestamp": "2025-12-31T22:10:00.000Z"
}
```

### Test Tile Proxy Errors

Invalid coordinates:
```bash
curl http://localhost:3001/api/tiles/proxy/osm/abc/xyz/123.png
```

Returns 400:
```json
{
  "error": "Invalid tile coordinates"
}
```

## Frontend Testing

### Check Tile Loading

1. Open http://localhost:5173
2. Press `F12` to open DevTools
3. Go to Console tab
4. Look for logs like:
   - `🗺️ Added offline tile layer: standard`
   - `🌐 Loading online tile: 10/512/512`

### Check Network Requests

1. Open DevTools (F12)
2. Go to Network tab
3. You should see requests to:
   - `http://localhost:3001/api/tiles/proxy/osm/...` (for tiles)
   - `http://localhost:3001/api/geocoding/...` (for search)
   - `http://localhost:3001/api/routing/...` (for routes)

### Check Map Display

1. The map should show on the page
2. Tiles should appear as you scroll/zoom
3. If you see gray tiles, the proxy is working but might be slow

## Troubleshooting

### Backend won't start

```bash
# Check if port 3001 is in use
lsof -i :3001  # On macOS/Linux
netstat -ano | findstr :3001  # On Windows

# Kill the process using that port
kill -9 <PID>  # On macOS/Linux
taskkill /PID <PID> /F  # On Windows
```

### Tests fail with "Connection refused"

Make sure backend is running:
```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "status": "healthy",
  "uptime": 123.45,
  "timestamp": "2025-12-31T22:10:00.000Z"
}
```

### No tiles appear on map

1. Check browser console for errors (F12)
2. Check Network tab for failed requests
3. Make sure backend URL in `mapPacks.ts` is correct
4. Try opening tile URL directly in browser:
   `http://localhost:3001/api/tiles/proxy/osm/10/512/512.png`

### Slow tile loading

The backend proxy is limited to HTTP connections. First time loading is slower.
Subsequent requests should be faster due to:
- Caching (Redis on backend)
- Browser cache
- Network optimization

## Adding New Tests

To add new tests, edit `backend/tests/simple-test.ts`:

```typescript
{
  name: '✓ My new feature',
  url: 'http://localhost:3001/api/my-endpoint',
  expectedStatus: 200,
  validate: (r) => r.data.someField === expectedValue
}
```

Then run:
```bash
npm test
```

## Performance Notes

- First tile: ~500-2000ms (API call + proxy)
- Subsequent tiles: ~100-200ms (cached)
- Search: ~300-500ms (Nominatim)
- Routing: ~1-2s (OSRM)

These times depend on:
- Internet connection speed
- External API availability
- Backend load
- Browser cache

## Known Issues

1. **BRouter JAR download fails** - This is optional, falls back to mathematical routing
2. **Large bundle warning** - Will be optimized in future versions
3. **CORS headers might vary** - Depending on Leaflet version

## More Information

- Backend docs: `backend/README.md` (if exists)
- Frontend docs: `README.md`
- Architecture: `CLAUDE.md`

---

**Last Updated:** 2025-12-31
