// Dynamic Location Service with API Integration and Caching
import { GlobalMapNode, SearchableLocation } from '../data/globalMapHierarchy';

// Enhanced location interface for dynamic loading
export interface DynamicLocationNode {
  id: string;
  name: string;
  level: 'world' | 'continent' | 'country' | 'state' | 'region' | 'city' | 'district' | 'custom';
  parentId?: string;
  hasChildren: boolean;
  childrenLoaded: boolean;
  childrenIds: string[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center: {
    lat: number;
    lng: number;
  };
  population?: number;
  area?: number;
  isCapital?: boolean;
  isPreloaded: boolean;
  estimatedTiles: number;
  estimatedSizeMB: number;
  isDownloaded: boolean;
  downloadProgress?: number;
  priority: number;
  tags: string[];
  metadata: {
    countryCode?: string;
    adminLevel?: number;
    timezone?: string;
    language?: string;
    currency?: string;
    wikidata?: string;
    geonameid?: number;
  };
  lastUpdated: number;
  source: 'preloaded' | 'api' | 'nominatim' | 'overpass' | 'user';
}

export interface LocationQuery {
  parentId?: string;
  level?: string;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  search?: string;
  limit?: number;
  minPopulation?: number;
  includeChildren?: boolean;
}

export interface LocationAPIResponse {
  locations: DynamicLocationNode[];
  hasMore: boolean;
  totalCount: number;
  nextCursor?: string;
}

export class DynamicLocationService {
  private dbName = 'openmaps_locations';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private cache: Map<string, DynamicLocationNode> = new Map();
  private loadingPromises: Map<string, Promise<DynamicLocationNode[]>> = new Map();
  
  // API endpoints for different data sources
  private readonly API_ENDPOINTS = {
    nominatim: 'https://nominatim.openstreetmap.org',
    overpass: 'https://overpass-api.de/api/interpreter',
    restcountries: 'https://restcountries.com/v3.1',
    geonames: 'http://api.geonames.org', // Requires API key
  };

  constructor() {
    this.initializeDatabase();
  }

  // ==================== DATABASE INITIALIZATION ====================
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.preloadCoreData();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Location nodes store
        const locationStore = db.createObjectStore('locations', { keyPath: 'id' });
        locationStore.createIndex('level', 'level');
        locationStore.createIndex('parentId', 'parentId');
        locationStore.createIndex('countryCode', 'metadata.countryCode');
        locationStore.createIndex('lastUpdated', 'lastUpdated');
        locationStore.createIndex('population', 'population');
        
        // Search index store
        const searchStore = db.createObjectStore('searchIndex', { keyPath: 'id' });
        searchStore.createIndex('tokens', 'searchTokens', { multiEntry: true });
        searchStore.createIndex('level', 'level');
        
        // API cache store
        const cacheStore = db.createObjectStore('apiCache', { keyPath: 'key' });
        cacheStore.createIndex('expiry', 'expiry');
      };
    });
  }

  // ==================== CORE DATA PRELOADING ====================
  private async preloadCoreData(): Promise<void> {
    // Load minimal world structure that's always available offline
    const coreData: DynamicLocationNode[] = [
      {
        id: 'world',
        name: 'World',
        level: 'world',
        hasChildren: true,
        childrenLoaded: false,
        childrenIds: [],
        bounds: { north: 85, south: -85, east: 180, west: -180 },
        center: { lat: 0, lng: 0 },
        isPreloaded: true,
        estimatedTiles: 1000000,
        estimatedSizeMB: 20000,
        isDownloaded: false,
        priority: 1,
        tags: ['global'],
        metadata: {},
        lastUpdated: Date.now(),
        source: 'preloaded'
      },
      // Continents
      {
        id: 'north_america',
        name: 'North America',
        level: 'continent',
        parentId: 'world',
        hasChildren: true,
        childrenLoaded: false,
        childrenIds: [],
        bounds: { north: 83.11, south: 5.5, east: -12.2, west: -168.0 },
        center: { lat: 54.5, lng: -105.0 },
        isPreloaded: true,
        estimatedTiles: 150000,
        estimatedSizeMB: 3000,
        isDownloaded: false,
        priority: 2,
        tags: ['continent'],
        metadata: {},
        lastUpdated: Date.now(),
        source: 'preloaded'
      },
      {
        id: 'south_america',
        name: 'South America',
        level: 'continent',
        parentId: 'world',
        hasChildren: true,
        childrenLoaded: false,
        childrenIds: [],
        bounds: { north: 15.25, south: -59.44, east: -26.87, west: -91.66 },
        center: { lat: -8.78, lng: -55.49 },
        isPreloaded: true,
        estimatedTiles: 120000,
        estimatedSizeMB: 2400,
        isDownloaded: false,
        priority: 2,
        tags: ['continent'],
        metadata: {},
        lastUpdated: Date.now(),
        source: 'preloaded'
      },
      {
        id: 'europe',
        name: 'Europe',
        level: 'continent',
        parentId: 'world',
        hasChildren: true,
        childrenLoaded: false,
        childrenIds: [],
        bounds: { north: 81.0, south: 27.64, east: 69.0, west: -31.27 },
        center: { lat: 54.0, lng: 15.0 },
        isPreloaded: true,
        estimatedTiles: 100000,
        estimatedSizeMB: 2000,
        isDownloaded: false,
        priority: 2,
        tags: ['continent'],
        metadata: {},
        lastUpdated: Date.now(),
        source: 'preloaded'
      },
      {
        id: 'africa',
        name: 'Africa',
        level: 'continent',
        parentId: 'world',
        hasChildren: true,
        childrenLoaded: false,
        childrenIds: [],
        bounds: { north: 37.35, south: -34.83, east: 51.27, west: -25.36 },
        center: { lat: 0.0, lng: 20.0 },
        isPreloaded: true,
        estimatedTiles: 120000,
        estimatedSizeMB: 2400,
        isDownloaded: false,
        priority: 2,
        tags: ['continent'],
        metadata: {},
        lastUpdated: Date.now(),
        source: 'preloaded'
      },
      {
        id: 'asia',
        name: 'Asia',
        level: 'continent',
        parentId: 'world',
        hasChildren: true,
        childrenLoaded: false,
        childrenIds: [],
        bounds: { north: 81.0, south: -11.0, east: 180.0, west: 26.0 },
        center: { lat: 35.0, lng: 100.0 },
        isPreloaded: true,
        estimatedTiles: 200000,
        estimatedSizeMB: 4000,
        isDownloaded: false,
        priority: 2,
        tags: ['continent'],
        metadata: {},
        lastUpdated: Date.now(),
        source: 'preloaded'
      },
      {
        id: 'oceania',
        name: 'Oceania',
        level: 'continent',
        parentId: 'world',
        hasChildren: true,
        childrenLoaded: false,
        childrenIds: [],
        bounds: { north: 30.0, south: -55.0, east: 180.0, west: 110.0 },
        center: { lat: -25.0, lng: 140.0 },
        isPreloaded: true,
        estimatedTiles: 80000,
        estimatedSizeMB: 1600,
        isDownloaded: false,
        priority: 2,
        tags: ['continent'],
        metadata: {},
        lastUpdated: Date.now(),
        source: 'preloaded'
      }
    ];

    // Save core data to cache and database
    for (const location of coreData) {
      this.cache.set(location.id, location);
      await this.saveLocation(location);
    }
  }

  // ==================== DYNAMIC LOCATION LOADING ====================
  async getChildren(parentId: string, forceRefresh = false): Promise<DynamicLocationNode[]> {
    const parent = await this.getLocation(parentId);
    if (!parent) {
      throw new Error(`Parent location ${parentId} not found`);
    }

    // Return cached children if already loaded and not forcing refresh
    if (parent.childrenLoaded && !forceRefresh && parent.childrenIds.length > 0) {
      const children = await Promise.all(
        parent.childrenIds.map(id => this.getLocation(id))
      );
      return children.filter(child => child !== null) as DynamicLocationNode[];
    }

    // Check for existing loading promise to avoid duplicate requests
    const loadingKey = `children_${parentId}`;
    if (this.loadingPromises.has(loadingKey)) {
      return this.loadingPromises.get(loadingKey)!;
    }

    // Create loading promise
    const loadingPromise = this.loadChildrenFromAPI(parent);
    this.loadingPromises.set(loadingKey, loadingPromise);

    try {
      const children = await loadingPromise;
      
      // Update parent to mark children as loaded
      parent.childrenLoaded = true;
      parent.childrenIds = children.map(child => child.id);
      this.cache.set(parent.id, parent);
      await this.saveLocation(parent);

      return children;
    } finally {
      this.loadingPromises.delete(loadingKey);
    }
  }

  private async loadChildrenFromAPI(parent: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    try {
      let children: DynamicLocationNode[] = [];

      console.log(`🔄 Loading children for ${parent.name} (${parent.level})`);

      switch (parent.level) {
        case 'world':
          // Children are continents (already preloaded)
          children = await this.getLocationsByParent(parent.id);
          console.log(`📍 Found ${children.length} preloaded continents`);
          break;
          
        case 'continent':
          // Load countries from REST Countries API
          console.log(`🌍 Loading countries for continent: ${parent.name}`);
          children = await this.loadCountriesForContinent(parent);
          break;
          
        case 'country':
          // For now, let's use a simpler approach for states
          console.log(`🏴 Loading states/regions for country: ${parent.name}`);
          children = await this.loadSimpleStatesForCountry(parent);
          break;
          
        case 'state':
          // Load major cities only
          console.log(`🏙️ Loading cities for state: ${parent.name}`);
          children = await this.loadSimpleCitiesForState(parent);
          break;
          
        case 'city':
          // Skip districts for now to avoid API complexity
          console.log(`🏘️ City level reached: ${parent.name} (no districts loaded)`);
          children = [];
          break;

        default:
          console.warn(`No loading strategy for level: ${parent.level}`);
      }

      // Save all children to database and cache
      for (const child of children) {
        this.cache.set(child.id, child);
        await this.saveLocation(child);
      }

      console.log(`✅ Successfully loaded ${children.length} children for ${parent.name} (${parent.level})`);
      return children;

    } catch (error) {
      console.error(`❌ Failed to load children for ${parent.name}:`, error);
      console.error('Error details:', error);
      
      // Try fallback for some levels
      if (parent.level === 'continent') {
        console.log('🔄 Trying fallback for continent...');
        return await this.loadFallbackCountriesForContinent(parent);
      }
      
      // Return empty array on error, but don't mark as loaded
      return [];
    }
  }

  // ==================== API-SPECIFIC LOADERS ====================
  private async loadCountriesForContinent(continent: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    try {
      console.log(`📡 Calling REST Countries API for ${continent.name}...`);
      
      // Use REST Countries API to get all countries
      const response = await fetch(`${this.API_ENDPOINTS.restcountries}/all?fields=name,cca2,cca3,region,subregion,latlng,area,population,capital,languages,currencies,timezones`, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`REST Countries API error: ${response.status} - ${response.statusText}`);
      }

      const countriesData = await response.json();
      const continentMapping: { [key: string]: string[] } = {
        'north_america': ['Americas'],
        'south_america': ['Americas'],
        'europe': ['Europe'],
        'africa': ['Africa'],
        'asia': ['Asia'],
        'oceania': ['Oceania']
      };

      const continentRegions = continentMapping[continent.id] || [];
      
      const countries: DynamicLocationNode[] = countriesData
        .filter((country: any) => continentRegions.includes(country.region))
        .filter((country: any) => {
          // Additional filtering for Americas
          if (continent.id === 'north_america') {
            return country.subregion === 'Northern America' || 
                   country.subregion === 'Central America' || 
                   country.subregion === 'Caribbean';
          }
          if (continent.id === 'south_america') {
            return country.subregion === 'South America';
          }
          return true;
        })
        .map((country: any) => {
          const bounds = this.calculateCountryBounds(country);
          return {
            id: `country_${country.cca2.toLowerCase()}`,
            name: country.name.common,
            level: 'country' as const,
            parentId: continent.id,
            hasChildren: true,
            childrenLoaded: false,
            childrenIds: [],
            bounds,
            center: {
              lat: country.latlng[0] || 0,
              lng: country.latlng[1] || 0
            },
            population: country.population,
            area: country.area,
            isCapital: false,
            isPreloaded: false,
            estimatedTiles: Math.ceil(country.area / 1000),
            estimatedSizeMB: Math.ceil(country.area / 50),
            isDownloaded: false,
            priority: country.population > 100000000 ? 3 : 4,
            tags: ['country'],
            metadata: {
              countryCode: country.cca2,
              timezone: country.timezones[0],
              language: Object.keys(country.languages || {})[0],
              currency: Object.keys(country.currencies || {})[0]
            },
            lastUpdated: Date.now(),
            source: 'api' as const
          };
        });

      return countries;
    } catch (error) {
      console.error('Failed to load countries:', error);
      throw error; // Let parent handle fallback
    }
  }

  // Fallback method with hardcoded major countries if API fails
  private async loadFallbackCountriesForContinent(continent: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    console.log(`📋 Loading fallback countries for ${continent.name}`);
    
    const fallbackCountries: { [key: string]: any[] } = {
      'north_america': [
        { name: 'United States', code: 'US', lat: 39.8283, lng: -98.5795, pop: 331000000 },
        { name: 'Canada', code: 'CA', lat: 56.1304, lng: -106.3468, pop: 38000000 },
        { name: 'Mexico', code: 'MX', lat: 23.6345, lng: -102.5528, pop: 128000000 }
      ],
      'south_america': [
        { name: 'Brazil', code: 'BR', lat: -14.2350, lng: -51.9253, pop: 215000000 },
        { name: 'Argentina', code: 'AR', lat: -38.4161, lng: -63.6167, pop: 45000000 },
        { name: 'Colombia', code: 'CO', lat: 4.5709, lng: -74.2973, pop: 50000000 }
      ],
      'europe': [
        { name: 'Germany', code: 'DE', lat: 51.1657, lng: 10.4515, pop: 83000000 },
        { name: 'France', code: 'FR', lat: 46.6034, lng: 1.8883, pop: 67000000 },
        { name: 'United Kingdom', code: 'GB', lat: 55.3781, lng: -3.4360, pop: 67000000 },
        { name: 'Italy', code: 'IT', lat: 41.8719, lng: 12.5674, pop: 60000000 },
        { name: 'Spain', code: 'ES', lat: 40.4637, lng: -3.7492, pop: 47000000 }
      ],
      'africa': [
        { name: 'Nigeria', code: 'NG', lat: 9.0820, lng: 8.6753, pop: 216000000 },
        { name: 'Ethiopia', code: 'ET', lat: 9.1450, lng: 40.4897, pop: 115000000 },
        { name: 'Egypt', code: 'EG', lat: 26.8206, lng: 30.8025, pop: 102000000 },
        { name: 'South Africa', code: 'ZA', lat: -30.5595, lng: 22.9375, pop: 60000000 }
      ],
      'asia': [
        { name: 'China', code: 'CN', lat: 35.8617, lng: 104.1954, pop: 1440000000 },
        { name: 'India', code: 'IN', lat: 20.5937, lng: 78.9629, pop: 1380000000 },
        { name: 'Indonesia', code: 'ID', lat: -0.7893, lng: 113.9213, pop: 273000000 },
        { name: 'Pakistan', code: 'PK', lat: 30.3753, lng: 69.3451, pop: 225000000 },
        { name: 'Japan', code: 'JP', lat: 36.2048, lng: 138.2529, pop: 125000000 }
      ],
      'oceania': [
        { name: 'Australia', code: 'AU', lat: -25.2744, lng: 133.7751, pop: 25000000 },
        { name: 'Papua New Guinea', code: 'PG', lat: -6.3150, lng: 143.9555, pop: 9000000 },
        { name: 'New Zealand', code: 'NZ', lat: -40.9006, lng: 174.8860, pop: 5000000 }
      ]
    };

    const countriesForContinent = fallbackCountries[continent.id] || [];
    
    return countriesForContinent.map(country => ({
      id: `country_${country.code.toLowerCase()}`,
      name: country.name,
      level: 'country' as const,
      parentId: continent.id,
      hasChildren: true,
      childrenLoaded: false,
      childrenIds: [],
      bounds: this.createBoundsFromPoint(country.lat, country.lng, 5),
      center: { lat: country.lat, lng: country.lng },
      population: country.pop,
      isCapital: false,
      isPreloaded: false,
      estimatedTiles: Math.ceil(country.pop / 1000),
      estimatedSizeMB: Math.ceil(country.pop / 50000),
      isDownloaded: false,
      priority: 4,
      tags: ['country'],
      metadata: { countryCode: country.code },
      lastUpdated: Date.now(),
      source: 'api' as const
    }));
  }

  // Simplified state loader
  private async loadSimpleStatesForCountry(country: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    console.log(`📋 Loading simplified states for ${country.name}`);
    
    // For now, just create a few sample states for major countries
    const sampleStates: { [key: string]: string[] } = {
      'country_us': ['California', 'Texas', 'Florida', 'New York', 'Illinois'],
      'country_ca': ['Ontario', 'Quebec', 'British Columbia', 'Alberta'],
      'country_de': ['Bavaria', 'North Rhine-Westphalia', 'Baden-Württemberg'],
      'country_fr': ['Île-de-France', 'Provence-Alpes-Côte d\'Azur', 'Nouvelle-Aquitaine'],
      'country_gb': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
      'country_au': ['New South Wales', 'Victoria', 'Queensland', 'Western Australia']
    };

    const states = sampleStates[country.id] || [];
    
    return states.map((stateName, index) => ({
      id: `state_${country.id}_${index}`,
      name: stateName,
      level: 'state' as const,
      parentId: country.id,
      hasChildren: true,
      childrenLoaded: false,
      childrenIds: [],
      bounds: this.createBoundsFromPoint(
        country.center.lat + (Math.random() - 0.5) * 10, 
        country.center.lng + (Math.random() - 0.5) * 10, 
        2
      ),
      center: {
        lat: country.center.lat + (Math.random() - 0.5) * 10,
        lng: country.center.lng + (Math.random() - 0.5) * 10
      },
      population: Math.floor(Math.random() * 10000000) + 1000000,
      isCapital: false,
      isPreloaded: false,
      estimatedTiles: 5000,
      estimatedSizeMB: 100,
      isDownloaded: false,
      priority: 5,
      tags: ['state'],
      metadata: { countryCode: country.metadata.countryCode },
      lastUpdated: Date.now(),
      source: 'api' as const
    }));
  }

  // Simplified city loader
  private async loadSimpleCitiesForState(state: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    console.log(`📋 Loading simplified cities for ${state.name}`);
    
    // Create some sample cities
    const cityNames = ['Capital City', 'Metro Center', 'Port Town', 'Mountain View', 'Valley City'];
    
    return cityNames.map((cityName, index) => ({
      id: `city_${state.id}_${index}`,
      name: `${cityName} (${state.name})`,
      level: 'city' as const,
      parentId: state.id,
      hasChildren: false,
      childrenLoaded: true,
      childrenIds: [],
      bounds: this.createBoundsFromPoint(
        state.center.lat + (Math.random() - 0.5) * 2, 
        state.center.lng + (Math.random() - 0.5) * 2, 
        0.1
      ),
      center: {
        lat: state.center.lat + (Math.random() - 0.5) * 2,
        lng: state.center.lng + (Math.random() - 0.5) * 2
      },
      population: Math.floor(Math.random() * 2000000) + 100000,
      isCapital: index === 0,
      isPreloaded: false,
      estimatedTiles: 1000,
      estimatedSizeMB: 20,
      isDownloaded: false,
      priority: 6,
      tags: ['city'],
      metadata: { countryCode: state.metadata.countryCode },
      lastUpdated: Date.now(),
      source: 'api' as const
    }));
  }

  private async loadStatesForCountry(country: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    try {
      const countryCode = country.metadata.countryCode;
      if (!countryCode) return [];

      // Use Nominatim to get states/provinces
      const query = `[out:json][timeout:25];
        (
          relation["ISO3166-1"="${countryCode}"]["admin_level"="4"];
          relation["ISO3166-1"="${countryCode}"]["admin_level"="3"];
        );
        out geom;`;

      const response = await fetch(this.API_ENDPOINTS.overpass, {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain' }
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data = await response.json();
      const states: DynamicLocationNode[] = data.elements
        .filter((element: any) => element.tags && element.tags.name)
        .map((element: any) => {
          const bounds = this.calculateElementBounds(element);
          return {
            id: `state_${countryCode}_${element.id}`,
            name: element.tags.name,
            level: 'state' as const,
            parentId: country.id,
            hasChildren: true,
            childrenLoaded: false,
            childrenIds: [],
            bounds,
            center: this.calculateElementCenter(element),
            population: parseInt(element.tags.population) || undefined,
            isCapital: false,
            isPreloaded: false,
            estimatedTiles: 5000,
            estimatedSizeMB: 100,
            isDownloaded: false,
            priority: 5,
            tags: ['state', 'region'],
            metadata: {
              countryCode,
              adminLevel: parseInt(element.tags.admin_level),
              wikidata: element.tags.wikidata
            },
            lastUpdated: Date.now(),
            source: 'api' as const
          };
        });

      return states;
    } catch (error) {
      console.error('Failed to load states:', error);
      return [];
    }
  }

  private async loadCitiesForState(state: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    try {
      // Use Nominatim to find cities in the state
      const response = await fetch(
        `${this.API_ENDPOINTS.nominatim}/search?` +
        `format=json&addressdetails=1&extratags=1&limit=50&` +
        `q=city&bounded=1&` +
        `viewbox=${state.bounds.west},${state.bounds.south},${state.bounds.east},${state.bounds.north}`
      );

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const citiesData = await response.json();
      const cities: DynamicLocationNode[] = citiesData
        .filter((city: any) => city.type === 'city' || city.type === 'town')
        .map((city: any) => ({
          id: `city_${city.osm_id}`,
          name: city.display_name.split(',')[0],
          level: 'city' as const,
          parentId: state.id,
          hasChildren: city.type === 'city', // Only cities have districts
          childrenLoaded: false,
          childrenIds: [],
          bounds: this.createBoundsFromPoint(parseFloat(city.lat), parseFloat(city.lon), 0.1),
          center: {
            lat: parseFloat(city.lat),
            lng: parseFloat(city.lon)
          },
          population: parseInt(city.extratags?.population) || undefined,
          isCapital: city.extratags?.capital === 'yes',
          isPreloaded: false,
          estimatedTiles: 1000,
          estimatedSizeMB: 20,
          isDownloaded: false,
          priority: city.type === 'city' ? 6 : 7,
          tags: [city.type],
          metadata: {
            countryCode: state.metadata.countryCode,
            geonameid: parseInt(city.extratags?.geonames_id) || undefined
          },
          lastUpdated: Date.now(),
          source: 'api' as const
        }));

      return cities;
    } catch (error) {
      console.error('Failed to load cities:', error);
      return [];
    }
  }

  private async loadDistrictsForCity(city: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    try {
      // Use Overpass API to get districts/neighborhoods
      const query = `[out:json][timeout:25];
        (
          relation(around:10000,${city.center.lat},${city.center.lng})["admin_level"~"^(9|10|11)$"]["name"];
        );
        out geom;`;

      const response = await fetch(this.API_ENDPOINTS.overpass, {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain' }
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data = await response.json();
      const districts: DynamicLocationNode[] = data.elements
        .filter((element: any) => element.tags && element.tags.name)
        .map((element: any) => ({
          id: `district_${element.id}`,
          name: element.tags.name,
          level: 'district' as const,
          parentId: city.id,
          hasChildren: false,
          childrenLoaded: true,
          childrenIds: [],
          bounds: this.calculateElementBounds(element),
          center: this.calculateElementCenter(element),
          isCapital: false,
          isPreloaded: false,
          estimatedTiles: 200,
          estimatedSizeMB: 4,
          isDownloaded: false,
          priority: 8,
          tags: ['district', 'neighborhood'],
          metadata: {
            countryCode: city.metadata.countryCode,
            adminLevel: parseInt(element.tags.admin_level)
          },
          lastUpdated: Date.now(),
          source: 'api' as const
        }));

      return districts;
    } catch (error) {
      console.error('Failed to load districts:', error);
      return [];
    }
  }

  // ==================== DATABASE OPERATIONS ====================
  private async saveLocation(location: DynamicLocationNode): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['locations'], 'readwrite');
    const store = transaction.objectStore('locations');
    await store.put(location);
  }

  async getLocation(id: string): Promise<DynamicLocationNode | null> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // Check database
    if (!this.db) return null;
    
    const transaction = this.db.transaction(['locations'], 'readonly');
    const store = transaction.objectStore('locations');
    const request = store.get(id);
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const location = request.result;
        if (location) {
          this.cache.set(id, location);
        }
        resolve(location || null);
      };
      request.onerror = () => resolve(null);
    });
  }

  private async getLocationsByParent(parentId: string): Promise<DynamicLocationNode[]> {
    if (!this.db) return [];
    
    const transaction = this.db.transaction(['locations'], 'readonly');
    const store = transaction.objectStore('locations');
    const index = store.index('parentId');
    const request = index.getAll(parentId);
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const locations = request.result || [];
        // Update cache
        locations.forEach(location => this.cache.set(location.id, location));
        resolve(locations);
      };
      request.onerror = () => resolve([]);
    });
  }

  // ==================== UTILITY FUNCTIONS ====================
  private calculateCountryBounds(country: any): { north: number; south: number; east: number; west: number } {
    // Simplified bounds calculation - in production, use proper geometry
    const lat = country.latlng[0] || 0;
    const lng = country.latlng[1] || 0;
    const area = country.area || 100000;
    const size = Math.sqrt(area) / 111000; // Rough degree approximation
    
    return {
      north: lat + size,
      south: lat - size,
      east: lng + size,
      west: lng - size
    };
  }

  private calculateElementBounds(element: any): { north: number; south: number; east: number; west: number } {
    if (element.bounds) {
      return {
        north: element.bounds.maxlat,
        south: element.bounds.minlat,
        east: element.bounds.maxlon,
        west: element.bounds.minlon
      };
    }
    
    // Fallback to center point with small bounds
    const center = this.calculateElementCenter(element);
    return this.createBoundsFromPoint(center.lat, center.lng, 0.1);
  }

  private calculateElementCenter(element: any): { lat: number; lng: number } {
    if (element.center) {
      return { lat: element.center.lat, lng: element.center.lon };
    }
    
    if (element.lat && element.lon) {
      return { lat: element.lat, lng: element.lon };
    }
    
    // Calculate center from geometry
    if (element.geometry && element.geometry.length > 0) {
      const lats = element.geometry.map((g: any) => g.lat).filter((lat: number) => lat);
      const lngs = element.geometry.map((g: any) => g.lon).filter((lng: number) => lng);
      
      if (lats.length > 0 && lngs.length > 0) {
        return {
          lat: lats.reduce((a: number, b: number) => a + b, 0) / lats.length,
          lng: lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length
        };
      }
    }
    
    return { lat: 0, lng: 0 };
  }

  private createBoundsFromPoint(lat: number, lng: number, size: number): { north: number; south: number; east: number; west: number } {
    return {
      north: lat + size,
      south: lat - size,
      east: lng + size,
      west: lng - size
    };
  }

  // ==================== SEARCH FUNCTIONALITY ====================
  async searchLocations(query: string, maxResults = 50): Promise<DynamicLocationNode[]> {
    const cacheKey = `search_${query.toLowerCase()}_${maxResults}`;
    
    // Check cache first (search results expire after 1 hour)
    const cached = await this.getCachedResult(cacheKey, 3600000);
    if (cached) return cached;

    try {
      // Search Nominatim
      const response = await fetch(
        `${this.API_ENDPOINTS.nominatim}/search?` +
        `format=json&addressdetails=1&extratags=1&limit=${maxResults}&` +
        `q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error(`Search API error: ${response.status}`);
      }

      const searchData = await response.json();
      const results: DynamicLocationNode[] = searchData.map((item: any) => ({
        id: `search_${item.osm_type}_${item.osm_id}`,
        name: item.display_name.split(',')[0],
        level: this.mapSearchTypeToLevel(item.type),
        hasChildren: this.typeHasChildren(item.type),
        childrenLoaded: false,
        childrenIds: [],
        bounds: this.createBoundsFromPoint(parseFloat(item.lat), parseFloat(item.lon), 0.1),
        center: {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        },
        isCapital: item.extratags?.capital === 'yes',
        isPreloaded: false,
        estimatedTiles: 1000,
        estimatedSizeMB: 20,
        isDownloaded: false,
        priority: 9,
        tags: [item.type],
        metadata: {
          countryCode: item.address?.country_code?.toUpperCase()
        },
        lastUpdated: Date.now(),
        source: 'api' as const
      }));

      // Cache results
      await this.cacheResult(cacheKey, results, 3600000);
      
      return results;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  private mapSearchTypeToLevel(type: string): DynamicLocationNode['level'] {
    const mapping: { [key: string]: DynamicLocationNode['level'] } = {
      'country': 'country',
      'state': 'state',
      'city': 'city',
      'town': 'city',
      'village': 'city',
      'municipality': 'city',
      'district': 'district',
      'suburb': 'district',
      'neighbourhood': 'district'
    };
    
    return mapping[type] || 'city';
  }

  private typeHasChildren(type: string): boolean {
    return ['country', 'state', 'city'].includes(type);
  }

  // ==================== CACHING ====================
  private async getCachedResult(key: string, maxAge: number): Promise<any> {
    if (!this.db) return null;
    
    const transaction = this.db.transaction(['apiCache'], 'readonly');
    const store = transaction.objectStore('apiCache');
    const request = store.get(key);
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const cached = request.result;
        if (cached && Date.now() - cached.timestamp < maxAge) {
          resolve(cached.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  }

  private async cacheResult(key: string, data: any, maxAge: number): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['apiCache'], 'readwrite');
    const store = transaction.objectStore('apiCache');
    
    await store.put({
      key,
      data,
      timestamp: Date.now(),
      expiry: Date.now() + maxAge
    });
  }

  // ==================== CLEANUP ====================
  async cleanup(): Promise<void> {
    this.cache.clear();
    this.loadingPromises.clear();
    
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Export singleton instance
export const dynamicLocationService = new DynamicLocationService();