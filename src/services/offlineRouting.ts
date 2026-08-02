import { Location, Route } from '../types';
import { RouteMode, RoutePreference, RouteOptions } from '../components/Routing/RoutePanel';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// BRouter integration interfaces
export interface BRouterRoute {
  success: boolean;
  route?: Route;
  error?: string;
  metadata?: {
    provider: string;
    profile: string;
    offline: boolean;
    distance: number;
    duration: number;
    coordinates_count: number;
  };
}

export interface RoutingProfile {
  id: string;
  name: string;
  description: string;
}

export interface RoutingDataSegment {
  id: string;
  filename: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  url: string;
  size: number;
  downloaded: boolean;
}

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

// Generate realistic waypoints that simulate following roads
const generateRealisticWaypoints = (start: Location, end: Location, mode: RouteMode): [number, number][] => {
  const waypoints: [number, number][] = [];
  
  // Always start with the start point
  waypoints.push([start.lng, start.lat]);
  
  const totalDistance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
  
  // For short distances (< 1km), use direct route with minimal waypoints
  if (totalDistance < 1000) {
    // Add one intermediate point with slight deviation to simulate road following
    const midLat = (start.lat + end.lat) / 2;
    const midLng = (start.lng + end.lng) / 2;
    
    // Add small random deviation to simulate road curves (max 50m)
    const deviation = 0.0005; // ~50m
    const randomDeviation = (Math.random() - 0.5) * deviation;
    
    waypoints.push([midLng + randomDeviation, midLat + randomDeviation]);
    waypoints.push([end.lng, end.lat]);
    return waypoints;
  }
  
  // For longer distances, create more waypoints to simulate realistic road paths
  const numWaypoints = Math.min(Math.floor(totalDistance / 2000), 8); // One waypoint per 2km, max 8
  
  for (let i = 1; i <= numWaypoints; i++) {
    const ratio = i / (numWaypoints + 1);
    
    // Interpolate between start and end
    let lat = start.lat + (end.lat - start.lat) * ratio;
    let lng = start.lng + (end.lng - start.lng) * ratio;
    
    // Add realistic deviations based on transport mode
    const baseDeviation = getRealisticDeviation(mode, totalDistance);
    
    // Add some randomness to simulate road network
    const angle = Math.random() * Math.PI * 2;
    const distance = baseDeviation * (0.5 + Math.random() * 0.5); // 50-100% of base deviation
    
    lat += Math.cos(angle) * distance;
    lng += Math.sin(angle) * distance * Math.cos(lat * Math.PI / 180); // Adjust for latitude
    
    waypoints.push([lng, lat]);
  }
  
  // Always end with the end point
  waypoints.push([end.lng, end.lat]);
  
  return waypoints;
};

// Get realistic deviation amount based on transport mode and distance
const getRealisticDeviation = (mode: RouteMode, distance: number): number => {
  // Base deviation in degrees (approximately)
  const baseDeviations = {
    driving: 0.002, // ~200m - highways can be quite direct
    walking: 0.001, // ~100m - pedestrian paths more direct
    running: 0.001, // ~100m - similar to walking
    cycling: 0.0015, // ~150m - bike paths have moderate deviation
    hiking: 0.003, // ~300m - hiking trails can deviate significantly
    mountain_biking: 0.004, // ~400m - mountain bike trails very winding
    racing_bike: 0.001 // ~100m - racing bikes prefer direct routes
  };
  
  const baseDeviation = baseDeviations[mode] || baseDeviations.driving;
  
  // Scale deviation based on distance - longer routes have more potential for deviation
  const distanceScale = Math.min(distance / 10000, 2); // Scale up to 2x for routes > 10km
  
  return baseDeviation * distanceScale;
};

// BRouter Service Integration
class BRouterIntegration {
  private isInitialized = false;
  private availableProfiles: RoutingProfile[] = [];

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🧭 Initializing BRouter integration...');
      
      const status = await this.getServiceStatus();
      console.log('🔍 BRouter service status check result:', status);
      if (!status.success || status.status !== 'running') {
        console.warn('⚠️ BRouter service is not running, fallback to mathematical routing. Status:', status);
        return;
      }

      this.availableProfiles = await this.getProfiles();
      this.isInitialized = true;
      console.log(`✅ BRouter integration initialized with ${this.availableProfiles.length} profiles`);
      
    } catch (error) {
      console.error('❌ Failed to initialize BRouter:', error);
    }
  }

  async calculateRoute(start: Location, end: Location, profile = 'car-fast'): Promise<BRouterRoute> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/offline-routing/route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startLat: start.lat,
          startLng: start.lng,
          endLat: end.lat,
          endLng: end.lng,
          profile,
          format: 'geojson'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to calculate BRouter route'
        };
      }

      // Transform BRouter response to Route format
      const route: Route = {
        geometry: data.route.geometry,
        legs: [{
          distance: data.route.properties.distance,
          duration: data.route.properties.time,
          steps: this.generateStepsFromCoordinates(data.route.geometry.coordinates, data.route.properties)
        }],
        service: 'brouter',
        profile: profile,
        summary: {
          distance: data.route.properties.distance,
          duration: data.route.properties.time,
          profile: profile,
          service: 'brouter',
          waypoints: [start, end]
        }
      };

      return {
        success: true,
        route,
        metadata: data.metadata
      };

    } catch (error) {
      console.error('BRouter calculation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown routing error'
      };
    }
  }

  private generateStepsFromCoordinates(coordinates: [number, number][], properties: any): OfflineRouteStep[] {
    const steps: OfflineRouteStep[] = [];
    
    if (coordinates.length === 0) return steps;

    // Start step
    steps.push({
      distance: 0,
      duration: 0,
      instruction: 'Head out on your route',
      maneuver: {
        type: 'depart',
        modifier: 'straight',
        location: coordinates[0]
      }
    });

    // Generate intermediate steps
    const segmentDistance = properties.distance / Math.max(1, coordinates.length - 1);
    const segmentDuration = properties.time / Math.max(1, coordinates.length - 1);

    for (let i = 1; i < coordinates.length - 1; i++) {
      const [lng1, lat1] = coordinates[i - 1];
      const [lng2, lat2] = coordinates[i];
      const bearing = calculateBearing(lat1, lng1, lat2, lng2);
      const direction = getDirection(bearing);

      steps.push({
        distance: segmentDistance,
        duration: segmentDuration,
        instruction: `Continue ${direction}`,
        maneuver: {
          type: 'continue',
          modifier: 'straight',
          location: coordinates[i]
        }
      });
    }

    // End step
    steps.push({
      distance: 0,
      duration: 0,
      instruction: 'You have arrived at your destination',
      maneuver: {
        type: 'arrive',
        modifier: 'straight',
        location: coordinates[coordinates.length - 1]
      }
    });

    return steps;
  }

  async getProfiles(): Promise<RoutingProfile[]> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/offline-routing/profiles`);
      const data = await response.json();

      if (response.ok && data.success) {
        return data.profiles;
      } else {
        return this.getDefaultProfiles();
      }
    } catch (error) {
      return this.getDefaultProfiles();
    }
  }

  private getDefaultProfiles(): RoutingProfile[] {
    return [
      { id: 'car-fast', name: 'Car (Fast)', description: 'Fast car routing with highways' },
      { id: 'bicycle', name: 'Bicycle', description: 'Bicycle-friendly routes' },
      { id: 'foot', name: 'Walking', description: 'Pedestrian routes' }
    ];
  }

  async getServiceStatus(): Promise<any> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/offline-routing/status`);
      return await response.json();
    } catch (error) {
      return { success: false, status: 'stopped' };
    }
  }

  isAvailable(): boolean {
    return this.isInitialized;
  }

  getAvailableProfiles(): RoutingProfile[] {
    return this.availableProfiles;
  }
}

// Singleton BRouter integration
const brouterIntegration = new BRouterIntegration();

// Initialize on module load
brouterIntegration.initialize().catch(error => {
  console.error('Failed to initialize BRouter integration:', error);
});

// Map RouteMode to BRouter profiles
const mapRouteModeToProfile = (mode: RouteMode): string => {
  const profileMap: { [key in RouteMode]: string } = {
    driving: 'car-fast',
    walking: 'foot',
    running: 'foot',
    cycling: 'bicycle',
    hiking: 'foot',
    mountain_biking: 'mtb',
    racing_bike: 'bicycle'
  };
  
  return profileMap[mode] || 'car-fast';
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

export const getOfflineRoute = async (
  start: Location, 
  end: Location, 
  mode: RouteMode = 'driving',
  preference: RoutePreference = 'fastest',
  options: RouteOptions = { avoidHighways: false, avoidTolls: false, avoidFerries: false }
): Promise<Route> => {
  console.log('getOfflineRoute called with:', { start, end, mode, preference, options });
  
  // Try BRouter first if available
  console.log('🔍 Checking if BRouter is available:', brouterIntegration.isAvailable());
  if (brouterIntegration.isAvailable()) {
    try {
      const brouterProfile = mapRouteModeToProfile(mode);
      console.log(`🧭 Attempting BRouter routing with profile: ${brouterProfile}`);
      
      const brouterResult = await brouterIntegration.calculateRoute(start, end, brouterProfile);
      
      if (brouterResult.success && brouterResult.route) {
        console.log('✅ BRouter routing successful');
        return brouterResult.route;
      } else {
        console.warn('⚠️ BRouter routing failed, fallback to mathematical routing:', brouterResult.error);
      }
    } catch (error) {
      console.warn('⚠️ BRouter routing error, fallback to mathematical routing:', error);
    }
  }
  
  console.log('📐 Using improved mathematical fallback routing');
  
  // Calculate direct distance and bearing
  const directDistance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
  console.log('Direct distance calculated:', directDistance);
  const bearing = calculateBearing(start.lat, start.lng, end.lat, end.lng);
  const direction = getDirection(bearing);
  
  // Create a more realistic route with waypoints instead of straight line
  const realisticWaypoints = generateRealisticWaypoints(start, end, mode);
  
  // Get speed and calculate base duration
  const speedKmh = getSpeed(mode);
  const speedMs = speedKmh / 3.6; // Convert to m/s
  const baseDuration = directDistance / speedMs; // Duration in seconds
  
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
  
  // Convert realistic waypoints to Location objects for route steps
  const waypoints: Location[] = realisticWaypoints.map(([lng, lat]) => ({ lat, lng }));
  
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
  
  // Create the route object with realistic waypoints
  const route: Route = {
    geometry: {
      type: 'LineString',
      coordinates: realisticWaypoints
    } as any,
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

export const getOfflineRouteAlternatives = async (
  start: Location, 
  end: Location, 
  mode: RouteMode = 'driving',
  options: RouteOptions = { avoidHighways: false, avoidTolls: false, avoidFerries: false }
): Promise<Route[]> => {
  const alternatives: Route[] = [];
  
  // Generate 2-3 alternative routes with different characteristics
  const preferences: RoutePreference[] = ['fastest', 'shortest', 'balanced'];
  
  for (const [index, preference] of preferences.entries()) {
    const route = await getOfflineRoute(start, end, mode, preference, options);
    
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
  }
  
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
export const getEmergencyRoute = async (start: Location, end: Location): Promise<Route> => {
  // Always use walking mode for emergency situations
  const route = await getOfflineRoute(start, end, 'walking', 'shortest', {
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

// BRouter specific exports for advanced functionality
export const getBRouterProfiles = (): RoutingProfile[] => {
  return brouterIntegration.getAvailableProfiles();
};

export const isBRouterAvailable = (): boolean => {
  return brouterIntegration.isAvailable();
};

export const getBRouterServiceStatus = async (): Promise<any> => {
  return await brouterIntegration.getServiceStatus();
};

export const getRequiredRoutingData = async (bounds: { north: number; south: number; east: number; west: number }): Promise<RoutingDataSegment[]> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/offline-routing/routing-data/segments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bounds)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      return data.segments;
    } else {
      console.error('Failed to get routing data segments:', data.error);
      return [];
    }
  } catch (error) {
    console.error('Error getting routing data segments:', error);
    return [];
  }
};

export const downloadRoutingData = async (segments: RoutingDataSegment[]): Promise<boolean> => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/offline-routing/routing-data/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ segments })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log(`📦 Started downloading ${segments.length} routing data segments`);
      return true;
    } else {
      console.error('Failed to start routing data download:', data.error);
      return false;
    }
  } catch (error) {
    console.error('Error starting routing data download:', error);
    return false;
  }
};

// Enhanced offline routing with BRouter integration
export const getEnhancedOfflineRoute = async (
  start: Location, 
  end: Location, 
  mode: RouteMode = 'driving',
  preference: RoutePreference = 'fastest',
  options: RouteOptions = { avoidHighways: false, avoidTolls: false, avoidFerries: false }
): Promise<Route> => {
  return await getOfflineRoute(start, end, mode, preference, options);
};
