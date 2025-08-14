import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navigation, MapPin, Clock, Map, X, ArrowUpDown, MapPin as CurrentLocation, Car, User, Bike, Footprints, Star, History, Settings, BarChart3, MousePointer, Copy } from 'lucide-react';
import { Location, Route } from '../../types';
import { getRoute, getRouteAlternatives, formatDistance, formatDuration, calculateRouteMetrics } from '../../services/routing';
import SearchBar from '../Search/SearchBar';

export type RouteMode = 'driving' | 'walking' | 'cycling' | 'running';
export type RoutePreference = 'fastest' | 'shortest' | 'balanced';

export interface RouteOptions {
  avoidHighways: boolean;
  avoidTolls: boolean;
  avoidFerries: boolean;
}

export interface SavedRoute {
  id: string;
  name: string;
  start: Location;
  end: Location;
  startName: string;
  endName: string;
  mode: RouteMode;
  distance: number;
  duration: number;
  createdAt: Date;
}

export interface ClipboardLocation {
  location: Location;
  name: string;
  timestamp: Date;
}

interface RoutePanelProps {
  onRouteCalculated: (route: Route | null) => void;
  onClose: () => void;
  onMapCenter?: (location: Location, zoom?: number) => void;
  onSetDestinationFromMap?: (callback: (location: Location, name: string) => void) => void;
  recentMapClick?: { location: Location; name: string } | null;
  onSetRouteMarkers?: (start: {location: Location; name: string} | null, end: {location: Location; name: string} | null) => void;
}

const RoutePanel: React.FC<RoutePanelProps> = ({ onRouteCalculated, onClose, onMapCenter, onSetDestinationFromMap, recentMapClick, onSetRouteMarkers }) => {
  const [startLocation, setStartLocation] = useState<Location | null>(null);
  const [endLocation, setEndLocation] = useState<Location | null>(null);
  const [startName, setStartName] = useState('');
  const [endName, setEndName] = useState('');
  const [route, setRoute] = useState<Route | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<Route[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeMode, setRouteMode] = useState<RouteMode>('driving');
  const [routePreference, setRoutePreference] = useState<RoutePreference>('fastest');
  const [routeOptions, setRouteOptions] = useState<RouteOptions>({
    avoidHighways: false,
    avoidTolls: false,
    avoidFerries: false
  });
  const [showOptions, setShowOptions] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [routeHistory, setRouteHistory] = useState<SavedRoute[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardLocation[]>([]);
  const [isSelectingStart, setIsSelectingStart] = useState(false);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);
  
  // Load saved data on component mount
  useEffect(() => {
    const saved = localStorage.getItem('openmap_saved_routes');
    const history = localStorage.getItem('openmap_route_history');
    const clipboardData = localStorage.getItem('openmap_location_clipboard');
    if (saved) setSavedRoutes(JSON.parse(saved));
    if (history) setRouteHistory(JSON.parse(history));
    if (clipboardData) setClipboard(JSON.parse(clipboardData));
  }, []);

  // Handle recent map clicks
  useEffect(() => {
    if (recentMapClick) {
      addToClipboard(recentMapClick.location, recentMapClick.name);
    }
  }, [recentMapClick]);

  // Create stable callback refs
  const startLocationRef = useRef(startLocation);
  const endLocationRef = useRef(endLocation);
  const calculateRouteIfReadyRef = useRef<((start: Location | null, end: Location | null) => void) | null>(null);
  
  useEffect(() => {
    startLocationRef.current = startLocation;
    endLocationRef.current = endLocation;
  }, [startLocation, endLocation]);

  // Stable callback for map destination selection
  const mapClickHandler = useCallback((location: Location, name: string) => {
    if (isSelectingStart) {
      setStartLocation(location);
      setStartName(name);
      setIsSelectingStart(false);
      addToClipboard(location, name);
      if (onSetRouteMarkers) {
        onSetRouteMarkers({ location, name }, endLocationRef.current && endName ? { location: endLocationRef.current, name: endName } : null);
      }
      if (calculateRouteIfReadyRef.current) {
        calculateRouteIfReadyRef.current(location, endLocationRef.current);
      }
    } else if (isSelectingEnd) {
      setEndLocation(location);
      setEndName(name);
      setIsSelectingEnd(false);
      addToClipboard(location, name);
      if (onSetRouteMarkers) {
        onSetRouteMarkers(startLocationRef.current && startName ? { location: startLocationRef.current, name: startName } : null, { location, name });
      }
      if (calculateRouteIfReadyRef.current) {
        calculateRouteIfReadyRef.current(startLocationRef.current, location);
      }
    }
  }, [isSelectingStart, isSelectingEnd, endName, startName, onSetRouteMarkers, addToClipboard]);

  // Set up map click destination selection
  useEffect(() => {
    if (onSetDestinationFromMap) {
      onSetDestinationFromMap(mapClickHandler);
    }
  }, [onSetDestinationFromMap, mapClickHandler]);

  const addToClipboard = useCallback((location: Location, name: string) => {
    const clipboardItem: ClipboardLocation = {
      location,
      name,
      timestamp: new Date()
    };
    
    setClipboard(prevClipboard => {
      const newClipboard = [clipboardItem, ...prevClipboard.filter(item => 
        Math.abs(item.location.lat - location.lat) > 0.0001 || 
        Math.abs(item.location.lng - location.lng) > 0.0001
      ).slice(0, 9)];
      
      localStorage.setItem('openmap_location_clipboard', JSON.stringify(newClipboard));
      return newClipboard;
    });
  }, []);

  const selectFromClipboard = useCallback((clipboardItem: ClipboardLocation, isStart: boolean) => {
    if (isStart) {
      setStartLocation(clipboardItem.location);
      setStartName(clipboardItem.name);
      addToClipboard(clipboardItem.location, clipboardItem.name);
      if (onSetRouteMarkers) {
        onSetRouteMarkers({ location: clipboardItem.location, name: clipboardItem.name }, endLocationRef.current && endName ? { location: endLocationRef.current, name: endName } : null);
      }
      if (calculateRouteIfReadyRef.current) {
        calculateRouteIfReadyRef.current(clipboardItem.location, endLocationRef.current);
      }
    } else {
      setEndLocation(clipboardItem.location);
      setEndName(clipboardItem.name);
      addToClipboard(clipboardItem.location, clipboardItem.name);
      if (onSetRouteMarkers) {
        onSetRouteMarkers(startLocationRef.current && startName ? { location: startLocationRef.current, name: startName } : null, { location: clipboardItem.location, name: clipboardItem.name });
      }
      if (calculateRouteIfReadyRef.current) {
        calculateRouteIfReadyRef.current(startLocationRef.current, clipboardItem.location);
      }
    }
  }, [endName, startName, onSetRouteMarkers, addToClipboard]);

  const handleStartLocationSelect = (lat: number, lng: number, name: string) => {
    const location = { lat, lng };
    setStartLocation(location);
    setStartName(name);
    addToClipboard(location, name);
    if (calculateRouteIfReadyRef.current) {
      calculateRouteIfReadyRef.current(location, endLocation);
    }
    
    // Update route markers
    if (onSetRouteMarkers) {
      onSetRouteMarkers({ location, name }, endLocation && endName ? { location: endLocation, name: endName } : null);
    }
    
    // Center map on selected location
    if (onMapCenter) {
      onMapCenter(location, 15);
    }
  };

  const handleEndLocationSelect = (lat: number, lng: number, name: string) => {
    const location = { lat, lng };
    setEndLocation(location);
    setEndName(name);
    addToClipboard(location, name);
    if (calculateRouteIfReadyRef.current) {
      calculateRouteIfReadyRef.current(startLocation, location);
    }
    
    // Update route markers
    if (onSetRouteMarkers) {
      onSetRouteMarkers(startLocation && startName ? { location: startLocation, name: startName } : null, { location, name });
    }
    
    // Center map on selected location
    if (onMapCenter) {
      onMapCenter(location, 15);
    }
  };

  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setStartLocation(location);
          setStartName('Current Location');
          addToClipboard(location, 'Current Location');
          if (onSetRouteMarkers) {
            onSetRouteMarkers({ location, name: 'Current Location' }, endLocationRef.current && endName ? { location: endLocationRef.current, name: endName } : null);
          }
          if (calculateRouteIfReadyRef.current) {
            calculateRouteIfReadyRef.current(location, endLocationRef.current);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Unable to get current location');
        }
      );
    }
  }, [endName, onSetRouteMarkers, addToClipboard]);

  const swapLocations = () => {
    const tempLocation = startLocation;
    const tempName = startName;
    setStartLocation(endLocation);
    setStartName(endName);
    setEndLocation(tempLocation);
    setEndName(tempName);
    if (tempLocation && endLocation) {
      if (calculateRouteIfReadyRef.current) {
        calculateRouteIfReadyRef.current(endLocation, tempLocation);
      }
    }
  };

  const calculateRouteIfReady = useCallback(async (start: Location | null, end: Location | null) => {
    if (!start || !end) return;

    setIsCalculating(true);
    try {
      // Get main route and alternatives
      const [mainRoute, alternatives] = await Promise.all([
        getRoute(start, end, routeMode, routePreference, routeOptions),
        getRouteAlternatives(start, end, routeMode, routeOptions)
      ]);
      
      setRoute(mainRoute);
      setAlternativeRoutes(alternatives.slice(1) || []); // Exclude main route
      setSelectedRouteIndex(0);
      onRouteCalculated(mainRoute);
      
      // Save to history
      if (mainRoute) {
        const currentStartName = startLocationRef.current === start ? startName : 'Unknown';
        const currentEndName = endLocationRef.current === end ? endName : 'Unknown';
        saveToHistory(start, end, currentStartName, currentEndName, mainRoute);
      }
    } catch (error) {
      console.error('Route calculation failed:', error);
    } finally {
      setIsCalculating(false);
    }
  }, [routeMode, routePreference, routeOptions, onRouteCalculated, startName, endName]);

  // Update the ref when calculateRouteIfReady changes
  useEffect(() => {
    calculateRouteIfReadyRef.current = calculateRouteIfReady;
  }, [calculateRouteIfReady]);

  const saveToHistory = useCallback((start: Location, end: Location, startName: string, endName: string, route: Route) => {
    const historyItem: SavedRoute = {
      id: Date.now().toString(),
      name: `${startName} → ${endName}`,
      start,
      end,
      startName,
      endName,
      mode: routeMode,
      distance: route.legs.reduce((sum, leg) => sum + leg.distance, 0),
      duration: route.legs.reduce((sum, leg) => sum + leg.duration, 0),
      createdAt: new Date()
    };
    
    setRouteHistory(prevHistory => {
      const newHistory = [historyItem, ...prevHistory.slice(0, 19)]; // Keep last 20
      localStorage.setItem('openmap_route_history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, [routeMode]);

  const saveRoute = () => {
    if (!route || !startLocation || !endLocation) return;
    
    const routeName = prompt('Enter a name for this route:', `${startName} → ${endName}`);
    if (!routeName) return;
    
    const savedRoute: SavedRoute = {
      id: Date.now().toString(),
      name: routeName,
      start: startLocation,
      end: endLocation,
      startName,
      endName,
      mode: routeMode,
      distance: route.legs.reduce((sum, leg) => sum + leg.distance, 0),
      duration: route.legs.reduce((sum, leg) => sum + leg.duration, 0),
      createdAt: new Date()
    };
    
    const newSaved = [savedRoute, ...savedRoutes];
    setSavedRoutes(newSaved);
    localStorage.setItem('openmap_saved_routes', JSON.stringify(newSaved));
  };

  const loadSavedRoute = (savedRoute: SavedRoute) => {
    setStartLocation(savedRoute.start);
    setEndLocation(savedRoute.end);
    setStartName(savedRoute.startName);
    setEndName(savedRoute.endName);
    setRouteMode(savedRoute.mode);
    if (calculateRouteIfReadyRef.current) {
      calculateRouteIfReadyRef.current(savedRoute.start, savedRoute.end);
    }
    setShowHistory(false);
  };

  const clearRoute = () => {
    setStartLocation(null);
    setEndLocation(null);
    setStartName('');
    setEndName('');
    setRoute(null);
    onRouteCalculated(null);
    
    // Clear route markers
    if (onSetRouteMarkers) {
      onSetRouteMarkers(null, null);
    }
  };

  const routeModeIcons = {
    driving: Car,
    walking: User,
    cycling: Bike,
    running: Footprints
  };

  const routeModeLabels = {
    driving: 'Drive',
    walking: 'Walk', 
    cycling: 'Bike',
    running: 'Run'
  };

  return (
    <div className="bg-white shadow-xl rounded-lg p-4 w-full max-w-md max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Navigation className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Directions</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-1 rounded ${showHistory ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            title="Route History"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowOptions(!showOptions)}
            className={`p-1 rounded ${showOptions ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            title="Route Options"
          >
            <Settings className="h-4 w-4" />
          </button>
          {route && (
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`p-1 rounded ${showAnalytics ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              title="Route Analytics"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Route Mode Selection */}
      <div className="mb-4">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {(Object.keys(routeModeIcons) as RouteMode[]).map((mode) => {
            const Icon = routeModeIcons[mode];
            return (
              <button
                key={mode}
                onClick={() => {
                  setRouteMode(mode);
                  if (startLocation && endLocation) {
                    calculateRouteIfReady(startLocation, endLocation);
                  }
                }}
                className={`flex-1 flex items-center justify-center py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                  routeMode === mode
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4 mr-1" />
                {routeModeLabels[mode]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Route Options */}
      {showOptions && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Route Preferences</h3>
          <div className="space-y-2">
            <div className="flex space-x-2">
              {(['fastest', 'shortest', 'balanced'] as RoutePreference[]).map((pref) => (
                <button
                  key={pref}
                  onClick={() => {
                    setRoutePreference(pref);
                    if (startLocation && endLocation) {
                      if (calculateRouteIfReadyRef.current) {
                        calculateRouteIfReadyRef.current(startLocation, endLocation);
                      }
                    }
                  }}
                  className={`px-3 py-1 text-xs rounded-full capitalize ${
                    routePreference === pref
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {pref}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={routeOptions.avoidHighways}
                  onChange={(e) => {
                    setRouteOptions(prev => ({ ...prev, avoidHighways: e.target.checked }));
                    if (startLocation && endLocation) {
                      if (calculateRouteIfReadyRef.current) {
                        calculateRouteIfReadyRef.current(startLocation, endLocation);
                      }
                    }
                  }}
                  className="mr-2"
                />
                <span className="text-xs text-gray-600">Avoid highways</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={routeOptions.avoidTolls}
                  onChange={(e) => {
                    setRouteOptions(prev => ({ ...prev, avoidTolls: e.target.checked }));
                    if (startLocation && endLocation) {
                      if (calculateRouteIfReadyRef.current) {
                        calculateRouteIfReadyRef.current(startLocation, endLocation);
                      }
                    }
                  }}
                  className="mr-2"
                />
                <span className="text-xs text-gray-600">Avoid tolls</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Route History */}
      {showHistory && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg max-h-48 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Recent Routes</h3>
          {routeHistory.length === 0 ? (
            <p className="text-xs text-gray-500">No recent routes</p>
          ) : (
            <div className="space-y-1">
              {routeHistory.slice(0, 5).map((savedRoute) => (
                <button
                  key={savedRoute.id}
                  onClick={() => loadSavedRoute(savedRoute)}
                  className="w-full text-left p-2 hover:bg-gray-200 rounded text-xs"
                >
                  <div className="font-medium truncate">{savedRoute.name}</div>
                  <div className="text-gray-500">
                    {formatDistance(savedRoute.distance)} • {formatDuration(savedRoute.duration)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {/* From Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From
          </label>
          <div className="flex space-x-2">
            <SearchBar
              onLocationSelect={handleStartLocationSelect}
              placeholder="Choose starting point"
              className="flex-1"
              onMapCenter={onMapCenter}
              showMapOptions={true}
              clipboard={clipboard}
              onClipboardSelect={(item) => selectFromClipboard(item, true)}
            />
            <button
              onClick={getCurrentLocation}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              title="Use current location"
            >
              <CurrentLocation className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsSelectingStart(!isSelectingStart)}
              className={`px-3 py-2 rounded-lg flex items-center ${
                isSelectingStart 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title="Click on map to select"
            >
              <MousePointer className="h-4 w-4" />
            </button>
          </div>
          {startName && (
            <p className="mt-1 text-xs text-gray-600 truncate">{startName}</p>
          )}
          {isSelectingStart && (
            <p className="mt-1 text-xs text-orange-600 animate-pulse">
              Click on the map to set starting point
            </p>
          )}
        </div>

        {/* Swap Button */}
        {(startLocation || endLocation) && (
          <div className="flex justify-center">
            <button
              onClick={swapLocations}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
              title="Swap locations"
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* To Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To
          </label>
          <div className="flex space-x-2">
            <SearchBar
              onLocationSelect={handleEndLocationSelect}
              placeholder="Choose destination"
              className="flex-1"
              onMapCenter={onMapCenter}
              showMapOptions={true}
              clipboard={clipboard}
              onClipboardSelect={(item) => selectFromClipboard(item, false)}
            />
            <button
              onClick={() => setIsSelectingEnd(!isSelectingEnd)}
              className={`px-3 py-2 rounded-lg flex items-center ${
                isSelectingEnd 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title="Click on map to select"
            >
              <MousePointer className="h-4 w-4" />
            </button>
          </div>
          {endName && (
            <p className="mt-1 text-xs text-gray-600 truncate">{endName}</p>
          )}
          {isSelectingEnd && (
            <p className="mt-1 text-xs text-orange-600 animate-pulse">
              Click on the map to set destination
            </p>
          )}
        </div>

        {isCalculating && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Calculating route...</p>
          </div>
        )}

        {/* Route Alternatives */}
        {(route || alternativeRoutes.length > 0) && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <Map className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="font-semibold text-gray-900">Routes</h3>
              </div>
              {route && (
                <button
                  onClick={saveRoute}
                  className="p-1 text-gray-400 hover:text-yellow-600"
                  title="Save route"
                >
                  <Star className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Route Options Tabs */}
            {alternativeRoutes.length > 0 && (
              <div className="flex space-x-1 mb-3">
                {[route, ...alternativeRoutes].filter(Boolean).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedRouteIndex(index);
                      const selectedRoute = index === 0 ? route : alternativeRoutes[index - 1];
                      onRouteCalculated(selectedRoute);
                    }}
                    className={`px-3 py-1 text-xs rounded ${
                      selectedRouteIndex === index
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Route {index + 1}
                  </button>
                ))}
              </div>
            )}
            
            {route && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-xs text-gray-500">Distance</p>
                    <p className="font-semibold">
                      {formatDistance(route.legs.reduce((sum, leg) => sum + leg.distance, 0))}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Clock className="h-4 w-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-xs text-gray-500">Duration</p>
                    <p className="font-semibold">
                      {formatDuration(route.legs.reduce((sum, leg) => sum + leg.duration, 0))}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Route Analytics */}
            {showAnalytics && route && (
              <div className="mb-4 p-3 bg-white rounded border">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Analytics</h4>
                {(() => {
                  const metrics = calculateRouteMetrics(route);
                  return (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500">Avg Speed:</span>
                        <span className="ml-1 font-medium">{metrics.avgSpeedKmh} km/h</span>
                      </div>
                      {routeMode === 'driving' && (
                        <>
                          <div>
                            <span className="text-gray-500">Fuel Cost:</span>
                            <span className="ml-1 font-medium">${metrics.estimatedFuelCost.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">CO₂:</span>
                            <span className="ml-1 font-medium">{metrics.co2Emissions.toFixed(1)} kg</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {route?.legs[0]?.steps && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Turn-by-turn</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {route.legs[0].steps.slice(0, 5).map((step, index) => (
                    <div key={index} className="text-sm">
                      <p className="text-gray-700">{step.instruction}</p>
                      <p className="text-xs text-gray-500">
                        {formatDistance(step.distance)} • {formatDuration(step.duration)}
                      </p>
                    </div>
                  ))}
                  {route.legs[0].steps.length > 5 && (
                    <p className="text-xs text-gray-500">
                      ... and {route.legs[0].steps.length - 5} more steps
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {(startLocation || endLocation || route) && (
          <button
            onClick={clearRoute}
            className="w-full py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Clear Route
          </button>
        )}

        {/* Location Clipboard */}
        {clipboard.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-900 flex items-center">
                <Copy className="h-4 w-4 mr-1" />
                Recent Locations
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-20 overflow-y-auto">
              {clipboard.slice(0, 4).map((item, index) => (
                <div key={index} className="flex space-x-1">
                  <button
                    onClick={() => selectFromClipboard(item, true)}
                    className="flex-1 text-left p-2 hover:bg-blue-50 rounded text-xs border border-blue-200 bg-blue-50/50"
                    title="Use as start"
                  >
                    <div className="font-medium truncate text-blue-700">{item.name.split(',')[0]}</div>
                  </button>
                  <button
                    onClick={() => selectFromClipboard(item, false)}
                    className="flex-1 text-left p-2 hover:bg-green-50 rounded text-xs border border-green-200 bg-green-50/50"
                    title="Use as destination"
                  >
                    <div className="font-medium truncate text-green-700">{item.name.split(',')[0]}</div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Saved Routes */}
        {savedRoutes.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Saved Routes</h3>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {savedRoutes.slice(0, 3).map((savedRoute) => (
                <button
                  key={savedRoute.id}
                  onClick={() => loadSavedRoute(savedRoute)}
                  className="w-full text-left p-2 hover:bg-gray-100 rounded text-xs border"
                >
                  <div className="font-medium truncate">{savedRoute.name}</div>
                  <div className="text-gray-500">
                    {formatDistance(savedRoute.distance)} • {formatDuration(savedRoute.duration)}
                  </div>
                </button>
              ))}
              {savedRoutes.length > 3 && (
                <p className="text-xs text-gray-500 text-center">
                  +{savedRoutes.length - 3} more saved routes
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoutePanel;