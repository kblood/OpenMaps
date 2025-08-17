import React, { useState, useCallback, useRef } from 'react';
import { Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import MapContainer from './components/Map/MapContainer';
import SearchBar from './components/Search/SearchBar';
import RoutePanel from './components/Routing/RoutePanel';
import MapControls from './components/UI/MapControls';
import GlobalMapManager from './components/GlobalMapManager';
import OfflineStatusIndicator from './components/OfflineStatusIndicator';
import { globalMapPackSystem } from './services/globalMapPackSystem';
import { offlineTileCache } from './services/offlineTileCache';
import { MapPackDebugger } from './components/MapPackDebugger';
import ProperHierarchyDemo from './components/ProperHierarchyDemo';
import { useGeolocation } from './hooks/useGeolocation';
import { Location, Marker, Route, SearchResult } from './types';
import { reverseGeocode } from './services/geocoding';
import { DEFAULT_LAYER, getAvailableLayers } from './config/mapLayers';

const DEFAULT_CENTER: Location = { lat: 40.7128, lng: -74.0060 }; // New York City
const DEFAULT_ZOOM = 13;

// Load last map position from localStorage
const getLastMapPosition = (): { center: Location; zoom: number } => {
  try {
    const saved = localStorage.getItem('openmaps_last_position');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        center: parsed.center || DEFAULT_CENTER,
        zoom: parsed.zoom || DEFAULT_ZOOM
      };
    }
  } catch (error) {
    console.warn('Failed to load last map position:', error);
  }
  return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
};

// Save map position to localStorage
const saveMapPosition = (center: Location, zoom: number) => {
  try {
    localStorage.setItem('openmaps_last_position', JSON.stringify({ center, zoom }));
  } catch (error) {
    console.warn('Failed to save map position:', error);
  }
};

// Load last map layer from localStorage
const getLastMapLayer = (): string => {
  try {
    const saved = localStorage.getItem('openmaps_layer');
    return saved || DEFAULT_LAYER;
  } catch (error) {
    console.warn('Failed to load map layer preference:', error);
    return DEFAULT_LAYER;
  }
};

function App() {
  const lastPosition = getLastMapPosition();
  const [mapCenter, setMapCenter] = useState<Location>(lastPosition.center);
  const [zoom, setZoom] = useState(lastPosition.zoom);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [route, setRoute] = useState<Route | null>(null);
  const [showSearch, setShowSearch] = useState(true);
  const [showDirections, setShowDirections] = useState(false);
  const [currentMapLayer, setCurrentMapLayer] = useState(getLastMapLayer());
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [recentMapClick, setRecentMapClick] = useState<{location: Location; name: string} | null>(null);
  const [showMapPacks, setShowMapPacks] = useState(false);
  const [showProperDemo, setShowProperDemo] = useState(false);
  const routePanelMapClickCallbackRef = useRef<((location: Location, name: string) => void) | null>(null);
  const [routeStartMarker, setRouteStartMarker] = useState<{location: Location; name: string} | null>(null);
  const [routeEndMarker, setRouteEndMarker] = useState<{location: Location; name: string} | null>(null);
  const routeMarkerDragHandlerRef = useRef<((isStart: boolean, location: Location, name: string) => void) | null>(null);
  
  // Polygon drawing state
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [showPolygonPreview, setShowPolygonPreview] = useState(false);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [selectedCustomPacks, setSelectedCustomPacks] = useState<Set<string>>(new Set());
  const [customPackPolygons, setCustomPackPolygons] = useState<Map<string, [number, number][]>>(new Map());
  
  // Polygon editing state
  const [editingPolygonId, setEditingPolygonId] = useState<string | null>(null);
  const [editablePolygons, setEditablePolygons] = useState<Map<string, [number, number][]>>(new Map());

  const { location, loading: locating, getCurrentLocation } = useGeolocation();

  const handleMapCenter = useCallback((location: Location, zoomLevel = 15) => {
    console.log('App: handleMapCenter called with:', location, zoomLevel);
    console.log('App: map instance available:', !!map);
    setMapCenter(location);
    setZoom(zoomLevel);
    
    // Save to localStorage
    saveMapPosition(location, zoomLevel);
    
    if (map) {
      console.log('App: Calling map.setView');
      map.setView([location.lat, location.lng], zoomLevel);
    } else {
      console.log('App: Map instance not available yet');
    }
  }, [map]);

  const handleLocationSelect = useCallback((lat: number, lng: number, name: string) => {
    console.log('App: handleLocationSelect called with:', { lat, lng, name });
    const newCenter = { lat, lng };
    handleMapCenter(newCenter, 15);
    
    // Add a marker for the searched location
    const newMarker: Marker = {
      id: `search-${Date.now()}`,
      position: newCenter,
      title: name.split(',')[0],
      description: name
    };
    
    setMarkers(prev => [newMarker, ...prev.filter(m => !m.id.startsWith('search-'))]);

    // If RoutePanel is open, populate the "To" field
    if (showDirections) {
      setRecentMapClick({ location: newCenter, name });
    }

  }, [handleMapCenter, showDirections]);

  const handleMapClick = useCallback(async (location: Location) => {
    try {
      const address = await reverseGeocode(location.lat, location.lng);
      
      // If RoutePanel is waiting for a click, handle it there
      if (routePanelMapClickCallbackRef.current) {
        routePanelMapClickCallbackRef.current(location, address);
        return;
      }
      
      const newMarker: Marker = {
        id: `click-${Date.now()}`,
        position: location,
        title: 'Clicked Location',
        description: address
      };
      
      setMarkers(prev => [newMarker, ...prev.filter(m => !m.id.startsWith('click-')).slice(0, 4)]);
      
      // Update recent map click for RoutePanel clipboard
      setRecentMapClick({ location, name: address });
      
      // If RoutePanel is open, also suggest using this location
      if (showDirections) {
        setRecentMapClick({ location, name: address });
      }
    } catch (error) {
      console.error('Failed to reverse geocode:', error);
      // Fallback to GPS coordinates
      const gpsCoords = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
      
      if (routePanelMapClickCallbackRef.current) {
        routePanelMapClickCallbackRef.current(location, gpsCoords);
        return;
      }
      
      const newMarker: Marker = {
        id: `click-${Date.now()}`,
        position: location,
        title: 'GPS Location',
        description: gpsCoords
      };
      
      setMarkers(prev => [newMarker, ...prev.filter(m => !m.id.startsWith('click-')).slice(0, 4)]);
      setRecentMapClick({ location, name: gpsCoords });
    }
  }, [showDirections]);

  const handleZoomIn = useCallback(() => {
    if (map) {
      map.zoomIn();
    }
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (map) {
      map.zoomOut();
    }
  }, [map]);

  const handleLocateUser = useCallback(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  const handleMapReady = useCallback((mapInstance: LeafletMap) => {
    console.log('App: Map instance ready:', mapInstance);
    setMap(mapInstance);
    
    // Initialize global map pack system and offline tile cache
    Promise.all([
      globalMapPackSystem.initialize(),
      // Also initialize the offline tile cache
      import('./services/offlineTileCache').then(module => module.offlineTileCache.init())
    ]).then(() => {
      console.log('✅ All map systems initialized successfully');
    }).catch(error => {
      console.error('❌ Map system initialization failed:', error);
    });
    
    // Track initial view
    const center = mapInstance.getCenter();
    const zoom = mapInstance.getZoom();
    console.log('🗺️ Initial map view tracked:', { center, zoom });
    
    // Track map movements for visited areas
    mapInstance.on('moveend', () => {
      const newCenter = mapInstance.getCenter();
      const newZoom = mapInstance.getZoom();
      console.log('🗺️ Map view changed:', { center: newCenter, zoom: newZoom });
    });
  }, []);

  // Update map center when user location is found
  React.useEffect(() => {
    if (location && map) {
      setMapCenter(location);
      map.setView([location.lat, location.lng], 15);
      
      const userMarker: Marker = {
        id: 'user-location',
        position: location,
        title: 'Your Location',
        description: 'Current location'
      };
      
      setMarkers(prev => [userMarker, ...prev.filter(m => m.id !== 'user-location')]);
    }
  }, [location, map]);

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showDirections) setShowDirections(false);
  };

  const toggleDirections = () => {
    setShowDirections(!showDirections);
    if (showSearch) setShowSearch(false);
  };

  const handleRouteCalculated = (calculatedRoute: Route | null) => {
    setRoute(calculatedRoute);
  };

  const handleRouteMarkerDrag = useCallback(async (isStart: boolean, location: Location) => {
    try {
      const address = await reverseGeocode(location.lat, location.lng);
      
      // Update local state
      if (isStart) {
        setRouteStartMarker({ location, name: address });
      } else {
        setRouteEndMarker({ location, name: address });
      }
      
      // Notify RoutePanel to update its state and recalculate route
      if (routeMarkerDragHandlerRef.current) {
        routeMarkerDragHandlerRef.current(isStart, location, address);
      }
    } catch (error) {
      console.error('Failed to reverse geocode dragged marker:', error);
      // Fallback to coordinates
      const coordinates = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
      
      if (isStart) {
        setRouteStartMarker({ location, name: coordinates });
      } else {
        setRouteEndMarker({ location, name: coordinates });
      }
      
      if (routeMarkerDragHandlerRef.current) {
        routeMarkerDragHandlerRef.current(isStart, location, coordinates);
      }
    }
  }, []);

  const handleSetRouteMarkers = useCallback((start: {location: Location; name: string} | null, end: {location: Location; name: string} | null) => {
    setRouteStartMarker(start);
    setRouteEndMarker(end);
  }, []);

  const handleSetDestinationFromMap = useCallback((callback: (location: Location, name: string) => void) => {
    routePanelMapClickCallbackRef.current = callback;
  }, []);

  const handleSetRouteMarkerDragHandler = useCallback((handler: (isStart: boolean, location: Location, name: string) => void) => {
    routeMarkerDragHandlerRef.current = handler;
  }, []);

  const closeDirections = () => {
    setShowDirections(false);
    setRoute(null);
  };

  const handleMapLayerChange = useCallback(() => {
    // Cycle through available map layers from map packs
    const availableLayers = getAvailableLayers();
    const layerIds = availableLayers.map(layer => layer.id);
    const currentIndex = layerIds.indexOf(currentMapLayer);
    const nextIndex = (currentIndex + 1) % layerIds.length;
    const nextLayer = layerIds[nextIndex];
    
    setCurrentMapLayer(nextLayer);
    
    // Save to localStorage
    try {
      localStorage.setItem('openmaps_layer', nextLayer);
    } catch (error) {
      console.warn('Failed to save map layer preference:', error);
    }
  }, [currentMapLayer]);

  const handleCreateMapPack = useCallback(async (searchResult: SearchResult) => {
    try {
      console.log('🗺️ Creating map pack for search result:', searchResult);
      
      // Parse coordinates
      const lat = parseFloat(searchResult.lat);
      const lng = parseFloat(searchResult.lon);
      
      // Create bounding box around the search result
      const name = searchResult.display_name.split(',')[0];
      const type = searchResult.type || 'place';
      const displayName = searchResult.display_name;
      
      console.log(`🔍 Search result details:`, {
        name,
        type,
        lat,
        lng,
        boundingbox: searchResult.boundingbox,
        importance: searchResult.importance
      });
      
      let polygon: [number, number][] | null = null;
      
      // Try to get full polygon geometry from WebGIS for more accurate city/area polygons
      if (['city', 'town', 'village', 'administrative', 'municipality', 'county', 'state'].includes(type)) {
        try {
          console.log('🌍 Attempting to get full polygon geometry for enhanced accuracy...');
          const { getFullPolygonForPlace } = await import('./services/webgisService');
          
          // Use enhanced polygon extraction with proper search radius
          const searchRadius = type === 'city' || type === 'town' ? 0.05 : 
                             type === 'village' || type === 'municipality' ? 0.02 : 0.1;
          
          const fullPolygon = await getFullPolygonForPlace(name, { lat, lng }, searchRadius);
          
          if (fullPolygon && fullPolygon.polygon.length > 5) {
            console.log(`✅ Found full polygon geometry for ${name}:`, {
              points: fullPolygon.polygon.length,
              area: fullPolygon.properties?.area,
              adminLevel: fullPolygon.adminLevel,
              source: fullPolygon.source
            });
            
            polygon = fullPolygon.polygon;
            console.log('🗺️ Using WebGIS full polygon geometry - complex boundary extracted');
          } else {
            throw new Error('No suitable polygon geometry found');
          }
        } catch (webgisError) {
          console.log('⚠️ WebGIS polygon extraction failed, falling back to search result bounds:', webgisError);
          // polygon remains null, will be set below
        }
      }
      
      // Use actual bounding box from search result if available and WebGIS failed
      if (!polygon && searchResult.boundingbox && searchResult.boundingbox.length === 4) {
        console.log('📦 Using search result bounding box:', searchResult.boundingbox);
        const [south, north, west, east] = searchResult.boundingbox.map(parseFloat);
        
        // Calculate current bounds size
        const latSize = north - south;
        const lngSize = east - west;
        console.log(`📐 Original bounds size: ${latSize.toFixed(4)}° × ${lngSize.toFixed(4)}°`);
        
        // Apply smart padding based on place type and current size
        let paddingFactor = 0.25; // Default 25% padding
        
        // Adjust padding based on place type
        if (type === 'city' || type === 'town') {
          paddingFactor = 0.3; // Cities need more coverage
        } else if (type === 'village' || type === 'hamlet') {
          paddingFactor = 0.5; // Small places need proportionally more padding
        } else if (type === 'country' || type === 'state') {
          paddingFactor = 0.1; // Large areas need less padding
        }
        
        // Ensure minimum size for very small areas
        const minSize = 0.01; // ~1km minimum
        const adjustedLatSize = Math.max(latSize, minSize);
        const adjustedLngSize = Math.max(lngSize, minSize);
        
        // Apply padding
        const latPadding = adjustedLatSize * paddingFactor;
        const lngPadding = adjustedLngSize * paddingFactor;
        
        // Recalculate center if we expanded the area
        const centerLat = (north + south) / 2;
        const centerLng = (east + west) / 2;
        const halfAdjustedLatSize = adjustedLatSize / 2;
        const halfAdjustedLngSize = adjustedLngSize / 2;
        
        polygon = [
          [centerLat - halfAdjustedLatSize - latPadding, centerLng - halfAdjustedLngSize - lngPadding],  // southwest
          [centerLat - halfAdjustedLatSize - latPadding, centerLng + halfAdjustedLngSize + lngPadding],  // southeast
          [centerLat + halfAdjustedLatSize + latPadding, centerLng + halfAdjustedLngSize + lngPadding],  // northeast
          [centerLat + halfAdjustedLatSize + latPadding, centerLng - halfAdjustedLngSize - lngPadding]   // northwest
        ];
        
        const finalLatSize = (adjustedLatSize + 2 * latPadding);
        const finalLngSize = (adjustedLngSize + 2 * lngPadding);
        console.log(`✅ Enhanced bounding box: ${finalLatSize.toFixed(4)}° × ${finalLngSize.toFixed(4)}° (${paddingFactor * 100}% padding + minimum size)`);
      } else if (!polygon) {
        console.log('📍 No bounding box available, using enhanced fallback sizing based on type');
        
        // Enhanced fallback: Use more realistic sizes based on the type of place
        let boundsSize = 0.015; // default ~1.5km (increased from 1km)
        
        if (type === 'city') {
          boundsSize = 0.08; // ~8km (increased from 5km)
        } else if (type === 'town') {
          boundsSize = 0.04; // ~4km  
        } else if (type === 'county' || type === 'administrative') {
          boundsSize = 0.3; // ~30km (increased from 20km)
        } else if (type === 'state' || type === 'province') {
          boundsSize = 0.5; // ~50km
        } else if (type === 'country') {
          boundsSize = 2.0; // ~200km (increased from 100km)
        } else if (type === 'village') {
          boundsSize = 0.03; // ~3km (increased from 2km)
        } else if (type === 'hamlet') {
          boundsSize = 0.015; // ~1.5km
        } else if (type === 'suburb' || type === 'residential') {
          boundsSize = 0.02; // ~2km (increased from 1km)
        } else if (type === 'neighbourhood') {
          boundsSize = 0.01; // ~1km
        } else if (type === 'municipality') {
          boundsSize = 0.06; // ~6km
        }
        
        // Consider importance factor for additional scaling
        const importance = searchResult.importance || 0.5;
        if (importance > 0.8) {
          boundsSize *= 1.3; // Major places get 30% larger area
        } else if (importance < 0.3) {
          boundsSize *= 0.8; // Minor places get 20% smaller area
        }
        
        // Create polygon as a rectangle around the location
        polygon = [
          [lat - boundsSize, lng - boundsSize], // southwest
          [lat - boundsSize, lng + boundsSize], // southeast
          [lat + boundsSize, lng + boundsSize], // northeast
          [lat + boundsSize, lng - boundsSize]  // northwest
        ];
        
        const areaKm = Math.round(boundsSize * 222); // Rough km conversion
        console.log(`📐 Created enhanced fallback polygon: ${areaKm}×${areaKm}km for ${type} (importance: ${importance.toFixed(2)})`);
      }
      
      // Final safety check
      if (!polygon) {
        console.error('❌ Failed to generate polygon for map pack');
        alert('❌ Failed to generate polygon for map pack. Please try again.');
        return;
      }
      
      // Create appropriate description based on method used
      let description = `Custom map pack for ${displayName}`;
      if (polygon.length > 5) {
        description += ' (using real administrative boundary geometry)';
      } else if (searchResult.boundingbox) {
        description += ' (using enhanced search result bounds with smart padding)';
      } else {
        description += ` (estimated ${type} area with importance scaling)`;
      }
      
      // Create custom pack
      const packId = await globalMapPackSystem.createCustomPack(
        `${name} Map Pack`,
        description,
        polygon,
        [10, 11, 12, 13, 14, 15, 16, 17, 18], // Default zoom levels
        ['openstreetmap'] // Default layers
      );
      
      console.log(`✅ Created map pack: ${packId}`);
      
      // Center map on the location
      if (map) {
        map.setView([lat, lng], 12);
      }
      
      // Open the Global Map Manager to show the new pack
      setShowMapPacks(true);
      
      // Calculate polygon area for user feedback
      const bounds = {
        north: Math.max(...polygon.map(p => p[0])),
        south: Math.min(...polygon.map(p => p[0])),
        east: Math.max(...polygon.map(p => p[1])),
        west: Math.min(...polygon.map(p => p[1]))
      };
      const widthKm = Math.round((bounds.east - bounds.west) * 111 * Math.cos(lat * Math.PI / 180));
      const heightKm = Math.round((bounds.north - bounds.south) * 111);
      
      // Determine generation method for user feedback
      let method = '';
      if (polygon.length > 5) {
        method = 'Real administrative boundary geometry';
      } else if (searchResult.boundingbox) {
        method = 'Enhanced search bounds with smart padding';
      } else {
        method = `Enhanced ${type} area estimation`;
      }
      
      // Show success notification with details
      alert(`✅ Map pack "${name} Map Pack" created successfully!\n\n` +
            `Area: ~${widthKm} × ${heightKm} km\n` +
            `Method: ${method}\n\n` +
            `You can now download it from the Custom Packs tab.`);
      
    } catch (error) {
      console.error('Failed to create map pack:', error);
      alert('❌ Failed to create map pack. Please try again.');
    }
  }, [map]);

  const handleSelectCustomPack = useCallback(async (packId: string, selected: boolean) => {
    try {
      const newSelected = new Set(selectedCustomPacks);
      const newPolygons = new Map(customPackPolygons);
      
      if (selected) {
        newSelected.add(packId);
        
        // Get the custom pack polygon
        const customPacks = globalMapPackSystem.getCustomPacks();
        const pack = customPacks.find(p => p.id === packId);
        if (pack) {
          newPolygons.set(packId, pack.polygon);
          console.log(`🗺️ Added polygon for custom pack: ${pack.name}`);
        }
      } else {
        newSelected.delete(packId);
        newPolygons.delete(packId);
        console.log(`🗺️ Removed polygon for custom pack: ${packId}`);
      }
      
      setSelectedCustomPacks(newSelected);
      setCustomPackPolygons(newPolygons);
    } catch (error) {
      console.error('Failed to handle custom pack selection:', error);
    }
  }, [selectedCustomPacks, customPackPolygons]);

  const handleViewCustomPackOnMap = useCallback(async (packId: string) => {
    try {
      const customPacks = globalMapPackSystem.getCustomPacks();
      const pack = customPacks.find(p => p.id === packId);
      
      if (pack && map) {
        // Center map on the pack's center
        map.setView([pack.center.lat, pack.center.lng], 10);
        
        // Auto-select the pack to show its polygon
        handleSelectCustomPack(packId, true);
        
        console.log(`🗺️ Centered map on custom pack: ${pack.name}`);
      }
    } catch (error) {
      console.error('Failed to view custom pack on map:', error);
    }
  }, [map, handleSelectCustomPack]);

  const handleMapMoveEnd = useCallback((center: Location, zoom: number) => {
    // Save the new position when user manually moves/zooms the map
    saveMapPosition(center, zoom);
    setMapCenter(center);
    setZoom(zoom);
  }, []);

  // Polygon editing handlers
  const handlePolygonEdit = useCallback((polygonId: string, newPolygon: [number, number][]) => {
    console.log(`🔧 Editing polygon ${polygonId}:`, newPolygon);
    
    // If it's a custom pack polygon, update the custom pack
    if (polygonId.startsWith('custom-pack-')) {
      const packIndex = parseInt(polygonId.split('-')[2]);
      const customPacks = globalMapPackSystem.getCustomPacks();
      const pack = customPacks[packIndex];
      
      if (pack) {
        // Update the pack's polygon
        globalMapPackSystem.updateCustomPack(pack.id, {
          name: pack.name,
          description: pack.description,
          polygon: newPolygon,
          zoomLevels: pack.zoomLevels,
          layerIds: pack.layerIds
        }).then(() => {
          console.log(`✅ Updated custom pack polygon: ${pack.name}`);
          // Update local state
          setCustomPackPolygons(prev => {
            const newMap = new Map(prev);
            newMap.set(pack.id, newPolygon);
            return newMap;
          });
        }).catch(error => {
          console.error('Failed to update custom pack polygon:', error);
          alert('Failed to update polygon. Please try again.');
        });
      }
    } else {
      // Update editable polygons map
      setEditablePolygons(prev => {
        const newMap = new Map(prev);
        newMap.set(polygonId, newPolygon);
        return newMap;
      });
    }
  }, []);

  const handleStartPolygonEdit = useCallback((polygonId: string) => {
    console.log(`🎯 Starting to edit polygon: ${polygonId}`);
    setEditingPolygonId(polygonId);
  }, []);

  const handleStopPolygonEdit = useCallback(() => {
    console.log('🛑 Stopping polygon edit');
    setEditingPolygonId(null);
  }, []);

  const handleEditCustomPackPolygon = useCallback((packId: string) => {
    try {
      const customPacks = globalMapPackSystem.getCustomPacks();
      const pack = customPacks.find(p => p.id === packId);
      
      if (pack) {
        // Find the index of this pack in customPackPolygons
        const customPacksArray = globalMapPackSystem.getCustomPacks();
        const packIndex = customPacksArray.findIndex(p => p.id === packId);
        
        if (packIndex !== -1) {
          const polygonId = `custom-pack-${packIndex}`;
          console.log(`🔧 Starting edit for pack: ${pack.name} (${polygonId})`);
          setEditingPolygonId(polygonId);
          
          // Ensure the polygon is visible
          handleSelectCustomPack(packId, true);
          
          // Fit map to show the entire polygon
          if (map && pack.polygon && pack.polygon.length > 0) {
            // Calculate bounds from polygon points
            const latitudes = pack.polygon.map(point => point[0]);
            const longitudes = pack.polygon.map(point => point[1]);
            
            const bounds = L.latLngBounds([
              [Math.min(...latitudes), Math.min(...longitudes)],
              [Math.max(...latitudes), Math.max(...longitudes)]
            ]);
            
            // Fit bounds with padding to ensure all corners are visible
            map.fitBounds(bounds, { padding: [50, 50] });
          }
        }
      }
    } catch (error) {
      console.error('Failed to start editing custom pack polygon:', error);
      alert('Failed to start polygon editing. Please try again.');
    }
  }, [map, handleSelectCustomPack]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapPackDebugger />
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        markers={markers}
        route={route}
        routeStartMarker={routeStartMarker}
        routeEndMarker={routeEndMarker}
        onMapClick={handleMapClick}
        onMapReady={handleMapReady}
        onRouteMarkerDrag={handleRouteMarkerDrag}
        onMapMoveEnd={handleMapMoveEnd}
        currentLayer={currentMapLayer}
        polygonPoints={polygonPoints}
        showPolygonPreview={showPolygonPreview}
        isDrawingPolygon={isDrawingPolygon}
        customPackPolygons={Array.from(customPackPolygons.values())}
        selectedCustomPacks={selectedCustomPacks}
        editingPolygonId={editingPolygonId}
        onPolygonEdit={handlePolygonEdit}
        editablePolygons={editablePolygons}
      />

      {/* Polygon Editing Toolbar */}
      {editingPolygonId && (
        <div className="absolute top-20 left-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 p-4 max-w-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
              <span>🔧</span>
              <span>Editing Polygon</span>
            </h3>
            <button
              onClick={handleStopPolygonEdit}
              className="text-gray-400 hover:text-gray-600 text-xl"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center space-x-2">
              <span className="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0"></span>
              <span>Click and drag points to move them</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-4 h-4 bg-green-500 rounded-full flex-shrink-0"></span>
              <span>Ctrl+click to select multiple points</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-4 h-4 bg-gray-400 rounded-full flex-shrink-0"></span>
              <span>Click gray midpoints to add new points</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-4 h-4 bg-red-500 rounded-full flex-shrink-0"></span>
              <span>Use popup buttons to delete points</span>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={handleStopPolygonEdit}
              className="w-full px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium"
            >
              ✅ Finish Editing
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {showSearch && (
        <div className="absolute top-4 left-4 right-4 z-[1000] md:left-1/2 md:right-auto md:transform md:-translate-x-1/2 md:w-96">
          <SearchBar
            onLocationSelect={handleLocationSelect}
            onMapCenter={handleMapCenter}
            placeholder="Search for places..."
            showMapOptions={true}
            onCreateMapPack={handleCreateMapPack}
          />
        </div>
      )}

      {/* Route Panel */}
      {showDirections && (
        <div className="absolute top-4 left-4 z-[1000] w-full max-w-md md:w-96">
          <RoutePanel
            onRouteCalculated={handleRouteCalculated}
            onClose={closeDirections}
            onMapCenter={handleMapCenter}
            onSetDestinationFromMap={handleSetDestinationFromMap}
            recentMapClick={recentMapClick}
            onSetRouteMarkers={handleSetRouteMarkers}
            onSetRouteMarkerDragHandler={handleSetRouteMarkerDragHandler}
          />
        </div>
      )}

      {/* Map Controls */}
      <div className="absolute bottom-6 right-4 z-[1000]">
        <MapControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onLocateUser={handleLocateUser}
          onToggleDirections={toggleDirections}
          onToggleSearch={toggleSearch}
          onMapLayerChange={handleMapLayerChange}
          showDirections={showDirections}
          showSearch={showSearch}
          isLocating={locating}
          onShowMapPacks={() => setShowMapPacks(true)}
        />
      </div>

      {/* App Title and Status */}
      <div className="absolute top-4 right-4 z-[1000] space-y-2">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
          <h1 className="text-lg font-bold text-gray-900">OpenMaps</h1>
          <p className="text-xs text-gray-600">Open Source Maps</p>
        </div>
        
        <OfflineStatusIndicator />
        
        {/* Administrative Hierarchy Explorer */}
        <button
          onClick={() => setShowProperDemo(!showProperDemo)}
          className="bg-gradient-to-r from-blue-500 to-emerald-600 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-lg text-sm hover:from-blue-600 hover:to-emerald-700 transition-all font-bold"
        >
          {showProperDemo ? '🏛️ Hide Hierarchy Explorer' : '🌍 Administrative Hierarchy'}
        </button>
      </div>

      {/* Global Map Pack Manager */}
      <GlobalMapManager
        isOpen={showMapPacks}
        onClose={() => setShowMapPacks(false)}
        mapInstance={map || undefined}
        polygonPoints={polygonPoints}
        onPolygonPointsChange={setPolygonPoints}
        showPolygonPreview={showPolygonPreview}
        onShowPolygonPreviewChange={setShowPolygonPreview}
        isDrawingPolygon={isDrawingPolygon}
        onIsDrawingPolygonChange={setIsDrawingPolygon}
        onSelectCustomPack={handleSelectCustomPack}
        onViewCustomPackOnMap={handleViewCustomPackOnMap}
        selectedCustomPacks={selectedCustomPacks}
        onEditCustomPackPolygon={handleEditCustomPackPolygon}
        onStopPolygonEdit={handleStopPolygonEdit}
        editingPolygonId={editingPolygonId}
      />

      {/* Administrative Hierarchy Explorer */}
      {showProperDemo && (
        <div className="absolute inset-4 z-[1100] bg-white/95 backdrop-blur-sm rounded-lg shadow-xl overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b bg-gradient-to-r from-blue-500 to-emerald-600 text-white">
            <div>
              <h2 className="text-xl font-bold">🌍 Administrative Hierarchy Explorer</h2>
              <p className="text-sm opacity-90">Dynamic hierarchy detection with fail-fast data validation and real administrative boundaries</p>
            </div>
            <button
              onClick={() => setShowProperDemo(false)}
              className="text-white hover:text-gray-200 text-xl"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ProperHierarchyDemo
              onLocationSelect={(place) => {
                console.log('Proper hierarchy place selected:', place);
                if (place.lat && place.lng) {
                  handleMapCenter({ lat: place.lat, lng: place.lng }, 12);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;