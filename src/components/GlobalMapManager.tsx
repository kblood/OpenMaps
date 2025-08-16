import React, { useState, useEffect, useRef } from 'react';
import { Map as LeafletMap } from 'leaflet';
import { 
  globalMapPackSystem, 
  NavigationState, 
  CustomMapPack, 
  DownloadProgress 
} from '../services/globalMapPackSystem';
import { 
  GlobalMapNode, 
  SearchableLocation, 
  HIERARCHY_LEVELS 
} from '../data/globalMapHierarchy';
import DynamicLocationExplorer from './DynamicLocationExplorer';
import type { DynamicLocationNode } from '../services/dynamicLocationService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mapInstance?: LeafletMap;
  polygonPoints?: [number, number][];
  onPolygonPointsChange?: (points: [number, number][]) => void;
  showPolygonPreview?: boolean;
  onShowPolygonPreviewChange?: (show: boolean) => void;
  isDrawingPolygon?: boolean;
  onIsDrawingPolygonChange?: (drawing: boolean) => void;
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
  onIsDrawingPolygonChange
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'dynamic' | 'custom' | 'downloads' | 'polygon'>('dynamic');
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);
  const [customPacks, setCustomPacks] = useState<CustomMapPack[]>([]);
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map());
  
  // Custom pack creation form
  const [customPackForm, setCustomPackForm] = useState({
    name: '',
    description: '',
    zoomLevels: [10, 11, 12, 13, 14, 15, 16, 17, 18],
    layerIds: ['openstreetmap']
  });

  // Search state
  const [searchInput, setSearchInput] = useState('');
  // (removed unused selectedLevelFilter state)

  // Refs
  const mapDrawingHandlerRef = useRef<((e: any) => void) | null>(null);

  // ==================== INITIALIZATION ====================
  useEffect(() => {
    let unsubscribeNav: (() => void) | undefined;
    let unsubscribeCustom: (() => void) | undefined;
    let unsubscribeDownload: (() => void) | undefined;

    const initializeSystem = async () => {
      try {
        await globalMapPackSystem.initialize();
        
        // Subscribe to updates
        unsubscribeNav = globalMapPackSystem.onNavigationChange(setNavigationState);
        unsubscribeCustom = globalMapPackSystem.onCustomPacksChange(setCustomPacks);
        unsubscribeDownload = globalMapPackSystem.onDownloadProgress((progress) => {
          setDownloads(prev => new Map(prev.set(progress.nodeId, progress)));
        });

        // Load initial state
        setNavigationState(globalMapPackSystem.getNavigationState());
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

    // Add click handler to map
    const clickHandler = (e: any) => {
      const lat = e.latlng?.lat || e.lat;
      const lng = e.latlng?.lng || e.lng;
      
      if (lat && lng) {
  // Compute next points array from current props and emit (prop is not a setter)
  const next = [...polygonPoints, [lat, lng] as [number, number]];
  onPolygonPointsChange?.(next);
      }
    };

    mapDrawingHandlerRef.current = clickHandler;
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

    try {
      const packId = await globalMapPackSystem.createCustomPack(
        customPackForm.name,
        customPackForm.description,
        polygonPoints,
        customPackForm.zoomLevels,
        customPackForm.layerIds
      );

      console.log(`✅ Created custom pack: ${packId}`);
      
      // Reset form and polygon
      setCustomPackForm({
        name: '',
        description: '',
        zoomLevels: [10, 11, 12, 13, 14, 15, 16, 17, 18],
        layerIds: ['openstreetmap']
      });
      clearPolygon();
      setActiveTab('custom');
    } catch (error) {
      console.error('Failed to create custom pack:', error);
      alert('Failed to create custom pack. Please try again.');
    }
  };

  // ==================== NAVIGATION ====================
  const handleNodeNavigation = (nodeId: string) => {
    globalMapPackSystem.navigateToNode(nodeId);
  };

  // (removed unused handleLevelNavigation)

  const handleSearch = (query: string) => {
    setSearchInput(query);
    if (query.trim()) {
      globalMapPackSystem.searchGlobal(query);
    } else {
      globalMapPackSystem.clearSearch();
    }
  };

  const handleSearchResultClick = (result: SearchableLocation) => {
    globalMapPackSystem.navigateToNode(result.id);
    setSearchInput('');
  };

  // ==================== DOWNLOADS ====================
  const handleDownloadNode = async (nodeId: string) => {
    try {
      // First validate the download
      const validation = globalMapPackSystem.validateDownloadLimits(nodeId, 1, 15);
      
      if (!validation.valid) {
        alert(validation.warning);
        return;
      }
      
      if (validation.warning) {
        const proceed = confirm(validation.warning);
        if (!proceed) return;
      }

      await globalMapPackSystem.downloadNode(nodeId);
    } catch (error) {
      console.error('Download failed:', error);
  const msg = (error as any)?.message || String(error);
  alert(`Download failed: ${msg}`);
    }
  };

  const handleDownloadCustomPack = async (packId: string) => {
    try {
      await globalMapPackSystem.downloadCustomPack(packId);
    } catch (error) {
      console.error('Custom pack download failed:', error);
      alert('Custom pack download failed. Please try again.');
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

  const handleDownloadCurrentLevel = async () => {
    if (!navigationState) return;
    
    try {
      const levelName = navigationState.currentLevel === 'world' ? 'World' : 
                       navigationState.breadcrumbs[navigationState.breadcrumbs.length - 1]?.name || navigationState.currentLevel;
      
      // Show zoom level selection dialog
      const zoomSelection = await showZoomLevelDialog(levelName, navigationState.currentLevel);
      if (!zoomSelection) return; // User cancelled
      
  const { minZoom, maxZoom } = zoomSelection;
      
      const nodeId = navigationState.currentLevel === 'world' ? 'world' : navigationState.currentNodeId;
      
      // Validate download first
      const validation = globalMapPackSystem.validateDownloadLimits(nodeId, minZoom, maxZoom);
      
      if (!validation.valid) {
        alert(validation.warning);
        return;
      }
      
      let confirmMessage = `📥 Download ${levelName}?\n\n` +
        `Zoom levels: ${minZoom} - ${maxZoom}\n` +
        `Estimated size: ~${validation.estimatedSizeMB}MB\n` +
        `Estimated tiles: ${validation.estimatedTiles.toLocaleString()}\n\n`;
      
      if (validation.warning) {
        confirmMessage += `⚠️ ${validation.warning}\n\n`;
      }
      
      confirmMessage += `This will download ${navigationState.currentLevel === 'world' ? 'the entire world map' : 
                                `all sub-regions and detailed maps for ${levelName}`}.\n\nContinue?`;
      
      const confirmDownload = confirm(confirmMessage);
      
      if (confirmDownload) {
        await globalMapPackSystem.downloadNode(nodeId, ['openstreetmap'], minZoom, maxZoom);
      }
    } catch (error) {
      console.error('Level download failed:', error);
      alert('Download failed. Please try again.');
    }
  };

  const showZoomLevelDialog = (levelName: string, level: string): Promise<{minZoom: number, maxZoom: number, estimatedSize: number} | null> => {
    return new Promise((resolve) => {
      const suggestions = {
        world: { min: 1, max: 8, size: 0.5 },
        continent: { min: 4, max: 12, size: 2 },
        country: { min: 6, max: 14, size: 1.5 },
        state: { min: 8, max: 16, size: 0.8 },
        city: { min: 10, max: 18, size: 0.3 }
      };
      
      const suggestion = suggestions[level as keyof typeof suggestions] || suggestions.country;
      
      const userInput = prompt(
        `🎯 Download Options for ${levelName}\n\n` +
        `Choose zoom levels (1-18):\n\n` +
        `Recommended for ${level}:\n` +
        `• Min zoom: ${suggestion.min} (overview level)\n` +
        `• Max zoom: ${suggestion.max} (detail level)\n` +
        `• Estimated size: ~${suggestion.size}GB\n\n` +
        `Format: "min,max" (e.g., "${suggestion.min},${suggestion.max}")\n` +
        `Or press Cancel to abort\n\n` +
        `Enter zoom range:`
      );
      
      if (!userInput) {
        resolve(null);
        return;
      }
      
      const parts = userInput.split(',').map(s => parseInt(s.trim()));
      if (parts.length !== 2 || parts.some(isNaN) || parts[0] < 1 || parts[1] > 18 || parts[0] > parts[1]) {
        alert('Invalid format. Please use "min,max" format with valid zoom levels (1-18).');
        resolve(null);
        return;
      }
      
      const [minZoom, maxZoom] = parts;
      const estimatedSize = calculateEstimatedSize(level, minZoom, maxZoom);
      
      resolve({ minZoom, maxZoom, estimatedSize });
    });
  };

  const calculateEstimatedTiles = (level: string, minZoom: number, maxZoom: number): number => {
    const baseMultipliers = {
      world: 100000,
      continent: 20000,
      country: 10000,
      state: 5000,
      city: 2000
    };
    
    const multiplier = baseMultipliers[level as keyof typeof baseMultipliers] || 5000;
    const zoomRange = maxZoom - minZoom + 1;
    return Math.floor(multiplier * Math.pow(2, zoomRange - 3));
  };

  const calculateEstimatedSize = (level: string, minZoom: number, maxZoom: number): number => {
    const tiles = calculateEstimatedTiles(level, minZoom, maxZoom);
    return Math.round((tiles * 15) / 1024 / 1024 * 100) / 100; // ~15KB per tile average
  };

  const handleLoadMoreCities = async () => {
    if (!navigationState) return;
    
    try {
      // In a real implementation, this would load additional cities from an API
      // For now, we'll show a placeholder message
      alert(
        `🏙️ Loading More Cities\n\n` +
        `This feature would load additional cities and metropolitan areas for ${navigationState.breadcrumbs[navigationState.breadcrumbs.length - 1]?.name || 'this region'}.\n\n` +
        `In the full implementation, this would:\n` +
        `• Load cities with 100K+ population\n` +
        `• Include suburban areas and districts\n` +
        `• Add transportation hubs and landmarks\n\n` +
        `Currently showing preloaded major cities only.`
      );
      
      // TODO: Implement actual city loading from external API or expanded dataset
      // await globalMapPackSystem.loadAdditionalCities(navigationState.currentNodeId);
      
    } catch (error) {
      console.error('Failed to load more cities:', error);
      alert('Failed to load additional cities. Please try again.');
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
  const renderBreadcrumbs = () => {
    if (!navigationState?.breadcrumbs.length) return null;

    return (
      <div className="flex items-center space-x-2 mb-4 text-sm">
        {navigationState.breadcrumbs.map((node, index) => (
          <React.Fragment key={node.id}>
            <button
              onClick={() => handleNodeNavigation(node.id)}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              {node.name}
            </button>
            {index < navigationState.breadcrumbs.length - 1 && (
              <span className="text-gray-400">→</span>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderLevelSelector = () => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium">Navigation Level</h4>
        <div className="text-xs text-gray-500">
          Current: {navigationState?.currentLevel} • {navigationState?.children.length || 0} items
        </div>
      </div>
      
      {/* Hierarchy Breadcrumb Style */}
      <div className="flex items-center space-x-2 mb-3 flex-wrap">
        <button
          onClick={() => globalMapPackSystem.navigateToLevel('world')}
          className={`px-3 py-2 rounded text-sm font-medium ${
            navigationState?.currentLevel === 'world'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🌍 World
        </button>
        
  {navigationState?.breadcrumbs.map((crumb) => (
          <React.Fragment key={crumb.id}>
            <span className="text-gray-400">→</span>
            <button
              onClick={() => globalMapPackSystem.navigateToNode(crumb.id)}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              {HIERARCHY_LEVELS.find(l => l.id === crumb.level)?.icon} {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>
      
      {/* Quick Level Navigation */}
      <div className="flex flex-wrap gap-2">
        {HIERARCHY_LEVELS.map(level => {
          const count = globalMapPackSystem.getGlobalNodes().filter(n => n.level === level.id).length;
          return (
            <button
              key={level.id}
              onClick={() => globalMapPackSystem.navigateToLevel(level.id)}
              className={`px-3 py-1 rounded text-sm border flex items-center space-x-1 ${
                navigationState?.currentLevel === level.id
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span>{level.icon}</span>
              <span>{level.name}</span>
              <span className="text-xs opacity-75">({count})</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderSearchBox = () => (
    <div className="mb-4">
      <div className="relative">
        <input
          type="text"
          placeholder="Search locations worldwide..."
          value={searchInput}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 text-sm"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
      
      {navigationState?.isSearching && navigationState.searchResults.length > 0 && (
        <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-lg z-10 relative">
          {navigationState.searchResults.map(result => (
            <button
              key={result.id}
              onClick={() => handleSearchResultClick(result)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-sm">{result.name}</div>
              <div className="text-xs text-gray-500">
                {result.parentPath.join(' → ')} • {result.level}
                {result.isCapital && <span className="ml-1 text-red-500">★</span>}
                {result.population && (
                  <span className="ml-1">• Pop: {(result.population / 1000000).toFixed(1)}M</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderNodeCard = (node: GlobalMapNode) => {
    const downloadProgress = downloads.get(node.id);
    const isDownloading = downloadProgress?.status === 'downloading';
    
    return (
      <div key={node.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-lg">
                {HIERARCHY_LEVELS.find(l => l.id === node.level)?.icon} {node.name}
              </h3>
              {node.isCapital && <span className="text-red-500 text-sm">★ Capital</span>}
              {node.isDownloaded && <span className="text-green-500 text-sm">✓ Downloaded</span>}
            </div>
            
            <p className="text-sm text-gray-600 mt-1">
              Level: {node.level} • {node.estimatedTiles.toLocaleString()} tiles • ~{node.estimatedSizeMB}MB
            </p>
            
            {node.population && (
              <p className="text-sm text-gray-500">
                Population: {(node.population / 1000000).toFixed(1)}M
              </p>
            )}
            
            {node.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {node.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex flex-col space-y-2 ml-4">
            {node.children && node.children.length > 0 && (
              <button
                onClick={() => handleNodeNavigation(node.id)}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                Explore ({node.children.length})
              </button>
            )}
            
            {!node.isDownloaded && (
              <button
                onClick={() => {
                  if (isDownloading || downloadProgress?.status === 'paused') {
                    handleDownloadAction(node.id, downloadProgress?.status || 'downloading');
                  } else {
                    handleDownloadNode(node.id);
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
            {downloadProgress.speed > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Speed: {downloadProgress.speed.toFixed(1)} tiles/sec • 
                ETA: {Math.round(downloadProgress.estimatedTimeRemaining / 60)} min
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCustomPackCard = (pack: CustomMapPack) => {
    const downloadProgress = downloads.get(pack.id);
    const isDownloading = downloadProgress?.status === 'downloading';
    
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
              <p>Zoom: {pack.zoomLevels[0]}-{pack.zoomLevels[pack.zoomLevels.length - 1]}</p>
              <p>Created: {pack.created.toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="flex flex-col space-y-2 ml-4">
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
            { id: 'hierarchy', label: '🌍 Static Hierarchy', icon: '🗺️' },
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

          {/* Static Hierarchy Tab */}
          {activeTab === 'hierarchy' && (
            <div className="h-full overflow-y-auto p-4">
              {renderLevelSelector()}
              {renderSearchBox()}
              {renderBreadcrumbs()}
              
              <div className="space-y-4">
                {navigationState?.isSearching ? (
                  <div>
                    <h3 className="font-semibold text-lg mb-3">
                      Search Results ({navigationState.searchResults.length})
                    </h3>
                    {navigationState.searchResults.length === 0 ? (
                      <p className="text-gray-500">No results found</p>
                    ) : (
                      navigationState.searchResults.slice(0, 20).map(result => {
                        const node = globalMapPackSystem.getGlobalNodes().find(n => n.id === result.id);
                        return node ? renderNodeCard(node) : null;
                      })
                    )}
                  </div>
                ) : (
                  <div>
                    {/* Current Level Header with Download Option */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">
                        {navigationState?.breadcrumbs.length ? 
                          navigationState.breadcrumbs[navigationState.breadcrumbs.length - 1].name : 
                          'World'
                        } ({navigationState?.children.length || 0})
                      </h3>
                      
                      {/* Download Current Level Button */}
                      {navigationState && (
                        <div className="flex items-center space-x-2">
                          {navigationState.currentLevel !== 'section' && (
                            <button
                              onClick={() => handleDownloadCurrentLevel()}
                              className="px-4 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 flex items-center space-x-2"
                            >
                              <span>⬇️</span>
                              <span>Download {navigationState.currentLevel === 'world' ? 'Everything' : 
                                           navigationState.currentLevel === 'continent' ? 'Continent' :
                                           navigationState.currentLevel === 'country' ? 'Country' :
                                           navigationState.currentLevel === 'state' ? 'State/Region' :
                                           'Level'}</span>
                            </button>
                          )}
                          
                          {(navigationState.currentLevel === 'country' || navigationState.currentLevel === 'state') && (
                            <button
                              onClick={() => handleLoadMoreCities()}
                              className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                            >
                              + Load Cities
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {navigationState?.children.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500 mb-4">No child locations available at this level</p>
                        {(navigationState.currentLevel === 'state' || navigationState.currentLevel === 'city') && (
                          <button
                            onClick={() => handleLoadMoreCities()}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            🏙️ Load Cities for {navigationState.breadcrumbs[navigationState.breadcrumbs.length - 1]?.name || 'this area'}
                          </button>
                        )}
                      </div>
                    ) : (
                      navigationState?.children.map(renderNodeCard)
                    )}
                  </div>
                )}
              </div>
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
      </div>
    </div>
  );
};

export default GlobalMapManager;
