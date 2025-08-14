import { Location, Route } from '../types';
import { RouteMode, RoutePreference, RouteOptions } from '../components/Routing/RoutePanel';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const getRoute = async (
  start: Location, 
  end: Location, 
  mode: RouteMode = 'driving',
  preference: RoutePreference = 'fastest',
  options: RouteOptions = { avoidHighways: false, avoidTolls: false, avoidFerries: false }
): Promise<Route | null> => {
  try {
    const params = new URLSearchParams({
      start: `${start.lat},${start.lng}`,
      end: `${end.lat},${end.lng}`,
      profile: mode,
      preference,
      avoidHighways: options.avoidHighways.toString(),
      avoidTolls: options.avoidTolls.toString(),
      avoidFerries: options.avoidFerries.toString()
    });
    
    const response = await fetch(`${API_BASE_URL}/routing/directions?${params}`);
    
    if (!response.ok) {
      throw new Error('Routing request failed');
    }
    
    const data = await response.json();
    
    if (data.route) {
      return data.route;
    }
    
    return null;
  } catch (error) {
    console.error('Routing error:', error);
    return null;
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
    console.error('Alternative routes error:', error);
    return [];
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