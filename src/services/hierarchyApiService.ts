// RESTful Hierarchy API Service
// Provides a robust REST API for the OSM administrative hierarchy system

import { osmAdminBoundaryService, OSMAdminBoundary } from './osmAdminBoundaryService';
import { adaptiveHierarchyService, HierarchyNode, AdaptiveHierarchyConfig } from './adaptiveHierarchyService';
import { multiTierCacheService } from './multiTierCacheService';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: number;
    requestId: string;
    version: string;
    cacheHit: boolean;
    processingTime: number;
  };
}

export interface PaginationOptions {
  page: number;
  limit: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface BoundarySearchQuery {
  q?: string; // Search query
  country?: string; // Country code
  adminLevel?: number; // Administrative level
  bbox?: [number, number, number, number]; // Bounding box
  minPopulation?: number;
  maxPopulation?: number;
  includeGeometry?: boolean;
  sort?: 'name' | 'population' | 'adminLevel' | 'relevance';
  order?: 'asc' | 'desc';
}

export interface HierarchyQuery {
  country: string;
  maxDepth?: number;
  includeGeometry?: boolean;
  expandTo?: string; // Boundary ID to expand to
  format?: 'tree' | 'flat' | 'geojson';
}

export class HierarchyApiService {
  private requestId = 0;
  private readonly version = '1.0.0';

  constructor() {
    console.log('🚀 Hierarchy API Service initialized');
  }

  /**
   * GET /api/boundaries
   * Search administrative boundaries
   */
  async searchBoundaries(
    query: BoundarySearchQuery,
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<ApiResponse<PaginatedResponse<OSMAdminBoundary>>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      console.log(`🔍 API: Search boundaries - Request ${requestId}`);
      
      // Build cache key
      const cacheKey = `boundaries_search_${JSON.stringify({ query, pagination })}`;
      
      // Check cache
      const cached = await multiTierCacheService.get<PaginatedResponse<OSMAdminBoundary>>(cacheKey);
      if (cached) {
        return this.successResponse(cached, requestId, startTime, true);
      }

      // Validate query parameters
      const validation = this.validateBoundaryQuery(query, pagination);
      if (!validation.valid) {
        return this.errorResponse('INVALID_QUERY', validation.message, requestId, startTime);
      }

      // Execute search
      let boundaries: OSMAdminBoundary[] = [];
      
      if (query.q && query.country) {
        // Search by name in specific country
        boundaries = await osmAdminBoundaryService.searchBoundaries(
          query.q,
          query.country,
          query.includeGeometry || false
        );
      } else if (query.country && query.adminLevel !== undefined) {
        // Get boundaries by level for country
        boundaries = await osmAdminBoundaryService.getBoundariesByLevel(
          query.country,
          query.adminLevel,
          query.includeGeometry || false
        );
      } else if (query.country) {
        // Get all boundaries for country
        boundaries = await osmAdminBoundaryService.getCountryBoundaries(
          query.country,
          query.includeGeometry || false
        );
      } else {
        return this.errorResponse('INSUFFICIENT_PARAMETERS', 
          'Either country code or search query is required', requestId, startTime);
      }

      // Apply additional filters
      boundaries = this.applyBoundaryFilters(boundaries, query);

      // Apply sorting
      boundaries = this.sortBoundaries(boundaries, query.sort, query.order);

      // Apply pagination
      const paginatedResult = this.paginateResults(boundaries, pagination);

      // Cache result
      await multiTierCacheService.set(cacheKey, paginatedResult, 3600); // 1 hour TTL

      return this.successResponse(paginatedResult, requestId, startTime, false);

    } catch (error) {
      console.error(`❌ API: Search boundaries error - Request ${requestId}:`, error);
      return this.errorResponse('SEARCH_FAILED', 
        error instanceof Error ? error.message : 'Unknown error', 
        requestId, startTime, error);
    }
  }

  /**
   * GET /api/boundaries/:id
   * Get specific boundary by ID
   */
  async getBoundary(id: string, includeGeometry = false): Promise<ApiResponse<OSMAdminBoundary>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      console.log(`🔍 API: Get boundary ${id} - Request ${requestId}`);
      
      // Check cache
      const cacheKey = `boundary_${id}_${includeGeometry}`;
      const cached = await multiTierCacheService.get<OSMAdminBoundary>(cacheKey);
      if (cached) {
        return this.successResponse(cached, requestId, startTime, true);
      }

      // This would require implementing single boundary fetch in osmAdminBoundaryService
      // For now, return error
      return this.errorResponse('NOT_IMPLEMENTED', 
        'Single boundary fetch not yet implemented', requestId, startTime);

    } catch (error) {
      console.error(`❌ API: Get boundary error - Request ${requestId}:`, error);
      return this.errorResponse('FETCH_FAILED', 
        error instanceof Error ? error.message : 'Unknown error', 
        requestId, startTime, error);
    }
  }

  /**
   * GET /api/hierarchy/:country
   * Get administrative hierarchy for country
   */
  async getHierarchy(country: string, query: Partial<HierarchyQuery> = {}): Promise<ApiResponse<any>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      console.log(`🏗️ API: Get hierarchy for ${country} - Request ${requestId}`);
      
      // Check cache
      const cacheKey = `hierarchy_${country}_${JSON.stringify(query)}`;
      const cached = await multiTierCacheService.get<any>(cacheKey);
      if (cached) {
        return this.successResponse(cached, requestId, startTime, true);
      }

      // Validate country code
      if (!this.isValidCountryCode(country)) {
        return this.errorResponse('INVALID_COUNTRY', 
          'Invalid country code format', requestId, startTime);
      }

      // Build hierarchy configuration
      const config: AdaptiveHierarchyConfig = {
        countryCode: country.toUpperCase(),
        maxDepth: query.maxDepth || 10,
        prioritizeLevels: [2, 4, 6, 8], // Common admin levels
        includeGeometry: query.includeGeometry || false,
        spatialIndexing: false,
        cacheStrategy: 'hybrid'
      };

      // Build hierarchy
      const hierarchy = await adaptiveHierarchyService.buildHierarchy(config);

      // Format response based on requested format
      let formattedResponse: any;
      
      switch (query.format) {
        case 'flat':
          formattedResponse = this.flattenHierarchy(hierarchy);
          break;
        
        case 'geojson':
          formattedResponse = this.hierarchyToGeoJSON(hierarchy);
          break;
        
        case 'tree':
        default:
          formattedResponse = this.formatHierarchyTree(hierarchy);
          break;
      }

      // Add metadata
      const stats = adaptiveHierarchyService.getHierarchyStats(country);
      formattedResponse.metadata = {
        country: country.toUpperCase(),
        stats,
        generated: new Date().toISOString()
      };

      // Cache result
      await multiTierCacheService.set(cacheKey, formattedResponse, 7200); // 2 hours TTL

      return this.successResponse(formattedResponse, requestId, startTime, false);

    } catch (error) {
      console.error(`❌ API: Get hierarchy error - Request ${requestId}:`, error);
      return this.errorResponse('HIERARCHY_FAILED', 
        error instanceof Error ? error.message : 'Unknown error', 
        requestId, startTime, error);
    }
  }

  /**
   * POST /api/hierarchy/:country/expand
   * Expand specific node in hierarchy
   */
  async expandHierarchyNode(
    country: string, 
    nodeId: string, 
    options: { includeGeometry?: boolean } = {}
  ): Promise<ApiResponse<HierarchyNode[]>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      console.log(`🔄 API: Expand node ${nodeId} in ${country} - Request ${requestId}`);
      
      // Check cache
      const cacheKey = `expand_${country}_${nodeId}_${JSON.stringify(options)}`;
      const cached = await multiTierCacheService.get<HierarchyNode[]>(cacheKey);
      if (cached) {
        return this.successResponse(cached, requestId, startTime, true);
      }

      // Validate inputs
      if (!this.isValidCountryCode(country) || !nodeId) {
        return this.errorResponse('INVALID_PARAMETERS', 
          'Valid country code and node ID are required', requestId, startTime);
      }

      // Build expansion configuration
      const config: AdaptiveHierarchyConfig = {
        countryCode: country.toUpperCase(),
        maxDepth: 10,
        prioritizeLevels: [2, 4, 6, 8],
        includeGeometry: options.includeGeometry || false,
        spatialIndexing: false,
        cacheStrategy: 'hybrid'
      };

      // Expand node
      const children = await adaptiveHierarchyService.expandNode(nodeId, config);

      // Cache result
      await multiTierCacheService.set(cacheKey, children, 3600); // 1 hour TTL

      return this.successResponse(children, requestId, startTime, false);

    } catch (error) {
      console.error(`❌ API: Expand node error - Request ${requestId}:`, error);
      return this.errorResponse('EXPANSION_FAILED', 
        error instanceof Error ? error.message : 'Unknown error', 
        requestId, startTime, error);
    }
  }

  /**
   * GET /api/search/:country
   * Search within country hierarchy
   */
  async searchHierarchy(
    country: string, 
    searchQuery: string,
    options: { maxResults?: number } = {}
  ): Promise<ApiResponse<HierarchyNode[]>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      console.log(`🔍 API: Search hierarchy in ${country} for "${searchQuery}" - Request ${requestId}`);
      
      // Check cache
      const cacheKey = `search_${country}_${searchQuery}_${JSON.stringify(options)}`;
      const cached = await multiTierCacheService.get<HierarchyNode[]>(cacheKey);
      if (cached) {
        return this.successResponse(cached, requestId, startTime, true);
      }

      // Validate inputs
      if (!this.isValidCountryCode(country) || !searchQuery.trim()) {
        return this.errorResponse('INVALID_PARAMETERS', 
          'Valid country code and search query are required', requestId, startTime);
      }

      // Perform search
      const results = await adaptiveHierarchyService.searchHierarchy(
        country.toUpperCase(),
        searchQuery,
        options.maxResults || 20
      );

      // Cache result
      await multiTierCacheService.set(cacheKey, results, 1800); // 30 minutes TTL

      return this.successResponse(results, requestId, startTime, false);

    } catch (error) {
      console.error(`❌ API: Search hierarchy error - Request ${requestId}:`, error);
      return this.errorResponse('SEARCH_FAILED', 
        error instanceof Error ? error.message : 'Unknown error', 
        requestId, startTime, error);
    }
  }

  /**
   * GET /api/stats
   * Get API and cache statistics
   */
  async getStats(): Promise<ApiResponse<any>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      const cacheStats = multiTierCacheService.getStats();
      const osmCacheStats = osmAdminBoundaryService.getCacheStats();
      
      const stats = {
        api: {
          version: this.version,
          uptime: process.uptime ? process.uptime() : 'N/A',
          requestCount: this.requestId
        },
        cache: cacheStats,
        osm: osmCacheStats,
        hierarchy: {
          // Add hierarchy-specific stats if available
        }
      };

      return this.successResponse(stats, requestId, startTime, false);

    } catch (error) {
      console.error(`❌ API: Get stats error - Request ${requestId}:`, error);
      return this.errorResponse('STATS_FAILED', 
        error instanceof Error ? error.message : 'Unknown error', 
        requestId, startTime, error);
    }
  }

  /**
   * DELETE /api/cache
   * Clear API cache
   */
  async clearCache(tier?: 'memory' | 'disk' | 'cloud'): Promise<ApiResponse<{ cleared: boolean }>> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      console.log(`🧹 API: Clear cache ${tier || 'all'} - Request ${requestId}`);
      
      await multiTierCacheService.clear(tier);
      osmAdminBoundaryService.clearCache();
      adaptiveHierarchyService.clearCache();

      return this.successResponse({ cleared: true }, requestId, startTime, false);

    } catch (error) {
      console.error(`❌ API: Clear cache error - Request ${requestId}:`, error);
      return this.errorResponse('CACHE_CLEAR_FAILED', 
        error instanceof Error ? error.message : 'Unknown error', 
        requestId, startTime, error);
    }
  }

  /**
   * Utility methods
   */
  private generateRequestId(): string {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  private successResponse<T>(
    data: T, 
    requestId: string, 
    startTime: number, 
    cacheHit: boolean
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      metadata: {
        timestamp: Date.now(),
        requestId,
        version: this.version,
        cacheHit,
        processingTime: Date.now() - startTime
      }
    };
  }

  private errorResponse(
    code: string, 
    message: string, 
    requestId: string, 
    startTime: number, 
    details?: any
  ): ApiResponse<any> {
    return {
      success: false,
      error: {
        code,
        message,
        details
      },
      metadata: {
        timestamp: Date.now(),
        requestId,
        version: this.version,
        cacheHit: false,
        processingTime: Date.now() - startTime
      }
    };
  }

  private validateBoundaryQuery(query: BoundarySearchQuery, pagination: PaginationOptions): { valid: boolean; message?: string } {
    if (pagination.limit > 100) {
      return { valid: false, message: 'Limit cannot exceed 100' };
    }

    if (pagination.page < 1) {
      return { valid: false, message: 'Page must be >= 1' };
    }

    if (query.adminLevel !== undefined && (query.adminLevel < 1 || query.adminLevel > 12)) {
      return { valid: false, message: 'Admin level must be between 1 and 12' };
    }

    if (query.bbox && query.bbox.length !== 4) {
      return { valid: false, message: 'Bounding box must have 4 coordinates' };
    }

    return { valid: true };
  }

  private isValidCountryCode(code: string): boolean {
    return /^[A-Z]{2}$/i.test(code);
  }

  private applyBoundaryFilters(boundaries: OSMAdminBoundary[], query: BoundarySearchQuery): OSMAdminBoundary[] {
    let filtered = boundaries;

    if (query.minPopulation !== undefined) {
      filtered = filtered.filter(b => (b.population || 0) >= query.minPopulation!);
    }

    if (query.maxPopulation !== undefined) {
      filtered = filtered.filter(b => (b.population || 0) <= query.maxPopulation!);
    }

    if (query.bbox) {
      const [minLon, minLat, maxLon, maxLat] = query.bbox;
      filtered = filtered.filter(b => 
        b.bbox[0] >= minLon && b.bbox[1] >= minLat && 
        b.bbox[2] <= maxLon && b.bbox[3] <= maxLat
      );
    }

    return filtered;
  }

  private sortBoundaries(boundaries: OSMAdminBoundary[], sort?: string, order = 'asc'): OSMAdminBoundary[] {
    const sortedBoundaries = [...boundaries];
    
    sortedBoundaries.sort((a, b) => {
      let comparison = 0;
      
      switch (sort) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        
        case 'population':
          comparison = (a.population || 0) - (b.population || 0);
          break;
        
        case 'adminLevel':
          comparison = a.adminLevel - b.adminLevel;
          break;
        
        case 'relevance':
        default:
          // Default relevance: capitals first, then by population, then alphabetically
          if (a.isCapital && !b.isCapital) return -1;
          if (!a.isCapital && b.isCapital) return 1;
          
          const popDiff = (b.population || 0) - (a.population || 0);
          if (popDiff !== 0) return popDiff;
          
          comparison = a.name.localeCompare(b.name);
          break;
      }
      
      return order === 'desc' ? -comparison : comparison;
    });

    return sortedBoundaries;
  }

  private paginateResults<T>(items: T[], pagination: PaginationOptions): PaginatedResponse<T> {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;
    const paginatedItems = items.slice(offset, offset + limit);
    const total = items.length;
    const totalPages = Math.ceil(total / limit);

    return {
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  private formatHierarchyTree(hierarchy: HierarchyNode): any {
    return {
      id: hierarchy.id,
      boundary: hierarchy.boundary,
      children: hierarchy.children.map(child => this.formatHierarchyTree(child)),
      path: hierarchy.path,
      depth: hierarchy.depth,
      isExpanded: hierarchy.isExpanded,
      loadingState: hierarchy.loadingState,
      childrenCount: hierarchy.childrenCount
    };
  }

  private flattenHierarchy(hierarchy: HierarchyNode): any[] {
    const flattened: any[] = [];
    
    const flatten = (node: HierarchyNode) => {
      flattened.push({
        id: node.id,
        boundary: node.boundary,
        path: node.path,
        depth: node.depth,
        parentId: node.parent?.id,
        childrenCount: node.children.length
      });
      
      for (const child of node.children) {
        flatten(child);
      }
    };

    flatten(hierarchy);
    return flattened;
  }

  private hierarchyToGeoJSON(hierarchy: HierarchyNode): any {
    const features: any[] = [];
    
    const addFeature = (node: HierarchyNode) => {
      if (node.boundary.geometry) {
        features.push({
          type: 'Feature',
          properties: {
            id: node.id,
            name: node.boundary.name,
            adminLevel: node.boundary.adminLevel,
            countryCode: node.boundary.countryCode,
            population: node.boundary.population,
            isCapital: node.boundary.isCapital,
            depth: node.depth,
            path: node.path.join('/')
          },
          geometry: node.boundary.geometry
        });
      }
      
      for (const child of node.children) {
        addFeature(child);
      }
    };

    addFeature(hierarchy);

    return {
      type: 'FeatureCollection',
      features
    };
  }
}

// Export singleton instance
export const hierarchyApiService = new HierarchyApiService();