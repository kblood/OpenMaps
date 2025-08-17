import express from 'express';
import axios from 'axios';

const router = express.Router();

// Tile proxy endpoint to resolve CORS issues
router.get('/proxy/:provider/:z/:x/:y.:ext', async (req, res) => {
  try {
    const { provider, z, x, y, ext } = req.params;
    
    // Define tile server URLs
    const tileServers: { [key: string]: string } = {
      osm: 'https://tile.openstreetmap.org',
      openstreetmap: 'https://tile.openstreetmap.org',
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile',
      terrain: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile',
      // Add more tile providers as needed
    };

    const baseUrl = tileServers[provider];
    if (!baseUrl) {
      res.status(400).json({ error: 'Unsupported tile provider' });
      return;
    }

    // Construct tile URL based on provider
    let tileUrl: string;
    if (provider === 'satellite' || provider === 'terrain') {
      // ArcGIS format: /z/y/x
      tileUrl = `${baseUrl}/${z}/${y}/${x}`;
    } else {
      // Standard OSM format: /z/x/y.ext
      tileUrl = `${baseUrl}/${z}/${x}/${y}.${ext}`;
    }

    console.log(`🗺️ Proxying tile request: ${tileUrl}`);

    // Fetch the tile with appropriate headers
    const response = await axios.get(tileUrl, {
      headers: {
        'User-Agent': 'OpenMaps-Offline/1.0 (https://github.com/openmaps/openmaps)',
        'Referer': 'https://openstreetmap.org'
      },
      responseType: 'stream',
      timeout: 10000 // 10 second timeout
    });

    // Set appropriate headers
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/png',
      'Cache-Control': 'public, max-age=86400', // 24 hours
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    // Pipe the response
    if (response.data && typeof response.data.pipe === 'function') {
      response.data.pipe(res);
    } else {
      res.status(500).json({ error: 'Invalid response format' });
      return;
    }

  } catch (error) {
    console.error('❌ Tile proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch tile' });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'tile-proxy',
    timestamp: new Date().toISOString()
  });
});

export default router;