#!/usr/bin/env node

/**
 * Simple test runner for OpenMaps backend
 * No dependencies required - uses only built-in modules and axios
 * 
 * Usage: npx ts-node tests/simple-test.ts
 * Or: node dist/tests/simple-test.js (after building)
 */

import axios from 'axios';

interface TestCase {
  name: string;
  url: string;
  method?: string;
  expectedStatus?: number;
  validate?: (response: any) => boolean;
}

const BACKEND = 'http://localhost:3001';
const tests: TestCase[] = [
  // Health checks
  {
    name: '✓ Backend health check',
    url: `${BACKEND}/health`,
    expectedStatus: 200,
    validate: (r) => r.data.status === 'healthy'
  },
  {
    name: '✓ MBTiles health',
    url: `${BACKEND}/api/mbtiles/health`,
    expectedStatus: 200,
    validate: (r) => r.data.status === 'ok' && r.data.service === 'mbtiles'
  },
  {
    name: '✓ Tile proxy health',
    url: `${BACKEND}/api/tiles/health`,
    expectedStatus: 200,
    validate: (r) => r.data.status === 'ok' && r.data.service === 'tile-proxy'
  },
  {
    name: '✓ Geofabrik health',
    url: `${BACKEND}/api/geofabrik/health`,
    expectedStatus: 200,
    validate: (r) => r.data.status === 'ok' && r.data.service === 'geofabrik'
  },

  // MBTiles APIs
  {
    name: '✓ MBTiles list files',
    url: `${BACKEND}/api/mbtiles/list`,
    expectedStatus: 200,
    validate: (r) => typeof r.data.count === 'number' && Array.isArray(r.data.files)
  },

  // Geofabrik APIs
  {
    name: '✓ Geofabrik regions',
    url: `${BACKEND}/api/geofabrik/regions`,
    expectedStatus: 200,
    validate: (r) => Array.isArray(r.data.regions) && r.data.regions.length > 0
  },
  {
    name: '✓ Geofabrik has Denmark',
    url: `${BACKEND}/api/geofabrik/regions`,
    expectedStatus: 200,
    validate: (r) => r.data.regions.some((reg: any) => reg.id === 'denmark')
  },
  {
    name: '✓ Geofabrik downloaded files',
    url: `${BACKEND}/api/geofabrik/downloaded`,
    expectedStatus: 200,
    validate: (r) => typeof r.data.count === 'number' && Array.isArray(r.data.files)
  },

  // Tile Proxy APIs
  {
    name: '✓ OSM tiles proxy',
    url: `${BACKEND}/api/tiles/proxy/osm/10/512/512.png`,
    expectedStatus: 200,
    validate: (r) => r.data.byteLength > 0
  },
  {
    name: '✓ Satellite tiles proxy',
    url: `${BACKEND}/api/tiles/proxy/satellite/10/512/512.png`,
    expectedStatus: 200,
    validate: (r) => r.data.byteLength > 0
  },
  {
    name: '✓ Tile proxy v2 route',
    url: `${BACKEND}/api/tiles/proxy/v2/osm/10/512/512.png`,
    expectedStatus: 200,
    validate: (r) => r.data.byteLength > 0
  },

  {
    name: '✓ Geocoding search',
    url: `${BACKEND}/api/geocoding/search?q=London`,
    expectedStatus: 200,
    validate: (r) => {
      const results = r.data.results || r.data;
      return Array.isArray(results) && results.length > 0;
    }
  },
  {
    name: '✓ Admin regions for US',
    url: `${BACKEND}/api/admin/regions?country=US`,
    expectedStatus: 200,
    validate: (r) => Array.isArray(r.data.regions) && r.data.regions.length > 0
  },

  // Routing APIs
  {
    name: '✓ Routing directions',
    url: `${BACKEND}/api/routing/directions?start=51.5074,-0.1278&end=51.5194,-0.1270&profile=driving`,
    expectedStatus: 200,
    validate: (r) => r.data.route && r.data.route.distance > 0 && r.data.route.duration > 0
  },

  // Error cases
  {
    name: '✓ Invalid tile coordinates rejected',
    url: `${BACKEND}/api/tiles/proxy/osm/abc/xyz/123.png`,
    expectedStatus: 400
  },
  {
    name: '✓ Invalid provider rejected',
    url: `${BACKEND}/api/tiles/proxy/invalid-provider/10/512/512.png`,
    expectedStatus: 400
  },
  {
    name: '✓ Non-existent MBTiles returns 404',
    url: `${BACKEND}/api/mbtiles/metadata/nonexistent.mbtiles`,
    expectedStatus: 404
  },
];

async function runTests() {
  console.log('\n🧪 OpenMaps Backend Test Suite\n');
  console.log(`Testing: ${BACKEND}\n`);

  let passed = 0;
  let failed = 0;
  const failedTests: string[] = [];

  for (const test of tests) {
    try {
      const response = await axios({
        method: test.method || 'GET',
        url: test.url,
        responseType: test.url.includes('.png') ? 'arraybuffer' : 'json',
        timeout: 15000, // Increased timeout for slow APIs
        validateStatus: () => true // Don't throw on any status
      });

      let success = true;
      let reason = '';

      // Check status code
      if (test.expectedStatus && response.status !== test.expectedStatus) {
        success = false;
        reason = `Expected ${test.expectedStatus}, got ${response.status}`;
      }

      // Run custom validation
      if (success && test.validate) {
        try {
          success = test.validate(response);
          if (!success) reason = 'Validation failed';
        } catch (e) {
          success = false;
          reason = String(e);
        }
      }

      if (success) {
        console.log(`${test.name}`);
        passed++;
      } else {
        console.log(`✗ ${test.name}`);
        console.log(`  → ${reason}\n`);
        failed++;
        failedTests.push(test.name);
      }
    } catch (error) {
      console.log(`✗ ${test.name}`);
      console.log(`  → ${(error as any).message}\n`);
      failed++;
      failedTests.push(test.name);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Results: ${passed}/${tests.length} tests passed`);
  console.log(`${'='.repeat(50)}\n`);

  if (failed > 0) {
    console.log(`❌ Failed tests (${failed}):`);
    failedTests.forEach(name => console.log(`  - ${name}`));
    console.log();
  } else {
    console.log('✅ All tests passed!\n');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run immediately
runTests().catch(error => {
  console.error('Test runner crashed:', error);
  process.exit(1);
});
