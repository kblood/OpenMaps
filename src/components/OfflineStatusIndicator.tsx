import React, { useState, useEffect } from 'react';
import { offlineTileCache } from '../services/offlineTileCache';
import { globalMapPackSystem } from '../services/globalMapPackSystem';

interface OfflineStatusIndicatorProps {
  className?: string;
}

interface OfflineStats {
  totalTiles: number;
  totalSizeMB: number;
  tilesByZoom: { [zoom: number]: number };
}

const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({ className = '' }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showDetails, setShowDetails] = useState(false);
  const [offlineStats, setOfflineStats] = useState<OfflineStats>({
    totalTiles: 0,
    totalSizeMB: 0,
    tilesByZoom: {}
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load offline stats (we'll need to get this from a tile layer instance)
    loadOfflineStats();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadOfflineStats = async () => {
    try {
      // Initialize systems if needed
      await offlineTileCache.init();
      await globalMapPackSystem.initialize();
      
      // Get cache size and actual tile count from the unified system
      const cacheSize = await offlineTileCache.getCacheSize();
      const cacheSizeMB = Math.round(cacheSize / 1024 / 1024 * 100) / 100;
      
      // Get actual tile count from database
      const tileCount = await getTileCount();
      
      // Get tiles by zoom level
      const tilesByZoom = await getTilesByZoom();
      
      setOfflineStats({
        totalTiles: tileCount,
        totalSizeMB: cacheSizeMB,
        tilesByZoom
      });
      
      console.log('📊 Offline stats updated:', { tiles: tileCount, sizeMB: cacheSizeMB, byZoom: tilesByZoom });
    } catch (error) {
      console.error('Failed to load offline stats:', error);
      setOfflineStats({
        totalTiles: 0,
        totalSizeMB: 0,
        tilesByZoom: {}
      });
    }
  };

  const getTileCount = async (): Promise<number> => {
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('openmaps_global', 3);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const transaction = db.transaction(['tiles'], 'readonly');
      const store = transaction.objectStore('tiles');
      const countRequest = store.count();
      
      return new Promise((resolve) => {
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => resolve(0);
      });
    } catch (error) {
      console.error('Failed to get tile count:', error);
      return 0;
    }
  };

  const getTilesByZoom = async (): Promise<{ [zoom: number]: number }> => {
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('openmaps_global', 3);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const transaction = db.transaction(['tiles'], 'readonly');
      const store = transaction.objectStore('tiles');
      const getAllRequest = store.getAll();
      
      return new Promise((resolve) => {
        getAllRequest.onsuccess = () => {
          const tiles = getAllRequest.result;
          const zoomCounts: { [zoom: number]: number } = {};
          
          tiles.forEach((tile: any) => {
            // Extract zoom from tile key (format: layerId:x:y:z)
            if (tile.id && typeof tile.id === 'string') {
              const parts = tile.id.split(':');
              if (parts.length >= 4) {
                const zoom = parseInt(parts[3]);
                if (!isNaN(zoom)) {
                  zoomCounts[zoom] = (zoomCounts[zoom] || 0) + 1;
                }
              }
            }
          });
          
          resolve(zoomCounts);
        };
        getAllRequest.onerror = () => resolve({});
      });
    } catch (error) {
      console.error('Failed to get tiles by zoom:', error);
      return {};
    }
  };

  const getStatusColor = () => {
    if (isOnline) {
      return offlineStats.totalTiles > 0 ? 'bg-green-500' : 'bg-blue-500';
    } else {
      return offlineStats.totalTiles > 0 ? 'bg-yellow-500' : 'bg-red-500';
    }
  };

  const getStatusText = () => {
    if (isOnline) {
      return offlineStats.totalTiles > 0 ? 'Online + Offline Ready' : 'Online Only';
    } else {
      return offlineStats.totalTiles > 0 ? 'Offline Mode' : 'No Offline Data';
    }
  };

  const getStatusIcon = () => {
    if (isOnline) {
      return offlineStats.totalTiles > 0 ? '📶📦' : '📶';
    } else {
      return offlineStats.totalTiles > 0 ? '📱📦' : '📱❌';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`px-3 py-2 text-white rounded-lg text-sm font-medium transition-colors ${getStatusColor()}`}
        title="Click for offline details"
      >
        <span className="mr-2">{getStatusIcon()}</span>
        {getStatusText()}
      </button>

      {showDetails && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 min-w-64">
          <div className="text-sm">
            <h4 className="font-semibold mb-2">📦 Offline Map Status</h4>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Connection:</span>
                <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
                  {isOnline ? '📶 Online' : '📱 Offline'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>Downloaded Tiles:</span>
                <span className="font-medium">{offlineStats.totalTiles.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between">
                <span>Storage Used:</span>
                <span className="font-medium">{offlineStats.totalSizeMB}MB</span>
              </div>
              
              {Object.keys(offlineStats.tilesByZoom).length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-600 mb-1">Tiles by Zoom Level:</div>
                  <div className="text-xs space-y-1">
                    {Object.entries(offlineStats.tilesByZoom)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([zoom, count]) => (
                        <div key={zoom} className="flex justify-between">
                          <span>Zoom {zoom}:</span>
                          <span>{count.toLocaleString()}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
              
              <div className="mt-3 pt-2 border-t border-gray-200 text-xs text-gray-600">
                {isOnline && offlineStats.totalTiles > 0 && (
                  <p>✅ Maps will work offline with downloaded tiles</p>
                )}
                {isOnline && offlineStats.totalTiles === 0 && (
                  <p>ℹ️ Download map packs to enable offline mode</p>
                )}
                {!isOnline && offlineStats.totalTiles > 0 && (
                  <p>📱 Using offline tiles only</p>
                )}
                {!isOnline && offlineStats.totalTiles === 0 && (
                  <p>❌ No offline data available</p>
                )}
              </div>
            </div>
          </div>
          
          <button
            onClick={() => {
              loadOfflineStats();
              setShowDetails(false);
            }}
            className="mt-3 px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 w-full"
          >
            🔄 Refresh Stats
          </button>
        </div>
      )}
    </div>
  );
};

export default OfflineStatusIndicator;