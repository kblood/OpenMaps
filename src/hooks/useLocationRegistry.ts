// Hook for using LocationRegistry with React components
// Provides easy integration with the graph-based location system

import { useState, useEffect, useCallback } from 'react';
import { DynamicLocationNode, dynamicLocationService } from '../services/dynamicLocationService';
import { 
  getLocationRegistry, 
  LocationRegistryService, 
  CacheStats,
  resetLocationRegistry 
} from '../services/locationRegistry';
import { 
  createSearchToExpandService, 
  SearchToExpandService, 
  SearchResult 
} from '../services/searchToExpandService';

interface UseLocationRegistryResult {
  registry: LocationRegistryService;
  searchService: SearchToExpandService;
  isInitialized: boolean;
  error: string | null;
  stats: CacheStats;
  // Core functions
  getLocation: (id: string) => Promise<DynamicLocationNode | null>;
  getChildren: (parentId: string, path?: string) => Promise<DynamicLocationNode[]>;
  searchLocations: (query: string, maxResults?: number) => Promise<DynamicLocationNode[]>;
  searchAndExpand: (query: string, viewId: string) => Promise<SearchResult[]>;
  // Cache management
  isLocationLoaded: (id: string) => boolean;
  isChildrenLoaded: (parentId: string) => boolean;
  isLoadedElsewhere: (id: string, currentPath: string) => boolean;
  getAlternativePaths: (id: string, currentPath: string) => string[];
  clearCache: () => void;
  refreshStats: () => void;
}

let globalRegistry: LocationRegistryService | null = null;
let globalSearchService: SearchToExpandService | null = null;

/**
 * Hook for using the LocationRegistry system
 * Provides React integration with the graph-based location system
 */
export const useLocationRegistry = (): UseLocationRegistryResult => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CacheStats>({
    hitRate: 0,
    activeLoads: 0,
    crossBranchShares: 0,
    memoryUsageMB: 0,
    totalLocations: 0,
    avgLoadTime: 0
  });

  // Initialize registry and search service
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('🔄 Initializing LocationRegistry hook...');
        
        // Initialize global registry if not already done
        if (!globalRegistry) {
          globalRegistry = getLocationRegistry(dynamicLocationService);
        }
        
        // Initialize search service
        if (!globalSearchService) {
          globalSearchService = createSearchToExpandService(globalRegistry);
        }
        
        // Load initial stats
        setStats(globalRegistry.getCacheStats());
        
        setIsInitialized(true);
        setError(null);
        
        console.log('✅ LocationRegistry hook initialized successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize LocationRegistry';
        console.error('❌ LocationRegistry hook initialization failed:', err);
        setError(errorMessage);
      }
    };

    initialize();
  }, []);

  // Refresh stats periodically
  useEffect(() => {
    if (!isInitialized || !globalRegistry) return;

    const interval = setInterval(() => {
      setStats(globalRegistry!.getCacheStats());
    }, 2000);

    return () => clearInterval(interval);
  }, [isInitialized]);

  // Core functions
  const getLocation = useCallback(async (id: string) => {
    if (!globalRegistry) return null;
    return globalRegistry.getLocation(id);
  }, []);

  const getChildren = useCallback(async (parentId: string, path?: string) => {
    if (!globalRegistry) return [];
    return globalRegistry.getChildren(parentId, path);
  }, []);

  const searchLocations = useCallback(async (query: string, maxResults = 20) => {
    if (!globalRegistry) return [];
    return globalRegistry.searchLocations(query, maxResults);
  }, []);

  const searchAndExpand = useCallback(async (query: string, viewId: string) => {
    if (!globalSearchService) return [];
    return globalSearchService.searchAndExpand(query, viewId, {
      maxResults: 15,
      preferCached: true,
      sortBy: 'relevance'
    });
  }, []);

  // Cache management functions
  const isLocationLoaded = useCallback((id: string) => {
    if (!globalRegistry) return false;
    return globalRegistry.isLocationLoaded(id);
  }, []);

  const isChildrenLoaded = useCallback((parentId: string) => {
    if (!globalRegistry) return false;
    return globalRegistry.isChildrenLoaded(parentId);
  }, []);

  const isLoadedElsewhere = useCallback((id: string, currentPath: string) => {
    if (!globalRegistry) return false;
    return globalRegistry.isLoadedElsewhere(id, currentPath);
  }, []);

  const getAlternativePaths = useCallback((id: string, currentPath: string) => {
    if (!globalRegistry) return [];
    return globalRegistry.getAlternativePaths(id, currentPath);
  }, []);

  const clearCache = useCallback(() => {
    if (globalRegistry) {
      globalRegistry.clearCache();
    }
    if (globalSearchService) {
      globalSearchService.clearCache();
    }
    setStats({
      hitRate: 0,
      activeLoads: 0,
      crossBranchShares: 0,
      memoryUsageMB: 0,
      totalLocations: 0,
      avgLoadTime: 0
    });
    console.log('🗑️ LocationRegistry cache cleared via hook');
  }, []);

  const refreshStats = useCallback(() => {
    if (globalRegistry) {
      setStats(globalRegistry.getCacheStats());
    }
  }, []);

  return {
    registry: globalRegistry!,
    searchService: globalSearchService!,
    isInitialized,
    error,
    stats,
    getLocation,
    getChildren,
    searchLocations,
    searchAndExpand,
    isLocationLoaded,
    isChildrenLoaded,
    isLoadedElsewhere,
    getAlternativePaths,
    clearCache,
    refreshStats
  };
};

/**
 * Reset the global registry (useful for testing)
 */
export const resetGlobalRegistry = () => {
  globalRegistry = null;
  globalSearchService = null;
  resetLocationRegistry();
  console.log('🔄 Global LocationRegistry reset');
};

/**
 * Get the global registry instance directly (for debugging)
 */
export const getGlobalRegistry = () => globalRegistry;

/**
 * Get performance stats without the hook
 */
export const getGlobalStats = () => globalRegistry?.getCacheStats() || null;