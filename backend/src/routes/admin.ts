import express, { Request, Response } from 'express';
import axios from 'axios';
import { cacheService } from '../services/cache';

const router = express.Router();

// Overpass mirrors for resiliency
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter'
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchOverpass(body: string) {
  for (const url of OVERPASS_MIRRORS) {
    try {
      const resp = await axios.post(url, body, {
        headers: { 'Content-Type': 'text/plain', 'User-Agent': 'OpenMaps/1.0 (+https://github.com/openmaps/openmaps)' },
        timeout: 30000
      });
      return resp;
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 400 || status === 429 || status === 503) continue;
      if (!status) continue;
    }
    await sleep(500);
  }
  throw new Error('All Overpass mirrors failed');
}

// GET /api/admin/regions?country=DK
router.get('/regions', async (req: Request, res: Response) => {
  try {
    const country = (req.query.country as string || '').toUpperCase();
    if (!country) return res.status(400).json({ error: 'country is required' });

    const cacheKey = `regions:${country}`;
    const cached = cacheService.get<any[]>(cacheKey);
    if (cached) return res.json({ regions: cached, cached: true });

    // Resolve country area id
    const areaQuery = `[out:json][timeout:60];(rel["boundary"="administrative"]["admin_level"=2]["ISO3166-1"="${country}"];rel["boundary"="administrative"]["admin_level"=2]["ISO3166-1:alpha2"="${country}"];);out ids;`;
    const areaResp = await fetchOverpass(areaQuery);
    const rel = (areaResp.data?.elements || []).find((el: any) => el.type === 'relation');
    const areaId = rel ? 3600000000 + Number(rel.id) : null;

    const levelCandidates = [[4],[5],[6],[7],[8]];
    let regions: any[] = [];
    for (const levels of levelCandidates) {
      const levelRegex = levels.join('|');
      const q = areaId
        ? `[out:json][timeout:60];(rel["boundary"="administrative"]["admin_level"~"^(${levelRegex})$"](area:${areaId}););out tags center bb;`
        : `[out:json][timeout:60];(rel["boundary"="administrative"]["admin_level"~"^(${levelRegex})$"]["ISO3166-2"~"^${country}-"];);out tags center bb;`;
      const resp = await fetchOverpass(q);
      const elements = (resp.data?.elements || []).filter((el: any) => el.type === 'relation');
      if (elements.length) {
        regions = elements.map((el: any) => ({
          id: `state_${country}_${el.id}`,
          name: el.tags?.['official_name:en'] || el.tags?.['name:en'] || el.tags?.name,
          adminLevel: el.tags?.admin_level ? parseInt(el.tags.admin_level) : undefined,
          iso3166_2: el.tags?.['ISO3166-2'],
          osm: { type: 'relation', id: el.id, areaId: 3600000000 + Number(el.id) },
          bounds: el.bounds ? { south: el.bounds.minlat, west: el.bounds.minlon, north: el.bounds.maxlat, east: el.bounds.maxlon } : undefined,
          center: el.center ? { lat: el.center.lat, lng: el.center.lon } : undefined
        }));
        break;
      }
    }

    cacheService.set(cacheKey, regions, 7200);
    return res.json({ regions, cached: false });
  } catch (e: any) {
    console.error('admin/regions error', e?.message);
    return res.status(503).json({ error: 'regions unavailable' });
  }
});

// GET /api/admin/cities?relationId=XXXXX or ?bbox=south,west,north,east
router.get('/cities', async (req: Request, res: Response) => {
  try {
    const relationId = req.query.relationId as string | undefined;
    const bbox = req.query.bbox as string | undefined;
    if (!relationId && !bbox) return res.status(400).json({ error: 'relationId or bbox required' });

    const cacheKey = `cities:${relationId || bbox}`;
    const cached = cacheService.get<any[]>(cacheKey);
    if (cached) return res.json({ cities: cached, cached: true });

    let q: string;
    if (relationId) {
      q = `[out:json][timeout:60]; rel(${relationId})->.r; map_to_area.r->.a; (node(area.a)["place"~"^(city|town)$"]; ); out center tags;`;
    } else {
      q = `[out:json][timeout:60];(node["place"~"^(city|town)$"](${bbox}););out center tags;`;
    }

    const resp = await fetchOverpass(q);
    const cities = (resp.data?.elements || []).filter((el: any) => el.type === 'node' && el.tags?.name).map((el: any) => ({
      id: `city_${el.id}`,
      name: el.tags?.['name:en'] || el.tags?.name,
      center: { lat: el.lat, lng: el.lon },
      place: el.tags?.place,
      population: el.tags?.population ? parseInt(el.tags.population) : undefined
    }));

    cacheService.set(cacheKey, cities, 3600);
    return res.json({ cities, cached: false });
  } catch (e: any) {
    console.error('admin/cities error', e?.message);
    return res.status(503).json({ error: 'cities unavailable' });
  }
});

export default router;
