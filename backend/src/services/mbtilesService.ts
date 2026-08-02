import path from 'path';
import fs from 'fs/promises';
import Database from 'better-sqlite3';

export interface MBTilesMetadata {
  name: string;
  description?: string;
  version?: string;
  minZoom: number;
  maxZoom: number;
  bounds: [number, number, number, number]; // [west, south, east, north]
  format: string;
  type: 'overlay' | 'baselayer';
}

export interface MBTilesInfo {
  filename: string;
  path: string;
  metadata: MBTilesMetadata;
  size: number; // File size in bytes
  lastModified: Date;
}

class MBTilesService {
  private mbtilesDir: string;
  private openDatabases: Map<string, Database.Database> = new Map();
  private initialized: boolean = false;

  constructor() {
    // Store MBTiles files in backend/data/mbtiles/
    this.mbtilesDir = path.join(__dirname, '../../data/mbtiles');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await fs.mkdir(this.mbtilesDir, { recursive: true });
      console.log(`📦 MBTiles directory ready: ${this.mbtilesDir}`);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to create MBTiles directory:', error);
    }
  }

  /**
   * Get a tile from an MBTiles file using better-sqlite3
   * MBTiles uses TMS scheme where Y is flipped: tms_y = (2^z - 1) - y
   */
  async getTile(filename: string, z: number, x: number, y: number): Promise<Buffer | null> {
    try {
      await this.initialize();
      const db = this.openDatabase(filename);
      
      // Convert from XYZ to TMS Y coordinate
      const tmsY = (1 << z) - 1 - y;
      
      const stmt = db.prepare('SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?');
      const row = stmt.get(z, x, tmsY) as { tile_data: Buffer } | undefined;
      
      if (!row || !row.tile_data) {
        return null;
      }
      
      return row.tile_data;
    } catch (error) {
      console.error(`❌ Error getting tile from ${filename}:`, error);
      return null;
    }
  }

  /**
   * Get metadata from an MBTiles file
   */
  async getMetadata(filename: string): Promise<MBTilesMetadata | null> {
    try {
      await this.initialize();
      const db = this.openDatabase(filename);
      
      const stmt = db.prepare('SELECT name, value FROM metadata');
      const rows = stmt.all() as { name: string; value: string }[];
      
      const metadataMap: Record<string, string> = {};
      for (const row of rows) {
        metadataMap[row.name] = row.value;
      }

      const metadata: MBTilesMetadata = {
        name: metadataMap['name'] || filename,
        description: metadataMap['description'],
        version: metadataMap['version'],
        minZoom: parseInt(metadataMap['minzoom']) || 0,
        maxZoom: parseInt(metadataMap['maxzoom']) || 18,
        bounds: metadataMap['bounds'] 
          ? metadataMap['bounds'].split(',').map(Number) as [number, number, number, number]
          : [-180, -85, 180, 85],
        format: metadataMap['format'] || 'png',
        type: metadataMap['type'] === 'overlay' ? 'overlay' : 'baselayer'
      };

      return metadata;
    } catch (error) {
      console.error(`Error getting metadata for ${filename}:`, error);
      return null;
    }
  }

  /**
   * List all available MBTiles files
   */
  async listAvailableMBTiles(): Promise<MBTilesInfo[]> {
    try {
      await this.initialize();
      
      let files: string[];
      try {
        files = await fs.readdir(this.mbtilesDir);
      } catch {
        // Directory doesn't exist or is empty
        return [];
      }
      
      const mbtilesFiles = files.filter(file => file.endsWith('.mbtiles'));
      const mbtilesInfos: MBTilesInfo[] = [];
      
      for (const filename of mbtilesFiles) {
        const filePath = path.join(this.mbtilesDir, filename);
        
        try {
          const stats = await fs.stat(filePath);
          const metadata = await this.getMetadata(filename);
          
          if (metadata) {
            mbtilesInfos.push({
              filename,
              path: filePath,
              metadata,
              size: stats.size,
              lastModified: stats.mtime
            });
          }
        } catch (error) {
          console.warn(`Skipping invalid MBTiles file ${filename}:`, error);
        }
      }

      console.log(`📋 Found ${mbtilesInfos.length} MBTiles files in ${this.mbtilesDir}`);
      return mbtilesInfos;
    } catch (error) {
      console.error('Error listing MBTiles files:', error);
      return [];
    }
  }

  /**
   * Open an MBTiles file (with caching)
   */
  private openDatabase(filename: string): Database.Database {
    if (this.openDatabases.has(filename)) {
      return this.openDatabases.get(filename)!;
    }

    const filePath = path.join(this.mbtilesDir, filename);
    
    try {
      const db = new Database(filePath, { readonly: true });
      this.openDatabases.set(filename, db);
      console.log(`📂 Opened MBTiles file: ${filename}`);
      return db;
    } catch (error) {
      throw new Error(`Failed to open MBTiles file: ${filename}`);
    }
  }

  /**
   * Close all open databases
   */
  closeAll(): void {
    for (const [filename, db] of this.openDatabases.entries()) {
      try {
        db.close();
        console.log(`🔒 Closed MBTiles file: ${filename}`);
      } catch (error) {
        console.warn(`Warning closing ${filename}:`, error);
      }
    }
    this.openDatabases.clear();
  }

  /**
   * Check if an MBTiles file exists
   */
  async fileExists(filename: string): Promise<boolean> {
    const filePath = path.join(this.mbtilesDir, filename);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the full path to an MBTiles file
   */
  getFilePath(filename: string): string {
    return path.join(this.mbtilesDir, filename);
  }
}

// Singleton instance
export const mbtilesService = new MBTilesService();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🔄 Closing MBTiles files...');
  mbtilesService.closeAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🔄 Closing MBTiles files...');
  mbtilesService.closeAll();
  process.exit(0);
});