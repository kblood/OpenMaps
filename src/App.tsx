import React, { useState, useCallback, useRef } from 'react';
import { Map as LeafletMap } from 'leaflet';
import MapContainer from './components/Map/MapContainer';
import SearchBar from './components/Search/SearchBar';
import RoutePanel from './components/Routing/RoutePanel';
import MapControls from './components/UI/MapControls';
import { useGeolocation } from './hooks/useGeolocation';
import { Location, Marker, Route } from './types';
import { reverseGeocode } from './services/geocoding';

const DEFAULT_CENTER: Location = { lat: 40.7128, lng: -74.0060 }; // New York City
const DEFAULT_ZOOM = 13;

function App() {
  const [mapCenter, setMapCenter] = useState<Location>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [route, setRoute] = useState<Route | null>(null);
  const [showSearch, setShowSearch] = useState(true);
  const [showDirections, setShowDirections] = useState(false);
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [recentMapClick, setRecentMapClick] = useState<{location: Location; name: string} | null>(null);
  const routePanelMapClickCallbackRef = useRef<((location: Location, name: string) => void) | null>(null);
  const [routeStartMarker, setRouteStartMarker] = useState<{location: Location; name: string} | null>(null);
  const [routeEndMarker, setRouteEndMarker] = useState<{location: Location; name: string} | null>(null);

  const { location, loading: locating, getCurrentLocation } = useGeolocation();

  const handleMapCenter = useCallback((location: Location, zoomLevel = 15) => {
    setMapCenter(location);
    setZoom(zoomLevel);
    if (map) {
      map.setView([location.lat, location.lng], zoomLevel);
    }
  }, [map]);

  const handleLocationSelect = useCallback((lat: number, lng: number, name: string) => {
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
    setMap(mapInstance);
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
      if (isStart) {
        setRouteStartMarker({ location, name: address });
      } else {
        setRouteEndMarker({ location, name: address });
      }
      // Trigger route recalculation in RoutePanel would need additional callback
    } catch (error) {
      console.error('Failed to reverse geocode dragged marker:', error);
    }
  }, []);

  const handleSetRouteMarkers = useCallback((start: {location: Location; name: string} | null, end: {location: Location; name: string} | null) => {
    setRouteStartMarker(start);
    setRouteEndMarker(end);
  }, []);

  const handleSetDestinationFromMap = useCallback((callback: (location: Location, name: string) => void) => {
    routePanelMapClickCallbackRef.current = callback;
  }, []);

  const closeDirections = () => {
    setShowDirections(false);
    setRoute(null);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
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
          showDirections={showDirections}
          showSearch={showSearch}
          isLocating={locating}
        />
      </div>

      {/* App Title */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
        <h1 className="text-lg font-bold text-gray-900">OpenMaps</h1>
        <p className="text-xs text-gray-600">Open Source Maps</p>
      </div>
    </div>
  );
}

export default App;