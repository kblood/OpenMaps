// WebGIS Integration Service: fetch administrative boundary polygons and helpers
import { DynamicLocationNode } from './dynamicLocationService';

export interface BoundaryResult {
  polygon: [number, number][]; // [lat, lng]
  bounds: { north: number; south: number; east: number; west: number };
  source: 'overpass' | 'bounds';
  adminLevel?: number;
  properties?: {
    name: string;
    adminLevel: number;
    population?: number;
    area?: number; // km²
    perimeter?: number; // km
    countryCode?: string;
    parentAdmin?: string;
  };
}

export interface SpatialQueryResult {
  contains: boolean;
  distance?: number; // km from boundary
  nearestPoint?: [number, number];
  adminHierarchy?: string[]; // from country down to local
}

export interface AdminBoundaryQuery {
  adminLevels?: number[]; // e.g. [2, 4, 6] for country, state, city
  countryCode?: string;
  nameFilter?: string;
  populationRange?: { min?: number; max?: number };
  areaRange?: { min?: number; max?: number }; // km²
  bbox?: { north: number; south: number; east: number; west: number };
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Admin level mapping for consistent styling and queries
const ADMIN_LEVEL_CONFIG = {
  0: { name: 'country', color: '#FF6B6B', weight: 3 },
  1: { name: 'state/province', color: '#4ECDC4', weight: 2 },
  2: { name: 'country', color: '#FF6B6B', weight: 3 },
  3: { name: 'region', color: '#45B7D1', weight: 2 },
  4: { name: 'state/province', color: '#4ECDC4', weight: 2 },
  5: { name: 'district', color: '#96CEB4', weight: 1.5 },
  6: { name: 'county/municipality', color: '#FECA57', weight: 1.5 },
  7: { name: 'municipality', color: '#FF9FF3', weight: 1 },
  8: { name: 'city/town', color: '#54A0FF', weight: 1 },
  9: { name: 'district/suburb', color: '#5F27CD', weight: 0.5 },
  10: { name: 'neighbourhood', color: '#00D2D3', weight: 0.5 }
};

// Convert bbox bounds to rectangle polygon (closed ring)
export function polygonFromBounds(bounds: { north: number; south: number; east: number; west: number }): [number, number][] {
  return [
    [bounds.south, bounds.west],
    [bounds.south, bounds.east],
    [bounds.north, bounds.east],
    [bounds.north, bounds.west],
    [bounds.south, bounds.west]
  ];
}

// Compute bounds from a polygon
export function boundsFromPolygon(polygon: [number, number][]) {
  const lats = polygon.map(p => p[0]);
  const lngs = polygon.map(p => p[1]);
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs)
  };
}

// Multi-level administrative boundary query with filtering
export async function getAdminBoundariesByQuery(query: AdminBoundaryQuery): Promise<BoundaryResult[]> {
  try {
    const adminLevels = query.adminLevels || [2, 4, 6, 8]; // Default: country, state, county, city
    const bbox = query.bbox ? `${query.bbox.south},${query.bbox.west},${query.bbox.north},${query.bbox.east}` : '';
    
    const levelQueries = adminLevels.map(level => 
      `relation["boundary"="administrative"]["admin_level"="${level}"]${query.countryCode ? `["ISO3166-1"="${query.countryCode}"]` : ''}${query.nameFilter ? `["name"~"${query.nameFilter.replace('"', '\\"')}",i]` : ''}${bbox ? `(${bbox})` : ''};`
    ).join('\n        ');

    const overpassQuery = `[out:json][timeout:30];
      (
        ${levelQueries}
      );
      out center tags bb;`;

    console.log('🌍 Multi-level admin boundary query:', overpassQuery);

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: overpassQuery
    });

    if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
    const data = await response.json();

    const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];
    
    return elements.map(element => {
      const adminLevel = parseInt(element.tags?.admin_level || '0');
      const polygon = element.bounds ? polygonFromBounds({
        north: element.bounds.maxlat,
        south: element.bounds.minlat,
        east: element.bounds.maxlon,
        west: element.bounds.minlon
      }) : [];

      return {
        polygon,
        bounds: element.bounds ? {
          north: element.bounds.maxlat,
          south: element.bounds.minlat,
          east: element.bounds.maxlon,
          west: element.bounds.minlon
        } : boundsFromPolygon(polygon),
        source: 'overpass' as const,
        adminLevel,
        properties: {
          name: element.tags?.name || 'Unknown',
          adminLevel,
          population: element.tags?.population ? parseInt(element.tags.population) : undefined,
          area: calculatePolygonArea(polygon),
          perimeter: calculatePolygonPerimeter(polygon),
          countryCode: element.tags?.['ISO3166-1'] || element.tags?.['country_code'],
          parentAdmin: element.tags?.['is_in'] || element.tags?.['addr:state']
        }
      };
    }).filter(result => result.polygon.length > 0);
  } catch (err) {
    console.warn('Multi-level admin boundary query failed:', err);
    return [];
  }
}

// Point-in-polygon spatial containment query
export async function findContainingAdminBoundaries(lat: number, lng: number, maxAdminLevel: number = 10): Promise<SpatialQueryResult> {
  try {
    // Query for all admin levels that might contain this point
    const overpassQuery = `[out:json][timeout:25];
      (
        relation["boundary"="administrative"]["admin_level"~"^[0-${maxAdminLevel}]$"](around:100,${lat},${lng});
      );
      out center tags bb;`;

    const response = await fetch(OVERPASS_URL, {
      method: 'POST', 
      headers: { 'Content-Type': 'text/plain' },
      body: overpassQuery
    });

    if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
    const data = await response.json();

    const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];
    const containingBoundaries: string[] = [];

    // Check actual containment for each boundary
    for (const element of elements) {
      if (element.bounds) {
        const polygon = polygonFromBounds({
          north: element.bounds.maxlat,
          south: element.bounds.minlat,
          east: element.bounds.maxlon,
          west: element.bounds.minlon
        });
        
        if (isPointInPolygon([lat, lng], polygon)) {
          const adminLevel = parseInt(element.tags?.admin_level || '0');
          const name = element.tags?.name || 'Unknown';
          containingBoundaries.push(`${name} (Level ${adminLevel})`);
        }
      }
    }

    // Sort by admin level (lower = higher in hierarchy)
    containingBoundaries.sort((a, b) => {
      const levelA = parseInt(a.match(/Level (\d+)/)?.[1] || '99');
      const levelB = parseInt(b.match(/Level (\d+)/)?.[1] || '99');
      return levelA - levelB;
    });

    return {
      contains: containingBoundaries.length > 0,
      adminHierarchy: containingBoundaries
    };
  } catch (err) {
    console.warn('Spatial containment query failed:', err);
    return { contains: false };
  }
}

// Try fetching an administrative boundary polygon for a location via Overpass
export async function getAdminBoundaryPolygon(location: DynamicLocationNode): Promise<BoundaryResult | null> {
  try {
    // Only attempt for geo-admin levels
    const isAdminLevel = ['country', 'state', 'region', 'city', 'district'].includes(location.level);
    if (!isAdminLevel) return null;

    const bbox = `${location.bounds.south},${location.bounds.west},${location.bounds.north},${location.bounds.east}`;
    const nameEscaped = location.name.replace('"', '\\"');

    // Prefer relation with boundary=administrative and exact name within bbox
    const query = `[out:json][timeout:25];
      (
        relation["boundary"="administrative"]["name"="${nameEscaped}"](${bbox});
        relation["type"="boundary"]["boundary"="administrative"]["name"="${nameEscaped}"](${bbox});
      );
      out center tags;`;

    const response = await fetch(OVERPASS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: query });
    if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
    const data = await response.json();

    const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];
    // Pick the best match: prefer exact name, then largest area-like bounds
    const chosen = elements.sort((a, b) => {
      const aMatch = a?.tags?.name === location.name ? 1 : 0;
      const bMatch = b?.tags?.name === location.name ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      const aArea = areaScore(a?.bounds);
      const bArea = areaScore(b?.bounds);
      return bArea - aArea;
    })[0];

    if (!chosen) return null;

    // Build polygon from available geometry info or bounds as fallback
    let polygon: [number, number][] | null = null;
  if (Array.isArray(chosen.geometry) && chosen.geometry.length > 3) {
      // geometry is array of nodes; we will sample to avoid huge arrays
      const step = Math.max(1, Math.floor(chosen.geometry.length / 2000)); // cap points
      polygon = chosen.geometry.filter((_: any, i: number) => i % step === 0).map((g: any) => [g.lat, g.lon]);
      if (polygon && polygon.length > 0 && (polygon[0][0] !== polygon[polygon.length - 1][0] || polygon[0][1] !== polygon[polygon.length - 1][1])) {
        polygon.push(polygon[0]);
      }
    }

    if (!polygon && chosen.bounds) {
      polygon = polygonFromBounds({
        north: chosen.bounds.maxlat,
        south: chosen.bounds.minlat,
        east: chosen.bounds.maxlon,
        west: chosen.bounds.minlon
      });
    }

    if (!polygon) return null;

    const adminLevel = parseInt(chosen.tags?.admin_level || '0');
    
    return {
      polygon,
      bounds: boundsFromPolygon(polygon),
      source: 'overpass',
      adminLevel,
      properties: {
        name: chosen.tags?.name || location.name,
        adminLevel,
        population: chosen.tags?.population ? parseInt(chosen.tags.population) : undefined,
        area: calculatePolygonArea(polygon),
        perimeter: calculatePolygonPerimeter(polygon),
        countryCode: chosen.tags?.['ISO3166-1'] || chosen.tags?.['country_code'],
        parentAdmin: chosen.tags?.['is_in'] || chosen.tags?.['addr:state']
      }
    };
  } catch (err) {
    console.warn('WebGIS boundary fetch failed:', err);
    return null;
  }
}

function areaScore(bounds?: { maxlat: number; minlat: number; maxlon: number; minlon: number }) {
  if (!bounds) return 0;
  const w = Math.abs((bounds.maxlon ?? 0) - (bounds.minlon ?? 0));
  const h = Math.abs((bounds.maxlat ?? 0) - (bounds.minlat ?? 0));
  return w * h;
}

// Calculate polygon area in km² using spherical approximation
export function calculatePolygonArea(polygon: [number, number][]): number {
  if (polygon.length < 3) return 0;
  
  let area = 0;
  const earthRadius = 6371; // km
  
  for (let i = 0; i < polygon.length - 1; i++) {
    const [lat1, lng1] = polygon[i];
    const [lat2, lng2] = polygon[i + 1];
    
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const deltaLng = (lng2 - lng1) * Math.PI / 180;
    
    area += deltaLng * (2 + Math.sin(lat1Rad) + Math.sin(lat2Rad));
  }
  
  area = Math.abs(area * earthRadius * earthRadius / 2);
  return Math.round(area * 100) / 100; // Round to 2 decimal places
}

// Calculate polygon perimeter in km
export function calculatePolygonPerimeter(polygon: [number, number][]): number {
  if (polygon.length < 2) return 0;
  
  let perimeter = 0;
  
  for (let i = 0; i < polygon.length - 1; i++) {
    const [lat1, lng1] = polygon[i];
    const [lat2, lng2] = polygon[i + 1];
    perimeter += haversineDistance(lat1, lng1, lat2, lng2);
  }
  
  return Math.round(perimeter * 100) / 100; // Round to 2 decimal places
}

// Haversine distance formula for great circle distance
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Point-in-polygon test using ray casting algorithm
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

// Get styling configuration for admin level
export function getAdminLevelStyling(adminLevel: number) {
  return ADMIN_LEVEL_CONFIG[adminLevel as keyof typeof ADMIN_LEVEL_CONFIG] || { name: 'unknown', color: '#666666', weight: 1 };
}

// Filter boundaries by attributes
export function filterBoundariesByAttributes(boundaries: BoundaryResult[], filters: {
  minPopulation?: number;
  maxPopulation?: number;
  minArea?: number;
  maxArea?: number;
  namePattern?: string;
}): BoundaryResult[] {
  return boundaries.filter(boundary => {
    const props = boundary.properties;
    if (!props) return true;
    
    if (filters.minPopulation && (!props.population || props.population < filters.minPopulation)) return false;
    if (filters.maxPopulation && (!props.population || props.population > filters.maxPopulation)) return false;
    if (filters.minArea && (!props.area || props.area < filters.minArea)) return false;
    if (filters.maxArea && (!props.area || props.area > filters.maxArea)) return false;
    if (filters.namePattern && !props.name.toLowerCase().includes(filters.namePattern.toLowerCase())) return false;
    
    return true;
  });
}
