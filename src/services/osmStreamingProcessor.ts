// OSM Streaming Data Processor
// Implements streaming OSM data processing with osmium-style approach

export interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  timestamp?: string;
  version?: number;
  changeset?: number;
  user?: string;
  uid?: number;
  tags: Record<string, string>;
  lat?: number;
  lon?: number;
  nodes?: number[]; // For ways
  members?: OSMMember[]; // For relations
}

export interface OSMMember {
  type: 'node' | 'way' | 'relation';
  ref: number;
  role: string;
}

export interface ProcessingStats {
  elementsProcessed: number;
  nodesProcessed: number;
  waysProcessed: number;
  relationsProcessed: number;
  administrativeBoundaries: number;
  processingRate: number; // elements per second
  memoryUsage: number;
  startTime: number;
  errors: number;
}

export interface StreamingConfig {
  chunkSize: number;
  maxMemory: number; // MB
  enableGeometry: boolean;
  filterAdminBoundaries: boolean;
  adminLevels: number[];
  countryCodes: string[];
  outputFormat: 'geojson' | 'simplified' | 'minimal';
  onProgress?: (stats: ProcessingStats) => void;
  onElement?: (element: OSMElement) => void;
  onAdminBoundary?: (boundary: any) => void;
  onError?: (error: Error, element?: OSMElement) => void;
}

export interface ProcessingResult {
  boundaries: any[];
  stats: ProcessingStats;
  success: boolean;
  errors: Error[];
}

export class OSMStreamingProcessor {
  private stats: ProcessingStats = {
    elementsProcessed: 0,
    nodesProcessed: 0,
    waysProcessed: 0,
    relationsProcessed: 0,
    administrativeBoundaries: 0,
    processingRate: 0,
    memoryUsage: 0,
    startTime: Date.now(),
    errors: 0
  };

  private boundaries: any[] = [];
  private errors: Error[] = [];
  private nodeCache = new Map<number, { lat: number; lon: number; tags?: Record<string, string> }>();
  private wayCache = new Map<number, { nodes: number[]; tags: Record<string, string> }>();
  private isProcessing = false;
  private shouldStop = false;

  /**
   * Process OSM data from Overpass API with streaming approach
   */
  async processOverpassStream(query: string, config: StreamingConfig): Promise<ProcessingResult> {
    console.log('🌊 Starting streaming OSM data processing...');
    this.resetStats();
    this.isProcessing = true;
    this.shouldStop = false;

    try {
      // Fetch data from Overpass API
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

      // Process response as stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response stream reader');
      }

      await this.processStream(reader, config);

      return {
        boundaries: this.boundaries,
        stats: this.stats,
        success: true,
        errors: this.errors
      };

    } catch (error) {
      console.error('❌ Streaming processing failed:', error);
      this.errors.push(error as Error);
      this.stats.errors++;
      
      return {
        boundaries: this.boundaries,
        stats: this.stats,
        success: false,
        errors: this.errors
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process raw OSM data file with streaming approach
   */
  async processOSMFile(file: File | ArrayBuffer, config: StreamingConfig): Promise<ProcessingResult> {
    console.log('📁 Processing OSM file with streaming approach...');
    this.resetStats();
    this.isProcessing = true;
    this.shouldStop = false;

    try {
      let data: ArrayBuffer;
      
      if (file instanceof File) {
        data = await file.arrayBuffer();
      } else {
        data = file;
      }

      // Convert to text and process in chunks
      const text = new TextDecoder().decode(data);
      await this.processTextStream(text, config);

      return {
        boundaries: this.boundaries,
        stats: this.stats,
        success: true,
        errors: this.errors
      };

    } catch (error) {
      console.error('❌ File processing failed:', error);
      this.errors.push(error as Error);
      this.stats.errors++;
      
      return {
        boundaries: this.boundaries,
        stats: this.stats,
        success: false,
        errors: this.errors
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process specific region with automatic boundary detection
   */
  async processRegion(countryCode: string, adminLevel: number, config: StreamingConfig): Promise<ProcessingResult> {
    console.log(`🗺️ Processing region: ${countryCode} at admin level ${adminLevel}`);

    // Build optimized Overpass query for the region
    const query = this.buildRegionQuery(countryCode, adminLevel, config);
    return this.processOverpassStream(query, config);
  }

  /**
   * Stop processing
   */
  stop(): void {
    console.log('🛑 Stopping OSM streaming processor...');
    this.shouldStop = true;
  }

  /**
   * Get current processing status
   */
  getStatus(): { isProcessing: boolean; stats: ProcessingStats } {
    return {
      isProcessing: this.isProcessing,
      stats: { ...this.stats }
    };
  }

  /**
   * Process stream from reader
   */
  private async processStream(reader: ReadableStreamDefaultReader<Uint8Array>, config: StreamingConfig): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';
    let lastProgressUpdate = Date.now();

    while (!this.shouldStop) {
      const { done, value } = await reader.read();
      
      if (done) break;

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete elements from buffer
      const { remaining, processed } = this.processBufferChunk(buffer, config);
      buffer = remaining;

      // Update stats and check memory usage
      this.stats.elementsProcessed += processed;
      this.updateProcessingRate();
      this.checkMemoryUsage(config);

      // Progress callback
      if (config.onProgress && Date.now() - lastProgressUpdate > 1000) {
        config.onProgress(this.stats);
        lastProgressUpdate = Date.now();
      }

      // Memory pressure relief
      if (this.stats.memoryUsage > config.maxMemory) {
        await this.flushCaches();
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      this.processBufferChunk(buffer, config);
    }
  }

  /**
   * Process text stream in chunks
   */
  private async processTextStream(text: string, config: StreamingConfig): Promise<void> {
    const chunkSize = config.chunkSize || 1024 * 1024; // 1MB chunks
    let offset = 0;
    let lastProgressUpdate = Date.now();

    while (offset < text.length && !this.shouldStop) {
      const chunk = text.slice(offset, offset + chunkSize);
      const { processed } = this.processBufferChunk(chunk, config);
      
      offset += chunkSize;
      this.stats.elementsProcessed += processed;
      this.updateProcessingRate();

      // Progress callback
      if (config.onProgress && Date.now() - lastProgressUpdate > 1000) {
        config.onProgress(this.stats);
        lastProgressUpdate = Date.now();
      }

      // Yield to event loop
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  /**
   * Process a chunk of buffered data
   */
  private processBufferChunk(buffer: string, config: StreamingConfig): { remaining: string; processed: number } {
    let processed = 0;
    let lines = buffer.split('\n');
    let remaining = lines.pop() || ''; // Keep incomplete line for next chunk

    for (const line of lines) {
      if (this.shouldStop) break;

      try {
        const element = this.parseOSMLine(line);
        if (element) {
          this.processElement(element, config);
          processed++;
        }
      } catch (error) {
        this.handleProcessingError(error as Error, config);
      }
    }

    return { remaining, processed };
  }

  /**
   * Parse a single line of OSM data
   */
  private parseOSMLine(line: string): OSMElement | null {
    line = line.trim();
    if (!line || line.startsWith('#')) {
      return null;
    }

    try {
      // Handle JSON format (from Overpass API)
      if (line.startsWith('{') && line.endsWith('}')) {
        return JSON.parse(line) as OSMElement;
      }

      // Handle XML format (simplified parsing)
      if (line.includes('<node') || line.includes('<way') || line.includes('<relation')) {
        return this.parseXMLElement(line);
      }

      return null;
    } catch (error) {
      console.warn('⚠️ Failed to parse OSM line:', line.substring(0, 100));
      return null;
    }
  }

  /**
   * Parse XML element (simplified)
   */
  private parseXMLElement(xml: string): OSMElement | null {
    // This is a simplified XML parser - in production, use a proper XML parser
    const tagMatch = xml.match(/<(node|way|relation)[^>]*>/);
    if (!tagMatch) return null;

    const type = tagMatch[1] as 'node' | 'way' | 'relation';
    const idMatch = xml.match(/id="(\d+)"/);
    if (!idMatch) return null;

    const id = parseInt(idMatch[1]);
    const tags: Record<string, string> = {};

    // Extract tags
    const tagMatches = xml.matchAll(/<tag k="([^"]*)" v="([^"]*)"/g);
    for (const match of tagMatches) {
      tags[match[1]] = match[2];
    }

    const element: OSMElement = { type, id, tags };

    // Extract node coordinates
    if (type === 'node') {
      const latMatch = xml.match(/lat="([^"]*)"/);
      const lonMatch = xml.match(/lon="([^"]*)"/);
      if (latMatch && lonMatch) {
        element.lat = parseFloat(latMatch[1]);
        element.lon = parseFloat(lonMatch[1]);
      }
    }

    // Extract way nodes
    if (type === 'way') {
      const nodeMatches = xml.matchAll(/<nd ref="(\d+)"/g);
      element.nodes = Array.from(nodeMatches).map(match => parseInt(match[1]));
    }

    // Extract relation members
    if (type === 'relation') {
      const memberMatches = xml.matchAll(/<member type="([^"]*)" ref="(\d+)" role="([^"]*)"/g);
      element.members = Array.from(memberMatches).map(match => ({
        type: match[1] as 'node' | 'way' | 'relation',
        ref: parseInt(match[2]),
        role: match[3]
      }));
    }

    return element;
  }

  /**
   * Process individual OSM element
   */
  private processElement(element: OSMElement, config: StreamingConfig): void {
    // Update type-specific stats
    this.stats[`${element.type}sProcessed` as keyof ProcessingStats]++;

    // Call element callback
    if (config.onElement) {
      config.onElement(element);
    }

    // Cache nodes and ways for geometry construction
    if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
      this.nodeCache.set(element.id, { lat: element.lat, lon: element.lon, tags: element.tags });
    } else if (element.type === 'way' && element.nodes) {
      this.wayCache.set(element.id, { nodes: element.nodes, tags: element.tags });
    }

    // Process administrative boundaries
    if (this.isAdministrativeBoundary(element, config)) {
      this.processAdministrativeBoundary(element, config);
    }
  }

  /**
   * Check if element is an administrative boundary
   */
  private isAdministrativeBoundary(element: OSMElement, config: StreamingConfig): boolean {
    if (!config.filterAdminBoundaries) {
      return false;
    }

    const tags = element.tags;
    if (tags.boundary !== 'administrative') {
      return false;
    }

    // Check admin level filter
    if (config.adminLevels.length > 0) {
      const adminLevel = parseInt(tags.admin_level || '');
      if (!config.adminLevels.includes(adminLevel)) {
        return false;
      }
    }

    // Check country code filter
    if (config.countryCodes.length > 0) {
      const countryCode = tags['ISO3166-1'] || tags.country_code;
      if (!countryCode || !config.countryCodes.includes(countryCode.toUpperCase())) {
        return false;
      }
    }

    return true;
  }

  /**
   * Process administrative boundary
   */
  private processAdministrativeBoundary(element: OSMElement, config: StreamingConfig): void {
    this.stats.administrativeBoundaries++;

    try {
      const boundary = this.constructBoundary(element, config);
      if (boundary) {
        this.boundaries.push(boundary);
        
        if (config.onAdminBoundary) {
          config.onAdminBoundary(boundary);
        }
      }
    } catch (error) {
      this.handleProcessingError(error as Error, config, element);
    }
  }

  /**
   * Construct boundary object from OSM element
   */
  private constructBoundary(element: OSMElement, config: StreamingConfig): any {
    const tags = element.tags;
    
    const boundary = {
      id: `osm_${element.type}_${element.id}`,
      osmId: element.id,
      type: element.type,
      name: tags['name:en'] || tags.name,
      adminLevel: parseInt(tags.admin_level || '0'),
      countryCode: tags['ISO3166-1'] || tags.country_code || '',
      tags,
      timestamp: element.timestamp
    };

    // Add geometry if enabled and available
    if (config.enableGeometry) {
      boundary.geometry = this.constructGeometry(element);
    }

    return boundary;
  }

  /**
   * Construct geometry from OSM element
   */
  private constructGeometry(element: OSMElement): any {
    if (element.type === 'node' && element.lat !== undefined && element.lon !== undefined) {
      return {
        type: 'Point',
        coordinates: [element.lon, element.lat]
      };
    }

    if (element.type === 'way' && element.nodes) {
      const coordinates: number[][] = [];
      for (const nodeId of element.nodes) {
        const node = this.nodeCache.get(nodeId);
        if (node) {
          coordinates.push([node.lon, node.lat]);
        }
      }
      
      return {
        type: 'LineString',
        coordinates
      };
    }

    if (element.type === 'relation' && element.members) {
      // Simplified relation geometry construction
      const coordinates: number[][][] = [];
      
      for (const member of element.members) {
        if (member.type === 'way') {
          const way = this.wayCache.get(member.ref);
          if (way) {
            const wayCoords: number[][] = [];
            for (const nodeId of way.nodes) {
              const node = this.nodeCache.get(nodeId);
              if (node) {
                wayCoords.push([node.lon, node.lat]);
              }
            }
            if (wayCoords.length > 0) {
              coordinates.push(wayCoords);
            }
          }
        }
      }
      
      return {
        type: 'MultiLineString',
        coordinates
      };
    }

    return null;
  }

  /**
   * Build optimized query for specific region
   */
  private buildRegionQuery(countryCode: string, adminLevel: number, config: StreamingConfig): string {
    const conditions = [
      '["boundary"="administrative"]',
      `["admin_level"="${adminLevel}"]`,
      `["ISO3166-1"="${countryCode.toUpperCase()}"]`
    ];

    const geometryOutput = config.enableGeometry ? 'geom' : 'center';
    
    return `
      [out:json][timeout:60];
      (
        relation${conditions.join('')};
        way${conditions.join('')};
      );
      out ${geometryOutput} qt;
    `;
  }

  /**
   * Update processing rate
   */
  private updateProcessingRate(): void {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    this.stats.processingRate = Math.round(this.stats.elementsProcessed / elapsed);
  }

  /**
   * Check memory usage
   */
  private checkMemoryUsage(config: StreamingConfig): void {
    // Estimate memory usage based on cache sizes
    const nodeCacheSize = this.nodeCache.size * 32; // Rough estimate: 32 bytes per node
    const wayCacheSize = this.wayCache.size * 100; // Rough estimate: 100 bytes per way
    const boundariesSize = this.boundaries.length * 500; // Rough estimate: 500 bytes per boundary
    
    this.stats.memoryUsage = Math.round((nodeCacheSize + wayCacheSize + boundariesSize) / (1024 * 1024));
  }

  /**
   * Flush caches to free memory
   */
  private async flushCaches(): Promise<void> {
    console.log('🗑️ Flushing caches to free memory...');
    
    // Keep only recent nodes and ways
    const maxCacheSize = 10000;
    
    if (this.nodeCache.size > maxCacheSize) {
      const entries = Array.from(this.nodeCache.entries());
      this.nodeCache.clear();
      
      // Keep last half
      entries.slice(-maxCacheSize / 2).forEach(([id, node]) => {
        this.nodeCache.set(id, node);
      });
    }
    
    if (this.wayCache.size > maxCacheSize) {
      const entries = Array.from(this.wayCache.entries());
      this.wayCache.clear();
      
      // Keep last half
      entries.slice(-maxCacheSize / 2).forEach(([id, way]) => {
        this.wayCache.set(id, way);
      });
    }

    // Force garbage collection if available
    if ((globalThis as any).gc) {
      (globalThis as any).gc();
    }
  }

  /**
   * Handle processing errors
   */
  private handleProcessingError(error: Error, config: StreamingConfig, element?: OSMElement): void {
    this.errors.push(error);
    this.stats.errors++;
    
    if (config.onError) {
      config.onError(error, element);
    }
    
    console.warn('⚠️ Processing error:', error.message, element?.id);
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      elementsProcessed: 0,
      nodesProcessed: 0,
      waysProcessed: 0,
      relationsProcessed: 0,
      administrativeBoundaries: 0,
      processingRate: 0,
      memoryUsage: 0,
      startTime: Date.now(),
      errors: 0
    };
    
    this.boundaries = [];
    this.errors = [];
    this.nodeCache.clear();
    this.wayCache.clear();
  }
}

// Export singleton instance
export const osmStreamingProcessor = new OSMStreamingProcessor();