import express, { Request, Response } from 'express';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { mbtilesService } from '../services/mbtilesService';

const router = express.Router();

// Serve tiles from MBTiles files
router.get('/tiles/:filename/:z/:x/:y.:ext', asyncHandler(async (req: Request, res: Response) => {
  const { filename, z, x, y, ext } = req.params;

  // Validate parameters
  const zNum = parseInt(z);
  const xNum = parseInt(x);
  const yNum = parseInt(y);

  if (isNaN(zNum) || isNaN(xNum) || isNaN(yNum)) {
    throw createError('Invalid tile coordinates', 400);
  }

  if (!filename.endsWith('.mbtiles')) {
    throw createError('Invalid MBTiles filename', 400);
  }

  try {
    // Check if file exists
    const fileExists = await mbtilesService.fileExists(filename);
    if (!fileExists) {
      throw createError(`MBTiles file not found: ${filename}`, 404);
    }

    // Get tile data
    const tileData = await mbtilesService.getTile(filename, zNum, xNum, yNum);
    
    if (!tileData) {
      // Return 404 for missing tiles (normal for sparse tilesets)
      res.status(404).send('Tile not found');
      return;
    }

    // Determine content type based on file extension or tile data
    let contentType = 'image/png'; // Default
    if (ext === 'jpg' || ext === 'jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === 'webp') {
      contentType = 'image/webp';
    } else if (ext === 'pbf') {
      contentType = 'application/x-protobuf';
    }

    // Set appropriate headers
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // 24 hours
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Length': tileData.length.toString()
    });

    res.send(tileData);
  } catch (error: any) {
    console.error(`❌ MBTiles tile error for ${filename} ${z}/${x}/${y}:`, error.message);
    if (error.statusCode) {
      throw error;
    }
    throw createError('Failed to serve MBTiles tile', 500);
  }
}));

// Get MBTiles file metadata
router.get('/metadata/:filename', asyncHandler(async (req: Request, res: Response) => {
  const { filename } = req.params;

  if (!filename.endsWith('.mbtiles')) {
    throw createError('Invalid MBTiles filename', 400);
  }

  try {
    const fileExists = await mbtilesService.fileExists(filename);
    if (!fileExists) {
      throw createError(`MBTiles file not found: ${filename}`, 404);
    }

    const metadata = await mbtilesService.getMetadata(filename);
    
    if (!metadata) {
      throw createError('Failed to read MBTiles metadata', 500);
    }

    res.json({
      filename,
      metadata,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(`❌ MBTiles metadata error for ${filename}:`, error.message);
    if (error.statusCode) {
      throw error;
    }
    throw createError('Failed to get MBTiles metadata', 500);
  }
}));

// List all available MBTiles files
router.get('/list', asyncHandler(async (req: Request, res: Response) => {
  try {
    const mbtilesFiles = await mbtilesService.listAvailableMBTiles();
    
    res.json({
      count: mbtilesFiles.length,
      files: mbtilesFiles.map(file => ({
        filename: file.filename,
        metadata: file.metadata,
        size: file.size,
        lastModified: file.lastModified,
        sizeFormatted: formatFileSize(file.size)
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error listing MBTiles files:', error.message);
    throw createError('Failed to list MBTiles files', 500);
  }
}));

// Health check for MBTiles service
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  try {
    const mbtilesFiles = await mbtilesService.listAvailableMBTiles();
    
    res.json({
      status: 'ok',
      service: 'mbtiles',
      availableFiles: mbtilesFiles.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    throw createError('MBTiles service unavailable', 503);
  }
}));

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;