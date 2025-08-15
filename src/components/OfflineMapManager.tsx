import { useState, useEffect } from 'react';
import { MapPack, mapPackManager } from '../config/mapPacks';
import { OfflineMapRegion, offlineTileCache, OFFLINE_REGIONS } from '../services/offlineTileCache';

interface OfflineMapManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLayersUpdated: () => void;
}

export function OfflineMapManager({ isOpen, onClose, onLayersUpdated }: OfflineMapManagerProps) {
  const [installedPacks, setInstalledPacks] = useState<MapPack[]>([]);
  const [availablePacks, setAvailablePacks] = useState<MapPack[]>([]);
  const [offlineRegions, setOfflineRegions] = useState<OfflineMapRegion[]>([]);
  const [downloadingRegions, setDownloadingRegions] = useState<Set<string>>(new Set());
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'layers' | 'offline'>('layers');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    // Load layer packs
    console.log('OfflineMapManager opening, loading data...');
    const installed = mapPackManager.getInstalledPacks();
    const available = mapPackManager.getAvailablePacks();
    console.log('Installed packs:', installed);
    console.log('Available packs:', available);
    setInstalledPacks(installed);
    setAvailablePacks(available);

    // Load offline regions
    try {
      await offlineTileCache.init();
      const regions = await offlineTileCache.getRegions();
      const size = await offlineTileCache.getCacheSize();
      
      // Merge with predefined regions
      const allRegions = OFFLINE_REGIONS.map(region => {
        const downloaded = regions.find(r => r.id === region.id);
        return downloaded || region;
      });
      
      setOfflineRegions(allRegions);
      setCacheSize(size);
      console.log('Offline regions:', allRegions);
      console.log('Cache size:', size);
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  };

  const handleInstallPack = (packId: string) => {
    console.log('Installing pack:', packId);
    const result = mapPackManager.installPack(packId);
    console.log('Install result:', result);
    if (result) {
      const installed = mapPackManager.getInstalledPacks();
      const available = mapPackManager.getAvailablePacks();
      console.log('After install - Installed:', installed);
      console.log('After install - Available:', available);
      setInstalledPacks(installed);
      setAvailablePacks(available);
      onLayersUpdated();
    } else {
      console.error('Failed to install pack:', packId);
    }
  };

  const handleUninstallPack = (packId: string) => {
    if (mapPackManager.uninstallPack(packId)) {
      setInstalledPacks(mapPackManager.getInstalledPacks());
      setAvailablePacks(mapPackManager.getAvailablePacks());
      onLayersUpdated();
    }
  };

  const handleDownloadRegion = async (regionId: string) => {
    const region = offlineRegions.find(r => r.id === regionId);
    if (!region || downloadingRegions.has(regionId)) return;

    setDownloadingRegions(prev => new Set(prev).add(regionId));
    
    try {
      // Use the standard layer for downloading
      const standardLayer = installedPacks
        .find(pack => pack.id === 'core')
        ?.layers.find(layer => layer.id === 'standard');
      
      if (!standardLayer) {
        throw new Error('Standard layer not found');
      }

      await offlineTileCache.downloadRegion(region, standardLayer);
      
      // Refresh data
      await loadData();
      
    } catch (error) {
      console.error('Failed to download region:', error);
      alert(`Failed to download ${region.name}: ${error}`);
    } finally {
      setDownloadingRegions(prev => {
        const newSet = new Set(prev);
        newSet.delete(regionId);
        return newSet;
      });
    }
  };

  const handleDeleteRegion = async (regionId: string) => {
    if (!confirm('Delete downloaded region? This will free up storage space.')) return;
    
    try {
      // This would need implementation in offlineTileCache
      console.log('Delete region not implemented yet:', regionId);
    } catch (error) {
      console.error('Failed to delete region:', error);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${Math.round(mb * 1024)} KB` : `${Math.round(mb)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 10000 }}>
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden" style={{ zIndex: 10001 }}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Map Manager</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('layers')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'layers'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Layer Packs
          </button>
          <button
            onClick={() => setActiveTab('offline')}
            className={`px-6 py-3 font-medium text-sm ${
              activeTab === 'offline'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Offline Maps
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {activeTab === 'layers' && (
            <>
              {/* Layer Packs Tab */}
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
                              onClick={() => handleUninstallPack(pack.id)}
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
                            {pack.website && (
                              <a
                                href={pack.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                              >
                                Learn more
                              </a>
                            )}
                          </div>
                          <div className="ml-4">
                            <button
                              onClick={() => handleInstallPack(pack.id)}
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
            </>
          )}

          {activeTab === 'offline' && (
            <>
              {/* Offline Maps Tab */}
              <div className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-blue-900">True Offline Maps</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Download map regions to use completely offline. Cache size: <strong>{formatSize(cacheSize)}</strong>
                  </p>
                </div>
              </div>

              {/* Offline Regions */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Regions</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {offlineRegions.map((region) => (
                    <div 
                      key={region.id} 
                      className={`border rounded-lg p-4 ${
                        region.isDownloaded 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{region.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            Zoom levels {region.zoom.min}-{region.zoom.max}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            ~{region.estimatedTiles.toLocaleString()} tiles, ~{region.estimatedSizeMB} MB
                          </p>
                          {region.isDownloaded && (
                            <p className="text-xs text-green-600 mt-1 font-medium">
                              ✓ Downloaded - Available offline
                            </p>
                          )}
                        </div>
                        <div className="ml-4">
                          {!region.isDownloaded && !downloadingRegions.has(region.id) && (
                            <button
                              onClick={() => handleDownloadRegion(region.id)}
                              className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 transition-colors"
                            >
                              Download
                            </button>
                          )}
                          {downloadingRegions.has(region.id) && (
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm rounded">
                              Downloading...
                            </span>
                          )}
                          {region.isDownloaded && (
                            <button
                              onClick={() => handleDeleteRegion(region.id)}
                              className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded hover:bg-red-200 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
