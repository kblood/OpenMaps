// Adaptive Hierarchy Service
// Creates intelligent administrative hierarchies based on real OSM admin_levels

import { OSMAdminBoundary, AdminHierarchy, osmAdminBoundaryService } from './osmAdminBoundaryService';

export interface HierarchyNode {
  id: string;
  boundary: OSMAdminBoundary;
  children: HierarchyNode[];
  parent?: HierarchyNode;
  path: string[];
  depth: number;
  isExpanded: boolean;
  loadingState: 'idle' | 'loading' | 'loaded' | 'error';
  childrenCount?: number;
  spatialIndex?: any; // For future spatial indexing
}

export interface AdaptiveHierarchyConfig {
  countryCode: string;
  maxDepth: number;
  prioritizeLevels: number[]; // Admin levels to prioritize
  includeGeometry: boolean;
  spatialIndexing: boolean;
  cacheStrategy: 'memory' | 'disk' | 'hybrid';
}

export interface HierarchyStats {
  totalNodes: number;
  loadedNodes: number;
  totalLevels: number;
  avgChildrenPerNode: number;
  deepestLevel: number;
  cacheHitRate: number;
}

export class AdaptiveHierarchyService {
  private hierarchies = new Map<string, HierarchyNode>();
  private nodeIndex = new Map<string, HierarchyNode>();
  private levelMappings = new Map<string, number[]>(); // Country -> available admin levels
  private loadingPromises = new Map<string, Promise<HierarchyNode[]>>();

  /**
   * Build adaptive hierarchy for a country
   */
  async buildHierarchy(config: AdaptiveHierarchyConfig): Promise<HierarchyNode> {
    const cacheKey = `hierarchy_${config.countryCode}`;
    
    if (this.hierarchies.has(cacheKey)) {
      console.log(`📦 Returning cached hierarchy for ${config.countryCode}`);
      return this.hierarchies.get(cacheKey)!;
    }

    console.log(`🏗️ Building adaptive hierarchy for ${config.countryCode}`);
    
    try {
      // First, discover available admin levels for this country
      const availableLevels = await this.discoverAdminLevels(config.countryCode);
      this.levelMappings.set(config.countryCode, availableLevels);
      
      console.log(`📊 Available admin levels for ${config.countryCode}: ${availableLevels.join(', ')}`);

      // Build the root node (country level)
      const countryBoundaries = await osmAdminBoundaryService.getBoundariesByLevel(config.countryCode, 2, config.includeGeometry);
      const countryBoundary = countryBoundaries[0];
      
      if (!countryBoundary) {
        throw new Error(`Country boundary not found for ${config.countryCode}`);
      }

      const rootNode: HierarchyNode = {
        id: countryBoundary.id,
        boundary: countryBoundary,
        children: [],
        path: [countryBoundary.id],
        depth: 0,
        isExpanded: false,
        loadingState: 'idle'
      };

      // Index the root node
      this.nodeIndex.set(rootNode.id, rootNode);

      // Determine the optimal hierarchy structure
      const optimalStructure = this.determineOptimalStructure(availableLevels, config);
      console.log(`🎯 Optimal hierarchy structure: ${optimalStructure.join(' → ')}`);

      // Build the initial levels
      await this.buildInitialLevels(rootNode, optimalStructure, config);

      this.hierarchies.set(cacheKey, rootNode);
      console.log(`✅ Hierarchy built for ${config.countryCode}`);
      
      return rootNode;
    } catch (error) {
      console.error(`❌ Failed to build hierarchy for ${config.countryCode}:`, error);
      throw error;
    }
  }

  /**
   * Expand a node to load its children
   */
  async expandNode(nodeId: string, config: AdaptiveHierarchyConfig): Promise<HierarchyNode[]> {
    const node = this.nodeIndex.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    if (node.loadingState === 'loaded') {
      console.log(`📦 Node ${nodeId} already loaded`);
      return node.children;
    }

    if (node.loadingState === 'loading') {
      console.log(`⏳ Node ${nodeId} already loading`);
      return this.loadingPromises.get(nodeId) || Promise.resolve([]);
    }

    const loadPromise = this.performNodeExpansion(node, config);
    this.loadingPromises.set(nodeId, loadPromise);
    
    try {
      const children = await loadPromise;
      node.loadingState = 'loaded';
      node.isExpanded = true;
      return children;
    } catch (error) {
      node.loadingState = 'error';
      throw error;
    } finally {
      this.loadingPromises.delete(nodeId);
    }
  }

  /**
   * Search within hierarchy
   */
  async searchHierarchy(countryCode: string, query: string, maxResults = 20): Promise<HierarchyNode[]> {
    console.log(`🔍 Searching hierarchy for "${query}" in ${countryCode}`);
    
    // Search using OSM boundary service
    const searchResults = await osmAdminBoundaryService.searchBoundaries(query, countryCode, false);
    
    const hierarchyNodes: HierarchyNode[] = [];
    
    for (const boundary of searchResults.slice(0, maxResults)) {
      let node = this.nodeIndex.get(boundary.id);
      
      if (!node) {
        // Create a temporary node for search results
        node = {
          id: boundary.id,
          boundary,
          children: [],
          path: [boundary.id],
          depth: this.estimateDepthFromAdminLevel(boundary.adminLevel),
          isExpanded: false,
          loadingState: 'idle'
        };
      }
      
      hierarchyNodes.push(node);
    }
    
    // Sort by relevance (admin level, population, name similarity)
    hierarchyNodes.sort((a, b) => {
      const aLevel = a.boundary.adminLevel;
      const bLevel = b.boundary.adminLevel;
      
      // Prefer lower admin levels (more specific)
      if (aLevel !== bLevel) {
        return bLevel - aLevel;
      }
      
      // Then by population
      const aPop = a.boundary.population || 0;
      const bPop = b.boundary.population || 0;
      if (aPop !== bPop) {
        return bPop - aPop;
      }
      
      // Finally alphabetically
      return a.boundary.name.localeCompare(b.boundary.name);
    });
    
    console.log(`✅ Found ${hierarchyNodes.length} hierarchy matches`);
    return hierarchyNodes;
  }

  /**
   * Get hierarchy statistics
   */
  getHierarchyStats(countryCode: string): HierarchyStats | null {
    const hierarchy = this.hierarchies.get(`hierarchy_${countryCode}`);
    if (!hierarchy) {
      return null;
    }

    const stats = this.calculateNodeStats(hierarchy);
    return {
      totalNodes: stats.totalNodes,
      loadedNodes: stats.loadedNodes,
      totalLevels: stats.totalLevels,
      avgChildrenPerNode: stats.totalChildren / Math.max(stats.totalNodes, 1),
      deepestLevel: stats.maxDepth,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  /**
   * Discover available admin levels for a country
   */
  private async discoverAdminLevels(countryCode: string): Promise<number[]> {
    console.log(`🔍 Discovering admin levels for ${countryCode}`);
    
    const allBoundaries = await osmAdminBoundaryService.getCountryBoundaries(countryCode, false);
    const levels = new Set<number>();
    
    for (const boundary of allBoundaries) {
      levels.add(boundary.adminLevel);
    }
    
    const sortedLevels = Array.from(levels).sort((a, b) => a - b);
    console.log(`📊 Discovered admin levels: ${sortedLevels.join(', ')}`);
    
    return sortedLevels;
  }

  /**
   * Determine optimal hierarchy structure based on available levels
   */
  private determineOptimalStructure(availableLevels: number[], config: AdaptiveHierarchyConfig): number[] {
    // Start with country level (2) if available, otherwise the lowest level
    let structure = availableLevels.includes(2) ? [2] : [Math.min(...availableLevels)];
    
    // Add prioritized levels that are available
    for (const level of config.prioritizeLevels) {
      if (availableLevels.includes(level) && !structure.includes(level)) {
        structure.push(level);
      }
    }
    
    // Add remaining levels up to maxDepth, skipping any already included
    const remainingLevels = availableLevels
      .filter(level => !structure.includes(level))
      .slice(0, config.maxDepth - structure.length);
    
    structure.push(...remainingLevels);
    
    // Sort to ensure logical progression
    return structure.sort((a, b) => a - b);
  }

  /**
   * Build initial levels of the hierarchy
   */
  private async buildInitialLevels(rootNode: HierarchyNode, structure: number[], config: AdaptiveHierarchyConfig): Promise<void> {
    console.log(`🔨 Building initial levels: ${structure.join(' → ')}`);
    
    // Load first level children immediately
    if (structure.length > 1) {
      await this.loadChildrenAtLevel(rootNode, structure[1], config);
    }
  }

  /**
   * Load children at a specific admin level
   */
  private async loadChildrenAtLevel(parentNode: HierarchyNode, adminLevel: number, config: AdaptiveHierarchyConfig): Promise<HierarchyNode[]> {
    console.log(`👶 Loading children at admin level ${adminLevel} for ${parentNode.boundary.name}`);
    
    // This is a simplified approach - in a full implementation, we'd use spatial containment
    const children = await osmAdminBoundaryService.getBoundariesByLevel(config.countryCode, adminLevel, config.includeGeometry);
    
    const childNodes: HierarchyNode[] = [];
    
    for (const boundary of children) {
      const childNode: HierarchyNode = {
        id: boundary.id,
        boundary,
        children: [],
        parent: parentNode,
        path: [...parentNode.path, boundary.id],
        depth: parentNode.depth + 1,
        isExpanded: false,
        loadingState: 'idle'
      };
      
      // Index the child node
      this.nodeIndex.set(childNode.id, childNode);
      childNodes.push(childNode);
    }
    
    // Sort children by priority
    childNodes.sort((a, b) => {
      if (a.boundary.isCapital && !b.boundary.isCapital) return -1;
      if (!a.boundary.isCapital && b.boundary.isCapital) return 1;
      
      const aPop = a.boundary.population || 0;
      const bPop = b.boundary.population || 0;
      if (aPop !== bPop) {
        return bPop - aPop;
      }
      
      return a.boundary.name.localeCompare(b.boundary.name);
    });
    
    parentNode.children = childNodes;
    parentNode.childrenCount = childNodes.length;
    
    console.log(`✅ Loaded ${childNodes.length} children for ${parentNode.boundary.name}`);
    return childNodes;
  }

  /**
   * Perform actual node expansion
   */
  private async performNodeExpansion(node: HierarchyNode, config: AdaptiveHierarchyConfig): Promise<HierarchyNode[]> {
    node.loadingState = 'loading';
    console.log(`🔄 Expanding node: ${node.boundary.name} (${node.boundary.adminLevel})`);
    
    try {
      // Determine next admin level to load
      const availableLevels = this.levelMappings.get(config.countryCode) || [];
      const currentLevel = node.boundary.adminLevel;
      const nextLevel = availableLevels.find(level => level > currentLevel);
      
      if (!nextLevel) {
        console.log(`🚫 No deeper levels available for ${node.boundary.name}`);
        return [];
      }
      
      const children = await this.loadChildrenAtLevel(node, nextLevel, config);
      return children;
    } catch (error) {
      console.error(`❌ Failed to expand node ${node.id}:`, error);
      throw error;
    }
  }

  /**
   * Calculate statistics for a node tree
   */
  private calculateNodeStats(node: HierarchyNode): any {
    let totalNodes = 1;
    let loadedNodes = node.loadingState === 'loaded' ? 1 : 0;
    let totalLevels = 1;
    let maxDepth = node.depth;
    let totalChildren = node.children.length;
    
    for (const child of node.children) {
      const childStats = this.calculateNodeStats(child);
      totalNodes += childStats.totalNodes;
      loadedNodes += childStats.loadedNodes;
      totalLevels = Math.max(totalLevels, childStats.totalLevels);
      maxDepth = Math.max(maxDepth, childStats.maxDepth);
      totalChildren += childStats.totalChildren;
    }
    
    return { totalNodes, loadedNodes, totalLevels, maxDepth, totalChildren };
  }

  /**
   * Estimate depth from admin level
   */
  private estimateDepthFromAdminLevel(adminLevel: number): number {
    // Rough mapping of admin levels to hierarchy depth
    const levelDepthMap: { [key: number]: number } = {
      2: 0,  // Country
      3: 1,  // State/Province
      4: 2,  // Region/County
      5: 3,  // District
      6: 4,  // Municipality
      7: 5,  // Subdivision
      8: 6,  // City/Town
      9: 7,  // Borough
      10: 8  // Neighborhood
    };
    
    return levelDepthMap[adminLevel] || Math.max(0, adminLevel - 2);
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    // This is a simplified calculation - in practice, you'd track actual cache hits
    const totalRequests = this.loadingPromises.size + this.hierarchies.size;
    const cacheHits = this.hierarchies.size;
    
    return totalRequests > 0 ? Math.round((cacheHits / totalRequests) * 100) : 0;
  }

  /**
   * Clear all cached hierarchies
   */
  clearCache(): void {
    this.hierarchies.clear();
    this.nodeIndex.clear();
    this.levelMappings.clear();
    this.loadingPromises.clear();
    console.log('🗑️ Adaptive hierarchy cache cleared');
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): HierarchyNode | undefined {
    return this.nodeIndex.get(nodeId);
  }

  /**
   * Get all nodes at a specific depth
   */
  getNodesAtDepth(countryCode: string, depth: number): HierarchyNode[] {
    const hierarchy = this.hierarchies.get(`hierarchy_${countryCode}`);
    if (!hierarchy) {
      return [];
    }
    
    const nodes: HierarchyNode[] = [];
    this.collectNodesAtDepth(hierarchy, depth, nodes);
    return nodes;
  }

  /**
   * Recursively collect nodes at specified depth
   */
  private collectNodesAtDepth(node: HierarchyNode, targetDepth: number, result: HierarchyNode[]): void {
    if (node.depth === targetDepth) {
      result.push(node);
    }
    
    for (const child of node.children) {
      this.collectNodesAtDepth(child, targetDepth, result);
    }
  }
}

// Export singleton instance
export const adaptiveHierarchyService = new AdaptiveHierarchyService();