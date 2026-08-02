# 🚀 Quick Start Guide

## Start Servers

### Backend (Port 3001)
```bash
cd backend
npm run dev
```

### Frontend (Port 5173)  
```bash
npm run dev
```

## Run Tests

```bash
cd backend
npm test
```

Expected: **17/17 tests passing ✅**

## Test Individual APIs

### Tiles
```bash
curl http://localhost:3001/api/tiles/proxy/osm/10/512/512.png -o tile.png
```

### Regions
```bash
curl http://localhost:3001/api/geofabrik/regions | jq '.regions | length'
# Output: 11
```

### Routing
```bash
curl "http://localhost:3001/api/routing/directions?start=51.5074,-0.1278&end=51.5194,-0.1270&profile=driving" | jq '.route.distance'
# Output: 1795.4
```

### Search
```bash
curl "http://localhost:3001/api/geocoding/search?q=London" | jq '.results | length'
# Output: 3+
```

## Open Frontend

http://localhost:5173

## Check Logs

### Backend
- Look for: `🗺️  OpenMaps Backend running on port 3001`
- Health: `curl http://localhost:3001/health`

### Frontend  
- DevTools (F12) → Console
- Look for: `🗺️ Added offline tile layer`

## Verify Everything Works

- ✅ Backend responds: `curl http://localhost:3001/health`
- ✅ MBTiles API: `curl http://localhost:3001/api/mbtiles/health`
- ✅ Geofabrik API: `curl http://localhost:3001/api/geofabrik/regions`
- ✅ Tiles proxy: `curl http://localhost:3001/api/tiles/health`
- ✅ Tests pass: `cd backend && npm test`

## Files to Read

1. **PROJECT_STATUS.md** - Complete status report
2. **TEST_GUIDE.md** - Detailed testing instructions  
3. **TESTING_RESULTS.md** - Test results and validation
4. **CLAUDE.md** - Development guidelines

## Common Issues

### Port 3001 in use?
```bash
# Kill node processes
lsof -i :3001 | grep node | awk '{print $2}' | xargs kill -9
```

### Backend won't start?
```bash
# Check for errors
cd backend && npm run dev

# Clear node_modules and reinstall
cd backend && rm -rf node_modules && npm install
```

### No tiles on map?
1. Open DevTools (F12)
2. Check Console for errors
3. Check Network tab for failed `/api/tiles/*` requests
4. Verify `http://localhost:3001` is accessible

## Success Indicators

✅ Backend logs show "OpenMaps Backend running on port 3001"
✅ `npm test` shows "17/17 tests passed"
✅ Tile requests return images (check with curl)
✅ Map appears on frontend
✅ No console errors in browser

## API Endpoints

| Endpoint | Purpose | Example |
|----------|---------|---------|
| `/health` | Server status | `curl http://localhost:3001/health` |
| `/api/mbtiles/*` | MBTiles files | `curl http://localhost:3001/api/mbtiles/list` |
| `/api/geofabrik/*` | Regions | `curl http://localhost:3001/api/geofabrik/regions` |
| `/api/tiles/*` | Map tiles | `curl http://localhost:3001/api/tiles/proxy/osm/{z}/{x}/{y}.png` |
| `/api/geocoding/*` | Search | `curl "http://localhost:3001/api/geocoding/search?q=London"` |
| `/api/routing/*` | Routes | `curl "http://localhost:3001/api/routing/directions?..."` |
| `/api/admin/*` | Regions | `curl "http://localhost:3001/api/admin/regions?country=US"` |

---

**Status**: ✅ All systems working
**Last Update**: 2025-12-31
