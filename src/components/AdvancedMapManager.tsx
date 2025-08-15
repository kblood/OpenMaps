import { useState, useEffect } from 'react';
import { MapPack, mapPackManager } from '../config/mapPacks';
import { 
  HierarchicalMapPack, 
  advancedOfflineMapSystem, 
  HIERARCHICAL_PACKS
} from '../services/advancedOfflineMapSystem';

interface AdvancedMapManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLayersUpdated: () => void;
}

export function AdvancedMapManager({ isOpen, onClose, onLayersUpdated }: AdvancedMapManagerProps) {
  const [installedPacks, setInstalledPacks] = useState<MapPack[]>([]);
  const [availablePacks, setAvailablePacks] = useState<MapPack[]>([]);
  const [hierarchicalPacks, setHierarchicalPacks] = useState<HierarchicalMapPack[]>([]);
  const [downloadingPacks, setDownloadingPacks] = useState<Map<string, number>>(new Map());
  const [cacheStats, setCacheStats] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'layers' | 'hierarchical' | 'custom' | 'visited'>('hierarchical');
  
  // Custom pack creation
  const [customPackForm, setCustomPackForm] = useState({
    name: '',
    description: '',
    bounds: { north: 0, south: 0, east: 0, west: 0 },
    zoom: { min: 10, max: 14 },
    tags: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    console.log('AdvancedMapManager loading data...');
    
    // Load layer packs
    const installed = mapPackManager.getInstalledPacks();
    const available = mapPackManager.getAvailablePacks();
    setInstalledPacks(installed);
    setAvailablePacks(available);

    // Load hierarchical packs
    try {
      await advancedOfflineMapSystem.init();
      const storedPacks = await advancedOfflineMapSystem.getAllPacks();
      
      // Merge with predefined packs
      const allPacks = [...HIERARCHICAL_PACKS];
      storedPacks.forEach(stored => {
        const existing = allPacks.findIndex(p => p.id === stored.id);
        if (existing >= 0) {
          allPacks[existing] = stored;
        } else {
          allPacks.push(stored);
        }
      });
      
      setHierarchicalPacks(allPacks);
      
      const stats = await advancedOfflineMapSystem.getCacheStats();
      setCacheStats(stats);
      
      console.log('Hierarchical packs:', allPacks);
      console.log('Cache stats:', stats);
    } catch (error) {
      console.error('Failed to load advanced offline data:', error);
    }
  };

  const handleDownloadHierarchicalPack = async (packId: string) => {
    const pack = hierarchicalPacks.find(p => p.id === packId);
    if (!pack || downloadingPacks.has(packId)) return;

    console.log(`Starting download: ${pack.name}`);
    
    try {
      await advancedOfflineMapSystem.downloadPack(packId, pack, (progress) => {
        setDownloadingPacks(prev => new Map(prev).set(packId, progress));
      });
      
      // Refresh data
      await loadData();
      
    } catch (error) {
      console.error('Failed to download pack:', error);
      alert(`Failed to download ${pack.name}: ${error}`);
    } finally {
      setDownloadingPacks(prev => {
        const newMap = new Map(prev);
        newMap.delete(packId);
        return newMap;
      });
    }
  };

  const handleCreateCustomPack = async () => {
    if (!customPackForm.name || !customPackForm.bounds) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const pack = await advancedOfflineMapSystem.createCustomPack(
        customPackForm.name,
        customPackForm.bounds,
        customPackForm.zoom,
        {
          description: customPackForm.description,
          tags: customPackForm.tags.split(',').map(t => t.trim()).filter(t => t),
          priority: 3
        }
      );

      console.log('Created custom pack:', pack);
      await loadData();
      
      // Reset form
      setCustomPackForm({
        name: '',
        description: '',
        bounds: { north: 0, south: 0, east: 0, west: 0 },
        zoom: { min: 10, max: 14 },
        tags: ''
      });
      
    } catch (error) {
      console.error('Failed to create custom pack:', error);
      alert(`Failed to create pack: ${error}`);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${Math.round(mb * 1024)} KB` : `${Math.round(mb)} MB`;
  };

  const getPacksByLevel = (level: string) => {
    return hierarchicalPacks.filter(pack => pack.level === level);
  };

  const getChildPacks = (parentId: string) => {
    return hierarchicalPacks.filter(pack => pack.parentId === parentId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 10000 }}>
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden" style={{ zIndex: 10001 }}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Advanced Map Manager</h2>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Cache: {formatSize(cacheStats.totalSize)} • {cacheStats.tileCount} tiles • {cacheStats.duplicatesSaved} duplicates saved
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('hierarchical')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'hierarchical'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Hierarchical Packs
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'custom'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Create Custom
          </button>
          <button
            onClick={() => setActiveTab('visited')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'visited'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Visited Areas
          </button>
          <button
            onClick={() => setActiveTab('layers')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'layers'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Layer Styles
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-180px)]">
          {activeTab === 'hierarchical' && (
            <div>
              <div className="mb-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-green-900">🚀 Hierarchical Offline Maps</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Smart tile deduplication • 10x faster downloads • Auto-cache visited areas • Custom pack creation
                  </p>
                </div>
              </div>

              {/* Countries */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🏴 Countries</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {getPacksByLevel('country').map((pack) => (
                    <PackCard 
                      key={pack.id}
                      pack={pack}
                      downloadProgress={downloadingPacks.get(pack.id)}
                      onDownload={() => handleDownloadHierarchicalPack(pack.id)}
                      childPacks={getChildPacks(pack.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Regions */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🏞️ Regions</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {getPacksByLevel('region').map((pack) => (
                    <PackCard 
                      key={pack.id}
                      pack={pack}
                      downloadProgress={downloadingPacks.get(pack.id)}
                      onDownload={() => handleDownloadHierarchicalPack(pack.id)}
                      childPacks={getChildPacks(pack.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Cities */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">🏙️ Cities</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {getPacksByLevel('city').map((pack) => (
                    <PackCard 
                      key={pack.id}
                      pack={pack}
                      downloadProgress={downloadingPacks.get(pack.id)}
                      onDownload={() => handleDownloadHierarchicalPack(pack.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Custom Packs */}
              {getPacksByLevel('custom').length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">⚡ Custom Packs</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {getPacksByLevel('custom').map((pack) => (
                      <PackCard 
                        key={pack.id}
                        pack={pack}
                        downloadProgress={downloadingPacks.get(pack.id)}
                        onDownload={() => handleDownloadHierarchicalPack(pack.id)}
                        isCustom={true}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'custom' && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Custom Map Pack</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-700">
                    Define your own map region for download. Use decimal coordinates (e.g., 51.5074 for London).
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pack Name *</label>
                  <input
                    type="text"
                    value={customPackForm.name}
                    onChange={(e) => setCustomPackForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="My Custom Pack"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={customPackForm.description}
                    onChange={(e) => setCustomPackForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Custom map pack for..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">North Bound *</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={customPackForm.bounds.north || ''}
                    onChange={(e) => setCustomPackForm(prev => ({ 
                      ...prev, 
                      bounds: { ...prev.bounds, north: parseFloat(e.target.value) || 0 } 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="51.5074"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">South Bound *</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={customPackForm.bounds.south || ''}
                    onChange={(e) => setCustomPackForm(prev => ({ 
                      ...prev, 
                      bounds: { ...prev.bounds, south: parseFloat(e.target.value) || 0 } 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="51.4974"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">East Bound *</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={customPackForm.bounds.east || ''}
                    onChange={(e) => setCustomPackForm(prev => ({ 
                      ...prev, 
                      bounds: { ...prev.bounds, east: parseFloat(e.target.value) || 0 } 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="-0.0978"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">West Bound *</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={customPackForm.bounds.west || ''}
                    onChange={(e) => setCustomPackForm(prev => ({ 
                      ...prev, 
                      bounds: { ...prev.bounds, west: parseFloat(e.target.value) || 0 } 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="-0.1178"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Zoom</label>
                  <input
                    type="number"
                    min="1"
                    max="18"
                    value={customPackForm.zoom.min}
                    onChange={(e) => setCustomPackForm(prev => ({ 
                      ...prev, 
                      zoom: { ...prev.zoom, min: parseInt(e.target.value) || 10 } 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Zoom</label>
                  <input
                    type="number"
                    min="1"
                    max="18"
                    value={customPackForm.zoom.max}
                    onChange={(e) => setCustomPackForm(prev => ({ 
                      ...prev, 
                      zoom: { ...prev.zoom, max: parseInt(e.target.value) || 14 } 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={customPackForm.tags}
                    onChange={(e) => setCustomPackForm(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="custom, city, tourist"
                  />
                </div>

                <div className="md:col-span-2">
                  <button
                    onClick={handleCreateCustomPack}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Create Custom Pack
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'visited' && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Visited Areas Auto-Cache</h3>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-purple-700">
                    Areas you visit frequently are automatically cached for offline use. Visit an area 3+ times to trigger auto-caching.
                  </p>
                </div>
              </div>
              
              <div className="text-center py-8 text-gray-500">
                <p>Visit areas in the map to see auto-cached regions here.</p>
                <p className="text-sm mt-2">Feature tracks your navigation patterns and caches frequently visited locations.</p>
              </div>
            </div>
          )}

          {activeTab === 'layers' && (
            <div>
              {/* Original layer pack functionality */}
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  Layer packs provide different map styles and data sources. These require internet connection.
                </p>
              </div>

              {/* Installed Packs */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Installed Layer Packs</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {installedPacks.map((pack) => (
                    <div key={pack.id} className="border rounded-lg p-4 bg-green-50 border-green-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{pack.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{pack.description}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            v{pack.version} by {pack.author}
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            {pack.layers.length} layer{pack.layers.length !== 1 ? 's' : ''} available
                          </p>
                        </div>
                        <div className="ml-4">
                          {pack.id !== 'core' && (
                            <button
                              onClick={() => {
                                if (mapPackManager.uninstallPack(pack.id)) {
                                  loadData();
                                  onLayersUpdated();
                                }
                              }}
                              className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 transition-colors"
                            >
                              Uninstall
                            </button>
                          )}
                          {pack.id === 'core' && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded">
                              Core
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Available Packs */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Layer Packs</h3>
                {availablePacks.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    All available layer packs are already installed!
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {availablePacks.map((pack) => (
                      <div key={pack.id} className="border rounded-lg p-4 bg-gray-50 border-gray-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{pack.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">{pack.description}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              v{pack.version} by {pack.author}
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                              {pack.layers.length} layer{pack.layers.length !== 1 ? 's' : ''} included
                            </p>
                          </div>
                          <div className="ml-4">
                            <button
                              onClick={() => {
                                if (mapPackManager.installPack(pack.id)) {
                                  loadData();
                                  onLayersUpdated();
                                }
                              }}
                              className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition-colors"
                            >
                              Install
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// PackCard component for hierarchical packs
function PackCard({ 
  pack, 
  downloadProgress, 
  onDownload, 
  childPacks = [], 
  isCustom = false 
}: { 
  pack: HierarchicalMapPack; 
  downloadProgress?: number; 
  onDownload: () => void; 
  childPacks?: HierarchicalMapPack[];
  isCustom?: boolean;
}) {
  const isDownloading = downloadProgress !== undefined;
  const priorityColors = {
    1: 'gray',
    2: 'blue',
    3: 'green',
    4: 'yellow',
    5: 'red'
  };
  
  const priorityColor = priorityColors[pack.priority as keyof typeof priorityColors] || 'gray';

  return (
    <div className={`border rounded-lg p-4 ${
      pack.isDownloaded 
        ? 'bg-green-50 border-green-200' 
        : isDownloading 
        ? 'bg-yellow-50 border-yellow-200'
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h4 className="font-semibold text-gray-900">{pack.name}</h4>
            <span className={`px-2 py-1 text-xs rounded bg-${priorityColor}-100 text-${priorityColor}-700`}>
              P{pack.priority}
            </span>
            {isCustom && (
              <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">
                Custom
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{pack.description}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {pack.tags.map(tag => (
              <span key={tag} className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded">
                {tag}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Zoom {pack.zoom.min}-{pack.zoom.max} • ~{pack.estimatedTiles.toLocaleString()} tiles • ~{pack.estimatedSizeMB} MB
          </p>
          {childPacks.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">
              Includes: {childPacks.map(c => c.name).join(', ')}
            </p>
          )}
          {pack.isDownloaded && (
            <p className="text-xs text-green-600 mt-1 font-medium">
              ✓ Downloaded - Available offline
            </p>
          )}
          {isDownloading && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Downloading...</span>
                <span>{downloadProgress?.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${downloadProgress || 0}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="ml-4">
          {!pack.isDownloaded && !isDownloading && (
            <button
              onClick={onDownload}
              className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition-colors"
            >
              Download
            </button>
          )}
          {isDownloading && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded">
              Downloading
            </span>
          )}
          {pack.isDownloaded && (
            <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded">
              Downloaded
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
