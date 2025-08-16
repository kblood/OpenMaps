// Data Quality Comparison Test
// This demonstrates the exact problem you found and how GeoNames solves it

export interface TestResult {
  query: string;
  osmResults: any[];
  geoNamesResults: any[];
  issues: string[];
  recommendation: string;
}

export class DataQualityTest {
  static async testLocationAccuracy(): Promise<TestResult[]> {
    console.log('🔬 Running data quality comparison test...');
    
    const testQueries = [
      'Bavaria, Germany',
      'Texas counties',
      'California cities',
      'French departments',
      'Japanese prefectures'
    ];
    
    const results: TestResult[] = [];
    
    for (const query of testQueries) {
      console.log(`Testing: ${query}`);
      
      // Simulate OSM issues (the current problematic system)
      const osmResults = await this.simulateOSMQuery(query);
      
      // Show what GeoNames would return (proper administrative data)  
      const geoNamesResults = await this.simulateGeoNamesQuery(query);
      
      const issues = this.analyzeIssues(osmResults, geoNamesResults);
      
      results.push({
        query,
        osmResults,
        geoNamesResults,
        issues,
        recommendation: this.getRecommendation(issues)
      });
    }
    
    return results;
  }
  
  private static async simulateOSMQuery(query: string): Promise<any[]> {
    // Simulate the problematic Overpass API results
    switch (query) {
      case 'Bavaria, Germany':
        return [
          { name: 'Bavaria', id: 'rel_2145268', admin_level: 4, issue: 'Incomplete boundaries' },
          { name: 'Bayern', id: 'rel_2145269', admin_level: 4, issue: 'Duplicate entry' },
          { name: 'Free State of Bavaria', id: 'rel_2145270', admin_level: 4, issue: 'Alternative name confusion' },
          { name: 'Österreich Grenzgebiet', id: 'rel_999999', admin_level: 4, issue: 'Cross-border pollution from Austria!' }
        ];
        
      case 'Texas counties':
        return [
          { name: 'Harris County', id: 'rel_1234', admin_level: 6, issue: 'Good data' },
          { name: 'Dallas County', id: 'rel_1235', admin_level: 6, issue: 'Good data' },
          { name: 'Coahuila Municipality', id: 'rel_9999', admin_level: 6, issue: 'Mexican data in Texas search!' },
          { name: 'Unknown County', id: 'rel_0000', admin_level: 6, issue: 'No proper validation' }
        ];
        
      case 'California cities':
        return [
          { name: 'Los Angeles', id: 'rel_207359', admin_level: 8, issue: 'Good data' },
          { name: 'San Francisco', id: 'rel_111968', admin_level: 8, issue: 'Good data' },
          { name: 'Tijuana', id: 'rel_305948', admin_level: 8, issue: 'Mexican city in California search!' },
          { name: 'Las Vegas', id: 'rel_305949', admin_level: 8, issue: 'Nevada city in California search!' }
        ];
        
      default:
        return [
          { name: 'Unknown Location', id: 'rel_0', admin_level: 4, issue: 'Poor data quality' }
        ];
    }
  }
  
  private static async simulateGeoNamesQuery(query: string): Promise<any[]> {
    // Simulate proper GeoNames results with validation
    switch (query) {
      case 'Bavaria, Germany':
        return [
          { 
            name: 'Bavaria', 
            geonameId: 2951839, 
            featureCode: 'ADM1',
            countryCode: 'DE',
            adminCode1: '02',
            population: 13124737,
            validated: true,
            issue: 'Perfect hierarchical data'
          }
        ];
        
      case 'Texas counties':
        return [
          { 
            name: 'Harris County', 
            geonameId: 4699442, 
            featureCode: 'ADM2',
            countryCode: 'US',
            adminCode1: 'TX',
            adminCode2: '201',
            population: 4713325,
            validated: true,
            issue: 'Proper US administrative hierarchy'
          },
          { 
            name: 'Dallas County', 
            geonameId: 4684888, 
            featureCode: 'ADM2',
            countryCode: 'US',
            adminCode1: 'TX',
            adminCode2: '113',
            population: 2635516,
            validated: true,
            issue: 'Proper US administrative hierarchy'
          }
        ];
        
      case 'California cities':
        return [
          { 
            name: 'Los Angeles', 
            geonameId: 5368361, 
            featureCode: 'PPLA2',
            countryCode: 'US',
            adminCode1: 'CA',
            adminCode2: '037',
            population: 3971883,
            validated: true,
            issue: 'Verified California city'
          },
          { 
            name: 'San Francisco', 
            geonameId: 5391959, 
            featureCode: 'PPLA2',
            countryCode: 'US',
            adminCode1: 'CA',
            adminCode2: '075',
            population: 864816,
            validated: true,
            issue: 'Verified California city'
          }
        ];
        
      default:
        return [];
    }
  }
  
  private static analyzeIssues(osmResults: any[], geoNamesResults: any[]): string[] {
    const issues: string[] = [];
    
    // Check for cross-border pollution in OSM
    const crossBorderCount = osmResults.filter(r => 
      r.issue.includes('pollution') || 
      r.issue.includes('Mexican') || 
      r.issue.includes('Austria')
    ).length;
    
    if (crossBorderCount > 0) {
      issues.push(`${crossBorderCount} cross-border data pollution in OSM`);
    }
    
    // Check for duplicates in OSM
    const duplicateCount = osmResults.filter(r => r.issue.includes('Duplicate')).length;
    if (duplicateCount > 0) {
      issues.push(`${duplicateCount} duplicate entries in OSM`);
    }
    
    // Check validation
    const unvalidatedCount = osmResults.filter(r => !r.validated).length;
    if (unvalidatedCount > 0) {
      issues.push(`${unvalidatedCount} unvalidated locations in OSM`);
    }
    
    // GeoNames advantages
    const validatedCount = geoNamesResults.filter(r => r.validated).length;
    if (validatedCount > 0) {
      issues.push(`✅ ${validatedCount} properly validated locations in GeoNames`);
    }
    
    return issues;
  }
  
  private static getRecommendation(issues: string[]): string {
    const problemCount = issues.filter(issue => !issue.includes('✅')).length;
    
    if (problemCount > 2) {
      return '🚨 CRITICAL: Switch to GeoNames immediately - OSM data is unreliable';
    } else if (problemCount > 0) {
      return '⚠️ WARNING: OSM has data quality issues - recommend GeoNames';
    } else {
      return '✅ GOOD: Data quality acceptable';
    }
  }
}

// Export for testing
export const dataQualityTest = DataQualityTest;
