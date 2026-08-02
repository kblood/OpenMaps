import express from 'express';
import axios from 'axios';

const router = express.Router();

// Request queue for rate limiting
const requestQueue = new Map<string, Promise<any>>();
const lastRequestTime = new Map<string, number>();

// Handle preflight OPTIONS requests for both routes
router.options('/proxy/:provider/:z/:x/:y.:ext', handleOptions);
router.options('/proxy/v2/:provider/:z/:x/:y.:ext', handleOptions);

function handleOptions(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin, Accept');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.status(200).send();
}

// Tile proxy endpoint to resolve CORS issues (original route)
router.get('/proxy/:provider/:z/:x/:y.:ext', handleTileRequest);

// New versioned route for cache busting
router.get('/proxy/v2/:provider/:z/:x/:y.:ext', handleTileRequest);

async function handleTileRequest(req: any, res: any) {
  try {
    const { provider, z, x, y, ext } = req.params;
    const tileKey = `${provider}/${z}/${x}/${y}.${ext}`;
    
    // Validate tile coordinates
    const zNum = parseInt(z);
    const xNum = parseInt(x);
    const yNum = parseInt(y);
    
    if (isNaN(zNum) || isNaN(xNum) || isNaN(yNum)) {
      console.warn(`🚫 Invalid tile coordinates: z=${z}, x=${x}, y=${y}`);
      res.status(400).json({ error: 'Invalid tile coordinates' });
      return;
    }
    
    if (zNum < 0 || zNum > 19 || xNum < 0 || yNum < 0) {
      console.warn(`🚫 Invalid tile range: z=${zNum}, x=${xNum}, y=${yNum}`);
      res.status(400).json({ error: 'Tile coordinates out of range' });
      return;
    }
    
    // Check if we already have a pending request for this tile
    if (requestQueue.has(tileKey)) {
      console.log(`♻️ Reusing pending request for tile: ${tileKey}`);
      const pendingRequest = requestQueue.get(tileKey)!;
      const result = await pendingRequest;
      
      // Set headers and pipe the cached result
      res.setHeader('Content-Type', result.headers['content-type'] || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin, Accept');
      res.status(200);
      result.data.pipe(res);
      return;
    }
    
    // Rate limiting check
    const lastRequest = lastRequestTime.get(provider) || 0;
    const now = Date.now();
    const minInterval = provider === 'osm' || provider === 'openstreetmap' ? 1000 : 300;
    const timeSinceLastRequest = now - lastRequest;
    
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      console.log(`⏳ Rate limiting ${provider}, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Define tile server URLs with mirrors/alternatives
    const tileServers: { [key: string]: string[] } = {
      osm: [
        'https://a.tile.openstreetmap.org',
        'https://b.tile.openstreetmap.org', 
        'https://c.tile.openstreetmap.org',
        'https://tile.openstreetmap.org'
      ],
      openstreetmap: [
        'https://a.tile.openstreetmap.org',
        'https://b.tile.openstreetmap.org', 
        'https://c.tile.openstreetmap.org'
      ],
      satellite: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile'],
      terrain: ['https://tile.opentopomap.org'],
      humanitarian: ['https://tile.openstreetmap.fr/hot'],
      cycling: ['https://tile-cyclosm.openstreetmap.fr/cyclosm'],
      transport: ['https://tile.memomaps.de/tilegen'],
      dark: ['https://basemaps.cartocdn.com/dark_all']
    };

    const serverUrls = tileServers[provider];
    if (!serverUrls || serverUrls.length === 0) {
      res.status(400).json({ error: 'Unsupported tile provider' });
      return;
    }

    // Select server based on tile coordinates for load balancing
    const serverIndex = (xNum + yNum) % serverUrls.length;
    const baseUrl = serverUrls[serverIndex];

    // Construct tile URL based on provider
    let tileUrl: string;
    if (provider === 'satellite') {
      // ArcGIS format: /z/y/x
      tileUrl = `${baseUrl}/${z}/${y}/${x}`;
    } else if (provider === 'dark') {
      // CartoDB format with {r} placeholder
      tileUrl = `${baseUrl}/${z}/${x}/${y}.${ext}`;
    } else {
      // Standard OSM format: /z/x/y.ext
      tileUrl = `${baseUrl}/${z}/${x}/${y}.${ext}`;
    }

    console.log(`🗺️ Proxying tile request: ${tileUrl}`);

    // Update last request time for rate limiting
    lastRequestTime.set(provider, Date.now());
    
    // Create and queue the request
    const requestPromise = axios.get(tileUrl, {
      headers: {
        'User-Agent': 'OpenMaps Desktop App v1.1.0 (https://github.com/openmaps)',
        'Accept': 'image/png,image/jpeg,image/webp,image/*,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      responseType: 'arraybuffer', // Use arraybuffer instead of stream for reliability
      timeout: 30000,
      maxRedirects: 5,
      decompress: true // Automatically decompress gzip/deflate
    }).finally(() => {
      // Clean up the request from queue when done
      requestQueue.delete(tileKey);
    });
    
    // Add to queue
    requestQueue.set(tileKey, requestPromise);
    
    // Wait for the request
    const response = await requestPromise;

    // Set appropriate headers
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/png');
    res.setHeader('Content-Length', response.data.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Origin, Accept');
    
    // Send the tile data
    res.status(200).send(Buffer.from(response.data));

  } catch (error: any) {
    if (error.response?.status === 429) {
      console.warn(`⚠️ Rate limited by ${req.params.provider}: ${error.config?.url}`);
      res.status(429).json({ error: 'Rate limited by tile server', retryAfter: 60 });
    } else if (error.response?.status === 404) {
      console.warn(`🚫 Tile not found: ${error.config?.url}`);
      res.status(404).json({ error: 'Tile not found' });
    } else {
      console.error('❌ Tile proxy error:', error.message || error);
      res.status(500).json({ error: 'Failed to fetch tile' });
    }
  }
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'tile-proxy',
    timestamp: new Date().toISOString()
  });
});

export default router;