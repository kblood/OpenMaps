import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';

export interface GeofabrikRegion {
  id: string;
  name: string;
  parent?: string;
  iso3166_1_alpha2?: string[]; // Country codes
  urls: {
    pbf?: string;       // Raw OSM data
    shp?: string;       // Shapefile
    geojson?: string;   // GeoJSON boundaries
  };
  size?: number;        // Approximate size in bytes
  lastModified?: Date;
  bounds?: [number, number, number, number]; // [west, south, east, north]
}

export interface DownloadProgress {
  filename: string;
  totalBytes: number;
  downloadedBytes: number;
  percentage: number;
  speed: number; // bytes per second
  eta: number;   // seconds remaining
  status: 'downloading' | 'completed' | 'failed' | 'pending';
}

class GeofabrikService {
  private dataDir: string;
  private baseUrl = 'https://download.geofabrik.de';
  private activeDownloads: Map<string, DownloadProgress> = new Map();

  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
  }

  /**
   * Get available regions from Geofabrik
   * This is a curated list of the most popular regions
   */
  async getAvailableRegions(): Promise<GeofabrikRegion[]> {
    // Popular regions with their download URLs
    const regions: GeofabrikRegion[] = [
      // European Countries
      {
        id: 'denmark',
        name: 'Denmark',
        iso3166_1_alpha2: ['DK'],
        urls: {
          pbf: `${this.baseUrl}/europe/denmark-latest.osm.pbf`,
        },
        size: 180_000_000, // ~180MB
        bounds: [8.0, 54.5, 15.2, 57.8]
      },
      {
        id: 'germany',
        name: 'Germany',
        iso3166_1_alpha2: ['DE'],
        urls: {
          pbf: `${this.baseUrl}/europe/germany-latest.osm.pbf`,
        },
        size: 3_800_000_000, // ~3.8GB
        bounds: [5.9, 47.3, 15.0, 55.0]
      },
      {
        id: 'france',
        name: 'France',
        iso3166_1_alpha2: ['FR'],
        urls: {
          pbf: `${this.baseUrl}/europe/france-latest.osm.pbf`,
        },
        size: 3_500_000_000, // ~3.5GB
        bounds: [-5.1, 41.3, 9.6, 51.1]
      },
      {
        id: 'united-kingdom',
        name: 'United Kingdom',
        iso3166_1_alpha2: ['GB'],
        urls: {
          pbf: `${this.baseUrl}/europe/great-britain-latest.osm.pbf`,
        },
        size: 1_200_000_000, // ~1.2GB
        bounds: [-8.6, 49.9, 1.8, 60.8]
      },
      {
        id: 'netherlands',
        name: 'Netherlands',
        iso3166_1_alpha2: ['NL'],
        urls: {
          pbf: `${this.baseUrl}/europe/netherlands-latest.osm.pbf`,
        },
        size: 800_000_000, // ~800MB
        bounds: [3.4, 50.8, 7.2, 53.6]
      },
      {
        id: 'sweden',
        name: 'Sweden',
        iso3166_1_alpha2: ['SE'],
        urls: {
          pbf: `${this.baseUrl}/europe/sweden-latest.osm.pbf`,
        },
        size: 600_000_000, // ~600MB
        bounds: [11.1, 55.3, 24.2, 69.1]
      },
      {
        id: 'norway',
        name: 'Norway',
        iso3166_1_alpha2: ['NO'],
        urls: {
          pbf: `${this.baseUrl}/europe/norway-latest.osm.pbf`,
        },
        size: 700_000_000, // ~700MB
        bounds: [4.6, 58.0, 31.3, 81.0]
      },

      // North American Regions
      {
        id: 'us-west',
        name: 'United States West Coast',
        urls: {
          pbf: `${this.baseUrl}/north-america/us-west-latest.osm.pbf`,
        },
        size: 2_000_000_000, // ~2GB
        bounds: [-125.0, 32.5, -114.0, 49.0]
      },
      {
        id: 'us-northeast',
        name: 'United States Northeast',
        urls: {
          pbf: `${this.baseUrl}/north-america/us-northeast-latest.osm.pbf`,
        },
        size: 1_800_000_000, // ~1.8GB
        bounds: [-80.5, 38.9, -66.9, 47.5]
      },

      // Other Popular Regions
      {
        id: 'australia',
        name: 'Australia',
        iso3166_1_alpha2: ['AU'],
        urls: {
          pbf: `${this.baseUrl}/australia-oceania/australia-latest.osm.pbf`,
        },
        size: 1_000_000_000, // ~1GB
        bounds: [112.9, -55.1, 159.1, -9.2]
      },
      {
        id: 'japan',
        name: 'Japan',
        iso3166_1_alpha2: ['JP'],
        urls: {
          pbf: `${this.baseUrl}/asia/japan-latest.osm.pbf`,
        },
        size: 1_500_000_000, // ~1.5GB
        bounds: [122.9, 24.0, 146.0, 46.0]
      }
    ];

    // Add lastModified dates (weekly updates)
    const now = new Date();
    const lastSunday = new Date(now.setDate(now.getDate() - now.getDay()));
    
    return regions.map(region => ({
      ...region,
      lastModified: lastSunday
    }));
  }

  /**
   * Download a regional extract from Geofabrik
   */
  async downloadRegion(regionId: string, format: 'pbf' = 'pbf'): Promise<DownloadProgress> {
    const regions = await this.getAvailableRegions();
    const region = regions.find(r => r.id === regionId);
    
    if (!region) {
      throw new Error(`Region not found: ${regionId}`);
    }

    const downloadUrl = region.urls[format];
    if (!downloadUrl) {
      throw new Error(`Format '${format}' not available for region: ${regionId}`);
    }

    const filename = `${regionId}-latest.osm.${format}`;
    const outputPath = path.join(this.dataDir, 'osm', filename);
    
    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Check if file already exists and is recent (less than 7 days old)
    try {
      const stats = await fs.stat(outputPath);
      const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays < 7) {
        console.log(`📦 Using existing recent file: ${filename} (${ageInDays.toFixed(1)} days old)`);
        return {
          filename,
          totalBytes: stats.size,
          downloadedBytes: stats.size,
          percentage: 100,
          speed: 0,
          eta: 0,
          status: 'completed'
        };
      }
    } catch (error) {
      // File doesn't exist, continue with download
    }

    // Initialize download progress
    const progress: DownloadProgress = {
      filename,
      totalBytes: region.size || 0,
      downloadedBytes: 0,
      percentage: 0,
      speed: 0,
      eta: 0,
      status: 'pending'
    };

    this.activeDownloads.set(regionId, progress);

    try {
      console.log(`⬇️ Starting download: ${downloadUrl}`);
      
      const response = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'stream',
        headers: {
          'User-Agent': 'OpenMaps/1.0 (https://github.com/openmaps/openmaps)'
        },
        timeout: 30000 // 30 second timeout for connection
      });

      const totalBytes = parseInt(response.headers['content-length'] || '0') || region.size || 0;
      const writeStream = createWriteStream(outputPath);
      
      let downloadedBytes = 0;
      let lastProgressTime = Date.now();
      let lastDownloadedBytes = 0;

      // Update progress tracking
      progress.totalBytes = totalBytes;
      progress.status = 'downloading';

      response.data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        
        const now = Date.now();
        const timeDiff = (now - lastProgressTime) / 1000; // seconds
        
        if (timeDiff >= 1) { // Update every second
          const bytesDiff = downloadedBytes - lastDownloadedBytes;
          const speed = bytesDiff / timeDiff;
          const percentage = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
          const remainingBytes = totalBytes - downloadedBytes;
          const eta = speed > 0 ? remainingBytes / speed : 0;

          progress.downloadedBytes = downloadedBytes;
          progress.percentage = percentage;
          progress.speed = speed;
          progress.eta = eta;

          lastProgressTime = now;
          lastDownloadedBytes = downloadedBytes;

          console.log(`📥 ${filename}: ${percentage.toFixed(1)}% (${this.formatBytes(downloadedBytes)}/${this.formatBytes(totalBytes)}) - ${this.formatBytes(speed)}/s`);
        }
      });

      // Use pipeline for proper error handling
      await pipeline(response.data, writeStream);

      progress.status = 'completed';
      progress.percentage = 100;
      progress.downloadedBytes = totalBytes;

      console.log(`✅ Download completed: ${filename} (${this.formatBytes(totalBytes)})`);
      
      return progress;
    } catch (error: any) {
      progress.status = 'failed';
      console.error(`❌ Download failed for ${regionId}:`, error.message);
      
      // Clean up incomplete file
      try {
        await fs.unlink(outputPath);
      } catch {
        // Ignore cleanup errors
      }
      
      throw error;
    } finally {
      this.activeDownloads.delete(regionId);
    }
  }

  /**
   * Get download progress for a region
   */
  getDownloadProgress(regionId: string): DownloadProgress | null {
    return this.activeDownloads.get(regionId) || null;
  }

  /**
   * List downloaded OSM files
   */
  async listDownloadedFiles(): Promise<Array<{ filename: string; path: string; size: number; lastModified: Date }>> {
    const osmDir = path.join(this.dataDir, 'osm');
    
    try {
      await fs.mkdir(osmDir, { recursive: true });
      const files = await fs.readdir(osmDir);
      const osmFiles = files.filter(file => file.endsWith('.osm.pbf'));
      
      const fileInfos = await Promise.all(
        osmFiles.map(async (filename) => {
          const filePath = path.join(osmDir, filename);
          const stats = await fs.stat(filePath);
          
          return {
            filename,
            path: filePath,
            size: stats.size,
            lastModified: stats.mtime
          };
        })
      );

      return fileInfos.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    } catch (error) {
      console.error('Error listing downloaded OSM files:', error);
      return [];
    }
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Singleton instance
export const geofabrikService = new GeofabrikService();