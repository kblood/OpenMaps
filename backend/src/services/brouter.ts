import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream, existsSync } from 'fs';
import https from 'https';

export interface BRouterConfig {
  jarPath: string;
  dataPath: string;
  profilesPath: string;
  port: number;
  maxRunningTime: number;
}

export interface RouteRequest {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  profile: string;
  format?: 'gpx' | 'kml' | 'json' | 'geojson';
}

export interface RouteResponse {
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: {
    distance: number; // meters
    time: number; // seconds
    ascend: number; // meters
    descend: number; // meters
    plain: number; // meters
    track_time: number; // seconds
    filtered_ascend: number;
    filtered_descend: number;
    total_energy: number;
    energy: number;
    cost: number;
  };
  waypoints: Array<{
    lat: number;
    lng: number;
    ele?: number;
    name?: string;
  }>;
}

export interface RoutingDataSegment {
  id: string;
  filename: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  url: string;
  size: number;
  downloaded: boolean;
}

export class BRouterService {
  private config: BRouterConfig;
  private process: ChildProcess | null = null;
  private isRunning = false;

  constructor(config: BRouterConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing BRouter service...');
    
    // Ensure directories exist
    await this.ensureDirectories();
    
    // Download BRouter JAR if not exists
    await this.ensureBRouterJar();
    
    // Start BRouter service
    await this.startBRouterService();
    
    console.log('✅ BRouter service initialized');
  }

  private async ensureDirectories(): Promise<void> {
    const dirs = [this.config.dataPath, this.config.profilesPath, path.dirname(this.config.jarPath)];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  private async ensureBRouterJar(): Promise<void> {
    if (existsSync(this.config.jarPath)) {
      // Check if JAR file is valid (not empty/corrupted)
      const stats = await fs.stat(this.config.jarPath);
      if (stats.size > 1000) { // Valid JAR should be larger than 1KB
        console.log('✅ BRouter JAR already exists');
        return;
      } else {
        console.log('🗑️ Removing corrupted JAR file');
        await fs.unlink(this.config.jarPath);
      }
    }

    console.log('📦 Downloading BRouter...');
    
    // BRouter releases are now ZIP files containing the JAR
    const zipUrl = 'https://github.com/abrensch/brouter/releases/download/v1.7.8/brouter-1.7.8.zip';
    const zipPath = path.join(path.dirname(this.config.jarPath), 'brouter-1.7.8.zip');
    
    try {
      await this.downloadFile(zipUrl, zipPath);
      console.log('📦 Downloaded BRouter ZIP, extracting...');
      
      // Extract JAR from ZIP using built-in unzip
      const { execSync } = await import('child_process');
      const extractDir = path.dirname(this.config.jarPath);
      
      try {
        // Try PowerShell extraction (Windows)
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`, { stdio: 'pipe' });
      } catch {
        // Fallback: Try unzip (Linux/Mac)
        try {
          execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });
        } catch {
          console.log('⚠️ Could not extract ZIP file - unzip/PowerShell not available');
          throw new Error('ZIP extraction failed');
        }
      }
      
      // Find the JAR file in extracted contents
      const extractedDir = path.join(extractDir, 'brouter-1.7.8');
      const jarFile = path.join(extractedDir, 'brouter.jar');
      
      if (existsSync(jarFile)) {
        // Move JAR to expected location
        await fs.rename(jarFile, this.config.jarPath);
        console.log('✅ BRouter JAR extracted and installed');
      } else {
        // Look for any JAR file
        const files = await fs.readdir(extractedDir);
        const jarFiles = files.filter(f => f.endsWith('.jar'));
        if (jarFiles.length > 0) {
          await fs.rename(path.join(extractedDir, jarFiles[0]), this.config.jarPath);
          console.log('✅ BRouter JAR extracted and installed');
        } else {
          throw new Error('No JAR file found in ZIP');
        }
      }
      
      // Cleanup ZIP file
      try {
        await fs.unlink(zipPath);
      } catch { /* ignore cleanup errors */ }
      
    } catch (error) {
      console.error('❌ Failed to download BRouter:', error);
      console.log('⚠️ BRouter will not be available, routing will fall back to mathematical calculation');
      // Don't throw error, let the service continue without BRouter
    }
  }

  private async downloadFile(url: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(outputPath);
      
      https.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          file.close();
          this.downloadFile(response.headers.location!, outputPath)
            .then(resolve)
            .catch(reject);
          return;
        }
        
        if (response.statusCode !== 200) {
          file.close();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
        
        file.on('error', (err) => {
          file.close();
          reject(err);
        });
      }).on('error', (err) => {
        file.close();
        reject(err);
      });
    });
  }

  private async startBRouterService(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ BRouter service already running');
      return;
    }

    // Check if JAR file exists and is valid
    if (!existsSync(this.config.jarPath)) {
      console.log('⚠️ BRouter JAR not found, service will not start');
      return;
    }

    const stats = await fs.stat(this.config.jarPath);
    if (stats.size <= 1000) {
      console.log('⚠️ BRouter JAR file is corrupted, service will not start');
      return;
    }

    console.log(`🚀 Starting BRouter service on port ${this.config.port}...`);
    
    const args = [
      '-jar', this.config.jarPath,
      '-httpport', this.config.port.toString(),
      '-datadir', this.config.dataPath,
      '-profiledir', this.config.profilesPath,
      '-maxRunningTime', this.config.maxRunningTime.toString()
    ];

    // Use bundled Java JRE
    const javaPath = path.join(path.dirname(this.config.jarPath), 'jdk-17.0.16+8-jre', 'bin', 'java.exe');
    
    this.process = spawn(javaPath, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.process.stdout?.on('data', (data) => {
      console.log(`BRouter: ${data.toString().trim()}`);
    });

    this.process.stderr?.on('data', (data) => {
      console.error(`BRouter Error: ${data.toString().trim()}`);
    });

    this.process.on('exit', (code) => {
      console.log(`BRouter process exited with code ${code}`);
      this.isRunning = false;
      this.process = null;
    });

    // Wait for service to start
    await this.waitForServiceReady();
    this.isRunning = true;
    console.log('✅ BRouter service started');
  }

  private async waitForServiceReady(timeoutMs = 10000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`http://localhost:${this.config.port}/brouter`);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Service not ready yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error('BRouter service failed to start within timeout');
  }

  async calculateRoute(request: RouteRequest): Promise<RouteResponse> {
    if (!this.isRunning) {
      throw new Error('BRouter service is not running');
    }

    const format = request.format || 'geojson';
    const url = new URL(`http://localhost:${this.config.port}/brouter`);
    
    url.searchParams.set('lonlats', `${request.startLng},${request.startLat}|${request.endLng},${request.endLat}`);
    url.searchParams.set('profile', request.profile);
    url.searchParams.set('format', format);
    url.searchParams.set('alternativeidx', '0');
    url.searchParams.set('timode', '0');

    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`BRouter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (format === 'geojson') {
        return this.parseGeoJsonResponse(data);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error('BRouter routing error:', error);
      throw error;
    }
  }

  private parseGeoJsonResponse(data: any): RouteResponse {
    if (!data.features || data.features.length === 0) {
      throw new Error('No route found');
    }

    const feature = data.features[0];
    const geometry = feature.geometry;
    const properties = feature.properties || {};

    return {
      geometry: {
        type: 'LineString',
        coordinates: geometry.coordinates
      },
      properties: {
        distance: properties.distance || 0,
        time: properties.time || 0,
        ascend: properties.ascend || 0,
        descend: properties.descend || 0,
        plain: properties.plain || 0,
        track_time: properties['track-time'] || properties.time || 0,
        filtered_ascend: properties['filtered-ascend'] || properties.ascend || 0,
        filtered_descend: properties['filtered-descend'] || properties.descend || 0,
        total_energy: properties['total-energy'] || 0,
        energy: properties.energy || 0,
        cost: properties.cost || 0
      },
      waypoints: [
        { lat: geometry.coordinates[0][1], lng: geometry.coordinates[0][0] },
        { lat: geometry.coordinates[geometry.coordinates.length - 1][1], lng: geometry.coordinates[geometry.coordinates.length - 1][0] }
      ]
    };
  }

  async getAvailableProfiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.profilesPath);
      return files
        .filter(file => file.endsWith('.brf'))
        .map(file => file.replace('.brf', ''));
    } catch (error) {
      console.error('Error reading profiles directory:', error);
      return ['car-fast', 'bicycle', 'foot']; // Default profiles
    }
  }

  async downloadRoutingData(segments: RoutingDataSegment[]): Promise<void> {
    console.log(`📦 Downloading ${segments.length} routing data segments...`);
    
    for (const segment of segments) {
      if (segment.downloaded) {
        console.log(`✅ Segment ${segment.id} already downloaded`);
        continue;
      }

      try {
        const outputPath = path.join(this.config.dataPath, segment.filename);
        console.log(`📦 Downloading ${segment.filename}...`);
        
        await this.downloadFile(segment.url, outputPath);
        segment.downloaded = true;
        
        console.log(`✅ Downloaded ${segment.filename}`);
      } catch (error) {
        console.error(`❌ Failed to download ${segment.filename}:`, error);
      }
    }
    
    console.log('✅ Routing data download complete');
  }

  async getRequiredSegments(bounds: { north: number; south: number; east: number; west: number }): Promise<RoutingDataSegment[]> {
    // BRouter uses 5x5 degree segments
    const segments: RoutingDataSegment[] = [];
    
    const startLat = Math.floor(bounds.south / 5) * 5;
    const endLat = Math.ceil(bounds.north / 5) * 5;
    const startLng = Math.floor(bounds.west / 5) * 5;
    const endLng = Math.ceil(bounds.east / 5) * 5;

    for (let lat = startLat; lat < endLat; lat += 5) {
      for (let lng = startLng; lng < endLng; lng += 5) {
        const segmentId = `${lng < 0 ? 'W' : 'E'}${Math.abs(lng)}_${lat < 0 ? 'S' : 'N'}${Math.abs(lat)}`;
        const filename = `${segmentId}.rd5`;
        const url = `https://brouter.de/brouter/segments4/${filename}`;
        
        const filePath = path.join(this.config.dataPath, filename);
        const downloaded = existsSync(filePath);

        segments.push({
          id: segmentId,
          filename,
          bounds: {
            north: lat + 5,
            south: lat,
            east: lng + 5,
            west: lng
          },
          url,
          size: 0, // Will be determined during download
          downloaded
        });
      }
    }

    return segments;
  }

  async shutdown(): Promise<void> {
    if (this.process) {
      console.log('🛑 Shutting down BRouter service...');
      this.process.kill();
      this.process = null;
      this.isRunning = false;
      console.log('✅ BRouter service shutdown');
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}