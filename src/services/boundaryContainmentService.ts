// Intelligent Boundary Containment Validation Service
// Implements geography-aware boundary containment and spatial validation

export interface Point {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeometryValidationResult {
  isValid: boolean;
  issues: string[];
  suggestedFix?: any;
  confidence: number;
}

export interface ContainmentResult {
  isContained: boolean;
  confidence: number;
  method: 'bbox' | 'geometry' | 'centroid' | 'hybrid';
  details: {
    bboxCheck: boolean;
    geometryCheck?: boolean;
    centroidCheck?: boolean;
    overlapPercentage?: number;
  };
  issues?: string[];
}

export interface SpatialRelationship {
  type: 'contains' | 'within' | 'intersects' | 'disjoint' | 'touches' | 'overlaps';
  confidence: number;
  method: string;
}

export class BoundaryContainmentService {
  private geometryCache = new Map<string, any>();
  private containmentCache = new Map<string, ContainmentResult>();
  private validationCache = new Map<string, GeometryValidationResult>();

  /**
   * Check if a child boundary is contained within a parent boundary
   */
  async checkContainment(
    childBoundary: any,
    parentBoundary: any,
    options: {
      method?: 'bbox' | 'geometry' | 'centroid' | 'hybrid';
      tolerance?: number;
      useCache?: boolean;
    } = {}
  ): Promise<ContainmentResult> {
    const cacheKey = `${childBoundary.id}_in_${parentBoundary.id}_${options.method || 'hybrid'}`;
    
    // Check cache if enabled
    if (options.useCache !== false && this.containmentCache.has(cacheKey)) {
      console.log(`📦 Containment cache hit: ${cacheKey}`);
      return this.containmentCache.get(cacheKey)!;
    }

    console.log(`🔍 Checking containment: ${childBoundary.name} in ${parentBoundary.name}`);
    
    const method = options.method || 'hybrid';
    let result: ContainmentResult;

    try {
      switch (method) {
        case 'bbox':
          result = this.checkBoundingBoxContainment(childBoundary, parentBoundary, options.tolerance);
          break;
        
        case 'geometry':
          result = await this.checkGeometryContainment(childBoundary, parentBoundary, options.tolerance);
          break;
        
        case 'centroid':
          result = this.checkCentroidContainment(childBoundary, parentBoundary);
          break;
        
        case 'hybrid':
        default:
          result = await this.checkHybridContainment(childBoundary, parentBoundary, options.tolerance);
          break;
      }

      // Cache result if caching is enabled
      if (options.useCache !== false) {
        this.containmentCache.set(cacheKey, result);
      }

      console.log(`${result.isContained ? '✅' : '❌'} Containment result: ${result.confidence}% confidence (${result.method})`);
      return result;

    } catch (error) {
      console.error(`❌ Containment check failed:`, error);
      
      // Return conservative result on error
      return {
        isContained: false,
        confidence: 0,
        method: 'error',
        details: { bboxCheck: false },
        issues: [`Containment check failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validate boundary geometry for correctness
   */
  async validateBoundaryGeometry(boundary: any): Promise<GeometryValidationResult> {
    const cacheKey = `validation_${boundary.id}`;
    
    if (this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey)!;
    }

    console.log(`🔍 Validating geometry for: ${boundary.name}`);
    
    const issues: string[] = [];
    let confidence = 100;

    try {
      // Check if geometry exists
      if (!boundary.geometry) {
        issues.push('No geometry data available');
        confidence -= 50;
      } else {
        // Validate geometry structure
        const geometryIssues = this.validateGeometryStructure(boundary.geometry);
        issues.push(...geometryIssues);
        confidence -= geometryIssues.length * 10;
      }

      // Check bounding box validity
      if (boundary.bbox) {
        const bboxIssues = this.validateBoundingBox(boundary.bbox);
        issues.push(...bboxIssues);
        confidence -= bboxIssues.length * 15;
      } else {
        issues.push('No bounding box data');
        confidence -= 20;
      }

      // Check coordinate validity
      if (boundary.center) {
        const coordIssues = this.validateCoordinates(boundary.center);
        issues.push(...coordIssues);
        confidence -= coordIssues.length * 20;
      }

      // Check administrative level consistency
      if (boundary.adminLevel) {
        const levelIssues = this.validateAdminLevel(boundary);
        issues.push(...levelIssues);
        confidence -= levelIssues.length * 5;
      }

      const result: GeometryValidationResult = {
        isValid: issues.length === 0,
        issues,
        confidence: Math.max(0, confidence),
        suggestedFix: issues.length > 0 ? this.generateGeometryFix(boundary, issues) : undefined
      };

      this.validationCache.set(cacheKey, result);
      return result;

    } catch (error) {
      console.error(`❌ Geometry validation failed:`, error);
      
      const errorResult: GeometryValidationResult = {
        isValid: false,
        issues: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        confidence: 0
      };
      
      this.validationCache.set(cacheKey, errorResult);
      return errorResult;
    }
  }

  /**
   * Find spatial relationship between two boundaries
   */
  async findSpatialRelationship(boundary1: any, boundary2: any): Promise<SpatialRelationship> {
    console.log(`🔍 Finding spatial relationship: ${boundary1.name} ↔ ${boundary2.name}`);
    
    try {
      // Quick bounding box check first
      const bbox1 = this.getBoundingBox(boundary1);
      const bbox2 = this.getBoundingBox(boundary2);
      
      if (!this.bboxesIntersect(bbox1, bbox2)) {
        return {
          type: 'disjoint',
          confidence: 95,
          method: 'bounding_box'
        };
      }

      // Check containment in both directions
      const containment1in2 = await this.checkContainment(boundary1, boundary2, { method: 'hybrid' });
      const containment2in1 = await this.checkContainment(boundary2, boundary1, { method: 'hybrid' });

      if (containment1in2.isContained && containment1in2.confidence > 80) {
        return {
          type: 'within',
          confidence: containment1in2.confidence,
          method: containment1in2.method
        };
      }

      if (containment2in1.isContained && containment2in1.confidence > 80) {
        return {
          type: 'contains',
          confidence: containment2in1.confidence,
          method: containment2in1.method
        };
      }

      // Check for intersection/overlap
      const overlapPercentage = this.calculateOverlapPercentage(bbox1, bbox2);
      
      if (overlapPercentage > 0.1) {
        if (overlapPercentage > 0.8) {
          return {
            type: 'overlaps',
            confidence: 90,
            method: 'bbox_overlap'
          };
        } else {
          return {
            type: 'intersects',
            confidence: 75,
            method: 'bbox_overlap'
          };
        }
      }

      // Default to touches if bboxes are close
      return {
        type: 'touches',
        confidence: 60,
        method: 'proximity'
      };

    } catch (error) {
      console.error(`❌ Spatial relationship analysis failed:`, error);
      
      return {
        type: 'disjoint',
        confidence: 0,
        method: 'error'
      };
    }
  }

  /**
   * Check bounding box containment
   */
  private checkBoundingBoxContainment(
    child: any, 
    parent: any, 
    tolerance = 0.001
  ): ContainmentResult {
    const childBbox = this.getBoundingBox(child);
    const parentBbox = this.getBoundingBox(parent);

    const isContained = 
      childBbox.north <= parentBbox.north + tolerance &&
      childBbox.south >= parentBbox.south - tolerance &&
      childBbox.east <= parentBbox.east + tolerance &&
      childBbox.west >= parentBbox.west - tolerance;

    // Calculate confidence based on how well the child fits within parent
    let confidence = 0;
    if (isContained) {
      const marginNorth = parentBbox.north - childBbox.north;
      const marginSouth = childBbox.south - parentBbox.south;
      const marginEast = parentBbox.east - childBbox.east;
      const marginWest = childBbox.west - parentBbox.west;
      
      const avgMargin = (marginNorth + marginSouth + marginEast + marginWest) / 4;
      confidence = Math.min(95, 60 + avgMargin * 100); // Higher confidence with more margin
    }

    return {
      isContained,
      confidence: Math.round(confidence),
      method: 'bbox',
      details: {
        bboxCheck: isContained
      }
    };
  }

  /**
   * Check geometry-based containment (simplified implementation)
   */
  private async checkGeometryContainment(
    child: any, 
    parent: any, 
    tolerance = 0.001
  ): Promise<ContainmentResult> {
    // First check bounding box as a quick filter
    const bboxResult = this.checkBoundingBoxContainment(child, parent, tolerance);
    
    if (!bboxResult.isContained) {
      return {
        isContained: false,
        confidence: 0,
        method: 'geometry',
        details: {
          bboxCheck: false,
          geometryCheck: false
        }
      };
    }

    // For this implementation, we'll use a simplified geometry check
    // In a full implementation, you'd use a proper geometry library like Turf.js
    
    try {
      const childCentroid = this.calculateCentroid(child);
      const parentGeometry = parent.geometry || this.createBboxGeometry(parent);
      
      const isGeometryContained = this.isPointInGeometry(childCentroid, parentGeometry);
      
      return {
        isContained: isGeometryContained,
        confidence: isGeometryContained ? 85 : 0,
        method: 'geometry',
        details: {
          bboxCheck: bboxResult.isContained,
          geometryCheck: isGeometryContained
        }
      };

    } catch (error) {
      console.warn('⚠️ Geometry containment check failed, falling back to bbox:', error);
      return bboxResult;
    }
  }

  /**
   * Check centroid containment
   */
  private checkCentroidContainment(child: any, parent: any): ContainmentResult {
    const childCentroid = this.calculateCentroid(child);
    const parentBbox = this.getBoundingBox(parent);

    const isContained = 
      childCentroid.lat <= parentBbox.north &&
      childCentroid.lat >= parentBbox.south &&
      childCentroid.lng <= parentBbox.east &&
      childCentroid.lng >= parentBbox.west;

    return {
      isContained,
      confidence: isContained ? 70 : 0, // Lower confidence as centroids can be misleading
      method: 'centroid',
      details: {
        bboxCheck: isContained,
        centroidCheck: isContained
      }
    };
  }

  /**
   * Hybrid containment check using multiple methods
   */
  private async checkHybridContainment(
    child: any, 
    parent: any, 
    tolerance = 0.001
  ): Promise<ContainmentResult> {
    const bboxResult = this.checkBoundingBoxContainment(child, parent, tolerance);
    const centroidResult = this.checkCentroidContainment(child, parent);

    // If bbox fails, it's definitely not contained
    if (!bboxResult.isContained) {
      return {
        isContained: false,
        confidence: 0,
        method: 'hybrid',
        details: {
          bboxCheck: false,
          centroidCheck: centroidResult.isContained
        }
      };
    }

    // If both bbox and centroid pass, high confidence
    if (bboxResult.isContained && centroidResult.isContained) {
      return {
        isContained: true,
        confidence: Math.min(90, (bboxResult.confidence + centroidResult.confidence) / 2),
        method: 'hybrid',
        details: {
          bboxCheck: true,
          centroidCheck: true
        }
      };
    }

    // If only bbox passes, medium confidence
    if (bboxResult.isContained) {
      return {
        isContained: true,
        confidence: Math.max(50, bboxResult.confidence - 20), // Reduce confidence
        method: 'hybrid',
        details: {
          bboxCheck: true,
          centroidCheck: false
        },
        issues: ['Centroid check failed - boundary may extend outside parent']
      };
    }

    return {
      isContained: false,
      confidence: 0,
      method: 'hybrid',
      details: {
        bboxCheck: false,
        centroidCheck: centroidResult.isContained
      }
    };
  }

  /**
   * Validate geometry structure
   */
  private validateGeometryStructure(geometry: any): string[] {
    const issues: string[] = [];

    if (!geometry) {
      issues.push('Geometry is null or undefined');
      return issues;
    }

    if (!geometry.type) {
      issues.push('Geometry missing type field');
    }

    if (!geometry.coordinates) {
      issues.push('Geometry missing coordinates field');
      return issues;
    }

    // Validate based on geometry type
    switch (geometry.type) {
      case 'Point':
        if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) {
          issues.push('Point geometry must have exactly 2 coordinates');
        }
        break;
      
      case 'LineString':
        if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
          issues.push('LineString must have at least 2 coordinate pairs');
        }
        break;
      
      case 'Polygon':
        if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
          issues.push('Polygon must have at least one ring');
        } else {
          const ring = geometry.coordinates[0];
          if (!Array.isArray(ring) || ring.length < 4) {
            issues.push('Polygon ring must have at least 4 coordinates');
          }
          // Check if ring is closed
          const first = ring[0];
          const last = ring[ring.length - 1];
          if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
            issues.push('Polygon ring is not closed');
          }
        }
        break;
      
      case 'MultiPolygon':
        if (!Array.isArray(geometry.coordinates)) {
          issues.push('MultiPolygon coordinates must be an array');
        }
        break;
      
      default:
        issues.push(`Unsupported geometry type: ${geometry.type}`);
    }

    return issues;
  }

  /**
   * Validate bounding box
   */
  private validateBoundingBox(bbox: number[]): string[] {
    const issues: string[] = [];

    if (!Array.isArray(bbox) || bbox.length !== 4) {
      issues.push('Bounding box must have exactly 4 coordinates');
      return issues;
    }

    const [minLng, minLat, maxLng, maxLat] = bbox;

    if (minLng >= maxLng) {
      issues.push('Bounding box: min longitude must be less than max longitude');
    }

    if (minLat >= maxLat) {
      issues.push('Bounding box: min latitude must be less than max latitude');
    }

    if (minLng < -180 || maxLng > 180) {
      issues.push('Bounding box: longitude values must be between -180 and 180');
    }

    if (minLat < -90 || maxLat > 90) {
      issues.push('Bounding box: latitude values must be between -90 and 90');
    }

    return issues;
  }

  /**
   * Validate coordinates
   */
  private validateCoordinates(coords: number[] | Point): string[] {
    const issues: string[] = [];

    let lng: number, lat: number;

    if (Array.isArray(coords)) {
      if (coords.length !== 2) {
        issues.push('Coordinates must have exactly 2 values [lng, lat]');
        return issues;
      }
      [lng, lat] = coords;
    } else {
      lng = coords.lng;
      lat = coords.lat;
    }

    if (typeof lng !== 'number' || isNaN(lng)) {
      issues.push('Longitude must be a valid number');
    } else if (lng < -180 || lng > 180) {
      issues.push('Longitude must be between -180 and 180');
    }

    if (typeof lat !== 'number' || isNaN(lat)) {
      issues.push('Latitude must be a valid number');
    } else if (lat < -90 || lat > 90) {
      issues.push('Latitude must be between -90 and 90');
    }

    return issues;
  }

  /**
   * Validate admin level consistency
   */
  private validateAdminLevel(boundary: any): string[] {
    const issues: string[] = [];

    if (typeof boundary.adminLevel !== 'number') {
      issues.push('Admin level must be a number');
      return issues;
    }

    if (boundary.adminLevel < 1 || boundary.adminLevel > 12) {
      issues.push('Admin level must be between 1 and 12');
    }

    // Check consistency with boundary type if available
    if (boundary.adminLevel === 2 && boundary.tags?.boundary !== 'administrative') {
      issues.push('Admin level 2 should be administrative boundary');
    }

    return issues;
  }

  /**
   * Utility methods
   */
  private getBoundingBox(boundary: any): BoundingBox {
    if (boundary.bbox) {
      const [west, south, east, north] = boundary.bbox;
      return { north, south, east, west };
    }

    if (boundary.center) {
      const margin = 0.01; // Small margin around center point
      return {
        north: boundary.center.lat + margin,
        south: boundary.center.lat - margin,
        east: boundary.center.lng + margin,
        west: boundary.center.lng - margin
      };
    }

    throw new Error('No bounding box or center coordinates available');
  }

  private calculateCentroid(boundary: any): Point {
    if (boundary.center) {
      return Array.isArray(boundary.center) 
        ? { lat: boundary.center[1], lng: boundary.center[0] }
        : boundary.center;
    }

    if (boundary.bbox) {
      const [west, south, east, north] = boundary.bbox;
      return {
        lat: (north + south) / 2,
        lng: (east + west) / 2
      };
    }

    throw new Error('Cannot calculate centroid: no center or bbox data');
  }

  private bboxesIntersect(bbox1: BoundingBox, bbox2: BoundingBox): boolean {
    return !(
      bbox1.east < bbox2.west ||
      bbox1.west > bbox2.east ||
      bbox1.north < bbox2.south ||
      bbox1.south > bbox2.north
    );
  }

  private calculateOverlapPercentage(bbox1: BoundingBox, bbox2: BoundingBox): number {
    if (!this.bboxesIntersect(bbox1, bbox2)) {
      return 0;
    }

    const overlapWest = Math.max(bbox1.west, bbox2.west);
    const overlapEast = Math.min(bbox1.east, bbox2.east);
    const overlapNorth = Math.min(bbox1.north, bbox2.north);
    const overlapSouth = Math.max(bbox1.south, bbox2.south);

    const overlapArea = (overlapEast - overlapWest) * (overlapNorth - overlapSouth);
    
    const area1 = (bbox1.east - bbox1.west) * (bbox1.north - bbox1.south);
    const area2 = (bbox2.east - bbox2.west) * (bbox2.north - bbox2.south);
    const smallerArea = Math.min(area1, area2);

    return overlapArea / smallerArea;
  }

  private isPointInGeometry(point: Point, geometry: any): boolean {
    // Simplified point-in-polygon check
    // In a full implementation, use a proper geometry library
    
    if (!geometry || !geometry.coordinates) {
      return false;
    }

    if (geometry.type === 'Polygon') {
      return this.isPointInPolygon(point, geometry.coordinates[0]);
    }

    // For other geometry types, fall back to bbox check
    return true; // Simplified
  }

  private isPointInPolygon(point: Point, ring: number[][]): boolean {
    // Ray casting algorithm for point-in-polygon
    let inside = false;
    const x = point.lng;
    const y = point.lat;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];

      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  private createBboxGeometry(boundary: any): any {
    const bbox = this.getBoundingBox(boundary);
    
    return {
      type: 'Polygon',
      coordinates: [[
        [bbox.west, bbox.south],
        [bbox.east, bbox.south],
        [bbox.east, bbox.north],
        [bbox.west, bbox.north],
        [bbox.west, bbox.south]
      ]]
    };
  }

  private generateGeometryFix(boundary: any, issues: string[]): any {
    const fixes: any = {};

    // Generate potential fixes based on issues
    if (issues.some(issue => issue.includes('bounding box'))) {
      if (boundary.center) {
        const margin = 0.01;
        fixes.suggestedBbox = [
          boundary.center.lng - margin,
          boundary.center.lat - margin,
          boundary.center.lng + margin,
          boundary.center.lat + margin
        ];
      }
    }

    if (issues.some(issue => issue.includes('coordinates'))) {
      fixes.suggestedCenter = { lat: 0, lng: 0 }; // Default fallback
    }

    return Object.keys(fixes).length > 0 ? fixes : undefined;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.geometryCache.clear();
    this.containmentCache.clear();
    this.validationCache.clear();
    console.log('🗑️ Boundary containment cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      geometryCache: this.geometryCache.size,
      containmentCache: this.containmentCache.size,
      validationCache: this.validationCache.size,
      totalCached: this.geometryCache.size + this.containmentCache.size + this.validationCache.size
    };
  }
}

// Export singleton instance
export const boundaryContainmentService = new BoundaryContainmentService();