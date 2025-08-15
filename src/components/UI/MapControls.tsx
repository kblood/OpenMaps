import React from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Locate, 
  Navigation, 
  Layers, 
  Search,
  Map as MapIcon
} from 'lucide-react';
import { clsx } from 'clsx';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocateUser: () => void;
  onToggleDirections: () => void;
  onToggleSearch: () => void;
  onToggleLayers?: () => void;
  onMapLayerChange?: () => void;
  showDirections: boolean;
  showSearch: boolean;
  isLocating?: boolean;
  className?: string;
}

const MapControls: React.FC<MapControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onLocateUser,
  onToggleDirections,
  onToggleSearch,
  onToggleLayers,
  onMapLayerChange,
  showDirections,
  showSearch,
  isLocating = false,
  className
}) => {
  const buttonClass = "w-10 h-10 bg-white shadow-lg rounded-md flex items-center justify-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";
  const activeButtonClass = "bg-blue-600 text-white hover:bg-blue-700";

  return (
    <div className={clsx("flex flex-col space-y-2", className)}>
      {/* Zoom Controls */}
      <div className="flex flex-col space-y-1">
        <button
          onClick={onZoomIn}
          className={buttonClass}
          title="Zoom in"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          onClick={onZoomOut}
          className={buttonClass}
          title="Zoom out"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
      </div>

      {/* Location Control */}
      <button
        onClick={onLocateUser}
        className={clsx(buttonClass, isLocating && "animate-pulse")}
        title="Find my location"
        disabled={isLocating}
      >
        <Locate className={clsx("h-5 w-5", isLocating && "animate-spin")} />
      </button>

      {/* Search Toggle */}
      <button
        onClick={onToggleSearch}
        className={clsx(buttonClass, showSearch && activeButtonClass)}
        title="Toggle search"
      >
        <Search className="h-5 w-5" />
      </button>

      {/* Directions Toggle */}
      <button
        onClick={onToggleDirections}
        className={clsx(buttonClass, showDirections && activeButtonClass)}
        title="Get directions"
      >
        <Navigation className="h-5 w-5" />
      </button>

      {/* Layers Toggle */}
      {onToggleLayers && (
        <button
          onClick={onToggleLayers}
          className={buttonClass}
          title="Map layers"
        >
          <Layers className="h-5 w-5" />
        </button>
      )}

      {/* Map Type */}
      {onMapLayerChange && (
        <button
          onClick={onMapLayerChange}
          className={buttonClass}
          title="Change map layer"
        >
          <MapIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default MapControls;