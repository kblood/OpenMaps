import React, { useState, useEffect, useRef } from 'react';
import CopyMapPackModal from './CopyMapPackModal';
import RegionalPackManager from './RegionalPackManager';
import { getAvailableLayers } from '../config/mapLayers';
import { Map as LeafletMap } from 'leaflet';
import { 
  globalMapPackSystem, 
  CustomMapPack, 
  DownloadProgress 
} from '../services/globalMapPackSystem';
import DynamicLocationExplorer from './DynamicLocationExplorer';
import type { DynamicLocationNode } from '../services/dynamicLocationService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mapInstance?: LeafletMap;
  polygonPoints?: [number, number][];
  onPolygonPointsChange?: (points: [number, number][] | ((prev: [number, number][]) => [number, number][])) => void;
  showPolygonPreview?: boolean;
  onShowPolygonPreviewChange?: (show: boolean) => void;
  isDrawingPolygon?: boolean;
  onIsDrawingPolygonChange?: (drawing: boolean) => void;
  onSelectCustomPack?: (packId: string, selected: boolean) => void;
  onViewCustomPackOnMap?: (packId: string) => void;
  selectedCustomPacks?: Set<string>;
  onEditCustomPackPolygon?: (packId: string) => void;
  onStopPolygonEdit?: () => void;
  editingPolygonId?: string | null;
}

// (removed unused PolygonDrawingState interface)

const GlobalMapManager: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  mapInstance,
  polygonPoints = [],
  onPolygonPointsChange,
  showPolygonPreview = false,
  onShowPolygonPreviewChange,
  isDrawingPolygon = false,
  onIsDrawingPolygonChange,
  onSelectCustomPack,
  onViewCustomPackOnMap,
  selectedCustomPacks = new Set(),
  onEditCustomPackPolygon,
  onStopPolygonEdit,
  editingPolygonId = null
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<'offline' | 'dynamic' | 'custom' | 'downloads' | 'polygon' | 'regional'>('dynamic');
  const [customPacks, setCustomPacks] = useState<CustomMapPack[]>([]);
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map());
  
  // Offline tile management state
  const [tileStats, setTileStats] = useState<{
    totalTiles: number;
    totalSizeMB: number;
    tilesByLayer: { [layerId: string]: { count: number; sizeMB: number } };
    tilesByPack: { [packId: string]: { count: number; sizeMB: number; packName: string } };
    unassociatedTiles: { count: number; sizeMB: number };
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Custom pack creation form
  const [customPackForm, setCustomPackForm] = useState({
    name: '',
    description: '',
    zoomLevels: [10, 11, 12, 13, 14, 15, 16, 17, 18],
    layerIds: ['openstreetmap'],
    enableOfflineRouting: false,
    routingEngine: 'brouter' as 'brouter' | 'internal'
  });

  // Custom pack editing
  const [editingPack, setEditingPack] = useState<CustomMapPack | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [copyingPack, setCopyingPack] = useState<CustomMapPack | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [availableLayers, setAvailableLayers] = useState<{id: string; name: string}[]>([]);

  // Search state
  // (removed unused selectedLevelFilter state)

  // Refs
  const mapDrawingHandlerRef = useRef<((e: any) => void) | null>(null);

  // ==================== INITIALIZATION ====================
  // Load available layers
  useEffect(() => {
    const loadLayers = async () => {
      try {
        const { getAvailableLayers } = await import('../config/mapLayers');
        const layers = getAvailableLayers();
        setAvailableLayers(layers.map(layer => ({ id: layer.id, name: layer.name })));
      } catch (error) {
        console.error('Failed to load available layers:', error);
        // Fallback to basic layers
        setAvailableLayers([
          { id: 'openstreetmap', name: 'OpenStreetMap' },
          { id: 'satellite', name: 'Satellite' },
          { id: 'terrain', name: 'Terrain' }
        ]);
      }
    };
    loadLayers();
  }, []);

  useEffect(() => {
    let unsubscribeNav: (() => void) | undefined;
    let unsubscribeCustom: (() => void) | undefined;
    let unsubscribeDownload: (() => void) | undefined;

    const initializeSystem = async () => {
      try {
        await globalMapPackSystem.initialize();
        
        // Subscribe to updates
        unsubscribeCustom = globalMapPackSystem.onCustomPacksChange(setCustomPacks);
        unsubscribeDownload = globalMapPackSystem.onDownloadProgress((progress) => {
          setDownloads(prev => new Map(prev.set(progress.nodeId, progress)));
        });

        // Load initial state
        setCustomPacks(globalMapPackSystem.getCustomPacks());
      } catch (error) {
        console.error('Failed to initialize Global Map Manager:', error);
      }
    };

    initializeSystem();

    return () => {
      unsubscribeNav?.();
      unsubscribeCustom?.();
      unsubscribeDownload?.();
    };
  }, []);

  // ==================== POLYGON DRAWING ====================
  const startPolygonDrawing = () => {
    if (!mapInstance) {
      alert('Map not available for polygon drawing');
      return;
    }

    onIsDrawingPolygonChange?.(true);
    onPolygonPointsChange?.([]);
    onShowPolygonPreviewChange?.(false);

    // Add click handler to map with higher priority
    const clickHandler = (e: any) => {
      console.log('🖱️ Drawing click detected:', e.latlng);
      const lat = e.latlng?.lat || e.lat;
      const lng = e.latlng?.lng || e.lng;
      
      if (lat && lng) {
        // Update by getting current state and appending new point
        const newPoint: [number, number] = [lat, lng];
        console.log('📍 Adding point:', newPoint);
        
        // Use functional update to ensure we get latest state
        onPolygonPointsChange?.(prev => {
          const next = [...(prev || []), newPoint];
          console.log('Total points now:', next.length);
          return next;
        });
      }
    };

    mapDrawingHandlerRef.current = clickHandler;
    // Use a higher priority event handler to ensure drawing takes precedence
    mapInstance.on('click', clickHandler);
    
    setActiveTab('polygon');
  };

  const finishPolygonDrawing = () => {
    if (mapDrawingHandlerRef.current && mapInstance) {
      mapInstance.off('click', mapDrawingHandlerRef.current);
      mapDrawingHandlerRef.current = null;
    }

    onIsDrawingPolygonChange?.(false);
    onShowPolygonPreviewChange?.(true);
  };

  const clearPolygon = () => {
    if (mapDrawingHandlerRef.current && mapInstance) {
      mapInstance.off('click', mapDrawingHandlerRef.current);
      mapDrawingHandlerRef.current = null;
    }

    onIsDrawingPolygonChange?.(false);
    onPolygonPointsChange?.([]);
    onShowPolygonPreviewChange?.(false);
  };

  const createCustomPackFromPolygon = async () => {
    if (polygonPoints.length < 3) {
      alert('Please draw a polygon with at least 3 points');
      return;
    }

    if (!customPackForm.name.trim()) {
      alert('Please enter a name for the custom pack');
      return;
    }

    if (customPackForm.layerIds.length === 0) {
      alert('Please select at least one tile layer');
      return;
    }

    try {
      const packId = await globalMapPackSystem.createCustomPack(
        customPackForm.name,
        customPackForm.description,
        polygonPoints,
        customPackForm.zoomLevels,
        customPackForm.layerIds,
        customPackForm.enableOfflineRouting,
        customPackForm.routingEngine
      );

      console.log(`✅ Created custom pack: ${packId}`);
      
      // Reset form and polygon
      setCustomPackForm({
        name: '',
        description: '',
        zoomLevels: [10, 11, 12, 13, 14, 15, 16, 17, 18],
        layerIds: ['openstreetmap'],
        enableOfflineRouting: false,
        routingEngine: 'brouter' as 'brouter' | 'internal'
      });
      clearPolygon();
      setActiveTab('custom');
    } catch (error) {
      console.error('Failed to create custom pack:', error);
      alert('Failed to create custom pack. Please try again.');
    }
  };

  // ==================== CUSTOM PACK EDITING ====================
  const handleEditCustomPack = (pack: CustomMapPack) => {
    setEditingPack(pack);
    setCustomPackForm({
      name: pack.name,
      description: pack.description,
      zoomLevels: pack.zoomLevels,
      layerIds: pack.layerIds,
      enableOfflineRouting: pack.enableOfflineRouting || false,
      routingEngine: pack.routingEngine || 'brouter'
    });
    setShowEditModal(true);
  };

  const handleSaveCustomPack = async () => {
    if (!editingPack) return;

    if (!customPackForm.name.trim()) {
      alert('Please enter a name for the custom pack');
      return;
    }

    if (customPackForm.layerIds.length === 0) {
      alert('Please select at least one tile layer');
      return;
    }
    
    try {
      // Update the custom pack
      await globalMapPackSystem.updateCustomPack(editingPack.id, {
        name: customPackForm.name,
        description: customPackForm.description,
        zoomLevels: customPackForm.zoomLevels,
        layerIds: customPackForm.layerIds,
        enableOfflineRouting: customPackForm.enableOfflineRouting,
        routingEngine: customPackForm.routingEngine
      });
      
      setShowEditModal(false);
      setEditingPack(null);
      
      // Reset form
      setCustomPackForm({
        name: '',
        description: '',
        zoomLevels: [10, 11, 12, 13, 14, 15, 16, 17, 18],
        layerIds: ['openstreetmap'],
        enableOfflineRouting: false,
        routingEngine: 'brouter' as 'brouter' | 'internal'
      });
      
      console.log(`✅ Updated custom pack: ${editingPack.name}`);
    } catch (error) {
      console.error('Failed to update custom pack:', error);
      alert('Failed to update custom pack. Please try again.');
    }
  };

  const handleDeleteCustomPack = async (packId: string) => {
    const pack = customPacks.find(p => p.id === packId);
    if (!pack) return;
    
    const confirm = window.confirm(`Are you sure you want to delete "${pack.name}"?\n\nThis action cannot be undone.`);
    if (!confirm) return;
    
    try {
      await globalMapPackSystem.deleteCustomPack(packId);
      console.log(`✅ Deleted custom pack: ${pack.name}`);
    } catch (error) {
      console.error('Failed to delete custom pack:', error);
      alert('Failed to delete custom pack. Please try again.');
    }
  };

  const handleCopyCustomPack = async (packId: string) => {
    const pack = customPacks.find(p => p.id === packId);
    if (!pack) return;
    
    setCopyingPack(pack);
    setShowCopyModal(true);
  };

  // ==================== NAVIGATION ====================

  // (removed unused handleLevelNavigation)


  // ==================== DOWNLOADS ====================

  const handleDownloadCustomPack = async (packId: string, forceRedownload: boolean = false) => {
    try {
      await globalMapPackSystem.downloadCustomPack(packId, forceRedownload);
    } catch (error) {
      console.error('Custom pack download failed:', error);
      alert('Custom pack download failed. Please try again.');
    }
  };

  const handleRedownloadCustomPack = async (packId: string) => {
    const pack = customPacks.find(p => p.id === packId);
    if (!pack) return;
    
    const confirm = window.confirm(
      `Re-download "${pack.name}"?\n\n` +
      `This will download the latest tiles based on current settings:\n` +
      `- Layers: ${pack.layerIds.join(', ')}\n` +
      `- Zoom levels: ${pack.zoomLevels[0]}-${pack.zoomLevels[pack.zoomLevels.length - 1]}\n` +
      `- Estimated tiles: ${pack.estimatedTiles.toLocaleString()}\n\n` +
      `Existing tiles for this pack will be updated.`
    );
    
    if (confirm) {
      await handleDownloadCustomPack(packId, true);
    }
  };

  // ==================== DYNAMIC LOCATION HANDLERS ====================
  const handleDynamicLocationSelect = (location: DynamicLocationNode) => {
    console.log('🗺️ Selected dynamic location:', location);
    
    // Navigate map to location
    if (mapInstance) {
      mapInstance.setView([location.center.lat, location.center.lng], 10);
    }
  };

  const handleDynamicLocationDownload = async (location: DynamicLocationNode) => {
    try {
      console.log('⬇️ Downloading dynamic location:', location);
      
      // For now, implement a simple tile estimation and warning
      const confirmMessage = `Download ${location.name}?\n\n` +
        `Estimated: ${location.estimatedTiles.toLocaleString()} tiles (~${location.estimatedSizeMB}MB)\n\n` +
        `Note: Dynamic location downloads will create a custom pack for this area.`;
      
      const proceed = confirm(confirmMessage);
      if (!proceed) return;
      
      console.log(`🔄 Creating custom pack for ${location.name} (boundary preferred)...`);
      // Prefer boundary-based polygon if available via WebGIS; fallback to bounds
      const packId = await globalMapPackSystem.createAndDownloadFromDynamicNode({
        id: location.id,
        name: location.name,
        level: location.level,
        bounds: location.bounds
      }, { tryBoundary: true });
      console.log(`✅ Created and started download for custom pack ${packId} (${location.name})`);
      
    } catch (error) {
      console.error('Dynamic location download failed:', error);
  const msg = (error as any)?.message || String(error);
  alert(`Download failed: ${msg}`);
    }
  };

  // ==================== OFFLINE TILE MANAGEMENT ====================
  const loadTileStatistics = async () => {
    try {
      setLoadingStats(true);
      const stats = await globalMapPackSystem.getOfflineTileStatistics();
      setTileStats(stats);
    } catch (error) {
      console.error('Failed to load tile statistics:', error);
      alert('Failed to load tile statistics. Please try again.');
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDeleteTilesByLayer = async (layerId: string, layerName: string) => {
    const confirm = window.confirm(
      `Delete all offline tiles for "${layerName}" layer?\n\n` +
      `This will remove ${tileStats?.tilesByLayer[layerId]?.count || 0} tiles ` +
      `(~${tileStats?.tilesByLayer[layerId]?.sizeMB || 0}MB) from local storage.\n\n` +
      `This action cannot be undone.`
    );
    
    if (confirm) {
      try {
        const deletedCount = await globalMapPackSystem.deleteOfflineTilesByLayer(layerId);
        alert(`Deleted ${deletedCount} tiles for ${layerName} layer`);
        await loadTileStatistics(); // Reload stats
      } catch (error) {
        console.error('Failed to delete tiles:', error);
        alert('Failed to delete tiles. Please try again.');
      }
    }
  };

  const handleDeleteTilesByPack = async (packId: string, packName: string) => {
    const confirm = window.confirm(
      `Delete all offline tiles for "${packName}" pack?\n\n` +
      `This will remove ${tileStats?.tilesByPack[packId]?.count || 0} tiles ` +
      `(~${tileStats?.tilesByPack[packId]?.sizeMB || 0}MB) from local storage.\n\n` +
      `The pack will be marked as not downloaded and can be re-downloaded later.\n\n` +
      `This action cannot be undone.`
    );
    
    if (confirm) {
      try {
        const deletedCount = await globalMapPackSystem.deleteOfflineTilesByPack(packId);
        alert(`Deleted ${deletedCount} tiles for ${packName} pack`);
        await loadTileStatistics(); // Reload stats
        // Update custom packs to reflect changes
        const updatedPacks = await globalMapPackSystem.getCustomPacks();
        setCustomPacks(updatedPacks);
      } catch (error) {
        console.error('Failed to delete pack tiles:', error);
        alert('Failed to delete pack tiles. Please try again.');
      }
    }
  };

  const handleDeleteUnassociatedTiles = async () => {
    const confirm = window.confirm(
      `Delete all unassociated offline tiles?\n\n` +
      `This will remove ${tileStats?.unassociatedTiles.count || 0} tiles ` +
      `(~${tileStats?.unassociatedTiles.sizeMB || 0}MB) that are not part of any map pack.\n\n` +
      `These may be tiles from deleted packs or experimental downloads.\n\n` +
      `This action cannot be undone.`
    );
    
    if (confirm) {
      try {
        const deletedCount = await globalMapPackSystem.deleteUnassociatedTiles();
        alert(`Deleted ${deletedCount} unassociated tiles`);
        await loadTileStatistics(); // Reload stats
      } catch (error) {
        console.error('Failed to delete unassociated tiles:', error);
        alert('Failed to delete unassociated tiles. Please try again.');
      }
    }
  };

  // Load tile statistics when offline tab is activated
  useEffect(() => {
    if (activeTab === 'offline' && !tileStats && !loadingStats) {
      loadTileStatistics();
    }
  }, [activeTab, tileStats, loadingStats]);

  // ==================== EXPORT/IMPORT ====================
  const handleExportMapPacks = async () => {
    try {
      await globalMapPackSystem.exportMapPacksAsFile();
    } catch (error) {
      console.error('Export failed:', error);
  const msg = (error as any)?.message || String(error);
  alert(`Export failed: ${msg}`);
    }
  };

  const handleExportFullDatabase = async () => {
    try {
      const confirmation = confirm(
        `📦 Export Full Database\n\n` +
        `This will export ALL downloaded tiles, which can be very large.\n` +
        `For smaller exports, use "Export Map Packs" instead.\n\n` +
        `Continue with full export?`
      );
      
      if (confirmation) {
        await globalMapPackSystem.exportFullDatabase();
      }
    } catch (error) {
      console.error('Full export failed:', error);
  const msg = (error as any)?.message || String(error);
  alert(`Full export failed: ${msg}`);
    }
  };

  const handleExportMapPackWithTiles = async (nodeId: string) => {
    try {
      await globalMapPackSystem.exportMapPackWithTiles(nodeId);
    } catch (error) {
      console.error('Map pack export failed:', error);
  const msg = (error as any)?.message || String(error);
  alert(`Map pack export failed: ${msg}`);
    }
  };

  const handleExportCustomPack = async (packId: string) => {
    try {
      await globalMapPackSystem.exportCustomPackWithTiles(packId);
    } catch (error) {
      console.error('Custom pack export failed:', error);
  const msg = (error as any)?.message || String(error);
  alert(`Custom pack export failed: ${msg}`);
    }
  };

  const handleExportAllCustomPacks = async () => {
    try {
      await globalMapPackSystem.exportAllCustomPacks();
    } catch (error) {
      console.error('All custom packs export failed:', error);
  const msg = (error as any)?.message || String(error);
  alert(`All custom packs export failed: ${msg}`);
    }
  };

  const handleImportMapPacks = async () => {
    try {
      // Create file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.style.display = 'none';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          try {
            await globalMapPackSystem.importMapPacks(file);
          } catch (error) {
            console.error('Import failed:', error);
          }
        }
      };
      
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    } catch (error) {
      console.error('Import failed:', error);
  const msg = (error as any)?.message || String(error);
  alert(`Import failed: ${msg}`);
    }
  };






  const handleDownloadAction = async (nodeId: string, currentStatus: string) => {
    if (currentStatus === 'downloading') {
      // Show pause/cancel options
      const action = await showDownloadActionDialog();
      if (action === 'pause') {
        globalMapPackSystem.pauseDownload(nodeId);
      } else if (action === 'cancel') {
        globalMapPackSystem.cancelDownload(nodeId);
      }
    } else if (currentStatus === 'paused') {
      globalMapPackSystem.resumeDownload(nodeId);
    }
  };

  const showDownloadActionDialog = (): Promise<'pause' | 'cancel' | 'continue'> => {
    return new Promise((resolve) => {
      const action = prompt(
        'Download is in progress. What would you like to do?\n\n' +
        '1. Type "pause" to pause the download\n' +
        '2. Type "cancel" to cancel the download\n' +
        '3. Press Cancel to continue downloading\n\n' +
        'Enter your choice:'
      );
      
      if (action?.toLowerCase() === 'pause') {
        resolve('pause');
      } else if (action?.toLowerCase() === 'cancel') {
        resolve('cancel');
      } else {
        resolve('continue');
      }
    });
  };

  // ==================== RENDER HELPERS ====================




  const renderCustomPackCard = (pack: CustomMapPack) => {
    const downloadProgress = downloads.get(pack.id);
    const isDownloading = downloadProgress?.status === 'downloading';
    
    // Calculate expected polygon ID for editing state comparison
    const customPacks = globalMapPackSystem.getCustomPacks();
    const packIndex = customPacks.findIndex(p => p.id === pack.id);
    const expectedPolygonId = packIndex !== -1 ? `custom-pack-${packIndex}` : null;
    
    return (
      <div key={pack.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">📍 {pack.name}</h3>
            {pack.description && (
              <p className="text-sm text-gray-600 mt-1">{pack.description}</p>
            )}
            
            <div className="text-sm text-gray-500 mt-2">
              <p>Polygon: {pack.polygon.length} points</p>
              <p>Tiles: {pack.estimatedTiles.toLocaleString()} • ~{pack.estimatedSizeMB}MB</p>
              <p>Zoom: {pack.zoomLevels[0]}-{pack.zoomLevels[pack.zoomLevels.length - 1]} ({pack.zoomLevels.length} levels)</p>
              <p>Layers: {pack.layerIds.length > 1 ? `${pack.layerIds.length} layers` : pack.layerIds[0] || 'openstreetmap'}</p>
              <p>Created: {pack.created.toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="flex flex-col space-y-2 ml-4">
            {/* View on Map button */}
            <button
              onClick={() => onViewCustomPackOnMap?.(pack.id)}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 flex items-center space-x-1"
              title={`View ${pack.name} on map`}
            >
              <span>🗺️</span>
              <span>View</span>
            </button>
            
            {/* Toggle visibility button */}
            <button
              onClick={() => onSelectCustomPack?.(pack.id, !selectedCustomPacks.has(pack.id))}
              className={`px-3 py-1 rounded text-sm flex items-center space-x-1 ${
                selectedCustomPacks.has(pack.id)
                  ? 'bg-purple-500 text-white hover:bg-purple-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title={`${selectedCustomPacks.has(pack.id) ? 'Hide' : 'Show'} polygon on map`}
            >
              <span>{selectedCustomPacks.has(pack.id) ? '👁️' : '👁️‍🗨️'}</span>
              <span>{selectedCustomPacks.has(pack.id) ? 'Hide' : 'Show'}</span>
            </button>
            
            {!pack.isDownloaded && (
              <button
                onClick={() => {
                  if (isDownloading || downloadProgress?.status === 'paused') {
                    handleDownloadAction(pack.id, downloadProgress?.status || 'downloading');
                  } else {
                    handleDownloadCustomPack(pack.id);
                  }
                }}
                className={`px-3 py-1 text-white rounded text-sm ${
                  isDownloading 
                    ? 'bg-orange-500 hover:bg-orange-600' 
                    : downloadProgress?.status === 'paused'
                    ? 'bg-blue-500 hover:bg-blue-600'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {isDownloading ? '⏸️ Downloading...' : 
                 downloadProgress?.status === 'paused' ? '▶️ Resume' : 
                 '⬇️ Download'}
              </button>
            )}
            
            {/* Edit and Delete buttons */}
            <button
              onClick={() => handleEditCustomPack(pack)}
              className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 flex items-center space-x-1"
              title={`Edit ${pack.name} settings`}
            >
              <span>✏️</span>
              <span>Edit Settings</span>
            </button>
            
            {/* Edit Polygon button */}
            <button
              onClick={() => {
                if (editingPolygonId === expectedPolygonId) {
                  onStopPolygonEdit?.();
                } else {
                  onEditCustomPackPolygon?.(pack.id);
                }
              }}
              className={`px-3 py-1 rounded text-sm flex items-center space-x-1 ${
                editingPolygonId === expectedPolygonId
                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                  : 'bg-purple-500 text-white hover:bg-purple-600'
              }`}
              title={editingPolygonId === expectedPolygonId ? 'Stop editing polygon' : 'Edit polygon shape'}
            >
              <span>{editingPolygonId === expectedPolygonId ? '🛑' : '🔧'}</span>
              <span>{editingPolygonId === expectedPolygonId ? 'Stop Edit' : 'Edit Shape'}</span>
            </button>

            {/* Re-download button for downloaded packs */}
            {pack.isDownloaded && !isDownloading && (
              <button
                onClick={() => handleRedownloadCustomPack(pack.id)}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 flex items-center space-x-1"
                title={`Re-download ${pack.name} with current settings`}
              >
                <span>🔄</span>
                <span>Re-download</span>
              </button>
            )}
            
            {/* Copy button */}
            <button
              onClick={() => handleCopyCustomPack(pack.id)}
              className="px-3 py-1 bg-teal-500 text-white rounded text-sm hover:bg-teal-600 flex items-center space-x-1"
              title={`Copy ${pack.name} with different settings`}
            >
              <span>📋</span>
              <span>Copy</span>
            </button>
            
            <button
              onClick={() => handleDeleteCustomPack(pack.id)}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 flex items-center space-x-1"
              title={`Delete ${pack.name}`}
            >
              <span>🗑️</span>
              <span>Delete</span>
            </button>
            
            {pack.isDownloaded && (
              <>
                <span className="text-green-500 text-sm">✓ Downloaded</span>
                <button
                  onClick={() => handleExportCustomPack(pack.id)}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 flex items-center space-x-1"
                  title={`Export ${pack.name} with tiles`}
                >
                  <span>📦</span>
                  <span>Export</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        {downloadProgress && (
          <div className="mt-3">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>
                {downloadProgress.current.toLocaleString()} / {downloadProgress.total.toLocaleString()} tiles
              </span>
              <span>
                {Math.round((downloadProgress.current / downloadProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== MAIN RENDER ====================
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1100]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold">🌍 Global Map Pack System</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          {[
            { id: 'dynamic', label: '🌐 Dynamic Explorer', icon: '🔄' },
            { id: 'regional', label: '🌍 Regional Packs', icon: '📦' },
            { id: 'offline', label: '💾 Offline Tiles', icon: '🗄️' },
            { id: 'custom', label: 'Custom Packs', icon: '📍' },
            { id: 'polygon', label: 'Draw Area', icon: '✏️' },
            { id: 'downloads', label: 'Downloads', icon: '⬇️' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Dynamic Explorer Tab */}
          {activeTab === 'dynamic' && (
            <div className="h-full overflow-y-auto p-4">
              <h3 className="font-semibold text-lg mb-4">🌐 Dynamic Location Explorer</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="text-sm text-blue-800">
                  <strong>✨ New Dynamic System:</strong> Loads all world locations on-demand from OpenStreetMap APIs.
                  Get real-time data for all 190+ countries, states, cities, and districts worldwide!
                </div>
              </div>
              
              <DynamicLocationExplorer
                onLocationSelect={handleDynamicLocationSelect}
                onDownload={handleDynamicLocationDownload}
                className="h-full"
              />
            </div>
          )}

          {/* Regional Packs Tab */}
          {activeTab === 'regional' && (
            <div className="h-full overflow-y-auto p-4">
              <h3 className="font-semibold text-lg mb-4">🌍 Regional Map Packs</h3>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="text-sm text-green-800">
                  <strong>🚀 Single-File Downloads:</strong> Download complete countries as single MBTiles files. 
                  100x faster than individual tiles and works completely offline!
                </div>
              </div>

              <RegionalPackManager 
                isOpen={true} 
                onClose={() => setActiveTab('dynamic')} 
              />
            </div>
          )}

          {/* Offline Tile Management Tab */}
          {activeTab === 'offline' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">💾 Offline Tile Management</h3>
                <button
                  onClick={loadTileStatistics}
                  disabled={loadingStats}
                  className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:bg-gray-400 flex items-center space-x-1"
                >
                  <span>🔄</span>
                  <span>{loadingStats ? 'Loading...' : 'Refresh'}</span>
                </button>
              </div>

              {loadingStats && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <p className="mt-2 text-gray-600">Loading tile statistics...</p>
                </div>
              )}

              {!loadingStats && !tileStats && (
                <div className="text-center py-8 text-gray-500">
                  <p>Click "Refresh" to load offline tile statistics</p>
                </div>
              )}

              {tileStats && (
                <div className="space-y-6">
                  {/* Overview Statistics */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-md mb-3 text-blue-800">📊 Storage Overview</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Total Tiles:</span>
                        <span className="ml-2 text-blue-700 font-mono">{tileStats.totalTiles.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="font-medium">Total Size:</span>
                        <span className="ml-2 text-blue-700 font-mono">{tileStats.totalSizeMB.toFixed(2)} MB</span>
                      </div>
                    </div>
                  </div>

                  {/* Tiles by Layer */}
                  {Object.keys(tileStats.tilesByLayer).length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-md mb-3 text-green-800">🗺️ Tiles by Layer</h4>
                      <div className="space-y-2">
                        {Object.entries(tileStats.tilesByLayer).map(([layerId, stats]) => (
                          <div key={layerId} className="flex items-center justify-between bg-white rounded p-3 border border-green-200">
                            <div className="flex-1">
                              <span className="font-medium text-green-800">{layerId}</span>
                              <div className="text-sm text-green-600">
                                {stats.count.toLocaleString()} tiles • {stats.sizeMB.toFixed(2)} MB
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteTilesByLayer(layerId, layerId)}
                              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 flex items-center space-x-1"
                              title={`Delete all ${layerId} tiles`}
                            >
                              <span>🗑️</span>
                              <span>Delete</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tiles by Pack */}
                  {Object.keys(tileStats.tilesByPack).length > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h4 className="font-semibold text-md mb-3 text-purple-800">📍 Tiles by Map Pack</h4>
                      <div className="space-y-2">
                        {Object.entries(tileStats.tilesByPack).map(([packId, stats]) => (
                          <div key={packId} className="flex items-center justify-between bg-white rounded p-3 border border-purple-200">
                            <div className="flex-1">
                              <span className="font-medium text-purple-800">{stats.packName}</span>
                              <div className="text-sm text-purple-600">
                                {stats.count.toLocaleString()} tiles • {stats.sizeMB.toFixed(2)} MB
                              </div>
                              <div className="text-xs text-gray-500">Pack ID: {packId}</div>
                            </div>
                            <button
                              onClick={() => handleDeleteTilesByPack(packId, stats.packName)}
                              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 flex items-center space-x-1"
                              title={`Delete all tiles for ${stats.packName}`}
                            >
                              <span>🗑️</span>
                              <span>Delete</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unassociated Tiles */}
                  {tileStats.unassociatedTiles.count > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-semibold text-md mb-3 text-orange-800">⚠️ Unassociated Tiles</h4>
                      <div className="flex items-center justify-between bg-white rounded p-3 border border-orange-200">
                        <div className="flex-1">
                          <span className="font-medium text-orange-800">Orphaned Tiles</span>
                          <div className="text-sm text-orange-600">
                            {tileStats.unassociatedTiles.count.toLocaleString()} tiles • {tileStats.unassociatedTiles.sizeMB.toFixed(2)} MB
                          </div>
                          <div className="text-xs text-gray-500">These tiles are not part of any current map pack</div>
                        </div>
                        <button
                          onClick={handleDeleteUnassociatedTiles}
                          className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 flex items-center space-x-1"
                          title="Delete all unassociated tiles"
                        >
                          <span>🗑️</span>
                          <span>Clean Up</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {tileStats.totalTiles === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-6xl mb-4">🗂️</div>
                      <h4 className="text-lg font-medium mb-2">No Offline Tiles</h4>
                      <p>Download some map packs to see offline tile statistics here.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Custom Packs Tab */}
          {activeTab === 'custom' && (
            <div className="h-full overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Custom Map Packs ({customPacks.length})</h3>
                <button
                  onClick={startPolygonDrawing}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  ✏️ Draw New Area
                </button>
              </div>

              {/* Custom Pack Export Section */}
              {customPacks.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-md mb-3">📦 Export Custom Packs</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={handleExportAllCustomPacks}
                      className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 flex items-center justify-center space-x-2"
                    >
                      <span>📤</span>
                      <span>Export All Custom Packs ({customPacks.length})</span>
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    <p><strong>Export All:</strong> Saves all your custom polygon areas with their tiles</p>
                    <p><strong>Individual Export:</strong> Use the 📦 button next to each pack</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                {customPacks.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">No custom packs created yet</p>
                    <button
                      onClick={startPolygonDrawing}
                      className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      ✏️ Create Your First Custom Pack
                    </button>
                  </div>
                ) : (
                  customPacks.map(renderCustomPackCard)
                )}
              </div>
            </div>
          )}

          {/* Polygon Drawing Tab */}
          {activeTab === 'polygon' && (
            <div className="h-full overflow-y-auto p-4">
              <h3 className="font-semibold text-lg mb-4">🗺️ Draw Custom Area</h3>
              
              {!mapInstance && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
                  ⚠️ Map instance not available. Please make sure the map is loaded.
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Drawing Controls */}
                <div>
                  <h4 className="font-semibold mb-3">Drawing Controls</h4>
                  
                  <div className="space-y-3">
                    {!isDrawingPolygon && polygonPoints.length === 0 && (
                      <button
                        onClick={startPolygonDrawing}
                        disabled={!mapInstance}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                      >
                        🖱️ Start Drawing Polygon
                      </button>
                    )}
                    
                    {isDrawingPolygon && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                          Click on the map to add points to your polygon
                        </p>
                        <p className="text-sm font-medium">
                          Points: {polygonPoints.length}
                        </p>
                        <div className="flex space-x-2">
                          <button
                            onClick={finishPolygonDrawing}
                            disabled={polygonPoints.length < 3}
                            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:bg-gray-400"
                          >
                            ✓ Finish Drawing
                          </button>
                          <button
                            onClick={clearPolygon}
                            className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                          >
                            🗑️ Clear
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {showPolygonPreview && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-green-600">
                          ✓ Polygon Complete ({polygonPoints.length} points)
                        </p>
                        <button
                          onClick={clearPolygon}
                          className="w-full px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                        >
                          🗑️ Clear & Start Over
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Pack Creation Form */}
                <div>
                  <h4 className="font-semibold mb-3">Pack Settings</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pack Name *
                      </label>
                      <input
                        type="text"
                        value={customPackForm.name}
                        onChange={(e) => setCustomPackForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Downtown Area, Custom Route"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={customPackForm.description}
                        onChange={(e) => setCustomPackForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Optional description..."
                        rows={3}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Zoom Levels
                      </label>
                      <div className="flex items-center space-x-2">
                        <select
                          value={Math.min(...customPackForm.zoomLevels)}
                          onChange={(e) => {
                            const min = parseInt(e.target.value);
                            const max = Math.max(...customPackForm.zoomLevels);
                            const levels = Array.from({ length: max - min + 1 }, (_, i) => min + i);
                            setCustomPackForm(prev => ({ ...prev, zoomLevels: levels }));
                          }}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {Array.from({ length: 18 }, (_, i) => i + 1).map(z => (
                            <option key={z} value={z}>Min: {z}</option>
                          ))}
                        </select>
                        <span>to</span>
                        <select
                          value={Math.max(...customPackForm.zoomLevels)}
                          onChange={(e) => {
                            const max = parseInt(e.target.value);
                            const min = Math.min(...customPackForm.zoomLevels);
                            const levels = Array.from({ length: max - min + 1 }, (_, i) => min + i);
                            setCustomPackForm(prev => ({ ...prev, zoomLevels: levels }));
                          }}
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {Array.from({ length: 18 }, (_, i) => i + 1).map(z => (
                            <option key={z} value={z}>Max: {z}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Levels {Math.min(...customPackForm.zoomLevels)}-{Math.max(...customPackForm.zoomLevels)} 
                        ({customPackForm.zoomLevels.length} levels)
                      </p>
                    </div>

                    {/* Tile Layer Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tile Layers
                      </label>
                      <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
                        {getAvailableLayers().map(layer => (
                          <label key={layer.id} className="flex items-center space-x-2 text-sm">
                            <input
                              type="checkbox"
                              checked={customPackForm.layerIds.includes(layer.id)}
                              onChange={(e) => {
                                const { checked } = e.target;
                                setCustomPackForm(prev => ({
                                  ...prev,
                                  layerIds: checked
                                    ? [...prev.layerIds, layer.id]
                                    : prev.layerIds.filter(id => id !== layer.id)
                                }));
                              }}
                              className="rounded"
                            />
                            <span>{layer.name}</span>
                            <span className="text-xs text-gray-500">({layer.id})</span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Selected: {customPackForm.layerIds.length} layer{customPackForm.layerIds.length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {/* Offline Routing Options */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Offline Routing
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={customPackForm.enableOfflineRouting}
                            onChange={(e) => setCustomPackForm(prev => ({ 
                              ...prev, 
                              enableOfflineRouting: e.target.checked 
                            }))}
                            className="rounded"
                          />
                          <span className="text-sm">Enable offline route finding</span>
                        </label>
                        
                        {customPackForm.enableOfflineRouting && (
                          <div className="ml-6 space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Routing Engine
                            </label>
                            <select
                              value={customPackForm.routingEngine}
                              onChange={(e) => setCustomPackForm(prev => ({ 
                                ...prev, 
                                routingEngine: e.target.value as 'brouter' | 'internal' 
                              }))}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                            >
                              <option value="brouter">BRouter (High Quality)</option>
                              <option value="internal">Internal (Basic)</option>
                            </select>
                            <p className="text-xs text-gray-500">
                              BRouter provides more accurate routing for cycling/hiking. 
                              Internal routing uses basic straight-line calculations.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={createCustomPackFromPolygon}
                      disabled={!showPolygonPreview || !customPackForm.name.trim()}
                      className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
                    >
                      📦 Create Custom Pack
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Polygon Preview */}
              {polygonPoints.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-2">Polygon Preview</h4>
                  <div className="bg-gray-100 rounded p-3 text-sm">
                    <p><strong>Points:</strong> {polygonPoints.length}</p>
                    {polygonPoints.length >= 3 && (
                      <p><strong>Area:</strong> Custom polygon defined</p>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-blue-600">View Coordinates</summary>
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        {polygonPoints.map((point, index) => (
                          <div key={index} className="text-xs">
                            {index + 1}: {point[0].toFixed(6)}, {point[1].toFixed(6)}
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Downloads Tab */}
          {activeTab === 'downloads' && (
            <div className="h-full overflow-y-auto p-4">
              <h3 className="font-semibold text-lg mb-4">📥 Downloads & Backup</h3>
              
              {/* Export/Import Section */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-md mb-3">💾 Backup & Transfer</h4>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={handleExportMapPacks}
                    className="px-4 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 flex items-center justify-center space-x-2"
                  >
                    <span>📋</span>
                    <span>Export Download List</span>
                  </button>
                  
                  <button
                    onClick={handleExportFullDatabase}
                    className="px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 flex items-center justify-center space-x-2"
                  >
                    <span>🗄️</span>
                    <span>Export All Tiles</span>
                  </button>
                  
                  <button
                    onClick={handleImportMapPacks}
                    className="px-4 py-2 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 flex items-center justify-center space-x-2"
                  >
                    <span>📥</span>
                    <span>Import Map Packs</span>
                  </button>
                </div>
                
                <div className="text-xs text-gray-600 mt-2">
                  <p><strong>Download List:</strong> Metadata only (tiny file, ~KB)</p>
                  <p><strong>All Tiles:</strong> Complete map data (large file, ~MB-GB)</p>
                  <p><strong>Import:</strong> Restore from any exported file</p>
                  <p><strong>💡 Tip:</strong> Export individual regions/custom packs using their 📦 button</p>
                </div>
              </div>

              {/* Downloaded Regions Section */}
              <div className="bg-green-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-md mb-3">✅ Downloaded Regions</h4>
                <div className="space-y-2">
                  {globalMapPackSystem.getGlobalNodes()
                    .filter(node => node.isDownloaded)
                    .map(node => (
                      <div key={node.id} className="flex items-center justify-between bg-white rounded p-2 border border-green-200">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">
                            {node.level === 'world' ? '🌍' : 
                             node.level === 'continent' ? '🌎' : 
                             node.level === 'country' ? '🏴' : 
                             node.level === 'state' ? '🗺️' : '🏙️'}
                          </span>
                          <div>
                            <div className="font-medium text-sm">{node.name}</div>
                            <div className="text-xs text-gray-500">
                              {node.level} • ~{node.estimatedSizeMB}MB
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleExportMapPackWithTiles(node.id)}
                          className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 flex items-center space-x-1"
                          title={`Export ${node.name} with tiles`}
                        >
                          <span>📦</span>
                          <span>Export</span>
                        </button>
                      </div>
                    ))
                  }
                  
                  {globalMapPackSystem.getGlobalNodes().filter(node => node.isDownloaded).length === 0 && (
                    <div className="text-center text-gray-500 py-4">
                      No regions downloaded yet
                    </div>
                  )}
                </div>
              </div>

              {/* Downloaded Custom Packs Section */}
              {customPacks.filter(pack => pack.isDownloaded).length > 0 && (
                <div className="bg-purple-50 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-md mb-3">📍 Downloaded Custom Packs</h4>
                  <div className="space-y-2">
                    {customPacks
                      .filter(pack => pack.isDownloaded)
                      .map(pack => (
                        <div key={pack.id} className="flex items-center justify-between bg-white rounded p-2 border border-purple-200">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">📍</span>
                            <div>
                              <div className="font-medium text-sm">{pack.name}</div>
                              <div className="text-xs text-gray-500">
                                Custom Area • {pack.polygon.length} points • ~{pack.estimatedSizeMB}MB
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleExportCustomPack(pack.id)}
                            className="px-2 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 flex items-center space-x-1"
                            title={`Export ${pack.name} with tiles`}
                          >
                            <span>📦</span>
                            <span>Export</span>
                          </button>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
              
              <h4 className="font-semibold text-md mb-3">⬇️ Active Downloads</h4>
              
              {downloads.size === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No active downloads</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(downloads.values()).map(progress => {
                    const node = globalMapPackSystem.getGlobalNodes().find(n => n.id === progress.nodeId);
                    const customPack = customPacks.find(p => p.id === progress.nodeId);
                    const name = node?.name || customPack?.name || progress.nodeId;
                    
                    return (
                      <div key={progress.nodeId} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{name}</h4>
                          <div className="flex items-center space-x-2">
                            <span className={`text-sm px-2 py-1 rounded ${
                              progress.status === 'downloading' ? 'bg-blue-100 text-blue-800' :
                              progress.status === 'completed' ? 'bg-green-100 text-green-800' :
                              progress.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                              progress.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              progress.status === 'error' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {progress.status}
                            </span>
                            
                            {/* Control buttons */}
                            {(progress.status === 'downloading' || progress.status === 'paused') && (
                              <div className="flex space-x-1">
                                {progress.status === 'downloading' && (
                                  <>
                                    <button
                                      onClick={() => globalMapPackSystem.pauseDownload(progress.nodeId)}
                                      className="px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
                                      title="Pause download"
                                    >
                                      ⏸️
                                    </button>
                                    <button
                                      onClick={() => globalMapPackSystem.cancelDownload(progress.nodeId)}
                                      className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                      title="Cancel download"
                                    >
                                      ❌
                                    </button>
                                  </>
                                )}
                                {progress.status === 'paused' && (
                                  <>
                                    <button
                                      onClick={() => globalMapPackSystem.resumeDownload(progress.nodeId)}
                                      className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                      title="Resume download"
                                    >
                                      ▶️
                                    </button>
                                    <button
                                      onClick={() => globalMapPackSystem.cancelDownload(progress.nodeId)}
                                      className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                      title="Cancel download"
                                    >
                                      ❌
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="mb-2">
                          <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>
                              {progress.current.toLocaleString()} / {progress.total.toLocaleString()} tiles
                            </span>
                            <span>
                              {Math.round((progress.current / progress.total) * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                          </div>
                        </div>
                        
                        {progress.speed > 0 && (
                          <div className="text-xs text-gray-500">
                            Speed: {progress.speed.toFixed(1)} tiles/sec • 
                            ETA: {Math.round(progress.estimatedTimeRemaining / 60)} min
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Edit Custom Pack Modal */}
        {showEditModal && editingPack && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1200]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold">✏️ Edit Map Pack</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pack Name *
                  </label>
                  <input
                    type="text"
                    value={customPackForm.name}
                    onChange={(e) => setCustomPackForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Downtown Area, Custom Route"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={customPackForm.description}
                    onChange={(e) => setCustomPackForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zoom Levels
                  </label>
                  <div className="flex items-center space-x-2">
                    <select
                      value={Math.min(...customPackForm.zoomLevels)}
                      onChange={(e) => {
                        const min = parseInt(e.target.value);
                        const max = Math.max(...customPackForm.zoomLevels);
                        const levels = Array.from({ length: max - min + 1 }, (_, i) => min + i);
                        setCustomPackForm(prev => ({ ...prev, zoomLevels: levels }));
                      }}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      {Array.from({ length: 18 }, (_, i) => i + 1).map(z => (
                        <option key={z} value={z}>Min: {z}</option>
                      ))}
                    </select>
                    <span>to</span>
                    <select
                      value={Math.max(...customPackForm.zoomLevels)}
                      onChange={(e) => {
                        const max = parseInt(e.target.value);
                        const min = Math.min(...customPackForm.zoomLevels);
                        const levels = Array.from({ length: max - min + 1 }, (_, i) => min + i);
                        setCustomPackForm(prev => ({ ...prev, zoomLevels: levels }));
                      }}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      {Array.from({ length: 18 }, (_, i) => i + 1).map(z => (
                        <option key={z} value={z}>Max: {z}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Levels {Math.min(...customPackForm.zoomLevels)}-{Math.max(...customPackForm.zoomLevels)} 
                    ({customPackForm.zoomLevels.length} levels)
                  </p>
                </div>

                {/* Tile Layer Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tile Layers
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
                    {getAvailableLayers().map(layer => (
                      <label key={layer.id} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={customPackForm.layerIds.includes(layer.id)}
                          onChange={(e) => {
                            const { checked } = e.target;
                            setCustomPackForm(prev => ({
                              ...prev,
                              layerIds: checked
                                ? [...prev.layerIds, layer.id]
                                : prev.layerIds.filter(id => id !== layer.id)
                            }));
                          }}
                          className="rounded"
                        />
                        <span>{layer.name}</span>
                        <span className="text-xs text-gray-500">({layer.id})</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {customPackForm.layerIds.length} layer{customPackForm.layerIds.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Offline Routing Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Offline Routing
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={customPackForm.enableOfflineRouting}
                        onChange={(e) => setCustomPackForm(prev => ({ 
                          ...prev, 
                          enableOfflineRouting: e.target.checked 
                        }))}
                        className="rounded"
                      />
                      <span className="text-sm">Enable offline route finding</span>
                    </label>
                    
                    {customPackForm.enableOfflineRouting && (
                      <div className="ml-6 space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Routing Engine
                        </label>
                        <select
                          value={customPackForm.routingEngine}
                          onChange={(e) => setCustomPackForm(prev => ({ 
                            ...prev, 
                            routingEngine: e.target.value as 'brouter' | 'internal' 
                          }))}
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                        >
                          <option value="brouter">BRouter (High Quality)</option>
                          <option value="internal">Internal (Basic)</option>
                        </select>
                        <p className="text-xs text-gray-500">
                          BRouter provides more accurate routing for cycling/hiking. 
                          Internal routing uses basic straight-line calculations.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-gray-100 rounded p-3 text-sm">
                  <p><strong>Polygon:</strong> {editingPack.polygon.length} points (cannot be edited)</p>
                  <p><strong>Created:</strong> {editingPack.created.toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 p-4 border-t border-gray-200">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCustomPack}
                  disabled={!customPackForm.name.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Copy Modal */}
        {showCopyModal && copyingPack && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">Copy Map Pack: {copyingPack.name}</h3>
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <CopyMapPackModal 
                originalPack={copyingPack}
                availableLayers={availableLayers}
                onCopy={async (options) => {
                  try {
                    const newPackId = await globalMapPackSystem.copyCustomPack(
                      copyingPack.id,
                      options.name,
                      {
                        zoomLevels: options.zoomLevels,
                        layerIds: options.layerIds,
                        description: options.description
                      }
                    );
                    setShowCopyModal(false);
                    setCopyingPack(null);
                    console.log(`✅ Copied pack with ID: ${newPackId}`);
                  } catch (error) {
                    console.error('Failed to copy pack:', error);
                    alert('Failed to copy map pack. Please try again.');
                  }
                }}
                onCancel={() => {
                  setShowCopyModal(false);
                  setCopyingPack(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalMapManager;
