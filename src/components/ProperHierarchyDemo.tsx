// Proper Administrative Hierarchy Demo Component
// Uses GeoNames API with known administrative structures for accurate hierarchies

import React, { useState, useEffect } from 'react';
import { geoNamesAdminHierarchyService, AdminHierarchy, GeoNamesPlace } from '../services/geoNamesAdminHierarchyService';

interface ProperHierarchyDemoProps {
  onLocationSelect?: (place: GeoNamesPlace) => void;
}

interface TestResult {
  timestamp: string;
  test: string;
  status: 'running' | 'success' | 'error';
  message: string;
  data?: any;
  duration?: number;
}

export const ProperHierarchyDemo: React.FC<ProperHierarchyDemoProps> = ({ onLocationSelect }) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('DK'); // Denmark
  const [hierarchyData, setHierarchyData] = useState<AdminHierarchy | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<AdminHierarchy[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [cacheStats, setCacheStats] = useState<any>(null);

  // Add test result
  const addTestResult = (test: string, status: 'running' | 'success' | 'error', message: string, data?: any, duration?: number) => {
    const result: TestResult = {
      timestamp: new Date().toLocaleTimeString(),
      test,
      status,
      message,
      data,
      duration
    };
    
    setTestResults(prev => [result, ...prev.slice(0, 19)]); // Keep last 20 results
  };

  // Clear test results
  const clearResults = () => {
    setTestResults([]);
    setHierarchyData(null);
    setSearchResults([]);
    setExpandedNodes(new Set());
    geoNamesAdminHierarchyService.clearCache();
  };

  // Test proper hierarchy building
  const testProperHierarchy = async (countryCode: string) => {
    addTestResult(`${countryCode} Proper Hierarchy`, 'running', `Building proper administrative hierarchy for ${countryCode}...`);
    const startTime = Date.now();

    try {
      const hierarchy = await geoNamesAdminHierarchyService.buildCountryHierarchy(countryCode);
      
      // Count totals
      const regionCount = hierarchy.children.length;
      const municipalityCount = hierarchy.children.reduce((sum, region) => sum + region.children.length, 0);
      
      addTestResult(
        `${countryCode} Proper Hierarchy`,
        'success',
        `Built hierarchy: ${regionCount} regions, ${municipalityCount} municipalities`,
        { 
          country: hierarchy.place.name,
          regions: hierarchy.children.map(r => ({ name: r.name, municipalities: r.children.length })),
          totalMunicipalities: municipalityCount
        },
        Date.now() - startTime
      );

      if (countryCode === selectedCountry) {
        setHierarchyData(hierarchy);
      }

    } catch (error) {
      addTestResult(
        `${countryCode} Proper Hierarchy`,
        'error',
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error },
        Date.now() - startTime
      );
    }
  };

  // Test region verification
  const testRegionVerification = async (countryCode: string) => {
    addTestResult(`${countryCode} Region Verification`, 'running', `Verifying all 5 regions exist for Denmark...`);
    const startTime = Date.now();

    try {
      const regions = await geoNamesAdminHierarchyService.getCountryRegions(countryCode);
      
      const expectedRegions = ['Nordjylland', 'Hovedstaden', 'Midtjylland', 'Syddanmark', 'Sjælland'];
      const foundRegions = regions.map(r => r.name.replace('Region ', ''));
      
      const missingRegions = expectedRegions.filter(expected => 
        !foundRegions.some(found => found.includes(expected))
      );
      
      if (missingRegions.length === 0) {
        addTestResult(
          `${countryCode} Region Verification`,
          'success',
          `✅ All 5 Danish regions found correctly: ${foundRegions.join(', ')}`,
          { 
            expected: expectedRegions,
            found: foundRegions,
            regions: regions.map(r => ({ name: r.name, geonameId: r.geonameId, population: r.population }))
          },
          Date.now() - startTime
        );
      } else {
        addTestResult(
          `${countryCode} Region Verification`,
          'error',
          `❌ Missing regions: ${missingRegions.join(', ')}`,
          { expected: expectedRegions, found: foundRegions, missing: missingRegions },
          Date.now() - startTime
        );
      }

    } catch (error) {
      addTestResult(
        `${countryCode} Region Verification`,
        'error',
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error },
        Date.now() - startTime
      );
    }
  };

  // Test Nordjylland specifically
  const testNordjyllandSpecific = async () => {
    addTestResult('Nordjylland Specific Test', 'running', 'Testing Nordjylland region specifically...');
    const startTime = Date.now();

    try {
      const searchResults = await geoNamesAdminHierarchyService.searchInHierarchy('DK', 'Nordjylland', 'region');
      
      if (searchResults.length > 0) {
        const nordjylland = searchResults[0];
        const municipalities = await geoNamesAdminHierarchyService.getRegionMunicipalities(nordjylland.geonameId);
        
        addTestResult(
          'Nordjylland Specific Test',
          'success',
          `✅ Found Nordjylland as a region with ${municipalities.length} municipalities`,
          { 
            region: nordjylland,
            municipalities: municipalities.map(m => ({ name: m.name, population: m.population }))
          },
          Date.now() - startTime
        );
      } else {
        addTestResult(
          'Nordjylland Specific Test',
          'error',
          '❌ Nordjylland not found as a region',
          { searchResults },
          Date.now() - startTime
        );
      }

    } catch (error) {
      addTestResult(
        'Nordjylland Specific Test',
        'error',
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error },
        Date.now() - startTime
      );
    }
  };

  // Test administrative structure
  const testAdminStructure = async (countryCode: string) => {
    addTestResult(`${countryCode} Admin Structure`, 'running', 'Testing administrative structure consistency...');
    const startTime = Date.now();

    try {
      const structure = await geoNamesAdminHierarchyService.getCountryAdminStructure(countryCode);
      
      const totalMunicipalities = Array.from(structure.municipalities.values())
        .reduce((sum, muns) => sum + muns.length, 0);
      
      addTestResult(
        `${countryCode} Admin Structure`,
        'success',
        `Structure: 1 country → ${structure.regions.length} regions → ${totalMunicipalities} municipalities`,
        { 
          country: structure.country.name,
          regionDetails: structure.regions.map(r => ({
            name: r.name,
            geonameId: r.geonameId,
            municipalities: structure.municipalities.get(r.geonameId)?.length || 0
          })),
          totalMunicipalities
        },
        Date.now() - startTime
      );

    } catch (error) {
      addTestResult(
        `${countryCode} Admin Structure`,
        'error',
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error },
        Date.now() - startTime
      );
    }
  };

  // Run comprehensive test suite
  const runFullTestSuite = async () => {
    setIsRunning(true);
    clearResults();

    const countries = ['DK']; // Start with Denmark to prove the concept
    
    for (const country of countries) {
      await testProperHierarchy(country);
      await testRegionVerification(country);
      await testAdminStructure(country);
      await testNordjyllandSpecific();
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Update cache stats
    setCacheStats(geoNamesAdminHierarchyService.getCacheStats());
    setIsRunning(false);
  };

  // Handle search
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    try {
      const results = await geoNamesAdminHierarchyService.searchInHierarchy(selectedCountry, searchTerm);
      setSearchResults(results);
      
      addTestResult(
        'Search',
        'success',
        `Found ${results.length} results for "${searchTerm}"`,
        { results: results.map(r => ({ name: r.name, level: r.level, path: r.path })) }
      );
    } catch (error) {
      addTestResult(
        'Search',
        'error',
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  // Handle node expansion
  const handleNodeExpand = (geonameId: number) => {
    const newExpanded = new Set(expandedNodes);
    if (expandedNodes.has(geonameId)) {
      newExpanded.delete(geonameId);
    } else {
      newExpanded.add(geonameId);
    }
    setExpandedNodes(newExpanded);
  };

  // Update cache stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRunning) {
        setCacheStats(geoNamesAdminHierarchyService.getCacheStats());
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4 flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-green-800">🏛️ PROPER Administrative Hierarchy System</h2>
            <p className="text-sm text-green-600">Using GeoNames with known administrative structures - Denmark → 5 Regions → 98 Municipalities</p>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
              disabled={isRunning}
            >
              <option value="DK">🇩🇰 Denmark (Proper)</option>
              <option value="DE">🇩🇪 Germany (16 States)</option>
            </select>
            <button
              onClick={runFullTestSuite}
              disabled={isRunning}
              className={`px-4 py-2 rounded text-sm font-medium ${
                isRunning 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {isRunning ? '🔄 Testing...' : '✅ Test Proper Hierarchy'}
            </button>
            <button
              onClick={clearResults}
              disabled={isRunning}
              className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
            >
              🗑️ Clear
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for regions, municipalities..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            🔍 Search
          </button>
        </div>

        {/* Cache Statistics */}
        {cacheStats && (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-green-50 p-3 rounded">
              <div className="font-semibold text-green-800">Known Countries</div>
              <div className="text-green-600">{cacheStats.knownCountries} predefined structures</div>
            </div>
            <div className="bg-blue-50 p-3 rounded">
              <div className="font-semibold text-blue-800">Cache</div>
              <div className="text-blue-600">{cacheStats.cacheSize} cached places</div>
            </div>
            <div className="bg-orange-50 p-3 rounded">
              <div className="font-semibold text-orange-800">Active Requests</div>
              <div className="text-orange-600">{cacheStats.activeRequests} pending</div>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Test Results */}
        <div className="w-1/2 flex flex-col border-r bg-white">
          <div className="p-4 border-b">
            <h3 className="font-semibold mb-2">📋 Test Results</h3>
            <p className="text-sm text-gray-600">
              Testing proper administrative hierarchies with known structures
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {testResults.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>Click "Test Proper Hierarchy" to verify correct structure</p>
                <p className="text-sm mt-2">This will prove Denmark has 5 regions including Nordjylland</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {testResults.map((result, index) => (
                  <div
                    key={`${result.timestamp}-${index}`}
                    className={`p-3 rounded border-l-4 ${
                      result.status === 'success' 
                        ? 'bg-green-50 border-green-400' 
                        : result.status === 'error'
                        ? 'bg-red-50 border-red-400'
                        : 'bg-blue-50 border-blue-400'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{result.test}</span>
                          {result.status === 'running' && (
                            <div className="animate-spin w-3 h-3 border border-blue-500 border-t-transparent rounded-full"></div>
                          )}
                          {result.duration && (
                            <span className="text-xs text-gray-500">({result.duration}ms)</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-700 mt-1">{result.message}</div>
                        {result.data && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-500 cursor-pointer">View Data</summary>
                            <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto max-h-32">
                              {JSON.stringify(result.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 ml-2">{result.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Hierarchy View */}
        <div className="w-1/2 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold mb-2">🌳 Proper Hierarchy View</h3>
            <p className="text-sm text-gray-600">
              Correct administrative structure for {selectedCountry}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {hierarchyData ? (
              <ProperHierarchyNodeView
                node={hierarchyData}
                expandedNodes={expandedNodes}
                onNodeExpand={handleNodeExpand}
                onNodeSelect={(place) => {
                  console.log('Proper hierarchy place selected:', place);
                  onLocationSelect?.(place);
                }}
              />
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">
                  Search results for "{searchTerm}":
                </p>
                {searchResults.map((result) => (
                  <div
                    key={result.geonameId}
                    className="p-3 border rounded cursor-pointer hover:bg-gray-50"
                    onClick={() => onLocationSelect?.(result.place)}
                  >
                    <div className="font-medium text-sm">{result.name}</div>
                    <div className="text-xs text-gray-500">
                      {result.level} • Path: {result.path.join(' → ')}
                    </div>
                    {result.place.population && (
                      <div className="text-xs text-gray-500">
                        Population: {result.place.population.toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <p>No hierarchy data available</p>
                <p className="text-sm mt-2">Run tests to load proper structure</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Proper Hierarchy Node View Component
interface ProperHierarchyNodeViewProps {
  node: AdminHierarchy;
  expandedNodes: Set<number>;
  onNodeExpand: (geonameId: number) => void;
  onNodeSelect: (place: GeoNamesPlace) => void;
  level?: number;
}

const ProperHierarchyNodeView: React.FC<ProperHierarchyNodeViewProps> = ({
  node,
  expandedNodes,
  onNodeExpand,
  onNodeSelect,
  level = 0
}) => {
  const isExpanded = expandedNodes.has(node.geonameId);
  const hasChildren = node.children.length > 0;

  const getLevelIcon = (nodeLevel: string) => {
    switch (nodeLevel) {
      case 'country': return '🏛️';
      case 'region': return '🏞️';
      case 'municipality': return '🏘️';
      case 'city': return '🏙️';
      default: return '📍';
    }
  };

  const getLevelColor = (nodeLevel: string) => {
    switch (nodeLevel) {
      case 'country': return 'text-blue-600 bg-blue-50';
      case 'region': return 'text-green-600 bg-green-50';
      case 'municipality': return 'text-purple-600 bg-purple-50';
      case 'city': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className={`ml-${level * 4}`}>
      <div
        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${getLevelColor(node.level)}`}
        onClick={() => onNodeSelect(node.place)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNodeExpand(node.geonameId);
            }}
            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        <span className="text-lg">{getLevelIcon(node.level)}</span>
        <div className="flex-1">
          <div className="font-medium text-sm">{node.name}</div>
          <div className="text-xs opacity-75">
            {node.level} • Level {node.adminLevel}
            {node.place.population && ` • ${node.place.population.toLocaleString()}`}
          </div>
          {node.children.length > 0 && (
            <div className="text-xs opacity-60">
              {node.children.length} {node.level === 'country' ? 'regions' : node.level === 'region' ? 'municipalities' : 'children'}
            </div>
          )}
        </div>
      </div>
      
      {isExpanded && node.children.length > 0 && (
        <div className="ml-4 border-l border-gray-200 pl-2">
          {node.children.map((child) => (
            <ProperHierarchyNodeView
              key={child.geonameId}
              node={child}
              expandedNodes={expandedNodes}
              onNodeExpand={onNodeExpand}
              onNodeSelect={onNodeSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProperHierarchyDemo;