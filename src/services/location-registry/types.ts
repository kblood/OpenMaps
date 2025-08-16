// Location Registry Types - Enhanced for Graph-Based System

export interface LocationRegistryNode {
  id: string;
  name: string;
  level: 'world' | 'continent' | 'country' | 'state' | 'region' | 'city' | 'district' | 'custom';
  parentId?: string;
  hasChildren: boolean;
  childrenLoaded: boolean;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
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
  
  // New registry-specific fields
  accessPaths: Set<string>;
  loadedVia: string[]; // Track which tree paths loaded this node
  cacheSharedCount: number; // How many times cache was shared
}

export interface LocationRegistry {
  // Global location storage
  locations: Map<string, LocationRegistryNode>;
  
  // Relationship maps for efficient navigation
  parentToChildren: Map<string, Set<string>>;
  childToParents: Map<string, Set<string>>;
  
  // Loading and cache state
  loadingStates: Map<string, LoadingState>;
  cacheMetadata: Map<string, CacheMetadata>;
  
  // Search and access tracking
  accessPaths: Map<string, AccessPath[]>;
  searchIndex: Map<string, string[]>;
  
  // Performance tracking
  stats: RegistryStats;
}

export interface LoadingState {
  promise: Promise<LocationRegistryNode[]>;
  accessPaths: Set<string>;
  startTime: number;
  priority: LoadingPriority;
  parentId: string;
}

export enum LoadingPriority {
  USER_INITIATED = 1,
  EXPANSION = 2,
  SEARCH_RESULT = 3,
  PREFETCH = 4,
  BACKGROUND = 5
}

export interface CacheMetadata {
  locationId: string;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  sharedBetweenPaths: string[];
  size: number; // Memory size in bytes
}

export interface AccessPath {
  path: string;
  viewId: string;
  timestamp: number;
  loadTime: number;
}

export interface RegistryStats {
  totalLocations: number;
  totalRelationships: number;
  cacheHitRate: number;
  activeLoads: number;
  crossBranchShares: number;
  memoryUsageMB: number;
  avgLoadTime: number;
  lastUpdate: number;
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
}

export interface LocationFilter {
  minPopulation?: number;
  maxPopulation?: number;
  levels?: string[];
  countries?: string[];
  isCapital?: boolean;
  hasDownload?: boolean;
  tags?: string[];
}

export enum SortStrategy {
  ALPHABETICAL = 'alphabetical',
  POPULATION_DESC = 'population_desc',
  POPULATION_ASC = 'population_asc',
  SIZE_DESC = 'size_desc',
  GEOGRAPHICAL = 'geographical',
  RECENT_ACCESS = 'recent_access',
  DOWNLOAD_STATUS = 'download_status'
}

export interface VirtualTreeView {
  id: string;
  config: TreeViewConfig;
  rootId: string;
  expandedNodes: Set<string>;
  visiblePaths: TreePath[];
  lastUpdate: number;
}

export interface TreePath {
  locationIds: string[];
  depth: number;
  isComplete: boolean;
}

export interface SearchResult {
  location: LocationRegistryNode;
  expansionPath: string[];
  isAlreadyLoaded: boolean;
  estimatedLoadTime: number;
  accessibleVia: string[]; // Which tree views can access this
  cacheStatus: 'hit' | 'partial' | 'miss';
}

// Legacy compatibility - gradually migrate from this
export interface DynamicLocationNode extends Omit<LocationRegistryNode, 'accessPaths' | 'loadedVia' | 'cacheSharedCount'> {
  childrenIds: string[];
}
