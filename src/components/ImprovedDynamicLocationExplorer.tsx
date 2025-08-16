// Improved Dynamic Location Explorer with Graph-Based Architecture
// Eliminates overlapping tree branches and provides intelligent cache sharing

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DynamicLocationNode, dynamicLocationService } from '../services/dynamicLocationService';
import { getLocationRegistry, LocationRegistryService } from '../services/locationRegistry';
import { createSearchToExpandService, SearchToExpandService, SearchResult } from '../services/searchToExpandService';
import VirtualTreeRenderer, { TreeViewConfig, LocationFilter } from './VirtualTreeRenderer';

interface ImprovedDynamicLocationExplorerProps {
  onLocationSelect?: (location: DynamicLocationNode, path: string) => void;
  onLocationDownload?: (location: DynamicLocationNode) => void;
  className?: string;
  enableMultipleViews?: boolean;
  showPerformanceStats?: boolean;
}

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  selectedResult: SearchResult | null;
}

interface ViewTab {
  id: string;
  name: string;
  config: TreeViewConfig;
  isActive: boolean;
}

/**
 * Improved Dynamic Location Explorer with graph-based architecture
 * Features:
 * - Shared cache across all tree views
 * - Intelligent loading deduplication
 * - Search-to-expand functionality
 * - Multiple tree view configurations
 * - Real-time performance monitoring
 */
export const ImprovedDynamicLocationExplorer: React.FC<ImprovedDynamicLocationExplorerProps> = ({
  onLocationSelect,
  onLocationDownload,
  className = '',
  enableMultipleViews = true,
  showPerformanceStats = true
}) => {
  // Initialize services
  const [registry] = useState<LocationRegistryService>(() => {
    return getLocationRegistry(dynamicLocationService);
  });

  const [searchService] = useState<SearchToExpandService>(() => {
    return createSearchToExpandService(registry);
  });

  // Component state
  const [activeTabId, setActiveTabId] = useState('geographical');
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    results: [],
    isSearching: false,
    selectedResult: null
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Tree view configurations
  const viewTabs: ViewTab[] = useMemo(() => {
    const tabs: ViewTab[] = [
      {
        id: 'geographical',
        name: 'Geographic Hierarchy',
        config: {
          id: 'geographical',
          name: 'Geographic Hierarchy',
          rootLocationId: 'world',
          maxDepth: 6,
          sortStrategy: 'geographical',
          enableSearch: true,
          showCacheIndicators: showPerformanceStats
        },
        isActive: activeTabId === 'geographical'
      }
    ];

    if (enableMultipleViews) {
      tabs.push(
        {
          id: 'population',
          name: 'By Population',
          config: {
            id: 'population',
            name: 'Major Cities & Regions',
            rootLocationId: 'world',
            maxDepth: 4,
            filterCriteria: { minPopulation: 100000 },
            sortStrategy: 'population_desc',
            enableSearch: true,
            showCacheIndicators: showPerformanceStats
          },
          isActive: activeTabId === 'population'
        },
        {
          id: 'countries',
          name: 'Countries Only',
          config: {
            id: 'countries',
            name: 'World Countries',
            rootLocationId: 'world',
            maxDepth: 3,
            filterCriteria: { levels: ['continent', 'country'] },
            sortStrategy: 'alphabetical',
            enableSearch: true,
            showCacheIndicators: showPerformanceStats
          },
          isActive: activeTabId === 'countries'
        }
      );
    }

    return tabs;
  }, [activeTabId, enableMultipleViews, showPerformanceStats]);

  // Initialize the explorer
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('🚀 Initializing Improved Dynamic Location Explorer...');
        
        // Load world location to ensure root is available
        const worldLocation = await registry.getLocation('world');
        if (!worldLocation) {
          throw new Error('Failed to load world root location');
        }

        setIsInitialized(true);
        console.log('✅ Improved Dynamic Location Explorer initialized successfully');
      } catch (error) {
        console.error('❌ Failed to initialize explorer:', error);
        setInitError(error instanceof Error ? error.message : 'Initialization failed');
      }
    };

    initialize();
  }, [registry]);

  // Handle search input
  const handleSearchChange = useCallback(async (query: string) => {
    setSearchState(prev => ({ ...prev, query, isSearching: true }));

    if (query.trim().length < 2) {
      setSearchState(prev => ({ 
        ...prev, 
        results: [], 
        isSearching: false,
        selectedResult: null 
      }));
      return;
    }

    try {
      console.log(`🔍 Searching for: "${query}"`);
      const results = await searchService.searchAndExpand(query, activeTabId, {
        maxResults: 15,
        preferCached: true,
        sortBy: 'relevance'
      });

      setSearchState(prev => ({
        ...prev,
        results,
        isSearching: false
      }));

      console.log(`📍 Found ${results.length} search results with expansion analysis`);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchState(prev => ({
        ...prev,
        results: [],
        isSearching: false
      }));
    }
  }, [searchService, activeTabId]);

  // Handle search result selection and expansion
  const handleSearchResultSelect = useCallback(async (result: SearchResult) => {
    setSearchState(prev => ({ ...prev, selectedResult: result }));

    try {
      console.log(`🎯 Expanding to ${result.location.name}...`);
      
      // Execute expansion plan
      await searchService.expandToLocation(result.location.id, activeTabId, (step, current, total) => {
        console.log(`📂 Expansion step ${current}/${total}: ${step.locationName} ${step.isFromCache ? '(cached)' : '(loading)'}`);
      });

      // Select the location
      onLocationSelect?.(result.location, result.expansionPath.join('/'));
      
      console.log(`✅ Successfully expanded and selected ${result.location.name}`);
    } catch (error) {
      console.error('Failed to expand to location:', error);
    }
  }, [searchService, activeTabId, onLocationSelect]);

  // Handle tab change
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    // Clear search when switching views
    setSearchState({
      query: '',
      results: [],
      isSearching: false,
      selectedResult: null
    });
  }, []);

  // Get current active tab config
  const activeTab = viewTabs.find(tab => tab.id === activeTabId);
  const activeConfig = activeTab?.config;

  // Handle location selection from tree
  const handleTreeLocationSelect = useCallback((location: DynamicLocationNode, path: string) => {
    console.log(`🌳 Tree selection: ${location.name} via ${path}`);
    onLocationSelect?.(location, path);
  }, [onLocationSelect]);

  // Render loading state
  if (!isInitialized && !initError) {
    return (
      <div className={`improved-explorer loading ${className}`}>
        <div className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="text-gray-600">Initializing Dynamic Explorer...</span>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (initError) {
    return (
      <div className={`improved-explorer error ${className}`}>
        <div className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center space-y-4 text-center">
            <span className="text-red-500 text-xl">❌</span>
            <span className="text-red-600 font-medium">Initialization Failed</span>
            <span className="text-gray-600 text-sm">{initError}</span>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`improved-explorer ${className}`}>
      {/* Header with search */}
      <div className="explorer-header border-b bg-white p-4">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              📍 Dynamic Location Explorer
            </h2>
            {showPerformanceStats && (
              <PerformanceIndicator registry={registry} />
            )}
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchState.query}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search locations... (e.g., 'Copenhagen', 'Denmark', 'California')"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchState.isSearching && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              </div>
            )}
          </div>

          {/* Search results */}
          {searchState.results.length > 0 && (
            <SearchResultsList
              results={searchState.results}
              onResultSelect={handleSearchResultSelect}
              selectedResult={searchState.selectedResult}
            />
          )}
        </div>
      </div>

      {/* Tab navigation */}
      {enableMultipleViews && (
        <div className="tab-navigation border-b bg-gray-50">
          <div className="flex space-x-1 p-1">
            {viewTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  tab.isActive
                    ? 'bg-white text-blue-600 border border-gray-200 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tree view content */}
      <div className="tree-view-content flex-1 overflow-auto">
        {activeConfig && (
          <VirtualTreeRenderer
            config={activeConfig}
            registry={registry}
            onLocationSelect={handleTreeLocationSelect}
            onLocationDownload={onLocationDownload}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
};

// Search Results List Component
interface SearchResultsListProps {
  results: SearchResult[];
  onResultSelect: (result: SearchResult) => void;
  selectedResult: SearchResult | null;
}

const SearchResultsList: React.FC<SearchResultsListProps> = ({
  results,
  onResultSelect,
  selectedResult
}) => {
  return (
    <div className="search-results max-h-64 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
      {results.map((result, index) => (
        <SearchResultItem
          key={`${result.location.id}-${index}`}
          result={result}
          isSelected={selectedResult?.location.id === result.location.id}
          onSelect={() => onResultSelect(result)}
        />
      ))}
    </div>
  );
};

// Individual Search Result Item
interface SearchResultItemProps {
  result: SearchResult;
  isSelected: boolean;
  onSelect: () => void;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({
  result,
  isSelected,
  onSelect
}) => {
  const { location, expansionPath, estimatedLoadTime, cacheAvailability } = result;

  const getLocationIcon = (level: string): string => {
    const icons: { [key: string]: string } = {
      world: '🌍', continent: '🌎', country: '🏴', state: '🗺️',
      region: '📍', city: '🏙️', district: '🏘️', custom: '📌'
    };
    return icons[level] || '📍';
  };

  return (
    <div
      className={`search-result-item p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
        isSelected ? 'bg-blue-50 border-blue-200' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-lg">{getLocationIcon(location.level)}</span>
          <div>
            <div className="font-medium text-gray-900">{location.name}</div>
            <div className="text-sm text-gray-500">
              {location.level}
              {location.population && (
                <span> • {location.population.toLocaleString()} people</span>
              )}
            </div>
            <div className="text-xs text-gray-400">
              Path: {expansionPath.slice(-3).join(' → ')}
              {expansionPath.length > 3 && '...'}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {/* Cache indicator */}
          {cacheAvailability.pathCacheRatio > 0 && (
            <span 
              className="px-2 py-1 bg-green-100 text-green-700 rounded"
              title={`${Math.round(cacheAvailability.pathCacheRatio * 100)}% cached`}
            >
              💾 {Math.round(cacheAvailability.pathCacheRatio * 100)}%
            </span>
          )}

          {/* Load time estimate */}
          {estimatedLoadTime > 0 && (
            <span 
              className="px-2 py-1 bg-gray-100 text-gray-600 rounded"
              title="Estimated load time"
            >
              ⏱️ {estimatedLoadTime}ms
            </span>
          )}

          {/* Already loaded indicator */}
          {result.isAlreadyLoaded && (
            <span className="text-green-600" title="Already loaded">
              ✅
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// Performance Indicator Component
interface PerformanceIndicatorProps {
  registry: LocationRegistryService;
}

const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({ registry }) => {
  const [stats, setStats] = useState(registry.getCacheStats());

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(registry.getCacheStats());
    }, 2000);

    return () => clearInterval(interval);
  }, [registry]);

  return (
    <div className="performance-indicator flex items-center space-x-3 text-xs text-gray-600">
      <div className="flex items-center space-x-1">
        <span>📊</span>
        <span>Hit Rate: {stats.hitRate}%</span>
      </div>
      <div className="flex items-center space-x-1">
        <span>🔗</span>
        <span>Shared: {stats.crossBranchShares}</span>
      </div>
      <div className="flex items-center space-x-1">
        <span>💾</span>
        <span>{stats.memoryUsageMB}MB</span>
      </div>
      <div className="flex items-center space-x-1">
        <span>📍</span>
        <span>{stats.totalLocations} locations</span>
      </div>
    </div>
  );
};

export default ImprovedDynamicLocationExplorer;