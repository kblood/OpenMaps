import { Location, Route } from '../types';
import { RouteMode, RoutePreference, RouteOptions } from '../components/Routing/RoutePanel';
import { getOfflineRoute, getOfflineRouteAlternatives } from './offlineRouting';
import { globalMapPackSystem } from './globalMapPackSystem';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Get offline routing preference from environment or localStorage
const getOfflineRoutingPreference = (): boolean => {
  // Check environment variable first
  const envForceOffline = import.meta.env.VITE_FORCE_OFFLINE_ROUTING === 'true';
  if (envForceOffline) return true;
  
  // Check localStorage setting - default to false (online mode)
  const storedPreference = localStorage.getItem('openmaps_offline_routing');
  return storedPreference === 'true';
};

// Routing mode management
export const setOfflineRoutingMode = (enabled: boolean): void => {
  localStorage.setItem('openmaps_offline_routing', enabled.toString());
  console.log(`🧭 Routing mode changed to: ${enabled ? 'offline' : 'online'}`);
};

export const isOfflineRoutingEnabled = (): boolean => {
  return getOfflineRoutingPreference();
};

// Check if route should use offline routing based on map pack settings
const shouldUseOfflineRouting = (start: Location, end: Location): boolean => {
  // First check global offline routing preference
  if (getOfflineRoutingPreference()) return true;
  
  // Check if either start or end point is within a map pack that has offline routing enabled
  const customPacks = globalMapPackSystem.getCustomPacks();
  
  for (const pack of customPacks) {
    if (pack.enableOfflineRouting && pack.isDownloaded) {
      // Check if start point is within this pack
      if (isLocationInPack(start, pack) || isLocationInPack(end, pack)) {
        console.log(`🧭 Using offline routing because route is within pack: ${pack.name}`);
        return true;
      }
    }
  }
  
  return false;
};

// Helper function to check if a location is within a map pack's polygon
const isLocationInPack = (location: Location, pack: any): boolean => {
  if (!pack.polygon || pack.polygon.length < 3) return false;
  
  // Simple point-in-polygon test using ray casting algorithm
  const x = location.lng;
  const y = location.lat;
  let inside = false;
  
  for (let i = 0, j = pack.polygon.length - 1; i < pack.polygon.length; j = i++) {
    const xi = pack.polygon[i][1]; // longitude
    const yi = pack.polygon[i][0]; // latitude
    const xj = pack.polygon[j][1]; // longitude  
    const yj = pack.polygon[j][0]; // latitude
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
};

export const getRoute = async (
  start: Location, 
  end: Location, 
  mode: RouteMode = 'driving',
  preference: RoutePreference = 'fastest',
  options: RouteOptions = { avoidHighways: false, avoidTolls: false, avoidFerries: false }
): Promise<Route | null> => {
  console.log('getRoute called with:', { start, end, mode, preference, options });
  
  // Check if offline routing should be used (global setting or pack-specific)
  const useOfflineRouting = shouldUseOfflineRouting(start, end);
  
  if (useOfflineRouting) {
    console.log('🔌 Offline routing mode enabled, using offline routing directly');
    try {
      const offlineRoute = await getOfflineRoute(start, end, mode, preference, options);
      console.log('✅ Offline routing successful:', offlineRoute);
      return offlineRoute;
    } catch (offlineError) {
      console.error('❌ Offline routing failed:', offlineError);
      return null;
    }
  }
  
  // First try online routing
  try {
    console.log('🌐 Attempting online routing...');
    const params = new URLSearchParams({
      start: `${start.lat},${start.lng}`,
      end: `${end.lat},${end.lng}`,
      profile: mode,
      preference,
      avoidHighways: options.avoidHighways.toString(),
      avoidTolls: options.avoidTolls.toString(),
      avoidFerries: options.avoidFerries.toString()
    });
    
    const url = `${API_BASE_URL}/routing/directions?${params}`;
    console.log('🔗 Routing API URL:', url);
    
    const response = await fetch(url);
    console.log('📡 Online routing response status:', response.status);
    
    if (!response.ok) {
      throw new Error('Routing request failed');
    }
    
    const data = await response.json();
    console.log('📊 Online routing data:', data);
    
    if (data.route) {
      console.log('✅ Online routing successful');
      return data.route;
    }
    
    throw new Error('No route data received');
  } catch (error) {
    console.warn('⚠️ Online routing failed, falling back to offline routing:', error);
    
    // Fallback to offline routing
    try {
      console.log('🔌 Attempting offline routing fallback...');
      const offlineRoute = await getOfflineRoute(start, end, mode, preference, options);
      console.log('✅ Offline routing fallback successful:', offlineRoute);
      return offlineRoute;
    } catch (offlineError) {
      console.error('❌ Offline routing also failed:', offlineError);
      return null;
    }
  }
};

export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

export const getRouteAlternatives = async (
  start: Location, 
  end: Location, 
  mode: RouteMode = 'driving',
  options: RouteOptions = { avoidHighways: false, avoidTolls: false, avoidFerries: false }
): Promise<Route[]> => {
  // Check if offline routing is enabled
  const useOfflineRouting = getOfflineRoutingPreference();
  
  if (useOfflineRouting) {
    console.log('🔌 Offline routing mode enabled, using offline alternatives');
    try {
      const offlineRoutes = await getOfflineRouteAlternatives(start, end, mode, options);
      console.log('✅ Offline alternative routes successful');
      return offlineRoutes;
    } catch (offlineError) {
      console.error('❌ Offline alternative routes failed:', offlineError);
      return [];
    }
  }
  
  // First try online routing
  try {
    const params = new URLSearchParams({
      start: `${start.lat},${start.lng}`,
      end: `${end.lat},${end.lng}`,
      profile: mode,
      alternatives: '3',
      avoidHighways: options.avoidHighways.toString(),
      avoidTolls: options.avoidTolls.toString(),
      avoidFerries: options.avoidFerries.toString()
    });
    
    const response = await fetch(`${API_BASE_URL}/routing/alternatives?${params}`);
    
    if (!response.ok) {
      throw new Error('Alternative routes request failed');
    }
    
    const data = await response.json();
    return data.routes || [];
  } catch (error) {
    console.warn('Online alternative routes failed, falling back to offline routing:', error);
    
    // Fallback to offline routing
    try {
      const offlineRoutes = await getOfflineRouteAlternatives(start, end, mode, options);
      console.log('Using offline alternative routes');
      return offlineRoutes;
    } catch (offlineError) {
      console.error('Offline alternative routes also failed:', offlineError);
      return [];
    }
  }
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export const calculateRouteMetrics = (route: Route) => {
  const totalDistance = route.legs.reduce((sum, leg) => sum + leg.distance, 0);
  const totalDuration = route.legs.reduce((sum, leg) => sum + leg.duration, 0);
  const avgSpeed = totalDistance / totalDuration; // m/s
  const avgSpeedKmh = (avgSpeed * 3.6).toFixed(1);
  
  return {
    distance: totalDistance,
    duration: totalDuration,
    avgSpeedKmh: parseFloat(avgSpeedKmh),
    estimatedFuelCost: calculateFuelCost(totalDistance),
    co2Emissions: calculateCO2Emissions(totalDistance)
  };
};

const calculateFuelCost = (distanceMeters: number): number => {
  const distanceKm = distanceMeters / 1000;
  const fuelConsumptionPer100km = 7; // liters
  const fuelPricePerLiter = 1.5; // USD
  return (distanceKm * fuelConsumptionPer100km * fuelPricePerLiter) / 100;
};

const calculateCO2Emissions = (distanceMeters: number): number => {
  const distanceKm = distanceMeters / 1000;
  const co2PerKm = 0.12; // kg CO2 per km (average car)
  return distanceKm * co2PerKm;
};