import React, { useState, useEffect } from 'react';
import { mbtilesSourceService, RegionalPack, DownloadProgress } from '../services/mbtilesSourceService';

interface RegionalPackManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const RegionalPackManager: React.FC<RegionalPackManagerProps> = ({ isOpen, onClose }) => {
  const [availablePacks, setAvailablePacks] = useState<RegionalPack[]>([]);
  const [downloadedFiles, setDownloadedFiles] = useState<any[]>([]);
  const [activeDownloads, setActiveDownloads] = useState<Map<string, DownloadProgress>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
      // Set up polling for download progress
      const interval = setInterval(updateDownloadProgress, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Loading regional pack data...');
      
      // Test backend connection first
      const backendHealthy = await mbtilesSourceService.checkHealth();
      console.log('🏥 Backend health check:', backendHealthy);
      
      if (!backendHealthy) {
        throw new Error('Backend server is not responding. Make sure the backend is running on port 3001.');
      }
      
      const [packs, files] = await Promise.all([
        mbtilesSourceService.getAvailableRegionalPacks(),
        mbtilesSourceService.getDownloadedFiles()
      ]);
      
      console.log('📦 Loaded packs:', packs.length);
      console.log('📁 Downloaded files:', files.length);
      
      setAvailablePacks(packs);
      setDownloadedFiles(files);
    } catch (error) {
      console.error('❌ Failed to load regional pack data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateDownloadProgress = async () => {
    // Don't poll if there are no active downloads
    if (activeDownloads.size === 0) {
      return;
    }

    const updatedDownloads = new Map(activeDownloads);
    let hasUpdates = false;
    const hasCompletions = false;

    for (const [regionId, progress] of activeDownloads) {
      if (progress.status === 'downloading' || progress.status === 'pending') {
        try {
          const newProgress = await mbtilesSourceService.getDownloadProgress(regionId);
          if (newProgress) {
            if (newProgress.status === 'completed' && !newProgress.integrationStarted) {
              console.log(`🎉 Download completed for ${regionId}, starting integration...`);
              
              // Mark as integration started to prevent duplicate attempts
              newProgress.integrationStarted = true;
              updatedDownloads.set(regionId, newProgress);
              hasUpdates = true;
              
              // Start tile integration
              setTimeout(async () => {
                try {
                  console.log(`🔧 Integrating tiles for ${regionId}...`);
                  const integrationSuccess = await mbtilesSourceService.integrateRegionalPack(regionId);
                  
                  if (integrationSuccess) {
                    console.log(`✅ Successfully integrated ${regionId} into offline tile system`);
                    
                    // Update the active downloads to show completion
                    setActiveDownloads(prev => {
                      const updated = new Map(prev);
                      updated.delete(regionId);
                      return updated;
                    });
                    
                    // Reload data once after successful integration
                    loadData();
                  } else {
                    console.error(`❌ Failed to integrate ${regionId}`);
                  }
                } catch (error) {
                  console.error(`❌ Integration failed for ${regionId}:`, error);
                }
              }, 1000);
              
            } else if (newProgress.status === 'extracting') {
              console.log(`🔧 Extracting tiles for ${regionId}: ${newProgress.extractionProgress || 0}%`);
              updatedDownloads.set(regionId, newProgress);
              hasUpdates = true;
            } else if (newProgress.status === 'ready') {
              console.log(`✅ Region ${regionId} is ready for offline use`);
              updatedDownloads.delete(regionId);
              hasUpdates = true;
              // Don't trigger reload for 'ready' status - it causes infinite loop
            } else {
              // Update progress for ongoing downloads
              updatedDownloads.set(regionId, newProgress);
              hasUpdates = true;
            }
          }
        } catch (error) {
          console.warn(`Failed to update progress for ${regionId}:`, error);
        }
      }
    }

    if (hasUpdates) {
      setActiveDownloads(updatedDownloads);
      
      // Only reload data once if there were completions
      if (hasCompletions) {
        setTimeout(loadData, 1000); // Small delay to ensure backend has processed
      }
    }
  };

  const handleDownload = async (pack: RegionalPack) => {
    try {
      // Add to active downloads immediately
      const initialProgress: DownloadProgress = {
        filename: `${pack.id}-latest.osm.pbf`,
        totalBytes: pack.size,
        downloadedBytes: 0,
        percentage: 0,
        speed: 0,
        eta: 0,
        status: 'pending'
      };

      setActiveDownloads(prev => new Map(prev.set(pack.id, initialProgress)));

      await mbtilesSourceService.downloadRegionalPack(pack.id, 'pbf');
      console.log(`✅ Started downloading ${pack.name}`);
    } catch (error) {
      console.error(`Failed to download ${pack.name}:`, error);
      // Remove from active downloads on error
      setActiveDownloads(prev => {
        const newMap = new Map(prev);
        newMap.delete(pack.id);
        return newMap;
      });
      alert(`Failed to download ${pack.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRedownload = async (regionId: string) => {
    const pack = availablePacks.find(p => p.id === regionId);
    const packName = pack?.name || regionId;

    if (confirm(`Redownload ${packName}? This will replace the existing downloaded region.`)) {
      if (pack) {
        await handleDownload(pack);
      } else {
        // Create a minimal pack object for regions not in availablePacks
        const minimalPack: RegionalPack = {
          id: regionId,
          name: regionId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          size: 125000000, // Default size estimate
          sizeFormatted: '125 MB',
          availableFormats: ['pbf'],
          estimatedDownloadTime: '2-3 minutes'
        };
        await handleDownload(minimalPack);
      }
    }
  };

  // Filter out downloaded packs from available downloads
  const filteredPacks = availablePacks.filter(pack => {
    const isDownloaded = downloadedFiles.some(file => file.regionId === pack.id);
    const matchesSearch = pack.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pack.country?.toLowerCase().includes(searchTerm.toLowerCase());
    return !isDownloaded && matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">🌍 Regional Map Downloads</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 text-2xl"
            >
              ×
            </button>
          </div>
          <p className="text-gray-600 mt-2">
            Download complete country/region maps as single files. Much faster than individual tiles!
          </p>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="🔍 Search countries and regions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <div className="text-gray-500 mt-2">Loading regional packs...</div>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-lg font-medium text-red-600 mb-2">Connection Error</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={loadData}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  🔄 Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Downloaded Files */}
              {downloadedFiles.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📦 Downloaded Regions</h3>
                  <div className="grid gap-3">
                    {downloadedFiles.map((file) => (
                      <div key={file.filename} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-green-900">
                              {availablePacks.find(pack => pack.id === file.regionId)?.name || 
                               file.regionId.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </h4>
                            <p className="text-sm text-green-700">
                              {file.sizeFormatted} • Downloaded {file.ageInDays} days ago
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRedownload(file.regionId)}
                              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium hover:bg-blue-200"
                              title="Redownload region"
                            >
                              🔄 Update
                            </button>
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                              ✅ Ready
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Downloads */}
              {activeDownloads.size > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">⬇️ Active Downloads</h3>
                  <div className="grid gap-3">
                    {Array.from(activeDownloads.entries()).map(([regionId, progress]) => (
                      <div key={regionId} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-blue-900">
                            {regionId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </h4>
                          <span className="text-sm text-blue-700">
                            {progress.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress.percentage}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-sm text-blue-700">
                          <span>{formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}</span>
                          {progress.speed > 0 && (
                            <span>{formatBytes(progress.speed)}/s • ETA: {formatDuration(progress.eta)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Downloads */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  🔽 Available Downloads ({filteredPacks.length})
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredPacks.map((pack) => {
                    const isDownloading = activeDownloads.has(pack.id);
                    const isDownloaded = downloadedFiles.some(file => file.regionId === pack.id);
                    
                    return (
                      <div key={pack.id} className="p-4 border border-gray-200 rounded-lg hover:border-gray-300">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{pack.name}</h4>
                            {pack.country && (
                              <p className="text-sm text-gray-500">🇺🇳 {pack.country}</p>
                            )}
                            <p className="text-sm text-gray-600 mt-1">
                              📦 {pack.sizeFormatted} • ⏱️ ~{pack.estimatedDownloadTime}
                            </p>
                          </div>
                          <div className="ml-4">
                            {isDownloaded ? (
                              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                ✅ Downloaded
                              </span>
                            ) : isDownloading ? (
                              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                ⬇️ Downloading...
                              </span>
                            ) : (
                              <button
                                onClick={() => handleDownload(pack)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                              >
                                Download
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export default RegionalPackManager;
