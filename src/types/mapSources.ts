// Enhanced map source configuration types

export interface MapSourceConfig {
  id: string;
  name: string;
  type: 'raster-tiles' | 'vector-tiles' | 'mbtiles' | 'local-files';
  provider: 'geofabrik' | 'bbbike' | 'osmand' | 'custom' | 'tile-server' | 'proxy';
  
  // Source-specific configuration
  url?: string;           // For tile servers
  localPath?: string;     // For MBTiles/local files
  region?: string;        // For regional extracts
  bounds?: [number, number, number, number]; // [west, south, east, north]
  
  // Display properties
  maxZoom: number;
  minZoom?: number;
  attribution: string;
  description?: string;
  thumbnail?: string;
  
  // Management
  size?: number;          // File size in bytes
  lastUpdated?: Date;
  updateFrequency?: 'daily' | 'weekly' | 'manual';
  isActive: boolean;
  priority: number;       // For fallback ordering
}

export interface RegionalMapPack {
  id: string;
  name: string;
  region: string;
  country: string;
  
  // Available downloads
  sources: {
    vectorTiles?: {
      url: string;
      size: number;
      format: 'mbtiles' | 'pmtiles';
      includesRouting: boolean;
    };
    rasterTiles?: {
      url: string; 
      size: number;
      format: 'mbtiles';
      maxZoom: number;
    };
    osmData?: {
      url: string;
      size: number;
      format: 'pbf';
      lastUpdated: Date;
    };
  };
  
  // Metadata
  bounds: [number, number, number, number];
  provider: 'geofabrik' | 'bbbike' | 'openstreetmap';
  license: string;
  lastUpdated: Date;
}

export interface MapSourcePreferences {
  // User preference modes
  mode: 'beginner' | 'advanced';
  performanceProfile: 'performance' | 'quality' | 'size' | 'offline-first';
  
  // Source priorities
  preferredTypes: Array<'mbtiles' | 'vector-tiles' | 'raster-tiles'>;
  fallbackChain: string[]; // Source IDs in order of preference
  
  // Behavior settings
  autoUpdate: boolean;
  maxCacheSize: number;    // MB
  allowOnlineFallback: boolean;
  enableProxyForTiles: boolean;
}

export interface MapSourceStatus {
  sourceId: string;
  status: 'available' | 'downloading' | 'failed' | 'unavailable';
  progress?: number;       // For downloads 0-100
  error?: string;
  lastCheck: Date;
  size?: number;          // Actual file size
}

// For the flexible map source manager
export interface MapSourceManager {
  // Current active sources
  getActiveSources(): MapSourceConfig[];
  
  // Source management
  addSource(config: MapSourceConfig): Promise<boolean>;
  removeSource(sourceId: string): Promise<boolean>;
  updateSource(sourceId: string, config: Partial<MapSourceConfig>): Promise<boolean>;
  
  // Regional pack discovery
  getAvailableRegionalPacks(country?: string): Promise<RegionalMapPack[]>;
  downloadRegionalPack(packId: string, sourceType: keyof RegionalMapPack['sources']): Promise<boolean>;
  
  // Tile resolution with fallback chain
  getTileUrl(z: number, x: number, y: number): Promise<string>;
  
  // User preferences
  getUserPreferences(): MapSourcePreferences;
  setUserPreferences(prefs: Partial<MapSourcePreferences>): void;
  
  // Status monitoring
  getSourceStatuses(): MapSourceStatus[];
  onSourceStatusChange(callback: (status: MapSourceStatus) => void): void;
}