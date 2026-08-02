// Location Registry Integration - Bridges Registry with Existing Dynamic Location Service

import { locationRegistry, LocationRegistryService } from './LocationRegistryService';
import { dynamicLocationService, DynamicLocationNode } from '../dynamicLocationService';

export class RegistryIntegrationService {
  private registry: LocationRegistryService;
  private legacyService: typeof dynamicLocationService;

  constructor() {
    this.registry = locationRegistry;
    this.legacyService = dynamicLocationService;
  }

  /**
   * Enhanced getLocation that uses registry with fallback to legacy service
   */
  async getLocation(locationId: string, accessPath: string = 'default'): Promise<DynamicLocationNode | null> {
    try {
      // Try registry first
      const registryNode = await this.registry.getLocation(locationId, accessPath);
      
      if (registryNode) {
        console.log(`🔗 Registry hit for ${locationId} via ${accessPath}`);
        return this.registry.toLegacyNode(registryNode);
      }

      // Fallback to legacy service
      console.log(`🔄 Registry miss for ${locationId}, falling back to legacy service`);
      const legacyNode = await this.legacyService.getLocation(locationId);
      
      if (legacyNode) {
        // Register in registry for future use
        const registryNode = this.registry.fromLegacyNode(legacyNode, accessPath);
        this.registry.registerLocation(registryNode, accessPath);
        
        console.log(`📝 Registered ${locationId} from legacy service`);
        return legacyNode;
      }

      return null;
    } catch (error) {
      console.error(`❌ Error getting location ${locationId}:`, error);
      // Always fallback to legacy service on error
      return await this.legacyService.getLocation(locationId);
    }
  }

  /**
   * Enhanced getChildren with cross-branch cache sharing
   */
  async getChildren(parentId: string, accessPath: string = 'default', forceRefresh: boolean = false): Promise<DynamicLocationNode[]> {
    try {
      if (!forceRefresh) {
        // Try registry first for instant cache sharing
        const registryChildren = await this.registry.getChildren(parentId, accessPath);
        
        if (registryChildren.length > 0) {
          console.log(`🔗 Registry cache hit: ${registryChildren.length} children for ${parentId} via ${accessPath}`);
          return registryChildren.map(child => this.registry.toLegacyNode(child));
        }
      }

      // Load from legacy service
      console.log(`🔄 Loading children for ${parentId} from legacy service via ${accessPath}`);
      const legacyChildren = await this.legacyService.getChildren(parentId, forceRefresh);
      
      if (legacyChildren.length > 0) {
        // Convert and register in registry
        const registryChildren = legacyChildren.map(child => 
          this.registry.fromLegacyNode(child, accessPath)
        );
        
        this.registry.registerChildren(parentId, registryChildren, accessPath);
        
        console.log(`📝 Registered ${legacyChildren.length} children for ${parentId} in registry`);
      }
      
      return legacyChildren;
    } catch (error) {
      console.error(`❌ Error getting children for ${parentId}:`, error);
      // Always fallback to legacy service on error
      return await this.legacyService.getChildren(parentId, forceRefresh);
    }
  }

  /**
   * Search with enhanced registry integration
   */
  async searchLocations(query: string, accessPath: string = 'search'): Promise<DynamicLocationNode[]> {
    try {
      // Search in registry first
      const registryResults = await this.registry.searchLocations(query, accessPath);
      
      if (registryResults.length > 0) {
        console.log(`🔍 Registry search found ${registryResults.length} results for "${query}"`);
        return registryResults.map(result => this.registry.toLegacyNode(result));
      }

      // Fallback to legacy search
      console.log(`🔄 Registry search empty, falling back to legacy search for "${query}"`);
      const legacyResults = await this.legacyService.searchLocations(query);
      
      // Register search results for future searches
      legacyResults.forEach(result => {
        const registryNode = this.registry.fromLegacyNode(result, accessPath);
        this.registry.registerLocation(registryNode, accessPath);
      });
      
      if (legacyResults.length > 0) {
        console.log(`📝 Registered ${legacyResults.length} search results in registry`);
      }
      
      return legacyResults;
    } catch (error) {
      console.error(`❌ Error searching for "${query}":`, error);
      return await this.legacyService.searchLocations(query);
    }
  }

  /**
   * Check if location is loaded in other tree branches
   */
  isLoadedInOtherPaths(locationId: string, currentPath: string): boolean {
    return this.registry.isLoadedInOtherPaths(locationId, currentPath);
  }

  /**
   * Get alternative access paths for UI indicators
   */
  getAlternativeAccessPaths(locationId: string, excludePath?: string): string[] {
    return this.registry.getAlternativeAccessPaths(locationId, excludePath);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      registry: this.registry.getStats(),
      cache: this.registry.getCacheStats(),
      summary: this.generatePerformanceSummary()
    };
  }

  /**
   * Clear all registry data (useful for testing)
   */
  async clearRegistryCache(): Promise<void> {
    await this.registry.clearAll();
    console.log('🗑️ Registry cache cleared');
  }

  /**
   * Migrate location from legacy to registry format
   */
  migrateLocationToRegistry(location: DynamicLocationNode, accessPath: string): void {
    const registryNode = this.registry.fromLegacyNode(location, accessPath);
    this.registry.registerLocation(registryNode, accessPath);
  }

  /**
   * Batch migrate multiple locations
   */
  batchMigrateToRegistry(locations: DynamicLocationNode[], accessPath: string): void {
    locations.forEach(location => {
      this.migrateLocationToRegistry(location, accessPath);
    });
    
    console.log(`📦 Batch migrated ${locations.length} locations to registry via ${accessPath}`);
  }

  /**
   * Pre-warm registry with commonly accessed locations
   */
  async preWarmRegistry(locationIds: string[], accessPath: string = 'prewarm'): Promise<void> {
    console.log(`🔥 Pre-warming registry with ${locationIds.length} locations...`);
    
    const promises = locationIds.map(async (locationId) => {
      try {
        await this.getLocation(locationId, accessPath);
      } catch (error) {
        console.warn(`⚠️ Failed to pre-warm ${locationId}:`, error);
      }
    });
    
    await Promise.all(promises);
    console.log(`✅ Registry pre-warming complete`);
  }

  private generatePerformanceSummary() {
    const registryStats = this.registry.getStats();
    const cacheStats = this.registry.getCacheStats();
    
    return {
      efficiency: {
        cacheHitRate: `${registryStats.cacheHitRate}%`,
        crossBranchSharing: `${cacheStats.sharePercentage}% of locations shared`,
        memoryUsage: `${cacheStats.memoryUsageMB}MB`,
        loadingEfficiency: cacheStats.loadingStats.efficiency
      },
      performance: {
        totalLocations: registryStats.totalLocations,
        avgLoadTime: `${registryStats.avgLoadTime}ms`,
        activeLoads: registryStats.activeLoads,
        totalShares: cacheStats.totalShares
      },
      recommendation: this.getPerformanceRecommendation(registryStats, cacheStats)
    };
  }

  private getPerformanceRecommendation(_registryStats: any, cacheStats: any): string {
    if (cacheStats.sharePercentage > 50) {
      return '🚀 Excellent: High cache sharing across tree branches';
    } else if (cacheStats.sharePercentage > 25) {
      return '👍 Good: Moderate cache sharing, room for improvement';
    } else {
      return '🔧 Consider pre-warming frequently accessed locations';
    }
  }
}

// Export singleton instance
export const registryIntegration = new RegistryIntegrationService();

// Global debug functions for browser console
if (typeof window !== 'undefined') {
  (window as any).registryDebug = {
    getStats: () => registryIntegration.getPerformanceStats(),
    clearCache: () => registryIntegration.clearRegistryCache(),
    isLoadedElsewhere: (locationId: string, path: string) => 
      registryIntegration.isLoadedInOtherPaths(locationId, path),
    getAltPaths: (locationId: string) => 
      registryIntegration.getAlternativeAccessPaths(locationId),
    preWarm: (locationIds: string[]) => 
      registryIntegration.preWarmRegistry(locationIds)
  };
  
  console.log('🧪 Registry debug functions available at window.registryDebug');
}
