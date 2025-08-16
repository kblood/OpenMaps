// Core types for the improved graph-based location system

export interface LocationRegistry {
  // Global location storage
  locations: Map<string, DynamicLocationNode>;
  
  // Relationship maps
  parentToChildren: Map<string, Set<string>>;
  childToParents: Map<string, Set<string>>;
  
  // Loading and cache state
  loadingStates: Map<string, LoadingState>;
  cacheMetadata: Map<string, CacheMetadata>;
  
  // Search and access tracking
  accessPaths: Map<string, AccessPath[]>;
  searchIndex: Map<string, string[]>;
}

export interface VirtualTreeView {
  id: string;
  rootId: string;
  expandedNodes: Set<string>;
  visiblePaths: TreePath[];
  filterCriteria?: LocationFilter;
  sortStrategy?: SortStrategy;
  maxDepth?: number;
  allowMultiplePaths?: boolean;
}

export interface LoadingState {
  promise: Promise<DynamicLocationNode[]>;
  accessPaths: Set<string>;
  startTime: number;
  priority: LoadingPriority;
  retryCount: number;
}

export interface CacheMetadata {
  timestamp: number;
  accessCount: number;
  lastAccessTime: number;
  hitRate: number;
  crossBranchShares: number;
  source: string;
}

export interface AccessPath {
  viewId: string;
  path: string;
  timestamp: number;
  priority: LoadingPriority;
}

export interface TreePath {
  nodeIds: string[];
  depth: number;
  isExpanded: boolean;
  isVisible: boolean;
}

export interface LocationFilter {
  minPopulation?: number;
  maxPopulation?: number;
  levels?: DynamicLocationLevel[];
  countries?: string[];
  bounds?: GeoBounds;
  hasChildren?: boolean;
  isDownloaded?: boolean;
  searchTerm?: string;
}

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export enum LoadingPriority {
  USER_INITIATED = 1,
  EXPANSION = 2,
  PREFETCH = 3,
  BACKGROUND = 4
}

export enum SortStrategy {
  ALPHABETICAL = 'alphabetical',
  POPULATION_DESC = 'population_desc',
  POPULATION_ASC = 'population_asc',
  GEOGRAPHICAL = 'geographical',
  PRIORITY = 'priority',
  RECENT_ACCESS = 'recent_access'
}

export type DynamicLocationLevel = 'world' | 'continent' | 'country' | 'state' | 'region' | 'city' | 'district' | 'custom';

// Re-export from existing service for compatibility
export interface DynamicLocationNode {
  id: string;
  name: string;
  level: DynamicLocationLevel;
  parentId?: string;
  hasChildren: boolean;
  childrenLoaded: boolean;
  childrenIds: string[];
  bounds: GeoBounds;
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

export interface TreeViewConfig {
  id: string;
  name: string;
  rootLocationId: string;
  maxDepth?: number;
  filterCriteria?: LocationFilter;
  sortStrategy?: SortStrategy;
  enableSearch?: boolean;
  allowMultiplePaths?: boolean;
  cacheSharing?: boolean;
}

export interface SearchResult {
  location: DynamicLocationNode;
  expansionPath: string[];
  isAlreadyLoaded: boolean;
  estimatedLoadTime: number;
  relevanceScore: number;
  alternativePaths?: string[];
}

export interface CacheStats {
  hitRate: number;
  activeLoads: number;
  crossBranchShares: number;
  memoryUsageMB: number;
  totalLocations: number;
  cachedChildren: number;
  avgLoadTime: number;
}

export interface RegistryIntegrationOptions {
  enableCacheSharing: boolean;
  enableLoadDeduplication: boolean;
  enablePathTracking: boolean;
  enablePerformanceMetrics: boolean;
  enableSearchIntegration: boolean;
  cacheTTL: number;
  maxCacheSize: number;
}
