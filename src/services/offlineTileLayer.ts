// Offline Tile Layer - Serves tiles from IndexedDB when available
import L from 'leaflet';

export class OfflineTileLayer extends L.TileLayer {
  private offlineTileCache: Map<string, string> = new Map();
  private isOnline: boolean = navigator.onLine;
  private dbName = 'openmaps_global'; // Use same database as other systems
  private db: IDBDatabase | null = null;

  constructor(urlTemplate: string, options?: L.TileLayerOptions) {
    super(urlTemplate, options);
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('📶 Online mode - will fetch missing tiles from internet');
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📱 Offline mode - using only downloaded tiles');
    });

    // Initialize database immediately
    this.initializeDatabase().then(() => {
      console.log('✅ OfflineTileLayer database ready');
    }).catch(error => {
      console.error('❌ OfflineTileLayer database initialization failed:', error);
    });
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 3);
        
        request.onsuccess = () => {
          const db = request.result;
          console.log('📦 Offline tile layer connected to database');
          resolve(db);
        };
        
        request.onerror = () => {
          console.error('❌ Database connection failed:', request.error);
          reject(request.error);
        };
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          console.log('📦 Upgrading offline tile database...');
          
          // Clear old stores if they exist
          if (db.objectStoreNames.contains('tiles')) {
            db.deleteObjectStore('tiles');
          }
          
          // Create tile store with compound indexing
          const tileStore = db.createObjectStore('tiles', { keyPath: ['x', 'y', 'z', 'layerId'] });
          tileStore.createIndex('nodeIds', 'nodeIds', { multiEntry: true });
          tileStore.createIndex('customPackIds', 'customPackIds', { multiEntry: true });
          tileStore.createIndex('priority', 'priority');
          tileStore.createIndex('lastAccessed', 'lastAccessed');
          
          console.log('📦 Offline tile database schema updated');
        };
      });
    } catch (error) {
      console.error('❌ Failed to connect to offline tile database:', error);
    }
  }

  // Override the createTile method to check offline storage first
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img');
    
    L.DomEvent.on(tile, 'load', () => {
      done(undefined, tile);
    });
    
    L.DomEvent.on(tile, 'error', () => {
      done(new Error('Tile failed to load'), tile);
    });

    // Try to load from offline storage first
    this.loadOfflineTile(coords, tile);
    
    return tile;
  }

  private async loadOfflineTile(coords: L.Coords, tile: HTMLImageElement): Promise<void> {
    const tileKey = `${coords.x}_${coords.y}_${coords.z}`;
    const layerId = 'openstreetmap'; // Default layer
    
    try {
      // Check memory cache first
      if (this.offlineTileCache.has(tileKey)) {
        const cachedUrl = this.offlineTileCache.get(tileKey)!;
        tile.src = cachedUrl;
        console.log(`💾 Loaded tile from memory cache: ${coords.z}/${coords.x}/${coords.y}`);
        return;
      }

      // Wait for database to be ready
      if (!this.db) {
        console.log(`🔄 Database not ready, waiting for ${coords.z}/${coords.x}/${coords.y}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!this.db) {
          console.log(`❌ Database still not ready for ${coords.z}/${coords.x}/${coords.y}, falling back to online`);
          this.loadOnlineTile(coords, tile);
          return;
        }
      }

      // Check IndexedDB
      const offlineTile = await this.getTileFromIndexedDB(coords.x, coords.y, coords.z, layerId);
      
      if (offlineTile && offlineTile.data) {
        // Create blob URL from stored data
        let blobUrl: string;
        
        if (offlineTile.data instanceof Blob) {
          blobUrl = URL.createObjectURL(offlineTile.data);
        } else if (offlineTile.data.type === 'base64') {
          // Handle imported base64 data
          const binaryString = atob(offlineTile.data.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: offlineTile.data.mimeType || 'image/png' });
          blobUrl = URL.createObjectURL(blob);
        } else {
          throw new Error('Unknown tile data format');
        }
        
        // Cache the blob URL
        this.offlineTileCache.set(tileKey, blobUrl);
        
        // Set tile source
        tile.src = blobUrl;
        
        // Update access tracking
        this.updateTileAccess(coords.x, coords.y, coords.z, layerId);
        
        console.log(`📦 Loaded offline tile: ${coords.z}/${coords.x}/${coords.y}`);
        return;
      }
      
      // If offline tile not found, load online tile
      this.loadOnlineTile(coords, tile);
      
    } catch (error) {
      console.error(`Failed to load tile ${coords.z}/${coords.x}/${coords.y}:`, error);
      this.loadOnlineTile(coords, tile);
    }
  }

  private loadOnlineTile(coords: L.Coords, tile: HTMLImageElement): void {
    if (this.isOnline) {
      const onlineUrl = this.getTileUrl(coords);
      tile.src = onlineUrl;
      console.log(`🌐 Loading online tile: ${coords.z}/${coords.x}/${coords.y}`);
    } else {
      // Show placeholder for missing offline tile
      this.showMissingTilePlaceholder(tile, coords);
      console.log(`❌ Offline tile not available: ${coords.z}/${coords.x}/${coords.y}`);
    }
  }

  private async getTileFromIndexedDB(x: number, y: number, z: number, layerId: string): Promise<any | null> {
    if (!this.db) return null;
    
    try {
      const transaction = this.db.transaction(['tiles'], 'readonly');
      const store = transaction.objectStore('tiles');
      const request = store.get([x, y, z, layerId]);
      
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch (error) {
      console.error('Error reading tile from IndexedDB:', error);
      return null;
    }
  }

  private async updateTileAccess(x: number, y: number, z: number, layerId: string): Promise<void> {
    if (!this.db) return;
    
    try {
      const transaction = this.db.transaction(['tiles'], 'readwrite');
      const store = transaction.objectStore('tiles');
      const request = store.get([x, y, z, layerId]);
      
      request.onsuccess = () => {
        const tile = request.result;
        if (tile) {
          tile.lastAccessed = Date.now();
          tile.accessCount = (tile.accessCount || 0) + 1;
          store.put(tile);
        }
      };
    } catch (error) {
      console.warn('Failed to update tile access:', error);
    }
  }

  private showMissingTilePlaceholder(tile: HTMLImageElement, coords: L.Coords): void {
    // Create a simple placeholder for missing tiles
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Light gray background
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, 256, 256);
      
      // Border
      ctx.strokeStyle = '#ddd';
      ctx.strokeRect(0, 0, 256, 256);
      
      // Text
      ctx.fillStyle = '#999';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Offline', 128, 120);
      ctx.fillText(`${coords.z}/${coords.x}/${coords.y}`, 128, 140);
      ctx.fillText('Tile not available', 128, 160);
    }
    
    canvas.toBlob((blob) => {
      if (blob) {
        tile.src = URL.createObjectURL(blob);
      }
    });
  }

  // Clean up blob URLs when layer is removed
  onRemove(map: L.Map): this {
    // Clean up cached blob URLs
    this.offlineTileCache.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.offlineTileCache.clear();
    
    return super.onRemove(map);
  }

  // Get offline tile statistics
  async getOfflineStats(): Promise<{
    totalTiles: number;
    totalSizeMB: number;
    tilesByZoom: { [zoom: number]: number };
  }> {
    if (!this.db) {
      return { totalTiles: 0, totalSizeMB: 0, tilesByZoom: {} };
    }

    try {
      const transaction = this.db.transaction(['tiles'], 'readonly');
      const store = transaction.objectStore('tiles');
      const request = store.getAll();
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const tiles = request.result || [];
          let totalSize = 0;
          const tilesByZoom: { [zoom: number]: number } = {};
          
          tiles.forEach((tile: any) => {
            if (tile.data) {
              if (tile.data instanceof Blob) {
                totalSize += tile.data.size;
              } else if (tile.data.content) {
                // Estimate size from base64
                totalSize += (tile.data.content.length * 0.75);
              }
            }
            
            tilesByZoom[tile.z] = (tilesByZoom[tile.z] || 0) + 1;
          });
          
          resolve({
            totalTiles: tiles.length,
            totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
            tilesByZoom
          });
        };
        
        request.onerror = () => {
          resolve({ totalTiles: 0, totalSizeMB: 0, tilesByZoom: {} });
        };
      });
    } catch (error) {
      console.error('Failed to get offline stats:', error);
      return { totalTiles: 0, totalSizeMB: 0, tilesByZoom: {} };
    }
  }

  // Force refresh of a specific tile
  async refreshTile(x: number, y: number, z: number): Promise<void> {
    const tileKey = `${x}_${y}_${z}`;
    
    // Remove from cache
    const cachedUrl = this.offlineTileCache.get(tileKey);
    if (cachedUrl) {
      URL.revokeObjectURL(cachedUrl);
      this.offlineTileCache.delete(tileKey);
    }
    
    // Redraw the tile
    this.redraw();
  }

  // Check if a tile is available offline
  async isTileAvailableOffline(x: number, y: number, z: number, layerId: string = 'openstreetmap'): Promise<boolean> {
    const tile = await this.getTileFromIndexedDB(x, y, z, layerId);
    return !!tile;
  }

  // Debug function to log tile loading
  enableDebugLogging(): void {
    console.log('🔍 Offline tile layer debug logging enabled');
    // Additional debug code can be added here
  }
}

// Helper function to create offline-capable tile layer
export function createOfflineTileLayer(urlTemplate: string, options?: L.TileLayerOptions): OfflineTileLayer {
  return new OfflineTileLayer(urlTemplate, options);
}

// Export for global access
export { OfflineTileLayer as default };