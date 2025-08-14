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
}

export interface Marker {
  id: string;
  position: Location;
  title: string;
  description?: string;
}