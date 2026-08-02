import { useState, useEffect } from 'react';
import { mapPackManager } from '../config/mapPacks';
import { offlineTileCache } from '../services/offlineTileCache';
import { globalMapPackSystem } from '../services/globalMapPackSystem';

export function MapPackDebugger() {
  const [isOpen, setIsOpen] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);
  const [dbStatus, setDbStatus] = useState('Unknown');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const updateStats = async () => {
    try {
      // Initialize if needed
      await offlineTileCache.init();
      await globalMapPackSystem.initialize();
      
      const size = await offlineTileCache.getCacheSize();
      setCacheSize(size);
      
      // Get actual tile count from database
      const tiles = await getTileCount();
      
      setDbStatus('Connected');
      
      console.log('✅ Database systems initialized successfully', { size, tiles });
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      setDbStatus('Failed');
    }
  };

  const getTileCount = async (): Promise<number> => {
    try {
      // Access the database directly to count tiles
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

  const testOfflineTile = async () => {
    try {
      // Test storing and retrieving a simple tile
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      await offlineTileCache.init();
      await offlineTileCache.cacheTile(1, 1, 1, 'test', testBlob);
      
      const retrieved = await offlineTileCache.getCachedTile(1, 1, 1, 'test');
      if (retrieved) {
        console.log('✅ Offline tile test successful');
        alert('✅ Offline tile system is working!');
      } else {
        console.log('❌ Offline tile test failed - could not retrieve');
        alert('❌ Offline tile test failed - could not retrieve');
      }
    } catch (error) {
      console.error('❌ Offline tile test failed:', error);
      alert(`❌ Offline tile test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testDownloadTiles = async () => {
    try {
      await offlineTileCache.init();
      
      // Download a few test tiles for New York area
      const testTiles = [
        { x: 1205, y: 1539, z: 12 }, // NYC area tile
        { x: 1206, y: 1539, z: 12 },
        { x: 1205, y: 1540, z: 12 },
        { x: 1206, y: 1540, z: 12 }
      ];
      
      console.log('🔄 Starting test tile download...');
      
      for (const tile of testTiles) {
        try {
          const url = `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`;
          const response = await fetch(url);
          
          if (response.ok) {
            const blob = await response.blob();
            await offlineTileCache.cacheTile(tile.x, tile.y, tile.z, 'openstreetmap', blob);
            console.log(`✅ Downloaded tile: ${tile.z}/${tile.x}/${tile.y}`);
          } else {
            console.error(`❌ Failed to download tile: ${tile.z}/${tile.x}/${tile.y} - HTTP ${response.status}`);
          }
        } catch (error) {
          console.error(`❌ Error downloading tile: ${tile.z}/${tile.x}/${tile.y}`, error);
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Update stats after download
      await updateStats();
      alert(`✅ Test download completed! Downloaded ${testTiles.length} tiles for NYC area.`);
      
    } catch (error) {
      console.error('❌ Test download failed:', error);
      alert(`❌ Test download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testMapPacks = () => {
    console.log('=== MAP PACK DEBUG ===');
    
    // Test getting data
    const installed = mapPackManager.getInstalledPacks();
    const available = mapPackManager.getAvailablePacks();
    const allLayers = mapPackManager.getAllLayers();
    
    console.log('Installed packs:', installed);
    console.log('Available packs:', available);
    console.log('All layers:', allLayers);
    
    // Test localStorage
    try {
      const storedPacks = localStorage.getItem('openmaps_installed_packs');
      console.log('localStorage data:', storedPacks);
    } catch (error) {
      console.error('localStorage error:', error);
    }
    
    alert('Map pack test completed - check console for details');
  };

  const clearCache = async () => {
    if (confirm('Clear all offline map data? This cannot be undone.')) {
      try {
        await offlineTileCache.clearCache();
        updateStats();
        alert('✅ Cache cleared successfully');
      } catch (error) {
        console.error('❌ Failed to clear cache:', error);
        alert(`❌ Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-20 right-4 z-[10000] bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors"
        title="Open Map Pack Debugger"
      >
        🔧 Debug
      </button>
    );
  }

  return (
    <div className="fixed top-20 right-4 z-[10000] bg-white rounded-lg shadow-xl p-4 max-w-sm border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-900">Map Pack Debug</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span>Online Status:</span>
          <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
            {isOnline ? '🌐 Online' : '📱 Offline'}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Database:</span>
          <span className={dbStatus === 'Connected' ? 'text-green-600' : 'text-red-600'}>
            {dbStatus}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span>Cache Size:</span>
          <span>{Math.round(cacheSize / 1024)} KB</span>
        </div>
      </div>
      
      <div className="mt-3 space-y-2">
        <button
          onClick={updateStats}
          className="w-full bg-blue-500 text-white py-1 px-2 rounded text-xs hover:bg-blue-600"
        >
          🔄 Refresh Stats
        </button>
        
        <button
          onClick={testOfflineTile}
          className="w-full bg-green-500 text-white py-1 px-2 rounded text-xs hover:bg-green-600"
        >
          🧪 Test Offline System
        </button>
        
        <button
          onClick={testDownloadTiles}
          className="w-full bg-orange-500 text-white py-1 px-2 rounded text-xs hover:bg-orange-600"
        >
          📥 Download Test Tiles
        </button>
        
        <button
          onClick={testMapPacks}
          className="w-full bg-purple-500 text-white py-1 px-2 rounded text-xs hover:bg-purple-600"
        >
          📦 Test Map Packs
        </button>
        
        <button
          onClick={clearCache}
          className="w-full bg-red-500 text-white py-1 px-2 rounded text-xs hover:bg-red-600"
        >
          🗑️ Clear Cache
        </button>
      </div>
      
      <div className="mt-3 pt-2 border-t text-xs text-gray-500">
        <p>Use this to debug offline map functionality and check if tiles are being cached properly.</p>
      </div>
    </div>
  );
}
