import express, { Request, Response } from 'express';
import axios from 'axios';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { cacheService } from '../services/cache';

const router = express.Router();

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

// Search for places/points of interest
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const { 
    q: query, 
    category, 
    bbox, 
    lat, 
    lon, 
    radius = 1000, 
    limit = 10 
  } = req.query;

  if (!query && !category) {
    throw createError('Query or category parameter is required', 400);
  }

  const cacheKey = `places:${query || category}:${bbox || `${lat},${lon},${radius}`}:${limit}`;
  const cachedResult = cacheService.get(cacheKey);
  
  if (cachedResult) {
    return res.json({
      places: cachedResult,
      cached: true
    });
  }

  try {
    let places = [];

    if (category) {
      // Use Overpass API for category-based searches
      places = await searchPlacesByCategory(category as string, lat as string, lon as string, parseInt(radius as string), parseInt(limit as string));
    } else {
      // Use Nominatim for text-based searches
      places = await searchPlacesByQuery(query as string, bbox as string, parseInt(limit as string));
    }

    // Cache the results
    cacheService.set(cacheKey, places, 1800); // Cache for 30 minutes

    return res.json({
      places,
      cached: false
    });
  } catch (error: any) {
    console.error('Places search error:', error.message);
    throw createError('Places search service unavailable', 503);
  }
}));

// Get place details by ID
router.get('/:placeId', asyncHandler(async (req: Request, res: Response) => {
  const { placeId } = req.params;

  if (!placeId) {
    throw createError('Place ID is required', 400);
  }

  const cachedResult = cacheService.getPlaceDetails(placeId);
  if (cachedResult) {
    return res.json({
      place: cachedResult,
      cached: true
    });
  }

  try {
    const response = await axios.get(`${NOMINATIM_BASE_URL}/details.php`, {
      params: {
        osmtype: 'N', // Node, Way, or Relation
        osmid: placeId,
        format: 'json',
        addressdetails: 1,
        extratags: 1,
        namedetails: 1,
        hierarchy: 1
      },
      headers: {
        'User-Agent': 'OpenMaps/1.0 (https://github.com/openmaps/openmaps)'
      }
    });

    const place = response.data;

    // Cache the place details
    cacheService.cachePlaceDetails(placeId, place);

    return res.json({
      place,
      cached: false
    });
  } catch (error: any) {
    console.error('Place details error:', error.message);
    throw createError('Place details service unavailable', 503);
  }
}));

// Get nearby places
router.get('/nearby/:category', asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.params;
  const { lat, lon, radius = 1000, limit = 20 } = req.query;

  if (!lat || !lon) {
    throw createError('Latitude and longitude parameters are required', 400);
  }

  const latitude = parseFloat(lat as string);
  const longitude = parseFloat(lon as string);
  const searchRadius = parseInt(radius as string);

  if (isNaN(latitude) || isNaN(longitude) || isNaN(searchRadius)) {
    throw createError('Invalid coordinate or radius values', 400);
  }

  const cacheKey = `nearby:${category}:${latitude},${longitude}:${searchRadius}:${limit}`;
  const cachedResult = cacheService.get(cacheKey);
  
  if (cachedResult) {
    return res.json({
      places: cachedResult,
      cached: true
    });
  }

  try {
    const places = await searchPlacesByCategory(category, lat as string, lon as string, searchRadius, parseInt(limit as string));

    // Cache the results
    cacheService.set(cacheKey, places, 1800); // Cache for 30 minutes

    return res.json({
      places,
      cached: false
    });
  } catch (error: any) {
    console.error('Nearby places error:', error.message);
    throw createError('Nearby places service unavailable', 503);
  }
}));

// Helper function to search places by category using Overpass API
async function searchPlacesByCategory(category: string, lat: string, lon: string, radius: number, limit: number) {
  const categoryMap: { [key: string]: string } = {
    'restaurant': 'amenity=restaurant',
    'cafe': 'amenity=cafe',
    'gas_station': 'amenity=fuel',
    'hospital': 'amenity=hospital',
    'pharmacy': 'amenity=pharmacy',
    'bank': 'amenity=bank',
    'atm': 'amenity=atm',
    'parking': 'amenity=parking',
    'hotel': 'tourism=hotel',
    'tourist_attraction': 'tourism=attraction',
    'shop': 'shop',
    'school': 'amenity=school',
    'university': 'amenity=university'
  };

  const amenity = categoryMap[category] || `amenity=${category}`;

  const overpassQuery = `
    [out:json][timeout:25];
    (
      node[${amenity}](around:${radius},${lat},${lon});
      way[${amenity}](around:${radius},${lat},${lon});
      relation[${amenity}](around:${radius},${lat},${lon});
    );
    out center meta ${limit};
  `;

  const response = await axios.post(OVERPASS_API_URL, overpassQuery, {
    headers: {
      'Content-Type': 'text/plain',
      'User-Agent': 'OpenMaps/1.0 (https://github.com/openmaps/openmaps)'
    }
  });

  const elements = response.data.elements || [];

  return elements.map((element: any) => ({
    id: `${element.type}/${element.id}`,
    name: element.tags?.name || 'Unnamed Place',
    category: category,
    lat: element.lat || element.center?.lat,
    lon: element.lon || element.center?.lon,
    tags: element.tags,
    type: element.type,
    amenity: element.tags?.amenity,
    address: formatAddress(element.tags)
  }));
}

// Helper function to search places by text query using Nominatim
async function searchPlacesByQuery(query: string, bbox: string, limit: number) {
  const params: any = {
    format: 'json',
    q: query,
    limit: limit,
    addressdetails: 1,
    extratags: 1,
    namedetails: 1
  };

  if (bbox) {
    params.viewbox = bbox;
    params.bounded = 1;
  }

  const response = await axios.get(`${NOMINATIM_BASE_URL}/search`, {
    params,
    headers: {
      'User-Agent': 'OpenMaps/1.0 (https://github.com/openmaps/openmaps)'
    }
  });

  return response.data.map((place: any) => ({
    id: place.place_id,
    name: place.display_name.split(',')[0],
    category: place.class,
    lat: parseFloat(place.lat),
    lon: parseFloat(place.lon),
    display_name: place.display_name,
    importance: place.importance,
    type: place.type,
    address: place.address
  }));
}

// Helper function to format address from OSM tags
function formatAddress(tags: any) {
  if (!tags) return null;

  const addressParts = [];
  
  if (tags['addr:housenumber']) addressParts.push(tags['addr:housenumber']);
  if (tags['addr:street']) addressParts.push(tags['addr:street']);
  if (tags['addr:city']) addressParts.push(tags['addr:city']);
  if (tags['addr:postcode']) addressParts.push(tags['addr:postcode']);
  
  return addressParts.length > 0 ? addressParts.join(' ') : null;
}

export default router;