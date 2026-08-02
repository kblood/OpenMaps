// MBTiles Source Management Service

interface MBTilesSource {
  id: string;
  name: string;
  filename: string;
  metadata: {
    name: string;
    description?: string;
    version?: string;
    minZoom: number;
    maxZoom: number;
    bounds: [number, number, number, number];
    format: string;
    type: 'overlay' | 'baselayer';
  };
  size: number;
  lastModified: Date;
  isActive: boolean;
}

interface RegionalPack {
  id: string;
  name: string;
  country?: string;
  size: number;
  sizeFormatted: string;
  bounds?: [number, number, number, number];
  lastModified?: Date;
  availableFormats: string[];
  estimatedDownloadTime: string;
}

interface DownloadProgress {
  filename: string;
  totalBytes: number;
  downloadedBytes: number;
  percentage: number;
  speed: number;
  eta: number;
  status: 'downloading' | 'completed' | 'failed' | 'pending' | 'extracting' | 'ready';
  integrationStarted?: boolean;
  extractionProgress?: number;
}

class MBTilesSourceService {
  private backendUrl: string;

  constructor() {
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  }

  /**
   * Get all available MBTiles sources
   */
  async getAvailableSources(): Promise<MBTilesSource[]> {
    try {
      const response = await fetch(`${this.backendUrl}/api/mbtiles/list`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch MBTiles sources: ${response.statusText}`);
      }

      const data = await response.json();
      
      return data.files.map((file: any) => ({
        id: file.filename.replace('.mbtiles', ''),
        name: file.metadata.name || file.filename,
        filename: file.filename,
        metadata: file.metadata,
        size: file.size,
        lastModified: new Date(file.lastModified),
        isActive: true // Default to active
      }));
    } catch (error) {
      console.error('❌ Failed to get MBTiles sources:', error);
      return [];
    }
  }

  /**
   * Get available regional packs for download
   */
  async getAvailableRegionalPacks(): Promise<RegionalPack[]> {
    try {
      const response = await fetch(`${this.backendUrl}/api/geofabrik/regions`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch regional packs: ${response.statusText}`);
      }

      const data = await response.json();
      return data.regions;
    } catch (error) {
      console.error('❌ Failed to get regional packs:', error);
      return [];
    }
  }

  /**
   * Start downloading a regional pack
   */
  async downloadRegionalPack(regionId: string, format: string = 'pbf'): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/api/geofabrik/download/${regionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ format }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Download failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Started downloading ${regionId}:`, data.message);
      return true;
    } catch (error) {
      console.error(`❌ Failed to start download for ${regionId}:`, error);
      throw error;
    }
  }

  /**
   * Get download progress for a region
   */
  async getDownloadProgress(regionId: string): Promise<DownloadProgress | null> {
    try {
      const response = await fetch(`${this.backendUrl}/api/geofabrik/progress/${regionId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get download progress: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status === 'not_found') {
        return null;
      }

      return data.progress;
    } catch (error) {
      console.error(`❌ Failed to get download progress for ${regionId}:`, error);
      return null;
    }
  }

  /**
   * Get downloaded OSM files
   */
  async getDownloadedFiles(): Promise<Array<{
    filename: string;
    size: number;
    sizeFormatted: string;
    lastModified: Date;
    regionId: string;
    ageInDays: number;
  }>> {
    try {
      const response = await fetch(`${this.backendUrl}/api/geofabrik/downloaded`);
      
      if (!response.ok) {
        throw new Error(`Failed to get downloaded files: ${response.statusText}`);
      }

      const data = await response.json();
      
      return data.files.map((file: any) => ({
        ...file,
        lastModified: new Date(file.lastModified)
      }));
    } catch (error) {
      console.error('❌ Failed to get downloaded files:', error);
      return [];
    }
  }

  /**
   * Generate MBTiles URL for a given source
   */
  getMBTilesUrl(filename: string): string {
    return `${this.backendUrl}/api/mbtiles/tiles/${filename}/{z}/{x}/{y}.png`;
  }

  /**
   * Check if MBTiles service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/api/mbtiles/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get metadata for a specific MBTiles file
   */
  async getMetadata(filename: string): Promise<any> {
    try {
      const response = await fetch(`${this.backendUrl}/api/mbtiles/metadata/${filename}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get metadata: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Failed to get metadata for ${filename}:`, error);
      return null;
    }
  }

  /**
   * Create a map layer configuration for MBTiles
   */
  createMapLayerConfig(source: MBTilesSource) {
    return {
      id: source.id,
      name: source.name,
      url: this.getMBTilesUrl(source.filename),
      attribution: `Local MBTiles: ${source.name}`,
      maxZoom: source.metadata.maxZoom,
      minZoom: source.metadata.minZoom,
      bounds: source.metadata.bounds,
      type: 'mbtiles-local',
      isOffline: true,
      size: source.size
    };
  }

  /**
   * Get user's preferred map sources from localStorage
   */
  getUserPreferences(): {
    preferMBTiles: boolean;
    enabledSources: string[];
    fallbackToOnline: boolean;
  } {
    try {
      const prefs = localStorage.getItem('openmaps_mbtiles_preferences');
      return prefs ? JSON.parse(prefs) : {
        preferMBTiles: true,
        enabledSources: [],
        fallbackToOnline: true
      };
    } catch {
      return {
        preferMBTiles: true,
        enabledSources: [],
        fallbackToOnline: true
      };
    }
  }

  /**
   * Save user preferences
   */
  saveUserPreferences(preferences: {
    preferMBTiles?: boolean;
    enabledSources?: string[];
    fallbackToOnline?: boolean;
  }): void {
    try {
      const currentPrefs = this.getUserPreferences();
      const updatedPrefs = { ...currentPrefs, ...preferences };
      localStorage.setItem('openmaps_mbtiles_preferences', JSON.stringify(updatedPrefs));
    } catch (error) {
      console.warn('Failed to save MBTiles preferences:', error);
    }
  }

  /**
   * Trigger integration of downloaded regional pack into offline tile system
   */
  async integrateRegionalPack(regionId: string): Promise<boolean> {
    try {
      const { regionalPackIntegration } = await import('./regionalPackIntegration');
      
      // Check if tiles are available from backend
      const tilesAvailable = await regionalPackIntegration.checkRegionalTilesAvailable(regionId);
      if (!tilesAvailable) {
        console.warn(`⚠️ No tiles available for region: ${regionId}`);
        return false;
      }
      
      // Import tiles into offline cache
      const success = await regionalPackIntegration.importRegionalTiles(regionId);
      if (success) {
        console.log(`✅ Successfully integrated regional pack: ${regionId}`);
      } else {
        console.error(`❌ Failed to integrate regional pack: ${regionId}`);
      }
      
      return success;
      
    } catch (error) {
      console.error(`❌ Failed to integrate regional pack ${regionId}:`, error);
      return false;
    }
  }

  /**
   * Check if a regional pack is integrated into offline system
   */
  async isRegionalPackIntegrated(regionId: string): Promise<boolean> {
    try {
      const { regionalPackIntegration } = await import('./regionalPackIntegration');
      return regionalPackIntegration.isRegionIntegrated(regionId);
    } catch (error) {
      console.error(`❌ Failed to check integration status for ${regionId}:`, error);
      return false;
    }
  }

  /**
   * Get offline tile statistics including regional packs
   */
  async getOfflineStats(): Promise<any> {
    try {
      const { regionalPackIntegration } = await import('./regionalPackIntegration');
      return await regionalPackIntegration.getOfflineStats();
    } catch (error) {
      console.error('❌ Failed to get offline stats:', error);
      return { totalTiles: 0, totalSizeMB: 0, tilesByZoom: {}, regionalPacks: {} };
    }
  }
}

// Singleton instance
export const mbtilesSourceService = new MBTilesSourceService();

// Export types
export type { MBTilesSource, RegionalPack, DownloadProgress };