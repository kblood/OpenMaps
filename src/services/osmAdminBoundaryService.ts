// OSM Administrative Boundary Service
// Implements proper OSM administrative boundary fetching using Overpass API

export interface OSMAdminBoundary {
  id: string;
  osmId: number;
  type: 'way' | 'relation';
  name: string;
  nameEn?: string;
  adminLevel: number;
  countryCode: string;
  parentId?: string;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  center: [number, number]; // [lon, lat]
  population?: number;
  isCapital?: boolean;
  tags: Record<string, string>;
  geometry?: any; // GeoJSON geometry
}

export interface AdminHierarchy {
  [level: number]: OSMAdminBoundary[];
}

export interface BoundaryQuery {
  countryCode?: string;
  adminLevel?: number;
  bbox?: [number, number, number, number];
  parentId?: string;
  searchName?: string;
  includeGeometry?: boolean;
  maxResults?: number;
}

export class OSMAdminBoundaryService {
  private readonly overpassEndpoint = 'https://overpass-api.de/api/interpreter';
  private readonly timeout = 30000; // 30 seconds
  private cache = new Map<string, OSMAdminBoundary[]>();
  private requestQueue = new Map<string, Promise<OSMAdminBoundary[]>>();

  /**
   * Fetch administrative boundaries using Overpass API
   */
  async fetchBoundaries(query: BoundaryQuery): Promise<OSMAdminBoundary[]> {
    const cacheKey = this.generateCacheKey(query);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log(`📦 OSM boundaries cache hit for: ${cacheKey}`);
      return this.cache.get(cacheKey)!;
    }

    // Check if request is already in progress
    if (this.requestQueue.has(cacheKey)) {
      console.log(`⏳ OSM boundaries request already in progress: ${cacheKey}`);
      return this.requestQueue.get(cacheKey)!;
    }

    // Create new request
    const requestPromise = this.performOverpassQuery(query);
    this.requestQueue.set(cacheKey, requestPromise);

    try {
      const results = await requestPromise;
      this.cache.set(cacheKey, results);
      return results;
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }

  /**
   * Get country administrative boundaries by ISO code
   */
  async getCountryBoundaries(countryCode: string, includeGeometry = false): Promise<OSMAdminBoundary[]> {
    console.log(`🏳️ Fetching boundaries for country: ${countryCode}`);
    
    return this.fetchBoundaries({
      countryCode: countryCode.toUpperCase(),
      includeGeometry,
      maxResults: 1000
    });
  }

  /**
   * Get administrative boundaries by level for a specific country
   */
  async getBoundariesByLevel(countryCode: string, adminLevel: number, includeGeometry = false): Promise<OSMAdminBoundary[]> {
    console.log(`🏛️ Fetching admin level ${adminLevel} for ${countryCode}`);
    
    return this.fetchBoundaries({
      countryCode: countryCode.toUpperCase(),
      adminLevel,
      includeGeometry,
      maxResults: 500
    });
  }

  /**
   * Get children of a specific administrative boundary
   */
  async getChildBoundaries(parentId: string, includeGeometry = false): Promise<OSMAdminBoundary[]> {
    console.log(`👶 Fetching children for boundary: ${parentId}`);
    
    return this.fetchBoundaries({
      parentId,
      includeGeometry,
      maxResults: 200
    });
  }

  /**
   * Search administrative boundaries by name
   */
  async searchBoundaries(searchName: string, countryCode?: string, includeGeometry = false): Promise<OSMAdminBoundary[]> {
    console.log(`🔍 Searching boundaries: "${searchName}" in ${countryCode || 'global'}`);
    
    return this.fetchBoundaries({
      searchName,
      countryCode: countryCode?.toUpperCase(),
      includeGeometry,
      maxResults: 50
    });
  }

  /**
   * Build adaptive hierarchy for a country
   */
  async buildCountryHierarchy(countryCode: string): Promise<AdminHierarchy> {
    console.log(`🏗️ Building administrative hierarchy for ${countryCode}`);
    
    const hierarchy: AdminHierarchy = {};
    const allBoundaries = await this.getCountryBoundaries(countryCode, false);
    
    // Group by admin level
    for (const boundary of allBoundaries) {
      if (!hierarchy[boundary.adminLevel]) {
        hierarchy[boundary.adminLevel] = [];
      }
      hierarchy[boundary.adminLevel].push(boundary);
    }

    // Sort each level appropriately
    Object.keys(hierarchy).forEach(level => {
      const adminLevel = parseInt(level);
      hierarchy[adminLevel].sort((a, b) => {
        // Capitals first, then by population, then alphabetically
        if (a.isCapital && !b.isCapital) return -1;
        if (!a.isCapital && b.isCapital) return 1;
        if ((a.population || 0) !== (b.population || 0)) {
          return (b.population || 0) - (a.population || 0);
        }
        return a.name.localeCompare(b.name);
      });
    });

    console.log(`✅ Built hierarchy with levels: ${Object.keys(hierarchy).join(', ')}`);
    return hierarchy;
  }

  /**
   * Perform the actual Overpass API query
   */
  private async performOverpassQuery(query: BoundaryQuery): Promise<OSMAdminBoundary[]> {
    const overpassQuery = this.buildOverpassQuery(query);
    console.log(`🌐 Executing Overpass query: ${overpassQuery.substring(0, 200)}...`);

    try {
      const response = await fetch(this.overpassEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseOverpassResponse(data, query.includeGeometry || false);
    } catch (error) {
      console.error('❌ Overpass API request failed:', error);
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error('Overpass API request timed out');
      }
      throw error;
    }
  }

  /**
   * Build Overpass QL query based on query parameters
   */
  private buildOverpassQuery(query: BoundaryQuery): string {
    const { countryCode, adminLevel, bbox, parentId, searchName, includeGeometry, maxResults } = query;
    
    // Build more realistic queries that will actually work
    const geometryOutput = includeGeometry ? 'geom' : 'center';
    const outputFormat = `out ${geometryOutput} qt ${maxResults || 100};`;

    if (searchName) {
      // For name searches, use a more efficient approach
      const escapedName = searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      if (countryCode) {
        // Search within a specific country using more targeted queries
        const countryBboxes: { [key: string]: string } = {
          'DK': '(54.4,8.0,57.8,15.2)', // Denmark bbox
          'DE': '(47.2,5.8,55.1,15.1)'  // Germany bbox
        };
        
        const bbox = countryBboxes[countryCode] || '';
        
        // Use more targeted search with lower timeout for faster results
        return [
          '[out:json][timeout:15];',
          '(',
          `  relation["boundary"="administrative"]["name"~"${escapedName}",i]${bbox};`,
          `  node["place"~"^(city|town|village)$"]["name"~"${escapedName}",i]${bbox};`,
          ');',
          `out center qt ${Math.min(maxResults || 20, 20)};`
        ].join('\n');
      } else {
        // Global search with strict limits
        return [
          '[out:json][timeout:10];',
          '(',
          `  relation["boundary"="administrative"]["name"~"${escapedName}",i];`,
          ');',
          'out center qt 10;'
        ].join('\n');
      }
    }

    // For level-based queries, use more flexible approach
    if (countryCode && adminLevel !== undefined) {
      // Country-specific admin level query with fallbacks
      const countryBboxes: { [key: string]: string } = {
        'DK': '(54.4,8.0,57.8,15.2)', // Denmark
        'DE': '(47.2,5.8,55.1,15.1)'  // Germany  
      };
      
      const bbox = countryBboxes[countryCode] || '';
      
      return [
        '[out:json][timeout:25];',
        '(',
        `  relation["boundary"="administrative"]["admin_level"="${adminLevel}"]${bbox};`,
        // Also try without strict admin_level for some results
        adminLevel > 2 ? `  relation["boundary"="administrative"]["place"]${bbox};` : '',
        ');',
        outputFormat
      ].filter(line => line).join('\n');
    }

    // For country-level queries, use broader search
    if (countryCode) {
      const countryBboxes: { [key: string]: string } = {
        'DK': '(54.4,8.0,57.8,15.2)', // Denmark
        'DE': '(47.2,5.8,55.1,15.1)'  // Germany
      };
      
      const bbox = countryBboxes[countryCode] || '';
      
      return [
        '[out:json][timeout:25];',
        '(',
        `  relation["boundary"="administrative"]${bbox};`,
        `  relation["place"]["place"~"^(city|town|village|municipality)$"]${bbox};`,
        ');',
        outputFormat
      ].join('\n');
    }

    // Fallback query
    return [
      '[out:json][timeout:25];',
      '(',
      `  relation["boundary"="administrative"];`,
      ');',
      `out center qt 20;`
    ].join('\n');
  }

  /**
   * Parse Overpass API response into OSMAdminBoundary objects
   */
  private parseOverpassResponse(data: any, includeGeometry: boolean): OSMAdminBoundary[] {
    if (!data.elements || !Array.isArray(data.elements)) {
      console.warn('⚠️ Invalid Overpass API response structure');
      return [];
    }

    const boundaries: OSMAdminBoundary[] = [];

    for (const element of data.elements) {
      try {
        const boundary = this.parseOSMElement(element, includeGeometry);
        if (boundary) {
          boundaries.push(boundary);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to parse OSM element ${element.id}:`, error);
      }
    }

    console.log(`✅ Parsed ${boundaries.length} administrative boundaries`);
    return boundaries;
  }

  /**
   * Parse individual OSM element into OSMAdminBoundary
   */
  private parseOSMElement(element: any, includeGeometry: boolean): OSMAdminBoundary | null {
    const tags = element.tags || {};
    
    // Extract name (prefer English, fall back to default)
    const name = tags['name:en'] || tags.name;
    if (!name) {
      return null;
    }

    // Determine admin level with fallbacks
    let adminLevel = 8; // Default for places
    
    if (tags.admin_level) {
      const parsedLevel = parseInt(tags.admin_level);
      if (!isNaN(parsedLevel)) {
        adminLevel = parsedLevel;
      }
    } else if (tags.place) {
      // Assign admin levels based on place type
      const placeToLevel: { [key: string]: number } = {
        'country': 2,
        'state': 4,
        'city': 8,
        'town': 8,
        'village': 10,
        'municipality': 6,
        'county': 6,
        'district': 7,
        'suburb': 9
      };
      adminLevel = placeToLevel[tags.place] || 8;
    } else if (tags.boundary === 'administrative') {
      adminLevel = 6; // Default for admin boundaries without level
    }

    // Calculate bounding box
    let bbox: [number, number, number, number] = [0, 0, 0, 0];
    let center: [number, number] = [0, 0];

    if (element.bounds) {
      bbox = [element.bounds.minlon, element.bounds.minlat, element.bounds.maxlon, element.bounds.maxlat];
      center = [
        (element.bounds.minlon + element.bounds.maxlon) / 2,
        (element.bounds.minlat + element.bounds.maxlat) / 2
      ];
    } else if (element.center) {
      center = [element.center.lon, element.center.lat];
      // Create a small bbox around the center for point-like elements
      const margin = 0.01;
      bbox = [center[0] - margin, center[1] - margin, center[0] + margin, center[1] + margin];
    } else if (element.lat && element.lon) {
      // Handle node elements
      center = [element.lon, element.lat];
      const margin = 0.01;
      bbox = [center[0] - margin, center[1] - margin, center[0] + margin, center[1] + margin];
    }

    // Determine country code with fallbacks
    let countryCode = tags['ISO3166-1'] || tags['country_code'] || tags['addr:country'] || '';
    
    // Try to infer country from coordinates if not provided
    if (!countryCode && center[0] !== 0 && center[1] !== 0) {
      // Very rough country detection based on coordinates
      if (center[1] >= 54.4 && center[1] <= 57.8 && center[0] >= 8.0 && center[0] <= 15.2) {
        countryCode = 'DK'; // Denmark
      } else if (center[1] >= 47.2 && center[1] <= 55.1 && center[0] >= 5.8 && center[0] <= 15.1) {
        countryCode = 'DE'; // Germany
      }
    }

    const boundary: OSMAdminBoundary = {
      id: `osm_${element.type}_${element.id}`,
      osmId: element.id,
      type: element.type,
      name,
      nameEn: tags['name:en'],
      adminLevel,
      countryCode,
      bbox,
      center,
      population: tags.population ? parseInt(tags.population) : undefined,
      isCapital: tags.capital === 'yes' || tags.admin_centre === 'yes' || tags.place === 'city' || tags.place === 'capital',
      tags
    };

    // Include geometry if requested
    if (includeGeometry && element.geometry) {
      boundary.geometry = {
        type: element.type === 'way' ? 'LineString' : 'Polygon',
        coordinates: element.geometry
      };
    }

    return boundary;
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(query: BoundaryQuery): string {
    const parts = [
      query.countryCode || 'global',
      query.adminLevel?.toString() || 'all',
      query.parentId || 'root',
      query.searchName || 'no-search',
      query.includeGeometry ? 'geom' : 'no-geom',
      query.maxResults?.toString() || 'default'
    ];
    
    if (query.bbox) {
      parts.push(`bbox_${query.bbox.join('_')}`);
    }
    
    return parts.join('|');
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.requestQueue.clear();
    console.log('🗑️ OSM admin boundary cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      activeRequests: this.requestQueue.size
    };
  }
}

// Export singleton instance
export const osmAdminBoundaryService = new OSMAdminBoundaryService();