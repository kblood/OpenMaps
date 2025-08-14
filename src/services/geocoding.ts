import { SearchResult } from '../types';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

// Helper function to detect if query is GPS coordinates
const parseCoordinates = (query: string): { lat: number; lng: number } | null => {
  // Remove spaces and split by comma
  const cleaned = query.trim().replace(/\s/g, '');
  const parts = cleaned.split(',');
  
  if (parts.length === 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    
    // Check if both are valid numbers and within valid ranges
    if (!isNaN(lat) && !isNaN(lng) && 
        lat >= -90 && lat <= 90 && 
        lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  
  return null;
};

export const geocodeSearch = async (query: string): Promise<SearchResult[]> => {
  if (!query.trim()) return [];

  // Check if query is coordinates
  const coords = parseCoordinates(query);
  if (coords) {
    try {
      // Reverse geocode to get address
      const address = await reverseGeocode(coords.lat, coords.lng);
      return [{
        place_id: `coord_${Date.now()}`,
        lat: coords.lat.toString(),
        lon: coords.lng.toString(),
        display_name: address,
        type: 'coordinate',
        importance: 1.0,
        boundingbox: [
          coords.lat.toString(),
          coords.lat.toString(),
          coords.lng.toString(),
          coords.lng.toString()
        ]
      }];
    } catch (error) {
      console.error('Coordinate geocoding error:', error);
    }
  }

  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
    );
    
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
};

export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(
      `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    
    if (!response.ok) {
      throw new Error('Reverse geocoding request failed');
    }
    
    const data = await response.json();
    
    // If we have a display name, use it
    if (data.display_name) {
      return data.display_name;
    }
    
    // If no address found, return GPS coordinates
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Return GPS coordinates as fallback
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
};