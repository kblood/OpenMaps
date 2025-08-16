// Global Hierarchical Map Pack System with Navigation and Polygon Drawing
import { 
  GLOBAL_HIERARCHY, 
  SEARCH_INDEX,
  GlobalMapNode, 
  SearchableLocation,
  searchLocations,
  getNodeById,
  getChildNodes,
  getNodePath,
  HIERARCHY_LEVELS
} from '../data/globalMapHierarchy';

// Navigation state
export interface NavigationState {
  currentLevel: string; // world, continent, country, state, city, section, custom
  currentNodeId: string;
  breadcrumbs: GlobalMapNode[];
  children: GlobalMapNode[];
  searchQuery: string;
  searchResults: SearchableLocation[];
  isSearching: boolean;
}

// Polygon-based custom pack
export interface CustomMapPack {
  id: string;
  name: string;
  description: string;
  polygon: [number, number][]; // [lat, lng] coordinates
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
  estimatedTiles: number;
  estimatedSizeMB: number;
  zoomLevels: number[];
  layerIds: string[];
  created: Date;
  isDownloaded: boolean;
  downloadProgress?: number;
  createdBy: 'user' | 'auto-visited';
}

// Enhanced tile system
interface TileInfo {
  x: number;
  y: number;
  z: number;
  url: string;
  layerId: string;
  downloaded: boolean;
  priority: number;
  nodeIds: string[]; // Which global nodes include this tile
  customPackIds: string[]; // Which custom packs include this tile
}

interface DownloadProgress {
  current: number;
  total: number;
  nodeId: string;
  status: 'downloading' | 'completed' | 'paused' | 'cancelled' | 'error';
  speed: number; // tiles per second
  estimatedTimeRemaining: number; // seconds
}

export type { DownloadProgress };

export class GlobalMapPackSystem {
  private dbName = 'openmaps_global';
  private dbVersion = 3;
  private db: IDBDatabase | null = null;
  private downloadQueue: Map<string, DownloadProgress> = new Map();
  private maxConcurrentDownloads = 20;
  private navigationState: NavigationState;
  private customPacks: CustomMapPack[] = [];
  private globalNodes: GlobalMapNode[] = [];
  private downloadProgressCallbacks: ((progress: DownloadProgress) => void)[] = [];
  private navigationCallbacks: ((state: NavigationState) => void)[] = [];
  private customPackCallbacks: ((packs: CustomMapPack[]) => void)[] = [];
  private cancelledDownloads: Set<string> = new Set();

  constructor() {
    this.navigationState = {
      currentLevel: 'world',
      currentNodeId: 'world',
      breadcrumbs: [],
      children: [],
      searchQuery: '',
      searchResults: [],
      isSearching: false
    };
    this.globalNodes = [...GLOBAL_HIERARCHY];
    this.initializeNavigation();
  }

  // ==================== INITIALIZATION ====================
  async initialize(): Promise<void> {
    try {
      await this.openDatabase();
      await this.loadGlobalNodes();
      await this.loadCustomPacks();
      await this.loadDownloadStates();
      console.log('✅ Global Map Pack System initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Global Map Pack System:', error);
      throw error;
    }
  }

  private openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Clear old stores if they exist
        if (db.objectStoreNames.contains('tiles')) {
          db.deleteObjectStore('tiles');
        }
        if (db.objectStoreNames.contains('globalNodes')) {
          db.deleteObjectStore('globalNodes');
        }
        if (db.objectStoreNames.contains('customPacks')) {
          db.deleteObjectStore('customPacks');
        }

        // Create tile store with compound indexing
        const tileStore = db.createObjectStore('tiles', { keyPath: ['x', 'y', 'z', 'layerId'] });
        tileStore.createIndex('nodeIds', 'nodeIds', { multiEntry: true });
        tileStore.createIndex('customPackIds', 'customPackIds', { multiEntry: true });
        tileStore.createIndex('priority', 'priority');

        // Create global nodes store
        const nodeStore = db.createObjectStore('globalNodes', { keyPath: 'id' });
        nodeStore.createIndex('level', 'level');
        nodeStore.createIndex('parentId', 'parentId');
        nodeStore.createIndex('isDownloaded', 'isDownloaded');

        // Create custom packs store
        const customStore = db.createObjectStore('customPacks', { keyPath: 'id' });
        customStore.createIndex('created', 'created');
        customStore.createIndex('isDownloaded', 'isDownloaded');
      };
    });
  }

  // ==================== NAVIGATION SYSTEM ====================
  private initializeNavigation(): void {
    this.navigateToNode('world');
  }

  navigateToNode(nodeId: string): void {
    const node = getNodeById(nodeId, this.globalNodes);
    if (!node) {
      console.warn(`Node ${nodeId} not found`);
      return;
    }

    const breadcrumbs = getNodePath(nodeId, this.globalNodes);
    const children = getChildNodes(nodeId, this.globalNodes);

    this.navigationState = {
      ...this.navigationState,
      currentLevel: node.level,
      currentNodeId: nodeId,
      breadcrumbs,
      children,
      isSearching: false,
      searchQuery: '',
      searchResults: []
    };

    this.notifyNavigationChange();
  }

  navigateToLevel(level: string): void {
    const levelNode = this.globalNodes.find(node => node.level === level);
    if (levelNode) {
      this.navigateToNode(levelNode.id);
    }
  }

  navigateUp(): void {
    const currentNode = getNodeById(this.navigationState.currentNodeId, this.globalNodes);
    if (currentNode?.parentId) {
      this.navigateToNode(currentNode.parentId);
    }
  }

  searchGlobal(query: string): void {
    const results = searchLocations(query, SEARCH_INDEX, 50);
    
    this.navigationState = {
      ...this.navigationState,
      searchQuery: query,
      searchResults: results,
      isSearching: query.length > 0
    };

    this.notifyNavigationChange();
  }

  clearSearch(): void {
    this.navigationState = {
      ...this.navigationState,
      searchQuery: '',
      searchResults: [],
      isSearching: false
    };

    this.notifyNavigationChange();
  }

  // ==================== DOWNLOAD SYSTEM ====================
  async downloadNode(nodeId: string, layerIds: string[] = ['openstreetmap'], minZoom: number = 1, maxZoom: number = 18): Promise<void> {
    const node = getNodeById(nodeId, this.globalNodes);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Validate download limits
    const validation = this.validateDownloadLimits(nodeId, minZoom, maxZoom);
    if (!validation.valid) {
      throw new Error(validation.warning || 'Download not allowed');
    }

    console.log(`🌍 Starting download for ${node.name} (${validation.estimatedTiles} tiles, ~${validation.estimatedSizeMB}MB)`);

    const progress: DownloadProgress = {
      current: 0,
      total: validation.estimatedTiles,
      nodeId,
      status: 'downloading',
      speed: 0,
      estimatedTimeRemaining: 0
    };

    this.downloadQueue.set(nodeId, progress);
    this.notifyDownloadProgress(progress);

    try {
      const tiles = this.generateTileList(node.bounds, layerIds, minZoom, maxZoom);
      await this.downloadTilesParallel(tiles, nodeId, progress);
      
      // Update node status
      const nodeIndex = this.globalNodes.findIndex(n => n.id === nodeId);
      if (nodeIndex !== -1) {
        this.globalNodes[nodeIndex].isDownloaded = true;
        this.globalNodes[nodeIndex].downloadProgress = 100;
        await this.saveGlobalNode(this.globalNodes[nodeIndex]);
      }

      progress.status = 'completed';
      this.notifyDownloadProgress(progress);

      console.log(`✅ Download completed for ${node.name}`);
    } catch (error) {
      console.error(`❌ Download failed for ${node.name}:`, error);
      progress.status = 'error';
      this.notifyDownloadProgress(progress);
      throw error;
    } finally {
      this.downloadQueue.delete(nodeId);
      this.cancelledDownloads.delete(nodeId);
    }
  }

  pauseDownload(nodeId: string): boolean {
    const progress = this.downloadQueue.get(nodeId);
    if (!progress || progress.status !== 'downloading') {
      return false;
    }

    progress.status = 'paused';
    this.notifyDownloadProgress(progress);
    console.log(`⏸️ Download paused for node: ${nodeId}`);
    return true;
  }

  resumeDownload(nodeId: string): boolean {
    const progress = this.downloadQueue.get(nodeId);
    if (!progress || progress.status !== 'paused') {
      return false;
    }

    progress.status = 'downloading';
    this.notifyDownloadProgress(progress);
    console.log(`▶️ Download resumed for node: ${nodeId}`);
    
    // Note: In a full implementation, you'd need to restart the download process
    // For now, this changes the status but doesn't restart the actual download
    return true;
  }

  cancelDownload(nodeId: string): boolean {
    const progress = this.downloadQueue.get(nodeId);
    if (!progress || (progress.status !== 'downloading' && progress.status !== 'paused')) {
      return false;
    }

    this.cancelledDownloads.add(nodeId);
    progress.status = 'cancelled';
    this.notifyDownloadProgress(progress);
    
    // Clean up the download
    setTimeout(() => {
      this.downloadQueue.delete(nodeId);
      this.cancelledDownloads.delete(nodeId);
    }, 1000); // Give UI time to show cancelled status

    console.log(`❌ Download cancelled for node: ${nodeId}`);
    return true;
  }

  isDownloadCancelled(nodeId: string): boolean {
    return this.cancelledDownloads.has(nodeId);
  }

  private generateTileList(bounds: any, layerIds: string[], minZoom: number, maxZoom: number): TileInfo[] {
    const tiles: TileInfo[] = [];
    
    for (let z = minZoom; z <= maxZoom; z++) {
      const minTileX = Math.floor((bounds.west + 180) / 360 * Math.pow(2, z));
      const maxTileX = Math.floor((bounds.east + 180) / 360 * Math.pow(2, z));
      const minTileY = Math.floor((1 - Math.log(Math.tan(bounds.north * Math.PI / 180) + 1 / Math.cos(bounds.north * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
      const maxTileY = Math.floor((1 - Math.log(Math.tan(bounds.south * Math.PI / 180) + 1 / Math.cos(bounds.south * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));

      for (let x = minTileX; x <= maxTileX; x++) {
        for (let y = minTileY; y <= maxTileY; y++) {
          for (const layerId of layerIds) {
            const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
            tiles.push({
              x, y, z,
              url,
              layerId,
              downloaded: false,
              priority: 15 - z, // Higher zoom = higher priority
              nodeIds: [],
              customPackIds: []
            });
          }
        }
      }
    }

    return tiles;
  }

  private async downloadTilesParallel(tiles: TileInfo[], nodeId: string, progress: DownloadProgress): Promise<void> {
    const chunkSize = this.maxConcurrentDownloads;
    let completed = 0;
    const startTime = Date.now();

    for (let i = 0; i < tiles.length; i += chunkSize) {
      // Check if download was cancelled or paused
      if (this.isDownloadCancelled(nodeId)) {
        throw new Error('Download was cancelled');
      }
      
      const currentProgress = this.downloadQueue.get(nodeId);
      if (currentProgress?.status === 'paused') {
        console.log(`⏸️ Download paused, waiting...`);
        // Wait for resume or cancel
        while (currentProgress.status === 'paused' && !this.isDownloadCancelled(nodeId)) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (this.isDownloadCancelled(nodeId)) {
          throw new Error('Download was cancelled');
        }
      }

      const chunk = tiles.slice(i, i + chunkSize);
      const downloadPromises = chunk.map(tile => this.downloadSingleTile(tile, nodeId));

      const results = await Promise.allSettled(downloadPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          completed++;
        } else {
          console.warn(`Failed to download tile:`, chunk[index], result.reason);
        }
      });

      // Update progress
      progress.current = completed;
      const elapsed = (Date.now() - startTime) / 1000;
      progress.speed = completed / elapsed;
      progress.estimatedTimeRemaining = (progress.total - completed) / progress.speed;

      this.notifyDownloadProgress(progress);

      // Small delay to prevent overwhelming the server
      if (i + chunkSize < tiles.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  private async downloadSingleTile(tile: TileInfo, nodeId: string): Promise<void> {
    try {
      // Check if tile already exists
      const existingTile = await this.getTile(tile.x, tile.y, tile.z, tile.layerId);
      if (existingTile) {
        console.log(`📦 Reusing existing tile ${tile.z}/${tile.x}/${tile.y}`);
        // Update the tile to include this nodeId if not already included
        if (!existingTile.nodeIds.includes(nodeId)) {
          existingTile.nodeIds.push(nodeId);
          existingTile.lastAccessed = Date.now();
          existingTile.accessCount = (existingTile.accessCount || 0) + 1;
          await this.saveTile(existingTile);
        }
        return;
      }

      const response = await fetch(tile.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const tileData = {
        ...tile,
        data: blob,
        downloaded: true,
        nodeIds: tile.nodeIds ? [...tile.nodeIds, nodeId] : [nodeId],
        customPackIds: tile.customPackIds || [],
        downloadedAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1
      };

      await this.saveTile(tileData);
    } catch (error) {
      console.warn(`Failed to download tile ${tile.z}/${tile.x}/${tile.y}:`, error);
      throw error;
    }
  }

  private async downloadCustomPackTiles(tiles: TileInfo[], packId: string, progress: DownloadProgress): Promise<void> {
    const chunkSize = this.maxConcurrentDownloads;
    let completed = 0;
    const startTime = Date.now();

    for (let i = 0; i < tiles.length; i += chunkSize) {
      // Check if download was cancelled or paused
      if (this.isDownloadCancelled(packId)) {
        throw new Error('Download was cancelled');
      }
      
      const currentProgress = this.downloadQueue.get(packId);
      if (currentProgress?.status === 'paused') {
        console.log(`⏸️ Custom pack download paused, waiting...`);
        // Wait for resume or cancel
        while (currentProgress.status === 'paused' && !this.isDownloadCancelled(packId)) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (this.isDownloadCancelled(packId)) {
          throw new Error('Download was cancelled');
        }
      }

      const chunk = tiles.slice(i, i + chunkSize);
      const downloadPromises = chunk.map(tile => this.downloadSingleCustomPackTile(tile, packId));

      const results = await Promise.allSettled(downloadPromises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          completed++;
        } else {
          console.warn(`Failed to download custom pack tile:`, chunk[index], result.reason);
        }
      });

      // Update progress
      progress.current = completed;
      const elapsed = (Date.now() - startTime) / 1000;
      progress.speed = completed / elapsed;
      progress.estimatedTimeRemaining = (progress.total - completed) / progress.speed;

      this.notifyDownloadProgress(progress);

      // Small delay to prevent overwhelming the server
      if (i + chunkSize < tiles.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  private async downloadSingleCustomPackTile(tile: TileInfo, packId: string): Promise<void> {
    try {
      // Check if tile already exists
      const existingTile = await this.getTile(tile.x, tile.y, tile.z, tile.layerId);
      if (existingTile) {
        console.log(`📦 Reusing existing tile for custom pack ${tile.z}/${tile.x}/${tile.y}`);
        // Update the tile to include this custom pack ID
        if (!existingTile.customPackIds.includes(packId)) {
          existingTile.customPackIds.push(packId);
          existingTile.lastAccessed = Date.now();
          existingTile.accessCount = (existingTile.accessCount || 0) + 1;
          await this.saveTile(existingTile);
        }
        return;
      }

      const response = await fetch(tile.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const tileData = {
        ...tile,
        data: blob,
        downloaded: true,
        nodeIds: [],
        customPackIds: [packId],
        downloadedAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1
      };

      await this.saveTile(tileData);
    } catch (error) {
      console.warn(`Failed to download custom pack tile ${tile.z}/${tile.x}/${tile.y}:`, error);
      throw error;
    }
  }

  // ==================== CUSTOM POLYGON PACKS ====================
  async createCustomPack(
    name: string,
    description: string,
    polygon: [number, number][],
    zoomLevels: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    layerIds: string[] = ['openstreetmap']
  ): Promise<string> {
    // Calculate bounds from polygon
    const lats = polygon.map(p => p[0]);
    const lngs = polygon.map(p => p[1]);
    const bounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };

    // Calculate center
    const center = {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2
    };

    // Estimate tiles
    let estimatedTiles = 0;
    for (const zoom of zoomLevels) {
      const tilesAtZoom = this.estimatePolygonTiles(polygon, zoom);
      estimatedTiles += tilesAtZoom * layerIds.length;
    }

    const customPack: CustomMapPack = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      polygon,
      bounds,
      center,
      estimatedTiles,
      estimatedSizeMB: Math.round(estimatedTiles * 0.02), // ~20KB per tile average
      zoomLevels,
      layerIds,
      created: new Date(),
      isDownloaded: false,
      downloadProgress: 0,
      createdBy: 'user'
    };

    this.customPacks.push(customPack);
    await this.saveCustomPack(customPack);
    this.notifyCustomPacksChange();

    console.log(`📍 Created custom pack: ${name} (${estimatedTiles} tiles, ~${customPack.estimatedSizeMB}MB)`);
    return customPack.id;
  }

  private estimatePolygonTiles(polygon: [number, number][], zoom: number): number {
    // Simple bounding box estimation for now
    // TODO: Implement precise polygon-tile intersection
    const lats = polygon.map(p => p[0]);
    const lngs = polygon.map(p => p[1]);
    const bounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };

    const minTileX = Math.floor((bounds.west + 180) / 360 * Math.pow(2, zoom));
    const maxTileX = Math.floor((bounds.east + 180) / 360 * Math.pow(2, zoom));
    const minTileY = Math.floor((1 - Math.log(Math.tan(bounds.north * Math.PI / 180) + 1 / Math.cos(bounds.north * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    const maxTileY = Math.floor((1 - Math.log(Math.tan(bounds.south * Math.PI / 180) + 1 / Math.cos(bounds.south * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

    return (maxTileX - minTileX + 1) * (maxTileY - minTileY + 1);
  }

  async downloadCustomPack(packId: string): Promise<void> {
    const pack = this.customPacks.find(p => p.id === packId);
    if (!pack) {
      throw new Error(`Custom pack ${packId} not found`);
    }

    console.log(`📍 Starting download for custom pack: ${pack.name}`);
    
    const progress: DownloadProgress = {
      current: 0,
      total: pack.estimatedTiles,
      nodeId: packId,
      status: 'downloading',
      speed: 0,
      estimatedTimeRemaining: 0
    };

    this.downloadQueue.set(packId, progress);
    this.notifyDownloadProgress(progress);

    try {
      const tiles = this.generatePolygonTileList(pack.polygon, pack.layerIds, pack.zoomLevels);
      await this.downloadCustomPackTiles(tiles, packId, progress);
      
      // Update pack status
      const packIndex = this.customPacks.findIndex(p => p.id === packId);
      if (packIndex !== -1) {
        this.customPacks[packIndex].isDownloaded = true;
        this.customPacks[packIndex].downloadProgress = 100;
        await this.saveCustomPack(this.customPacks[packIndex]);
      }

      progress.status = 'completed';
      this.notifyDownloadProgress(progress);
      this.notifyCustomPacksChange();

      console.log(`✅ Custom pack download completed: ${pack.name}`);
    } catch (error) {
      console.error(`❌ Custom pack download failed: ${pack.name}:`, error);
      progress.status = 'error';
      this.notifyDownloadProgress(progress);
      throw error;
    } finally {
      this.downloadQueue.delete(packId);
    }
  }

  private generatePolygonTileList(polygon: [number, number][], layerIds: string[], zoomLevels: number[]): TileInfo[] {
    const tiles: TileInfo[] = [];
    
    for (const zoom of zoomLevels) {
      // For now, use bounding box. TODO: Implement precise polygon intersection
      const lats = polygon.map(p => p[0]);
      const lngs = polygon.map(p => p[1]);
      const bounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs)
      };

      const minTileX = Math.floor((bounds.west + 180) / 360 * Math.pow(2, zoom));
      const maxTileX = Math.floor((bounds.east + 180) / 360 * Math.pow(2, zoom));
      const minTileY = Math.floor((1 - Math.log(Math.tan(bounds.north * Math.PI / 180) + 1 / Math.cos(bounds.north * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
      const maxTileY = Math.floor((1 - Math.log(Math.tan(bounds.south * Math.PI / 180) + 1 / Math.cos(bounds.south * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

      for (let x = minTileX; x <= maxTileX; x++) {
        for (let y = minTileY; y <= maxTileY; y++) {
          for (const layerId of layerIds) {
            const url = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
            tiles.push({
              x, y, z: zoom,
              url,
              layerId,
              downloaded: false,
              priority: 15 - zoom,
              nodeIds: [],
              customPackIds: []
            });
          }
        }
      }
    }

    return tiles;
  }

  // ==================== DATABASE OPERATIONS ====================
  private async getTile(x: number, y: number, z: number, layerId: string): Promise<any | null> {
    if (!this.db) return null;
    
    const transaction = this.db.transaction(['tiles'], 'readonly');
    const store = transaction.objectStore('tiles');
    const request = store.get([x, y, z, layerId]);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async saveGlobalNode(node: GlobalMapNode): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['globalNodes'], 'readwrite');
    const store = transaction.objectStore('globalNodes');
    await store.put(node);
  }

  private async saveCustomPack(pack: CustomMapPack): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['customPacks'], 'readwrite');
    const store = transaction.objectStore('customPacks');
    await store.put(pack);
  }

  private async saveTile(tile: any): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['tiles'], 'readwrite');
    const store = transaction.objectStore('tiles');
    await store.put(tile);
  }

  private async loadGlobalNodes(): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['globalNodes'], 'readonly');
    const store = transaction.objectStore('globalNodes');
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const storedNodes = request.result || [];
        // Merge with preloaded hierarchy
        this.globalNodes = this.globalNodes.map(node => {
          const stored = storedNodes.find((s: GlobalMapNode) => s.id === node.id);
          return stored ? { ...node, ...stored } : node;
        });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async loadCustomPacks(): Promise<void> {
    if (!this.db) return;
    
    const transaction = this.db.transaction(['customPacks'], 'readonly');
    const store = transaction.objectStore('customPacks');
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        this.customPacks = request.result || [];
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async loadDownloadStates(): Promise<void> {
    // Initialize download states from stored data
    for (const node of this.globalNodes) {
      if (node.downloadProgress && node.downloadProgress < 100) {
        // Resume interrupted downloads if needed
        console.log(`Found interrupted download for ${node.name}, resuming...`);
      }
    }
  }

  // ==================== EVENT SYSTEM ====================
  onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void {
    this.downloadProgressCallbacks.push(callback);
    return () => {
      const index = this.downloadProgressCallbacks.indexOf(callback);
      if (index > -1) this.downloadProgressCallbacks.splice(index, 1);
    };
  }

  onNavigationChange(callback: (state: NavigationState) => void): () => void {
    this.navigationCallbacks.push(callback);
    return () => {
      const index = this.navigationCallbacks.indexOf(callback);
      if (index > -1) this.navigationCallbacks.splice(index, 1);
    };
  }

  onCustomPacksChange(callback: (packs: CustomMapPack[]) => void): () => void {
    this.customPackCallbacks.push(callback);
    return () => {
      const index = this.customPackCallbacks.indexOf(callback);
      if (index > -1) this.customPackCallbacks.splice(index, 1);
    };
  }

  private notifyDownloadProgress(progress: DownloadProgress): void {
    this.downloadProgressCallbacks.forEach(callback => callback(progress));
  }

  private notifyNavigationChange(): void {
    this.navigationCallbacks.forEach(callback => callback(this.navigationState));
  }

  private notifyCustomPacksChange(): void {
    this.customPackCallbacks.forEach(callback => callback(this.customPacks));
  }

  // ==================== PUBLIC GETTERS ====================
  getNavigationState(): NavigationState {
    return { ...this.navigationState };
  }

  getCustomPacks(): CustomMapPack[] {
    return [...this.customPacks];
  }

  getGlobalNodes(): GlobalMapNode[] {
    return [...this.globalNodes];
  }

  getHierarchyLevels() {
    return HIERARCHY_LEVELS;
  }

  // ==================== EXPORT/IMPORT SYSTEM ====================
  async exportMapPacks(): Promise<{
    globalNodes: GlobalMapNode[];
    customPacks: CustomMapPack[];
    tilesCount: number;
    exportedAt: Date;
  }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Get all downloaded global nodes
      const downloadedNodes = this.globalNodes.filter(node => node.isDownloaded);
      
      // Get all custom packs
      const customPacks = [...this.customPacks];
      
      // Count tiles
      const transaction = this.db.transaction(['tiles'], 'readonly');
      const store = transaction.objectStore('tiles');
      const countRequest = store.count();
      
      const tilesCount = await new Promise<number>((resolve, reject) => {
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => reject(countRequest.error);
      });

      const exportData = {
        globalNodes: downloadedNodes,
        customPacks,
        tilesCount,
        exportedAt: new Date()
      };

      console.log(`📤 Exported ${downloadedNodes.length} global nodes, ${customPacks.length} custom packs, and ${tilesCount} tiles`);
      
      return exportData;
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  }

  async exportMapPacksAsFile(): Promise<void> {
    try {
      const exportData = await this.exportMapPacks();
      
      // Create download link
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `openmaps-export-${new Date().toISOString().slice(0, 10)}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      console.log('✅ Map packs exported to file successfully');
    } catch (error) {
      console.error('❌ Failed to export map packs to file:', error);
      throw error;
    }
  }

  async exportFullDatabase(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      console.log('📦 Starting full database export (including tiles)...');
      
      // Export all data including tiles
      const transaction = this.db.transaction(['tiles', 'globalNodes', 'customPacks'], 'readonly');
      
      const [tiles, globalNodes, customPacks] = await Promise.all([
        this.getAllFromStore(transaction.objectStore('tiles')),
        this.getAllFromStore(transaction.objectStore('globalNodes')),
        this.getAllFromStore(transaction.objectStore('customPacks'))
      ]);

      // Process tiles to include blob data properly
      const processedTiles = await Promise.all(tiles.map(async (tile: any) => {
        if (tile.data && tile.data instanceof Blob) {
          // Convert blob to base64 for JSON serialization
          const arrayBuffer = await tile.data.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
          
          return {
            ...tile,
            data: {
              type: 'base64',
              content: base64,
              mimeType: tile.data.type || 'image/png'
            }
          };
        }
        return tile;
      }));

      const fullExportData = {
        tiles: processedTiles,
        globalNodes,
        customPacks,
        exportedAt: new Date(),
        version: this.dbVersion,
        format: 'openmaps-tiles-v1'
      };

      // Convert to blob and download
      const blob = new Blob([JSON.stringify(fullExportData)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `openmaps-tiles-export-${new Date().toISOString().slice(0, 10)}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      console.log(`✅ Full database exported: ${processedTiles.length} tiles, ${globalNodes.length} nodes, ${customPacks.length} custom packs`);
      
      // Show summary to user
      const sizeMB = Math.round(blob.size / 1024 / 1024);
      alert(`✅ Export Complete!\n\nExported:\n• ${processedTiles.length} map tiles\n• ${globalNodes.length} regions\n• ${customPacks.length} custom areas\n\nFile size: ~${sizeMB}MB\n\nSaved as: openmaps-tiles-export-${new Date().toISOString().slice(0, 10)}.json`);
      
    } catch (error) {
      console.error('❌ Full database export failed:', error);
      throw error;
    }
  }

  // Export specific custom pack with its tiles
  async exportCustomPackWithTiles(packId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const pack = this.customPacks.find(p => p.id === packId);
      if (!pack) {
        throw new Error(`Custom pack ${packId} not found`);
      }

      console.log(`📦 Exporting custom pack: ${pack.name}`);
      
      // Get all tiles for this custom pack
      const transaction = this.db.transaction(['tiles'], 'readonly');
      const store = transaction.objectStore('tiles');
      const packIndex = store.index('customPackIds');
      
      const tilesForPack = await new Promise<any[]>((resolve, reject) => {
        const tiles: any[] = [];
        const request = packIndex.openCursor();
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const tile = cursor.value;
            if (tile.customPackIds && tile.customPackIds.includes(packId)) {
              tiles.push(tile);
            }
            cursor.continue();
          } else {
            resolve(tiles);
          }
        };
        
        request.onerror = () => reject(request.error);
      });

      // Process tiles with blob data
      const processedTiles = await Promise.all(tilesForPack.map(async (tile: any) => {
        if (tile.data && tile.data instanceof Blob) {
          const arrayBuffer = await tile.data.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
          
          return {
            ...tile,
            data: {
              type: 'base64',
              content: base64,
              mimeType: tile.data.type || 'image/png'
            }
          };
        }
        return tile;
      }));

      const customPackData = {
        type: 'custom-pack',
        pack: pack,
        tiles: processedTiles,
        exportedAt: new Date(),
        version: this.dbVersion,
        format: 'openmaps-custompack-v1'
      };

      // Create download
      const blob = new Blob([JSON.stringify(customPackData)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pack.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-custompack.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      const sizeMB = Math.round(blob.size / 1024 / 1024);
      console.log(`✅ Custom pack exported: ${pack.name} (${processedTiles.length} tiles, ${sizeMB}MB)`);
      
      alert(`✅ Custom Pack Exported!\n\nName: ${pack.name}\nTiles: ${processedTiles.length}\nSize: ~${sizeMB}MB\n\nThis file contains your custom polygon area and all downloaded tiles. Import it on another device to restore this exact map pack.`);
      
    } catch (error) {
      console.error('❌ Custom pack export failed:', error);
      throw error;
    }
  }

  // Export all custom packs with their tiles
  async exportAllCustomPacks(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      if (this.customPacks.length === 0) {
        alert('No custom packs to export');
        return;
      }

      console.log(`📦 Exporting all ${this.customPacks.length} custom packs...`);
      
      const allCustomPacksData = [];
      let totalTiles = 0;

      for (const pack of this.customPacks) {
        // Get tiles for this pack
        const transaction = this.db.transaction(['tiles'], 'readonly');
        const store = transaction.objectStore('tiles');
        const packIndex = store.index('customPackIds');
        
        const tilesForPack = await new Promise<any[]>((resolve, reject) => {
          const tiles: any[] = [];
          const request = packIndex.openCursor();
          
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
              const tile = cursor.value;
              if (tile.customPackIds && tile.customPackIds.includes(pack.id)) {
                tiles.push(tile);
              }
              cursor.continue();
            } else {
              resolve(tiles);
            }
          };
          
          request.onerror = () => reject(request.error);
        });

        // Process tiles
        const processedTiles = await Promise.all(tilesForPack.map(async (tile: any) => {
          if (tile.data && tile.data instanceof Blob) {
            const arrayBuffer = await tile.data.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
            
            return {
              ...tile,
              data: {
                type: 'base64',
                content: base64,
                mimeType: tile.data.type || 'image/png'
              }
            };
          }
          return tile;
        }));

        allCustomPacksData.push({
          pack,
          tiles: processedTiles
        });

        totalTiles += processedTiles.length;
      }

      const exportData = {
        type: 'all-custom-packs',
        customPacks: allCustomPacksData,
        exportedAt: new Date(),
        version: this.dbVersion,
        format: 'openmaps-allcustompacks-v1',
        summary: {
          packCount: this.customPacks.length,
          totalTiles,
          exportedBy: 'OpenMaps'
        }
      };

      // Create download
      const blob = new Blob([JSON.stringify(exportData)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `all-custom-packs-${new Date().toISOString().slice(0, 10)}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      const sizeMB = Math.round(blob.size / 1024 / 1024);
      console.log(`✅ All custom packs exported: ${this.customPacks.length} packs (${totalTiles} tiles, ${sizeMB}MB)`);
      
      alert(`✅ All Custom Packs Exported!\n\nPacks: ${this.customPacks.length}\nTotal Tiles: ${totalTiles}\nSize: ~${sizeMB}MB\n\nThis file contains all your custom polygon areas and their tiles.`);
      
    } catch (error) {
      console.error('❌ All custom packs export failed:', error);
      throw error;
    }
  }

  // Export specific map pack with its tiles
  async exportMapPackWithTiles(nodeId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const node = getNodeById(nodeId, this.globalNodes);
      if (!node) {
        throw new Error(`Node ${nodeId} not found`);
      }

      console.log(`📦 Exporting map pack: ${node.name}`);
      
      // Get all tiles for this node
      const transaction = this.db.transaction(['tiles'], 'readonly');
      const store = transaction.objectStore('tiles');
      const nodeIndex = store.index('nodeIds');
      
      const tilesForNode = await new Promise<any[]>((resolve, reject) => {
        const tiles: any[] = [];
        const request = nodeIndex.openCursor();
        
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const tile = cursor.value;
            if (tile.nodeIds && tile.nodeIds.includes(nodeId)) {
              tiles.push(tile);
            }
            cursor.continue();
          } else {
            resolve(tiles);
          }
        };
        
        request.onerror = () => reject(request.error);
      });

      // Process tiles with blob data
      const processedTiles = await Promise.all(tilesForNode.map(async (tile: any) => {
        if (tile.data && tile.data instanceof Blob) {
          const arrayBuffer = await tile.data.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
          
          return {
            ...tile,
            data: {
              type: 'base64',
              content: base64,
              mimeType: tile.data.type || 'image/png'
            }
          };
        }
        return tile;
      }));

      const mapPackData = {
        node: node,
        tiles: processedTiles,
        exportedAt: new Date(),
        version: this.dbVersion,
        format: 'openmaps-mappack-v1'
      };

      // Create download
      const blob = new Blob([JSON.stringify(mapPackData)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${node.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-mappack.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      
      const sizeMB = Math.round(blob.size / 1024 / 1024);
      console.log(`✅ Map pack exported: ${node.name} (${processedTiles.length} tiles, ${sizeMB}MB)`);
      
      alert(`✅ Map Pack Exported!\n\nRegion: ${node.name}\nTiles: ${processedTiles.length}\nSize: ~${sizeMB}MB\n\nThis file contains all downloaded map tiles for this region and can be imported on another device.`);
      
    } catch (error) {
      console.error('❌ Map pack export failed:', error);
      throw error;
    }
  }

  async importMapPacks(file: File): Promise<void> {
    try {
      const text = await file.text();
      const importData = JSON.parse(text);
      
      console.log('📥 Starting import of map packs...');
      console.log('Import data format:', importData.format);
      
      let importedNodes = 0;
      let importedPacks = 0;
      let importedTiles = 0;

      // Handle different import formats
      if (importData.format === 'openmaps-custompack-v1') {
        // Single custom pack import
        console.log('📦 Importing single custom pack...');
        
        if (importData.pack) {
          // Check if custom pack already exists
          const existingPackIndex = this.customPacks.findIndex(p => p.id === importData.pack.id);
          if (existingPackIndex !== -1) {
            const overwrite = confirm(`Custom pack "${importData.pack.name}" already exists. Overwrite it?`);
            if (overwrite) {
              this.customPacks[existingPackIndex] = importData.pack;
              await this.saveCustomPack(importData.pack);
              importedPacks++;
            }
          } else {
            this.customPacks.push(importData.pack);
            await this.saveCustomPack(importData.pack);
            importedPacks++;
          }
        }
        
        // Import tiles for this custom pack
        if (importData.tiles && Array.isArray(importData.tiles)) {
          importedTiles = await this.importTilesWithProgress(importData.tiles);
        }
        
      } else if (importData.format === 'openmaps-allcustompacks-v1') {
        // All custom packs import
        console.log('📦 Importing all custom packs...');
        
        if (importData.customPacks && Array.isArray(importData.customPacks)) {
          for (const customPackData of importData.customPacks) {
            const pack = customPackData.pack;
            
            // Check if custom pack already exists
            const existingPackIndex = this.customPacks.findIndex(p => p.id === pack.id);
            if (existingPackIndex === -1) {
              this.customPacks.push(pack);
              await this.saveCustomPack(pack);
              importedPacks++;
            }
            
            // Import tiles for this pack
            if (customPackData.tiles && Array.isArray(customPackData.tiles)) {
              const tilesImported = await this.importTilesWithProgress(customPackData.tiles);
              importedTiles += tilesImported;
            }
          }
        }
        
      } else if (importData.format === 'openmaps-mappack-v1') {
        // Single map pack import
        console.log('📦 Importing single map pack...');
        
        if (importData.node) {
          // Import the node
          const existingNodeIndex = this.globalNodes.findIndex(n => n.id === importData.node.id);
          if (existingNodeIndex !== -1) {
            this.globalNodes[existingNodeIndex] = { ...this.globalNodes[existingNodeIndex], ...importData.node };
            await this.saveGlobalNode(this.globalNodes[existingNodeIndex]);
          } else {
            this.globalNodes.push(importData.node);
            await this.saveGlobalNode(importData.node);
          }
          importedNodes++;
        }
        
        // Import tiles for this pack
        if (importData.tiles && Array.isArray(importData.tiles)) {
          importedTiles = await this.importTilesWithProgress(importData.tiles);
        }
        
      } else if (importData.format === 'openmaps-tiles-v1') {
        // Full database import
        console.log('📦 Importing full database...');
        
        // Import global nodes
        if (importData.globalNodes && Array.isArray(importData.globalNodes)) {
          for (const node of importData.globalNodes) {
            const existingNodeIndex = this.globalNodes.findIndex(n => n.id === node.id);
            if (existingNodeIndex !== -1) {
              this.globalNodes[existingNodeIndex] = { ...this.globalNodes[existingNodeIndex], ...node };
              await this.saveGlobalNode(this.globalNodes[existingNodeIndex]);
            } else {
              this.globalNodes.push(node);
              await this.saveGlobalNode(node);
            }
            importedNodes++;
          }
        }

        // Import custom packs
        if (importData.customPacks && Array.isArray(importData.customPacks)) {
          for (const pack of importData.customPacks) {
            const existingPackIndex = this.customPacks.findIndex(p => p.id === pack.id);
            if (existingPackIndex === -1) {
              this.customPacks.push(pack);
              await this.saveCustomPack(pack);
              importedPacks++;
            }
          }
        }

        // Import tiles
        if (importData.tiles && Array.isArray(importData.tiles)) {
          importedTiles = await this.importTilesWithProgress(importData.tiles);
        }
        
      } else {
        // Legacy format fallback
        console.log('📦 Importing legacy format...');
        
        // Validate import data structure
        if (!importData.globalNodes && !importData.customPacks && !importData.tiles) {
          throw new Error('Invalid import file: no recognizable data found');
        }

        // Import global nodes
        if (importData.globalNodes && Array.isArray(importData.globalNodes)) {
          for (const node of importData.globalNodes) {
            const existingNodeIndex = this.globalNodes.findIndex(n => n.id === node.id);
            if (existingNodeIndex !== -1) {
              this.globalNodes[existingNodeIndex] = { ...this.globalNodes[existingNodeIndex], ...node };
              await this.saveGlobalNode(this.globalNodes[existingNodeIndex]);
            } else {
              this.globalNodes.push(node);
              await this.saveGlobalNode(node);
            }
            importedNodes++;
          }
        }

        // Import custom packs
        if (importData.customPacks && Array.isArray(importData.customPacks)) {
          for (const pack of importData.customPacks) {
            const existingPackIndex = this.customPacks.findIndex(p => p.id === pack.id);
            if (existingPackIndex === -1) {
              this.customPacks.push(pack);
              await this.saveCustomPack(pack);
              importedPacks++;
            }
          }
        }

        // Import tiles if available
        if (importData.tiles && Array.isArray(importData.tiles)) {
          importedTiles = await this.importTilesWithProgress(importData.tiles);
        }
      }

      // Notify listeners of changes
      this.notifyNavigationChange();
      this.notifyCustomPacksChange();

      console.log(`✅ Import completed: ${importedNodes} nodes, ${importedPacks} custom packs, ${importedTiles} tiles`);
      
      alert(`✅ Import Successful!\n\nImported:\n• ${importedNodes} map regions\n• ${importedPacks} custom polygons\n• ${importedTiles} map tiles\n\nExported on: ${importData.exportedAt ? new Date(importData.exportedAt).toLocaleDateString() : 'Unknown'}`);
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      alert(`❌ Import Failed\n\n${error.message}\n\nPlease check that you're importing a valid OpenMaps export file.`);
      throw error;
    }
  }

  private async importTilesWithProgress(tiles: any[]): Promise<number> {
    console.log(`📦 Importing ${tiles.length} tiles (this may take a while)...`);
    
    let importedCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < tiles.length; i += batchSize) {
      const batch = tiles.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (tile) => {
        try {
          // Convert base64 data back to blob if needed
          if (tile.data && tile.data.type === 'base64') {
            const binaryString = atob(tile.data.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let j = 0; j < binaryString.length; j++) {
              bytes[j] = binaryString.charCodeAt(j);
            }
            tile.data = new Blob([bytes], { type: tile.data.mimeType || 'image/png' });
          }
          
          await this.saveTile(tile);
          importedCount++;
        } catch (error) {
          console.warn(`Failed to import tile ${tile.x}/${tile.y}/${tile.z}:`, error);
        }
      }));
      
      // Progress feedback
      if (i % 1000 === 0 && i > 0) {
        console.log(`📦 Imported ${i} tiles...`);
      }
    }
    
    return importedCount;
  }

  private async getAllFromStore(store: IDBObjectStore): Promise<any[]> {
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== MEMORY AND DOWNLOAD WARNINGS ====================
  validateDownloadLimits(nodeId: string, minZoom: number, maxZoom: number): {
    valid: boolean;
    warning?: string;
    estimatedTiles: number;
    estimatedSizeMB: number;
  } {
    const node = getNodeById(nodeId, this.globalNodes);
    if (!node) {
      return { valid: false, warning: 'Node not found', estimatedTiles: 0, estimatedSizeMB: 0 };
    }

    // Calculate estimated tiles for the zoom range
    let estimatedTiles = 0;
    for (let z = minZoom; z <= maxZoom; z++) {
      if (node.level === 'world') {
        // World downloads: exponential growth
        estimatedTiles += Math.pow(4, z);
      } else {
        // Regional downloads: more reasonable estimation
        const bounds = node.bounds;
        const width = bounds.east - bounds.west;
        const height = bounds.north - bounds.south;
        const tilesAtZoom = Math.ceil(width * height * Math.pow(4, z - 10));
        estimatedTiles += Math.max(1, tilesAtZoom);
      }
    }

    const estimatedSizeMB = Math.round((estimatedTiles * 15) / 1024); // ~15KB per tile

    // Define limits
    const TILE_LIMIT_WARNING = 100000;  // 100k tiles
    const TILE_LIMIT_DANGER = 1000000;  // 1M tiles
    const SIZE_LIMIT_WARNING = 1500;    // 1.5GB
    const SIZE_LIMIT_DANGER = 5000;     // 5GB

    let warning: string | undefined;

    if (node.level === 'world' && maxZoom >= 16) {
      return {
        valid: false,
        warning: `🚫 World downloads above zoom level 15 are not supported due to memory limitations.\n\nRequested: Zoom ${minZoom}-${maxZoom}\nEstimated: ${estimatedTiles.toLocaleString()} tiles (${estimatedSizeMB.toLocaleString()}MB)\n\nRecommendation: Use zoom 1-15 for world downloads, or create custom polygons for specific regions at higher zoom levels (up to 18).`,
        estimatedTiles,
        estimatedSizeMB
      };
    }

    if (estimatedTiles > TILE_LIMIT_DANGER) {
      warning = `⚠️ VERY LARGE DOWNLOAD WARNING\n\nThis download is extremely large and may:\n• Crash your browser\n• Take hours to complete\n• Use ${estimatedSizeMB.toLocaleString()}MB of storage\n\nEstimated: ${estimatedTiles.toLocaleString()} tiles\n\nRecommendation: Create smaller custom polygons instead.`;
    } else if (estimatedTiles > TILE_LIMIT_WARNING || estimatedSizeMB > SIZE_LIMIT_WARNING) {
      warning = `⚠️ Large Download Warning\n\nThis download is quite large:\n• ${estimatedTiles.toLocaleString()} tiles\n• ~${estimatedSizeMB.toLocaleString()}MB storage\n• May take significant time\n\nContinue anyway?`;
    }

    return {
      valid: estimatedTiles <= TILE_LIMIT_DANGER,
      warning,
      estimatedTiles,
      estimatedSizeMB
    };
  }

  // ==================== CLEANUP ====================
  async cleanup(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.downloadQueue.clear();
    this.downloadProgressCallbacks = [];
    this.navigationCallbacks = [];
    this.customPackCallbacks = [];
  }
}

// Export singleton instance
export const globalMapPackSystem = new GlobalMapPackSystem();
