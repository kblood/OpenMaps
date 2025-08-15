import { useState, useEffect } from 'react';
import { MapPack, mapPackManager } from '../config/mapPacks';

interface MapPackManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLayersUpdated: () => void;
}

export function MapPackManager({ isOpen, onClose, onLayersUpdated }: MapPackManagerProps) {
  const [installedPacks, setInstalledPacks] = useState<MapPack[]>([]);
  const [availablePacks, setAvailablePacks] = useState<MapPack[]>([]);

  useEffect(() => {
    if (isOpen) {
      console.log('MapPackManager opening, loading packs...');
      const installed = mapPackManager.getInstalledPacks();
      const available = mapPackManager.getAvailablePacks();
      console.log('Installed packs:', installed);
      console.log('Available packs:', available);
      setInstalledPacks(installed);
      setAvailablePacks(available);
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ zIndex: 10000 }}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden" style={{ zIndex: 10001 }}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Map Pack Manager</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
          {/* Installed Packs */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Installed Map Packs</h3>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Map Packs</h3>
            {availablePacks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                All available map packs are already installed!
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
        </div>
      </div>
    </div>
  );
}