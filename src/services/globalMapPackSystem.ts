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
  async downloadNode(nodeId: string, layerIds: string[] = ['openstreetmap']): Promise<void> {
    const node = getNodeById(nodeId, this.globalNodes);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    console.log(`🌍 Starting download for ${node.name} (${node.estimatedTiles} tiles, ~${node.estimatedSizeMB}MB)`);

    const progress: DownloadProgress = {
      current: 0,
      total: node.estimatedTiles,
      nodeId,
      status: 'downloading',
      speed: 0,
      estimatedTimeRemaining: 0
    };

    this.downloadQueue.set(nodeId, progress);
    this.notifyDownloadProgress(progress);

    try {
      const tiles = this.generateTileList(node.bounds, layerIds, 1, 15);
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
      const response = await fetch(tile.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const tileData = {
        ...tile,
        data: blob,
        downloaded: true,
        nodeIds: [nodeId],
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

  // ==================== CUSTOM POLYGON PACKS ====================
  async createCustomPack(
    name: string,
    description: string,
    polygon: [number, number][],
    zoomLevels: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
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
      await this.downloadTilesParallel(tiles, packId, progress);
      
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
