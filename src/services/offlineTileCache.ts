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
  url: string;
  blob: Blob;
  timestamp: number;
  expires: number;
}

export class OfflineTileCache {
  private dbName = 'openmaps_tiles';
  private dbVersion = 1;
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
        
        // Create tile cache store
        if (!db.objectStoreNames.contains('tiles')) {
          const tileStore = db.createObjectStore('tiles', { keyPath: 'url' });
          tileStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        // Create regions store
        if (!db.objectStoreNames.contains('regions')) {
          db.createObjectStore('regions', { keyPath: 'id' });
        }
      };
    });
  }

  async cacheTile(url: string, blob: Blob, expiresInDays: number = 30): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['tiles'], 'readwrite');
    const store = transaction.objectStore('tiles');
    
    const cachedTile: CachedTile = {
      url,
      blob,
      timestamp: Date.now(),
      expires: Date.now() + (expiresInDays * 24 * 60 * 60 * 1000)
    };
    
    await store.put(cachedTile);
  }

  async getCachedTile(url: string): Promise<Blob | null> {
    if (!this.db) return null;
    
    const transaction = this.db.transaction(['tiles'], 'readonly');
    const store = transaction.objectStore('tiles');
    
    return new Promise((resolve) => {
      const request = store.get(url);
      
      request.onsuccess = () => {
        const result = request.result as CachedTile;
        
        if (result && result.expires > Date.now()) {
          resolve(result.blob);
        } else {
          // Tile expired, remove it
          if (result) {
            this.removeCachedTile(url);
          }
          resolve(null);
        }
      };
      
      request.onerror = () => resolve(null);
    });
  }

  async removeCachedTile(url: string): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['tiles'], 'readwrite');
    const store = transaction.objectStore('tiles');
    await store.delete(url);
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
          // Check if tile already exists
          const existing = await this.getCachedTile(tileUrl);
          if (existing) {
            return true; // Skip already cached tiles
          }
          
          const response = await fetch(tileUrl);
          if (response.ok) {
            const blob = await response.blob();
            await this.cacheTile(tileUrl, blob);
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
        const tiles = request.result as CachedTile[];
        const totalSize = tiles.reduce((sum, tile) => sum + tile.blob.size, 0);
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
    zoom: { min: 10, max: 16 },
    estimatedTiles: 15000,
    estimatedSizeMB: 150,
    isDownloaded: false
  },
  {
    id: 'london',
    name: 'London',
    bounds: { north: 51.6723, south: 51.2867, east: 0.3340, west: -0.5103 },
    zoom: { min: 10, max: 16 },
    estimatedTiles: 12000,
    estimatedSizeMB: 120,
    isDownloaded: false
  },
  {
    id: 'paris',
    name: 'Paris',
    bounds: { north: 49.0073, south: 48.8155, east: 2.4699, west: 2.2249 },
    zoom: { min: 10, max: 16 },
    estimatedTiles: 8000,
    estimatedSizeMB: 80,
    isDownloaded: false
  }
];

// Singleton instance
export const offlineTileCache = new OfflineTileCache();
