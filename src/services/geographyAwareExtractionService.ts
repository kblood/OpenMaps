// Geography-Aware Extraction Service
// Implements intelligent extraction with real-world geographic knowledge

import { osmAdminBoundaryService, OSMAdminBoundary } from './osmAdminBoundaryService';
import { adaptiveHierarchyService, HierarchyNode } from './adaptiveHierarchyService';
import { boundaryContainmentService, Point, BoundingBox } from './boundaryContainmentService';
import { multiTierCacheService } from './multiTierCacheService';

export interface ExtractionContext {
  countryCode: string;
  adminLevel: number;
  requestedBounds?: BoundingBox;
  userLocation?: Point;
  preferredLanguage?: string;
  culturalContext?: string;
  timezone?: string;
}

export interface GeographicConstraints {
  minPopulation?: number;
  maxPopulation?: number;
  includeCapitals?: boolean;
  includeCoastal?: boolean;
  includeInland?: boolean;
  excludeIslands?: boolean;
  culturalRegions?: string[];
  languagePreferences?: string[];
}

export interface ExtractionResult {
  boundaries: OSMAdminBoundary[];
  metadata: {
    totalFound: number;
    filtered: number;
    confidence: number;
    extractionMethod: string;
    geographicRelevance: number;
    culturalRelevance: number;
    warnings: string[];
  };
  hierarchy?: HierarchyNode;
  spatialIndex?: any;
}

export interface MapPackDefinition {
  id: string;
  name: string;
  description: string;
  bounds: BoundingBox;
  adminLevels: number[];
  boundaries: OSMAdminBoundary[];
  packSize: number; // in MB
  downloadPriority: number;
  metadata: {
    country: string;
    region?: string;
    population: number;
    area: number; // km²
    density: number; // people per km²
    lastUpdated: string;
    quality: 'high' | 'medium' | 'low';
    completeness: number; // percentage
  };
}

export class GeographyAwareExtractionService {
  private extractionCache = new Map<string, ExtractionResult>();
  private geographicKnowledgeBase = new Map<string, any>();
  private culturalMappings = new Map<string, string[]>();

  constructor() {
    this.initializeGeographicKnowledge();
  }

  /**
   * Extract boundaries with geographic intelligence
   */
  async extractBoundaries(
    context: ExtractionContext,
    constraints: GeographicConstraints = {}
  ): Promise<ExtractionResult> {
    const cacheKey = this.generateCacheKey(context, constraints);
    
    // Check cache
    const cached = await multiTierCacheService.get<ExtractionResult>(cacheKey);
    if (cached) {
      console.log(`📦 Geographic extraction cache hit: ${cacheKey}`);
      return cached;
    }

    console.log(`🌍 Starting geography-aware extraction for ${context.countryCode}`);
    
    try {
      // Build extraction strategy based on context
      const strategy = this.buildExtractionStrategy(context, constraints);
      console.log(`📋 Extraction strategy: ${strategy.method} (priority: ${strategy.priority})`);

      // Execute extraction
      const rawBoundaries = await this.executeExtraction(strategy, context);
      console.log(`📥 Extracted ${rawBoundaries.length} raw boundaries`);

      // Apply geographic filtering
      const filteredBoundaries = this.applyGeographicFiltering(rawBoundaries, context, constraints);
      console.log(`🔍 Filtered to ${filteredBoundaries.length} boundaries`);

      // Enhance with geographic intelligence
      const enhancedBoundaries = await this.enhanceWithGeographicData(filteredBoundaries, context);
      console.log(`🔬 Enhanced ${enhancedBoundaries.length} boundaries with geographic data`);

      // Calculate relevance scores
      const scoredBoundaries = this.calculateGeographicRelevance(enhancedBoundaries, context);

      // Build result
      const result = this.buildExtractionResult(scoredBoundaries, context, constraints, strategy);

      // Cache result
      await multiTierCacheService.set(cacheKey, result, 3600); // 1 hour TTL

      console.log(`✅ Geography-aware extraction complete: ${result.metadata.confidence}% confidence`);
      return result;

    } catch (error) {
      console.error(`❌ Geography-aware extraction failed:`, error);
      throw error;
    }
  }

  /**
   * Generate optimal map packs for a region
   */
  async generateMapPacks(
    countryCode: string,
    options: {
      maxPackSize?: number; // MB
      targetAdminLevels?: number[];
      prioritizePopulated?: boolean;
      includeHierarchy?: boolean;
    } = {}
  ): Promise<MapPackDefinition[]> {
    console.log(`📦 Generating map packs for ${countryCode}`);

    try {
      // Get country hierarchy
      const hierarchy = await adaptiveHierarchyService.buildHierarchy({
        countryCode,
        maxDepth: 8,
        prioritizeLevels: options.targetAdminLevels || [2, 4, 6, 8],
        includeGeometry: true,
        spatialIndexing: true,
        cacheStrategy: 'hybrid'
      });

      // Get all boundaries for the country
      const allBoundaries = await osmAdminBoundaryService.getCountryBoundaries(countryCode, true);

      // Analyze geographic distribution
      const analysis = this.analyzeGeographicDistribution(allBoundaries, countryCode);
      console.log(`📊 Geographic analysis: ${analysis.regions.length} regions, density ${analysis.avgDensity}`);

      // Generate pack definitions based on analysis
      const packs = this.generatePackDefinitions(allBoundaries, analysis, options);
      console.log(`📦 Generated ${packs.length} map pack definitions`);

      // Optimize pack boundaries
      const optimizedPacks = await this.optimizePackBoundaries(packs, hierarchy);

      // Sort by download priority
      optimizedPacks.sort((a, b) => b.downloadPriority - a.downloadPriority);

      return optimizedPacks;

    } catch (error) {
      console.error(`❌ Map pack generation failed:`, error);
      throw error;
    }
  }

  /**
   * Extract region with intelligent boundary detection
   */
  async extractRegionIntelligently(
    searchQuery: string,
    context: ExtractionContext,
    options: {
      includeNeighbors?: boolean;
      expandToNaturalBoundaries?: boolean;
      respectCulturalBoundaries?: boolean;
    } = {}
  ): Promise<ExtractionResult> {
    console.log(`🔍 Intelligent region extraction: "${searchQuery}" in ${context.countryCode}`);

    try {
      // Search for the primary region
      const searchResults = await osmAdminBoundaryService.searchBoundaries(searchQuery, context.countryCode, true);
      
      if (searchResults.length === 0) {
        throw new Error(`No boundaries found for query: ${searchQuery}`);
      }

      // Select best match
      const primaryBoundary = this.selectBestMatch(searchResults, searchQuery, context);
      console.log(`🎯 Selected primary boundary: ${primaryBoundary.name} (level ${primaryBoundary.adminLevel})`);

      // Start with primary boundary
      let extractedBoundaries = [primaryBoundary];

      // Include neighbors if requested
      if (options.includeNeighbors) {
        const neighbors = await this.findNeighboringBoundaries(primaryBoundary, context);
        extractedBoundaries.push(...neighbors);
        console.log(`👥 Added ${neighbors.length} neighboring boundaries`);
      }

      // Expand to natural boundaries if requested
      if (options.expandToNaturalBoundaries) {
        const naturalExpansion = await this.expandToNaturalBoundaries(primaryBoundary, context);
        extractedBoundaries.push(...naturalExpansion);
        console.log(`🏔️ Added ${naturalExpansion.length} natural boundary expansions`);
      }

      // Respect cultural boundaries if requested
      if (options.respectCulturalBoundaries) {
        extractedBoundaries = await this.applyCulturalBoundaryLogic(extractedBoundaries, context);
        console.log(`🏛️ Applied cultural boundary logic`);
      }

      // Remove duplicates
      extractedBoundaries = this.removeDuplicateBoundaries(extractedBoundaries);

      // Validate containment relationships
      const validatedBoundaries = await this.validateBoundaryRelationships(extractedBoundaries);

      // Build result
      const result: ExtractionResult = {
        boundaries: validatedBoundaries,
        metadata: {
          totalFound: searchResults.length,
          filtered: validatedBoundaries.length,
          confidence: this.calculateExtractionConfidence(validatedBoundaries, searchQuery),
          extractionMethod: 'intelligent_region',
          geographicRelevance: 85,
          culturalRelevance: options.respectCulturalBoundaries ? 90 : 70,
          warnings: []
        }
      };

      return result;

    } catch (error) {
      console.error(`❌ Intelligent region extraction failed:`, error);
      throw error;
    }
  }

  /**
   * Find optimal download regions for user location
   */
  async findOptimalDownloadRegions(
    userLocation: Point,
    radius: number, // km
    context: ExtractionContext
  ): Promise<MapPackDefinition[]> {
    console.log(`📍 Finding optimal download regions around ${userLocation.lat}, ${userLocation.lng} (${radius}km)`);

    try {
      // Calculate bounding box for search area
      const searchBounds = this.calculateSearchBounds(userLocation, radius);

      // Find all boundaries within the area
      const candidates = await this.findBoundariesInArea(searchBounds, context);
      console.log(`🔍 Found ${candidates.length} candidate boundaries`);

      // Score boundaries by relevance to user location
      const scoredBoundaries = this.scoreBoundariesByLocation(candidates, userLocation, radius);

      // Group into optimal download packs
      const downloadPacks = this.groupIntoDownloadPacks(scoredBoundaries, userLocation, {
        maxPackSize: 50, // MB
        prioritizeLocal: true
      });

      console.log(`📦 Generated ${downloadPacks.length} optimal download packs`);
      return downloadPacks;

    } catch (error) {
      console.error(`❌ Optimal download region calculation failed:`, error);
      throw error;
    }
  }

  /**
   * Build extraction strategy based on context
   */
  private buildExtractionStrategy(context: ExtractionContext, constraints: GeographicConstraints): any {
    const strategy = {
      method: 'hierarchical',
      priority: 'geographic',
      filters: [],
      enhancements: []
    };

    // Determine method based on admin level
    if (context.adminLevel <= 2) {
      strategy.method = 'country_level';
      strategy.priority = 'political';
    } else if (context.adminLevel <= 4) {
      strategy.method = 'regional';
      strategy.priority = 'geographic';
    } else {
      strategy.method = 'local';
      strategy.priority = 'cultural';
    }

    // Add filters based on constraints
    if (constraints.minPopulation) {
      strategy.filters.push('population_filter');
    }
    if (constraints.includeCoastal !== undefined) {
      strategy.filters.push('coastal_filter');
    }
    if (constraints.culturalRegions) {
      strategy.filters.push('cultural_filter');
    }

    // Add enhancements based on context
    if (context.userLocation) {
      strategy.enhancements.push('location_relevance');
    }
    if (context.culturalContext) {
      strategy.enhancements.push('cultural_relevance');
    }

    return strategy;
  }

  /**
   * Execute extraction based on strategy
   */
  private async executeExtraction(strategy: any, context: ExtractionContext): Promise<OSMAdminBoundary[]> {
    switch (strategy.method) {
      case 'country_level':
        return osmAdminBoundaryService.getBoundariesByLevel(context.countryCode, context.adminLevel, true);
      
      case 'regional':
        return osmAdminBoundaryService.getCountryBoundaries(context.countryCode, true);
      
      case 'local':
        if (context.requestedBounds) {
          // This would require implementing bbox-based search in osmAdminBoundaryService
          return osmAdminBoundaryService.getCountryBoundaries(context.countryCode, true);
        }
        return osmAdminBoundaryService.getBoundariesByLevel(context.countryCode, context.adminLevel, true);
      
      default:
        return osmAdminBoundaryService.getCountryBoundaries(context.countryCode, true);
    }
  }

  /**
   * Apply geographic filtering
   */
  private applyGeographicFiltering(
    boundaries: OSMAdminBoundary[],
    context: ExtractionContext,
    constraints: GeographicConstraints
  ): OSMAdminBoundary[] {
    let filtered = boundaries;

    // Filter by admin level if specified
    if (context.adminLevel) {
      filtered = filtered.filter(b => b.adminLevel === context.adminLevel);
    }

    // Apply population constraints
    if (constraints.minPopulation) {
      filtered = filtered.filter(b => (b.population || 0) >= constraints.minPopulation!);
    }
    if (constraints.maxPopulation) {
      filtered = filtered.filter(b => (b.population || 0) <= constraints.maxPopulation!);
    }

    // Filter by capital status
    if (constraints.includeCapitals !== undefined) {
      if (constraints.includeCapitals) {
        filtered = filtered.filter(b => b.isCapital);
      } else {
        filtered = filtered.filter(b => !b.isCapital);
      }
    }

    // Apply coastal/inland filtering (simplified implementation)
    if (constraints.includeCoastal !== undefined || constraints.includeInland !== undefined) {
      filtered = filtered.filter(b => {
        const isCoastal = this.isCoastalBoundary(b);
        if (constraints.includeCoastal === true && !isCoastal) return false;
        if (constraints.includeCoastal === false && isCoastal) return false;
        if (constraints.includeInland === true && isCoastal) return false;
        if (constraints.includeInland === false && !isCoastal) return false;
        return true;
      });
    }

    // Filter by cultural regions
    if (constraints.culturalRegions && constraints.culturalRegions.length > 0) {
      filtered = filtered.filter(b => {
        const culturalRegion = this.getCulturalRegion(b, context.countryCode);
        return constraints.culturalRegions!.includes(culturalRegion);
      });
    }

    return filtered;
  }

  /**
   * Enhance boundaries with geographic data
   */
  private async enhanceWithGeographicData(
    boundaries: OSMAdminBoundary[],
    context: ExtractionContext
  ): Promise<OSMAdminBoundary[]> {
    const enhanced = [];

    for (const boundary of boundaries) {
      const enhancedBoundary = { ...boundary };

      // Add geographic metadata
      enhancedBoundary.metadata = {
        ...boundary.metadata,
        isCoastal: this.isCoastalBoundary(boundary),
        culturalRegion: this.getCulturalRegion(boundary, context.countryCode),
        timezone: this.getTimezone(boundary),
        climate: this.getClimate(boundary),
        density: this.calculatePopulationDensity(boundary),
        neighbors: [] // Would be populated by neighbor analysis
      };

      // Validate geography
      const validation = await boundaryContainmentService.validateBoundaryGeometry(boundary);
      enhancedBoundary.validation = validation;

      enhanced.push(enhancedBoundary);
    }

    return enhanced;
  }

  /**
   * Calculate geographic relevance scores
   */
  private calculateGeographicRelevance(
    boundaries: OSMAdminBoundary[],
    context: ExtractionContext
  ): OSMAdminBoundary[] {
    return boundaries.map(boundary => {
      let relevanceScore = 50; // Base score

      // Boost score for capitals
      if (boundary.isCapital) {
        relevanceScore += 20;
      }

      // Boost score for high population
      if (boundary.population) {
        relevanceScore += Math.min(20, boundary.population / 100000);
      }

      // Boost score based on proximity to user location
      if (context.userLocation) {
        const distance = this.calculateDistance(context.userLocation, {
          lat: boundary.center[1],
          lng: boundary.center[0]
        });
        relevanceScore += Math.max(0, 30 - distance / 10); // Decrease score with distance
      }

      // Boost score for appropriate admin level
      const idealLevel = this.getIdealAdminLevel(context);
      const levelDiff = Math.abs(boundary.adminLevel - idealLevel);
      relevanceScore -= levelDiff * 5;

      // Apply cultural context boost
      if (context.culturalContext) {
        const culturalMatch = this.calculateCulturalMatch(boundary, context.culturalContext);
        relevanceScore += culturalMatch * 15;
      }

      return {
        ...boundary,
        relevanceScore: Math.max(0, Math.min(100, relevanceScore))
      };
    });
  }

  /**
   * Utility methods for geographic intelligence
   */
  private isCoastalBoundary(boundary: OSMAdminBoundary): boolean {
    // Simplified coastal detection based on tags
    const tags = boundary.tags;
    return !!(
      tags.natural === 'coastline' ||
      tags.place === 'island' ||
      tags.tourism === 'beach' ||
      (boundary.name && /coast|beach|island|bay|port/i.test(boundary.name))
    );
  }

  private getCulturalRegion(boundary: OSMAdminBoundary, countryCode: string): string {
    // Simplified cultural region mapping
    const culturalMappings = this.culturalMappings.get(countryCode) || [];
    
    for (const mapping of culturalMappings) {
      if (boundary.name.toLowerCase().includes(mapping.toLowerCase())) {
        return mapping;
      }
    }

    return 'general';
  }

  private getTimezone(boundary: OSMAdminBoundary): string {
    // Simplified timezone detection based on coordinates
    const lng = boundary.center[0];
    
    // Very rough timezone calculation
    const timezoneOffset = Math.round(lng / 15);
    return `UTC${timezoneOffset >= 0 ? '+' : ''}${timezoneOffset}`;
  }

  private getClimate(boundary: OSMAdminBoundary): string {
    // Simplified climate classification based on latitude
    const lat = boundary.center[1];
    
    if (Math.abs(lat) < 23.5) return 'tropical';
    if (Math.abs(lat) < 35) return 'subtropical';
    if (Math.abs(lat) < 50) return 'temperate';
    if (Math.abs(lat) < 66.5) return 'subarctic';
    return 'arctic';
  }

  private calculatePopulationDensity(boundary: OSMAdminBoundary): number {
    if (!boundary.population || !boundary.bbox) {
      return 0;
    }

    // Rough area calculation from bbox (not accurate for large areas)
    const [west, south, east, north] = boundary.bbox;
    const latDiff = north - south;
    const lngDiff = east - west;
    const areaApprox = latDiff * lngDiff * 111.32 * 111.32; // Rough km² conversion

    return boundary.population / areaApprox;
  }

  private calculateDistance(point1: Point, point2: Point): number {
    // Haversine formula for distance calculation
    const R = 6371; // Earth radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private getIdealAdminLevel(context: ExtractionContext): number {
    // Determine ideal admin level based on context
    if (context.userLocation && context.requestedBounds) {
      const boundSize = this.calculateBoundSize(context.requestedBounds);
      if (boundSize < 100) return 8; // Local level
      if (boundSize < 1000) return 6; // Regional level
      if (boundSize < 10000) return 4; // State level
      return 2; // Country level
    }
    
    return context.adminLevel || 6; // Default to regional level
  }

  private calculateBoundSize(bounds: BoundingBox): number {
    // Calculate approximate area in km²
    const latDiff = bounds.north - bounds.south;
    const lngDiff = bounds.east - bounds.west;
    return latDiff * lngDiff * 111.32 * 111.32;
  }

  private calculateCulturalMatch(boundary: OSMAdminBoundary, culturalContext: string): number {
    // Calculate cultural relevance score (0-1)
    const boundaryName = boundary.name.toLowerCase();
    const context = culturalContext.toLowerCase();
    
    if (boundaryName.includes(context)) return 1.0;
    
    // Check for cultural keywords
    const culturalKeywords = ['capital', 'historic', 'cultural', 'heritage', 'traditional'];
    const matches = culturalKeywords.filter(keyword => 
      boundary.tags.tourism?.includes(keyword) || 
      boundary.tags.heritage?.includes(keyword)
    );
    
    return matches.length / culturalKeywords.length;
  }

  /**
   * Helper methods for map pack generation and optimization
   */
  private generateCacheKey(context: ExtractionContext, constraints: GeographicConstraints): string {
    const contextKey = `${context.countryCode}_${context.adminLevel}_${JSON.stringify(context.requestedBounds)}`;
    const constraintsKey = JSON.stringify(constraints);
    return `geo_extract_${btoa(contextKey + constraintsKey).substring(0, 32)}`;
  }

  private buildExtractionResult(
    boundaries: OSMAdminBoundary[],
    context: ExtractionContext,
    constraints: GeographicConstraints,
    strategy: any
  ): ExtractionResult {
    const avgRelevance = boundaries.length > 0 
      ? boundaries.reduce((sum, b) => sum + (b.relevanceScore || 0), 0) / boundaries.length
      : 0;
    
    return {
      boundaries,
      metadata: {
        totalFound: boundaries.length,
        filtered: boundaries.length,
        confidence: Math.round(avgRelevance),
        extractionMethod: strategy.method,
        geographicRelevance: Math.round(avgRelevance),
        culturalRelevance: context.culturalContext ? 85 : 70,
        warnings: this.generateExtractionWarnings(boundaries, context)
      }
    };
  }

  private generateExtractionWarnings(boundaries: OSMAdminBoundary[], context: ExtractionContext): string[] {
    const warnings: string[] = [];
    
    if (boundaries.length === 0) {
      warnings.push('No boundaries found matching criteria');
    }
    
    const invalidBoundaries = boundaries.filter(b => b.validation && !b.validation.isValid);
    if (invalidBoundaries.length > 0) {
      warnings.push(`${invalidBoundaries.length} boundaries have geometry issues`);
    }
    
    const lowConfidenceBoundaries = boundaries.filter(b => (b.relevanceScore || 0) < 30);
    if (lowConfidenceBoundaries.length > boundaries.length / 2) {
      warnings.push('Many boundaries have low relevance scores');
    }
    
    return warnings;
  }

  /**
   * Initialize geographic knowledge base
   */
  private initializeGeographicKnowledge(): void {
    // Initialize cultural mappings for common countries
    this.culturalMappings.set('DE', ['Bavaria', 'Saxony', 'Prussia', 'Rhineland']);
    this.culturalMappings.set('DK', ['Zealand', 'Jutland', 'Funen', 'Bornholm']);
    this.culturalMappings.set('FR', ['Normandy', 'Provence', 'Brittany', 'Alsace']);
    this.culturalMappings.set('IT', ['Tuscany', 'Sicily', 'Venetia', 'Lombardy']);
    this.culturalMappings.set('ES', ['Catalonia', 'Andalusia', 'Galicia', 'Basque']);
    
    // Initialize geographic knowledge (simplified)
    this.geographicKnowledgeBase.set('coastal_indicators', [
      'coast', 'beach', 'port', 'harbor', 'bay', 'island', 'peninsula'
    ]);
    
    this.geographicKnowledgeBase.set('urban_indicators', [
      'city', 'town', 'municipality', 'metro', 'urban', 'district'
    ]);
    
    this.geographicKnowledgeBase.set('rural_indicators', [
      'county', 'rural', 'farming', 'agricultural', 'village', 'countryside'
    ]);

    console.log('🧠 Geographic knowledge base initialized');
  }

  /**
   * Placeholder methods for advanced features
   */
  private selectBestMatch(results: OSMAdminBoundary[], query: string, context: ExtractionContext): OSMAdminBoundary {
    // Score results by name similarity and context relevance
    return results.sort((a, b) => {
      const aScore = this.calculateNameSimilarity(a.name, query) + (a.relevanceScore || 0);
      const bScore = this.calculateNameSimilarity(b.name, query) + (b.relevanceScore || 0);
      return bScore - aScore;
    })[0];
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    // Simple name similarity calculation
    const lower1 = name1.toLowerCase();
    const lower2 = name2.toLowerCase();
    
    if (lower1 === lower2) return 100;
    if (lower1.includes(lower2) || lower2.includes(lower1)) return 80;
    
    // Check for word matches
    const words1 = lower1.split(/\s+/);
    const words2 = lower2.split(/\s+/);
    const matchingWords = words1.filter(word => words2.includes(word));
    
    return (matchingWords.length / Math.max(words1.length, words2.length)) * 60;
  }

  private async findNeighboringBoundaries(boundary: OSMAdminBoundary, context: ExtractionContext): Promise<OSMAdminBoundary[]> {
    // This would implement spatial neighbor finding
    // For now, return empty array
    console.log(`🔍 Finding neighbors for ${boundary.name} (not implemented)`);
    return [];
  }

  private async expandToNaturalBoundaries(boundary: OSMAdminBoundary, context: ExtractionContext): Promise<OSMAdminBoundary[]> {
    // This would implement natural boundary expansion (rivers, mountains, etc.)
    console.log(`🏔️ Expanding to natural boundaries for ${boundary.name} (not implemented)`);
    return [];
  }

  private async applyCulturalBoundaryLogic(boundaries: OSMAdminBoundary[], context: ExtractionContext): Promise<OSMAdminBoundary[]> {
    // This would apply cultural boundary logic
    console.log(`🏛️ Applying cultural boundary logic (not implemented)`);
    return boundaries;
  }

  private removeDuplicateBoundaries(boundaries: OSMAdminBoundary[]): OSMAdminBoundary[] {
    const seen = new Set<string>();
    return boundaries.filter(boundary => {
      if (seen.has(boundary.id)) {
        return false;
      }
      seen.add(boundary.id);
      return true;
    });
  }

  private async validateBoundaryRelationships(boundaries: OSMAdminBoundary[]): Promise<OSMAdminBoundary[]> {
    // This would validate spatial relationships between boundaries
    console.log(`✅ Validating boundary relationships (simplified)`);
    return boundaries;
  }

  private calculateExtractionConfidence(boundaries: OSMAdminBoundary[], query: string): number {
    if (boundaries.length === 0) return 0;
    
    const avgRelevance = boundaries.reduce((sum, b) => sum + (b.relevanceScore || 50), 0) / boundaries.length;
    const hasExactMatch = boundaries.some(b => b.name.toLowerCase() === query.toLowerCase());
    
    return Math.round(avgRelevance + (hasExactMatch ? 20 : 0));
  }

  // Additional placeholder methods for map pack generation
  private analyzeGeographicDistribution(boundaries: OSMAdminBoundary[], countryCode: string): any {
    return {
      regions: boundaries.filter(b => b.adminLevel <= 4),
      avgDensity: boundaries.reduce((sum, b) => sum + this.calculatePopulationDensity(b), 0) / boundaries.length,
      totalArea: 0, // Would calculate total area
      populationCenters: boundaries.filter(b => (b.population || 0) > 100000)
    };
  }

  private generatePackDefinitions(boundaries: OSMAdminBoundary[], analysis: any, options: any): MapPackDefinition[] {
    // This would generate optimal pack definitions
    const packs: MapPackDefinition[] = [];
    
    // For now, create a single pack per country
    const countryBoundary = boundaries.find(b => b.adminLevel === 2);
    if (countryBoundary) {
      packs.push({
        id: `pack_${countryBoundary.countryCode}`,
        name: `${countryBoundary.name} Complete`,
        description: `Complete administrative boundaries for ${countryBoundary.name}`,
        bounds: {
          north: countryBoundary.bbox[3],
          south: countryBoundary.bbox[1],
          east: countryBoundary.bbox[2],
          west: countryBoundary.bbox[0]
        },
        adminLevels: [...new Set(boundaries.map(b => b.adminLevel))],
        boundaries: boundaries,
        packSize: Math.round(boundaries.length * 0.1), // Rough size estimate
        downloadPriority: 100,
        metadata: {
          country: countryBoundary.countryCode,
          population: boundaries.reduce((sum, b) => sum + (b.population || 0), 0),
          area: 0, // Would calculate
          density: 0, // Would calculate
          lastUpdated: new Date().toISOString(),
          quality: 'high',
          completeness: 95
        }
      });
    }
    
    return packs;
  }

  private async optimizePackBoundaries(packs: MapPackDefinition[], hierarchy: HierarchyNode): Promise<MapPackDefinition[]> {
    // This would optimize pack boundaries for download efficiency
    console.log(`🔧 Optimizing ${packs.length} pack boundaries (not implemented)`);
    return packs;
  }

  private calculateSearchBounds(center: Point, radiusKm: number): BoundingBox {
    // Convert radius to degrees (rough approximation)
    const degreeRadius = radiusKm / 111.32; // 1 degree ≈ 111.32 km
    
    return {
      north: center.lat + degreeRadius,
      south: center.lat - degreeRadius,
      east: center.lng + degreeRadius,
      west: center.lng - degreeRadius
    };
  }

  private async findBoundariesInArea(bounds: BoundingBox, context: ExtractionContext): Promise<OSMAdminBoundary[]> {
    // This would find boundaries within a bounding box
    // For now, return all country boundaries
    return osmAdminBoundaryService.getCountryBoundaries(context.countryCode, false);
  }

  private scoreBoundariesByLocation(boundaries: OSMAdminBoundary[], userLocation: Point, radius: number): OSMAdminBoundary[] {
    return boundaries.map(boundary => {
      const distance = this.calculateDistance(userLocation, {
        lat: boundary.center[1],
        lng: boundary.center[0]
      });
      
      const locationScore = Math.max(0, 100 - (distance / radius) * 100);
      
      return {
        ...boundary,
        locationScore,
        distance
      };
    }).sort((a, b) => b.locationScore - a.locationScore);
  }

  private groupIntoDownloadPacks(boundaries: OSMAdminBoundary[], userLocation: Point, options: any): MapPackDefinition[] {
    // This would group boundaries into optimal download packs
    console.log(`📦 Grouping boundaries into download packs (not implemented)`);
    return [];
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.extractionCache.clear();
    console.log('🗑️ Geography-aware extraction cache cleared');
  }
}

// Export singleton instance
export const geographyAwareExtractionService = new GeographyAwareExtractionService();