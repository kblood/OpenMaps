import NodeCache from 'node-cache';

class CacheService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes default TTL
      checkperiod: 60, // Check for expired keys every 60 seconds
      useClones: false
    });
  }

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    return this.cache.set(key, value, ttl || 300);
  }

  delete(key: string): number {
    return this.cache.del(key);
  }

  flush(): void {
    this.cache.flushAll();
  }

  getStats() {
    return this.cache.getStats();
  }

  // Specific cache methods for different data types
  cacheGeocodingResult(query: string, result: any, ttl: number = 3600): boolean {
    const key = `geocoding:${query.toLowerCase().trim()}`;
    return this.set(key, result, ttl);
  }

  getGeocodingResult(query: string): any {
    const key = `geocoding:${query.toLowerCase().trim()}`;
    return this.get(key);
  }

  cacheRoute(start: string, end: string, result: any, ttl: number = 1800): boolean {
    const key = `route:${start}:${end}`;
    return this.set(key, result, ttl);
  }

  getRoute(start: string, end: string): any {
    const key = `route:${start}:${end}`;
    return this.get(key);
  }

  cachePlaceDetails(placeId: string, result: any, ttl: number = 3600): boolean {
    const key = `place:${placeId}`;
    return this.set(key, result, ttl);
  }

  getPlaceDetails(placeId: string): any {
    const key = `place:${placeId}`;
    return this.get(key);
  }
}

export const cacheService = new CacheService();