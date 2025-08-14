import express, { Request, Response } from 'express';
import axios from 'axios';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { cacheService } from '../services/cache';

const router = express.Router();

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1';
const GRAPHHOPPER_BASE_URL = 'https://graphhopper.com/api/1/route';

// Get route between two points
router.get('/directions', asyncHandler(async (req: Request, res: Response) => {
  const { start, end, profile = 'driving' } = req.query;

  if (!start || !end) {
    throw createError('Start and end coordinates are required', 400);
  }

  const startCoords = (start as string).split(',');
  const endCoords = (end as string).split(',');

  if (startCoords.length !== 2 || endCoords.length !== 2) {
    throw createError('Invalid coordinate format. Use "lat,lng"', 400);
  }

  const startLat = parseFloat(startCoords[0]);
  const startLng = parseFloat(startCoords[1]);
  const endLat = parseFloat(endCoords[0]);
  const endLng = parseFloat(endCoords[1]);

  if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
    throw createError('Invalid coordinate values', 400);
  }

  // Check cache first
  const cacheKey = `route:${start}:${end}:${profile}`;
  const cachedRoute = cacheService.get(cacheKey);
  
  if (cachedRoute) {
    return res.json({
      route: cachedRoute,
      cached: true
    });
  }

  try {
    let response;
    let route;

    if (profile === 'driving') {
      // Use OSRM for driving directions
      response = await axios.get(
        `${OSRM_BASE_URL}/driving/${startLng},${startLat};${endLng},${endLat}`,
        {
          params: {
            overview: 'full',
            geometries: 'geojson',
            steps: true,
            annotations: true
          }
        }
      );

      if (response.data.routes && response.data.routes.length > 0) {
        route = response.data.routes[0];
      }
    } else {
      // For other profiles, we would use GraphHopper or similar
      // This is a placeholder implementation
      throw createError('Profile not supported yet', 400);
    }

    if (!route) {
      throw createError('No route found', 404);
    }

    // Enhance route with additional information
    const enhancedRoute = {
      ...route,
      summary: {
        distance: route.distance,
        duration: route.duration,
        profile,
        waypoints: [
          { lat: startLat, lng: startLng },
          { lat: endLat, lng: endLng }
        ]
      }
    };

    // Cache the route
    cacheService.set(cacheKey, enhancedRoute, 1800); // Cache for 30 minutes

    return res.json({
      route: enhancedRoute,
      cached: false
    });
  } catch (error: any) {
    console.error('Routing error:', error.message);
    if (error.statusCode) {
      throw error;
    }
    throw createError('Routing service unavailable', 503);
  }
}));

// Get multiple route alternatives
router.get('/alternatives', asyncHandler(async (req: Request, res: Response) => {
  const { start, end, alternatives = '3' } = req.query;

  if (!start || !end) {
    throw createError('Start and end coordinates are required', 400);
  }

  const startCoords = (start as string).split(',');
  const endCoords = (end as string).split(',');

  if (startCoords.length !== 2 || endCoords.length !== 2) {
    throw createError('Invalid coordinate format. Use "lat,lng"', 400);
  }

  const startLat = parseFloat(startCoords[0]);
  const startLng = parseFloat(startCoords[1]);
  const endLat = parseFloat(endCoords[0]);
  const endLng = parseFloat(endCoords[1]);

  if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
    throw createError('Invalid coordinate values', 400);
  }

  try {
    const response = await axios.get(
      `${OSRM_BASE_URL}/driving/${startLng},${startLat};${endLng},${endLat}`,
      {
        params: {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          alternatives: Math.min(parseInt(alternatives as string) || 3, 5)
        }
      }
    );

    const routes = response.data.routes || [];

    const enhancedRoutes = routes.map((route: any, index: number) => ({
      ...route,
      routeIndex: index,
      summary: {
        distance: route.distance,
        duration: route.duration,
        profile: 'driving',
        waypoints: [
          { lat: startLat, lng: startLng },
          { lat: endLat, lng: endLng }
        ]
      }
    }));

    return res.json({
      routes: enhancedRoutes,
      waypoints: response.data.waypoints
    });
  } catch (error: any) {
    console.error('Alternative routes error:', error.message);
    throw createError('Alternative routes service unavailable', 503);
  }
}));

// Get route matrix (distances/durations between multiple points)
router.post('/matrix', asyncHandler(async (req: Request, res: Response) => {
  const { coordinates, sources, destinations } = req.body;

  if (!coordinates || !Array.isArray(coordinates)) {
    throw createError('Coordinates array is required', 400);
  }

  if (coordinates.length > 25) {
    throw createError('Maximum 25 coordinates allowed', 400);
  }

  try {
    const coordString = coordinates
      .map((coord: number[]) => `${coord[1]},${coord[0]}`) // OSRM expects lng,lat
      .join(';');

    const params: any = {};
    if (sources) params.sources = Array.isArray(sources) ? sources.join(';') : sources;
    if (destinations) params.destinations = Array.isArray(destinations) ? destinations.join(';') : destinations;

    const response = await axios.get(
      `${OSRM_BASE_URL}/driving/${coordString}`,
      { params }
    );

    return res.json({
      matrix: response.data,
      coordinates: coordinates
    });
  } catch (error: any) {
    console.error('Route matrix error:', error.message);
    throw createError('Route matrix service unavailable', 503);
  }
}));

export default router;