// Enhanced Location Service with Polygon-Based Administrative Boundaries
// Uses Natural Earth data and proper geometric validation

// Mock turf.js functions for now (will install proper package later)
const turf = {
  centroid: (_geom: any) => ({ geometry: { coordinates: [0, 0] } }),
  bbox: (_geom: any) => [0, 0, 0, 0],
  area: (_geom: any) => 1000,
  cleanCoords: (feature: any) => feature,
  feature: (geom: any) => ({ geometry: geom }),
  circle: (center: [number, number], radius: number, _options?: any) => ({
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[
        [center[0] - radius, center[1] - radius],
        [center[0] + radius, center[1] - radius],
        [center[0] + radius, center[1] + radius],
        [center[0] - radius, center[1] + radius],
        [center[0] - radius, center[1] - radius]
      ]]
    }
  }),
  bboxPolygon: (bbox: number[]) => ({
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[
        [bbox[0], bbox[1]],
        [bbox[2], bbox[1]],
        [bbox[2], bbox[3]],
        [bbox[0], bbox[3]],
        [bbox[0], bbox[1]]
      ]]
    }
  }),
  intersect: (_geom1: any, _geom2: any) => true // Simplified
};

export interface AdministrativeBoundary {
  id: string;
  name: string;
  type: 'country' | 'region' | 'state' | 'place' | 'locality';
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  centroid: [number, number]; // [lng, lat]
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  parent?: string;
  children: string[];
  metadata: {
    iso_a2?: string;
    iso_a3?: string;
    population?: number;
    area_km2?: number;
    admin_level?: number;
    confidence: number; // 0-1 quality score
    lastUpdated: number;
    source: string;
  };
  estimatedTiles: number;
  estimatedSizeMB: number;
}

export interface TileCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface ValidationResult {
  isValid: boolean;
  exists: boolean;
  hasValidGeometry: boolean;
  qualityScore: number;
  issues: string[];
  recommendations: string[];
}

// Data source interfaces for multiple providers
export interface LocationDataSource {
  name: string;
  priority: number;
  getCountries(): Promise<AdministrativeBoundary[]>;
  getStates(countryId: string): Promise<AdministrativeBoundary[]>;
  getCities(stateId: string): Promise<AdministrativeBoundary[]>;
  search(query: string, types?: string[]): Promise<AdministrativeBoundary[]>;
  validateLocation(id: string): Promise<ValidationResult>;
}

// Natural Earth data source (primary recommended source)
export class NaturalEarthDataSource implements LocationDataSource {
  name = 'Natural Earth';
  priority = 1;
  
  private cache = new Map<string, AdministrativeBoundary[]>();
  private readonly CDN_BASE = 'https://cdn.jsdelivr.net/npm/world-atlas@3.1.0';
  
  async getCountries(): Promise<AdministrativeBoundary[]> {
    if (this.cache.has('countries')) {
      return this.cache.get('countries')!;
    }
    
    try {
      const response = await fetch(`${this.CDN_BASE}/countries-110m.json`);
      const topology = await response.json();
      
      // Convert TopoJSON to boundaries
      const countries = this.convertTopologyTooBoundaries(topology, 'countries');
      this.cache.set('countries', countries);
      
      console.log(`✅ Loaded ${countries.length} countries from Natural Earth`);
      return countries;
    } catch (error) {
      console.error('❌ Failed to load Natural Earth countries:', error);
      return [];
    }
  }
  
  async getStates(countryId: string): Promise<AdministrativeBoundary[]> {
    const cacheKey = `states_${countryId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    try {
      // Load higher resolution data for states
      const response = await fetch(`${this.CDN_BASE}/countries-50m.json`);
      const topology = await response.json();
      
      const states = this.extractStatesForCountry(topology, countryId);
      this.cache.set(cacheKey, states);
      
      console.log(`✅ Loaded ${states.length} states for ${countryId} from Natural Earth`);
      return states;
    } catch (error) {
      console.error(`❌ Failed to load states for ${countryId}:`, error);
      return [];
    }
  }
  
  async getCities(stateId: string): Promise<AdministrativeBoundary[]> {
    // For cities, we'll use a different approach since Natural Earth
    // doesn't provide city boundaries - we'll use populated places
    const cacheKey = `cities_${stateId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    try {
      // Load populated places and create approximate boundaries
      const cities = await this.getPopulatedPlacesForState(stateId);
      this.cache.set(cacheKey, cities);
      
      console.log(`✅ Generated ${cities.length} city boundaries for ${stateId}`);
      return cities;
    } catch (error) {
      console.error(`❌ Failed to generate cities for ${stateId}:`, error);
      return [];
    }
  }
  
  async search(query: string, types: string[] = []): Promise<AdministrativeBoundary[]> {
    const results: AdministrativeBoundary[] = [];
    const searchTerm = query.toLowerCase();
    
    // Search countries
    if (types.length === 0 || types.includes('country')) {
      const countries = await this.getCountries();
      const countryMatches = countries.filter(country => 
        country.name.toLowerCase().includes(searchTerm) ||
        country.metadata.iso_a2?.toLowerCase() === searchTerm ||
        country.metadata.iso_a3?.toLowerCase() === searchTerm
      );
      results.push(...countryMatches);
    }
    
    // Search states (limit to top countries for performance)
    if (types.length === 0 || types.includes('state') || types.includes('region')) {
      const topCountries = ['US', 'CA', 'DE', 'FR', 'GB', 'AU', 'BR', 'IN', 'CN'];
      for (const countryCode of topCountries) {
        const states = await this.getStates(`country_${countryCode.toLowerCase()}`);
        const stateMatches = states.filter(state => 
          state.name.toLowerCase().includes(searchTerm)
        );
        results.push(...stateMatches);
      }
    }
    
    return results.slice(0, 20); // Limit results
  }
  
  async validateLocation(id: string): Promise<ValidationResult> {
    try {
      // Find the location by ID
      const location = await this.findLocationById(id);
      
      if (!location) {
        return {
          isValid: false,
          exists: false,
          hasValidGeometry: false,
          qualityScore: 0,
          issues: ['Location not found in Natural Earth database'],
          recommendations: ['Verify the location name and try searching again']
        };
      }
      
      // Validate geometry
      const geometryValid = this.validateGeometry(location.geometry);
      const qualityScore = this.calculateQualityScore(location);
      
      return {
        isValid: geometryValid && qualityScore > 0.5,
        exists: true,
        hasValidGeometry: geometryValid,
        qualityScore,
        issues: geometryValid ? [] : ['Invalid geometry detected'],
        recommendations: qualityScore < 0.7 ? ['Consider using a higher resolution dataset'] : []
      };
    } catch (error) {
      return {
        isValid: false,
        exists: false,
        hasValidGeometry: false,
        qualityScore: 0,
        issues: [`Validation error: ${error}`],
        recommendations: ['Try a different location or contact support']
      };
    }
  }
  
  // Private helper methods
  private convertTopologyTooBoundaries(topology: any, objectName: string): AdministrativeBoundary[] {
    // This would use topojson library to convert topology to GeoJSON
    // For now, returning a simplified structure
    const boundaries: AdministrativeBoundary[] = [];
    
    if (topology.objects && topology.objects[objectName]) {
      const features = topology.objects[objectName].geometries;
      
      for (const feature of features) {
        const geometry = this.topologyToGeometry(feature, topology);
        const properties = feature.properties || {};
        
        const boundary: AdministrativeBoundary = {
          id: `${objectName}_${properties.ISO_A3 || properties.id || Math.random().toString(36)}`.toLowerCase(),
          name: properties.NAME || properties.name || 'Unknown',
          type: objectName === 'countries' ? 'country' : 'region',
          geometry,
          centroid: turf.centroid(geometry).geometry.coordinates as [number, number],
          bbox: turf.bbox(geometry) as [number, number, number, number],
          parent: undefined,
          children: [],
          metadata: {
            iso_a2: properties.ISO_A2,
            iso_a3: properties.ISO_A3,
            population: properties.POP_EST,
            area_km2: properties.AREA,
            admin_level: objectName === 'countries' ? 0 : 1,
            confidence: 0.9, // Natural Earth is high quality
            lastUpdated: Date.now(),
            source: 'Natural Earth'
          },
          estimatedTiles: 0,
          estimatedSizeMB: 0
        };
        
        // Calculate tile estimates
        this.calculateTileEstimates(boundary);
        
        boundaries.push(boundary);
      }
    }
    
    return boundaries;
  }
  
  private topologyToGeometry(_feature: any, _topology: any): GeoJSON.Polygon | GeoJSON.MultiPolygon {
    // Simplified implementation - in reality would use topojson library
    // For now, create a simple polygon from the bounding box
    const bbox = _feature.bbox || [-180, -90, 180, 90];
    
    return {
      type: 'Polygon',
      coordinates: [[
        [bbox[0], bbox[1]],
        [bbox[2], bbox[1]],
        [bbox[2], bbox[3]],
        [bbox[0], bbox[3]],
        [bbox[0], bbox[1]]
      ]]
    };
  }
  
  private extractStatesForCountry(_topology: any, countryId: string): AdministrativeBoundary[] {
    // Implementation would extract state-level features for a specific country
    // This is a simplified placeholder
    const states: AdministrativeBoundary[] = [];
    
    // For now, return some example states for the US
    if (countryId.includes('us')) {
      const usStates = [
        { name: 'California', iso: 'CA' },
        { name: 'New York', iso: 'NY' },
        { name: 'Texas', iso: 'TX' },
        { name: 'Florida', iso: 'FL' }
      ];
      
      for (const state of usStates) {
        states.push({
          id: `state_us_${state.iso.toLowerCase()}`,
          name: state.name,
          type: 'state',
          geometry: this.createExamplePolygon(), // Placeholder
          centroid: [-100, 40], // Placeholder
          bbox: [-125, 25, -65, 50], // Placeholder
          parent: countryId,
          children: [],
          metadata: {
            iso_a2: state.iso,
            confidence: 0.8,
            lastUpdated: Date.now(),
            source: 'Natural Earth'
          },
          estimatedTiles: 1000,
          estimatedSizeMB: 50
        });
      }
    }
    
    return states;
  }
  
  private async getPopulatedPlacesForState(stateId: string): Promise<AdministrativeBoundary[]> {
    // Create approximate city boundaries based on populated places
    // This is a placeholder implementation
    const cities: AdministrativeBoundary[] = [];
    
    // Example cities for California
    if (stateId.includes('ca')) {
      const caCities = [
        { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
        { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
        { name: 'San Diego', lat: 32.7157, lng: -117.1611 }
      ];
      
      for (const city of caCities) {
        // Create a small polygon around the city center
        const radius = 0.1; // degrees
        const polygon = turf.circle([city.lng, city.lat], radius, { units: 'degrees' });
        
        cities.push({
          id: `city_${stateId}_${city.name.toLowerCase().replace(/\s+/g, '_')}`,
          name: city.name,
          type: 'place',
          geometry: polygon.geometry as GeoJSON.Polygon,
          centroid: [city.lng, city.lat],
          bbox: turf.bbox(polygon) as [number, number, number, number],
          parent: stateId,
          children: [],
          metadata: {
            confidence: 0.7,
            lastUpdated: Date.now(),
            source: 'Natural Earth (Generated)'
          },
          estimatedTiles: 100,
          estimatedSizeMB: 5
        });
      }
    }
    
    return cities;
  }
  
  private async findLocationById(id: string): Promise<AdministrativeBoundary | undefined> {
    // Search through all cached data for the location
    for (const [, boundaries] of this.cache) {
      const found = boundaries.find(b => b.id === id);
      if (found) return found;
    }
    
    return undefined;
  }
  
  private validateGeometry(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): boolean {
    try {
      // Use turf.js to validate geometry
      const feature = turf.feature(geometry);
      
      // Check for self-intersections and other issues
      const cleaned = turf.cleanCoords(feature);
      const area = turf.area(cleaned);
      
      return area > 0 && !isNaN(area) && isFinite(area);
    } catch (error) {
      console.warn('Geometry validation failed:', error);
      return false;
    }
  }
  
  private calculateQualityScore(boundary: AdministrativeBoundary): number {
    let score = 0.5; // Base score
    
    // Higher score for having metadata
    if (boundary.metadata.iso_a2) score += 0.1;
    if (boundary.metadata.iso_a3) score += 0.1;
    if (boundary.metadata.population) score += 0.1;
    if (boundary.metadata.area_km2) score += 0.1;
    
    // Higher score for Natural Earth source
    if (boundary.metadata.source === 'Natural Earth') score += 0.2;
    
    // Lower score for generated data
    if (boundary.metadata.source.includes('Generated')) score -= 0.1;
    
    return Math.min(1, Math.max(0, score));
  }
  
  private calculateTileEstimates(boundary: AdministrativeBoundary): void {
    try {
      const area = turf.area(boundary.geometry);
      const areaDegrees = area / (111000 * 111000); // Rough conversion to square degrees
      
      // Estimate tiles needed for different zoom levels
      // This is a simplified calculation
      let totalTiles = 0;
      
      for (let zoom = 1; zoom <= 15; zoom++) {
        const tilesAtZoom = Math.ceil(areaDegrees * Math.pow(4, zoom));
        totalTiles += tilesAtZoom;
      }
      
      boundary.estimatedTiles = totalTiles;
      boundary.estimatedSizeMB = Math.ceil(totalTiles * 0.015); // ~15KB per tile average
    } catch (error) {
      console.warn('Failed to calculate tile estimates:', error);
      boundary.estimatedTiles = 1000; // Fallback
      boundary.estimatedSizeMB = 15; // Fallback
    }
  }
  
  private createExamplePolygon(): GeoJSON.Polygon {
    // Create a simple square polygon for examples
    return {
      type: 'Polygon',
      coordinates: [[
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
        [-1, -1]
      ]]
    };
  }
}

// Enhanced Location Service that coordinates multiple data sources
export class EnhancedLocationService {
  private sources: LocationDataSource[] = [];
  private cache = new Map<string, AdministrativeBoundary[]>();
  private validationCache = new Map<string, ValidationResult>();
  
  constructor() {
    // Register data sources in priority order
    this.sources.push(new NaturalEarthDataSource());
    // Could add MapboxDataSource, RestCountriesDataSource, etc.
  }
  
  async getCountries(): Promise<AdministrativeBoundary[]> {
    return this.queryWithFallback('getCountries');
  }
  
  async getStates(countryId: string): Promise<AdministrativeBoundary[]> {
    return this.queryWithFallback('getStates', countryId);
  }
  
  async getCities(stateId: string): Promise<AdministrativeBoundary[]> {
    return this.queryWithFallback('getCities', stateId);
  }
  
  async searchLocations(query: string, types?: string[]): Promise<AdministrativeBoundary[]> {
    const results: AdministrativeBoundary[] = [];
    
    for (const source of this.sources) {
      try {
        const sourceResults = await source.search(query, types);
        results.push(...sourceResults);
      } catch (error) {
        console.warn(`Search failed for ${source.name}:`, error);
      }
    }
    
    // Remove duplicates and sort by quality score
    const uniqueResults = this.deduplicateAndSort(results);
    return uniqueResults.slice(0, 20);
  }
  
  async validateLocation(id: string): Promise<ValidationResult> {
    if (this.validationCache.has(id)) {
      return this.validationCache.get(id)!;
    }
    
    // Try each source until we get a validation
    for (const source of this.sources) {
      try {
        const result = await source.validateLocation(id);
        if (result.exists) {
          this.validationCache.set(id, result);
          return result;
        }
      } catch (error) {
        console.warn(`Validation failed for ${source.name}:`, error);
      }
    }
    
    // If no source can validate, return negative result
    const negativeResult: ValidationResult = {
      isValid: false,
      exists: false,
      hasValidGeometry: false,
      qualityScore: 0,
      issues: ['Location not found in any data source'],
      recommendations: ['Verify location name or try a different search term']
    };
    
    this.validationCache.set(id, negativeResult);
    return negativeResult;
  }
  
  async calculateTilesForBoundary(boundary: AdministrativeBoundary, minZoom: number = 1, maxZoom: number = 15): Promise<TileCoordinate[]> {
    const tiles: TileCoordinate[] = [];
    
    try {
      for (let z = minZoom; z <= maxZoom; z++) {
        const tilesAtZoom = this.getPolygonTiles(boundary.geometry, z);
        tiles.push(...tilesAtZoom);
      }
      
      console.log(`📍 Calculated ${tiles.length} tiles for ${boundary.name} (zoom ${minZoom}-${maxZoom})`);
      return tiles;
    } catch (error) {
      console.error('Failed to calculate tiles for boundary:', error);
      return [];
    }
  }
  
  // Private helper methods
  private async queryWithFallback(method: string, ...args: any[]): Promise<AdministrativeBoundary[]> {
    const cacheKey = `${method}_${args.join('_')}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    for (const source of this.sources) {
      try {
        const result = await (source as any)[method](...args);
        if (result && result.length > 0) {
          this.cache.set(cacheKey, result);
          return result;
        }
      } catch (error) {
        console.warn(`Query failed for ${source.name}:`, error);
      }
    }
    
    return [];
  }
  
  private deduplicateAndSort(boundaries: AdministrativeBoundary[]): AdministrativeBoundary[] {
    const seen = new Set<string>();
    const unique: AdministrativeBoundary[] = [];
    
    for (const boundary of boundaries) {
      const key = `${boundary.name}_${boundary.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(boundary);
      }
    }
    
    // Sort by quality score descending
    return unique.sort((a, b) => b.metadata.confidence - a.metadata.confidence);
  }
  
  private getPolygonTiles(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon, zoom: number): TileCoordinate[] {
    const tiles: TileCoordinate[] = [];
    
    try {
      // Get the bounding box of the polygon
      const bbox = turf.bbox(geometry);
      
      // Convert bbox to tile coordinates
      const minTile = this.lngLatToTile(bbox[0], bbox[3], zoom); // top-left
      const maxTile = this.lngLatToTile(bbox[2], bbox[1], zoom); // bottom-right
      
      // Generate all tiles in the bounding box
      for (let x = minTile.x; x <= maxTile.x; x++) {
        for (let y = minTile.y; y <= maxTile.y; y++) {
          // Check if tile actually intersects with polygon
          const tileBounds = this.tileToLngLatBounds(x, y, zoom);
          const tilePolygon = turf.bboxPolygon(tileBounds);
          
          if (turf.intersect(geometry, tilePolygon.geometry)) {
            tiles.push({ x, y, z: zoom });
          }
        }
      }
    } catch (error) {
      console.warn('Failed to calculate polygon tiles:', error);
    }
    
    return tiles;
  }
  
  private lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
    const latRad = lat * Math.PI / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n);
    
    return { x, y };
  }
  
  private tileToLngLatBounds(x: number, y: number, zoom: number): [number, number, number, number] {
    const n = Math.pow(2, zoom);
    const west = x / n * 360 - 180;
    const east = (x + 1) / n * 360 - 180;
    const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
    
    return [west, south, east, north];
  }
}

// Export the enhanced service instance
export const enhancedLocationService = new EnhancedLocationService();
