// Advanced Hierarchical Map Pack System
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface HierarchicalMapPack {
  id: string;
  name: string;
  description: string;
  level: 'country' | 'region' | 'city' | 'custom';
  parentId?: string; // Reference to parent pack
  bounds: MapBounds;
  zoom: {
    min: number;
    max: number;
  };
  children?: string[]; // Child pack IDs
  estimatedTiles: number;
  estimatedSizeMB: number;
  isDownloaded: boolean;
  downloadProgress?: number;
  priority: number; // 1-5, higher = more important
  tags: string[]; // ['urban', 'tourist', 'business', etc.]
  createdBy: 'system' | 'user';
  createdAt: number;
}

export interface VisitedArea {
  id: string;
  center: { lat: number; lng: number };
  radius: number; // meters
  visitCount: number;
  lastVisited: number;
  autoCache: boolean;
}

export interface TileReference {
  url: string;
  packIds: string[]; // Which packs reference this tile
  visitedAreas: string[]; // Which visited areas include this tile
  downloadedAt: number;
  lastAccessed: number;
  accessCount: number;
}

export class AdvancedOfflineMapSystem {
  private dbName = 'openmaps_advanced';
  private dbVersion = 2;
  private db: IDBDatabase | null = null;
  private visitedAreas: Map<string, VisitedArea> = new Map();
  private downloadCallbacks: Map<string, (progress: number) => void> = new Map();

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadVisitedAreas();
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Tiles store with tile deduplication
        if (!db.objectStoreNames.contains('tiles')) {
          const tileStore = db.createObjectStore('tiles', { keyPath: 'url' });
          tileStore.createIndex('packIds', 'packIds', { unique: false, multiEntry: true });
          tileStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
        
        // Hierarchical packs store
        if (!db.objectStoreNames.contains('hierarchicalPacks')) {
          const packStore = db.createObjectStore('hierarchicalPacks', { keyPath: 'id' });
          packStore.createIndex('level', 'level', { unique: false });
          packStore.createIndex('parentId', 'parentId', { unique: false });
          packStore.createIndex('createdBy', 'createdBy', { unique: false });
        }
        
        // Visited areas store
        if (!db.objectStoreNames.contains('visitedAreas')) {
          const visitedStore = db.createObjectStore('visitedAreas', { keyPath: 'id' });
          visitedStore.createIndex('lastVisited', 'lastVisited', { unique: false });
          visitedStore.createIndex('visitCount', 'visitCount', { unique: false });
        }
        
        // Tile references for deduplication
        if (!db.objectStoreNames.contains('tileReferences')) {
          const refStore = db.createObjectStore('tileReferences', { keyPath: 'url' });
          refStore.createIndex('packIds', 'packIds', { unique: false, multiEntry: true });
        }
      };
    });
  }

  // VISITED AREAS SYSTEM
  async trackVisit(lat: number, lng: number, zoomLevel: number): Promise<void> {
    const areaId = this.getAreaId(lat, lng, zoomLevel);
    const existing = this.visitedAreas.get(areaId) || await this.getVisitedArea(areaId);
    
    const area: VisitedArea = existing || {
      id: areaId,
      center: { lat, lng },
      radius: this.getRadiusForZoom(zoomLevel),
      visitCount: 0,
      lastVisited: 0,
      autoCache: true
    };
    
    area.visitCount++;
    area.lastVisited = Date.now();
    
    this.visitedAreas.set(areaId, area);
    await this.saveVisitedArea(area);
    
    // Auto-cache if visited multiple times
    if (area.visitCount >= 3 && area.autoCache) {
      this.autoCacheVisitedArea(area);
    }
  }

  private async autoCacheVisitedArea(area: VisitedArea): Promise<void> {
    console.log(`Auto-caching visited area: ${area.center.lat}, ${area.center.lng}`);
    
    // Create a small custom pack for this visited area
    const pack: HierarchicalMapPack = {
      id: `visited_${area.id}`,
      name: `Visited Area (${area.center.lat.toFixed(3)}, ${area.center.lng.toFixed(3)})`,
      description: `Auto-cached area visited ${area.visitCount} times`,
      level: 'custom',
      bounds: this.radiusToBounds(area.center.lat, area.center.lng, area.radius),
      zoom: { min: 12, max: 16 },
      estimatedTiles: 100,
      estimatedSizeMB: 5,
      isDownloaded: false,
      priority: Math.min(area.visitCount, 5),
      tags: ['visited', 'auto'],
      createdBy: 'system',
      createdAt: Date.now()
    };
    
    await this.downloadPack(pack.id, pack);
  }

  // HIERARCHICAL PACK MANAGEMENT
  async createCustomPack(
    name: string,
    bounds: MapBounds,
    zoomRange: { min: number; max: number },
    options: {
      description?: string;
      tags?: string[];
      priority?: number;
    } = {}
  ): Promise<HierarchicalMapPack> {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const estimatedTiles = this.estimateTiles(bounds, zoomRange);
    
    const pack: HierarchicalMapPack = {
      id,
      name,
      description: options.description || `Custom map pack: ${name}`,
      level: 'custom',
      bounds,
      zoom: zoomRange,
      estimatedTiles,
      estimatedSizeMB: Math.round(estimatedTiles * 0.02), // ~20KB per tile average
      isDownloaded: false,
      priority: options.priority || 3,
      tags: options.tags || ['custom'],
      createdBy: 'user',
      createdAt: Date.now()
    };
    
    await this.savePack(pack);
    return pack;
  }

  async downloadPack(packId: string, pack?: HierarchicalMapPack, onProgress?: (progress: number) => void): Promise<void> {
    if (!pack) {
      const foundPack = await this.getPack(packId);
      if (!foundPack) throw new Error(`Pack ${packId} not found`);
      pack = foundPack;
    }
    
    if (onProgress) {
      this.downloadCallbacks.set(packId, onProgress);
    }
    
    const tiles = this.generateTileUrls(pack);
    let downloaded = 0;
    let skipped = 0;
    
    console.log(`Downloading pack: ${pack.name} (${tiles.length} tiles)`);
    
    // Batch processing for speed
    const batchSize = 15; // Increased batch size
    const batches = [];
    
    for (let i = 0; i < tiles.length; i += batchSize) {
      batches.push(tiles.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      const promises = batch.map(async (tileUrl) => {
        try {
          // Check if tile already exists from another pack
          const existing = await this.getTileReference(tileUrl);
          if (existing) {
            // Just add this pack to the reference
            if (!existing.packIds.includes(packId)) {
              existing.packIds.push(packId);
              existing.lastAccessed = Date.now();
              existing.accessCount++;
              await this.saveTileReference(existing);
            }
            skipped++;
            return true;
          }
          
          const response = await fetch(tileUrl);
          if (response.ok) {
            const blob = await response.blob();
            await this.cacheTile(tileUrl, blob, [packId]);
            downloaded++;
            return true;
          }
          return false;
        } catch (error) {
          console.warn(`Failed to download tile: ${tileUrl}`, error);
          return false;
        }
      });
      
      await Promise.all(promises);
      
      const progress = ((downloaded + skipped) / tiles.length) * 100;
      if (onProgress) onProgress(progress);
      console.log(`Pack ${pack.name}: ${progress.toFixed(1)}% (${downloaded} new, ${skipped} reused)`);
    }
    
    // Mark pack as downloaded
    pack.isDownloaded = true;
    pack.downloadProgress = 100;
    await this.savePack(pack);
    
    this.downloadCallbacks.delete(packId);
    console.log(`Pack ${pack.name} complete! Downloaded: ${downloaded}, Reused: ${skipped}`);
  }

  // SMART TILE DEDUPLICATION
  async cacheTile(url: string, blob: Blob, packIds: string[] = [], visitedAreaIds: string[] = []): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['tiles', 'tileReferences'], 'readwrite');
    
    // Store the actual tile data
    const tileData = {
      url,
      blob,
      downloadedAt: Date.now(),
      size: blob.size
    };
    
    await transaction.objectStore('tiles').put(tileData);
    
    // Store the reference with pack associations
    const reference: TileReference = {
      url,
      packIds: [...packIds],
      visitedAreas: [...visitedAreaIds],
      downloadedAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1
    };
    
    await transaction.objectStore('tileReferences').put(reference);
  }

  async getTileReference(url: string): Promise<TileReference | null> {
    if (!this.db) return null;
    
    const transaction = this.db.transaction(['tileReferences'], 'readonly');
    const store = transaction.objectStore('tileReferences');
    
    return new Promise((resolve) => {
      const request = store.get(url);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async saveTileReference(reference: TileReference): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['tileReferences'], 'readwrite');
    await transaction.objectStore('tileReferences').put(reference);
  }

  // UTILITY METHODS
  private estimateTiles(bounds: MapBounds, zoomRange: { min: number; max: number }): number {
    let total = 0;
    for (let zoom = zoomRange.min; zoom <= zoomRange.max; zoom++) {
      const minTileX = Math.floor((bounds.west + 180) / 360 * Math.pow(2, zoom));
      const maxTileX = Math.floor((bounds.east + 180) / 360 * Math.pow(2, zoom));
      const minTileY = Math.floor((1 - Math.log(Math.tan(bounds.north * Math.PI / 180) + 1 / Math.cos(bounds.north * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
      const maxTileY = Math.floor((1 - Math.log(Math.tan(bounds.south * Math.PI / 180) + 1 / Math.cos(bounds.south * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
      
      total += (maxTileX - minTileX + 1) * (maxTileY - minTileY + 1);
    }
    return total;
  }

  private generateTileUrls(pack: HierarchicalMapPack): string[] {
    const urls: string[] = [];
    const templateUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const subdomains = ['a', 'b', 'c'];
    
    for (let zoom = pack.zoom.min; zoom <= pack.zoom.max; zoom++) {
      const minTileX = Math.floor((pack.bounds.west + 180) / 360 * Math.pow(2, zoom));
      const maxTileX = Math.floor((pack.bounds.east + 180) / 360 * Math.pow(2, zoom));
      const minTileY = Math.floor((1 - Math.log(Math.tan(pack.bounds.north * Math.PI / 180) + 1 / Math.cos(pack.bounds.north * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
      const maxTileY = Math.floor((1 - Math.log(Math.tan(pack.bounds.south * Math.PI / 180) + 1 / Math.cos(pack.bounds.south * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
      
      for (let x = minTileX; x <= maxTileX; x++) {
        for (let y = minTileY; y <= maxTileY; y++) {
          const subdomain = subdomains[Math.floor(Math.random() * subdomains.length)];
          const url = templateUrl
            .replace('{z}', zoom.toString())
            .replace('{x}', x.toString())
            .replace('{y}', y.toString())
            .replace('{s}', subdomain);
          
          urls.push(url);
        }
      }
    }
    
    return urls;
  }

  private getAreaId(lat: number, lng: number, zoom: number): string {
    // Create area ID based on rounded coordinates and zoom
    const precision = Math.max(3 - Math.floor(zoom / 5), 1);
    const roundedLat = parseFloat(lat.toFixed(precision));
    const roundedLng = parseFloat(lng.toFixed(precision));
    return `${roundedLat}_${roundedLng}_${zoom}`;
  }

  private getRadiusForZoom(zoom: number): number {
    // Smaller radius for higher zoom levels
    return Math.max(500, 5000 - (zoom * 200));
  }

  private radiusToBounds(lat: number, lng: number, radiusMeters: number): MapBounds {
    const kmRadius = radiusMeters / 1000;
    const latDelta = kmRadius / 111; // Rough conversion
    const lngDelta = kmRadius / (111 * Math.cos(lat * Math.PI / 180));
    
    return {
      north: lat + latDelta,
      south: lat - latDelta,
      east: lng + lngDelta,
      west: lng - lngDelta
    };
  }

  // DATABASE OPERATIONS
  async savePack(pack: HierarchicalMapPack): Promise<void> {
    if (!this.db) return;
    const transaction = this.db.transaction(['hierarchicalPacks'], 'readwrite');
    await transaction.objectStore('hierarchicalPacks').put(pack);
  }

  async getPack(id: string): Promise<HierarchicalMapPack | null> {
    if (!this.db) return null;
    const transaction = this.db.transaction(['hierarchicalPacks'], 'readonly');
    return new Promise((resolve) => {
      const request = transaction.objectStore('hierarchicalPacks').get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async getAllPacks(): Promise<HierarchicalMapPack[]> {
    if (!this.db) return [];
    const transaction = this.db.transaction(['hierarchicalPacks'], 'readonly');
    return new Promise((resolve) => {
      const request = transaction.objectStore('hierarchicalPacks').getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  async saveVisitedArea(area: VisitedArea): Promise<void> {
    if (!this.db) return;
    const transaction = this.db.transaction(['visitedAreas'], 'readwrite');
    await transaction.objectStore('visitedAreas').put(area);
  }

  async getVisitedArea(id: string): Promise<VisitedArea | null> {
    if (!this.db) return null;
    const transaction = this.db.transaction(['visitedAreas'], 'readonly');
    return new Promise((resolve) => {
      const request = transaction.objectStore('visitedAreas').get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async loadVisitedAreas(): Promise<void> {
    if (!this.db) return;
    const transaction = this.db.transaction(['visitedAreas'], 'readonly');
    const request = transaction.objectStore('visitedAreas').getAll();
    
    request.onsuccess = () => {
      const areas = request.result as VisitedArea[];
      this.visitedAreas.clear();
      areas.forEach(area => this.visitedAreas.set(area.id, area));
      console.log(`Loaded ${areas.length} visited areas`);
    };
  }

  async getCacheStats(): Promise<{
    totalSize: number;
    tileCount: number;
    packCount: number;
    visitedAreaCount: number;
    duplicatesSaved: number;
  }> {
    if (!this.db) return { totalSize: 0, tileCount: 0, packCount: 0, visitedAreaCount: 0, duplicatesSaved: 0 };
    
    const transaction = this.db.transaction(['tiles', 'hierarchicalPacks', 'visitedAreas', 'tileReferences'], 'readonly');
    
    const [tiles, packs, areas, refs] = await Promise.all([
      this.getAllFromStore(transaction.objectStore('tiles')),
      this.getAllFromStore(transaction.objectStore('hierarchicalPacks')),
      this.getAllFromStore(transaction.objectStore('visitedAreas')),
      this.getAllFromStore(transaction.objectStore('tileReferences'))
    ]);
    
    const totalSize = tiles.reduce((sum: number, tile: any) => sum + tile.size, 0);
    const duplicatesSaved = refs.reduce((sum: number, ref: TileReference) => sum + Math.max(0, ref.packIds.length - 1), 0);
    
    return {
      totalSize,
      tileCount: tiles.length,
      packCount: packs.length,
      visitedAreaCount: areas.length,
      duplicatesSaved
    };
  }

  private getAllFromStore(store: IDBObjectStore): Promise<any[]> {
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }
}

// Predefined hierarchical packs
export const HIERARCHICAL_PACKS: HierarchicalMapPack[] = [
  // Countries
  {
    id: 'uk',
    name: 'United Kingdom',
    description: 'Complete UK coverage',
    level: 'country',
    bounds: { north: 60.8, south: 49.9, east: 1.8, west: -8.2 },
    zoom: { min: 6, max: 12 },
    children: ['england', 'scotland', 'wales', 'northern_ireland'],
    estimatedTiles: 50000,
    estimatedSizeMB: 1000,
    isDownloaded: false,
    priority: 4,
    tags: ['country', 'europe'],
    createdBy: 'system',
    createdAt: Date.now()
  },
  
  // Regions
  {
    id: 'england',
    name: 'England',
    description: 'England detailed maps',
    level: 'region',
    parentId: 'uk',
    bounds: { north: 55.8, south: 49.9, east: 1.8, west: -6.4 },
    zoom: { min: 8, max: 14 },
    children: ['london', 'manchester', 'birmingham'],
    estimatedTiles: 30000,
    estimatedSizeMB: 600,
    isDownloaded: false,
    priority: 4,
    tags: ['region', 'england'],
    createdBy: 'system',
    createdAt: Date.now()
  },
  
  // Cities
  {
    id: 'london',
    name: 'London',
    description: 'Greater London area',
    level: 'city',
    parentId: 'england',
    bounds: { north: 51.7, south: 51.3, east: 0.3, west: -0.5 },
    zoom: { min: 10, max: 16 },
    estimatedTiles: 8000,
    estimatedSizeMB: 160,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'tourist'],
    createdBy: 'system',
    createdAt: Date.now()
  }
];

// Singleton instance
export const advancedOfflineMapSystem = new AdvancedOfflineMapSystem();
