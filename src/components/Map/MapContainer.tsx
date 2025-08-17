import React, { useEffect, useRef } from 'react';
import { MapContainer, Marker, Popup, useMapEvents, Polyline, Polygon, CircleMarker } from 'react-leaflet';
import { LatLngExpression, Map as LeafletMap } from 'leaflet';
import { Location, Marker as MarkerType, Route } from '../../types';
import { getMapLayer } from '../../config/mapLayers';
import { OfflineTileLayer } from '../../services/offlineTileLayer';
import PolygonEditor from '../PolygonEditor';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
import L from 'leaflet';

let DefaultIcon = L.divIcon({
  html: `<svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 0C5.59644 0 0 5.59644 0 12.5C0 19.4036 12.5 41 12.5 41C12.5 41 25 19.4036 25 12.5C25 5.59644 19.4036 0 12.5 0ZM12.5 17C10.0147 17 8 14.9853 8 12.5C8 10.0147 10.0147 8 12.5 8C14.9853 8 17 10.0147 17 12.5C17 14.9853 14.9853 17 12.5 17Z" fill="#3B82F6"/>
  </svg>`,
  className: 'custom-div-icon',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

let StartIcon = L.divIcon({
  html: `<svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 0C5.59644 0 0 5.59644 0 12.5C0 19.4036 12.5 41 12.5 41C12.5 41 25 19.4036 25 12.5C25 5.59644 19.4036 0 12.5 0ZM12.5 17C10.0147 17 8 14.9853 8 12.5C8 10.0147 10.0147 8 12.5 8C14.9853 8 17 10.0147 17 12.5C17 14.9853 14.9853 17 12.5 17Z" fill="#10B981"/>
  </svg>`,
  className: 'custom-div-icon start-marker',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

let EndIcon = L.divIcon({
  html: `<svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.5 0C5.59644 0 0 5.59644 0 12.5C0 19.4036 12.5 41 12.5 41C12.5 41 25 19.4036 25 12.5C25 5.59644 19.4036 0 12.5 0ZM12.5 17C10.0147 17 8 14.9853 8 12.5C8 10.0147 10.0147 8 12.5 8C14.9853 8 17 10.0147 17 12.5C17 14.9853 14.9853 17 12.5 17Z" fill="#EF4444"/>
  </svg>`,
  className: 'custom-div-icon end-marker',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  center: Location;
  zoom: number;
  markers: MarkerType[];
  route: Route | null;
  routeStartMarker?: { location: Location; name: string } | null;
  routeEndMarker?: { location: Location; name: string } | null;
  onMapClick: (location: Location) => void;
  onMapReady: (map: LeafletMap) => void;
  onRouteMarkerDrag?: (isStart: boolean, location: Location) => void;
  onContextMenu?: (location: Location) => void;
  onMapMoveEnd?: (center: Location, zoom: number) => void;
  currentLayer: string;
  polygonPoints?: [number, number][];
  showPolygonPreview?: boolean;
  isDrawingPolygon?: boolean;
  customPackPolygons?: [number, number][][];
  selectedCustomPacks?: Set<string>;
  editingPolygonId?: string | null;
  onPolygonEdit?: (polygonId: string, newPolygon: [number, number][]) => void;
  editablePolygons?: Map<string, [number, number][]>;
}

function MapEventHandler({ onMapClick, onContextMenu, onMapMoveEnd, isDrawingPolygon }: { 
  onMapClick: (location: Location) => void; 
  onContextMenu?: (location: Location) => void;
  onMapMoveEnd?: (center: Location, zoom: number) => void;
  isDrawingPolygon?: boolean;
}) {
  useMapEvents({
    click: (e) => {
      // Don't handle regular map clicks when drawing polygons
      if (!isDrawingPolygon) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
    contextmenu: (e) => {
      if (onContextMenu) {
        onContextMenu({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
    moveend: (e) => {
      if (onMapMoveEnd) {
        const map = e.target;
        const center = map.getCenter();
        const zoom = map.getZoom();
        onMapMoveEnd({ lat: center.lat, lng: center.lng }, zoom);
      }
    }
  });
  return null;
}

function MapReadyHandler({ onMapReady }: { onMapReady: (map: LeafletMap) => void }) {
  const map = useMapEvents({});
  
  useEffect(() => {
    if (map) {
      onMapReady(map);
    }
  }, [map, onMapReady]);
  
  return null;
}

function OfflineTileLayerComponent({ currentLayer }: { currentLayer: string }) {
  const map = useMapEvents({});
  const tileLayerRef = useRef<OfflineTileLayer | null>(null);
  
  useEffect(() => {
    if (!map) return;
    
    // Remove existing tile layer
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    
    // Get layer configuration
    const tileLayerConfig = getMapLayer(currentLayer);
    
    // Create and add offline tile layer
    const offlineTileLayer = new OfflineTileLayer(tileLayerConfig.url, {
      attribution: tileLayerConfig.attribution,
      maxZoom: tileLayerConfig.maxZoom,
    });
    
    offlineTileLayer.addTo(map);
    tileLayerRef.current = offlineTileLayer;
    
    console.log(`🗺️ Added offline tile layer: ${currentLayer}`);
    
    // Cleanup function
    return () => {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
    };
  }, [map, currentLayer]);
  
  return null;
}

function MapCenterHandler({ center, zoom }: { center: Location; zoom: number }) {
  const map = useMapEvents({});
  
  useEffect(() => {
    if (map) {
      map.setView([center.lat, center.lng], zoom);
    }
  }, [map, center.lat, center.lng, zoom]);
  
  return null;
}

const MapComponent: React.FC<MapProps> = ({
  center,
  zoom,
  markers,
  route,
  routeStartMarker,
  routeEndMarker,
  onMapClick,
  onMapReady,
  onRouteMarkerDrag,
  onContextMenu,
  onMapMoveEnd,
  currentLayer,
  polygonPoints = [],
  showPolygonPreview = false,
  isDrawingPolygon = false,
  customPackPolygons = [],
  selectedCustomPacks = new Set(),
  editingPolygonId = null,
  onPolygonEdit,
  editablePolygons = new Map()
}) => {
  const handleContextMenu = (location: Location) => {
    if (onContextMenu) {
      onContextMenu(location);
    }
    // For now, we'll handle context menu locally since we need screen coordinates
    // In a real implementation, you'd need to convert map coordinates to screen coordinates
  };

  const routeCoordinates: LatLngExpression[] = route 
    ? route.geometry.coordinates.map(coord => [coord[1], coord[0]] as LatLngExpression)
    : [];

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ height: '100vh', width: '100%' }}
    >
      <OfflineTileLayerComponent currentLayer={currentLayer} />
      
      <MapEventHandler onMapClick={onMapClick} onContextMenu={handleContextMenu} onMapMoveEnd={onMapMoveEnd} isDrawingPolygon={isDrawingPolygon} />
      <MapReadyHandler onMapReady={onMapReady} />
      <MapCenterHandler center={center} zoom={zoom} />
      
      {/* Route Start Marker */}
      {routeStartMarker && (
        <Marker 
          position={[routeStartMarker.location.lat, routeStartMarker.location.lng]}
          icon={StartIcon}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              onRouteMarkerDrag && onRouteMarkerDrag(true, { lat: position.lat, lng: position.lng });
            }
          }}
        >
          <Popup>
            <div>
              <h3 className="font-semibold text-green-600">Start Point</h3>
              <p>{routeStartMarker.name}</p>
              <p className="text-xs text-gray-500">Drag to move</p>
            </div>
          </Popup>
        </Marker>
      )}
      
      {/* Route End Marker */}
      {routeEndMarker && (
        <Marker 
          position={[routeEndMarker.location.lat, routeEndMarker.location.lng]}
          icon={EndIcon}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              onRouteMarkerDrag && onRouteMarkerDrag(false, { lat: position.lat, lng: position.lng });
            }
          }}
        >
          <Popup>
            <div>
              <h3 className="font-semibold text-red-600">Destination</h3>
              <p>{routeEndMarker.name}</p>
              <p className="text-xs text-gray-500">Drag to move</p>
            </div>
          </Popup>
        </Marker>
      )}
      
      {/* Regular Markers */}
      {markers.map((marker) => (
        <Marker key={marker.id} position={[marker.position.lat, marker.position.lng]}>
          <Popup>
            <div>
              <h3 className="font-semibold">{marker.title}</h3>
              {marker.description && <p>{marker.description}</p>}
            </div>
          </Popup>
        </Marker>
      ))}
      
      {route && routeCoordinates.length > 0 && (
        <Polyline 
          positions={routeCoordinates} 
          color="#3B82F6" 
          weight={4}
          opacity={0.7}
        />
      )}
      
      {/* Polygon Drawing Visualization */}
      {polygonPoints.length > 0 && (
        <>
          {/* Draw points as circle markers */}
          {polygonPoints.map((point, index) => (
            <CircleMarker
              key={`polygon-point-${index}`}
              center={[point[0], point[1]]}
              radius={6}
              color="#E11D48"
              fillColor="#F97316"
              fillOpacity={0.8}
              weight={2}
            >
              <Popup>
                <div>
                  <p className="font-semibold">Point {index + 1}</p>
                  <p className="text-sm">{point[0].toFixed(6)}, {point[1].toFixed(6)}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          
          {/* Draw lines between points */}
          {polygonPoints.length > 1 && (
            <Polyline
              positions={polygonPoints.map(point => [point[0], point[1]] as LatLngExpression)}
              color="#E11D48"
              weight={3}
              opacity={0.8}
              dashArray="10, 5"
            />
          )}
          
          {/* Close the polygon with a line from last to first point if we have enough points and showing preview */}
          {showPolygonPreview && polygonPoints.length >= 3 && (
            <Polyline
              positions={[
                [polygonPoints[polygonPoints.length - 1][0], polygonPoints[polygonPoints.length - 1][1]],
                [polygonPoints[0][0], polygonPoints[0][1]]
              ]}
              color="#E11D48"
              weight={3}
              opacity={0.8}
              dashArray="10, 5"
            />
          )}
          
          {/* Show filled polygon when preview is enabled and we have enough points */}
          {showPolygonPreview && polygonPoints.length >= 3 && (
            <Polygon
              positions={polygonPoints.map(point => [point[0], point[1]] as LatLngExpression)}
              color="#E11D48"
              fillColor="#F97316"
              fillOpacity={0.2}
              weight={2}
            />
          )}
        </>
      )}
      
      {/* Custom Pack Polygons with Editing Support */}
      {customPackPolygons.length > 0 && customPackPolygons.map((polygon, index) => {
        const polygonId = `custom-pack-${index}`;
        const isEditing = editingPolygonId === polygonId;
        
        return polygon.length >= 3 && (
          <PolygonEditor
            key={polygonId}
            polygon={polygon}
            onPolygonChange={(newPolygon) => {
              if (onPolygonEdit) {
                onPolygonEdit(polygonId, newPolygon);
              }
            }}
            isEditing={isEditing}
            color="#8B5CF6"
            fillColor="#A855F7"
            editable={true}
            className="custom-pack-polygon"
          />
        );
      })}
      
      {/* Editable Polygons from EditablePolygons Map */}
      {Array.from(editablePolygons.entries()).map(([polygonId, polygon]) => (
        polygon.length >= 3 && (
          <PolygonEditor
            key={polygonId}
            polygon={polygon}
            onPolygonChange={(newPolygon) => {
              if (onPolygonEdit) {
                onPolygonEdit(polygonId, newPolygon);
              }
            }}
            isEditing={editingPolygonId === polygonId}
            color="#10B981"
            fillColor="#34D399"
            editable={true}
            className="editable-polygon"
          />
        )
      ))}
      
      {/* Drawing mode indicator */}
      {isDrawingPolygon && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(239, 29, 72, 0.9)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 'bold',
          zIndex: 1000,
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        }}>
          🖱️ Click on map to add polygon points • {polygonPoints.length} points added
        </div>
      )}
    </MapContainer>
  );
};

export default MapComponent;