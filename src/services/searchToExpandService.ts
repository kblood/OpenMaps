// Search-to-Expand Service for Graph-Based Location System
// Provides intelligent search integration with optimal expansion paths

import { DynamicLocationNode } from './dynamicLocationService';
import { LocationRegistryService, LoadingPriority } from './locationRegistry';

export interface SearchResult {
  location: DynamicLocationNode;
  expansionPath: string[];
  isAlreadyLoaded: boolean;
  estimatedLoadTime: number;
  relevanceScore: number;
  cacheAvailability: CacheAvailability;
}

export interface CacheAvailability {
  isLocationCached: boolean;
  isParentCached: boolean;
  pathCacheRatio: number; // 0-1, how much of the path is cached
  alternativePathsCount: number;
}

export interface SearchToExpandOptions {
  maxResults?: number;
  maxDepth?: number;
  preferCached?: boolean;
  timeoutMs?: number;
  sortBy?: 'relevance' | 'load_time' | 'cache_ratio';
}

export interface ExpansionPlan {
  totalSteps: number;
  cachedSteps: number;
  estimatedTime: number;
  stepDetails: ExpansionStep[];
}

export interface ExpansionStep {
  locationId: string;
  locationName: string;
  isFromCache: boolean;
  estimatedLoadTime: number;
  alternativePaths: string[];
}

/**
 * SearchToExpandService provides intelligent search integration with optimal path calculation
 * and cache-aware expansion planning for the graph-based location system.
 */
export class SearchToExpandService {
  private registry: LocationRegistryService;
  private pathCache: Map<string, string[]> = new Map();
  private loadTimeEstimates: Map<string, number> = new Map();

  constructor(registry: LocationRegistryService) {
    this.registry = registry;
    console.log('🔍 SearchToExpandService initialized');
  }

  /**
   * Search locations and provide expansion metadata for optimal navigation
   */
  async searchAndExpand(
    query: string, 
    targetViewId: string, 
    options: SearchToExpandOptions = {}
  ): Promise<SearchResult[]> {
    const {
      maxResults = 20,
      maxDepth = 6,
      preferCached = true,
      timeoutMs = 5000,
      sortBy = 'relevance'
    } = options;

    console.log(`🔍 Searching for "${query}" with expansion analysis...`);
    const startTime = Date.now();

    try {
      // Perform search with timeout
      const searchPromise = this.registry.searchLocations(query, maxResults * 2);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), timeoutMs)
      );

      const rawResults = await Promise.race([searchPromise, timeoutPromise]);
      console.log(`📍 Found ${rawResults.length} raw search results`);

      // Enhance results with expansion metadata
      const enhancedResults = await Promise.all(
        rawResults.slice(0, maxResults).map(async (location) => {
          const expansionData = await this.analyzeExpansionPath(location, targetViewId, maxDepth);
          const relevanceScore = this.calculateRelevanceScore(location, query);
          
          return {
            location,
            ...expansionData,
            relevanceScore
          };
        })
      );

      // Sort results based on preference
      const sortedResults = this.sortSearchResults(enhancedResults, sortBy, preferCached);
      
      const searchTime = Date.now() - startTime;
      console.log(`✅ Search analysis completed in ${searchTime}ms, returning ${sortedResults.length} results`);

      return sortedResults;

    } catch (error) {
      console.error('Search and expand failed:', error);
      return [];
    }
  }

  /**
   * Expand tree to show a specific location with optimal caching strategy
   */
  async expandToLocation(
    locationId: string, 
    viewId: string, 
    onProgress?: (step: ExpansionStep, current: number, total: number) => void
  ): Promise<ExpansionPlan> {
    console.log(`🌳 Planning expansion to ${locationId} in view ${viewId}`);

    // Calculate optimal path
    const expansionPath = await this.calculateOptimalPath(locationId, viewId);
    if (expansionPath.length === 0) {
      throw new Error(`No valid expansion path found for ${locationId}`);
    }

    // Create expansion plan
    const plan = await this.createExpansionPlan(expansionPath, viewId);
    console.log(`📋 Expansion plan: ${plan.totalSteps} steps, ${plan.cachedSteps} cached, ~${plan.estimatedTime}ms`);

    // Execute expansion step by step
    for (let i = 0; i < plan.stepDetails.length; i++) {
      const step = plan.stepDetails[i];
      
      // Report progress
      onProgress?.(step, i + 1, plan.stepDetails.length);

      if (step.isFromCache) {
        console.log(`⚡ Skipping cached step: ${step.locationName}`);
        continue;
      }

      // Load children for this step
      const stepStartTime = Date.now();
      try {
        await this.registry.getChildren(step.locationId, `expand_${viewId}:${locationId}`);
        const actualTime = Date.now() - stepStartTime;
        
        // Update load time estimates for future use
        this.updateLoadTimeEstimate(step.locationId, actualTime);
        
        console.log(`📂 Loaded children for ${step.locationName} in ${actualTime}ms`);
      } catch (error) {
        console.error(`❌ Failed to load children for ${step.locationName}:`, error);
        throw error;
      }
    }

    console.log(`✅ Expansion to ${locationId} completed successfully`);
    return plan;
  }

  /**
   * Calculate the optimal expansion path to reach a location
   */
  async calculateOptimalPath(locationId: string, viewId: string): Promise<string[]> {
    const cacheKey = `${viewId}:${locationId}`;
    
    // Check path cache first
    if (this.pathCache.has(cacheKey)) {
      console.log(`📋 Using cached path for ${locationId}`);
      return this.pathCache.get(cacheKey)!;
    }

    // Build path by traversing up the hierarchy
    const path: string[] = [];
    let currentId = locationId;

    while (currentId && currentId !== 'world') {
      path.unshift(currentId);
      
      // Find parent (use first parent for simplicity)
      const location = await this.registry.getLocation(currentId);
      if (!location || !location.parentId) {
        break;
      }
      
      currentId = location.parentId;
    }

    // Add root if not already included
    if (currentId === 'world') {
      path.unshift('world');
    }

    // Cache the path for future use
    this.pathCache.set(cacheKey, path);
    
    console.log(`🗺️ Calculated path for ${locationId}: ${path.join(' → ')}`);
    return path;
  }

  /**
   * Analyze expansion path and cache availability
   */
  private async analyzeExpansionPath(
    location: DynamicLocationNode, 
    viewId: string, 
    maxDepth: number
  ): Promise<Omit<SearchResult, 'location' | 'relevanceScore'>> {
    const expansionPath = await this.calculateOptimalPath(location.id, viewId);
    
    // Limit path depth
    const limitedPath = expansionPath.slice(0, maxDepth);
    
    // Analyze cache availability
    const cacheAvailability = this.analyzeCacheAvailability(limitedPath);
    
    // Estimate load time
    const estimatedLoadTime = this.estimatePathLoadTime(limitedPath);
    
    // Check if location is already loaded
    const isAlreadyLoaded = this.registry.isLocationLoaded(location.id);

    return {
      expansionPath: limitedPath,
      isAlreadyLoaded,
      estimatedLoadTime,
      cacheAvailability
    };
  }

  /**
   * Analyze cache availability along a path
   */
  private analyzeCacheAvailability(path: string[]): CacheAvailability {
    const cachedCount = path.filter(id => this.registry.isLocationLoaded(id)).length;
    const pathCacheRatio = path.length > 0 ? cachedCount / path.length : 0;
    
    const lastLocationId = path[path.length - 1];
    const isLocationCached = lastLocationId ? this.registry.isLocationLoaded(lastLocationId) : false;
    
    const parentId = path.length > 1 ? path[path.length - 2] : null;
    const isParentCached = parentId ? this.registry.isChildrenLoaded(parentId) : false;
    
    // Count alternative paths for the target location
    const alternativePathsCount = lastLocationId ? 
      this.registry.getAlternativePaths(lastLocationId, '').length : 0;

    return {
      isLocationCached,
      isParentCached,
      pathCacheRatio,
      alternativePathsCount
    };
  }

  /**
   * Estimate total load time for a path
   */
  private estimatePathLoadTime(path: string[]): number {
    let totalTime = 0;
    
    for (let i = 0; i < path.length - 1; i++) {
      const parentId = path[i];
      
      // If children already loaded, no time needed
      if (this.registry.isChildrenLoaded(parentId)) {
        continue;
      }
      
      // Use cached estimate or default
      const estimatedTime = this.loadTimeEstimates.get(parentId) || this.getDefaultLoadTime(parentId);
      totalTime += estimatedTime;
    }
    
    return totalTime;
  }

  /**
   * Get default load time estimate based on location level
   */
  private getDefaultLoadTime(locationId: string): number {
    // Rough estimates based on typical API response times
    const estimates: { [key: string]: number } = {
      'world': 100,      // Continents are preloaded
      'continent': 800,  // Countries from API
      'country': 1200,   // States/regions from API
      'state': 1000,     // Cities from API
      'city': 500        // Districts (if any)
    };
    
    // Use a default of 1000ms for unknown locations
    return estimates[locationId] || 1000;
  }

  /**
   * Update load time estimate based on actual performance
   */
  private updateLoadTimeEstimate(locationId: string, actualTime: number): void {
    const existing = this.loadTimeEstimates.get(locationId) || actualTime;
    // Use exponential moving average to smooth estimates
    const smoothed = existing * 0.7 + actualTime * 0.3;
    this.loadTimeEstimates.set(locationId, smoothed);
  }

  /**
   * Calculate relevance score for search result
   */
  private calculateRelevanceScore(location: DynamicLocationNode, query: string): number {
    const name = location.name.toLowerCase();
    const queryLower = query.toLowerCase();
    
    let score = 0;
    
    // Exact match gets highest score
    if (name === queryLower) {
      score += 100;
    }
    // Starts with query gets high score
    else if (name.startsWith(queryLower)) {
      score += 80;
    }
    // Contains query gets medium score
    else if (name.includes(queryLower)) {
      score += 60;
    }
    // Word boundary matches get bonus
    else if (name.match(new RegExp(`\\b${queryLower}`, 'i'))) {
      score += 40;
    }
    
    // Population bonus for major cities
    if (location.population) {
      if (location.population > 1000000) score += 20;
      else if (location.population > 100000) score += 10;
      else if (location.population > 10000) score += 5;
    }
    
    // Capital bonus
    if (location.isCapital) {
      score += 15;
    }
    
    // Level bonus (cities often more relevant than regions)
    const levelBonus: { [key: string]: number } = {
      'city': 10,
      'state': 5,
      'country': 8,
      'continent': 2
    };
    score += levelBonus[location.level] || 0;
    
    return score;
  }

  /**
   * Sort search results based on criteria
   */
  private sortSearchResults(
    results: SearchResult[], 
    sortBy: string, 
    preferCached: boolean
  ): SearchResult[] {
    return results.sort((a, b) => {
      // Apply cache preference first if enabled
      if (preferCached) {
        const aCacheScore = a.cacheAvailability.pathCacheRatio;
        const bCacheScore = b.cacheAvailability.pathCacheRatio;
        if (aCacheScore !== bCacheScore) {
          return bCacheScore - aCacheScore;
        }
      }
      
      // Then apply primary sort criteria
      switch (sortBy) {
        case 'load_time':
          return a.estimatedLoadTime - b.estimatedLoadTime;
        
        case 'cache_ratio':
          return b.cacheAvailability.pathCacheRatio - a.cacheAvailability.pathCacheRatio;
        
        case 'relevance':
        default:
          return b.relevanceScore - a.relevanceScore;
      }
    });
  }

  /**
   * Create detailed expansion plan
   */
  private async createExpansionPlan(path: string[], viewId: string): Promise<ExpansionPlan> {
    const stepDetails: ExpansionStep[] = [];
    let totalTime = 0;
    let cachedSteps = 0;

    for (let i = 0; i < path.length - 1; i++) {
      const parentId = path[i];
      const location = await this.registry.getLocation(parentId);
      
      const isFromCache = this.registry.isChildrenLoaded(parentId);
      const estimatedLoadTime = isFromCache ? 0 : this.getDefaultLoadTime(parentId);
      const alternativePaths = this.registry.getAlternativePaths(parentId, viewId);
      
      if (isFromCache) {
        cachedSteps++;
      } else {
        totalTime += estimatedLoadTime;
      }

      stepDetails.push({
        locationId: parentId,
        locationName: location?.name || parentId,
        isFromCache,
        estimatedLoadTime,
        alternativePaths
      });
    }

    return {
      totalSteps: stepDetails.length,
      cachedSteps,
      estimatedTime: totalTime,
      stepDetails
    };
  }

  /**
   * Clear path cache (useful for testing)
   */
  clearCache(): void {
    this.pathCache.clear();
    this.loadTimeEstimates.clear();
    console.log('🗑️ SearchToExpandService cache cleared');
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      cachedPaths: this.pathCache.size,
      loadTimeEstimates: this.loadTimeEstimates.size,
      avgEstimatedLoadTime: Array.from(this.loadTimeEstimates.values())
        .reduce((sum, time, _, arr) => sum + time / arr.length, 0)
    };
  }
}

// Export factory function
export const createSearchToExpandService = (registry: LocationRegistryService): SearchToExpandService => {
  return new SearchToExpandService(registry);
};