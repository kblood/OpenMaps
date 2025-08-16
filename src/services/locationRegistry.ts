// Graph-Based Location Registry System
// Eliminates overlapping tree branches and provides intelligent cache sharing

import { DynamicLocationNode } from './dynamicLocationService';

// Core interfaces for the registry system
export interface LocationRegistry {
  // Global location storage - single source of truth
  locations: Map<string, DynamicLocationNode>;
  
  // Relationship maps for graph structure
  parentToChildren: Map<string, Set<string>>;
  childToParents: Map<string, Set<string>>;
  
  // Loading and cache state management
  loadingStates: Map<string, LoadingState>;
  cacheMetadata: Map<string, CacheMetadata>;
  
  // Search and access tracking
  accessPaths: Map<string, AccessPath[]>;
  searchIndex: Map<string, string[]>;
}

export interface LoadingState {
  promise: Promise<DynamicLocationNode[]>;
  accessPaths: Set<string>;
  startTime: number;
  priority: LoadingPriority;
  retryCount: number;
}

export enum LoadingPriority {
  USER_INITIATED = 1,
  EXPANSION = 2,
  PREFETCH = 3,
  BACKGROUND = 4
}

export interface CacheMetadata {
  lastUpdated: number;
  loadTime: number;
  hitCount: number;
  accessPaths: Set<string>;
  dataSize: number;
}

export interface AccessPath {
  path: string;
  viewId: string;
  timestamp: number;
  loadTime?: number;
}

export interface CacheStats {
  hitRate: number;
  activeLoads: number;
  crossBranchShares: number;
  memoryUsageMB: number;
  totalLocations: number;
  avgLoadTime: number;
}

// Core LocationRegistry Service
export class LocationRegistryService {
  private registry: LocationRegistry = {
    locations: new Map(),
    parentToChildren: new Map(),
    childToParents: new Map(),
    loadingStates: new Map(),
    cacheMetadata: new Map(),
    accessPaths: new Map(),
    searchIndex: new Map()
  };

  private loadingCoordinator: LoadingCoordinator;
  private dynamicLocationService: any; // Will be injected

  constructor(dynamicLocationService: any) {
    this.dynamicLocationService = dynamicLocationService;
    this.loadingCoordinator = new LoadingCoordinator(this, dynamicLocationService);
    
    console.log('🏗️ LocationRegistry initialized with graph-based architecture');
  }

  // ==================== CORE LOCATION MANAGEMENT ====================

  /**
   * Smart location retrieval with cross-branch sharing
   * Returns cached location instantly if available from any tree branch
   */
  async getLocation(locationId: string): Promise<DynamicLocationNode | null> {
    // Check registry first - fastest path
    if (this.registry.locations.has(locationId)) {
      const location = this.registry.locations.get(locationId)!;
      this.updateCacheHit(locationId);
      console.log(`⚡ Registry hit for ${location.name}`);
      return location;
    }

    // Check if currently loading to prevent duplicates
    if (this.registry.loadingStates.has(locationId)) {
      const loadingState = this.registry.loadingStates.get(locationId)!;
      console.log(`⏳ Waiting for existing load of ${locationId}`);
      const children = await loadingState.promise;
      // The location should be in registry after loading its children
      return this.registry.locations.get(locationId) || null;
    }

    // Load from underlying service and register
    try {
      const location = await this.dynamicLocationService.getLocation(locationId);
      if (location) {
        this.registerLocation(location);
      }
      return location;
    } catch (error) {
      console.error(`❌ Failed to load location ${locationId}:`, error);
      return null;
    }
  }

  /**
   * Cross-branch cache sharing for children
   * Loads once, shares everywhere
   */
  async getChildren(parentId: string, accessPath?: string): Promise<DynamicLocationNode[]> {
    const fullAccessPath = accessPath || `default:${parentId}`;
    
    // Check if children already loaded for ANY path
    if (this.registry.parentToChildren.has(parentId)) {
      const childIds = this.registry.parentToChildren.get(parentId)!;
      const children = Array.from(childIds)
        .map(id => this.registry.locations.get(id))
        .filter(Boolean) as DynamicLocationNode[];
      
      // Track this access path for analytics
      this.trackAccessPath(parentId, fullAccessPath);
      this.updateCacheHit(parentId);
      
      console.log(`🔗 Cross-branch cache hit for ${parentId} children (${children.length} items) via ${fullAccessPath}`);
      return children;
    }

    // Load once using coordinator, share everywhere
    return await this.loadingCoordinator.loadChildren(parentId, fullAccessPath, LoadingPriority.USER_INITIATED);
  }

  /**
   * Register a location in the global registry
   */
  registerLocation(location: DynamicLocationNode, loadTime?: number): void {
    // Store in global registry
    this.registry.locations.set(location.id, location);
    
    // Update cache metadata
    const metadata: CacheMetadata = {
      lastUpdated: Date.now(),
      loadTime: loadTime || 0,
      hitCount: 0,
      accessPaths: new Set(),
      dataSize: this.estimateDataSize(location)
    };
    this.registry.cacheMetadata.set(location.id, metadata);
    
    // Update search index
    this.updateSearchIndex(location);
    
    console.log(`📝 Registered ${location.name} (${location.level}) in global registry`);
  }

  /**
   * Register parent-child relationships in the graph
   */
  registerRelationships(parentId: string, children: DynamicLocationNode[]): void {
    // Register all children locations
    children.forEach(child => {
      this.registerLocation(child);
    });

    // Update parent-to-children mapping
    const childIds = new Set(children.map(child => child.id));
    this.registry.parentToChildren.set(parentId, childIds);

    // Update child-to-parents mapping (allows multiple parents)
    children.forEach(child => {
      if (!this.registry.childToParents.has(child.id)) {
        this.registry.childToParents.set(child.id, new Set());
      }
      this.registry.childToParents.get(child.id)!.add(parentId);
    });

    console.log(`🔗 Registered relationships: ${parentId} → ${children.length} children`);
  }

  // ==================== CACHE MANAGEMENT ====================

  /**
   * Check if location is loaded via other tree paths
   */
  isLoadedElsewhere(locationId: string, currentPath: string): boolean {
    const metadata = this.registry.cacheMetadata.get(locationId);
    if (!metadata) return false;

    // Check if loaded via different access paths
    const otherPaths = Array.from(metadata.accessPaths).filter(path => path !== currentPath);
    return otherPaths.length > 0;
  }

  /**
   * Check if a location is already loaded in registry
   */
  isLocationLoaded(locationId: string): boolean {
    return this.registry.locations.has(locationId);
  }

  /**
   * Check if children are already loaded for a parent
   */
  isChildrenLoaded(parentId: string): boolean {
    return this.registry.parentToChildren.has(parentId);
  }

  /**
   * Get alternative access paths for a location
   */
  getAlternativePaths(locationId: string, currentPath: string): string[] {
    const accessPaths = this.registry.accessPaths.get(locationId) || [];
    return accessPaths
      .filter(access => access.path !== currentPath)
      .map(access => `${access.viewId}:${access.path}`)
      .slice(0, 3); // Limit to 3 for UI
  }

  /**
   * Track access path for analytics and optimization
   */
  private trackAccessPath(locationId: string, accessPath: string): void {
    if (!this.registry.accessPaths.has(locationId)) {
      this.registry.accessPaths.set(locationId, []);
    }

    const paths = this.registry.accessPaths.get(locationId)!;
    const [viewId, path] = accessPath.split(':', 2);
    
    // Add new access path if not exists
    const existingPath = paths.find(p => p.viewId === viewId && p.path === path);
    if (!existingPath) {
      paths.push({
        path,
        viewId,
        timestamp: Date.now()
      });
    }

    // Update cache metadata
    const metadata = this.registry.cacheMetadata.get(locationId);
    if (metadata) {
      metadata.accessPaths.add(accessPath);
    }
  }

  /**
   * Update cache hit statistics
   */
  private updateCacheHit(locationId: string): void {
    const metadata = this.registry.cacheMetadata.get(locationId);
    if (metadata) {
      metadata.hitCount++;
    }
  }

  // ==================== SEARCH FUNCTIONALITY ====================

  /**
   * Search locations with intelligent ranking
   */
  async searchLocations(query: string, limit: number = 50): Promise<DynamicLocationNode[]> {
    const normalizedQuery = query.toLowerCase().trim();
    
    // First, search in registry (fastest)
    const registryResults = this.searchInRegistry(normalizedQuery);
    
    // If we have enough results, return them
    if (registryResults.length >= limit) {
      return registryResults.slice(0, limit);
    }

    // Otherwise, search via underlying service and register results
    try {
      const apiResults = await this.dynamicLocationService.searchLocations(query, limit);
      apiResults.forEach((location: DynamicLocationNode) => {
        this.registerLocation(location);
      });
      
      // Combine and deduplicate results
      const combined = this.deduplicateSearchResults([...registryResults, ...apiResults]);
      return combined.slice(0, limit);
    } catch (error) {
      console.error('Search failed, returning registry results only:', error);
      return registryResults.slice(0, limit);
    }
  }

  private searchInRegistry(query: string): DynamicLocationNode[] {
    const results: DynamicLocationNode[] = [];
    
    for (const [locationId, location] of this.registry.locations) {
      const score = this.calculateSearchScore(location, query);
      if (score > 0) {
        results.push(location);
      }
    }

    // Sort by relevance score
    return results.sort((a, b) => {
      const scoreA = this.calculateSearchScore(a, query);
      const scoreB = this.calculateSearchScore(b, query);
      return scoreB - scoreA;
    });
  }

  private calculateSearchScore(location: DynamicLocationNode, query: string): number {
    const name = location.name.toLowerCase();
    const query_lower = query.toLowerCase();
    
    // Exact match gets highest score
    if (name === query_lower) return 100;
    
    // Starts with query gets high score
    if (name.startsWith(query_lower)) return 80;
    
    // Contains query gets medium score
    if (name.includes(query_lower)) return 60;
    
    // No match
    return 0;
  }

  private deduplicateSearchResults(results: DynamicLocationNode[]): DynamicLocationNode[] {
    const seen = new Set<string>();
    return results.filter(location => {
      if (seen.has(location.id)) return false;
      seen.add(location.id);
      return true;
    });
  }

  // ==================== PERFORMANCE MONITORING ====================

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats(): CacheStats {
    const totalHits = Array.from(this.registry.cacheMetadata.values())
      .reduce((sum, meta) => sum + meta.hitCount, 0);
    
    const totalRequests = totalHits + this.loadingCoordinator.getTotalLoads();
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    
    const crossBranchShares = Array.from(this.registry.cacheMetadata.values())
      .filter(meta => meta.accessPaths.size > 1).length;
    
    const totalDataSize = Array.from(this.registry.cacheMetadata.values())
      .reduce((sum, meta) => sum + meta.dataSize, 0);
    
    const avgLoadTime = Array.from(this.registry.cacheMetadata.values())
      .filter(meta => meta.loadTime > 0)
      .reduce((sum, meta, _, arr) => sum + meta.loadTime / arr.length, 0);

    return {
      hitRate: Math.round(hitRate * 100) / 100,
      activeLoads: this.registry.loadingStates.size,
      crossBranchShares,
      memoryUsageMB: Math.round(totalDataSize / (1024 * 1024) * 100) / 100,
      totalLocations: this.registry.locations.size,
      avgLoadTime: Math.round(avgLoadTime)
    };
  }

  /**
   * Clear cache for testing and development
   */
  clearCache(): void {
    this.registry.locations.clear();
    this.registry.parentToChildren.clear();
    this.registry.childToParents.clear();
    this.registry.loadingStates.clear();
    this.registry.cacheMetadata.clear();
    this.registry.accessPaths.clear();
    this.registry.searchIndex.clear();
    
    console.log('🗑️ LocationRegistry cache cleared');
  }

  // ==================== UTILITY METHODS ====================

  private updateSearchIndex(location: DynamicLocationNode): void {
    const tokens = this.tokenizeForSearch(location.name);
    tokens.forEach(token => {
      if (!this.registry.searchIndex.has(token)) {
        this.registry.searchIndex.set(token, []);
      }
      this.registry.searchIndex.get(token)!.push(location.id);
    });
  }

  private tokenizeForSearch(text: string): string[] {
    return text.toLowerCase().split(/\s+|[,.-]/);
  }

  private estimateDataSize(location: DynamicLocationNode): number {
    // Rough estimation of object size in bytes
    return JSON.stringify(location).length * 2; // UTF-16 encoding
  }
}

// Loading Coordinator for deduplicating API calls
export class LoadingCoordinator {
  private activeLoads: Map<string, LoadingState> = new Map();
  private totalLoads: number = 0;
  private registry: LocationRegistryService;
  private dynamicLocationService: any;

  constructor(registry: LocationRegistryService, dynamicLocationService: any) {
    this.registry = registry;
    this.dynamicLocationService = dynamicLocationService;
  }

  async loadChildren(
    parentId: string, 
    accessPath: string, 
    priority: LoadingPriority = LoadingPriority.USER_INITIATED
  ): Promise<DynamicLocationNode[]> {
    const loadKey = `children_${parentId}`;
    
    // Check if already loading
    if (this.activeLoads.has(loadKey)) {
      const existing = this.activeLoads.get(loadKey)!;
      
      // Add this access path to the loading state
      existing.accessPaths.add(accessPath);
      
      // Upgrade priority if higher
      if (priority < existing.priority) {
        existing.priority = priority;
        console.log(`📈 Upgraded priority for ${parentId} to ${LoadingPriority[priority]}`);
      }
      
      console.log(`🔄 Coordinated loading for ${parentId} across paths: ${Array.from(existing.accessPaths).join(', ')}`);
      return existing.promise;
    }

    // Start new coordinated load
    const startTime = Date.now();
    const loadingState: LoadingState = {
      promise: this.performActualLoad(parentId),
      accessPaths: new Set([accessPath]),
      startTime,
      priority,
      retryCount: 0
    };

    this.activeLoads.set(loadKey, loadingState);
    this.totalLoads++;

    try {
      const result = await loadingState.promise;
      const loadTime = Date.now() - startTime;
      
      // Register relationships in the graph
      this.registry.registerRelationships(parentId, result);
      
      console.log(`✅ Coordinated load completed: ${result.length} children for ${parentId} in ${loadTime}ms`);
      console.log(`🔗 Shared across paths: ${Array.from(loadingState.accessPaths).join(', ')}`);
      
      return result;
    } catch (error) {
      console.error(`❌ Coordinated load failed for ${parentId}:`, error);
      throw error;
    } finally {
      this.activeLoads.delete(loadKey);
    }
  }

  private async performActualLoad(parentId: string): Promise<DynamicLocationNode[]> {
    // Delegate to the underlying dynamic location service
    return await this.dynamicLocationService.getChildren(parentId, false);
  }

  getTotalLoads(): number {
    return this.totalLoads;
  }

  getActiveLoads(): string[] {
    return Array.from(this.activeLoads.keys());
  }
}

// Export singleton instance
let locationRegistryInstance: LocationRegistryService | null = null;

export const getLocationRegistry = (dynamicLocationService?: any): LocationRegistryService => {
  if (!locationRegistryInstance && dynamicLocationService) {
    locationRegistryInstance = new LocationRegistryService(dynamicLocationService);
  }
  if (!locationRegistryInstance) {
    throw new Error('LocationRegistry not initialized. Call getLocationRegistry with dynamicLocationService first.');
  }
  return locationRegistryInstance;
};

// Reset for testing
export const resetLocationRegistry = (): void => {
  locationRegistryInstance = null;
};