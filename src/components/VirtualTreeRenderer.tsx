// Virtual Tree Renderer for Graph-Based Location System
// Provides flexible tree views with shared cache and intelligent rendering

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './VirtualTreeRenderer.css';
import { DynamicLocationNode } from '../services/dynamicLocationService';
import { LocationRegistryService, LoadingPriority } from '../services/locationRegistry';

// Tree view configuration interface
export interface TreeViewConfig {
  id: string;
  name: string;
  rootLocationId: string;
  maxDepth?: number;
  filterCriteria?: LocationFilter;
  sortStrategy?: SortStrategy;
  enableSearch?: boolean;
  allowMultiplePaths?: boolean;
  showCacheIndicators?: boolean;
}

export interface LocationFilter {
  minPopulation?: number;
  maxPopulation?: number;
  levels?: string[];
  tags?: string[];
  countryCode?: string;
}

export type SortStrategy = 
  | 'geographical' 
  | 'population_desc' 
  | 'population_asc' 
  | 'alphabetical' 
  | 'recently_accessed'
  | 'cache_priority';

export interface VirtualTreeView {
  rootId: string;
  expandedNodes: Set<string>;
  visiblePaths: TreePath[];
  filterCriteria?: LocationFilter;
  lastUpdate: number;
}

export interface TreePath {
  locationId: string;
  path: string;
  level: number;
  isVisible: boolean;
  hasCache: boolean;
}

interface TreeNodeContext {
  location: DynamicLocationNode;
  path: string;
  level: number;
  isExpanded: boolean;
  hasChildren: boolean;
  isLoading: boolean;
  cacheInfo: NodeCacheInfo;
  alternativePaths: string[];
}

interface NodeCacheInfo {
  isLoadedElsewhere: boolean;
  hitCount: number;
  loadTime: number;
  accessPaths: string[];
}

// Props for the tree renderer
interface VirtualTreeRendererProps {
  config: TreeViewConfig;
  registry: LocationRegistryService;
  onLocationSelect?: (location: DynamicLocationNode, path: string) => void;
  onLocationDownload?: (location: DynamicLocationNode) => void;
  className?: string;
}

// Main Virtual Tree Renderer Component
export const VirtualTreeRenderer: React.FC<VirtualTreeRendererProps> = ({
  config,
  registry,
  onLocationSelect,
  onLocationDownload,
  className = ''
}) => {
  const [view, setView] = useState<VirtualTreeView>({
    rootId: config.rootLocationId,
    expandedNodes: new Set(),
    visiblePaths: [],
    filterCriteria: config.filterCriteria,
    lastUpdate: Date.now()
  });

  const [rootLocation, setRootLocation] = useState<DynamicLocationNode | null>(null);
  const [loading, setLoading] = useState(false);

  // Load root location
  useEffect(() => {
    const loadRoot = async () => {
      setLoading(true);
      try {
        const root = await registry.getLocation(config.rootLocationId);
        setRootLocation(root);
      } catch (error) {
        console.error(`Failed to load root location ${config.rootLocationId}:`, error);
      } finally {
        setLoading(false);
      }
    };

    loadRoot();
  }, [config.rootLocationId, registry]);

  // Handle node expansion with intelligent caching
  const handleExpansion = useCallback(async (nodeId: string, path: string) => {
    const accessPath = `${config.id}:${path}`;
    
    // Update expansion state immediately for responsive UI
    setView(prev => {
      const newExpanded = new Set(prev.expandedNodes);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      
      return {
        ...prev,
        expandedNodes: newExpanded,
        lastUpdate: Date.now()
      };
    });

    // Load children if expanding
    if (!view.expandedNodes.has(nodeId)) {
      try {
        console.log(`🌳 Expanding ${nodeId} via path: ${accessPath}`);
        await registry.getChildren(nodeId, accessPath);
        
        // Trigger re-render to show new children
        setView(prev => ({ ...prev, lastUpdate: Date.now() }));
      } catch (error) {
        console.error(`Failed to load children for ${nodeId}:`, error);
        // Revert expansion state on error
        setView(prev => {
          const revertedExpanded = new Set(prev.expandedNodes);
          revertedExpanded.delete(nodeId);
          return { ...prev, expandedNodes: revertedExpanded };
        });
      }
    }
  }, [config.id, registry, view.expandedNodes]);

  // Handle location selection
  const handleLocationSelect = useCallback((location: DynamicLocationNode, path: string) => {
    console.log(`📍 Selected ${location.name} via path: ${path}`);
    onLocationSelect?.(location, path);
  }, [onLocationSelect]);

  // Render loading state
  if (loading) {
    return (
      <div className={`tree-renderer loading ${className}`}>
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>Loading {config.name}...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (!rootLocation) {
    return (
      <div className={`tree-renderer error ${className}`}>
        <div className="error-message">
          ❌ Failed to load {config.name}
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`tree-renderer ${className}`}>
      <div className="tree-header">
        <h3>{config.name}</h3>
        {config.showCacheIndicators && (
          <CacheStatsIndicator registry={registry} viewId={config.id} />
        )}
      </div>
      
      <div className="tree-content">
        <SmartTreeNode
          location={rootLocation}
          path="root"
          level={0}
          config={config}
          view={view}
          registry={registry}
          onExpand={handleExpansion}
          onSelect={handleLocationSelect}
          onDownload={onLocationDownload}
        />
      </div>
    </div>
  );
};

// Smart Tree Node with Cache Awareness
interface SmartTreeNodeProps {
  location: DynamicLocationNode;
  path: string;
  level: number;
  config: TreeViewConfig;
  view: VirtualTreeView;
  registry: LocationRegistryService;
  onExpand: (nodeId: string, path: string) => void;
  onSelect: (location: DynamicLocationNode, path: string) => void;
  onDownload?: (location: DynamicLocationNode) => void;
}

const SmartTreeNode: React.FC<SmartTreeNodeProps> = ({
  location,
  path,
  level,
  config,
  view,
  registry,
  onExpand,
  onSelect,
  onDownload
}) => {
  const [children, setChildren] = useState<DynamicLocationNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isExpanded = view.expandedNodes.has(location.id);
  const hasReachedMaxDepth = config.maxDepth && level >= config.maxDepth;

  // Get cache information for this node
  const cacheInfo = useMemo(() => {
    const accessPath = `${config.id}:${path}`;
    const isLoadedElsewhere = registry.isLoadedElsewhere(location.id, accessPath);
    const alternativePaths = registry.getAlternativePaths(location.id, accessPath);
    const stats = registry.getCacheStats();
    
    return {
      isLoadedElsewhere,
      alternativePaths,
      hasChildrenCached: registry.isChildrenLoaded(location.id),
      cacheHitRate: stats.hitRate
    };
  }, [location.id, path, config.id, registry, view.lastUpdate]);

  // Load children when expanded
  useEffect(() => {
    if (isExpanded && location.hasChildren) {
      const loadChildren = async () => {
        if (cacheInfo.hasChildrenCached) {
          // Instant load from cache
          const cachedChildren = await registry.getChildren(location.id, `${config.id}:${path}`);
          setChildren(applySortAndFilter(cachedChildren, config));
          return;
        }

        setIsLoading(true);
        try {
          const loadedChildren = await registry.getChildren(location.id, `${config.id}:${path}`);
          setChildren(applySortAndFilter(loadedChildren, config));
        } catch (error) {
          console.error(`Failed to load children for ${location.name}:`, error);
        } finally {
          setIsLoading(false);
        }
      };

      loadChildren();
    } else {
      setChildren([]);
    }
  }, [isExpanded, location.id, location.hasChildren, path, config, registry, cacheInfo.hasChildrenCached]);

  // Handle expansion click
  const handleExpandClick = () => {
    if (location.hasChildren && !hasReachedMaxDepth) {
      onExpand(location.id, path);
    }
  };

  // Handle selection click
  const handleSelectClick = () => {
    onSelect(location, path);
  };

  return (
    <div className={`tree-node level-${level}`}>
      <div className="node-header">
        <div className="node-content">
          {/* Expansion toggle */}
          {location.hasChildren && !hasReachedMaxDepth && (
            <button 
              className={`expand-toggle ${isExpanded ? 'expanded' : ''}`}
              onClick={handleExpandClick}
              disabled={isLoading}
            >
              {isLoading ? '⏳' : isExpanded ? '▼' : '▶'}
            </button>
          )}
          
          {/* Location info */}
          <div className="location-info" onClick={handleSelectClick}>
            <span className="location-name">{location.name}</span>
            <span className="location-level">({location.level})</span>
            
            {location.population && (
              <span className="population">
                👥 {location.population.toLocaleString()}
              </span>
            )}
          </div>

          {/* Cache indicators */}
          {config.showCacheIndicators && (
            <CacheIndicators
              location={location}
              cacheInfo={cacheInfo}
              alternativePaths={cacheInfo.alternativePaths}
            />
          )}

          {/* Action buttons */}
          <div className="node-actions">
            {onDownload && (
              <button 
                className="download-btn"
                onClick={() => onDownload(location)}
                title={`Download ${location.name}`}
              >
                ⬇️
              </button>
            )}
          </div>
        </div>

        {/* Alternative paths indicator */}
        {cacheInfo.alternativePaths.length > 0 && (
          <div className="alternative-paths">
            <span className="paths-label">Also accessible via:</span>
            <span className="paths-list">
              {cacheInfo.alternativePaths.join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Children rendering */}
      {isExpanded && location.hasChildren && !hasReachedMaxDepth && (
        <div className="node-children">
          {isLoading && (
            <div className="children-loading">
              <span>Loading children...</span>
            </div>
          )}
          
          {children.map((child, index) => (
            <SmartTreeNode
              key={child.id}
              location={child}
              path={`${path}/${child.id}`}
              level={level + 1}
              config={config}
              view={view}
              registry={registry}
              onExpand={onExpand}
              onSelect={onSelect}
              onDownload={onDownload}
            />
          ))}
          
          {!isLoading && children.length === 0 && (
            <div className="no-children">
              No children found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Cache Indicators Component
interface CacheIndicatorsProps {
  location: DynamicLocationNode;
  cacheInfo: any;
  alternativePaths: string[];
}

const CacheIndicators: React.FC<CacheIndicatorsProps> = ({
  location,
  cacheInfo,
  alternativePaths
}) => {
  return (
    <div className="cache-indicators">
      {/* Cache hit indicator */}
      {cacheInfo.isLoadedElsewhere && (
        <span 
          className="cache-indicator loaded-elsewhere" 
          title="Data loaded from other tree branches"
        >
          🔗
        </span>
      )}
      
      {/* Children cache indicator */}
      {cacheInfo.hasChildrenCached && (
        <span 
          className="cache-indicator children-cached" 
          title="Children already cached"
        >
          💾
        </span>
      )}
      
      {/* Alternative paths count */}
      {alternativePaths.length > 0 && (
        <span 
          className="cache-indicator alt-paths" 
          title={`${alternativePaths.length} alternative access paths`}
        >
          🔀{alternativePaths.length}
        </span>
      )}
    </div>
  );
};

// Cache Stats Indicator
interface CacheStatsIndicatorProps {
  registry: LocationRegistryService;
  viewId: string;
}

const CacheStatsIndicator: React.FC<CacheStatsIndicatorProps> = ({ registry, viewId }) => {
  const [stats, setStats] = useState(registry.getCacheStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(registry.getCacheStats());
    }, 2000);

    return () => clearInterval(interval);
  }, [registry]);

  return (
    <div className="cache-stats-indicator">
      <div className="stats-grid">
        <div className="stat">
          <span className="label">Hit Rate:</span>
          <span className="value">{stats.hitRate}%</span>
        </div>
        <div className="stat">
          <span className="label">Active:</span>
          <span className="value">{stats.activeLoads}</span>
        </div>
        <div className="stat">
          <span className="label">Shared:</span>
          <span className="value">{stats.crossBranchShares}</span>
        </div>
        <div className="stat">
          <span className="label">Memory:</span>
          <span className="value">{stats.memoryUsageMB}MB</span>
        </div>
      </div>
    </div>
  );
};

// Utility function to apply sorting and filtering
function applySortAndFilter(locations: DynamicLocationNode[], config: TreeViewConfig): DynamicLocationNode[] {
  let filtered = locations;

  // Apply filters
  if (config.filterCriteria) {
    const filter = config.filterCriteria;
    
    filtered = filtered.filter(location => {
      if (filter.minPopulation && (!location.population || location.population < filter.minPopulation)) {
        return false;
      }
      if (filter.maxPopulation && location.population && location.population > filter.maxPopulation) {
        return false;
      }
      if (filter.levels && !filter.levels.includes(location.level)) {
        return false;
      }
      if (filter.countryCode && location.metadata.countryCode !== filter.countryCode) {
        return false;
      }
      return true;
    });
  }

  // Apply sorting
  const sortStrategy = config.sortStrategy || 'geographical';
  
  switch (sortStrategy) {
    case 'population_desc':
      return filtered.sort((a, b) => (b.population || 0) - (a.population || 0));
    
    case 'population_asc':
      return filtered.sort((a, b) => (a.population || 0) - (b.population || 0));
    
    case 'alphabetical':
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    
    case 'geographical':
    default:
      // Sort by priority (capitals first), then population, then name
      return filtered.sort((a, b) => {
        if (a.isCapital && !b.isCapital) return -1;
        if (!a.isCapital && b.isCapital) return 1;
        if ((a.population || 0) !== (b.population || 0)) {
          return (b.population || 0) - (a.population || 0);
        }
        return a.name.localeCompare(b.name);
      });
  }
}

export default VirtualTreeRenderer;