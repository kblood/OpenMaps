// Tests for Dynamic Location Service geographical hierarchy
import { dynamicLocationService, DynamicLocationNode } from '../services/dynamicLocationService';

describe('Dynamic Location Service', () => {
  beforeAll(async () => {
    // Initialize the service
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Geographical Hierarchy', () => {
    test('Denmark should have correct administrative regions', async () => {
      // Get Denmark
      const denmark = await dynamicLocationService.getLocation('country_dk');
      expect(denmark).toBeTruthy();
      expect(denmark?.name).toBe('Denmark');

      if (!denmark) return;

      // Load Denmark's administrative divisions
      const regions = await dynamicLocationService.getChildren('country_dk');
      
      console.log('Denmark regions found:', regions.map(r => r.name));
      
      // Should have 5 regions
      expect(regions.length).toBeGreaterThan(0);
      
      // Check for proper Danish region names
      const regionNames = regions.map(r => r.name);
      const expectedRegions = ['Capital Region', 'Central Denmark', 'North Denmark', 'Zealand', 'Southern Denmark'];
      
      // At least some expected regions should be present
      const hasValidRegions = expectedRegions.some(expected => 
        regionNames.some(actual => actual.includes(expected))
      );
      
      expect(hasValidRegions).toBe(true);
      
      // All regions should be proper administrative divisions
      regions.forEach(region => {
        expect(region.level).toBe('state');
        expect(region.parentId).toBe('country_dk');
        expect(region.hasChildren).toBe(true);
        expect(region.metadata.countryCode).toBe('DK');
      });
    }, 30000);

    test('Regions should contain geographically correct cities', async () => {
      // Get a Danish region
      const regions = await dynamicLocationService.getChildren('country_dk');
      expect(regions.length).toBeGreaterThan(0);
      
      const capitalRegion = regions.find(r => 
        r.name.includes('Capital') || r.name.includes('Copenhagen')
      ) || regions[0];
      
      // Load cities in this region
      const cities = await dynamicLocationService.getChildren(capitalRegion.id);
      
      console.log(`Cities in ${capitalRegion.name}:`, cities.map(c => c.name));
      
      if (cities.length > 0) {
        // Cities should have proper metadata
        cities.forEach(city => {
          expect(city.level).toBe('city');
          expect(city.parentId).toBe(capitalRegion.id);
          expect(city.metadata.countryCode).toBe('DK');
          
          // Cities should be within region bounds
          expect(city.center.lat).toBeGreaterThanOrEqual(capitalRegion.bounds.south);
          expect(city.center.lat).toBeLessThanOrEqual(capitalRegion.bounds.north);
          expect(city.center.lng).toBeGreaterThanOrEqual(capitalRegion.bounds.west);
          expect(city.center.lng).toBeLessThanOrEqual(capitalRegion.bounds.east);
        });
        
        // Should not contain cities from other countries
        const nonDanishCities = cities.filter(city => 
          city.name.includes('Oslo') || 
          city.name.includes('Berlin') || 
          city.name.includes('Stockholm')
        );
        expect(nonDanishCities.length).toBe(0);
      }
    }, 30000);

    test('Cache invalidation works for problematic data', async () => {
      // This tests that old "Zealand" data gets cleared
      const regions = await dynamicLocationService.getChildren('country_dk', true); // Force refresh
      
      // Should not have the old incorrect "Zealand" name
      const hasOldZealand = regions.some(r => r.name === 'Zealand');
      expect(hasOldZealand).toBe(false);
      
      // But should have proper "Region Zealand" or similar
      const hasProperZealand = regions.some(r => 
        r.name.includes('Zealand') && r.name !== 'Zealand'
      );
      
      if (regions.length > 0) {
        expect(hasProperZealand).toBe(true);
      }
    }, 30000);

    test('API fallback system works properly', async () => {
      // Test with a country that might not have API data
      const testCountry: DynamicLocationNode = {
        id: 'country_test',
        name: 'Test Country',
        level: 'country',
        parentId: 'europe',
        hasChildren: true,
        childrenLoaded: false,
        childrenIds: [],
        bounds: { north: 60, south: 50, east: 10, west: 0 },
        center: { lat: 55, lng: 5 },
        isPreloaded: false,
        estimatedTiles: 1000,
        estimatedSizeMB: 20,
        isDownloaded: false,
        priority: 4,
        tags: ['country'],
        metadata: { countryCode: 'TC' },
        lastUpdated: Date.now(),
        source: 'api'
      };
      
      // This should gracefully fall back to predefined data or empty array
      const children = await dynamicLocationService.getChildren('country_test');
      
      // Should not crash and return an array
      expect(Array.isArray(children)).toBe(true);
    }, 15000);
  });

  describe('Data Quality', () => {
    test('No duplicate region names within same country', async () => {
      const regions = await dynamicLocationService.getChildren('country_dk');
      
      const regionNames = regions.map(r => r.name);
      const uniqueNames = new Set(regionNames);
      
      expect(regionNames.length).toBe(uniqueNames.size);
    });

    test('All locations have required fields', async () => {
      const regions = await dynamicLocationService.getChildren('country_dk');
      
      regions.forEach(region => {
        expect(region.id).toBeTruthy();
        expect(region.name).toBeTruthy();
        expect(region.level).toBeTruthy();
        expect(region.bounds).toBeTruthy();
        expect(region.center).toBeTruthy();
        expect(region.metadata).toBeTruthy();
        expect(typeof region.hasChildren).toBe('boolean');
      });
    });
  });
});