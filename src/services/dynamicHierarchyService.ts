// Dynamic Hierarchy Service
// Fail-fast administrative hierarchy detection using GeoNames Children API

import { geoNamesHierarchyService, GeoNamesChild } from './geoNamesHierarchyService';

export interface DynamicHierarchyNode {
  id: string;
  geonameId?: number;
  name: string;
  level: string; // Dynamic based on actual admin level
  parentId?: string;
  hasChildren: boolean;
  children?: DynamicHierarchyNode[];
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center: {
    lat: number;
    lng: number;
  };
  population?: number;
  countryCode: string;
  adminLevel?: number;
  fcode: string; // GeoNames feature code
  fcodeName: string; // Human readable feature type
  metadata: {
    source: 'geonames' | 'detected' | 'cached';
    confidence: 'high' | 'medium' | 'low';
    lastUpdated: number;
    geonameId?: number;
    hierarchyPath?: string[];
  };
}

export interface HierarchyDetectionResult {
  success: boolean;
  node?: DynamicHierarchyNode;
  children?: DynamicHierarchyNode[];
  error?: string;
  detectedLevels?: {
    currentLevel: string;
    hasChildren: boolean;
    childrenTypes: string[];
    suggestedNextLevel?: string;
  };
}

/**
 * Dynamic hierarchy service that uses GeoNames API to detect administrative levels
 * Fail-fast: Either returns real data or fails immediately
 */
export class DynamicHierarchyService {
  private cache = new Map<string, DynamicHierarchyNode>();
  private hierarchyCache = new Map<number, DynamicHierarchyNode[]>();

  /**
   * Get children for any location using dynamic hierarchy detection
   * This is the core method that replaces static fallback systems
   */
  async getChildren(node: DynamicHierarchyNode): Promise<HierarchyDetectionResult> {
    console.log(`🌳 Getting dynamic children for: ${node.name} (${node.fcode})`);

    try {
      // Must have a GeoNames ID to proceed
      if (!node.geonameId) {
        console.log(`🔍 No GeoNames ID for ${node.name}, attempting to find it...`);
        const geonameId = await geoNamesHierarchyService.findGeoNamesId(node.name, node.countryCode);
        
        if (!geonameId) {
          return {
            success: false,
            error: `Could not find GeoNames ID for ${node.name}. Cannot determine children dynamically.`
          };
        }
        
        node.geonameId = geonameId;
        node.metadata.geonameId = geonameId;
      }

      // Detect available administrative levels
      const levelDetection = await geoNamesHierarchyService.detectAvailableLevels(node.geonameId);
      console.log(`📊 Level detection for ${node.name}:`, levelDetection);

      if (!levelDetection.hasChildren) {
        return {
          success: true,
          node,
          children: [],
          detectedLevels: levelDetection
        };
      }

      // Get actual children from GeoNames
      const geoNamesChildren = await geoNamesHierarchyService.getAdministrativeChildren(node.geonameId);
      
      if (geoNamesChildren.length === 0) {
        return {
          success: true,
          node,
          children: [],
          detectedLevels: levelDetection
        };
      }

      // Convert GeoNames children to DynamicHierarchyNodes
      const hierarchyChildren = geoNamesChildren.map(child => this.convertGeoNamesChild(child, node));

      // Update cache
      this.hierarchyCache.set(node.geonameId, hierarchyChildren);

      console.log(`✅ Dynamic hierarchy detected ${hierarchyChildren.length} children for ${node.name}`);
      console.log(`📋 Children types: ${levelDetection.childrenTypes.join(', ')}`);
      console.log(`🎯 Suggested next level: ${levelDetection.suggestedNextLevel}`);

      return {
        success: true,
        node,
        children: hierarchyChildren,
        detectedLevels: levelDetection
      };

    } catch (error) {
      console.error(`❌ Dynamic hierarchy detection failed for ${node.name}:`, error);
      
      // Fail fast - don't return fake data
      return {
        success: false,
        error: `Dynamic hierarchy detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create a DynamicHierarchyNode for a country to start hierarchy detection
   */
  async createCountryNode(countryCode: string, countryName: string): Promise<HierarchyDetectionResult> {
    console.log(`🏴 Creating dynamic country node for: ${countryName} (${countryCode})`);

    try {
      // Find the GeoNames ID for this country
      const geonameId = await geoNamesHierarchyService.findGeoNamesId(countryName, countryCode);
      
      if (!geonameId) {
        return {
          success: false,
          error: `Could not find GeoNames ID for country: ${countryName}`
        };
      }

      // Get hierarchy path to understand the country's position
      const hierarchyPath = await geoNamesHierarchyService.getHierarchyPath(geonameId);
      const countryData = hierarchyPath.find(item => item.fcode === 'PCLI') || hierarchyPath[hierarchyPath.length - 1];

      if (!countryData) {
        return {
          success: false,
          error: `Could not find country data in hierarchy for: ${countryName}`
        };
      }

      const countryNode: DynamicHierarchyNode = {
        id: `country_${countryCode.toLowerCase()}`,
        geonameId,
        name: countryData.name,
        level: 'country',
        hasChildren: true, // Countries always have administrative subdivisions
        bounds: countryData.bbox,
        center: { lat: countryData.lat, lng: countryData.lng },
        population: countryData.population,
        countryCode,
        fcode: countryData.fcode,
        fcodeName: countryData.fcodeName,
        metadata: {
          source: 'geonames',
          confidence: 'high',
          lastUpdated: Date.now(),
          geonameId,
          hierarchyPath: hierarchyPath.map(item => item.name)
        }
      };

      console.log(`✅ Created dynamic country node for ${countryName} with GeoNames ID: ${geonameId}`);
      return {
        success: true,
        node: countryNode
      };

    } catch (error) {
      console.error(`❌ Failed to create country node for ${countryName}:`, error);
      return {
        success: false,
        error: `Failed to create country node: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Convert GeoNames child data to DynamicHierarchyNode
   */
  private convertGeoNamesChild(child: GeoNamesChild, parent: DynamicHierarchyNode): DynamicHierarchyNode {
    // Determine level based on feature code
    let level = 'unknown';
    let hasChildren = false;

    switch (child.fcode) {
      case 'ADM1':
        level = 'state_province';
        hasChildren = true;
        break;
      case 'ADM2':
        level = 'county_district';
        hasChildren = true;
        break;
      case 'ADM3':
        level = 'municipality';
        hasChildren = true;
        break;
      case 'ADM4':
      case 'ADM5':
        level = 'sub_municipality';
        hasChildren = true;
        break;
      case 'PPLA':
      case 'PPLA2':
      case 'PPLA3':
      case 'PPLA4':
        level = 'administrative_center';
        hasChildren = child.population ? child.population > 50000 : false;
        break;
      case 'PPLC':
        level = 'capital';
        hasChildren = true;
        break;
      case 'PPL':
        level = 'populated_place';
        hasChildren = child.population ? child.population > 100000 : false;
        break;
      default:
        level = child.fcodeName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        hasChildren = false;
    }

    return {
      id: `${level}_${parent.countryCode}_${child.geonameId}`,
      geonameId: child.geonameId,
      name: child.name,
      level,
      parentId: parent.id,
      hasChildren,
      bounds: child.bbox,
      center: { lat: child.lat, lng: child.lng },
      population: child.population,
      countryCode: parent.countryCode,
      fcode: child.fcode,
      fcodeName: child.fcodeName,
      metadata: {
        source: 'geonames',
        confidence: 'high',
        lastUpdated: Date.now(),
        geonameId: child.geonameId
      }
    };
  }

  /**
   * Get all available administrative levels for a country dynamically
   */
  async getCountryAdministrativeLevels(countryCode: string): Promise<{
    success: boolean;
    levels?: string[];
    hierarchy?: DynamicHierarchyNode[];
    error?: string;
  }> {
    console.log(`🔍 Getting administrative levels for country: ${countryCode}`);

    try {
      // Find country in REST Countries API for proper name
      const response = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}`);
      if (!response.ok) {
        throw new Error(`Could not find country with code: ${countryCode}`);
      }

      const [countryData] = await response.json();
      const countryName = countryData.name.common;

      // Create country node
      const countryResult = await this.createCountryNode(countryCode, countryName);
      if (!countryResult.success || !countryResult.node) {
        return {
          success: false,
          error: countryResult.error
        };
      }

      // Get first level of children to understand the hierarchy structure
      const childrenResult = await this.getChildren(countryResult.node);
      if (!childrenResult.success) {
        return {
          success: false,
          error: childrenResult.error
        };
      }

      const levels = ['country'];
      if (childrenResult.children && childrenResult.children.length > 0) {
        const childLevels = [...new Set(childrenResult.children.map(child => child.level))];
        levels.push(...childLevels);
      }

      console.log(`✅ Detected administrative levels for ${countryName}: ${levels.join(' → ')}`);

      return {
        success: true,
        levels,
        hierarchy: [countryResult.node, ...(childrenResult.children || [])]
      };

    } catch (error) {
      console.error(`❌ Failed to get administrative levels for ${countryCode}:`, error);
      return {
        success: false,
        error: `Failed to detect levels: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.hierarchyCache.clear();
    geoNamesHierarchyService.clearCache();
    console.log('🗑️ Dynamic hierarchy cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      nodeCache: this.cache.size,
      hierarchyCache: this.hierarchyCache.size,
      geoNamesCache: geoNamesHierarchyService.getCacheStats()
    };
  }
}

// Export singleton instance
export const dynamicHierarchyService = new DynamicHierarchyService();