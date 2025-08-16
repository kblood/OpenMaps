// Proper Administrative Boundary Service using GeoNames API
// Solves the problem of finding non-existent locations by using authoritative government data

export interface GeoNamesLocation {
  geonameId: number;
  name: string;
  asciiName: string;
  lat: number;
  lng: number;
  countryCode: string;
  countryName: string;
  adminCode1?: string; // State/Province code
  adminName1?: string; // State/Province name  
  adminCode2?: string; // County/District code
  adminName2?: string; // County/District name
  adminCode3?: string; // Municipality code
  adminName3?: string; // Municipality name
  population?: number;
  elevation?: number;
  featureClass: string; // A=Administrative, P=Populated place, etc.
  featureCode: string; // ADM1=State, ADM2=County, PPL=City, etc.
  timezone?: string;
  bbox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface HierarchicalLocation {
  geonameId: number;
  name: string;
  type: 'country' | 'state' | 'county' | 'city' | 'district';
  coordinates: [number, number]; // [lng, lat]
  bounds?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  population?: number;
  parent?: HierarchicalLocation;
  children: HierarchicalLocation[];
  countryCode: string;
  adminCodes: {
    level1?: string; // State
    level2?: string; // County  
    level3?: string; // Municipality
  };
  featureCode: string;
  confidence: number; // 0-1 based on data completeness
  estimatedTiles: number;
  estimatedSizeMB: number;
}

// Real administrative boundary service using GeoNames
export class GeoNamesAdminService {
  private readonly API_BASE = 'http://api.geonames.org';
  private readonly username: string;
  private cache = new Map<string, HierarchicalLocation[]>();
  
  constructor(username: string = 'demo') { // You need to register for free username
    this.username = username;
    console.log('🌍 GeoNames Admin Service initialized');
    console.warn('⚠️ Using demo username - register at geonames.org for production use');
  }

  // Get all countries with proper administrative structure
  async getCountries(): Promise<HierarchicalLocation[]> {
    const cacheKey = 'countries';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      console.log('🌍 Loading countries from GeoNames...');
      
      // Get all countries
      const response = await fetch(
        `${this.API_BASE}/countryInfoJSON?username=${this.username}`
      );
      
      if (!response.ok) {
        throw new Error(`GeoNames API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🔍 GeoNames API response structure:', data);
      
      // Handle different possible response structures
      const geonamesArray = data.geonames || data || [];
      if (!Array.isArray(geonamesArray)) {
        console.error('❌ Unexpected GeoNames response structure:', data);
        throw new Error('Invalid GeoNames response structure');
      }
      
      const countries: HierarchicalLocation[] = geonamesArray.map((country: any) => ({
        geonameId: country.geonameId,
        name: country.countryName,
        type: 'country' as const,
        coordinates: [parseFloat(country.lng), parseFloat(country.lat)],
        bounds: country.bbox ? [
          parseFloat(country.west),
          parseFloat(country.south), 
          parseFloat(country.east),
          parseFloat(country.north)
        ] : undefined,
        population: country.population,
        parent: undefined,
        children: [],
        countryCode: country.countryCode,
        adminCodes: {},
        featureCode: 'PCLI', // Independent political entity
        confidence: 1.0, // Countries are always reliable
        estimatedTiles: this.estimateTilesFromBounds(country.bbox ? [
          parseFloat(country.west),
          parseFloat(country.south), 
          parseFloat(country.east),
          parseFloat(country.north)
        ] : [-180, -90, 180, 90]),
        estimatedSizeMB: 0
      }));
      
      // Calculate size estimates
      countries.forEach(country => {
        country.estimatedSizeMB = Math.ceil(country.estimatedTiles * 0.015);
      });
      
      this.cache.set(cacheKey, countries);
      console.log(`✅ Loaded ${countries.length} countries from GeoNames`);
      return countries;
      
    } catch (error) {
      console.error('❌ Failed to load countries from GeoNames:', error);
      return [];
    }
  }

  // Get states/provinces for a country using GeoNames administrative hierarchy
  async getStatesForCountry(countryCode: string): Promise<HierarchicalLocation[]> {
    const cacheKey = `states_${countryCode}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      console.log(`🏛️ Loading states for ${countryCode} from GeoNames...`);
      
      // Search for administrative divisions level 1 (states/provinces)
      const response = await fetch(
        `${this.API_BASE}/searchJSON?` +
        `country=${countryCode}&` +
        `featureCode=ADM1&` + // Administrative division level 1
        `maxRows=100&` +
        `username=${this.username}`
      );
      
      if (!response.ok) {
        throw new Error(`GeoNames API error: ${response.status}`);
      }
      
      const data = await response.json();
      const states: HierarchicalLocation[] = data.geonames.map((state: any) => ({
        geonameId: state.geonameId,
        name: state.name,
        type: 'state' as const,
        coordinates: [parseFloat(state.lng), parseFloat(state.lat)],
        bounds: state.bbox ? [
          parseFloat(state.bbox.west),
          parseFloat(state.bbox.south),
          parseFloat(state.bbox.east), 
          parseFloat(state.bbox.north)
        ] : undefined,
        population: state.population,
        parent: undefined, // Will be set when needed
        children: [],
        countryCode: state.countryCode,
        adminCodes: {
          level1: state.adminCode1
        },
        featureCode: state.fcode,
        confidence: this.calculateConfidence(state),
        estimatedTiles: this.estimateTilesFromBounds(state.bbox ? [
          parseFloat(state.bbox.west),
          parseFloat(state.bbox.south),
          parseFloat(state.bbox.east), 
          parseFloat(state.bbox.north)
        ] : undefined),
        estimatedSizeMB: 0
      }));
      
      // Calculate size estimates
      states.forEach(state => {
        state.estimatedSizeMB = Math.ceil(state.estimatedTiles * 0.015);
      });
      
      this.cache.set(cacheKey, states);
      console.log(`✅ Loaded ${states.length} states for ${countryCode} from GeoNames`);
      return states;
      
    } catch (error) {
      console.error(`❌ Failed to load states for ${countryCode}:`, error);
      return [];
    }
  }

  // Get counties/districts for a state
  async getCountiesForState(countryCode: string, stateCode: string): Promise<HierarchicalLocation[]> {
    const cacheKey = `counties_${countryCode}_${stateCode}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      console.log(`🏛️ Loading counties for ${countryCode}/${stateCode} from GeoNames...`);
      
      // Search for administrative divisions level 2 (counties/districts)
      const response = await fetch(
        `${this.API_BASE}/searchJSON?` +
        `country=${countryCode}&` +
        `adminCode1=${stateCode}&` +
        `featureCode=ADM2&` + // Administrative division level 2
        `maxRows=200&` +
        `username=${this.username}`
      );
      
      if (!response.ok) {
        throw new Error(`GeoNames API error: ${response.status}`);
      }
      
      const data = await response.json();
      const counties: HierarchicalLocation[] = data.geonames.map((county: any) => ({
        geonameId: county.geonameId,
        name: county.name,
        type: 'county' as const,
        coordinates: [parseFloat(county.lng), parseFloat(county.lat)],
        bounds: county.bbox ? [
          parseFloat(county.bbox.west),
          parseFloat(county.bbox.south),
          parseFloat(county.bbox.east), 
          parseFloat(county.bbox.north)
        ] : undefined,
        population: county.population,
        parent: undefined,
        children: [],
        countryCode: county.countryCode,
        adminCodes: {
          level1: county.adminCode1,
          level2: county.adminCode2
        },
        featureCode: county.fcode,
        confidence: this.calculateConfidence(county),
        estimatedTiles: this.estimateTilesFromBounds(county.bbox ? [
          parseFloat(county.bbox.west),
          parseFloat(county.bbox.south),
          parseFloat(county.bbox.east), 
          parseFloat(county.bbox.north)
        ] : undefined),
        estimatedSizeMB: 0
      }));
      
      // Calculate size estimates
      counties.forEach(county => {
        county.estimatedSizeMB = Math.ceil(county.estimatedTiles * 0.015);
      });
      
      this.cache.set(cacheKey, counties);
      console.log(`✅ Loaded ${counties.length} counties for ${countryCode}/${stateCode} from GeoNames`);
      return counties;
      
    } catch (error) {
      console.error(`❌ Failed to load counties for ${countryCode}/${stateCode}:`, error);
      return [];
    }
  }

  // Get cities for a specific administrative area
  async getCitiesForAdmin(countryCode: string, stateCode?: string, countyCode?: string): Promise<HierarchicalLocation[]> {
    const cacheKey = `cities_${countryCode}_${stateCode || 'all'}_${countyCode || 'all'}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      console.log(`🏙️ Loading cities for ${countryCode}/${stateCode}/${countyCode} from GeoNames...`);
      
      // Build query parameters
      let queryParams = `country=${countryCode}&`;
      if (stateCode) queryParams += `adminCode1=${stateCode}&`;
      if (countyCode) queryParams += `adminCode2=${countyCode}&`;
      
      // Search for populated places (cities, towns)
      const response = await fetch(
        `${this.API_BASE}/searchJSON?` +
        queryParams +
        `featureClass=P&` + // Populated places
        `featureCode=PPL&featureCode=PPLA&featureCode=PPLA2&featureCode=PPLA3&featureCode=PPLA4&featureCode=PPLC&` + // Various city types
        `maxRows=500&` +
        `orderby=population&` +
        `username=${this.username}`
      );
      
      if (!response.ok) {
        throw new Error(`GeoNames API error: ${response.status}`);
      }
      
      const data = await response.json();
      const cities: HierarchicalLocation[] = data.geonames
        .filter((city: any) => city.population > 1000) // Filter for actual cities
        .map((city: any) => ({
          geonameId: city.geonameId,
          name: city.name,
          type: 'city' as const,
          coordinates: [parseFloat(city.lng), parseFloat(city.lat)],
          bounds: undefined, // Cities are points, we'll generate small bounds
          population: city.population,
          parent: undefined,
          children: [],
          countryCode: city.countryCode,
          adminCodes: {
            level1: city.adminCode1,
            level2: city.adminCode2,
            level3: city.adminCode3
          },
          featureCode: city.fcode,
          confidence: this.calculateConfidence(city),
          estimatedTiles: this.estimateTilesForCity(city.population),
          estimatedSizeMB: 0
        }));
      
      // Generate small bounding boxes for cities and calculate sizes
      cities.forEach(city => {
        const radius = this.getCityRadius(city.population || 1000);
        city.bounds = [
          city.coordinates[0] - radius,
          city.coordinates[1] - radius,
          city.coordinates[0] + radius,
          city.coordinates[1] + radius
        ];
        city.estimatedSizeMB = Math.ceil(city.estimatedTiles * 0.015);
      });
      
      this.cache.set(cacheKey, cities);
      console.log(`✅ Loaded ${cities.length} cities for ${countryCode}/${stateCode}/${countyCode} from GeoNames`);
      return cities;
      
    } catch (error) {
      console.error(`❌ Failed to load cities for ${countryCode}/${stateCode}/${countyCode}:`, error);
      return [];
    }
  }

  // Search locations with proper hierarchy validation
  async searchLocations(query: string, countryCode?: string): Promise<HierarchicalLocation[]> {
    try {
      console.log(`🔍 Searching for "${query}" in GeoNames${countryCode ? ` (${countryCode})` : ''}...`);
      
      let queryParams = `q=${encodeURIComponent(query)}&`;
      if (countryCode) queryParams += `country=${countryCode}&`;
      
      const response = await fetch(
        `${this.API_BASE}/searchJSON?` +
        queryParams +
        `maxRows=20&` +
        `orderby=relevance&` +
        `username=${this.username}`
      );
      
      if (!response.ok) {
        throw new Error(`GeoNames API error: ${response.status}`);
      }
      
      const data = await response.json();
      const results: HierarchicalLocation[] = data.geonames.map((item: any) => ({
        geonameId: item.geonameId,
        name: item.name,
        type: this.mapFeatureCodeToType(item.fcode),
        coordinates: [parseFloat(item.lng), parseFloat(item.lat)],
        bounds: item.bbox ? [
          parseFloat(item.bbox.west),
          parseFloat(item.bbox.south),
          parseFloat(item.bbox.east), 
          parseFloat(item.bbox.north)
        ] : this.generateBoundsForLocation(item),
        population: item.population,
        parent: undefined,
        children: [],
        countryCode: item.countryCode,
        adminCodes: {
          level1: item.adminCode1,
          level2: item.adminCode2,
          level3: item.adminCode3
        },
        featureCode: item.fcode,
        confidence: this.calculateConfidence(item),
        estimatedTiles: this.estimateTilesFromBounds(item.bbox ? [
          parseFloat(item.bbox.west),
          parseFloat(item.bbox.south),
          parseFloat(item.bbox.east), 
          parseFloat(item.bbox.north)
        ] : this.generateBoundsForLocation(item)),
        estimatedSizeMB: 0
      }));
      
      // Calculate size estimates
      results.forEach(result => {
        result.estimatedSizeMB = Math.ceil(result.estimatedTiles * 0.015);
      });
      
      console.log(`✅ Found ${results.length} results for "${query}"`);
      return results;
      
    } catch (error) {
      console.error(`❌ Search failed for "${query}":`, error);
      return [];
    }
  }

  // Validate that a location actually exists and is properly categorized
  async validateLocation(geonameId: number): Promise<{isValid: boolean; location?: HierarchicalLocation; issues: string[]}> {
    try {
      console.log(`🔍 Validating location ${geonameId}...`);
      
      const response = await fetch(
        `${this.API_BASE}/getJSON?geonameId=${geonameId}&username=${this.username}`
      );
      
      if (!response.ok) {
        return {
          isValid: false,
          issues: [`API error: ${response.status}`]
        };
      }
      
      const data = await response.json();
      const issues: string[] = [];
      
      // Validate data completeness
      if (!data.name) issues.push('Missing name');
      if (!data.lat || !data.lng) issues.push('Missing coordinates'); 
      if (!data.countryCode) issues.push('Missing country code');
      if (!data.fcode) issues.push('Missing feature code');
      
      // Validate feature type appropriateness
      if (!this.isValidFeatureCode(data.fcode)) {
        issues.push(`Invalid feature code: ${data.fcode}`);
      }
      
      const location: HierarchicalLocation = {
        geonameId: data.geonameId,
        name: data.name,
        type: this.mapFeatureCodeToType(data.fcode),
        coordinates: [parseFloat(data.lng), parseFloat(data.lat)],
        bounds: data.bbox ? [
          parseFloat(data.bbox.west),
          parseFloat(data.bbox.south),
          parseFloat(data.bbox.east), 
          parseFloat(data.bbox.north)
        ] : this.generateBoundsForLocation(data),
        population: data.population,
        parent: undefined,
        children: [],
        countryCode: data.countryCode,
        adminCodes: {
          level1: data.adminCode1,
          level2: data.adminCode2,
          level3: data.adminCode3
        },
        featureCode: data.fcode,
        confidence: this.calculateConfidence(data),
        estimatedTiles: 0,
        estimatedSizeMB: 0
      };
      
      // Calculate estimates
      location.estimatedTiles = this.estimateTilesFromBounds(location.bounds);
      location.estimatedSizeMB = Math.ceil(location.estimatedTiles * 0.015);
      
      return {
        isValid: issues.length === 0,
        location,
        issues
      };
      
    } catch (error) {
      return {
        isValid: false,
        issues: [`Validation error: ${error}`]
      };
    }
  }

  // Private helper methods
  private mapFeatureCodeToType(featureCode: string): 'country' | 'state' | 'county' | 'city' | 'district' {
    if (featureCode === 'PCLI') return 'country';
    if (featureCode === 'ADM1') return 'state';
    if (featureCode === 'ADM2') return 'county';
    if (featureCode === 'ADM3' || featureCode === 'ADM4') return 'district';
    if (featureCode.startsWith('PPL')) return 'city';
    return 'city'; // Default fallback
  }

  private isValidFeatureCode(featureCode: string): boolean {
    const validCodes = [
      'PCLI', // Country
      'ADM1', 'ADM2', 'ADM3', 'ADM4', // Administrative divisions
      'PPL', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPLC', 'PPLS' // Populated places
    ];
    return validCodes.includes(featureCode);
  }

  private calculateConfidence(geoname: any): number {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence for complete data
    if (geoname.name) confidence += 0.1;
    if (geoname.population) confidence += 0.1;
    if (geoname.adminCode1) confidence += 0.1;
    if (geoname.bbox) confidence += 0.1;
    if (geoname.timezone) confidence += 0.1;
    
    // Higher confidence for administrative features
    if (geoname.fcode.startsWith('ADM') || geoname.fcode === 'PCLI') confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  private estimateTilesFromBounds(bounds?: [number, number, number, number]): number {
    if (!bounds) return 100; // Fallback
    
    const [west, south, east, north] = bounds;
    const width = east - west;
    const height = north - south;
    const area = width * height;
    
    // Rough tile estimation for zoom levels 1-15
    let totalTiles = 0;
    for (let zoom = 1; zoom <= 15; zoom++) {
      const tilesAtZoom = area * Math.pow(4, zoom) / 360; // Very rough approximation
      totalTiles += tilesAtZoom;
    }
    
    return Math.ceil(totalTiles);
  }

  private estimateTilesForCity(population: number): number {
    // Estimate tiles based on city size
    if (population > 1000000) return 500; // Major city
    if (population > 100000) return 200; // Large city
    if (population > 10000) return 100; // Medium city
    return 50; // Small city
  }

  private getCityRadius(population: number): number {
    // Return radius in degrees for city bounds
    if (population > 1000000) return 0.1; // ~11km
    if (population > 100000) return 0.05; // ~5.5km
    if (population > 10000) return 0.02; // ~2.2km
    return 0.01; // ~1.1km
  }

  private generateBoundsForLocation(geoname: any): [number, number, number, number] {
    const lng = parseFloat(geoname.lng);
    const lat = parseFloat(geoname.lat);
    
    // Generate small bounds around the point
    let radius = 0.01; // Default 1.1km radius
    
    if (geoname.fcode === 'PCLI') radius = 2.0; // Country
    else if (geoname.fcode === 'ADM1') radius = 0.5; // State
    else if (geoname.fcode === 'ADM2') radius = 0.2; // County
    else if (geoname.population > 100000) radius = 0.05; // Large city
    
    return [lng - radius, lat - radius, lng + radius, lat + radius];
  }
}

// Export service instance with demo credentials
export const geoNamesAdminService = new GeoNamesAdminService();

// Note: For production use, register at geonames.org and replace 'demo' with your username
console.log('⚠️ GeoNames Service: Using demo credentials - register at geonames.org for production use');
