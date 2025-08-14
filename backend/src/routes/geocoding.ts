import express, { Request, Response } from 'express';
import axios from 'axios';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { cacheService } from '../services/cache';

const router = express.Router();

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

// Forward geocoding - address to coordinates
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const { q: query, limit = 5 } = req.query;

  if (!query || typeof query !== 'string') {
    throw createError('Query parameter is required', 400);
  }

  // Check cache first
  const cachedResult = cacheService.getGeocodingResult(query);
  if (cachedResult) {
    return res.json({
      results: cachedResult,
      cached: true
    });
  }

  try {
    const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
      params: {
        format: 'json',
        q: query,
        limit: Math.min(parseInt(limit as string) || 5, 10),
        addressdetails: 1,
        extratags: 1,
        namedetails: 1
      },
      headers: {
        'User-Agent': 'OpenMaps/1.0 (https://github.com/openmaps/openmaps)'
      }
    });

    const results = response.data;

    // Cache the results
    cacheService.cacheGeocodingResult(query, results);

    return res.json({
      results,
      cached: false
    });
  } catch (error: any) {
    console.error('Geocoding error:', error.message);
    throw createError('Geocoding service unavailable', 503);
  }
}));

// Reverse geocoding - coordinates to address
router.get('/reverse', asyncHandler(async (req: Request, res: Response) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    throw createError('Latitude and longitude parameters are required', 400);
  }

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lon as string);

  if (isNaN(latitude) || isNaN(longitude)) {
    throw createError('Invalid latitude or longitude values', 400);
  }

  // Create cache key for reverse geocoding
  const cacheKey = `reverse:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const cachedResult = cacheService.get(cacheKey);
  
  if (cachedResult) {
    return res.json({
      result: cachedResult,
      cached: true
    });
  }

  try {
    const response = await axios.get(`${NOMINATIM_BASE_URL}/reverse`, {
      params: {
        format: 'json',
        lat: latitude,
        lon: longitude,
        addressdetails: 1,
        extratags: 1,
        namedetails: 1
      },
      headers: {
        'User-Agent': 'OpenMaps/1.0 (https://github.com/openmaps/openmaps)'
      }
    });

    const result = response.data;

    // Cache the result
    cacheService.set(cacheKey, result, 3600); // Cache for 1 hour

    return res.json({
      result,
      cached: false
    });
  } catch (error: any) {
    console.error('Reverse geocoding error:', error.message);
    throw createError('Reverse geocoding service unavailable', 503);
  }
}));

// Autocomplete/suggestions endpoint
router.get('/autocomplete', asyncHandler(async (req: Request, res: Response) => {
  const { q: query, limit = 5 } = req.query;

  if (!query || typeof query !== 'string' || query.length < 2) {
    return res.json({ suggestions: [] });
  }

  const cacheKey = `autocomplete:${query.toLowerCase()}`;
  const cachedResult = cacheService.get(cacheKey);
  
  if (cachedResult) {
    return res.json({
      suggestions: cachedResult,
      cached: true
    });
  }

  try {
    const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
      params: {
        format: 'json',
        q: query,
        limit: Math.min(parseInt(limit as string) || 5, 10),
        addressdetails: 0,
        dedupe: 1
      },
      headers: {
        'User-Agent': 'OpenMaps/1.0 (https://github.com/openmaps/openmaps)'
      }
    });

    const suggestions = response.data.map((item: any) => ({
      place_id: item.place_id,
      display_name: item.display_name,
      lat: item.lat,
      lon: item.lon,
      importance: item.importance
    }));

    // Cache the suggestions for a shorter time
    cacheService.set(cacheKey, suggestions, 1800); // 30 minutes

    return res.json({
      suggestions,
      cached: false
    });
  } catch (error: any) {
    console.error('Autocomplete error:', error.message);
    throw createError('Autocomplete service unavailable', 503);
  }
}));

export default router;