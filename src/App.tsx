import React, { useState, useCallback, useRef } from 'react';
import { Map as LeafletMap } from 'leaflet';
import MapContainer from './components/Map/MapContainer';
import SearchBar from './components/Search/SearchBar';
import RoutePanel from './components/Routing/RoutePanel';
import MapControls from './components/UI/MapControls';
import GlobalMapManager from './components/GlobalMapManager';
import { globalMapPackSystem } from './services/globalMapPackSystem';
import { MapPackDebugger } from './components/MapPackDebugger';
import { useGeolocation } from './hooks/useGeolocation';
import { Location, Marker, Route } from './types';
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
  const routePanelMapClickCallbackRef = useRef<((location: Location, name: string) => void) | null>(null);
  const [routeStartMarker, setRouteStartMarker] = useState<{location: Location; name: string} | null>(null);
  const [routeEndMarker, setRouteEndMarker] = useState<{location: Location; name: string} | null>(null);
  const routeMarkerDragHandlerRef = useRef<((isStart: boolean, location: Location, name: string) => void) | null>(null);
  
  // Polygon drawing state
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [showPolygonPreview, setShowPolygonPreview] = useState(false);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);

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
    
    // Initialize global map pack system
    globalMapPackSystem.initialize().catch(console.error);
    
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

  const handleMapMoveEnd = useCallback((center: Location, zoom: number) => {
    // Save the new position when user manually moves/zooms the map
    saveMapPosition(center, zoom);
    setMapCenter(center);
    setZoom(zoom);
  }, []);

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
      />

      {/* Search Bar */}
      {showSearch && (
        <div className="absolute top-4 left-4 right-4 z-[1000] md:left-1/2 md:right-auto md:transform md:-translate-x-1/2 md:w-96">
          <SearchBar
            onLocationSelect={handleLocationSelect}
            onMapCenter={handleMapCenter}
            placeholder="Search for places..."
            showMapOptions={true}
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

      {/* App Title */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
        <h1 className="text-lg font-bold text-gray-900">OpenMaps</h1>
        <p className="text-xs text-gray-600">Open Source Maps</p>
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
      />
    </div>
  );
}

export default App;