// Loading Coordinator - Prevents Duplicate API Calls and Manages Cross-Branch Sharing

import { LoadingState, LoadingPriority, LocationRegistryNode } from './types';

export class LoadingCoordinator {
  private activeLoads: Map<string, LoadingState> = new Map();
  private stats = {
    totalLoads: 0,
    sharedLoads: 0,
    avgLoadTime: 0,
    activeCount: 0
  };

  /**
   * Coordinate loading of children for a location, sharing across tree branches
   */
  async loadChildren(
    parentId: string, 
    accessPath: string, 
    loadFunction: () => Promise<LocationRegistryNode[]>,
    priority: LoadingPriority = LoadingPriority.USER_INITIATED
  ): Promise<LocationRegistryNode[]> {
    const loadKey = `children_${parentId}`;
    
    // Check if already loading
    if (this.activeLoads.has(loadKey)) {
      const existing = this.activeLoads.get(loadKey)!;
      
      // Add this access path to the loading state
      existing.accessPaths.add(accessPath);
      
      // Upgrade priority if higher
      if (priority < existing.priority) {
        existing.priority = priority;
        console.log(`🔺 Upgraded loading priority for ${parentId} to ${LoadingPriority[priority]} due to ${accessPath}`);
      }
      
      this.stats.sharedLoads++;
      console.log(`🔄 Sharing loading for ${parentId} across ${existing.accessPaths.size} paths: ${Array.from(existing.accessPaths).join(', ')}`);
      
      return existing.promise;
    }

    // Start new coordinated load
    const startTime = Date.now();
    const loadingPromise = this.performCoordinatedLoad(parentId, loadFunction, startTime);
    
    const loadingState: LoadingState = {
      promise: loadingPromise,
      accessPaths: new Set([accessPath]),
      startTime,
      priority,
      parentId
    };

    this.activeLoads.set(loadKey, loadingState);
    this.stats.activeCount = this.activeLoads.size;
    this.stats.totalLoads++;

    try {
      const result = await loadingState.promise;
      const loadTime = Date.now() - startTime;
      
      // Update stats
      this.updateLoadStats(loadTime);
      
      console.log(`✅ Loaded ${result.length} children for ${parentId} in ${loadTime}ms, shared with ${loadingState.accessPaths.size} paths: ${Array.from(loadingState.accessPaths).join(', ')}`);
      
      return result;
    } finally {
      this.activeLoads.delete(loadKey);
      this.stats.activeCount = this.activeLoads.size;
    }
  }

  /**
   * Load a single location, coordinating across different access attempts
   */
  async loadLocation(
    locationId: string,
    accessPath: string,
    loadFunction: () => Promise<LocationRegistryNode | null>,
    priority: LoadingPriority = LoadingPriority.USER_INITIATED
  ): Promise<LocationRegistryNode | null> {
    
    // Convert single location load to array format for consistency
    const arrayLoadFunction = async (): Promise<LocationRegistryNode[]> => {
      const result = await loadFunction();
      return result ? [result] : [];
    };

    const results = await this.loadChildren(locationId, accessPath, arrayLoadFunction, priority);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Cancel loading for a specific access path
   */
  cancelLoading(parentId: string, accessPath: string): boolean {
    const loadKey = `children_${parentId}`;
    const loadingState = this.activeLoads.get(loadKey);
    
    if (!loadingState) {
      return false;
    }

    loadingState.accessPaths.delete(accessPath);
    
    // If no more access paths, we could potentially cancel the entire load
    // But for now, let it complete since other paths might still need it
    if (loadingState.accessPaths.size === 0) {
      console.log(`⚠️ All access paths cancelled for ${parentId}, but allowing load to complete`);
    }

    return true;
  }

  /**
   * Get current loading statistics
   */
  getStats() {
    const sharedLoadPercentage = this.stats.totalLoads > 0 
      ? Math.round((this.stats.sharedLoads / this.stats.totalLoads) * 100)
      : 0;

    return {
      ...this.stats,
      sharedLoadPercentage,
      efficiency: `${sharedLoadPercentage}% loads shared across branches`
    };
  }

  /**
   * Get currently active loads with their access paths
   */
  getActiveLoads(): Array<{parentId: string, accessPaths: string[], priority: string, duration: number}> {
    const now = Date.now();
    
    return Array.from(this.activeLoads.entries()).map(([, state]) => ({
      parentId: state.parentId,
      accessPaths: Array.from(state.accessPaths),
      priority: LoadingPriority[state.priority],
      duration: now - state.startTime
    }));
  }

  /**
   * Clear all loading states (useful for testing/reset)
   */
  clearAll(): void {
    console.log(`🗑️ Clearing ${this.activeLoads.size} active loads`);
    this.activeLoads.clear();
    this.stats = {
      totalLoads: 0,
      sharedLoads: 0,
      avgLoadTime: 0,
      activeCount: 0
    };
  }

  private async performCoordinatedLoad(
    parentId: string, 
    loadFunction: () => Promise<LocationRegistryNode[]>, 
    _startTime: number
  ): Promise<LocationRegistryNode[]> {
    try {
      console.log(`🔄 Starting coordinated load for ${parentId}`);
      return await loadFunction();
    } catch (error) {
      console.error(`❌ Coordinated load failed for ${parentId}:`, error);
      throw error;
    }
  }

  private updateLoadStats(loadTime: number): void {
    // Update average load time with exponential moving average
    if (this.stats.avgLoadTime === 0) {
      this.stats.avgLoadTime = loadTime;
    } else {
      this.stats.avgLoadTime = Math.round(this.stats.avgLoadTime * 0.8 + loadTime * 0.2);
    }
  }

  /**
   * Check if a location is currently being loaded
   */
  isLoading(parentId: string): boolean {
    return this.activeLoads.has(`children_${parentId}`);
  }

  /**
   * Get access paths for a currently loading location
   */
  getLoadingAccessPaths(parentId: string): string[] {
    const loadingState = this.activeLoads.get(`children_${parentId}`);
    return loadingState ? Array.from(loadingState.accessPaths) : [];
  }
}

export const loadingCoordinator = new LoadingCoordinator();
