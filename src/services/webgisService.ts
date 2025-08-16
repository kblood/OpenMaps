// WebGIS Integration Service: fetch administrative boundary polygons and helpers
import { DynamicLocationNode } from './dynamicLocationService';

export interface BoundaryResult {
  polygon: [number, number][]; // [lat, lng]
  bounds: { north: number; south: number; east: number; west: number };
  source: 'overpass' | 'bounds';
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

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

    return {
      polygon,
      bounds: boundsFromPolygon(polygon),
      source: 'overpass'
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
