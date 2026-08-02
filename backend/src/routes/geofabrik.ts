import express, { Request, Response } from 'express';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { geofabrikService } from '../services/geofabrikService';

const router = express.Router();

// Get available regions for download
router.get('/regions', asyncHandler(async (req: Request, res: Response) => {
  try {
    const regions = await geofabrikService.getAvailableRegions();
    
    res.json({
      count: regions.length,
      regions: regions.map(region => ({
        id: region.id,
        name: region.name,
        country: region.iso3166_1_alpha2?.[0] || null,
        size: region.size,
        sizeFormatted: formatFileSize(region.size || 0),
        bounds: region.bounds,
        lastModified: region.lastModified,
        availableFormats: Object.keys(region.urls),
        estimatedDownloadTime: estimateDownloadTime(region.size || 0)
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error getting Geofabrik regions:', error.message);
    throw createError('Failed to get available regions', 500);
  }
}));

// Start downloading a region
router.post('/download/:regionId', asyncHandler(async (req: Request, res: Response) => {
  const { regionId } = req.params;
  const { format = 'pbf' } = req.body;

  if (!regionId) {
    throw createError('Region ID is required', 400);
  }

  try {
    // Check if already downloading
    const existingProgress = geofabrikService.getDownloadProgress(regionId);
    if (existingProgress && existingProgress.status === 'downloading') {
      return res.json({
        status: 'already_downloading',
        progress: existingProgress
      });
    }

    // Start download (this is async but we return immediately)
    geofabrikService.downloadRegion(regionId, format).catch(error => {
      console.error(`❌ Background download failed for ${regionId}:`, error.message);
    });

    return res.json({
      status: 'download_started',
      regionId,
      format,
      message: 'Download started in background. Use GET /progress/{regionId} to track progress.',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(`❌ Error starting download for ${regionId}:`, error.message);
    if (error.message.includes('Region not found')) {
      throw createError(`Region not found: ${regionId}`, 404);
    }
    throw createError('Failed to start download', 500);
  }
}));

// Get download progress for a region
router.get('/progress/:regionId', asyncHandler(async (req: Request, res: Response) => {
  const { regionId } = req.params;

  try {
    const progress = geofabrikService.getDownloadProgress(regionId);
    
    if (!progress) {
      // Check if file exists (might be completed download from previous session)
      const downloadedFiles = await geofabrikService.listDownloadedFiles();
      const existingFile = downloadedFiles.find(file => file.filename.startsWith(regionId));
      
      if (existingFile) {
        return res.json({
          status: 'completed',
          progress: {
            filename: existingFile.filename,
            totalBytes: existingFile.size,
            downloadedBytes: existingFile.size,
            percentage: 100,
            speed: 0,
            eta: 0,
            status: 'completed' as const
          },
          file: {
            filename: existingFile.filename,
            size: existingFile.size,
            sizeFormatted: formatFileSize(existingFile.size),
            lastModified: existingFile.lastModified
          }
        });
      }
      
      return res.json({
        status: 'not_found',
        message: 'No active or completed download found for this region'
      });
    }

    return res.json({
      status: 'found',
      progress,
      estimatedTimeRemaining: progress.eta > 0 ? formatDuration(progress.eta) : null
    });
  } catch (error: any) {
    console.error(`❌ Error getting progress for ${regionId}:`, error.message);
    throw createError('Failed to get download progress', 500);
  }
}));

// List downloaded OSM files
router.get('/downloaded', asyncHandler(async (req: Request, res: Response) => {
  try {
    const files = await geofabrikService.listDownloadedFiles();
    
    res.json({
      count: files.length,
      files: files.map(file => ({
        filename: file.filename,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        lastModified: file.lastModified,
        regionId: file.filename.replace('-latest.osm.pbf', ''),
        ageInDays: Math.floor((Date.now() - file.lastModified.getTime()) / (1000 * 60 * 60 * 24))
      })),
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      totalSizeFormatted: formatFileSize(files.reduce((sum, file) => sum + file.size, 0)),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error listing downloaded files:', error.message);
    throw createError('Failed to list downloaded files', 500);
  }
}));

// Health check for Geofabrik service
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  try {
    const regions = await geofabrikService.getAvailableRegions();
    const downloadedFiles = await geofabrikService.listDownloadedFiles();
    
    res.json({
      status: 'ok',
      service: 'geofabrik',
      availableRegions: regions.length,
      downloadedFiles: downloadedFiles.length,
      baseUrl: 'https://download.geofabrik.de',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    throw createError('Geofabrik service unavailable', 503);
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

// Helper function to estimate download time (assuming 10 Mbps connection)
function estimateDownloadTime(bytes: number): string {
  const averageSpeedBytesPerSec = (10 * 1024 * 1024) / 8; // 10 Mbps in bytes/sec
  const seconds = bytes / averageSpeedBytesPerSec;
  return formatDuration(seconds);
}

// Helper function to format duration
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} seconds`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)} minutes`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

export default router;