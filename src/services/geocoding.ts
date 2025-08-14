import { SearchResult } from '../types';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

export const geocodeSearch = async (query: string): Promise<SearchResult[]> => {
  if (!query.trim()) return [];

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
    return data.display_name || 'Unknown location';
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return 'Unknown location';
  }
};