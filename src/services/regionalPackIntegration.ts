// Regional Pack Integration Service
// Connects downloaded regional packs to the offline tile system

interface ExtractedTile {
  x: number;
  y: number;
  z: number;
  layerId: string;
  regionId: string;
  data: {
    type: 'base64';
    content: string;
    mimeType: string;
  };
  extractedAt: number;
  accessCount: number;
  lastAccessed: number;
}

interface RegionalTileData {
  regionId: string;
  tileCount: number;
  tiles: ExtractedTile[];
}

export class RegionalPackIntegration {
  private backendUrl: string;
  private dbName = 'openmaps_global'; // Same as offline tile layer
  private db: IDBDatabase | null = null;

  constructor() {
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 3);
        
        request.onsuccess = () => {
          const db = request.result;
          console.log('📦 Regional pack integration connected to database');
          resolve(db);
        };
        
        request.onerror = () => {
          console.error('❌ Regional pack database connection failed:', request.error);
          reject(request.error);
        };
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          console.log('📦 Regional pack upgrading database...');
          
          // Ensure tiles store exists with correct schema
          if (!db.objectStoreNames.contains('tiles')) {
            const tileStore = db.createObjectStore('tiles', { keyPath: ['x', 'y', 'z', 'layerId'] });
            tileStore.createIndex('nodeIds', 'nodeIds', { multiEntry: true });
            tileStore.createIndex('customPackIds', 'customPackIds', { multiEntry: true });
            tileStore.createIndex('regionId', 'regionId');
            tileStore.createIndex('priority', 'priority');
            tileStore.createIndex('lastAccessed', 'lastAccessed');
          }
          
          console.log('📦 Regional pack database schema ready');
        };
      });
    } catch (error) {
      console.error('❌ Failed to connect to regional pack database:', error);
    }
  }

  /**
   * Check if tiles are available for a region
   */
  async checkRegionalTilesAvailable(regionId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/api/geofabrik/tiles/${regionId}`);
      return response.ok;
    } catch (error) {
      console.error(`❌ Failed to check tiles for ${regionId}:`, error);
      return false;
    }
  }

  /**
   * Import tiles from a downloaded regional pack into the offline tile cache
   */
  async importRegionalTiles(regionId: string): Promise<boolean> {
    try {
      console.log(`🔄 Starting tile import for region: ${regionId}`);
      
      // Check if database is ready
      if (!this.db) {
        console.log('⏳ Database not ready, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!this.db) {
          throw new Error('Database not available');
        }
      }

      // Fetch tiles from backend
      const response = await fetch(`${this.backendUrl}/api/geofabrik/tiles/${regionId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch tiles: ${response.statusText}`);
      }

      const tileData: RegionalTileData = await response.json();
      console.log(`📥 Importing ${tileData.tileCount} tiles for ${regionId}`);

      // Import tiles in batches to avoid blocking UI
      const batchSize = 50;
      let importedCount = 0;

      for (let i = 0; i < tileData.tiles.length; i += batchSize) {
        const batch = tileData.tiles.slice(i, i + batchSize);
        
        await this.importTileBatch(batch, regionId);
        importedCount += batch.length;
        
        console.log(`📦 Imported ${importedCount}/${tileData.tileCount} tiles for ${regionId}`);
        
        // Small delay to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      console.log(`✅ Successfully imported ${importedCount} tiles for ${regionId}`);
      
      // Mark region as integrated
      await this.markRegionAsIntegrated(regionId, importedCount);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to import tiles for ${regionId}:`, error);
      return false;
    }
  }

  /**
   * Import a batch of tiles into IndexedDB
   */
  private async importTileBatch(tiles: ExtractedTile[], regionId: string): Promise<void> {
    if (!this.db) throw new Error('Database not available');

    const transaction = this.db.transaction(['tiles'], 'readwrite');
    const store = transaction.objectStore('tiles');

    const promises = tiles.map(tile => {
      return new Promise<void>((resolve, reject) => {
        // Convert base64 to blob for storage
        const binaryString = atob(tile.data.content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: tile.data.mimeType });

        // Create tile object for IndexedDB
        const tileObject = {
          x: tile.x,
          y: tile.y,
          z: tile.z,
          layerId: tile.layerId,
          data: blob,
          priority: 1, // Higher priority for regional pack tiles
          lastAccessed: tile.lastAccessed,
          accessCount: tile.accessCount,
          regionId: regionId,
          customPackIds: [regionId], // Associate with regional pack
          nodeIds: [], // Empty for regional pack tiles
          extractedAt: tile.extractedAt
        };

        const request = store.put(tileObject);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
  }

  /**
   * Mark a region as integrated in localStorage
   */
  private async markRegionAsIntegrated(regionId: string, tileCount: number): Promise<void> {
    try {
      const integratedRegions = this.getIntegratedRegions();
      integratedRegions[regionId] = {
        integratedAt: Date.now(),
        tileCount: tileCount,
        status: 'ready'
      };
      
      localStorage.setItem('openmaps_integrated_regions', JSON.stringify(integratedRegions));
      console.log(`✅ Marked ${regionId} as integrated with ${tileCount} tiles`);
    } catch (error) {
      console.warn('Failed to mark region as integrated:', error);
    }
  }

  /**
   * Get list of integrated regions
   */
  getIntegratedRegions(): { [regionId: string]: any } {
    try {
      const stored = localStorage.getItem('openmaps_integrated_regions');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Check if a region is integrated
   */
  isRegionIntegrated(regionId: string): boolean {
    const integrated = this.getIntegratedRegions();
    return !!integrated[regionId] && integrated[regionId].status === 'ready';
  }

  /**
   * Get tile count for an integrated region
   */
  getRegionTileCount(regionId: string): number {
    const integrated = this.getIntegratedRegions();
    return integrated[regionId]?.tileCount || 0;
  }

  /**
   * Remove a region's tiles from the offline cache
   */
  async removeRegionalTiles(regionId: string): Promise<boolean> {
    try {
      if (!this.db) throw new Error('Database not available');

      console.log(`🗑️ Removing tiles for region: ${regionId}`);

      const transaction = this.db.transaction(['tiles'], 'readwrite');
      const store = transaction.objectStore('tiles');
      const index = store.index('regionId');

      const request = index.openCursor(regionId);
      let removedCount = 0;

      return new Promise((resolve) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            removedCount++;
            cursor.continue();
          } else {
            // Remove from integrated regions
            const integrated = this.getIntegratedRegions();
            delete integrated[regionId];
            localStorage.setItem('openmaps_integrated_regions', JSON.stringify(integrated));
            
            console.log(`✅ Removed ${removedCount} tiles for ${regionId}`);
            resolve(true);
          }
        };

        request.onerror = () => {
          console.error(`❌ Failed to remove tiles for ${regionId}`);
          resolve(false);
        };
      });

    } catch (error) {
      console.error(`❌ Failed to remove tiles for ${regionId}:`, error);
      return false;
    }
  }

  /**
   * Get offline tile statistics including regional pack tiles
   */
  async getOfflineStats(): Promise<{
    totalTiles: number;
    totalSizeMB: number;
    tilesByZoom: { [zoom: number]: number };
    regionalPacks: { [regionId: string]: { tileCount: number; integratedAt: number } };
  }> {
    if (!this.db) {
      return { totalTiles: 0, totalSizeMB: 0, tilesByZoom: {}, regionalPacks: {} };
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
          const regionalPacks: { [regionId: string]: { tileCount: number; integratedAt: number } } = {};
          
          tiles.forEach((tile: any) => {
            if (tile.data instanceof Blob) {
              totalSize += tile.data.size;
            }
            
            tilesByZoom[tile.z] = (tilesByZoom[tile.z] || 0) + 1;
            
            if (tile.regionId) {
              if (!regionalPacks[tile.regionId]) {
                regionalPacks[tile.regionId] = { tileCount: 0, integratedAt: tile.extractedAt || 0 };
              }
              regionalPacks[tile.regionId].tileCount++;
            }
          });
          
          resolve({
            totalTiles: tiles.length,
            totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
            tilesByZoom,
            regionalPacks
          });
        };
        
        request.onerror = () => {
          resolve({ totalTiles: 0, totalSizeMB: 0, tilesByZoom: {}, regionalPacks: {} });
        };
      });
    } catch (error) {
      console.error('Failed to get offline stats:', error);
      return { totalTiles: 0, totalSizeMB: 0, tilesByZoom: {}, regionalPacks: {} };
    }
  }
}

// Singleton instance
export const regionalPackIntegration = new RegionalPackIntegration();