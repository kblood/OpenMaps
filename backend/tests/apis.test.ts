/**
 * Integration tests for OpenMaps Backend APIs
 * Tests for MBTiles, Geofabrik, Tile Proxy, and other services
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE = 'http://localhost:3001/api';
const BACKEND_HEALTH = 'http://localhost:3001/health';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
    console.log(`  ✗ ${name}: ${error}`);
  }
}

async function runTests() {
  const api = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
    validateStatus: () => true
  });

  console.log('\n🧪 OpenMaps Backend Integration Tests\n');

  // ==================== Health Check ====================
  console.log('📋 Health Check');
  await test('Backend should be healthy', async () => {
    const response = await axios.get(BACKEND_HEALTH);
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (response.data.status !== 'healthy') throw new Error(`Expected healthy status`);
  });

  // ==================== MBTiles API ====================
  console.log('\n📦 MBTiles API');
  await test('MBTiles health endpoint', async () => {
    const response = await api.get('/mbtiles/health');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (response.data.status !== 'ok') throw new Error(`Expected ok status`);
  });

  await test('MBTiles list endpoint', async () => {
    const response = await api.get('/mbtiles/list');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!Array.isArray(response.data.files)) throw new Error(`Files should be an array`);
  });

  await test('MBTiles non-existent file returns 404', async () => {
    const response = await api.get('/mbtiles/metadata/nonexistent.mbtiles');
    if (response.status !== 404) throw new Error(`Expected 404, got ${response.status}`);
  });

  // ==================== Geofabrik API ====================
  console.log('\n🌍 Geofabrik API');
  await test('Geofabrik health endpoint', async () => {
    const response = await api.get('/geofabrik/health');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (response.data.status !== 'ok') throw new Error(`Expected ok status`);
  });

  await test('Geofabrik regions list', async () => {
    const response = await api.get('/geofabrik/regions');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!Array.isArray(response.data.regions)) throw new Error(`Regions should be an array`);
    if (response.data.regions.length === 0) throw new Error(`Should have regions`);
  });

  await test('Geofabrik regions have required fields', async () => {
    const response = await api.get('/geofabrik/regions');
    const region = response.data.regions[0];
    if (!region.id) throw new Error(`Missing id`);
    if (!region.name) throw new Error(`Missing name`);
    if (!region.size) throw new Error(`Missing size`);
    if (!region.sizeFormatted) throw new Error(`Missing sizeFormatted`);
    if (!Array.isArray(region.availableFormats)) throw new Error(`availableFormats should be array`);
  });

  await test('Geofabrik has expected regions', async () => {
    const response = await api.get('/geofabrik/regions');
    const regionIds = response.data.regions.map((r: any) => r.id);
    const expectedRegions = ['denmark', 'germany', 'france', 'united-kingdom'];
    for (const region of expectedRegions) {
      if (!regionIds.includes(region)) throw new Error(`Missing region: ${region}`);
    }
  });

  await test('Geofabrik downloaded files list', async () => {
    const response = await api.get('/geofabrik/downloaded');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!Array.isArray(response.data.files)) throw new Error(`Files should be an array`);
  });

  // ==================== Tile Proxy API ====================
  console.log('\n🗺️ Tile Proxy API');
  await test('Tile proxy health endpoint', async () => {
    const response = await api.get('/tiles/health');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (response.data.status !== 'ok') throw new Error(`Expected ok status`);
  });

  await test('Tile proxy OSM tiles', async () => {
    const response = await api.get('/tiles/proxy/osm/10/512/512.png', {
      responseType: 'arraybuffer'
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!response.data || response.data.byteLength === 0) throw new Error(`No tile data received`);
  });

  await test('Tile proxy satellite tiles', async () => {
    const response = await api.get('/tiles/proxy/satellite/10/512/512.png', {
      responseType: 'arraybuffer'
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!response.data || response.data.byteLength === 0) throw new Error(`No tile data received`);
  });

  await test('Tile proxy v2 route works', async () => {
    const response = await api.get('/tiles/proxy/v2/osm/10/512/512.png', {
      responseType: 'arraybuffer'
    });
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  });

  await test('Tile proxy rejects invalid coordinates', async () => {
    const response = await api.get('/tiles/proxy/osm/abc/xyz/123.png');
    if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
    if (!response.data.error) throw new Error(`Should have error message`);
  });

  await test('Tile proxy rejects invalid provider', async () => {
    const response = await api.get('/tiles/proxy/invalid-provider/10/512/512.png');
    if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
  });

  await test('Tile proxy sets CORS headers', async () => {
    const response = await api.get('/tiles/proxy/osm/10/512/512.png', {
      responseType: 'arraybuffer'
    });
    if (!response.headers['access-control-allow-origin']) throw new Error(`Missing CORS header`);
    if (!response.headers['content-type']) throw new Error(`Missing content-type header`);
  });

  // ==================== Geocoding API ====================
  console.log('\n🔍 Geocoding API');
  await test('Geocoding search works', async () => {
    const response = await api.get('/geocoding/search?q=London');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!Array.isArray(response.data)) throw new Error(`Should return array`);
    if (response.data.length === 0) throw new Error(`Should have results`);
  });

  await test('Geocoding results have required fields', async () => {
    const response = await api.get('/geocoding/search?q=London');
    const result = response.data[0];
    if (!result.display_name) throw new Error(`Missing display_name`);
    if (!result.lat) throw new Error(`Missing lat`);
    if (!result.lon) throw new Error(`Missing lon`);
  });

  // ==================== Admin Regions API ====================
  console.log('\n🏛️ Admin Regions API');
  await test('Admin regions for valid country', async () => {
    const response = await api.get('/admin/regions?country=US');
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!Array.isArray(response.data.regions)) throw new Error(`Should have regions array`);
    if (response.data.regions.length === 0) throw new Error(`Should have US regions`);
  });

  await test('Admin regions have required fields', async () => {
    const response = await api.get('/admin/regions?country=US');
    const region = response.data.regions[0];
    if (!region.id) throw new Error(`Missing id`);
    if (!region.name) throw new Error(`Missing name`);
    if (region.adminLevel === undefined) throw new Error(`Missing adminLevel`);
  });

  // ==================== Routing API ====================
  console.log('\n🛣️ Routing API');
  await test('Routing directions works', async () => {
    const response = await api.get(
      '/routing/directions?start=51.5074,-0.1278&end=51.5194,-0.1270&profile=driving'
    );
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!response.data.route) throw new Error(`Missing route`);
    if (!response.data.route.distance) throw new Error(`Missing distance`);
    if (!response.data.route.duration) throw new Error(`Missing duration`);
  });

  await test('Routing returns geometry', async () => {
    const response = await api.get(
      '/routing/directions?start=51.5074,-0.1278&end=51.5194,-0.1270&profile=driving'
    );
    if (!response.data.route.geometry) throw new Error(`Missing geometry`);
  });

  // ==================== Summary ====================
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Test Results: ${passed}/${total} passed`);
  console.log(`${'='.repeat(60)}\n`);

  if (failed > 0) {
    console.log('❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}`);
      if (r.error) console.log(`    ${r.error}`);
    });
    console.log();
  }

  return failed === 0;
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });

export {};
