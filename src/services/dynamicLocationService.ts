// Dynamic Location Service with API Integration and Caching

// Enhanced location interface for dynamic loading
export interface DynamicLocationNode {
  id: string;
  name: string;
  level: 'world' | 'continent' | 'country' | 'state' | 'region' | 'city' | 'municipality' | 'district' | 'custom';
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
  private dbVersion = 5; // Force clear all Denmark-related cached data
  private db: IDBDatabase | null = null;
  private cache: Map<string, DynamicLocationNode> = new Map();
  private loadingPromises: Map<string, Promise<DynamicLocationNode[]>> = new Map();
  private childrenCache: Map<string, DynamicLocationNode[]> = new Map(); // Add children cache
  
  // API endpoints for different data sources
  private readonly API_ENDPOINTS = {
    nominatim: 'https://nominatim.openstreetmap.org',
    overpass: 'https://overpass-api.de/api/interpreter',
    restcountries: 'https://restcountries.com/v3.1',
    geonames: 'http://api.geonames.org', // Requires API key
  };

  // Country-specific hierarchy configurations
  private readonly COUNTRY_HIERARCHIES: { [countryCode: string]: {
    stateLevel: 'state' | 'region' | 'province',
    municipalityLevel: 'municipality' | 'county' | 'district',
    cityLevel: 'city' | 'town' | 'village',
    hasProperHierarchy: boolean,
    fallbackToNominatim: boolean,
    maxLevels: number
  } } = {
    'DK': {
      stateLevel: 'region',
      municipalityLevel: 'municipality', 
      cityLevel: 'city',
      hasProperHierarchy: true,
      fallbackToNominatim: true,
      maxLevels: 5 // country -> region -> municipality -> city -> district
    },
    'US': {
      stateLevel: 'state',
      municipalityLevel: 'county',
      cityLevel: 'city',
      hasProperHierarchy: false,
      fallbackToNominatim: true,
      maxLevels: 4 // country -> state -> county -> city
    },
    'DE': {
      stateLevel: 'state',
      municipalityLevel: 'district',
      cityLevel: 'city',
      hasProperHierarchy: false,
      fallbackToNominatim: true,
      maxLevels: 4 // country -> state -> district -> city
    },
    'DEFAULT': {
      stateLevel: 'state',
      municipalityLevel: 'municipality',
      cityLevel: 'city',
      hasProperHierarchy: false,
      fallbackToNominatim: true,
      maxLevels: 3 // country -> state -> city
    }
  };

  // Frontend no longer calls Overpass directly; uses backend WebGIS API

  /**
   * Get hierarchy configuration for a specific country
   */
  private getCountryHierarchy(countryCode?: string) {
    if (!countryCode) return this.COUNTRY_HIERARCHIES['DEFAULT'];
    return this.COUNTRY_HIERARCHIES[countryCode.toUpperCase()] || this.COUNTRY_HIERARCHIES['DEFAULT'];
  }

  constructor() {
    this.initializeDatabase();
    this.clearProblematicCachedData();
  }

  // Clear any problematic data that might be in memory cache
  private clearProblematicCachedData() {
    const problematicNames = ['Zealand', 'Central Denmark', 'North Denmark', 'South Denmark']; // Old incorrect names
    const genericCityNames = ['Capital City', 'Metro Center', 'Port Town', 'Mountain View', 'Valley City'];
    
    // Clear any Denmark-related cached data that might be problematic (especially with wrong bounds)
    const denmarkRelatedKeys = Array.from(this.cache.keys()).filter(key => 
      key.includes('country_dk') || key.includes('denmark') || key.toLowerCase().includes('dk')
    );
    
    denmarkRelatedKeys.forEach(key => {
      console.log(`🗑️ Clearing Denmark-related cached data with potentially wrong bounds: ${key}`);
      this.cache.delete(key);
    });
    
    // Clear children cache for Denmark
    const denmarkChildrenKeys = Array.from(this.childrenCache.keys()).filter(key => 
      key.includes('country_dk') || key.includes('denmark') || key.toLowerCase().includes('dk')
    );
    
    denmarkChildrenKeys.forEach(key => {
      console.log(`🗑️ Clearing Denmark children cache: ${key}`);
      this.childrenCache.delete(key);
    });
    
    // Clear other problematic data
    for (const [key, location] of this.cache.entries()) {
      if (problematicNames.includes(location.name) || 
          genericCityNames.some(generic => location.name.includes(generic))) {
        console.log(`🗑️ Clearing problematic cached location: ${location.name}`);
        this.cache.delete(key);
      }
    }
    
    // Also clear any children cache that might contain problematic data
    for (const [parentId, children] of this.childrenCache.entries()) {
      const hasProblematicChildren = children.some(child => 
        problematicNames.includes(child.name) || 
        genericCityNames.some(generic => child.name.includes(generic))
      );
      
      if (hasProblematicChildren) {
        console.log(`🗑️ Clearing children cache for ${parentId} due to problematic children`);
        this.childrenCache.delete(parentId);
      }
    }
  }

  // ==================== DATABASE INITIALIZATION ====================
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open dynamic locations database:', request.error);
        reject(request.error);
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ Dynamic locations database opened successfully');
        this.preloadCoreData();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log(`🔄 Upgrading dynamic locations database from version ${event.oldVersion} to ${event.newVersion}`);
        
        // Clear old stores if version changed
        if (event.oldVersion > 0) {
          try {
            if (db.objectStoreNames.contains('locations')) {
              db.deleteObjectStore('locations');
            }
            if (db.objectStoreNames.contains('searchIndex')) {
              db.deleteObjectStore('searchIndex');
            }
            if (db.objectStoreNames.contains('apiCache')) {
              db.deleteObjectStore('apiCache');
            }
            if (db.objectStoreNames.contains('children')) {
              db.deleteObjectStore('children');
            }
            console.log('🗑️ Cleared old object stores');
          } catch (e) {
            console.log('Some stores did not exist, creating fresh database');
          }
        }
        
        // Location nodes store
        const locationStore = db.createObjectStore('locations', { keyPath: 'id' });
        locationStore.createIndex('level', 'level');
        locationStore.createIndex('parentId', 'parentId');
        locationStore.createIndex('countryCode', 'metadata.countryCode');
        locationStore.createIndex('lastUpdated', 'lastUpdated');
        locationStore.createIndex('population', 'population');
        console.log('✅ Created locations store');
        
        // Children cache store - for persistent parent-child relationships
        const childrenStore = db.createObjectStore('children', { keyPath: 'parentId' });
        childrenStore.createIndex('lastUpdated', 'lastUpdated');
        console.log('✅ Created children cache store');
        
        // Search index store
        const searchStore = db.createObjectStore('searchIndex', { keyPath: 'id' });
        searchStore.createIndex('tokens', 'searchTokens', { multiEntry: true });
        searchStore.createIndex('level', 'level');
        console.log('✅ Created search index store');
        
        // API cache store
        const cacheStore = db.createObjectStore('apiCache', { keyPath: 'key' });
        cacheStore.createIndex('expiry', 'expiry');
        console.log('✅ Created API cache store');
        
        console.log('🎉 Database upgrade completed successfully');
      };
    });
  }

  // ==================== CORE DATA PRELOADING ====================
  private async preloadCoreData(): Promise<void> {
    try {
      console.log('🔄 Preloading core location data...');
      
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
        try {
          await this.saveLocation(location);
          console.log(`✅ Saved ${location.name} (${location.level}) to database`);
        } catch (error) {
          console.error(`❌ Failed to save ${location.name}:`, error);
        }
      }
      
      console.log(`✅ Preloaded ${coreData.length} core locations to cache and database`);
    } catch (error) {
      console.error('❌ Failed to preload core data:', error);
      // Continue anyway - the service can still work with API calls
    }
  }

  // ==================== DYNAMIC LOCATION LOADING ====================
  async getChildren(parentId: string, forceRefresh = false): Promise<DynamicLocationNode[]> {
  const parent = await this.getLocation(parentId);
    if (!parent) {
      throw new Error(`Parent location ${parentId} not found`);
    }

    // Check memory cache first
    if (this.childrenCache.has(parentId) && !forceRefresh) {
      const cachedChildren = this.childrenCache.get(parentId)!;
      console.log(`📋 Returning cached children for ${parent.name} (${cachedChildren.length} items)`);
      return cachedChildren;
    }

    // Check database cache for children
    if (!forceRefresh) {
  const cachedChildren = await this.getCachedChildren(parentId);
      if (cachedChildren && cachedChildren.length > 0) {
        
        // Auto-invalidate problematic cached data
        let shouldInvalidate = false;
        
        // Special case: if this is Europe and we only have 5 countries, invalidate cache
        if (parentId === 'europe' && cachedChildren.length === 5) {
          console.log(`🗑️ Invalidating Europe cache (only ${cachedChildren.length} countries, expected more)`);
          shouldInvalidate = true;
        }
        
        // Check for outdated administrative structure assumptions
        // (We used to have hardcoded "direct city" countries, now we let API decide)
        const hasOldDirectCityAssumptions = parent.level === 'country' && 
                                           cachedChildren.some(child => child.source === 'api' && child.id.includes('_fallback_'));
        
        if (hasOldDirectCityAssumptions) {
          console.log(`🗑️ Invalidating cache for ${parent.name} - contains old direct city assumptions`);
          shouldInvalidate = true;
        }
        
        // Check for old incorrect region names that need to be updated
        const problematicNames = ['Zealand', 'Central Denmark', 'North Denmark', 'South Denmark']; // Old incorrect names
        const hasProblematicNames = cachedChildren.some(child => 
          problematicNames.some(problemName => child.name === problemName)
        );
        
        if (hasProblematicNames) {
          console.log(`🗑️ Invalidating cache for ${parent.name} due to problematic names: ${cachedChildren.filter(child => problematicNames.includes(child.name)).map(c => c.name).join(', ')}`);
          shouldInvalidate = true;
        }
        
        // Remove force invalidation - let normal cache logic handle it
        // Denmark data should persist until manual refresh
        
        // Check for old generic city names that should be replaced
        const genericCityNames = ['Capital City', 'Metro Center', 'Port Town', 'Mountain View', 'Valley City'];
        const hasGenericCities = cachedChildren.some(child => 
          genericCityNames.some(genericName => child.name.includes(genericName))
        );
        
        if (hasGenericCities) {
          console.log(`🗑️ Invalidating cache for ${parent.name} due to generic city names`);
          shouldInvalidate = true;
        }
        
        if (shouldInvalidate) {
          await this.clearCachedChildren(parentId);
        } else {
          console.log(`💾 Found ${cachedChildren.length} cached children for ${parent.name} in database`);
          this.childrenCache.set(parentId, cachedChildren);
          // hydrate memory cache so getLocation works for these ids
          cachedChildren.forEach(child => this.cache.set(child.id, child));
          return cachedChildren;
        }
      }
    }

    // Check for existing loading promise to avoid duplicate requests
    const loadingKey = `children_${parentId}`;
    if (this.loadingPromises.has(loadingKey)) {
      console.log(`⏳ Already loading children for ${parent.name}, returning existing promise`);
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

      // Cache children in memory and database
      this.childrenCache.set(parentId, children);
      await this.saveChildrenCache(parentId, children);
      // Persist each child to locations store and hydrate memory cache
      for (const child of children) {
        this.cache.set(child.id, child);
        try { await this.saveLocation(child); } catch { /* ignore */ }
      }

      console.log(`✅ Loaded and cached ${children.length} children for ${parent.name}`);
      return children;
    } finally {
      this.loadingPromises.delete(loadingKey);
    }
  }

  // Method to refresh cached data for a location
  async refreshLocation(locationId: string): Promise<void> {
    console.log(`🔄 Refreshing cached data for ${locationId}`);
    
    // Clear memory cache
    this.childrenCache.delete(locationId);
    
    // Clear database cache
    await this.clearCachedChildren(locationId);
    
    // Mark the location as not having children loaded
    const location = this.cache.get(locationId);
    if (location) {
      location.childrenLoaded = false;
      location.childrenIds = [];
      this.cache.set(locationId, location);
      await this.saveLocation(location);
    }
    
    console.log(`✅ Refreshed cached data for ${locationId}`);
  }

  private async loadChildrenFromAPI(parent: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    try {
      let children: DynamicLocationNode[] = [];

      console.log(`🔄 [HIERARCHY] Loading children for ${parent.name} (${parent.level}) - ID: ${parent.id}`);
      console.log(`🗺 [BOUNDS] Parent bounds:`, parent.bounds);

      switch (parent.level) {
        case 'world':
          // Children are continents (already preloaded)
          children = await this.getLocationsByParent(parent.id);
          console.log(`📍 Found ${children.length} preloaded continents`);
          break;
          
        case 'continent':
          // Load countries from REST Countries API
          console.log(`🌍 Loading countries for continent: ${parent.name}`);
          try {
            children = await this.loadCountriesForContinent(parent);
          } catch (error) {
            console.error(`❌ API failed for ${parent.name}, using fallback:`, error);
            children = await this.loadFallbackCountriesForContinent(parent);
          }
          break;
          
        case 'country':
          // Load administrative regions/states for all countries using API only
          console.log(`🏴 Loading administrative divisions for country: ${parent.name}`);
          try {
            children = await this.loadStatesForCountry(parent);
            
            // If no administrative divisions found, try direct cities
            if (children.length === 0) {
              console.log(`⚠️ No administrative divisions found for ${parent.name}, trying direct cities...`);
              children = await this.loadCitiesForCountry(parent);
            }
            
            // If still no results, fail fast
            if (children.length === 0) {
              console.warn(`❌ No data found for ${parent.name} via API - failing fast to avoid fake data`);
            }
          } catch (error) {
            console.error(`❌ Failed to load administrative data for ${parent.name}:`, error);
            // Don't use fallback - let it fail fast
            children = [];
          }
          break;
          
        case 'state':
          // Load real cities using Nominatim API
          console.log(`🏙️ Loading cities for state: ${parent.name}`);
          try {
            children = await this.loadCitiesForState(parent);
            // Fallback to simplified if API fails
            if (children.length === 0) {
              console.log(`⚠️ No cities found via API for ${parent.name}, using fallback`);
              children = await this.loadSimpleCitiesForState(parent);
            }
          } catch (error) {
            console.error(`❌ Failed to load cities for ${parent.name}, using fallback:`, error);
            children = await this.loadSimpleCitiesForState(parent);
          }
          break;
          
        case 'municipality':
          // Load cities/towns within municipality
          console.log(`🏛️ Loading cities/towns for municipality: ${parent.name}`);
          try {
            children = await this.loadCitiesForMunicipality(parent);
          } catch (error) {
            console.error(`❌ Failed to load cities for municipality ${parent.name}:`, error);
            children = [];
          }
          break;
          
        case 'city':
          // Load districts/neighborhoods for cities
          console.log(`🏙️ Loading districts for city: ${parent.name}`);
          try {
            children = await this.loadDistrictsForCity(parent);
          } catch (error) {
            console.error(`❌ Failed to load districts for city ${parent.name}:`, error);
            children = [];
          }
          break;
          
        case 'district':
          // End of hierarchy - districts don't have children
          console.log(`🏘️ District level reached: ${parent.name} (no further subdivision)`);
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

      console.log(`✅ [RESULT] Successfully loaded ${children.length} children for ${parent.name} (${parent.level})`);
      console.log(`📁 [CHILDREN] Names: ${children.map(c => c.name).join(', ')}`);
      return children;

    } catch (error) {
      console.error(`❌ Failed to load children for ${parent.name}:`, error);
      console.error('Error details:', error);
      
      // For continents, always return fallback if main approach fails
      if (parent.level === 'continent') {
        console.log('🔄 Trying fallback for continent...');
        try {
          return await this.loadFallbackCountriesForContinent(parent);
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          return [];
        }
      }
      
      // Return empty array on error, but don't mark as loaded
      return [];
    }
  }

  // ==================== API-SPECIFIC LOADERS ====================
  
  // Load cities directly for countries that don't use states/regions
  private async loadCitiesForCountry(country: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    try {
      const countryCode = country.metadata.countryCode;
      if (!countryCode) {
        console.log(`❌ No country code for ${country.name}`);
        return [];
      }

      console.log(`📡 Querying Nominatim for cities in ${country.name} (${countryCode})...`);
      
      // Use Nominatim to search for cities within the country
      // Try multiple search strategies to get better results
      let response = await fetch(
        `${this.API_ENDPOINTS.nominatim}/search?` +
        `format=json&addressdetails=1&extratags=1&limit=50&` +
        `q=city in ${country.name}&countrycodes=${countryCode.toLowerCase()}`
      );
      
      // If first query fails, try a broader search
      if (!response.ok || (await response.clone().json()).length === 0) {
        console.log(`🔄 Trying broader search for cities in ${country.name}...`);
        response = await fetch(
          `${this.API_ENDPOINTS.nominatim}/search?` +
          `format=json&addressdetails=1&extratags=1&limit=50&` +
          `q=${country.name}&class=place&type=city&countrycodes=${countryCode.toLowerCase()}`
        );
      }

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status} - ${response.statusText}`);
      }

      const citiesData = await response.json();
      console.log(`📍 Nominatim returned ${citiesData?.length || 0} cities for ${country.name}`);
      
      const cities: DynamicLocationNode[] = citiesData
        .filter((city: any) => {
          // Ensure it's actually in the right country
          return (city.address?.country_code?.toUpperCase() === countryCode ||
                  city.address?.country_code?.toLowerCase() === countryCode.toLowerCase()) &&
                 (city.type === 'city' || city.type === 'town' || city.type === 'municipality');
        })
        .map((city: any) => ({
          id: `city_${countryCode}_${city.osm_id}`,
          name: city.display_name.split(',')[0],
          level: 'city' as const,
          parentId: country.id,
          hasChildren: false, // Cities under countries don't have districts in this simplified model
          childrenLoaded: true,
          childrenIds: [],
          bounds: this.createBoundsFromPoint(parseFloat(city.lat), parseFloat(city.lon), 0.05),
          center: {
            lat: parseFloat(city.lat),
            lng: parseFloat(city.lon)
          },
          population: parseInt(city.extratags?.population) || undefined,
          isCapital: city.extratags?.capital === 'yes' || city.extratags?.admin_level === '2',
          isPreloaded: false,
          estimatedTiles: 1000,
          estimatedSizeMB: 20,
          isDownloaded: false,
          priority: city.extratags?.capital === 'yes' ? 4 : 6,
          tags: [city.type],
          metadata: {
            countryCode,
            geonameid: parseInt(city.extratags?.geonames_id) || undefined
          },
          lastUpdated: Date.now(),
          source: 'api' as const
        }))
  .sort((a: DynamicLocationNode, b: DynamicLocationNode) => {
          // Sort capitals first, then by population, then by name
          if (a.isCapital && !b.isCapital) return -1;
          if (!a.isCapital && b.isCapital) return 1;
          if (a.population && b.population) return b.population - a.population;
          return a.name.localeCompare(b.name);
        });

      console.log(`✅ Found ${cities.length} cities for ${country.name}`);
      return cities;
    } catch (error) {
      console.error('Failed to load cities for country:', error);
      return [];
    }
  }

  private async loadCountriesForContinent(continent: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    try {
      console.log(`📡 Calling REST Countries API for ${continent.name}...`);
      
      // Use REST Countries API to get all countries (reduced fields to avoid 400 errors)
      const response = await fetch(`${this.API_ENDPOINTS.restcountries}/all?fields=name,cca2,region,subregion,latlng,capital,population`, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`REST Countries API error: ${response.status} - ${response.statusText}`);
      }

      const countriesData = await response.json();
      
      // More comprehensive continent mapping
      const continentMapping: { [key: string]: (country: any) => boolean } = {
        'north_america': (country: any) => {
          return country.region === 'Americas' && (
            country.subregion === 'Northern America' || 
            country.subregion === 'Central America' || 
            country.subregion === 'Caribbean'
          );
        },
        'south_america': (country: any) => {
          return country.region === 'Americas' && country.subregion === 'South America';
        },
        'europe': (country: any) => {
          return country.region === 'Europe' || 
                 (country.region === 'Americas' && country.name.common === 'Greenland') ||
                 (country.cca2 === 'RU'); // Include Russia in Europe
        },
        'africa': (country: any) => {
          return country.region === 'Africa';
        },
        'asia': (country: any) => {
          return country.region === 'Asia' || 
                 (country.cca2 === 'RU') || // Russia spans both continents
                 (country.cca2 === 'TR'); // Turkey spans both continents
        },
        'oceania': (country: any) => {
          return country.region === 'Oceania';
        }
      };

      const filterFunction = continentMapping[continent.id];
      if (!filterFunction) {
        console.warn(`No mapping found for continent: ${continent.id}`);
        return [];
      }
      
      const countries: DynamicLocationNode[] = countriesData
        .filter(filterFunction)
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
            population: country.population || 0,
            area: undefined, // Not available in reduced API response
            isCapital: false,
            isPreloaded: false,
            estimatedTiles: Math.ceil((country.population || 100000) / 100000), // Use population for estimation
            estimatedSizeMB: Math.ceil((country.population || 100000) / 500000), // Use population for estimation
            isDownloaded: false,
            priority: (country.population || 0) > 100000000 ? 3 : 4,
            tags: ['country'],
            metadata: {
              countryCode: country.cca2,
              capital: country.capital?.[0],
              timezone: undefined, // Not available in reduced API response
              language: undefined, // Not available in reduced API response
              currency: undefined // Not available in reduced API response
            },
            lastUpdated: Date.now(),
            source: 'api' as const
          };
        })
        .sort((a: DynamicLocationNode, b: DynamicLocationNode) => {
          // Sort by population descending, then by name
          if (a.population && b.population) {
            return b.population - a.population;
          }
          return a.name.localeCompare(b.name);
        });

      console.log(`✅ Loaded ${countries.length} countries for ${continent.name}`);
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
        { name: 'Mexico', code: 'MX', lat: 23.6345, lng: -102.5528, pop: 128000000 },
        { name: 'Guatemala', code: 'GT', lat: 15.7835, lng: -90.2308, pop: 17000000 },
        { name: 'Cuba', code: 'CU', lat: 21.5218, lng: -77.7812, pop: 11000000 }
      ],
      'south_america': [
        { name: 'Brazil', code: 'BR', lat: -14.2350, lng: -51.9253, pop: 215000000 },
        { name: 'Argentina', code: 'AR', lat: -38.4161, lng: -63.6167, pop: 45000000 },
        { name: 'Colombia', code: 'CO', lat: 4.5709, lng: -74.2973, pop: 50000000 },
        { name: 'Peru', code: 'PE', lat: -9.1900, lng: -75.0152, pop: 33000000 },
        { name: 'Venezuela', code: 'VE', lat: 6.4238, lng: -66.5897, pop: 28000000 },
        { name: 'Chile', code: 'CL', lat: -35.6751, lng: -71.5430, pop: 19000000 }
      ],
      'europe': [
        { name: 'Germany', code: 'DE', lat: 51.1657, lng: 10.4515, pop: 83000000 },
        { name: 'France', code: 'FR', lat: 46.6034, lng: 1.8883, pop: 67000000 },
        { name: 'United Kingdom', code: 'GB', lat: 55.3781, lng: -3.4360, pop: 67000000 },
        { name: 'Italy', code: 'IT', lat: 41.8719, lng: 12.5674, pop: 60000000 },
        { name: 'Spain', code: 'ES', lat: 40.4637, lng: -3.7492, pop: 47000000 },
        { name: 'Poland', code: 'PL', lat: 51.9194, lng: 19.1451, pop: 38000000 },
        { name: 'Romania', code: 'RO', lat: 45.9432, lng: 24.9668, pop: 19000000 },
        { name: 'Netherlands', code: 'NL', lat: 52.1326, lng: 5.2913, pop: 17000000 },
        { name: 'Belgium', code: 'BE', lat: 50.5039, lng: 4.4699, pop: 11000000 },
        { name: 'Greece', code: 'GR', lat: 39.0742, lng: 21.8243, pop: 10000000 },
        { name: 'Portugal', code: 'PT', lat: 39.3999, lng: -8.2245, pop: 10000000 },
        { name: 'Sweden', code: 'SE', lat: 60.1282, lng: 18.6435, pop: 10000000 },
        { name: 'Hungary', code: 'HU', lat: 47.1625, lng: 19.5033, pop: 9000000 },
        { name: 'Austria', code: 'AT', lat: 47.5162, lng: 14.5501, pop: 9000000 },
        { name: 'Switzerland', code: 'CH', lat: 46.8182, lng: 8.2275, pop: 8000000 },
        { name: 'Norway', code: 'NO', lat: 60.4720, lng: 8.4689, pop: 5000000 },
        { name: 'Finland', code: 'FI', lat: 61.9241, lng: 25.7482, pop: 5000000 },
        { name: 'Denmark', code: 'DK', lat: 56.2639, lng: 9.5018, pop: 5000000 }
      ],
      'africa': [
        { name: 'Nigeria', code: 'NG', lat: 9.0820, lng: 8.6753, pop: 216000000 },
        { name: 'Ethiopia', code: 'ET', lat: 9.1450, lng: 40.4897, pop: 115000000 },
        { name: 'Egypt', code: 'EG', lat: 26.8206, lng: 30.8025, pop: 102000000 },
        { name: 'South Africa', code: 'ZA', lat: -30.5595, lng: 22.9375, pop: 60000000 },
        { name: 'Kenya', code: 'KE', lat: -0.0236, lng: 37.9062, pop: 54000000 },
        { name: 'Morocco', code: 'MA', lat: 31.7917, lng: -7.0926, pop: 37000000 }
      ],
      'asia': [
        { name: 'China', code: 'CN', lat: 35.8617, lng: 104.1954, pop: 1440000000 },
        { name: 'India', code: 'IN', lat: 20.5937, lng: 78.9629, pop: 1380000000 },
        { name: 'Indonesia', code: 'ID', lat: -0.7893, lng: 113.9213, pop: 273000000 },
        { name: 'Pakistan', code: 'PK', lat: 30.3753, lng: 69.3451, pop: 225000000 },
        { name: 'Japan', code: 'JP', lat: 36.2048, lng: 138.2529, pop: 125000000 },
        { name: 'Russia', code: 'RU', lat: 61.5240, lng: 105.3188, pop: 146000000 },
        { name: 'Iran', code: 'IR', lat: 32.4279, lng: 53.6880, pop: 84000000 },
        { name: 'Turkey', code: 'TR', lat: 38.9637, lng: 35.2433, pop: 84000000 }
      ],
      'oceania': [
        { name: 'Australia', code: 'AU', lat: -25.2744, lng: 133.7751, pop: 25000000 },
        { name: 'Papua New Guinea', code: 'PG', lat: -6.3150, lng: 143.9555, pop: 9000000 },
        { name: 'New Zealand', code: 'NZ', lat: -40.9006, lng: 174.8860, pop: 5000000 },
        { name: 'Fiji', code: 'FJ', lat: -16.5780, lng: 179.4144, pop: 900000 }
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

  // Simplified city loader
  private async loadSimpleCitiesForState(state: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    console.log(`📋 Loading simplified cities for ${state.name}`);
    
    // Try to use real city names based on common knowledge, or fallback to generic names
    const realCities: { [key: string]: string[] } = {
      // Denmark regions
      'state_country_dk_0': ['Copenhagen', 'Frederiksberg', 'Gentofte'], // Capital Region
      'state_country_dk_1': ['Aarhus', 'Viborg', 'Randers'], // Central Denmark  
      'state_country_dk_2': ['Aalborg', 'Hjørring'], // North Denmark
      'state_country_dk_3': ['Roskilde', 'Køge', 'Næstved'], // Region Zealand
      'state_country_dk_4': ['Odense', 'Esbjerg', 'Kolding'], // South Denmark
      
      // Germany states
      'state_country_de_0': ['Munich', 'Nuremberg', 'Augsburg'], // Bavaria
      'state_country_de_1': ['Cologne', 'Düsseldorf', 'Dortmund'], // North Rhine-Westphalia
      'state_country_de_2': ['Stuttgart', 'Mannheim', 'Karlsruhe'], // Baden-Württemberg
      
      // France regions
      'state_country_fr_0': ['Paris', 'Boulogne-Billancourt'], // Île-de-France
      'state_country_fr_1': ['Marseille', 'Nice', 'Toulon'], // Provence-Alpes-Côte d'Azur
      'state_country_fr_2': ['Bordeaux', 'Limoges', 'Poitiers'], // Nouvelle-Aquitaine
      
      // UK countries
      'state_country_gb_0': ['London', 'Birmingham', 'Manchester'], // England
      'state_country_gb_1': ['Glasgow', 'Edinburgh', 'Aberdeen'], // Scotland
      'state_country_gb_2': ['Cardiff', 'Swansea', 'Newport'], // Wales
      'state_country_gb_3': ['Belfast', 'Derry'], // Northern Ireland
    };
    
    let cityNames = realCities[state.id];
    
    // If no specific cities defined, create descriptive names based on the state name
    if (!cityNames) {
      const stateName = state.name.replace(/Region |State of |Province of /i, '').split(' ')[0];
      cityNames = [
        `${stateName}burg`, 
        `${stateName} City`, 
        `New ${stateName}`,
        `${stateName}ville`,
        `Port ${stateName}`
      ].slice(0, 3); // Limit to 3 cities to avoid too much fake data
    }
    
    return cityNames.map((cityName, index) => ({
      id: `city_${state.id}_${index}`,
      name: cityName,
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
      if (!countryCode) {
        console.log(`❌ No country code for ${country.name}`);
        return [];
      }

      // First try backend WebGIS API
      let states: DynamicLocationNode[] = [];
      try {
        const resp = await fetch(`http://localhost:3001/api/admin/regions?country=${encodeURIComponent(countryCode)}`);
        if (resp.ok) {
          const data = await resp.json();
          const regions = Array.isArray(data?.regions) ? data.regions : [];
          states = regions.map((r: any) => ({
            id: r.id,
            name: r.name,
            level: 'state' as const,
            parentId: country.id,
            hasChildren: true,
            childrenLoaded: false,
            childrenIds: [],
            bounds: r.bounds || country.bounds,
            center: r.center || { lat: (country.bounds.north + country.bounds.south) / 2, lng: (country.bounds.east + country.bounds.west) / 2 },
            population: r.population,
            isCapital: false,
            isPreloaded: false,
            estimatedTiles: 5000,
            estimatedSizeMB: 100,
            isDownloaded: false,
            priority: 5,
            tags: ['state', 'region'],
            metadata: {
              countryCode,
              adminLevel: r.adminLevel,
              iso3166_2: r.iso3166_2,
              osmId: r.osm?.id,
              osmType: r.osm?.type,
              areaId: r.osm?.areaId
            } as any,
            lastUpdated: Date.now(),
            source: 'api' as const
          }));
          
          if (states.length > 0) {
            console.log(`✅ Backend API: Found ${states.length} administrative regions for ${country.name}`);
            return states;
          }
        } else {
          console.warn(`⚠️ Backend regions API error: ${resp.status}`);
        }
      } catch (backendError) {
        console.warn(`⚠️ Backend API unavailable, using fallback hierarchy service:`, backendError);
      }

      // FALLBACK: Use our proper hierarchy service for known countries
      const hierarchyConfig = this.getCountryHierarchy(countryCode);
      if (hierarchyConfig.hasProperHierarchy && countryCode === 'DK') {
        console.log(`🔄 Using proper hierarchy service for ${countryCode}`);
        
        // Import our proper hierarchy service
        const { geoNamesAdminHierarchyService } = await import('./geoNamesAdminHierarchyService');
        
        try {
          const regions = await geoNamesAdminHierarchyService.getCountryRegions(countryCode);
          states = regions.map((region) => ({
            id: `region_${countryCode}_${region.geonameId}`,
            name: region.name,
            level: 'state' as const,
            parentId: country.id,
            hasChildren: true,
            childrenLoaded: false,
            childrenIds: [],
            bounds: region.bbox ? {
              north: region.bbox.north,
              south: region.bbox.south,
              east: region.bbox.east,
              west: region.bbox.west
            } : country.bounds,
            center: { lat: region.lat, lng: region.lng },
            population: region.population,
            isCapital: false,
            isPreloaded: false,
            estimatedTiles: 5000,
            estimatedSizeMB: 100,
            isDownloaded: false,
            priority: 5,
            tags: ['state', 'region', 'proper-hierarchy'],
            metadata: {
              countryCode,
              adminLevel: 1,
              geonameId: region.geonameId,
              adminCode1: region.adminCode1,
              source: 'proper-hierarchy'
            } as any,
            lastUpdated: Date.now(),
            source: 'api' as const
          }));
          
          console.log(`✅ Proper Hierarchy: Found ${states.length} regions for Denmark including ${states.find(s => s.name.includes('Nordjylland')) ? 'Nordjylland ✅' : 'missing Nordjylland ❌'}`);
        } catch (hierarchyError) {
          console.error(`❌ Proper hierarchy service failed:`, hierarchyError);
        }
      }

      return states;
    } catch (error) {
      console.error('Failed to load states:', error);
      return [];
    }
  }

  private async loadCitiesForState(state: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    try {
      const countryCode = state.metadata.countryCode;
      if (!countryCode) {
        console.log(`❌ No country code for state ${state.name}`);
        return [];
      }

      // First try backend WebGIS API
      let cities: DynamicLocationNode[] = [];
      try {
        let relationId = (state.metadata as any)?.osmId;
        let citiesResp: Response | null = null;
        if (relationId) {
          citiesResp = await fetch(`http://localhost:3001/api/admin/cities?relationId=${encodeURIComponent(String(relationId))}`);
        } else {
          const { south, west, north, east } = state.bounds;
          const bbox = `${south},${west},${north},${east}`;
          citiesResp = await fetch(`http://localhost:3001/api/admin/cities?bbox=${encodeURIComponent(bbox)}`);
        }
        
        if (citiesResp && citiesResp.ok) {
          const data = await citiesResp.json();
          cities = (data.cities || []).map((el: any) => ({
            id: `city_${countryCode}_${state.id}_${el.id}`,
            name: el.name,
            level: 'city' as const,
            parentId: state.id,
            hasChildren: false,
            childrenLoaded: true,
            childrenIds: [],
            bounds: this.createBoundsFromPoint(el.center.lat, el.center.lng, 0.05),
            center: { lat: el.center.lat, lng: el.center.lng },
            population: el.population,
            isCapital: false,
            isPreloaded: false,
            estimatedTiles: 800,
            estimatedSizeMB: 16,
            isDownloaded: false,
            priority: 6,
            tags: [el.place],
            metadata: { countryCode } as any,
            lastUpdated: Date.now(),
            source: 'api' as const
          }))
          .sort((a: DynamicLocationNode, b: DynamicLocationNode) => {
            if (a.population && b.population) return b.population - a.population;
            return a.name.localeCompare(b.name);
          });
          
          if (cities.length > 0) {
            console.log(`✅ Backend API: Found ${cities.length} cities for ${state.name}`);
            return cities;
          }
        }
      } catch (backendError) {
        console.warn(`⚠️ Backend cities API unavailable for ${state.name}, using fallback:`, backendError);
      }

      // FALLBACK: Use our proper hierarchy service for known regions
      const hierarchyConfig = this.getCountryHierarchy(countryCode);
      if (hierarchyConfig.hasProperHierarchy && countryCode === 'DK' && (state.metadata as any)?.source === 'proper-hierarchy') {
        console.log(`🔄 Using proper hierarchy service for ${hierarchyConfig.municipalityLevel}s in ${state.name}`);
        
        const { geoNamesAdminHierarchyService } = await import('./geoNamesAdminHierarchyService');
        const geonameId = (state.metadata as any)?.geonameId;
        
        if (geonameId) {
          try {
            const municipalities = await geoNamesAdminHierarchyService.getRegionMunicipalities(geonameId);
            cities = municipalities.map((municipality) => ({
              id: `municipality_${countryCode}_${municipality.geonameId}`,
              name: municipality.name,
              level: 'municipality' as const,
              parentId: state.id,
              hasChildren: true, // Municipalities can contain cities/towns
              childrenLoaded: false,
              childrenIds: [],
              bounds: this.createBoundsFromPoint(municipality.lat, municipality.lng, 0.05),
              center: { lat: municipality.lat, lng: municipality.lng },
              population: municipality.population,
              isCapital: false,
              isPreloaded: false,
              estimatedTiles: 800,
              estimatedSizeMB: 16,
              isDownloaded: false,
              priority: 6,
              tags: ['municipality', 'proper-hierarchy'],
              metadata: { 
                countryCode,
                geonameId: municipality.geonameId,
                adminCode2: municipality.adminCode2,
                source: 'proper-hierarchy'
              } as any,
              lastUpdated: Date.now(),
              source: 'api' as const
            }))
            .sort((a: DynamicLocationNode, b: DynamicLocationNode) => {
              if (a.population && b.population) return b.population - a.population;
              return a.name.localeCompare(b.name);
            });
            
            console.log(`✅ Proper Hierarchy: Found ${cities.length} ${hierarchyConfig.municipalityLevel}s for ${state.name}`);
          } catch (hierarchyError) {
            console.error(`❌ Proper hierarchy service failed for ${hierarchyConfig.municipalityLevel}s:`, hierarchyError);
          }
        }
      }

      // Generic fallback using Nominatim for countries without proper hierarchy
      if (cities.length === 0 && hierarchyConfig.fallbackToNominatim) {
        console.log(`🔄 Using Nominatim fallback for ${hierarchyConfig.municipalityLevel}s in ${state.name}, ${countryCode}`);
        
        try {
          const searchQuery = `${hierarchyConfig.municipalityLevel} in ${state.name}, ${countryCode}`;
          const response = await fetch(
            `${this.API_ENDPOINTS.nominatim}/search?` +
            `format=json&addressdetails=1&extratags=1&limit=25&` +
            `q=${encodeURIComponent(searchQuery)}&` +
            `countrycodes=${countryCode?.toLowerCase()}&` +
            `featureType=administrative`
          );
          
          if (response.ok) {
            const searchData = await response.json();
            cities = searchData
              .filter((item: any) => {
                // Filter for administrative divisions that could be municipalities/counties/districts
                return item.class === 'boundary' && 
                       item.type === 'administrative' &&
                       (item.extratags?.admin_level === '3' || 
                        item.extratags?.admin_level === '4' ||
                        item.extratags?.admin_level === '5' ||
                        item.extratags?.admin_level === '6');
              })
              .slice(0, 15) // Limit results
              .map((item: any) => ({
                id: `${hierarchyConfig.municipalityLevel}_${countryCode}_${item.place_id}`,
                name: item.display_name.split(',')[0],
                level: 'municipality' as const,
                parentId: state.id,
                hasChildren: true, // Administrative divisions usually contain cities
                childrenLoaded: false,
                childrenIds: [],
                bounds: {
                  north: parseFloat(item.boundingbox[1]),
                  south: parseFloat(item.boundingbox[0]),
                  east: parseFloat(item.boundingbox[3]),
                  west: parseFloat(item.boundingbox[2])
                },
                center: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
                population: parseInt(item.extratags?.population || '0') || undefined,
                isCapital: false,
                isPreloaded: false,
                estimatedTiles: 800,
                estimatedSizeMB: 16,
                isDownloaded: false,
                priority: 6,
                tags: [hierarchyConfig.municipalityLevel, 'nominatim-fallback'],
                metadata: { 
                  countryCode,
                  placeId: item.place_id,
                  adminLevel: item.extratags?.admin_level,
                  source: 'nominatim'
                } as any,
                lastUpdated: Date.now(),
                source: 'api' as const
              }));
            
            console.log(`✅ Nominatim fallback: Found ${cities.length} ${hierarchyConfig.municipalityLevel}s for ${state.name}`);
          }
        } catch (nominatimError) {
          console.error(`❌ Nominatim fallback failed for ${hierarchyConfig.municipalityLevel}s:`, nominatimError);
        }
      }

      return cities;
    } catch (error) {
      console.error('Failed to load cities for state:', error);
      return [];
    }
  }

  /**
   * Load cities/towns within a municipality using multiple data sources
   */
  private async loadCitiesForMunicipality(municipality: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    console.log(`🏛️ Loading cities/towns for municipality: ${municipality.name}`);
    
    const countryCode = municipality.metadata?.countryCode;
    let cities: DynamicLocationNode[] = [];
    
    try {
      // First try the proper hierarchy service for known countries
      if (countryCode === 'DK' && municipality.metadata?.source === 'proper-hierarchy') {
        console.log(`🔄 Using proper hierarchy service for cities in ${municipality.name}`);
        
        const { geoNamesAdminHierarchyService } = await import('./geoNamesAdminHierarchyService');
        const geonameId = municipality.metadata?.geonameId;
        
        if (geonameId) {
          try {
            const municipalityCities = await geoNamesAdminHierarchyService.getMunicipalityCities(geonameId);
            cities = municipalityCities.map((city) => ({
              id: `city_${countryCode}_${city.geonameId}`,
              name: city.name,
              level: 'city' as const,
              parentId: municipality.id,
              hasChildren: city.population > 50000, // Large cities may have districts
              childrenLoaded: false,
              childrenIds: [],
              bounds: this.createBoundsFromPoint(city.lat, city.lng, 0.01),
              center: { lat: city.lat, lng: city.lng },
              population: city.population,
              isCapital: false,
              isPreloaded: false,
              estimatedTiles: 200,
              estimatedSizeMB: 4,
              isDownloaded: false,
              priority: 7,
              tags: ['city', 'proper-hierarchy'],
              metadata: { 
                countryCode,
                geonameId: city.geonameId,
                source: 'proper-hierarchy',
                municipalityId: geonameId
              } as any,
              lastUpdated: Date.now(),
              source: 'api' as const
            }))
            .sort((a: DynamicLocationNode, b: DynamicLocationNode) => {
              if (a.population && b.population) return b.population - a.population;
              return a.name.localeCompare(b.name);
            });
            
            console.log(`✅ Proper Hierarchy: Found ${cities.length} cities for ${municipality.name}`);
          } catch (hierarchyError) {
            console.error(`❌ Proper hierarchy service failed for cities:`, hierarchyError);
          }
        }
      }
      
      // If no results from proper hierarchy, try Nominatim as fallback
      if (cities.length === 0) {
        console.log(`🔄 Using Nominatim fallback for cities in ${municipality.name}`);
        
        const searchQuery = `city in ${municipality.name}, ${countryCode}`;
        const response = await fetch(
          `${this.API_ENDPOINTS.nominatim}/search?` +
          `format=json&addressdetails=1&extratags=1&limit=20&` +
          `q=${encodeURIComponent(searchQuery)}&` +
          `countrycodes=${countryCode?.toLowerCase()}&` +
          `featureType=city,town,village`
        );
        
        if (response.ok) {
          const searchData = await response.json();
          cities = searchData
            .filter((item: any) => item.class === 'place' && ['city', 'town', 'village'].includes(item.type))
            .slice(0, 10) // Limit to top 10 results
            .map((item: any) => ({
              id: `city_nominatim_${item.place_id}`,
              name: item.display_name.split(',')[0],
              level: 'city' as const,
              parentId: municipality.id,
              hasChildren: parseInt(item.extratags?.population || '0') > 50000,
              childrenLoaded: false,
              childrenIds: [],
              bounds: {
                north: parseFloat(item.boundingbox[1]),
                south: parseFloat(item.boundingbox[0]),
                east: parseFloat(item.boundingbox[3]),
                west: parseFloat(item.boundingbox[2])
              },
              center: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
              population: parseInt(item.extratags?.population || '0') || undefined,
              isCapital: false,
              isPreloaded: false,
              estimatedTiles: 200,
              estimatedSizeMB: 4,
              isDownloaded: false,
              priority: 7,
              tags: ['city', 'nominatim-fallback'],
              metadata: { 
                countryCode,
                placeId: item.place_id,
                source: 'nominatim',
                municipalityId: municipality.id
              } as any,
              lastUpdated: Date.now(),
              source: 'api' as const
            }));
          
          console.log(`✅ Nominatim fallback: Found ${cities.length} cities for ${municipality.name}`);
        }
      }
      
      return cities;
    } catch (error) {
      console.error('Failed to load cities for municipality:', error);
      return [];
    }
  }

  /**
   * Load districts/neighborhoods for a city
   */
  private async loadDistrictsForCity(city: DynamicLocationNode): Promise<DynamicLocationNode[]> {
    console.log(`🏙️ Loading districts for city: ${city.name}`);
    
    const countryCode = city.metadata?.countryCode;
    let districts: DynamicLocationNode[] = [];
    
    try {
      // For now, only implement district loading for large cities
      if (!city.population || city.population < 50000) {
        console.log(`ℹ️ City ${city.name} too small for district subdivision (pop: ${city.population})`);
        return [];
      }
      
      // Use Nominatim to find districts/neighborhoods
      const searchQuery = `district in ${city.name}, ${countryCode}`;
      const response = await fetch(
        `${this.API_ENDPOINTS.nominatim}/search?` +
        `format=json&addressdetails=1&extratags=1&limit=15&` +
        `q=${encodeURIComponent(searchQuery)}&` +
        `countrycodes=${countryCode?.toLowerCase()}&` +
        `featureType=suburb,neighbourhood,district`
      );
      
      if (response.ok) {
        const searchData = await response.json();
        districts = searchData
          .filter((item: any) => item.class === 'place' && ['suburb', 'neighbourhood', 'district'].includes(item.type))
          .slice(0, 10) // Limit to top 10 results
          .map((item: any) => ({
            id: `district_nominatim_${item.place_id}`,
            name: item.display_name.split(',')[0],
            level: 'district' as const,
            parentId: city.id,
            hasChildren: false, // Districts are terminal nodes
            childrenLoaded: true,
            childrenIds: [],
            bounds: {
              north: parseFloat(item.boundingbox[1]),
              south: parseFloat(item.boundingbox[0]),
              east: parseFloat(item.boundingbox[3]),
              west: parseFloat(item.boundingbox[2])
            },
            center: { lat: parseFloat(item.lat), lng: parseFloat(item.lon) },
            population: parseInt(item.extratags?.population || '0') || undefined,
            isCapital: false,
            isPreloaded: false,
            estimatedTiles: 50,
            estimatedSizeMB: 1,
            isDownloaded: false,
            priority: 8,
            tags: ['district', 'nominatim'],
            metadata: { 
              countryCode,
              placeId: item.place_id,
              source: 'nominatim',
              cityId: city.id
            } as any,
            lastUpdated: Date.now(),
            source: 'api' as const
          }));
        
        console.log(`✅ Found ${districts.length} districts for ${city.name}`);
      }
      
      return districts;
    } catch (error) {
      console.error('Failed to load districts for city:', error);
      return [];
    }
  }


  // ==================== DATABASE OPERATIONS ====================
  private async saveLocation(location: DynamicLocationNode): Promise<void> {
    if (!this.db) {
      console.warn('Database not initialized, cannot save location:', location.name);
      return;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['locations'], 'readwrite');
      const store = transaction.objectStore('locations');
      const request = store.put(location);
      
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to save location to database:', location.name, request.error);
        reject(request.error);
      };
      
      transaction.onerror = () => {
        console.error('Transaction failed while saving location:', location.name, transaction.error);
        reject(transaction.error);
      };
    });
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

  private async getCachedChildren(parentId: string): Promise<DynamicLocationNode[] | null> {
    if (!this.db) return null;
    
    const transaction = this.db.transaction(['children'], 'readonly');
    const store = transaction.objectStore('children');
    const request = store.get(parentId);
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const cached = request.result;
        // Cache persists until manual refresh - no expiration
        if (cached && cached.children && cached.children.length > 0) {
          console.log(`💾 Using persistent cache for ${parentId} (${cached.children.length} items)`);
          resolve(cached.children);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  }

  private async clearCachedChildren(parentId: string): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['children'], 'readwrite');
    const store = transaction.objectStore('children');
    
    return new Promise((resolve) => {
      const request = store.delete(parentId);
      request.onsuccess = () => {
        // Also clear memory cache
        this.childrenCache.delete(parentId);
        console.log(`🗑️ Cleared cached children for ${parentId}`);
        resolve();
      };
      request.onerror = () => resolve();
    });
  }

  private async saveChildrenCache(parentId: string, children: DynamicLocationNode[]): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['children'], 'readwrite');
    const store = transaction.objectStore('children');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        parentId,
        children,
        lastUpdated: Date.now()
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== UTILITY FUNCTIONS ====================
  private calculateCountryBounds(country: any): { north: number; south: number; east: number; west: number } {
    // Improved bounds calculation with country-specific overrides
    const countryCode = country.cca2?.toLowerCase();
    
    // Country-specific bounds for better accuracy
    const knownBounds: { [key: string]: { north: number; south: number; east: number; west: number } } = {
      'dk': { north: 57.75, south: 54.56, east: 15.16, west: 8.08 }, // Denmark
      'de': { north: 55.06, south: 47.27, east: 15.04, west: 5.87 }, // Germany
      'fr': { north: 51.09, south: 41.33, east: 9.56, west: -5.14 }, // France
      'gb': { north: 60.85, south: 49.96, east: 1.77, west: -8.18 }, // United Kingdom
      'nl': { north: 53.55, south: 50.75, east: 7.22, west: 3.36 }, // Netherlands
      'se': { north: 69.06, south: 55.34, east: 24.17, west: 11.11 }, // Sweden
      'no': { north: 80.66, south: 57.99, east: 31.08, west: 4.65 }, // Norway
      'fi': { north: 70.09, south: 59.81, east: 31.59, west: 20.55 }, // Finland
      'it': { north: 47.09, south: 36.64, east: 18.52, west: 6.63 }, // Italy
      'es': { north: 43.79, south: 35.17, east: 4.33, west: -9.30 }, // Spain
    };
    
    if (countryCode && knownBounds[countryCode]) {
      console.log(`📍 Using known bounds for ${country.name} (${countryCode})`);
      return knownBounds[countryCode];
    }
    
    // Fallback: calculate from center and area
    const lat = country.latlng[0] || 0;
    const lng = country.latlng[1] || 0;
    const area = country.area || 100000;
    const sizeKm = Math.sqrt(area);
    const sizeDegrees = sizeKm / 111000; // Convert km to degrees (approximate)
    
    // Use a minimum size to prevent tiny bounds
    const minSize = 0.5; // At least 0.5 degrees
    const size = Math.max(sizeDegrees, minSize);
    
    console.log(`📍 Calculated bounds for ${country.name}: size=${size.toFixed(3)} degrees`);
    
    return {
      north: lat + size,
      south: lat - size,
      east: lng + size,
      west: lng - size
    };
  }

  // Removed calculateElementBounds - now using backend-provided bounds

  // Removed calculateElementCenter - centers provided by backend

  private createBoundsFromPoint(lat: number, lng: number, size: number): { north: number; south: number; east: number; west: number } {
    return {
      north: lat + size,
      south: lat - size,
      east: lng + size,
      west: lng - size
    };
  }

  // Resolve a country's Overpass area id using ISO code or name
  // Removed resolveCountryAreaId - backend resolves areas

  // Fetch and attach bounds for a list of relation elements (missing .bounds)
  // Removed fillRelationBounds - backend includes bounds

  // Prefer official/local names where available (OSM tagging best practices)
  // Removed getPreferredName - backend normalizes names

  // Normalize administrative names to include classifiers (e.g., "Region Zealand" instead of bare "Zealand")
  // Removed normalizeAdminName - backend provides display names

  // Overpass fetch with mirror rotation and basic 400/429 retry handling
  // Removed fetchOverpass - frontend no longer calls Overpass directly

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

  // ==================== TESTING & VALIDATION ====================
  
  // Console test helper for debugging geographical hierarchy
  async testGeographicalHierarchy(countryId: string = 'country_dk'): Promise<void> {
    console.log(`🧪 Testing geographical hierarchy for ${countryId}...`);
    
    try {
      // Test country level
      const country = await this.getLocation(countryId);
      console.log(`Country: ${country?.name}`, country);
      
      if (!country) {
        console.error(`❌ Country ${countryId} not found`);
        return;
      }
      
      // Test administrative divisions
      const regions = await this.getChildren(countryId, true); // Force refresh
      console.log(`Regions (${regions.length}):`, regions.map(r => ({
        name: r.name,
        level: r.level,
        source: r.source,
        hasChildren: r.hasChildren
      })));
      
      // Test cities in first region
      if (regions.length > 0) {
        const firstRegion = regions[0];
        const cities = await this.getChildren(firstRegion.id);
        console.log(`Cities in ${firstRegion.name} (${cities.length}):`, cities.map(c => ({
          name: c.name,
          level: c.level,
          isCapital: c.isCapital,
          countryCode: c.metadata.countryCode
        })));
        
        // Validate geographical containment
        this.validateGeographicalContainment(firstRegion, cities);
      }
      
      console.log(`✅ Test completed for ${countryId}`);
    } catch (error) {
      console.error(`❌ Test failed for ${countryId}:`, error);
    }
  }

  // Validate that child locations are properly contained within parent bounds
  private validateGeographicalContainment(parent: DynamicLocationNode, children: DynamicLocationNode[]): void {
    console.log(`🔍 Validating geographical containment for ${parent.name}...`);
    
    let invalidChildren = 0;
    
    children.forEach(child => {
      const isContained = child.center.lat >= parent.bounds.south &&
                         child.center.lat <= parent.bounds.north &&
                         child.center.lng >= parent.bounds.west &&
                         child.center.lng <= parent.bounds.east;
      
      if (!isContained) {
        console.warn(`⚠️ ${child.name} is outside ${parent.name} bounds:`, {
          child: child.center,
          parent: parent.bounds
        });
        invalidChildren++;
      }
    });
    
    if (invalidChildren === 0) {
      console.log(`✅ All ${children.length} children are properly contained`);
    } else {
      console.warn(`⚠️ ${invalidChildren}/${children.length} children are outside parent bounds`);
    }
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

  // Method to clear all cached data and force fresh API calls
  async clearAllCachedData(): Promise<void> {
    console.log('🗑️ Clearing all cached Dynamic Explorer data...');
    
    // Clear memory caches
    this.cache.clear();
    this.childrenCache.clear();
    this.loadingPromises.clear();
    
    // Clear database caches
    if (this.db) {
      try {
        const transaction = this.db.transaction(['children', 'apiCache', 'locations'], 'readwrite');
        
        // Clear children cache
        const childrenStore = transaction.objectStore('children');
        await new Promise<void>((resolve) => {
          const clearRequest = childrenStore.clear();
          clearRequest.onsuccess = () => resolve();
          clearRequest.onerror = () => resolve();
        });
        
        // Clear API cache  
        const apiStore = transaction.objectStore('apiCache');
        await new Promise<void>((resolve) => {
          const clearRequest = apiStore.clear();
          clearRequest.onsuccess = () => resolve();
          clearRequest.onerror = () => resolve();
        });
        
        // Clear locations cache (keeping only core preloaded data)
        const locationsStore = transaction.objectStore('locations');
        await new Promise<void>((resolve) => {
          const clearRequest = locationsStore.clear();
          clearRequest.onsuccess = () => resolve();
          clearRequest.onerror = () => resolve();
        });
        
        console.log('✅ Cleared all Dynamic Explorer cached data');
      } catch (error) {
        console.log('Database clearing error (expected during reset):', error);
      }
    }
    
    // Reinitialize core data
    await this.preloadCoreData();
  }

  // Nuclear option: Clear everything including IndexedDB
  async clearAllBrowserData(): Promise<void> {
    console.log('💥 Nuclear clear: Deleting entire IndexedDB database...');
    
    // Close current database
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    
    // Clear memory
    this.cache.clear();
    this.childrenCache.clear();
    this.loadingPromises.clear();
    
    // Delete the entire database
    return new Promise((resolve) => {
      const deleteRequest = indexedDB.deleteDatabase(this.dbName);
      deleteRequest.onsuccess = () => {
        console.log('✅ IndexedDB database deleted completely');
        // Reinitialize from scratch
        this.initializeDatabase().then(() => resolve());
      };
      deleteRequest.onerror = () => {
        console.log('❌ Failed to delete database, reinitializing anyway');
        this.initializeDatabase().then(() => resolve());
      };
    });
  }
}

// Export singleton instance
export const dynamicLocationService = new DynamicLocationService();

// Make the test method available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testDynamicLocationService = {
    testDenmark: () => dynamicLocationService.testGeographicalHierarchy('country_dk'),
    testGermany: () => dynamicLocationService.testGeographicalHierarchy('country_de'),
    testFrance: () => dynamicLocationService.testGeographicalHierarchy('country_fr'),
    testNetherlands: () => dynamicLocationService.testGeographicalHierarchy('country_nl'),
    clearCache: () => dynamicLocationService.clearAllCachedData(),
    nuclearClear: () => dynamicLocationService.clearAllBrowserData(),
    service: dynamicLocationService
  };
}