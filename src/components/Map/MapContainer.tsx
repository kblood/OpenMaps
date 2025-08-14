import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import { LatLngExpression, Map as LeafletMap } from 'leaflet';
import { Location, Marker as MarkerType, Route } from '../../types';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in react-leaflet
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

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
}

interface ContextMenuProps {
  position: { x: number; y: number } | null;
  location: Location | null;
  onSetStart: (location: Location) => void;
  onSetEnd: (location: Location) => void;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ position, location, onSetStart, onSetEnd, onClose }) => {
  if (!position || !location) return null;
  
  return (
    <div 
      className="absolute bg-white shadow-lg rounded-md border border-gray-200 py-1 z-[2000]"
      style={{ left: position.x, top: position.y }}
    >
      <button
        onClick={() => {
          onSetStart(location);
          onClose();
        }}
        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
      >
        Set as start point
      </button>
      <button
        onClick={() => {
          onSetEnd(location);
          onClose();
        }}
        className="w-full px-4 py-2 text-left hover:bg-gray-100 text-sm"
      >
        Set as destination
      </button>
    </div>
  );
};

function MapEventHandler({ onMapClick, onContextMenu }: { onMapClick: (location: Location) => void; onContextMenu?: (location: Location) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    contextmenu: (e) => {
      if (onContextMenu) {
        onContextMenu({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    }
  });
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
  onContextMenu
}) => {
  const mapRef = useRef<LeafletMap>(null);
  const [contextMenu, setContextMenu] = useState<{ position: { x: number; y: number }; location: Location } | null>(null);

  const handleContextMenu = (location: Location) => {
    if (onContextMenu) {
      onContextMenu(location);
    }
    // For now, we'll handle context menu locally since we need screen coordinates
    // In a real implementation, you'd need to convert map coordinates to screen coordinates
  };

  useEffect(() => {
    if (mapRef.current) {
      onMapReady(mapRef.current);
    }
  }, [onMapReady]);

  const routeCoordinates: LatLngExpression[] = route 
    ? route.geometry.coordinates.map(coord => [coord[1], coord[0]] as LatLngExpression)
    : [];

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={{ height: '100vh', width: '100%' }}
      ref={mapRef}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapEventHandler onMapClick={onMapClick} onContextMenu={handleContextMenu} />
      
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
    </MapContainer>
  );
};

export default MapComponent;