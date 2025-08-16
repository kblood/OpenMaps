// GeoNames Dynamic Hierarchy Service
// Uses GeoNames Children API for fail-fast administrative hierarchy detection

export interface GeoNamesChild {
  geonameId: number;
  name: string;
  countryCode: string;
  countryName: string;
  fclName: string;
  fcodeName: string;
  fcode: string;
  adminCode1?: string;
  adminName1?: string;
  adminCode2?: string;
  adminName2?: string;
  adminCode3?: string;
  adminName3?: string;
  adminCode4?: string;
  adminName4?: string;
  population?: number;
  lat: number;
  lng: number;
  bbox?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

export interface GeoNamesHierarchyLevel {
  adminLevel: number;
  name: string;
  children: GeoNamesChild[];
  hasMoreChildren: boolean;
  totalCount: number;
}

/**
 * Dynamic hierarchy detection using GeoNames Children API
 * Fail-fast: Returns actual data or fails immediately
 */
export class GeoNamesHierarchyService {
  private readonly BASE_URL = 'http://api.geonames.org';
  private readonly USERNAME = 'demo'; // Replace with actual GeoNames username
  private cache = new Map<number, GeoNamesChild[]>();
  private requestQueue = new Map<number, Promise<GeoNamesChild[]>>();

  /**
   * Get administrative children for any GeoNames ID
   * This is the core method that dynamically detects the next hierarchy level
   */
  async getAdministrativeChildren(
    geonameId: number, 
    options: {
      maxResults?: number;
      hierarchy?: 'geography' | 'tourism' | 'dependency';
    } = {}
  ): Promise<GeoNamesChild[]> {
    console.log(`🌐 Getting administrative children for GeoNames ID: ${geonameId}`);

    // Check cache first
    const cacheKey = geonameId;
    if (this.cache.has(cacheKey)) {
      console.log(`📦 Cache hit for GeoNames ID: ${geonameId}`);
      return this.cache.get(cacheKey)!;
    }

    // Check if request is already in progress
    if (this.requestQueue.has(cacheKey)) {
      console.log(`⏳ Request in progress for GeoNames ID: ${geonameId}`);
      return this.requestQueue.get(cacheKey)!;
    }

    // Create the request
    const requestPromise = this.fetchChildren(geonameId, options);
    this.requestQueue.set(cacheKey, requestPromise);

    try {
      const children = await requestPromise;
      
      // Cache the results
      this.cache.set(cacheKey, children);
      
      console.log(`✅ Found ${children.length} administrative children for GeoNames ID: ${geonameId}`);
      return children;
    } catch (error) {
      console.error(`❌ Failed to get children for GeoNames ID ${geonameId}:`, error);
      throw error; // Fail fast - don't return fake data
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }

  /**
   * Detect what administrative levels exist for a given location
   */
  async detectAvailableLevels(geonameId: number): Promise<{
    currentLevel: string;
    hasChildren: boolean;
    childrenTypes: string[];
    suggestedNextLevel?: string;
  }> {
    console.log(`🔍 Detecting administrative levels for GeoNames ID: ${geonameId}`);

    try {
      const children = await this.getAdministrativeChildren(geonameId, { maxResults: 10 });
      
      if (children.length === 0) {
        return {
          currentLevel: 'terminal',
          hasChildren: false,
          childrenTypes: [],
          suggestedNextLevel: undefined
        };
      }

      // Analyze children to determine their types
      const childrenTypes = [...new Set(children.map(child => child.fcodeName))];
      const childrenCodes = [...new Set(children.map(child => child.fcode))];
      
      console.log(`📊 Children analysis: ${childrenTypes.join(', ')}`);
      console.log(`🏷️ Children codes: ${childrenCodes.join(', ')}`);

      // Determine suggested next level based on children types
      let suggestedNextLevel: string | undefined;
      
      if (childrenCodes.includes('ADM1')) {
        suggestedNextLevel = 'state/province';
      } else if (childrenCodes.includes('ADM2')) {
        suggestedNextLevel = 'county/district';
      } else if (childrenCodes.includes('ADM3')) {
        suggestedNextLevel = 'municipality';
      } else if (childrenCodes.includes('ADM4')) {
        suggestedNextLevel = 'sub-municipality';
      } else if (childrenCodes.includes('PPLA') || childrenCodes.includes('PPLA2') || childrenCodes.includes('PPLA3')) {
        suggestedNextLevel = 'administrative_center';
      } else if (childrenCodes.includes('PPL') || childrenCodes.includes('PPLC')) {
        suggestedNextLevel = 'populated_place';
      } else {
        suggestedNextLevel = 'mixed';
      }

      return {
        currentLevel: 'has_children',
        hasChildren: true,
        childrenTypes,
        suggestedNextLevel
      };
    } catch (error) {
      console.error(`❌ Failed to detect levels for GeoNames ID ${geonameId}:`, error);
      throw error; // Fail fast
    }
  }

  /**
   * Get full hierarchy path for a location
   */
  async getHierarchyPath(geonameId: number): Promise<GeoNamesChild[]> {
    console.log(`🗺️ Getting hierarchy path for GeoNames ID: ${geonameId}`);

    try {
      const response = await fetch(
        `${this.BASE_URL}/hierarchyJSON?` +
        `geonameId=${geonameId}&` +
        `username=${this.USERNAME}`
      );

      if (!response.ok) {
        throw new Error(`GeoNames hierarchy API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status) {
        throw new Error(`GeoNames API error: ${data.status.message}`);
      }

      console.log(`✅ Found hierarchy path with ${data.geonames?.length || 0} levels`);
      return data.geonames || [];
    } catch (error) {
      console.error(`❌ Failed to get hierarchy path for GeoNames ID ${geonameId}:`, error);
      throw error; // Fail fast
    }
  }

  /**
   * Search for GeoNames ID by location name and country
   */
  async findGeoNamesId(locationName: string, countryCode?: string): Promise<number | null> {
    console.log(`🔍 Searching GeoNames ID for: ${locationName} in ${countryCode || 'any country'}`);

    try {
      const searchQuery = countryCode 
        ? `${locationName}, ${countryCode}`
        : locationName;

      const response = await fetch(
        `${this.BASE_URL}/searchJSON?` +
        `q=${encodeURIComponent(searchQuery)}&` +
        `maxRows=5&` +
        `username=${this.USERNAME}` +
        (countryCode ? `&country=${countryCode}` : '')
      );

      if (!response.ok) {
        throw new Error(`GeoNames search API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status) {
        throw new Error(`GeoNames API error: ${data.status.message}`);
      }

      if (!data.geonames || data.geonames.length === 0) {
        console.log(`❌ No GeoNames ID found for: ${locationName}`);
        return null;
      }

      const bestMatch = data.geonames[0];
      console.log(`✅ Found GeoNames ID ${bestMatch.geonameId} for: ${locationName}`);
      return bestMatch.geonameId;
    } catch (error) {
      console.error(`❌ Failed to find GeoNames ID for ${locationName}:`, error);
      return null; // Return null instead of throwing for search operations
    }
  }

  /**
   * Core method to fetch children from GeoNames API
   */
  private async fetchChildren(
    geonameId: number, 
    options: { maxResults?: number; hierarchy?: string } = {}
  ): Promise<GeoNamesChild[]> {
    const maxRows = options.maxResults || 200;
    const hierarchy = options.hierarchy || '';

    const url = `${this.BASE_URL}/childrenJSON?` +
      `geonameId=${geonameId}&` +
      `maxRows=${maxRows}&` +
      `username=${this.USERNAME}` +
      (hierarchy ? `&hierarchy=${hierarchy}` : '');

    console.log(`📡 Fetching from GeoNames: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`GeoNames API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status) {
      throw new Error(`GeoNames API error: ${data.status.message} (${data.status.value})`);
    }

    // Return the children array, or empty array if none found
    return data.geonames || [];
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.requestQueue.clear();
    console.log('🗑️ GeoNames hierarchy cache cleared');
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
export const geoNamesHierarchyService = new GeoNamesHierarchyService();