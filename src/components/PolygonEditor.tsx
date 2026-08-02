import React, { useState, useEffect, useCallback } from 'react';
import { Polygon, Popup, Marker, useMap, Polyline } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import L from 'leaflet';

// Create custom icons for editable points
const createEditPointIcon = (isSelected: boolean, color: string) => {
  return L.divIcon({
    html: `<div style="
      width: ${isSelected ? '16px' : '12px'}; 
      height: ${isSelected ? '16px' : '12px'}; 
      background-color: ${isSelected ? '#10B981' : color}; 
      border: ${isSelected ? '3px' : '2px'} solid white; 
      border-radius: 50%; 
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: pointer;
    "></div>`,
    className: 'custom-edit-point-icon',
    iconSize: [isSelected ? 16 : 12, isSelected ? 16 : 12],
    iconAnchor: [isSelected ? 8 : 6, isSelected ? 8 : 6]
  });
};

const createInsertPointIcon = () => {
  return L.divIcon({
    html: `<div style="
      width: 8px; 
      height: 8px; 
      background-color: #9CA3AF; 
      border: 1px solid white; 
      border-radius: 50%; 
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
      cursor: pointer;
      opacity: 0.8;
    "></div>`,
    className: 'custom-insert-point-icon',
    iconSize: [8, 8],
    iconAnchor: [4, 4]
  });
};

interface PolygonEditorProps {
  polygon: [number, number][];
  onPolygonChange: (newPolygon: [number, number][]) => void;
  isEditing: boolean;
  color?: string;
  fillColor?: string;
  editable?: boolean;
  className?: string;
}

interface EditablePoint {
  id: string;
  position: [number, number];
  isSelected: boolean;
  isInsertionPoint?: boolean; // For midpoint insertion
}

const PolygonEditor: React.FC<PolygonEditorProps> = ({
  polygon,
  onPolygonChange,
  isEditing,
  color = '#E11D48',
  fillColor = '#F97316',
  editable = true,
  className = ''
}) => {
  const map = useMap();
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [insertionPoints, setInsertionPoints] = useState<EditablePoint[]>([]);
  const [currentZoom, setCurrentZoom] = useState(map.getZoom());

  // Listen for zoom changes
  useEffect(() => {
    const handleZoomEnd = () => {
      setCurrentZoom(map.getZoom());
    };
    
    map.on('zoomend', handleZoomEnd);
    return () => {
      map.off('zoomend', handleZoomEnd);
    };
  }, [map]);

  // Generate point IDs with zoom-based optimization
  const shouldReducePoints = polygon.length > 50 && currentZoom < 10;
  const pointSkipFactor = polygon.length > 200 ? 4 : polygon.length > 100 ? 3 : 2;
  
  const points: EditablePoint[] = polygon.map((pos, index) => ({
    id: `point-${index}`,
    position: pos,
    isSelected: selectedPoints.has(`point-${index}`)
  })).filter((_, index) => {
    // At low zoom levels with many points, only show every Nth point
    if (shouldReducePoints) {
      return index % pointSkipFactor === 0 || selectedPoints.has(`point-${index}`);
    }
    return true;
  });

  // Calculate midpoints for insertion when editing (optimized for large polygons)
  useEffect(() => {
    if (!isEditing || polygon.length < 2) {
      setInsertionPoints([]);
      return;
    }

    // For very large polygons (>100 points), reduce midpoint density
    const shouldSkipMidpoints = polygon.length > 100;
    const skipFactor = polygon.length > 500 ? 5 : polygon.length > 200 ? 3 : 2;

    const midpoints: EditablePoint[] = [];
    for (let i = 0; i < polygon.length; i++) {
      // Skip some midpoints for large polygons to improve performance
      if (shouldSkipMidpoints && i % skipFactor !== 0) continue;
      
      const current = polygon[i];
      const next = polygon[(i + 1) % polygon.length];
      
      const midLat = (current[0] + next[0]) / 2;
      const midLng = (current[1] + next[1]) / 2;
      
      midpoints.push({
        id: `midpoint-${i}`,
        position: [midLat, midLng],
        isSelected: false,
        isInsertionPoint: true
      });
    }
    
    setInsertionPoints(midpoints);
  }, [polygon, isEditing]);

  const handlePointSelect = useCallback((pointId: string, isMultiSelect: boolean = false) => {
    if (!isEditing || !editable) return;

    setSelectedPoints(prev => {
      const newSelected = new Set(prev);
      
      if (isMultiSelect) {
        if (newSelected.has(pointId)) {
          newSelected.delete(pointId);
        } else {
          newSelected.add(pointId);
        }
      } else {
        newSelected.clear();
        newSelected.add(pointId);
      }
      
      return newSelected;
    });
  }, [isEditing, editable]);

  const handlePointMove = useCallback((pointId: string, newPosition: [number, number]) => {
    if (!isEditing || !editable) return;

    const pointIndex = parseInt(pointId.split('-')[1]);
    if (isNaN(pointIndex) || pointIndex < 0 || pointIndex >= polygon.length) return;

    const newPolygon = [...polygon];
    newPolygon[pointIndex] = newPosition;
    onPolygonChange(newPolygon);
  }, [polygon, onPolygonChange, isEditing, editable]);

  const handlePointInsert = useCallback((midpointId: string, position: [number, number]) => {
    if (!isEditing || !editable) return;

    const insertIndex = parseInt(midpointId.split('-')[1]) + 1;
    const newPolygon = [...polygon];
    newPolygon.splice(insertIndex, 0, position);
    onPolygonChange(newPolygon);
  }, [polygon, onPolygonChange, isEditing, editable]);

  const handlePointDelete = useCallback((pointId: string) => {
    if (!isEditing || !editable || polygon.length <= 3) return; // Minimum 3 points for polygon

    const pointIndex = parseInt(pointId.split('-')[1]);
    if (isNaN(pointIndex) || pointIndex < 0 || pointIndex >= polygon.length) return;

    const newPolygon = polygon.filter((_, index) => index !== pointIndex);
    onPolygonChange(newPolygon);
    
    // Clear selection
    setSelectedPoints(new Set());
  }, [polygon, onPolygonChange, isEditing, editable]);

  const handleDeleteSelected = useCallback(() => {
    if (!isEditing || !editable || selectedPoints.size === 0) return;
    
    const indicesToDelete = Array.from(selectedPoints)
      .map(id => parseInt(id.split('-')[1]))
      .filter(index => !isNaN(index))
      .sort((a, b) => b - a); // Sort in descending order to avoid index shifting
    
    // Don't allow deletion if it would leave less than 3 points
    if (polygon.length - indicesToDelete.length < 3) {
      alert('Cannot delete points: polygon must have at least 3 points');
      return;
    }

    const newPolygon = [...polygon];
    indicesToDelete.forEach(index => {
      if (index >= 0 && index < newPolygon.length) {
        newPolygon.splice(index, 1);
      }
    });
    
    onPolygonChange(newPolygon);
    setSelectedPoints(new Set());
  }, [polygon, onPolygonChange, selectedPoints, isEditing, editable]);

  const handleSelectAll = useCallback(() => {
    if (!isEditing || !editable) return;
    
    const allPointIds = points.map(p => p.id);
    setSelectedPoints(new Set(allPointIds));
  }, [points, isEditing, editable]);

  const handleClearSelection = useCallback(() => {
    setSelectedPoints(new Set());
  }, []);

  if (polygon.length < 3) return null;

  return (
    <>
      {/* Main polygon */}
      <Polygon
        positions={polygon.map(point => [point[0], point[1]] as LatLngExpression)}
        color={color}
        fillColor={fillColor}
        fillOpacity={isEditing ? 0.3 : 0.2}
        weight={isEditing ? 3 : 2}
        opacity={isEditing ? 0.9 : 0.7}
        className={className}
      >
        <Popup>
          <div>
            <strong>Polygon</strong>
            <br />
            Points: {polygon.length}
            {isEditing && editable && (
              <div className="mt-2 space-y-1">
                <div className="text-xs text-gray-600">
                  {selectedPoints.size > 0 && `${selectedPoints.size} points selected`}
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={handleSelectAll}
                    className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                  >
                    Select All
                  </button>
                  {selectedPoints.size > 0 && (
                    <>
                      <button
                        onClick={handleClearSelection}
                        className="px-2 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleDeleteSelected}
                        className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </Popup>
      </Polygon>

      {/* Edit mode: show draggable points */}
      {isEditing && editable && points.map((point, index) => (
        <Marker
          key={point.id}
          position={[point.position[0], point.position[1]]}
          icon={createEditPointIcon(point.isSelected, color)}
          draggable={true}
          eventHandlers={{
            click: (e) => {
              e.originalEvent.stopPropagation();
              handlePointSelect(point.id, e.originalEvent.ctrlKey || e.originalEvent.metaKey);
            },
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              handlePointMove(point.id, [position.lat, position.lng]);
            },
            dragstart: () => {
              // Select the point being dragged if not already selected
              if (!point.isSelected) {
                handlePointSelect(point.id);
              }
            }
          }}
        >
          <Popup>
            <div>
              <strong>Point {index + 1}</strong>
              <br />
              <small>{point.position[0].toFixed(6)}, {point.position[1].toFixed(6)}</small>
              <br />
              <div className="flex space-x-1 mt-1">
                <button
                  onClick={() => handlePointSelect(point.id)}
                  className={`px-2 py-1 rounded text-xs ${
                    point.isSelected 
                      ? 'bg-green-500 text-white hover:bg-green-600' 
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {point.isSelected ? 'Selected' : 'Select'}
                </button>
                {polygon.length > 3 && (
                  <button
                    onClick={() => handlePointDelete(point.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Drag to move • Ctrl+click to multi-select
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Edit mode: show insertion points (midpoints) */}
      {isEditing && editable && insertionPoints.map((midpoint) => (
        <Marker
          key={midpoint.id}
          position={[midpoint.position[0], midpoint.position[1]]}
          icon={createInsertPointIcon()}
          eventHandlers={{
            click: (e) => {
              e.originalEvent.stopPropagation();
              handlePointInsert(midpoint.id, midpoint.position);
            }
          }}
        >
          <Popup>
            <div>
              <strong>Insert Point</strong>
              <br />
              <small>Click to add a new point here</small>
              <br />
              <button
                onClick={() => handlePointInsert(midpoint.id, midpoint.position)}
                className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 mt-1"
              >
                ➕ Add Point
              </button>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Selection outline for multiple selected points */}
      {isEditing && editable && selectedPoints.size > 1 && (
        <Polyline
          positions={points
            .filter(p => p.isSelected)
            .map(p => [p.position[0], p.position[1]] as LatLngExpression)}
          color="#10B981"
          weight={2}
          opacity={0.6}
          dashArray="5, 5"
        />
      )}
    </>
  );
};

export default PolygonEditor;