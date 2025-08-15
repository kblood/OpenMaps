import { MapTileLayer } from '../types';
import { mapPackManager } from './mapPacks';

export const DEFAULT_LAYER = 'standard';

// Dynamic layer access through map pack system
export const getMapLayer = (layerId: string): MapTileLayer => {
  const layers = getAvailableLayers();
  const layer = layers.find(l => l.id === layerId);
  return layer ? convertToMapTileLayer(layer) : convertToMapTileLayer(layers[0]);
};

export const getAvailableLayers = (): MapTileLayer[] => {
  return mapPackManager.getAllLayers().map(convertToMapTileLayer);
};

// Convert MapPackLayer to MapTileLayer for compatibility
function convertToMapTileLayer(layer: any): MapTileLayer {
  return {
    id: layer.id,
    name: layer.name,
    url: layer.url,
    attribution: layer.attribution,
    maxZoom: layer.maxZoom,
    description: `${layer.name} map layer`
  };
}

// Legacy support - build MAP_LAYERS from current map packs
export const MAP_LAYERS: Record<string, MapTileLayer> = {};

// Initialize MAP_LAYERS from installed packs
function updateMapLayers() {
  const layers = getAvailableLayers();
  layers.forEach(layer => {
    MAP_LAYERS[layer.id] = layer;
  });
}

// Initialize on load
updateMapLayers();

// Update function for when map packs change
export const refreshMapLayers = () => {
  // Clear existing layers
  Object.keys(MAP_LAYERS).forEach(key => delete MAP_LAYERS[key]);
  updateMapLayers();
};