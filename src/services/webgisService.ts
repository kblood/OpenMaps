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

export interface PlaceResult {
  center: { lat: number; lng: number };
  bounds: { north: number; south: number; east: number; west: number };
  source: 'overpass';
  placeType: 'city' | 'town' | 'village' | 'hamlet' | 'suburb' | 'neighbourhood';
  properties: {
    name: string;
    population?: number;
    importance?: number;
    adminLevelHint?: number;
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
// Enhanced function to get full polygon geometry for cities and administrative areas
export async function getFullPolygonForPlace(placeName: string, location: { lat: number; lng: number }, searchRadius: number = 0.1): Promise<BoundaryResult | null> {
  try {
    console.log(`🌍 Searching for full polygon geometry for: ${placeName}`);
    
    // Create search area around the location
    const bbox = `${location.lat - searchRadius},${location.lng - searchRadius},${location.lat + searchRadius},${location.lng + searchRadius}`;
    const nameEscaped = placeName.replace(/['"]/g, '\\"');
    
    // Enhanced Overpass query to get full geometry
    const overpassQuery = `[out:json][timeout:30];
      (
        // Search for administrative boundaries with matching name
        relation["boundary"="administrative"]["name"~"^${nameEscaped}$",i](${bbox});
        relation["boundary"="administrative"]["name:en"~"^${nameEscaped}$",i](${bbox});
        relation["boundary"="administrative"]["alt_name"~"${nameEscaped}",i](${bbox});
        
        // Also search for place nodes/areas with the name
        node["place"]["name"~"^${nameEscaped}$",i](${bbox});
        way["place"]["name"~"^${nameEscaped}$",i](${bbox});
        relation["place"]["name"~"^${nameEscaped}$",i](${bbox});
        
        // Search for specific city/town/village tags
        node["place"~"^(city|town|village|municipality)$"]["name"~"^${nameEscaped}$",i](${bbox});
        way["place"~"^(city|town|village|municipality)$"]["name"~"^${nameEscaped}$",i](${bbox});
        relation["place"~"^(city|town|village|municipality)$"]["name"~"^${nameEscaped}$",i](${bbox});
      );
      out geom center tags bb;`;

    console.log('🔍 Overpass query:', overpassQuery);

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: overpassQuery
    });

    if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
    const data = await response.json();

    const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];
    console.log(`📊 Found ${elements.length} potential matches`);

    if (elements.length === 0) return null;

    // Score and rank the results
    const scoredElements = elements.map(element => {
      let score = 0;
      const name = element.tags?.name || '';
      const nameMatch = name.toLowerCase() === placeName.toLowerCase();
      
      // Exact name match gets highest score
      if (nameMatch) score += 100;
      
      // Administrative boundaries get preference
      if (element.tags?.boundary === 'administrative') score += 50;
      
      // Prefer relations over ways over nodes for better geometry
      if (element.type === 'relation') score += 30;
      else if (element.type === 'way') score += 20;
      else score += 10;
      
      // Admin level preference (8=city, 6=municipality, 4=county, etc.)
      const adminLevel = parseInt(element.tags?.admin_level || '0');
      if (adminLevel >= 6 && adminLevel <= 10) score += 20;
      
      // Place type preference
      const place = element.tags?.place;
      if (['city', 'town'].includes(place)) score += 15;
      else if (['village', 'municipality'].includes(place)) score += 10;
      
      return { element, score, nameMatch };
    });

    // Sort by score and get the best match
    scoredElements.sort((a, b) => b.score - a.score);
    const best = scoredElements[0];
    
    console.log(`🏆 Best match: ${best.element.tags?.name} (score: ${best.score}, type: ${best.element.type})`);

    return await extractPolygonFromElement(best.element);
  } catch (err) {
    console.error('🚨 Full polygon search failed:', err);
    return null;
  }
}

// Helper function to extract polygon from OSM element
async function extractPolygonFromElement(element: any): Promise<BoundaryResult | null> {
  try {
    let polygon: [number, number][] = [];

    if (element.type === 'relation' && element.members) {
      // For relations, we need to reconstruct the polygon from member ways
      console.log('🔗 Processing relation with', element.members.length, 'members');
      
      // Get all outer way members
      const outerWays = element.members.filter((m: any) => 
        m.type === 'way' && (m.role === 'outer' || m.role === '')
      );
      
      if (outerWays.length > 0) {
        // For complex relations, we'll use the geometry if available
        if (element.geometry && Array.isArray(element.geometry)) {
          polygon = element.geometry
            .filter((g: any) => g.type === 'node')
            .map((g: any) => [g.lat, g.lon]);
        }
      }
    } else if (element.type === 'way' && element.geometry) {
      // For ways, extract coordinates directly
      console.log('📍 Processing way with', element.geometry.length, 'nodes');
      polygon = element.geometry.map((g: any) => [g.lat, g.lon]);
    } else if (element.type === 'node') {
      // For nodes (point places), create a small polygon around them
      console.log('📌 Processing node, creating small polygon');
      const lat = element.lat;
      const lon = element.lon;
      const size = 0.005; // ~500m radius
      polygon = [
        [lat - size, lon - size],
        [lat - size, lon + size],
        [lat + size, lon + size],
        [lat + size, lon - size],
        [lat - size, lon - size]
      ];
    }

    // Ensure polygon is closed
    if (polygon.length > 0) {
      const first = polygon[0];
      const last = polygon[polygon.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        polygon.push([first[0], first[1]]);
      }
    }

    // Simplify polygon if it's too complex (more than 1000 points)
    if (polygon.length > 1000) {
      console.log(`🔄 Simplifying polygon from ${polygon.length} to ~200 points`);
      const step = Math.ceil(polygon.length / 200);
      const simplified = polygon.filter((_, i) => i % step === 0);
      simplified.push(polygon[polygon.length - 1]); // Keep the last point
      polygon = simplified;
    }

    if (polygon.length < 3) {
      console.warn('⚠️ Invalid polygon geometry');
      return null;
    }

    const bounds = boundsFromPolygon(polygon);
    const adminLevel = parseInt(element.tags?.admin_level || '0');

    console.log(`✅ Extracted polygon with ${polygon.length} points, area: ${calculatePolygonArea(polygon).toFixed(2)} km²`);

    return {
      polygon,
      bounds,
      source: 'overpass',
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
  } catch (err) {
    console.error('🚨 Polygon extraction failed:', err);
    return null;
  }
}

export async function getAdminBoundariesByQuery(query: AdminBoundaryQuery): Promise<BoundaryResult[]> {
  try {
    const adminLevels = query.adminLevels || [2, 4, 6, 8]; // Default: country, state, county, city
    const bbox = query.bbox ? `${query.bbox.south},${query.bbox.west},${query.bbox.north},${query.bbox.east}` : '';

    // NOTE: Avoid filtering sub-national boundaries by ISO3166-1 tag (rarely present below country).
    // BBox constraint is sufficient for scoping; optional name filter remains.
    const levelQueries = adminLevels.map(level =>
      `relation["boundary"="administrative"]["admin_level"="${level}"]${query.nameFilter ? `["name"~"${query.nameFilter.replace('"', '\\"')}",i]` : ''}${bbox ? `(${bbox})` : ''};`
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

// Query OSM places (nodes/ways/relations) by place tag within a bbox
export async function getPlacesByTag(options: {
  placeTypes?: Array<'city' | 'town' | 'village' | 'hamlet' | 'suburb' | 'neighbourhood'>;
  bbox: { north: number; south: number; east: number; west: number };
  nameFilter?: string;
  limit?: number;
}): Promise<PlaceResult[]> {
  try {
    const types = options.placeTypes && options.placeTypes.length > 0
      ? options.placeTypes
      : ['city', 'town', 'village'];
    const bbox = `${options.bbox.south},${options.bbox.west},${options.bbox.north},${options.bbox.east}`;
    const typeRegex = `^(${types.join('|')})$`;
    const nameClause = options.nameFilter ? `["name"~"${options.nameFilter.replace('"', '\\"')}",i]` : '';

    const overpassQuery = `[out:json][timeout:30];
      (
        node["place"~"${typeRegex}"]${nameClause}(${bbox});
        way["place"~"${typeRegex}"]${nameClause}(${bbox});
        relation["place"~"${typeRegex}"]${nameClause}(${bbox});
      );
      out center tags bb${options.limit ? ` ${options.limit}` : ''};`;

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: overpassQuery
    });

    if (!response.ok) throw new Error(`Overpass HTTP ${response.status}`);
    const data = await response.json();
    const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];

    return elements.map((el: any) => {
      const bounds = el.bounds ? {
        north: el.bounds.maxlat,
        south: el.bounds.minlat,
        east: el.bounds.maxlon,
        west: el.bounds.minlon
      } : boundsFromPolygon(polygonFromBounds({
        north: (el.center?.lat ?? el.lat) + 0.02,
        south: (el.center?.lat ?? el.lat) - 0.02,
        east: (el.center?.lon ?? el.lon) + 0.02,
        west: (el.center?.lon ?? el.lon) - 0.02,
      }));

      const lat = el.center?.lat ?? el.lat;
      const lon = el.center?.lon ?? el.lon;
      const placeType = (el.tags?.place || 'city') as PlaceResult['placeType'];
      const population = el.tags?.population ? parseInt(el.tags.population) : undefined;
      return {
        center: { lat, lng: lon },
        bounds,
        source: 'overpass' as const,
        placeType,
        properties: {
          name: el.tags?.name || 'Unknown',
          population,
          importance: el.tags?.importance ? parseFloat(el.tags.importance) : undefined,
          adminLevelHint: el.tags?.admin_level ? parseInt(el.tags.admin_level) : undefined
        }
      } as PlaceResult;
    });
  } catch (err) {
    console.warn('Place query failed:', err);
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
