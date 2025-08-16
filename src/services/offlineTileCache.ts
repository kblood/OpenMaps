// Offline Map Tile Cache System
import { MapPackLayer } from '../config/mapPacks';

export interface OfflineMapRegion {
  id: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoom: {
    min: number;
    max: number;
  };
  estimatedTiles: number;
  estimatedSizeMB: number;
  downloadProgress?: number;
  isDownloaded: boolean;
}

export interface CachedTile {
  x: number;
  y: number;
  z: number;
  layerId: string;
  data: Blob;
  downloaded: boolean;
  nodeIds: string[];
  customPackIds: string[];
  downloadedAt: number;
  lastAccessed: number;
  accessCount: number;
  expires: number;
  priority: number;
}

export class OfflineTileCache {
  private dbName = 'openmaps_global'; // Use same database as globalMapPackSystem
  private dbVersion = 3; // Match globalMapPackSystem version
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create tile cache store with same schema as globalMapPackSystem
        if (!db.objectStoreNames.contains('tiles')) {
          const tileStore = db.createObjectStore('tiles', { keyPath: ['x', 'y', 'z', 'layerId'] });
          tileStore.createIndex('nodeIds', 'nodeIds', { multiEntry: true });
          tileStore.createIndex('customPackIds', 'customPackIds', { multiEntry: true });
          tileStore.createIndex('priority', 'priority');
          tileStore.createIndex('lastAccessed', 'lastAccessed');
        }
        
        // Create regions store
        if (!db.objectStoreNames.contains('regions')) {
          db.createObjectStore('regions', { keyPath: 'id' });
        }

        // Create global nodes store if it doesn't exist
        if (!db.objectStoreNames.contains('globalNodes')) {
          const nodeStore = db.createObjectStore('globalNodes', { keyPath: 'id' });
          nodeStore.createIndex('level', 'level');
          nodeStore.createIndex('parentId', 'parentId');
          nodeStore.createIndex('isDownloaded', 'isDownloaded');
        }

        // Create custom packs store if it doesn't exist
        if (!db.objectStoreNames.contains('customPacks')) {
          const customStore = db.createObjectStore('customPacks', { keyPath: 'id' });
          customStore.createIndex('created', 'created');
          customStore.createIndex('isDownloaded', 'isDownloaded');
        }
      };
    });
  }

  async cacheTile(x: number, y: number, z: number, layerId: string, blob: Blob, expiresInDays: number = 30): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['tiles'], 'readwrite');
    const store = transaction.objectStore('tiles');
    
    const tileData = {
      x, y, z, layerId,
      data: blob,
      downloaded: true,
      nodeIds: [],
      customPackIds: [],
      downloadedAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      expires: Date.now() + (expiresInDays * 24 * 60 * 60 * 1000),
      priority: 15 - z // Higher zoom = higher priority
    };
    
    await store.put(tileData);
  }

  async getCachedTile(x: number, y: number, z: number, layerId: string = 'openstreetmap'): Promise<Blob | null> {
    if (!this.db) return null;
    
    const transaction = this.db.transaction(['tiles'], 'readonly');
    const store = transaction.objectStore('tiles');
    
    return new Promise((resolve) => {
      const request = store.get([x, y, z, layerId]);
      
      request.onsuccess = () => {
        const result = request.result;
        
        if (result && result.data && result.expires > Date.now()) {
          // Update access tracking
          result.lastAccessed = Date.now();
          result.accessCount = (result.accessCount || 0) + 1;
          
          // Save updated access info
          const updateTransaction = this.db!.transaction(['tiles'], 'readwrite');
          const updateStore = updateTransaction.objectStore('tiles');
          updateStore.put(result);
          
          resolve(result.data);
        } else {
          // Tile expired or not found, remove if expired
          if (result && result.expires <= Date.now()) {
            this.removeCachedTile(x, y, z, layerId);
          }
          resolve(null);
        }
      };
      
      request.onerror = () => resolve(null);
    });
  }

  async removeCachedTile(x: number, y: number, z: number, layerId: string = 'openstreetmap'): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['tiles'], 'readwrite');
    const store = transaction.objectStore('tiles');
    await store.delete([x, y, z, layerId]);
  }

  async downloadRegion(region: OfflineMapRegion, layer: MapPackLayer, onProgress?: (progress: number) => void): Promise<void> {
    const tiles = this.generateTileUrls(region, layer);
    let downloaded = 0;
    const failed: string[] = [];
    
    console.log(`Downloading ${tiles.length} tiles for region: ${region.name}`);
    
    // Parallel download with batches for better performance
    const batchSize = 10; // Download 10 tiles simultaneously
    const batches = [];
    
    for (let i = 0; i < tiles.length; i += batchSize) {
      batches.push(tiles.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      const promises = batch.map(async (tileUrl) => {
        try {
          // Parse coordinates from URL
          const urlParts = tileUrl.split('/');
          const z = parseInt(urlParts[urlParts.length - 3]);
          const x = parseInt(urlParts[urlParts.length - 2]);
          const y = parseInt(urlParts[urlParts.length - 1].split('.')[0]);
          
          // Check if tile already exists
          const existing = await this.getCachedTile(x, y, z, layer.id);
          if (existing) {
            return true; // Skip already cached tiles
          }
          
          const response = await fetch(tileUrl);
          if (response.ok) {
            const blob = await response.blob();
            await this.cacheTile(x, y, z, layer.id, blob);
            return true;
          } else {
            failed.push(tileUrl);
            return false;
          }
        } catch (error) {
          console.warn(`Failed to download tile: ${tileUrl}`, error);
          failed.push(tileUrl);
          return false;
        }
      });
      
      await Promise.all(promises);
      downloaded += batch.length;
      
      const progress = (downloaded / tiles.length) * 100;
      if (onProgress) onProgress(progress);
      console.log(`Download progress: ${progress.toFixed(1)}% (${downloaded}/${tiles.length})`);
    }
    
    if (failed.length > 0) {
      console.warn(`Failed to download ${failed.length} tiles`);
    }
    
    // Mark region as downloaded
    await this.saveRegion({ ...region, isDownloaded: true });
    console.log(`Region ${region.name} download complete! Failed: ${failed.length}`);
  }

  private generateTileUrls(region: OfflineMapRegion, layer: MapPackLayer): string[] {
    const urls: string[] = [];
    
    for (let zoom = region.zoom.min; zoom <= region.zoom.max; zoom++) {
      const minTileX = Math.floor((region.bounds.west + 180) / 360 * Math.pow(2, zoom));
      const maxTileX = Math.floor((region.bounds.east + 180) / 360 * Math.pow(2, zoom));
      const minTileY = Math.floor((1 - Math.log(Math.tan(region.bounds.north * Math.PI / 180) + 1 / Math.cos(region.bounds.north * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
      const maxTileY = Math.floor((1 - Math.log(Math.tan(region.bounds.south * Math.PI / 180) + 1 / Math.cos(region.bounds.south * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
      
      for (let x = minTileX; x <= maxTileX; x++) {
        for (let y = minTileY; y <= maxTileY; y++) {
          const url = layer.url
            .replace('{z}', zoom.toString())
            .replace('{x}', x.toString())
            .replace('{y}', y.toString())
            .replace('{s}', layer.subdomains ? layer.subdomains[Math.floor(Math.random() * layer.subdomains.length)] : 'a');
          
          urls.push(url);
        }
      }
    }
    
    return urls;
  }

  async saveRegion(region: OfflineMapRegion): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['regions'], 'readwrite');
    const store = transaction.objectStore('regions');
    await store.put(region);
  }

  async getRegions(): Promise<OfflineMapRegion[]> {
    if (!this.db) return [];
    
    const transaction = this.db.transaction(['regions'], 'readonly');
    const store = transaction.objectStore('regions');
    
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  }

  async getCacheSize(): Promise<number> {
    if (!this.db) return 0;
    
    const transaction = this.db.transaction(['tiles'], 'readonly');
    const store = transaction.objectStore('tiles');
    
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const tiles = request.result || [];
        const totalSize = tiles.reduce((sum: number, tile: any) => {
          if (tile.data instanceof Blob) {
            return sum + tile.data.size;
          }
          return sum;
        }, 0);
        resolve(totalSize);
      };
      request.onerror = () => resolve(0);
    });
  }

  async clearCache(): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['tiles', 'regions'], 'readwrite');
    await transaction.objectStore('tiles').clear();
    await transaction.objectStore('regions').clear();
  }
}

// Predefined regions for download
export const OFFLINE_REGIONS: OfflineMapRegion[] = [
  {
    id: 'nyc',
    name: 'New York City',
    bounds: { north: 40.9176, south: 40.4774, east: -73.7004, west: -74.2591 },
    zoom: { min: 10, max: 18 }, // Increased from 16 to 18
    estimatedTiles: 45000, // Updated estimate for higher zoom
    estimatedSizeMB: 450,
    isDownloaded: false
  },
  {
    id: 'london',
    name: 'London',
    bounds: { north: 51.6723, south: 51.2867, east: 0.3340, west: -0.5103 },
    zoom: { min: 10, max: 18 }, // Increased from 16 to 18
    estimatedTiles: 36000, // Updated estimate for higher zoom
    estimatedSizeMB: 360,
    isDownloaded: false
  },
  {
    id: 'paris',
    name: 'Paris',
    bounds: { north: 49.0073, south: 48.8155, east: 2.4699, west: 2.2249 },
    zoom: { min: 10, max: 18 }, // Increased from 16 to 18
    estimatedTiles: 24000, // Updated estimate for higher zoom
    estimatedSizeMB: 240,
    isDownloaded: false
  }
];

// Singleton instance
export const offlineTileCache = new OfflineTileCache();
