import { Location, Route } from '../types';
import { RouteMode, RoutePreference, RouteOptions } from '../components/Routing/RoutePanel';

interface OfflineRouteStep {
  distance: number;
  duration: number;
  instruction: string;
  maneuver: {
    type: string;
    modifier: string;
    location: [number, number];
  };
}

// Haversine distance calculation
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

// Calculate bearing between two points
const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);
  return (θ * 180 / Math.PI + 360) % 360; // Bearing in degrees
};

// Get direction from bearing
const getDirection = (bearing: number): string => {
  const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
};

// Get speed based on route mode (km/h)
const getSpeed = (mode: RouteMode): number => {
  const speeds = {
    driving: 50, // Average city driving
    walking: 5,
    running: 10,
    cycling: 20,
    hiking: 3,
    mountain_biking: 15,
    racing_bike: 35
  };
  return speeds[mode] || 5;
};

// Generate intermediate waypoints for smoother routing
const generateWaypoints = (start: Location, end: Location, segments: number = 3): Location[] => {
  const waypoints: Location[] = [start];
  
  for (let i = 1; i < segments; i++) {
    const ratio = i / segments;
    const lat = start.lat + (end.lat - start.lat) * ratio;
    const lng = start.lng + (end.lng - start.lng) * ratio;
    waypoints.push({ lat, lng });
  }
  
  waypoints.push(end);
  return waypoints;
};

// Create geometry from waypoints
const createGeometry = (waypoints: Location[]): any => {
  return {
    type: 'LineString',
    coordinates: waypoints.map(point => [point.lng, point.lat])
  };
};

// Apply route preferences and options
const applyRouteModifications = (distance: number, duration: number, mode: RouteMode, preference: RoutePreference, options: RouteOptions): { distance: number, duration: number } => {
  let modifiedDistance = distance;
  let modifiedDuration = duration;

  // Apply route preference
  switch (preference) {
    case 'shortest':
      // Shortest route - minimal distance increase
      modifiedDistance *= 1.0;
      modifiedDuration *= 1.1; // Might take longer due to smaller roads
      break;
    case 'fastest':
      // Fastest route - might be longer but faster
      modifiedDistance *= 1.15;
      modifiedDuration *= 0.9;
      break;
    case 'balanced':
      // Balanced route
      modifiedDistance *= 1.05;
      modifiedDuration *= 1.0;
      break;
  }

  // Apply route options
  if (options.avoidHighways && mode === 'driving') {
    modifiedDistance *= 1.2;
    modifiedDuration *= 1.3;
  }

  if (options.avoidTolls && mode === 'driving') {
    modifiedDistance *= 1.1;
    modifiedDuration *= 1.15;
  }

  if (options.avoidFerries) {
    // Minimal impact for most routes
    modifiedDistance *= 1.02;
    modifiedDuration *= 1.02;
  }

  return { distance: modifiedDistance, duration: modifiedDuration };
};

export const getOfflineRoute = (
  start: Location, 
  end: Location, 
  mode: RouteMode = 'driving',
  preference: RoutePreference = 'fastest',
  options: RouteOptions = { avoidHighways: false, avoidTolls: false, avoidFerries: false }
): Route => {
  console.log('getOfflineRoute called with:', { start, end, mode, preference, options });
  
  // Calculate direct distance and bearing
  const directDistance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
  console.log('Direct distance calculated:', directDistance);
  const bearing = calculateBearing(start.lat, start.lng, end.lat, end.lng);
  const direction = getDirection(bearing);
  
  // Get speed and calculate base duration
  const speedKmh = getSpeed(mode);
  const speedMs = speedKmh / 3.6; // Convert to m/s
  let baseDuration = directDistance / speedMs; // Duration in seconds
  
  // Apply realistic routing factors (roads aren't straight lines)
  let routingFactor = 1.3; // Default factor for road network
  
  switch (mode) {
    case 'driving':
      routingFactor = 1.4; // Roads, traffic, turns
      break;
    case 'walking':
    case 'running':
      routingFactor = 1.2; // Sidewalks, pedestrian paths
      break;
    case 'cycling':
      routingFactor = 1.25; // Bike paths, some roads
      break;
    case 'hiking':
      routingFactor = 1.6; // Trails, elevation changes
      break;
    case 'mountain_biking':
      routingFactor = 1.5; // Off-road trails
      break;
    case 'racing_bike':
      routingFactor = 1.3; // Primarily roads
      break;
  }
  
  let estimatedDistance = directDistance * routingFactor;
  let estimatedDuration = baseDuration * routingFactor;
  
  // Apply preferences and options
  const modified = applyRouteModifications(estimatedDistance, estimatedDuration, mode, preference, options);
  estimatedDistance = modified.distance;
  estimatedDuration = modified.duration;
  
  // Generate waypoints for visualization
  const waypoints = generateWaypoints(start, end, 5);
  
  // Create route steps
  const steps: OfflineRouteStep[] = [];
  
  // Departure step
  steps.push({
    distance: 0,
    duration: 0,
    instruction: `Head ${direction} towards your destination`,
    maneuver: {
      type: 'depart',
      modifier: 'straight',
      location: [start.lng, start.lat]
    }
  });
  
  // Intermediate steps
  for (let i = 1; i < waypoints.length - 1; i++) {
    const segmentDistance = estimatedDistance / (waypoints.length - 1);
    const segmentDuration = estimatedDuration / (waypoints.length - 1);
    const stepBearing = calculateBearing(waypoints[i-1].lat, waypoints[i-1].lng, waypoints[i].lat, waypoints[i].lng);
    const stepDirection = getDirection(stepBearing);
    
    steps.push({
      distance: segmentDistance,
      duration: segmentDuration,
      instruction: `Continue ${stepDirection} for ${(segmentDistance / 1000).toFixed(1)} km`,
      maneuver: {
        type: 'continue',
        modifier: 'straight',
        location: [waypoints[i].lng, waypoints[i].lat]
      }
    });
  }
  
  // Arrival step
  steps.push({
    distance: 0,
    duration: 0,
    instruction: 'You have arrived at your destination',
    maneuver: {
      type: 'arrive',
      modifier: 'straight',
      location: [end.lng, end.lat]
    }
  });
  
  // Create the route object
  const route: Route = {
    geometry: createGeometry(waypoints),
    legs: [{
      distance: estimatedDistance,
      duration: estimatedDuration,
      steps: steps
    }],
    service: 'offline',
    profile: mode,
    summary: {
      distance: estimatedDistance,
      duration: estimatedDuration,
      profile: mode,
      service: 'offline',
      waypoints: [start, end]
    }
  };
  
  return route;
};

export const getOfflineRouteAlternatives = (
  start: Location, 
  end: Location, 
  mode: RouteMode = 'driving',
  options: RouteOptions = { avoidHighways: false, avoidTolls: false, avoidFerries: false }
): Route[] => {
  const alternatives: Route[] = [];
  
  // Generate 2-3 alternative routes with different characteristics
  const preferences: RoutePreference[] = ['fastest', 'shortest', 'balanced'];
  
  preferences.forEach((preference, index) => {
    const route = getOfflineRoute(start, end, mode, preference, options);
    
    // Modify each alternative slightly to make them distinct
    const variation = 1 + (index * 0.1); // 10% variation per alternative
    if (route.summary) {
      route.summary.distance *= variation;
      route.summary.duration *= variation;
    }
    route.legs[0].distance *= variation;
    route.legs[0].duration *= variation;
    
    // Update instructions to reflect the alternative nature
    if (route.legs[0].steps.length > 1) {
      route.legs[0].steps[1].instruction = `Take ${preference === 'fastest' ? 'faster' : preference === 'shortest' ? 'shorter' : 'scenic'} route`;
    }
    
    alternatives.push(route);
  });
  
  return alternatives;
};

// Utility functions for offline routing
export const isOfflineCapable = (): boolean => {
  return true; // Always available
};

export const getOfflineRoutingStatus = (): { available: boolean, reason?: string } => {
  return {
    available: true
  };
};

export const formatOfflineDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

export const formatOfflineDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

// Emergency/Safety routing for remote areas
export const getEmergencyRoute = (start: Location, end: Location): Route => {
  // Always use walking mode for emergency situations
  const route = getOfflineRoute(start, end, 'walking', 'shortest', {
    avoidHighways: true,
    avoidTolls: false,
    avoidFerries: true
  });
  
  // Add emergency-specific instructions
  if (route.legs[0].steps.length > 0) {
    route.legs[0].steps[0].instruction = '⚠️ EMERGENCY ROUTE - Head towards destination. Stay on main paths.';
    route.legs[0].steps[route.legs[0].steps.length - 1].instruction = '⚠️ You have reached your destination. Seek help if needed.';
  }
  
  return route;
};
