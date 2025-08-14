export interface Location {
  lat: number;
  lng: number;
}

export interface SearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
  importance: number;
  type?: string;
  boundingbox?: string[];
}

export interface Route {
  geometry: {
    coordinates: [number, number][];
  };
  legs: Array<{
    distance: number;
    duration: number;
    steps: Array<{
      instruction: string;
      distance: number;
      duration: number;
    }>;
  }>;
  service?: string;
  profile?: string;
  summary?: {
    distance: number;
    duration: number;
    profile?: string;
    service?: string;
    waypoints?: Array<{ lat: number; lng: number }>;
  };
}

export interface Marker {
  id: string;
  position: Location;
  title: string;
  description?: string;
}