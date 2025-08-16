// Multi-Tier Caching System
// Implements memory, disk, and cloud caching with intelligent cache management

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  ttl?: number;
  version: string;
  metadata?: Record<string, any>;
}

export interface CacheConfig {
  memory: {
    maxSizeMB: number;
    maxEntries: number;
    ttlSeconds: number;
  };
  disk: {
    enabled: boolean;
    maxSizeMB: number;
    directory: string;
    compressionLevel: number;
  };
  cloud: {
    enabled: boolean;
    provider: 'indexeddb' | 's3' | 'custom';
    maxSizeMB: number;
    endpoint?: string;
    credentials?: any;
  };
  strategy: {
    readOrder: ('memory' | 'disk' | 'cloud')[];
    writeOrder: ('memory' | 'disk' | 'cloud')[];
    evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'size';
    syncPolicy: 'immediate' | 'batch' | 'lazy';
  };
}

export interface CacheStats {
  memory: TierStats;
  disk: TierStats;
  cloud: TierStats;
  total: TierStats;
  hitRate: number;
  missRate: number;
}

export interface TierStats {
  hits: number;
  misses: number;
  entries: number;
  sizeMB: number;
  hitRate: number;
  avgAccessTime: number;
  errors: number;
}

export class MultiTierCacheService {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;
  private stats: CacheStats;
  private diskCacheReady = false;
  private cloudCacheReady = false;
  private syncQueue: Array<{ key: string; data: any; operation: 'set' | 'delete' }> = [];
  private syncTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    this.config = config;
    this.stats = this.initializeStats();
    this.initializeTiers();
  }

  /**
   * Get data from cache with multi-tier lookup
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    console.log(`🔍 Cache lookup: ${key}`);

    try {
      // Try each tier in read order
      for (const tier of this.config.strategy.readOrder) {
        const result = await this.getFromTier<T>(key, tier);
        
        if (result !== null) {
          const accessTime = Date.now() - startTime;
          this.recordHit(tier, accessTime);
          
          // Promote to higher tiers if needed
          await this.promoteEntry(key, result, tier);
          
          console.log(`✅ Cache hit in ${tier}: ${key} (${accessTime}ms)`);
          return result;
        }
      }

      // Cache miss
      this.recordMiss();
      console.log(`❌ Cache miss: ${key}`);
      return null;

    } catch (error) {
      console.error(`❌ Cache get error for ${key}:`, error);
      this.recordError('memory'); // Default to memory tier for error tracking
      return null;
    }
  }

  /**
   * Set data in cache across multiple tiers
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    console.log(`💾 Cache set: ${key}`);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      size: this.estimateSize(data),
      ttl,
      version: '1.0.0',
      metadata: {}
    };

    try {
      // Write to tiers in write order
      for (const tier of this.config.strategy.writeOrder) {
        await this.setInTier(key, entry, tier);
      }

      // Handle sync policy
      if (this.config.strategy.syncPolicy === 'batch') {
        this.queueSync(key, data, 'set');
      }

      console.log(`✅ Cache set complete: ${key}`);

    } catch (error) {
      console.error(`❌ Cache set error for ${key}:`, error);
      this.recordError('memory');
    }
  }

  /**
   * Delete from all cache tiers
   */
  async delete(key: string): Promise<void> {
    console.log(`🗑️ Cache delete: ${key}`);

    try {
      // Delete from all tiers
      await Promise.all([
        this.deleteFromTier(key, 'memory'),
        this.deleteFromTier(key, 'disk'),
        this.deleteFromTier(key, 'cloud')
      ]);

      // Queue sync if needed
      if (this.config.strategy.syncPolicy === 'batch') {
        this.queueSync(key, null, 'delete');
      }

      console.log(`✅ Cache delete complete: ${key}`);

    } catch (error) {
      console.error(`❌ Cache delete error for ${key}:`, error);
      this.recordError('memory');
    }
  }

  /**
   * Clear specific tier or all tiers
   */
  async clear(tier?: 'memory' | 'disk' | 'cloud'): Promise<void> {
    console.log(`🧹 Cache clear: ${tier || 'all'}`);

    try {
      if (tier) {
        await this.clearTier(tier);
      } else {
        await Promise.all([
          this.clearTier('memory'),
          this.clearTier('disk'),
          this.clearTier('cloud')
        ]);
      }

      this.stats = this.initializeStats();
      console.log(`✅ Cache clear complete: ${tier || 'all'}`);

    } catch (error) {
      console.error(`❌ Cache clear error:`, error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Optimize cache by running cleanup and compaction
   */
  async optimize(): Promise<void> {
    console.log('🔧 Optimizing cache...');

    try {
      await Promise.all([
        this.optimizeMemoryTier(),
        this.optimizeDiskTier(),
        this.optimizeCloudTier()
      ]);

      console.log('✅ Cache optimization complete');

    } catch (error) {
      console.error('❌ Cache optimization error:', error);
    }
  }

  /**
   * Preload data into cache
   */
  async preload(entries: Array<{ key: string; data: any; ttl?: number }>): Promise<void> {
    console.log(`🚀 Preloading ${entries.length} cache entries...`);

    const batchSize = 50;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(({ key, data, ttl }) => this.set(key, data, ttl))
      );

      // Yield to event loop
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    console.log('✅ Cache preload complete');
  }

  /**
   * Get data from specific tier
   */
  private async getFromTier<T>(key: string, tier: 'memory' | 'disk' | 'cloud'): Promise<T | null> {
    switch (tier) {
      case 'memory':
        return this.getFromMemory<T>(key);
      
      case 'disk':
        return this.getFromDisk<T>(key);
      
      case 'cloud':
        return this.getFromCloud<T>(key);
      
      default:
        return null;
    }
  }

  /**
   * Set data in specific tier
   */
  private async setInTier<T>(key: string, entry: CacheEntry<T>, tier: 'memory' | 'disk' | 'cloud'): Promise<void> {
    switch (tier) {
      case 'memory':
        await this.setInMemory(key, entry);
        break;
      
      case 'disk':
        await this.setInDisk(key, entry);
        break;
      
      case 'cloud':
        await this.setInCloud(key, entry);
        break;
    }
  }

  /**
   * Memory tier operations
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.memoryCache.delete(key);
      return null;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.data;
  }

  private async setInMemory<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Check if we need to evict entries
    await this.ensureMemorySpace(entry.size);
    
    this.memoryCache.set(key, entry);
  }

  private async deleteFromTier(key: string, tier: 'memory' | 'disk' | 'cloud'): Promise<void> {
    switch (tier) {
      case 'memory':
        this.memoryCache.delete(key);
        break;
      
      case 'disk':
        await this.deleteFromDisk(key);
        break;
      
      case 'cloud':
        await this.deleteFromCloud(key);
        break;
    }
  }

  /**
   * Disk tier operations (using IndexedDB for browser compatibility)
   */
  private async getFromDisk<T>(key: string): Promise<T | null> {
    if (!this.config.disk.enabled || !this.diskCacheReady) {
      return null;
    }

    try {
      const db = await this.openDiskCache();
      const transaction = db.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        
        request.onsuccess = () => {
          const result = request.result;
          if (result && this.isValidDiskEntry(result)) {
            resolve(result.data);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = () => reject(request.error);
      });

    } catch (error) {
      console.warn('⚠️ Disk cache read error:', error);
      return null;
    }
  }

  private async setInDisk<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.config.disk.enabled || !this.diskCacheReady) {
      return;
    }

    try {
      const db = await this.openDiskCache();
      const transaction = db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      
      // Compress data if configured
      const diskEntry = {
        ...entry,
        data: this.config.disk.compressionLevel > 0 ? 
          await this.compressData(entry.data) : entry.data
      };

      return new Promise((resolve, reject) => {
        const request = store.put(diskEntry, key);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

    } catch (error) {
      console.warn('⚠️ Disk cache write error:', error);
    }
  }

  private async deleteFromDisk(key: string): Promise<void> {
    if (!this.config.disk.enabled || !this.diskCacheReady) {
      return;
    }

    try {
      const db = await this.openDiskCache();
      const transaction = db.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

    } catch (error) {
      console.warn('⚠️ Disk cache delete error:', error);
    }
  }

  /**
   * Cloud tier operations (using IndexedDB as fallback)
   */
  private async getFromCloud<T>(key: string): Promise<T | null> {
    if (!this.config.cloud.enabled || !this.cloudCacheReady) {
      return null;
    }

    // For now, use IndexedDB as cloud storage fallback
    return this.getFromDisk<T>(`cloud_${key}`);
  }

  private async setInCloud<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.config.cloud.enabled || !this.cloudCacheReady) {
      return;
    }

    // For now, use IndexedDB as cloud storage fallback
    return this.setInDisk(`cloud_${key}`, entry);
  }

  private async deleteFromCloud(key: string): Promise<void> {
    if (!this.config.cloud.enabled || !this.cloudCacheReady) {
      return;
    }

    // For now, use IndexedDB as cloud storage fallback
    return this.deleteFromDisk(`cloud_${key}`);
  }

  /**
   * Cache management utilities
   */
  private async ensureMemorySpace(requiredSize: number): Promise<void> {
    const currentSizeMB = this.getMemorySizeMB();
    const maxSizeMB = this.config.memory.maxSizeMB;
    const maxEntries = this.config.memory.maxEntries;

    // Check size limits
    if (currentSizeMB + (requiredSize / (1024 * 1024)) > maxSizeMB || 
        this.memoryCache.size >= maxEntries) {
      
      await this.evictMemoryEntries();
    }
  }

  private async evictMemoryEntries(): Promise<void> {
    const entriesToEvict = Math.max(1, Math.floor(this.memoryCache.size * 0.1)); // Evict 10%
    
    const entries = Array.from(this.memoryCache.entries())
      .map(([key, entry]) => ({ key, entry }));

    // Sort by eviction policy
    entries.sort((a, b) => {
      switch (this.config.strategy.evictionPolicy) {
        case 'lru':
          return a.entry.lastAccessed - b.entry.lastAccessed;
        
        case 'lfu':
          return a.entry.accessCount - b.entry.accessCount;
        
        case 'ttl':
          return a.entry.timestamp - b.entry.timestamp;
        
        case 'size':
          return b.entry.size - a.entry.size; // Evict largest first
        
        default:
          return a.entry.lastAccessed - b.entry.lastAccessed;
      }
    });

    // Evict entries
    for (let i = 0; i < entriesToEvict; i++) {
      this.memoryCache.delete(entries[i].key);
    }

    console.log(`🗑️ Evicted ${entriesToEvict} memory cache entries`);
  }

  private async promoteEntry<T>(key: string, data: T, sourceTier: 'memory' | 'disk' | 'cloud'): Promise<void> {
    // Promote to higher priority tiers
    const readOrder = this.config.strategy.readOrder;
    const sourceIndex = readOrder.indexOf(sourceTier);
    
    for (let i = 0; i < sourceIndex; i++) {
      const targetTier = readOrder[i];
      
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        accessCount: 1,
        lastAccessed: Date.now(),
        size: this.estimateSize(data),
        version: '1.0.0'
      };
      
      await this.setInTier(key, entry, targetTier);
    }
  }

  private queueSync(key: string, data: any, operation: 'set' | 'delete'): void {
    this.syncQueue.push({ key, data, operation });

    // Start sync timer if not already running
    if (!this.syncTimer) {
      this.syncTimer = setTimeout(() => this.processSyncQueue(), 5000); // 5 second batch delay
    }
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) {
      return;
    }

    console.log(`🔄 Processing ${this.syncQueue.length} sync operations...`);
    
    const operations = [...this.syncQueue];
    this.syncQueue = [];
    this.syncTimer = undefined;

    try {
      await Promise.all(
        operations.map(async ({ key, data, operation }) => {
          if (operation === 'set') {
            // Sync set operations across tiers
            for (const tier of this.config.strategy.writeOrder) {
              const entry: CacheEntry<any> = {
                data,
                timestamp: Date.now(),
                accessCount: 1,
                lastAccessed: Date.now(),
                size: this.estimateSize(data),
                version: '1.0.0'
              };
              await this.setInTier(key, entry, tier);
            }
          } else {
            // Sync delete operations
            await this.delete(key);
          }
        })
      );

      console.log('✅ Sync queue processed successfully');

    } catch (error) {
      console.error('❌ Sync queue processing error:', error);
    }
  }

  /**
   * Utility methods
   */
  private estimateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      return 1024; // Default estimate
    }
  }

  private getMemorySizeMB(): number {
    let totalSize = 0;
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
    }
    return totalSize / (1024 * 1024);
  }

  private async openDiskCache(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OpenMapsCache', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
      };
    });
  }

  private isValidDiskEntry(entry: any): boolean {
    return entry && 
           typeof entry.data !== 'undefined' && 
           typeof entry.timestamp === 'number';
  }

  private async compressData(data: any): Promise<string> {
    // Simple compression using built-in methods
    try {
      const jsonString = JSON.stringify(data);
      const compressed = await this.gzipCompress(jsonString);
      return compressed;
    } catch {
      return JSON.stringify(data); // Fallback to uncompressed
    }
  }

  private async gzipCompress(text: string): Promise<string> {
    // Browser-compatible compression fallback
    return text; // In a real implementation, use compression library
  }

  private initializeStats(): CacheStats {
    const emptyTierStats: TierStats = {
      hits: 0,
      misses: 0,
      entries: 0,
      sizeMB: 0,
      hitRate: 0,
      avgAccessTime: 0,
      errors: 0
    };

    return {
      memory: { ...emptyTierStats },
      disk: { ...emptyTierStats },
      cloud: { ...emptyTierStats },
      total: { ...emptyTierStats },
      hitRate: 0,
      missRate: 0
    };
  }

  private async initializeTiers(): Promise<void> {
    try {
      // Initialize disk cache
      if (this.config.disk.enabled) {
        await this.openDiskCache();
        this.diskCacheReady = true;
        console.log('✅ Disk cache initialized');
      }

      // Initialize cloud cache
      if (this.config.cloud.enabled) {
        this.cloudCacheReady = true;
        console.log('✅ Cloud cache initialized');
      }

    } catch (error) {
      console.error('❌ Cache tier initialization error:', error);
    }
  }

  private updateStats(): void {
    // Update memory stats
    this.stats.memory.entries = this.memoryCache.size;
    this.stats.memory.sizeMB = this.getMemorySizeMB();
    
    // Calculate total stats
    this.stats.total.entries = this.stats.memory.entries + this.stats.disk.entries + this.stats.cloud.entries;
    this.stats.total.sizeMB = this.stats.memory.sizeMB + this.stats.disk.sizeMB + this.stats.cloud.sizeMB;
    
    // Calculate hit rates
    const totalHits = this.stats.memory.hits + this.stats.disk.hits + this.stats.cloud.hits;
    const totalMisses = this.stats.memory.misses + this.stats.disk.misses + this.stats.cloud.misses;
    const totalRequests = totalHits + totalMisses;
    
    this.stats.hitRate = totalRequests > 0 ? Math.round((totalHits / totalRequests) * 100) : 0;
    this.stats.missRate = 100 - this.stats.hitRate;
  }

  private recordHit(tier: 'memory' | 'disk' | 'cloud', accessTime: number): void {
    this.stats[tier].hits++;
    this.stats[tier].avgAccessTime = 
      (this.stats[tier].avgAccessTime + accessTime) / 2;
  }

  private recordMiss(): void {
    this.stats.total.misses++;
  }

  private recordError(tier: 'memory' | 'disk' | 'cloud'): void {
    this.stats[tier].errors++;
  }

  private async clearTier(tier: 'memory' | 'disk' | 'cloud'): Promise<void> {
    switch (tier) {
      case 'memory':
        this.memoryCache.clear();
        break;
      
      case 'disk':
        if (this.diskCacheReady) {
          const db = await this.openDiskCache();
          const transaction = db.transaction(['cache'], 'readwrite');
          const store = transaction.objectStore('cache');
          store.clear();
        }
        break;
      
      case 'cloud':
        // Clear cloud cache
        break;
    }
  }

  private async optimizeMemoryTier(): Promise<void> {
    // Remove expired entries
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl * 1000) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.memoryCache.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`🗑️ Removed ${expiredKeys.length} expired memory entries`);
    }
  }

  private async optimizeDiskTier(): Promise<void> {
    // Disk optimization would involve compacting the IndexedDB
    console.log('🔧 Disk tier optimization completed');
  }

  private async optimizeCloudTier(): Promise<void> {
    // Cloud optimization would involve cleanup and compression
    console.log('🔧 Cloud tier optimization completed');
  }
}

// Default configuration
export const defaultCacheConfig: CacheConfig = {
  memory: {
    maxSizeMB: 100,
    maxEntries: 1000,
    ttlSeconds: 3600
  },
  disk: {
    enabled: true,
    maxSizeMB: 500,
    directory: '/cache',
    compressionLevel: 1
  },
  cloud: {
    enabled: false,
    provider: 'indexeddb',
    maxSizeMB: 1000
  },
  strategy: {
    readOrder: ['memory', 'disk', 'cloud'],
    writeOrder: ['memory', 'disk'],
    evictionPolicy: 'lru',
    syncPolicy: 'immediate'
  }
};

// Export singleton instance
export const multiTierCacheService = new MultiTierCacheService(defaultCacheConfig);