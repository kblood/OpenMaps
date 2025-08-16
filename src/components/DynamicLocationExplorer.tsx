import React, { useState, useEffect, useCallback } from 'react';
import { dynamicLocationService, DynamicLocationNode } from '../services/dynamicLocationService';

interface LocationTreeNodeProps {
  location: DynamicLocationNode;
  level: number;
  onLocationSelect: (location: DynamicLocationNode) => void;
  onDownload: (location: DynamicLocationNode) => void;
  isExpanded: boolean;
  onToggleExpand: (locationId: string) => void;
}

const LocationTreeNode: React.FC<LocationTreeNodeProps> = ({
  location,
  level,
  onLocationSelect,
  onDownload,
  isExpanded,
  onToggleExpand
}) => {
  const [children, setChildren] = useState<DynamicLocationNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChildren = useCallback(async () => {
    if (!location.hasChildren || children.length > 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`🔄 Loading children for ${location.name} (${location.level})`);
      const childNodes = await dynamicLocationService.getChildren(location.id);
      console.log(`✅ Loaded ${childNodes.length} children for ${location.name}`);
      setChildren(childNodes);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load children';
      console.error(`❌ Failed to load children for ${location.name}:`, err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [location.id, location.hasChildren, children.length]);

  useEffect(() => {
    if (isExpanded && location.hasChildren && !loading && children.length === 0) {
      loadChildren();
    }
  }, [isExpanded, location.hasChildren, loading, children.length, loadChildren]);

  const handleToggleExpand = () => {
    onToggleExpand(location.id);
  };

  const getLocationIcon = (level: string): string => {
    const icons: { [key: string]: string } = {
      world: '🌍',
      continent: '🌎',
      country: '🏴',
      state: '🗺️',
      region: '📍',
      city: '🏙️',
      district: '🏘️',
      custom: '📌'
    };
    return icons[level] || '📍';
  };

  const getDownloadStatus = (location: DynamicLocationNode): string => {
    if (location.isDownloaded) return '✅';
    if (location.downloadProgress && location.downloadProgress > 0) return '⬇️';
    return '';
  };

  const indentStyle = {
    paddingLeft: `${level * 20}px`
  };

  return (
    <div className="location-tree-node">
      <div 
        className={`flex items-center justify-between p-2 hover:bg-gray-100 cursor-pointer ${
          level === 0 ? 'border-b' : ''
        }`}
        style={indentStyle}
        onClick={() => onLocationSelect(location)}
      >
        <div className="flex items-center space-x-2 flex-1">
          {location.hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpand();
              }}
              className="p-1 hover:bg-gray-200 rounded text-xs"
            >
              {loading ? '⏳' : isExpanded ? '▼' : '▶'}
            </button>
          )}
          
          {!location.hasChildren && <span className="w-6"></span>}
          
          <span className="text-lg">{getLocationIcon(location.level)}</span>
          
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-sm">{location.name}</span>
              <span className="text-xs text-gray-500">({location.level})</span>
              {location.isCapital && <span className="text-xs bg-yellow-200 px-1 rounded">⭐ Capital</span>}
              {location.population && (
                <span className="text-xs text-gray-500">
                  👥 {location.population.toLocaleString()}
                </span>
              )}
              <span className="text-sm">{getDownloadStatus(location)}</span>
            </div>
            
            {location.source !== 'preloaded' && (
              <div className="text-xs text-gray-400">
                From {location.source} • Updated {new Date(location.lastUpdated).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(location);
            }}
            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
            title={`Download ${location.name}`}
          >
            ⬇️
          </button>
          
          <div className="text-xs text-gray-500">
            ~{location.estimatedSizeMB}MB
          </div>
        </div>
      </div>

      {error && (
        <div className="text-red-500 text-xs p-2" style={indentStyle}>
          ❌ {error}
          <button 
            onClick={loadChildren}
            className="ml-2 text-blue-500 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {isExpanded && children.length > 0 && (
        <div className="children">
          {children
            .sort((a, b) => {
              // Sort by priority (capitals first), then population, then name
              if (a.isCapital && !b.isCapital) return -1;
              if (!a.isCapital && b.isCapital) return 1;
              if (a.population && b.population) return b.population - a.population;
              return a.name.localeCompare(b.name);
            })
            .map((child) => (
              <LocationTreeNode
                key={child.id}
                location={child}
                level={level + 1}
                onLocationSelect={onLocationSelect}
                onDownload={onDownload}
                isExpanded={false} // Start collapsed
                onToggleExpand={onToggleExpand}
              />
            ))
          }
        </div>
      )}

      {isExpanded && loading && (
        <div className="text-gray-500 text-sm p-2" style={indentStyle}>
          🔄 Loading {location.level === 'continent' ? 'countries' : 
                       location.level === 'country' ? 'states/regions' :
                       location.level === 'state' ? 'cities' :
                       location.level === 'city' ? 'districts' : 'locations'}...
        </div>
      )}
    </div>
  );
};

interface DynamicLocationExplorerProps {
  onLocationSelect: (location: DynamicLocationNode) => void;
  onDownload: (location: DynamicLocationNode) => void;
  className?: string;
}

const DynamicLocationExplorer: React.FC<DynamicLocationExplorerProps> = ({
  onLocationSelect,
  onDownload,
  className = ''
}) => {
  const [worldLocation, setWorldLocation] = useState<DynamicLocationNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['world']));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DynamicLocationNode[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    // Load world root node
    const loadWorld = async () => {
      try {
        const world = await dynamicLocationService.getLocation('world');
        if (world) {
          setWorldLocation(world);
        }
      } catch (error) {
        console.error('Failed to load world location:', error);
      }
    };

    loadWorld();
  }, []);

  const handleToggleExpand = (locationId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(locationId)) {
      newExpanded.delete(locationId);
    } else {
      newExpanded.add(locationId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await dynamicLocationService.searchLocations(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearch]);

  const handleLocationSelectAndNavigate = (location: DynamicLocationNode) => {
    onLocationSelect(location);
    
    // Auto-expand the location's path in the hierarchy
    if (location.parentId) {
      const newExpanded = new Set(expandedNodes);
      newExpanded.add(location.parentId);
      setExpandedNodes(newExpanded);
    }
  };

  return (
    <div className={`dynamic-location-explorer ${className}`}>
      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search countries, cities, places..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchLoading && (
            <div className="absolute right-3 top-2">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="p-2 bg-gray-50 border-b text-xs font-semibold text-gray-600">
              🔍 Search Results ({searchResults.length})
            </div>
            {searchResults.map((result) => (
              <div
                key={result.id}
                className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                onClick={() => {
                  handleLocationSelectAndNavigate(result);
                  setSearchQuery(''); // Clear search
                  setSearchResults([]);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span>{getLocationIcon(result.level)}</span>
                    <span className="font-medium text-sm">{result.name}</span>
                    <span className="text-xs text-gray-500">({result.level})</span>
                    {result.isCapital && <span className="text-xs">⭐</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {result.metadata.countryCode && `${result.metadata.countryCode} • `}
                    ~{result.estimatedSizeMB}MB
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hierarchy Tree */}
      <div className="border border-gray-200 rounded-lg bg-white">
        <div className="p-2 bg-gray-50 border-b text-sm font-semibold text-gray-700">
          🗺️ World Hierarchy (Dynamic)
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {worldLocation ? (
            <LocationTreeNode
              location={worldLocation}
              level={0}
              onLocationSelect={handleLocationSelectAndNavigate}
              onDownload={onDownload}
              isExpanded={expandedNodes.has(worldLocation.id)}
              onToggleExpand={handleToggleExpand}
            />
          ) : (
            <div className="p-4 text-center text-gray-500">
              Loading world hierarchy...
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs">
        <div className="font-semibold mb-2">Legend:</div>
        <div className="grid grid-cols-2 gap-1">
          <div>🌍 World</div>
          <div>🌎 Continent</div>
          <div>🏴 Country</div>
          <div>🗺️ State/Region</div>
          <div>🏙️ City</div>
          <div>🏘️ District</div>
          <div>⭐ Capital</div>
          <div>✅ Downloaded</div>
        </div>
        <div className="mt-2 text-gray-600">
          Data loads dynamically from OpenStreetMap APIs
        </div>
      </div>
    </div>
  );
};

// Utility function for icons (shared)
function getLocationIcon(level: string): string {
  const icons: { [key: string]: string } = {
    world: '🌍',
    continent: '🌎',
    country: '🏴',
    state: '🗺️',
    region: '📍',
    city: '🏙️',
    district: '🏘️',
    custom: '📌'
  };
  return icons[level] || '📍';
}

export default DynamicLocationExplorer;