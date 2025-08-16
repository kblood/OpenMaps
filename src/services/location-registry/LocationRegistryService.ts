// Location Registry Service - Central Store for All Location Data

import { 
  LocationRegistry, 
  LocationRegistryNode, 
  RegistryStats, 
  CacheMetadata, 
  AccessPath,
  LoadingPriority,
  DynamicLocationNode 
} from './types';
import { LoadingCoordinator } from './LoadingCoordinator';

export class LocationRegistryService {
  private registry: LocationRegistry;
  private loadingCoordinator: LoadingCoordinator;
  private dbName = 'openmaps_location_registry';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  constructor() {
    this.registry = {
      locations: new Map(),
      parentToChildren: new Map(),
      childToParents: new Map(),
      loadingStates: new Map(),
      cacheMetadata: new Map(),
      accessPaths: new Map(),
      searchIndex: new Map(),
      stats: this.initializeStats()
    };
    
    this.loadingCoordinator = new LoadingCoordinator();
    this.initializeDatabase();
  }

  /**
   * Get location with cross-branch cache sharing
   */
  async getLocation(locationId: string, accessPath?: string): Promise<LocationRegistryNode | null> {
    // Check registry first
    if (this.registry.locations.has(locationId)) {
      const location = this.registry.locations.get(locationId)!;
      
      // Track access path
      if (accessPath) {
        this.trackAccessPath(locationId, accessPath);
        location.accessPaths.add(accessPath);
        location.cacheSharedCount++;
      }
      
      this.updateCacheMetadata(locationId);
      return location;
    }

    // Load from database if not in memory
    const dbLocation = await this.loadFromDatabase(locationId);
    if (dbLocation) {
      this.registerLocation(dbLocation, accessPath);
      return dbLocation;
    }

    return null;
  }

  /**
   * Get children with intelligent cache sharing across tree branches
   */
  async getChildren(parentId: string, accessPath: string = 'default'): Promise<LocationRegistryNode[]> {
    // Check if children already loaded for ANY path
    if (this.registry.parentToChildren.has(parentId)) {
      const childIds = this.registry.parentToChildren.get(parentId)!;
      const children = Array.from(childIds)
        .map(id => this.registry.locations.get(id))
        .filter(Boolean) as LocationRegistryNode[];
      
      // Track this access path for future optimization
      this.trackAccessPath(parentId, accessPath);
      
      // Update access paths for all children
      children.forEach(child => {
        child.accessPaths.add(accessPath);
        child.cacheSharedCount++;
      });

      console.log(`🔗 Cache hit: ${children.length} children for ${parentId} via ${accessPath} (shared data)`);
      this.registry.stats.cacheHitRate = this.calculateCacheHitRate();
      
      return children;
    }

    // Use loading coordinator to prevent duplicate loads
    return await this.loadingCoordinator.loadChildren(
      parentId,
      accessPath,
      () => this.performActualChildrenLoad(parentId, accessPath),
      LoadingPriority.USER_INITIATED
    );
  }

  /**
   * Register a location in the registry with relationship tracking
   */
  registerLocation(location: LocationRegistryNode, accessPath?: string): void {
    // Ensure registry-specific fields are initialized
    if (!location.accessPaths) {
      location.accessPaths = new Set();
    }
    if (!location.loadedVia) {
      location.loadedVia = [];
    }
    if (location.cacheSharedCount === undefined) {
      location.cacheSharedCount = 0;
    }

    // Add to registry
    this.registry.locations.set(location.id, location);

    // Track access path
    if (accessPath) {
      location.accessPaths.add(accessPath);
      location.loadedVia.push(accessPath);
      this.trackAccessPath(location.id, accessPath);
    }

    // Update relationships
    if (location.parentId) {
      this.addRelationship(location.parentId, location.id);
    }

    // Update search index
    this.updateSearchIndex(location);

    // Update cache metadata
    this.setCacheMetadata(location.id, {
      locationId: location.id,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      sharedBetweenPaths: accessPath ? [accessPath] : [],
      size: this.estimateLocationSize(location)
    });

    this.updateStats();
  }

  /**
   * Register multiple children for a parent
   */
  registerChildren(parentId: string, children: LocationRegistryNode[], accessPath: string): void {
    const childIds = new Set<string>();

    children.forEach(child => {
      // Set parent relationship
      child.parentId = parentId;
      
      // Register the child
      this.registerLocation(child, accessPath);
      childIds.add(child.id);
    });

    // Update parent-child relationships
    this.registry.parentToChildren.set(parentId, childIds);

    // Mark parent as having loaded children
    const parent = this.registry.locations.get(parentId);
    if (parent) {
      parent.childrenLoaded = true;
      parent.hasChildren = children.length > 0;
    }

    console.log(`📁 Registered ${children.length} children for ${parentId} via ${accessPath}`);
  }

  /**
   * Check if location is loaded in other paths (for UI indicators)
   */
  isLoadedInOtherPaths(locationId: string, currentPath: string): boolean {
    const location = this.registry.locations.get(locationId);
    if (!location) return false;

    return Array.from(location.accessPaths).some(path => path !== currentPath);
  }

  /**
   * Get alternative access paths for a location
   */
  getAlternativeAccessPaths(locationId: string, excludePath?: string): string[] {
    const location = this.registry.locations.get(locationId);
    if (!location) return [];

    return Array.from(location.accessPaths).filter(path => path !== excludePath);
  }

  /**
   * Search locations with enhanced result metadata
   */
  async searchLocations(query: string, accessPath: string = 'search'): Promise<LocationRegistryNode[]> {
    const searchTerms = query.toLowerCase().split(' ');
    const results: LocationRegistryNode[] = [];

    // Search in registry first
    for (const location of this.registry.locations.values()) {
      const nameMatch = searchTerms.some(term => 
        location.name.toLowerCase().includes(term)
      );
      
      const tagMatch = searchTerms.some(term =>
        location.tags.some(tag => tag.toLowerCase().includes(term))
      );

      if (nameMatch || tagMatch) {
        // Track search access
        location.accessPaths.add(accessPath);
        results.push(location);
      }
    }

    // Sort by relevance (exact matches first, then by population)
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === query.toLowerCase() ? 1 : 0;
      const bExact = b.name.toLowerCase() === query.toLowerCase() ? 1 : 0;
      
      if (aExact !== bExact) return bExact - aExact;
      
      return (b.population || 0) - (a.population || 0);
    });

    return results.slice(0, 20); // Limit results
  }

  /**
   * Get registry statistics for performance monitoring
   */
  getStats(): RegistryStats {
    this.updateStats();
    return { ...this.registry.stats };
  }

  /**
   * Get cache performance details
   */
  getCacheStats() {
    const totalLocations = this.registry.locations.size;
    const sharedLocations = Array.from(this.registry.locations.values())
      .filter(loc => loc.accessPaths.size > 1).length;
    
    const totalShares = Array.from(this.registry.locations.values())
      .reduce((sum, loc) => sum + loc.cacheSharedCount, 0);

    return {
      totalLocations,
      sharedLocations,
      sharePercentage: totalLocations > 0 ? Math.round((sharedLocations / totalLocations) * 100) : 0,
      totalShares,
      avgSharesPerLocation: totalLocations > 0 ? Math.round(totalShares / totalLocations * 100) / 100 : 0,
      memoryUsageMB: this.calculateMemoryUsage(),
      loadingStats: this.loadingCoordinator.getStats()
    };
  }

  /**
   * Clear all data (for testing/reset)
   */
  async clearAll(): Promise<void> {
    this.registry.locations.clear();
    this.registry.parentToChildren.clear();
    this.registry.childToParents.clear();
    this.registry.cacheMetadata.clear();
    this.registry.accessPaths.clear();
    this.registry.searchIndex.clear();
    
    this.loadingCoordinator.clearAll();
    
    // Clear database
    if (this.db) {
      const transaction = this.db.transaction(['locations', 'relationships'], 'readwrite');
      await Promise.all([
        transaction.objectStore('locations').clear(),
        transaction.objectStore('relationships').clear()
      ]);
    }

    this.updateStats();
    console.log('🗑️ Location registry cleared');
  }

  // === PRIVATE METHODS ===

  private async performActualChildrenLoad(parentId: string, accessPath: string): Promise<LocationRegistryNode[]> {
    // Import here to avoid circular dependency
    const { dynamicLocationService } = await import('../dynamicLocationService');
    
    try {
      console.log(`🔄 Loading children for ${parentId} via ${accessPath} using legacy service`);
      const legacyChildren = await dynamicLocationService.getChildren(parentId, false);
      
      // Convert legacy nodes to registry format
      const registryChildren = legacyChildren.map(child => this.fromLegacyNode(child, accessPath));
      
      // Register all children and relationships
      this.registerChildren(parentId, registryChildren, accessPath);
      
      console.log(`✅ Loaded and registered ${registryChildren.length} children for ${parentId}`);
      return registryChildren;
    } catch (error) {
      console.error(`❌ Failed to load children for ${parentId}:`, error);
      throw error;
    }
  }

  private initializeStats(): RegistryStats {
    return {
      totalLocations: 0,
      totalRelationships: 0,
      cacheHitRate: 0,
      activeLoads: 0,
      crossBranchShares: 0,
      memoryUsageMB: 0,
      avgLoadTime: 0,
      lastUpdate: Date.now()
    };
  }

  private addRelationship(parentId: string, childId: string): void {
    // Parent to children
    if (!this.registry.parentToChildren.has(parentId)) {
      this.registry.parentToChildren.set(parentId, new Set());
    }
    this.registry.parentToChildren.get(parentId)!.add(childId);

    // Child to parents (for multiple parent support)
    if (!this.registry.childToParents.has(childId)) {
      this.registry.childToParents.set(childId, new Set());
    }
    this.registry.childToParents.get(childId)!.add(parentId);
  }

  private trackAccessPath(locationId: string, accessPath: string): void {
    if (!this.registry.accessPaths.has(locationId)) {
      this.registry.accessPaths.set(locationId, []);
    }
    
    const paths = this.registry.accessPaths.get(locationId)!;
    const existingPath = paths.find(p => p.path === accessPath);
    
    if (existingPath) {
      existingPath.timestamp = Date.now();
    } else {
      paths.push({
        path: accessPath,
        viewId: accessPath.split(':')[0] || 'unknown',
        timestamp: Date.now(),
        loadTime: 0
      });
    }
  }

  private updateSearchIndex(location: LocationRegistryNode): void {
    const tokens = [
      ...location.name.toLowerCase().split(/\s+/),
      ...location.tags.map(tag => tag.toLowerCase()),
      location.level,
      location.metadata.countryCode?.toLowerCase() || ''
    ].filter(Boolean);

    this.registry.searchIndex.set(location.id, tokens);
  }

  private updateCacheMetadata(locationId: string): void {
    const metadata = this.registry.cacheMetadata.get(locationId);
    if (metadata) {
      metadata.lastAccessed = Date.now();
      metadata.accessCount++;
    }
  }

  private setCacheMetadata(locationId: string, metadata: CacheMetadata): void {
    this.registry.cacheMetadata.set(locationId, metadata);
  }

  private estimateLocationSize(location: LocationRegistryNode): number {
    // Rough estimation in bytes
    const baseSize = 200; // Base object overhead
    const nameSize = location.name.length * 2;
    const metadataSize = JSON.stringify(location.metadata).length;
    const tagsSize = location.tags.join('').length * 2;
    
    return baseSize + nameSize + metadataSize + tagsSize;
  }

  private calculateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const metadata of this.registry.cacheMetadata.values()) {
      totalSize += metadata.size;
    }
    
    return Math.round(totalSize / 1024 / 1024 * 100) / 100; // MB
  }

  private calculateCacheHitRate(): number {
    // This would be calculated based on actual hit/miss ratios
    // For now, estimate based on shared locations
    const totalLocations = this.registry.locations.size;
    const sharedLocations = Array.from(this.registry.locations.values())
      .filter(loc => loc.accessPaths.size > 1).length;
    
    return totalLocations > 0 ? Math.round((sharedLocations / totalLocations) * 100) : 0;
  }

  private updateStats(): void {
    this.registry.stats = {
      totalLocations: this.registry.locations.size,
      totalRelationships: this.registry.parentToChildren.size,
      cacheHitRate: this.calculateCacheHitRate(),
      activeLoads: this.loadingCoordinator.getStats().activeCount,
      crossBranchShares: Array.from(this.registry.locations.values())
        .reduce((sum, loc) => sum + loc.cacheSharedCount, 0),
      memoryUsageMB: this.calculateMemoryUsage(),
      avgLoadTime: this.loadingCoordinator.getStats().avgLoadTime,
      lastUpdate: Date.now()
    };
  }

  private async initializeDatabase(): Promise<void> {
    // Database initialization - simplified for now
    console.log('🔄 Initializing location registry database...');
  }

  private async loadFromDatabase(locationId: string): Promise<LocationRegistryNode | null> {
    // Database loading - to be implemented
    return null;
  }

  // === LEGACY COMPATIBILITY ===
  
  /**
   * Convert registry node to legacy format for backward compatibility
   */
  toLegacyNode(registryNode: LocationRegistryNode): DynamicLocationNode {
    const childIds = this.registry.parentToChildren.get(registryNode.id);
    
    return {
      ...registryNode,
      childrenIds: childIds ? Array.from(childIds) : []
    };
  }

  /**
   * Convert legacy node to registry format
   */
  fromLegacyNode(legacyNode: DynamicLocationNode, accessPath?: string): LocationRegistryNode {
    return {
      ...legacyNode,
      accessPaths: new Set(accessPath ? [accessPath] : []),
      loadedVia: accessPath ? [accessPath] : [],
      cacheSharedCount: 0
    };
  }
}

// Export singleton instance
export const locationRegistry = new LocationRegistryService();
