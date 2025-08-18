import express from 'express';
import { BRouterService, RouteRequest, RoutingDataSegment } from '../services/brouter';
import path from 'path';

const router = express.Router();

// Initialize BRouter service
const brouterConfig = {
  jarPath: path.join(process.cwd(), 'data', 'brouter', 'brouter.jar'),
  dataPath: path.join(process.cwd(), 'data', 'brouter', 'segments'),
  profilesPath: path.join(process.cwd(), 'data', 'brouter', 'profiles'),
  port: 17777,
  maxRunningTime: 60
};

const brouterService = new BRouterService(brouterConfig);

// Initialize BRouter on startup
brouterService.initialize().catch(error => {
  console.error('❌ Failed to initialize BRouter service:', error);
}).then(() => {
  console.log('✅ BRouter initialization completed');
  setTimeout(() => {
    console.log('🔍 BRouter service status check:', brouterService.isServiceRunning());
  }, 2000);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await brouterService.shutdown();
});

process.on('SIGINT', async () => {
  await brouterService.shutdown();
});

/**
 * Calculate offline route using BRouter
 */
router.post('/route', async (req, res): Promise<any> => {
  try {
    const { startLat, startLng, endLat, endLng, profile = 'car-fast', format = 'geojson' } = req.body;

    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({
        error: 'Missing required parameters: startLat, startLng, endLat, endLng'
      });
    }

    if (!brouterService.isServiceRunning()) {
      return res.status(503).json({
        error: 'BRouter service is not available',
        offline: true
      });
    }

    const routeRequest: RouteRequest = {
      startLat: parseFloat(startLat),
      startLng: parseFloat(startLng),
      endLat: parseFloat(endLat),
      endLng: parseFloat(endLng),
      profile,
      format
    };

    console.log(`🧭 Calculating offline route: ${profile} from [${startLat}, ${startLng}] to [${endLat}, ${endLng}]`);

    const route = await brouterService.calculateRoute(routeRequest);

    res.json({
      success: true,
      route,
      metadata: {
        provider: 'brouter',
        profile,
        offline: true,
        distance: route.properties.distance,
        duration: route.properties.time,
        coordinates_count: route.geometry.coordinates.length
      }
    });

  } catch (error) {
    console.error('Offline routing error:', error);
    
    return res.status(500).json({
      error: 'Failed to calculate offline route',
      message: error instanceof Error ? error.message : 'Unknown error',
      offline: true
    });
  }
});

/**
 * Get available routing profiles
 */
router.get('/profiles', async (req, res): Promise<any> => {
  try {
    const profiles = await brouterService.getAvailableProfiles();
    
    res.json({
      success: true,
      profiles: profiles.map(profile => ({
        id: profile,
        name: profile.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: getProfileDescription(profile)
      }))
    });
  } catch (error) {
    console.error('Error getting profiles:', error);
    return res.status(500).json({
      error: 'Failed to get routing profiles',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get required routing data segments for a bounding box
 */
router.post('/routing-data/segments', async (req, res): Promise<any> => {
  try {
    const { north, south, east, west } = req.body;

    if (!north || !south || !east || !west) {
      return res.status(400).json({
        error: 'Missing required parameters: north, south, east, west'
      });
    }

    const bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west)
    };

    const segments = await brouterService.getRequiredSegments(bounds);

    res.json({
      success: true,
      segments,
      metadata: {
        total_segments: segments.length,
        downloaded_segments: segments.filter(s => s.downloaded).length,
        pending_segments: segments.filter(s => !s.downloaded).length
      }
    });

  } catch (error) {
    console.error('Error getting routing segments:', error);
    return res.status(500).json({
      error: 'Failed to get routing data segments',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Download routing data segments
 */
router.post('/routing-data/download', async (req, res): Promise<any> => {
  try {
    const { segments } = req.body;

    if (!segments || !Array.isArray(segments)) {
      return res.status(400).json({
        error: 'Missing or invalid segments array'
      });
    }

    console.log(`📦 Starting download of ${segments.length} routing data segments`);

    // Start download in background
    brouterService.downloadRoutingData(segments).catch(error => {
      console.error('Background routing data download failed:', error);
    });

    res.json({
      success: true,
      message: 'Routing data download started',
      segments_count: segments.length
    });

  } catch (error) {
    console.error('Error starting routing data download:', error);
    return res.status(500).json({
      error: 'Failed to start routing data download',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Check BRouter service status
 */
router.get('/status', async (req, res): Promise<any> => {
  try {
    const isRunning = brouterService.isServiceRunning();
    const profiles = await brouterService.getAvailableProfiles();

    res.json({
      success: true,
      status: isRunning ? 'running' : 'stopped',
      service: 'brouter',
      profiles_available: profiles.length,
      port: brouterConfig.port
    });

  } catch (error) {
    console.error('Error checking BRouter status:', error);
    return res.status(500).json({
      error: 'Failed to check routing service status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

function getProfileDescription(profile: string): string {
  const descriptions: { [key: string]: string } = {
    'car-fast': 'Fast car routing, prioritizes highways and speed',
    'car-eco': 'Economical car routing, optimizes for fuel efficiency',
    'bicycle': 'Bicycle routing with cycle paths and roads suitable for cycling',
    'mtb': 'Mountain bike routing for off-road trails and paths',
    'foot': 'Walking/hiking routes optimized for pedestrians',
    'hiking': 'Hiking routes with elevation and trail preferences',
    'motorcycle': 'Motorcycle routing with speed and road preferences',
    'truck': 'Truck routing considering weight and size restrictions'
  };

  return descriptions[profile] || `${profile} routing profile`;
}

export default router;