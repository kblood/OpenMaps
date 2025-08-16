// OSM Hierarchy Demo Component
// Demonstrates the new OSM-based hierarchical system with real data testing

import React, { useState, useEffect } from 'react';
import { osmAdminBoundaryService, OSMAdminBoundary } from '../services/osmAdminBoundaryService';
import { adaptiveHierarchyService, HierarchyNode } from '../services/adaptiveHierarchyService';
import { geographyAwareExtractionService, ExtractionContext, GeographicConstraints } from '../services/geographyAwareExtractionService';
import { hierarchyApiService } from '../services/hierarchyApiService';
import { multiTierCacheService } from '../services/multiTierCacheService';

interface OSMHierarchyDemoProps {
  onLocationSelect?: (location: OSMAdminBoundary) => void;
}

interface TestResult {
  timestamp: string;
  test: string;
  status: 'running' | 'success' | 'error';
  message: string;
  data?: any;
  duration?: number;
}

export const OSMHierarchyDemo: React.FC<OSMHierarchyDemoProps> = ({ onLocationSelect }) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState('DK'); // Denmark
  const [hierarchyData, setHierarchyData] = useState<HierarchyNode | null>(null);
  const [boundaries, setBoundaries] = useState<OSMAdminBoundary[]>([]);
  const [selectedBoundary, setSelectedBoundary] = useState<OSMAdminBoundary | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
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
    setBoundaries([]);
    setSelectedBoundary(null);
    setExpandedNodes(new Set());
    
    // Also clear the OSM cache to ensure fresh queries
    osmAdminBoundaryService.clearCache();
    adaptiveHierarchyService.clearCache();
  };

  // Run comprehensive test suite
  const runFullTestSuite = async () => {
    setIsRunning(true);
    clearResults();

    const countries = ['DK', 'DE']; // Denmark and Germany
    
    for (const country of countries) {
      await testCountryBoundaries(country);
      await testHierarchyBuilding(country);
      await testGeographyAwareExtraction(country);
      await testApiEndpoints(country);
      
      // Small delay between countries
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await testCachePerformance();
    setIsRunning(false);
  };

  // Test country boundaries fetching
  const testCountryBoundaries = async (country: string) => {
    addTestResult(`${country} Boundaries`, 'running', `Fetching boundaries for ${country}...`);
    const startTime = Date.now();

    try {
      // Test different admin levels
      const levels = [2, 4, 6, 8];
      const results: { [level: number]: OSMAdminBoundary[] } = {};

      for (const level of levels) {
        const levelBoundaries = await osmAdminBoundaryService.getBoundariesByLevel(country, level, false);
        results[level] = levelBoundaries;
        
        addTestResult(
          `${country} Level ${level}`,
          'success',
          `Found ${levelBoundaries.length} boundaries at admin level ${level}`,
          { count: levelBoundaries.length, sample: levelBoundaries.slice(0, 3) },
          Date.now() - startTime
        );
      }

      // Test country search with appropriate terms
      const searchTerm = country === 'DK' ? 'København' : 'Berlin';
      const searchResults = await osmAdminBoundaryService.searchBoundaries(searchTerm, country, false);
      addTestResult(
        `${country} Search`,
        'success',
        `Search for "${searchTerm}" found ${searchResults.length} results`,
        { results: searchResults.slice(0, 5) }
      );

      setBoundaries(results[4] || []); // Show level 4 by default

    } catch (error) {
      addTestResult(
        `${country} Boundaries`,
        'error',
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error },
        Date.now() - startTime
      );
    }
  };

  // Test hierarchy building
  const testHierarchyBuilding = async (country: string) => {
    addTestResult(`${country} Hierarchy`, 'running', `Building adaptive hierarchy for ${country}...`);
    const startTime = Date.now();

    try {
      const hierarchy = await adaptiveHierarchyService.buildHierarchy({
        countryCode: country,
        maxDepth: 5,
        prioritizeLevels: [2, 4, 6, 8],
        includeGeometry: false,
        spatialIndexing: false,
        cacheStrategy: 'hybrid'
      });

      const stats = adaptiveHierarchyService.getHierarchyStats(country);
      
      addTestResult(
        `${country} Hierarchy`,
        'success',
        `Built hierarchy with ${stats?.totalNodes || 0} nodes, ${stats?.totalLevels || 0} levels`,
        { hierarchy: hierarchy.boundary, stats },
        Date.now() - startTime
      );

      if (country === selectedCountry) {
        setHierarchyData(hierarchy);
      }

      // Test hierarchy search with better terms
      const hierarchySearchTerm = country === 'DK' ? 'Region' : 'Land';
      const searchResults = await adaptiveHierarchyService.searchHierarchy(country, hierarchySearchTerm, 10);
      addTestResult(
        `${country} Hierarchy Search`,
        'success',
        `Search found ${searchResults.length} matches for "${hierarchySearchTerm}"`,
        { results: searchResults.slice(0, 3) }
      );

    } catch (error) {
      addTestResult(
        `${country} Hierarchy`,
        'error',
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error },
        Date.now() - startTime
      );
    }
  };

  // Test geography-aware extraction
  const testGeographyAwareExtraction = async (country: string) => {
    addTestResult(`${country} Geo Extract`, 'running', `Testing geography-aware extraction for ${country}...`);
    const startTime = Date.now();

    try {
      const context: ExtractionContext = {
        countryCode: country,
        adminLevel: 6,
        preferredLanguage: 'en',
        culturalContext: 'nordic'
      };

      const constraints: GeographicConstraints = {
        minPopulation: 10000,
        includeCapitals: true
      };

      const result = await geographyAwareExtractionService.extractBoundaries(context, constraints);
      
      addTestResult(
        `${country} Geo Extract`,
        'success',
        `Extracted ${result.boundaries?.length || 0} boundaries with ${result.metadata?.confidence || 0}% confidence`,
        { 
          metadata: result.metadata,
          sampleBoundaries: result.boundaries?.slice(0, 3) || []
        },
        Date.now() - startTime
      );

      // Test intelligent region extraction with better terms
      const regionSearchTerm = country === 'DK' ? 'København' : 'Berlin';
      const regionResult = await geographyAwareExtractionService.extractRegionIntelligently(
        regionSearchTerm,
        context,
        { includeNeighbors: true }
      );

      addTestResult(
        `${country} Region Extract`,
        'success',
        `Intelligent extraction found ${regionResult.boundaries?.length || 0} regions for "${regionSearchTerm}"`,
        { metadata: regionResult.metadata }
      );

    } catch (error) {
      addTestResult(
        `${country} Geo Extract`,
        'error',
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error },
        Date.now() - startTime
      );
    }
  };

  // Test API endpoints
  const testApiEndpoints = async (country: string) => {
    addTestResult(`${country} API`, 'running', `Testing REST API endpoints for ${country}...`);
    const startTime = Date.now();

    try {
      // Test boundary search API
      const searchResponse = await hierarchyApiService.searchBoundaries(
        { country, adminLevel: 4 },
        { page: 1, limit: 10 }
      );

      if (searchResponse.success && searchResponse.data) {
        addTestResult(
          `${country} API Search`,
          'success',
          `API search returned ${searchResponse.data.items?.length || 0} boundaries`,
          { 
            pagination: searchResponse.data.pagination,
            cacheHit: searchResponse.metadata?.cacheHit,
            response: searchResponse.data
          }
        );
      } else {
        addTestResult(
          `${country} API Search`,
          'error',
          `API search failed: ${searchResponse.error?.message || 'Unknown error'}`,
          { response: searchResponse }
        );
      }

      // Test hierarchy API
      const hierarchyResponse = await hierarchyApiService.getHierarchy(country, { 
        maxDepth: 3,
        format: 'tree'
      });

      if (hierarchyResponse.success) {
        addTestResult(
          `${country} API Hierarchy`,
          'success',
          `API hierarchy built successfully`,
          { 
            cacheHit: hierarchyResponse.metadata?.cacheHit,
            processingTime: hierarchyResponse.metadata?.processingTime
          }
        );
      }

      // Test search hierarchy API with better terms
      const apiSearchTerm = country === 'DK' ? 'Region' : 'Land';
      const hierarchySearchResponse = await hierarchyApiService.searchHierarchy(country, apiSearchTerm, { maxResults: 5 });

      if (hierarchySearchResponse.success && hierarchySearchResponse.data) {
        addTestResult(
          `${country} API Hierarchy Search`,
          'success',
          `Hierarchy search found ${hierarchySearchResponse.data.length || 0} matches for "${apiSearchTerm}"`,
          { 
            results: hierarchySearchResponse.data.slice(0, 3),
            cacheHit: hierarchySearchResponse.metadata?.cacheHit
          }
        );
      } else {
        addTestResult(
          `${country} API Hierarchy Search`,
          'error',
          `Hierarchy search failed: ${hierarchySearchResponse.error?.message || 'Unknown error'}`,
          { response: hierarchySearchResponse }
        );
      }

    } catch (error) {
      addTestResult(
        `${country} API`,
        'error',
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error },
        Date.now() - startTime
      );
    }
  };

  // Test cache performance
  const testCachePerformance = async () => {
    addTestResult('Cache Performance', 'running', 'Testing cache performance...');
    const startTime = Date.now();

    try {
      // Get cache statistics
      const stats = multiTierCacheService.getStats();
      const osmStats = osmAdminBoundaryService.getCacheStats();

      setCacheStats({ multi: stats, osm: osmStats });

      addTestResult(
        'Cache Performance',
        'success',
        `Cache hit rate: ${stats.hitRate}%, ${stats.total.entries} total entries`,
        { stats, osmStats },
        Date.now() - startTime
      );

      // Test cache optimization
      await multiTierCacheService.optimize();
      
      addTestResult(
        'Cache Optimization',
        'success',
        'Cache optimization completed',
        undefined,
        Date.now() - startTime
      );

    } catch (error) {
      addTestResult(
        'Cache Performance',
        'error',
        `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error },
        Date.now() - startTime
      );
    }
  };

  // Handle node expansion in hierarchy view
  const handleNodeExpand = async (nodeId: string) => {
    if (expandedNodes.has(nodeId)) {
      // Collapse
      const newExpanded = new Set(expandedNodes);
      newExpanded.delete(nodeId);
      setExpandedNodes(newExpanded);
    } else {
      // Expand
      try {
        await adaptiveHierarchyService.expandNode(nodeId, {
          countryCode: selectedCountry,
          maxDepth: 8,
          prioritizeLevels: [2, 4, 6, 8],
          includeGeometry: false,
          spatialIndexing: false,
          cacheStrategy: 'hybrid'
        });

        const newExpanded = new Set(expandedNodes);
        newExpanded.add(nodeId);
        setExpandedNodes(newExpanded);

        addTestResult(
          'Node Expansion',
          'success',
          `Expanded node ${nodeId}`,
          { nodeId }
        );
      } catch (error) {
        addTestResult(
          'Node Expansion',
          'error',
          `Failed to expand node: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  };

  // Clear all caches
  const clearAllCaches = async () => {
    addTestResult('Cache Clear', 'running', 'Clearing all caches...');
    
    try {
      await multiTierCacheService.clear();
      osmAdminBoundaryService.clearCache();
      adaptiveHierarchyService.clearCache();
      geographyAwareExtractionService.clearCache();

      addTestResult('Cache Clear', 'success', 'All caches cleared successfully');
      setCacheStats(null);
    } catch (error) {
      addTestResult('Cache Clear', 'error', `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Update cache stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRunning) {
        const stats = multiTierCacheService.getStats();
        const osmStats = osmAdminBoundaryService.getCacheStats();
        setCacheStats({ multi: stats, osm: osmStats });
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
            <h2 className="text-xl font-bold text-gray-800">🌍 OSM Hierarchical System Demo</h2>
            <p className="text-sm text-gray-600">Testing real OSM data with proper administrative boundaries</p>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
              disabled={isRunning}
            >
              <option value="DK">🇩🇰 Denmark</option>
              <option value="DE">🇩🇪 Germany</option>
            </select>
            <button
              onClick={runFullTestSuite}
              disabled={isRunning}
              className={`px-4 py-2 rounded text-sm font-medium ${
                isRunning 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isRunning ? '🔄 Testing...' : '🚀 Run Full Test Suite'}
            </button>
            <button
              onClick={clearResults}
              disabled={isRunning}
              className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
            >
              🗑️ Clear
            </button>
            <button
              onClick={clearAllCaches}
              disabled={isRunning}
              className="px-4 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 disabled:opacity-50"
            >
              🧹 Clear Cache
            </button>
          </div>
        </div>

        {/* Cache Statistics */}
        {cacheStats && (
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div className="bg-blue-50 p-3 rounded">
              <div className="font-semibold text-blue-800">Multi-Tier Cache</div>
              <div className="text-blue-600">
                {cacheStats.multi.hitRate}% hit rate, {cacheStats.multi.total.entries} entries
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="font-semibold text-green-800">OSM Cache</div>
              <div className="text-green-600">
                {cacheStats.osm.cacheSize} cached queries
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded">
              <div className="font-semibold text-purple-800">Memory Usage</div>
              <div className="text-purple-600">
                {cacheStats.multi.memory.sizeMB}MB used
              </div>
            </div>
            <div className="bg-orange-50 p-3 rounded">
              <div className="font-semibold text-orange-800">Active Requests</div>
              <div className="text-orange-600">
                {cacheStats.osm.activeRequests} pending
              </div>
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
              Real-time testing of OSM boundary fetching, hierarchy building, and geography-aware extraction
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {testResults.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>Click "Run Full Test Suite" to start testing</p>
                <p className="text-sm mt-2">This will test Denmark and Germany with real OSM data</p>
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
            <h3 className="font-semibold mb-2">🌳 Hierarchy View</h3>
            <p className="text-sm text-gray-600">
              Interactive view of the adaptive hierarchy for {selectedCountry}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {hierarchyData ? (
              <HierarchyNodeView
                node={hierarchyData}
                expandedNodes={expandedNodes}
                onNodeExpand={handleNodeExpand}
                onNodeSelect={(boundary) => {
                  setSelectedBoundary(boundary);
                  onLocationSelect?.(boundary);
                }}
                selectedBoundary={selectedBoundary}
              />
            ) : boundaries.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-3">
                  Showing {boundaries.length} boundaries at admin level 4:
                </p>
                {boundaries.slice(0, 20).map((boundary) => (
                  <div
                    key={boundary.id}
                    className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                      selectedBoundary?.id === boundary.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                    onClick={() => {
                      setSelectedBoundary(boundary);
                      onLocationSelect?.(boundary);
                    }}
                  >
                    <div className="font-medium text-sm">{boundary.name}</div>
                    <div className="text-xs text-gray-500">
                      Level {boundary.adminLevel} • {boundary.countryCode}
                      {boundary.population && ` • ${boundary.population.toLocaleString()} population`}
                    </div>
                  </div>
                ))}
                {boundaries.length > 20 && (
                  <p className="text-xs text-gray-500 text-center mt-3">
                    ... and {boundaries.length - 20} more boundaries
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <p>No hierarchy or boundary data available</p>
                <p className="text-sm mt-2">Run tests to load data</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Hierarchy Node View Component
interface HierarchyNodeViewProps {
  node: HierarchyNode;
  expandedNodes: Set<string>;
  onNodeExpand: (nodeId: string) => void;
  onNodeSelect: (boundary: OSMAdminBoundary) => void;
  selectedBoundary: OSMAdminBoundary | null;
  level?: number;
}

const HierarchyNodeView: React.FC<HierarchyNodeViewProps> = ({
  node,
  expandedNodes,
  onNodeExpand,
  onNodeSelect,
  selectedBoundary,
  level = 0
}) => {
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedBoundary?.id === node.boundary.id;
  const hasChildren = node.children.length > 0 || node.boundary.adminLevel < 8;

  return (
    <div className={`ml-${level * 4}`}>
      <div
        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
          isSelected ? 'bg-blue-50 border border-blue-300' : ''
        }`}
        onClick={() => onNodeSelect(node.boundary)}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNodeExpand(node.id);
            }}
            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
          >
            {node.loadingState === 'loading' ? (
              <div className="animate-spin w-3 h-3 border border-gray-400 border-t-transparent rounded-full"></div>
            ) : isExpanded ? (
              '▼'
            ) : (
              '▶'
            )}
          </button>
        )}
        <div className="flex-1">
          <div className="font-medium text-sm">{node.boundary.name}</div>
          <div className="text-xs text-gray-500">
            Level {node.boundary.adminLevel} • Depth {node.depth}
            {node.boundary.population && ` • ${node.boundary.population.toLocaleString()}`}
          </div>
        </div>
        <div className="text-xs text-gray-400">
          {node.loadingState}
        </div>
      </div>
      
      {isExpanded && node.children.length > 0 && (
        <div className="ml-4 border-l border-gray-200 pl-2">
          {node.children.map((child) => (
            <HierarchyNodeView
              key={child.id}
              node={child}
              expandedNodes={expandedNodes}
              onNodeExpand={onNodeExpand}
              onNodeSelect={onNodeSelect}
              selectedBoundary={selectedBoundary}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default OSMHierarchyDemo;