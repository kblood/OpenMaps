import express, { Request, Response } from 'express';
import axios from 'axios';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { cacheService } from '../services/cache';

const router = express.Router();

// Helper functions for Valhalla
const getValhallaManeuverType = (valhallaType: number): string => {
  const types: { [key: number]: string } = {
    0: 'none',
    1: 'depart',
    2: 'continue',
    3: 'turn',
    4: 'arrive',
    5: 'merge',
    6: 'on ramp',
    7: 'off ramp',
    8: 'fork',
    9: 'end of road',
    10: 'use lane',
    11: 'continue',
    12: 'roundabout',
    13: 'ferry'
  };
  return types[valhallaType] || 'turn';
};

const getValhallaManeuverModifier = (valhallaType: number): string => {
  // Simplified mapping - Valhalla has different turn types
  if (valhallaType === 1) return 'depart';
  if (valhallaType === 4) return 'arrive';
  if (valhallaType >= 12) return 'straight'; // roundabout, ferry, etc
  return 'straight';
};

// Simple polyline decoder for Valhalla shapes
const decodePolyline = (encoded: string, precision: number = 6): [number, number][] => {
  const factor = Math.pow(10, precision);
  const len = encoded.length;
  let lat = 0, lng = 0;
  const coordinates: [number, number][] = [];
  let index = 0;
  
  while (index < len) {
    let result = 1;
    let shift = 0;
    let b: number;
    
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    
    lat += (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);
    
    result = 1;
    shift = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    
    lng += (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);
    
    coordinates.push([lat / factor, lng / factor]);
  }
  
  return coordinates;
};

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org/route/v1';
const GRAPHHOPPER_BASE_URL = process.env.GRAPHHOPPER_BASE_URL || 'https://graphhopper.com/api/1/route';
const GRAPHHOPPER_API_KEY = process.env.GRAPHHOPPER_API_KEY;
const VALHALLA_BASE_URL = process.env.VALHALLA_BASE_URL || 'https://valhalla1.openstreetmap.de';

// Profile mapping for different routing services
const OSRM_PROFILES = {
  'driving': 'driving',
  'walking': 'foot', 
  'running': 'foot',
  'cycling': 'bike'
};

const GRAPHHOPPER_PROFILES = {
  'driving': 'car',
  'walking': 'foot',
  'running': 'foot', 
  'cycling': 'bike',
  'hiking': 'hike',
  'mountain_biking': 'mtb',
  'racing_bike': 'racingbike'
};

const VALHALLA_PROFILES = {
  'driving': 'auto',
  'walking': 'pedestrian',
  'running': 'pedestrian',
  'cycling': 'bicycle',
  'hiking': 'pedestrian',
  'mountain_biking': 'bicycle',
  'racing_bike': 'bicycle'
};

// Determine best routing service for profile
const getBestRoutingService = (profile: string): 'osrm' | 'valhalla' | 'graphhopper' => {
  // Use Valhalla for pedestrian routes (best footway/trail support)
  if (['walking', 'running', 'hiking'].includes(profile)) {
    return 'valhalla';
  }
  
  // Use Valhalla for cycling to get better bike path coverage
  if (['cycling', 'mountain_biking', 'racing_bike'].includes(profile)) {
    return 'valhalla';
  }
  
  // Use OSRM for driving (fastest)
  return 'osrm';
};

// Get route between two points
router.get('/directions', asyncHandler(async (req: Request, res: Response) => {
  const { start, end, profile = 'driving', service } = req.query;

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
  const cacheKey = `route:${start}:${end}:${profile}:${service || 'auto'}`;
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
    let routingService = service as string || getBestRoutingService(profile as string);

    if (routingService === 'osrm' && OSRM_PROFILES[profile as keyof typeof OSRM_PROFILES]) {
      // Use OSRM
      const osrmProfile = OSRM_PROFILES[profile as keyof typeof OSRM_PROFILES];
      const url = `${OSRM_BASE_URL}/${osrmProfile}/${startLng},${startLat};${endLng},${endLat}`;
      console.log(`📡 Requesting OSRM: ${url}`);

      response = await axios.get(
        url,
        {
          params: {
            overview: 'full',
            geometries: 'geojson',
            steps: true,
            annotations: true
          },
          headers: {
            'User-Agent': 'OpenMaps/1.1.0'
          },
          timeout: 10000 // 10s timeout
        }
      );

      if (response.data.routes && response.data.routes.length > 0) {
        route = response.data.routes[0];
        route.service = 'osrm';
      }
    } else if (routingService === 'valhalla' && VALHALLA_PROFILES[profile as keyof typeof VALHALLA_PROFILES]) {
      // Use Valhalla for pedestrian routes with better footway support
      const valhallaProfile = VALHALLA_PROFILES[profile as keyof typeof VALHALLA_PROFILES];
      console.log(`📡 Requesting Valhalla for profile: ${profile} (${valhallaProfile})`);

      const requestBody = {
        locations: [
          { lat: startLat, lon: startLng },
          { lat: endLat, lon: endLng }
        ],
        costing: valhallaProfile,
        directions_options: {
          units: 'kilometers',
          language: 'en-US'
        },
        shape_match: 'map_snap',
        filters: {
          attributes: ['edge.length', 'edge.time', 'edge.speed'],
          action: 'include'
        }
      };

      // Add pedestrian-specific options for better footway routing
      if (['walking', 'running', 'hiking'].includes(profile as string)) {
        (requestBody as any).costing_options = {
          pedestrian: {
            walking_speed: (profile as string) === 'running' ? 8.0 : 5.0, // km/h
            walkway_factor: 0.8, // Prefer walkways and footpaths
            sidewalk_factor: 0.9, // Prefer sidewalks
            alley_factor: 1.2, // Slightly avoid alleys
            step_penalty: 15, // Penalty for stairs
            max_hiking_difficulty: (profile as string) === 'hiking' ? 3 : 1 // Allow harder trails for hiking
          }
        };
      } else if (['cycling', 'mountain_biking', 'racing_bike'].includes(profile as string)) {
        (requestBody as any).costing_options = {
          bicycle: {
            bicycle_type: (profile as string) === 'mountain_biking' ? 'Mountain' : (profile as string) === 'racing_bike' ? 'Road' : 'Hybrid',
            cycling_speed: (profile as string) === 'racing_bike' ? 25.0 : (profile as string) === 'mountain_biking' ? 15.0 : 20.0,
            use_roads: (profile as string) === 'racing_bike' ? 0.8 : 0.2, // Racing bikes prefer roads
            use_ferry: 0.3
          }
        };
      }

      try {
        response = await axios.post(`${VALHALLA_BASE_URL}/route`, requestBody, {
          headers: {
            'User-Agent': 'OpenMaps/1.1.0',
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });
        
        if (response.data.trip && response.data.trip.legs && response.data.trip.legs.length > 0) {
          const trip = response.data.trip;
          const leg = trip.legs[0];
          
          // Convert Valhalla response to OSRM-like format
          route = {
            distance: trip.summary.length * 1000, // Convert km to meters
            duration: trip.summary.time,
            geometry: {
              type: 'LineString',
              coordinates: decodePolyline(trip.legs[0].shape).map((coord: [number, number]) => [coord[1], coord[0]]) // Convert lat,lng to lng,lat
            },
            legs: [{
              distance: leg.summary.length * 1000,
              duration: leg.summary.time,
              steps: leg.maneuvers?.map((maneuver: any, index: number) => ({
                distance: maneuver.length * 1000,
                duration: maneuver.time,
                instruction: maneuver.instruction,
                maneuver: {
                  type: getValhallaManeuverType(maneuver.type),
                  modifier: getValhallaManeuverModifier(maneuver.type),
                  location: [maneuver.begin_shape_index, maneuver.end_shape_index]
                }
              })) || []
            }],
            service: 'valhalla',
            profile: valhallaProfile
          };
        }
      } catch (valhallaError: any) {
        console.warn(`Valhalla failed (${valhallaError.response?.status}), falling back to OSRM for profile: ${profile}`);
        
        // Fall back to OSRM
        const fallbackProfile = OSRM_PROFILES[profile as keyof typeof OSRM_PROFILES] || 'foot';
        const osrmResponse = await axios.get(
          `${OSRM_BASE_URL}/${fallbackProfile}/${startLng},${startLat};${endLng},${endLat}`,
          {
            params: {
              overview: 'full',
              geometries: 'geojson',
              steps: true,
              annotations: true
            }
          }
        );

        if (osrmResponse.data.routes && osrmResponse.data.routes.length > 0) {
          route = osrmResponse.data.routes[0];
          route.service = 'osrm-fallback';
          route.profile = fallbackProfile;
        }
      }
    } else if (GRAPHHOPPER_PROFILES[profile as keyof typeof GRAPHHOPPER_PROFILES]) {
      // Use GraphHopper
      const graphhopperProfile = GRAPHHOPPER_PROFILES[profile as keyof typeof GRAPHHOPPER_PROFILES];
      const params: any = {
        point: [`${startLat},${startLng}`, `${endLat},${endLng}`],
        profile: graphhopperProfile,
        points_encoded: false,
        instructions: true,
        calc_points: true,
        debug: false,
        elevation: false,
        turn_costs: true
      };

      // Add API key if available
      if (GRAPHHOPPER_API_KEY) {
        params.key = GRAPHHOPPER_API_KEY;
      }

      try {
        response = await axios.get(GRAPHHOPPER_BASE_URL, { params });
        
        if (response.data.paths && response.data.paths.length > 0) {
          const path = response.data.paths[0];
          
          // Convert GraphHopper response to OSRM-like format
          route = {
            distance: path.distance,
            duration: path.time / 1000, // Convert ms to seconds
            geometry: {
              type: 'LineString',
              coordinates: path.points.coordinates
            },
            legs: [{
              distance: path.distance,
              duration: path.time / 1000,
              steps: path.instructions?.map((instruction: any) => ({
                distance: instruction.distance,
                duration: instruction.time / 1000,
                instruction: instruction.text,
                maneuver: {
                  type: instruction.sign === 0 ? 'depart' : 'turn',
                  modifier: getManeuverModifier(instruction.sign),
                  location: [instruction.interval[0], instruction.interval[1]]
                }
              })) || []
            }],
            service: 'graphhopper',
            profile: graphhopperProfile
          };
        }
      } catch (graphhopperError: any) {
        // If GraphHopper fails (e.g., due to missing API key), fall back to OSRM
        console.warn(`GraphHopper failed (${graphhopperError.response?.status}), falling back to OSRM for profile: ${profile}`);
        
        const fallbackProfile = OSRM_PROFILES[profile as keyof typeof OSRM_PROFILES] || 'foot';
        const osrmResponse = await axios.get(
          `${OSRM_BASE_URL}/${fallbackProfile}/${startLng},${startLat};${endLng},${endLat}`,
          {
            params: {
              overview: 'full',
              geometries: 'geojson',
              steps: true,
              annotations: true
            }
          }
        );

        if (osrmResponse.data.routes && osrmResponse.data.routes.length > 0) {
          route = osrmResponse.data.routes[0];
          route.service = 'osrm-fallback';
          route.profile = fallbackProfile;
        }
      }
    } else {
      throw createError(`Profile '${profile}' not supported`, 400);
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
        service: route.service,
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

// Helper function to convert GraphHopper instruction signs to maneuver modifiers
const getManeuverModifier = (sign: number): string => {
  const modifiers: { [key: number]: string } = {
    0: 'straight',
    1: 'slight right',
    2: 'right',
    3: 'sharp right',
    '-1': 'slight left',
    '-2': 'left',
    '-3': 'sharp left',
    4: 'arrive',
    5: 'depart'
  };
  return modifiers[sign] || 'straight';
};

// Get multiple route alternatives
router.get('/alternatives', asyncHandler(async (req: Request, res: Response) => {
  const { start, end, alternatives = '3', profile = 'driving', service } = req.query;

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
  const cacheKey = `alternatives:${start}:${end}:${profile}:${service || 'auto'}`;
  const cachedRoutes = cacheService.get(cacheKey);
  
  if (cachedRoutes) {
    return res.json({
      routes: cachedRoutes,
      cached: true
    });
  }

  try {
    let routes: any[] = [];
    let routingService = service as string || getBestRoutingService(profile as string);

    if (routingService === 'osrm' && OSRM_PROFILES[profile as keyof typeof OSRM_PROFILES]) {
      const osrmProfile = OSRM_PROFILES[profile as keyof typeof OSRM_PROFILES];
      const response = await axios.get(
        `${OSRM_BASE_URL}/${osrmProfile}/${startLng},${startLat};${endLng},${endLat}`,
        {
          params: {
            overview: 'full',
            geometries: 'geojson',
            steps: true,
            alternatives: Math.min(parseInt(alternatives as string) || 3, 5)
          }
        }
      );

      routes = (response.data.routes || []).map((route: any, index: number) => ({
        ...route,
        routeIndex: index,
        service: 'osrm',
        summary: {
          distance: route.distance,
          duration: route.duration,
          profile,
          service: 'osrm',
          waypoints: [
            { lat: startLat, lng: startLng },
            { lat: endLat, lng: endLng }
          ]
        }
      }));
    } else if (GRAPHHOPPER_PROFILES[profile as keyof typeof GRAPHHOPPER_PROFILES]) {
      const graphhopperProfile = GRAPHHOPPER_PROFILES[profile as keyof typeof GRAPHHOPPER_PROFILES];
      const params: any = {
        point: [`${startLat},${startLng}`, `${endLat},${endLng}`],
        profile: graphhopperProfile,
        points_encoded: false,
        instructions: true,
        calc_points: true,
        debug: false,
        elevation: false,
        turn_costs: true,
        alternative_route: {
          max_paths: Math.min(parseInt(alternatives as string) || 3, 5)
        }
      };

      if (GRAPHHOPPER_API_KEY) {
        params.key = GRAPHHOPPER_API_KEY;
      }

      try {
        const response = await axios.get(GRAPHHOPPER_BASE_URL, { params });
        routes = (response.data.paths || []).map((path: any, index: number) => ({
        distance: path.distance,
        duration: path.time / 1000,
        geometry: {
          type: 'LineString',
          coordinates: path.points.coordinates
        },
        legs: [{
          distance: path.distance,
          duration: path.time / 1000,
          steps: path.instructions?.map((instruction: any) => ({
            distance: instruction.distance,
            duration: instruction.time / 1000,
            instruction: instruction.text,
            maneuver: {
              type: instruction.sign === 0 ? 'depart' : 'turn',
              modifier: getManeuverModifier(instruction.sign),
              location: [instruction.interval[0], instruction.interval[1]]
            }
          })) || []
        }],
        routeIndex: index,
        service: 'graphhopper',
        profile: graphhopperProfile,
        summary: {
          distance: path.distance,
          duration: path.time / 1000,
          profile,
          service: 'graphhopper',
          waypoints: [
            { lat: startLat, lng: startLng },
            { lat: endLat, lng: endLng }
          ]
        }
      }));
      } catch (graphhopperError: any) {
        // Fall back to OSRM for alternatives
        console.warn(`GraphHopper alternatives failed (${graphhopperError.response?.status}), falling back to OSRM for profile: ${profile}`);
        
        const fallbackProfile = OSRM_PROFILES[profile as keyof typeof OSRM_PROFILES] || 'foot';
        const osrmResponse = await axios.get(
          `${OSRM_BASE_URL}/${fallbackProfile}/${startLng},${startLat};${endLng},${endLat}`,
          {
            params: {
              overview: 'full',
              geometries: 'geojson',
              steps: true,
              alternatives: Math.min(parseInt(alternatives as string) || 3, 5)
            }
          }
        );

        routes = (osrmResponse.data.routes || []).map((route: any, index: number) => ({
          ...route,
          routeIndex: index,
          service: 'osrm-fallback',
          summary: {
            distance: route.distance,
            duration: route.duration,
            profile,
            service: 'osrm-fallback',
            waypoints: [
              { lat: startLat, lng: startLng },
              { lat: endLat, lng: endLng }
            ]
          }
        }));
      }
    }

    // Cache the routes
    cacheService.set(cacheKey, routes, 1800); // Cache for 30 minutes

    return res.json({
      routes,
      cached: false
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