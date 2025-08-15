import { MapTileLayer } from '../types';

export const MAP_LAYERS: Record<string, MapTileLayer> = {
  standard: {
    id: 'standard',
    name: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    description: 'Standard OpenStreetMap tiles'
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    description: 'High-resolution satellite imagery'
  },
  terrain: {
    id: 'terrain',
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
    description: 'Topographical map with elevation contours'
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
    description: 'Dark theme map perfect for night viewing'
  },
  humanitarian: {
    id: 'humanitarian',
    name: 'Humanitarian',
    url: 'https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles courtesy of <a href="https://hot.openstreetmap.org/">Humanitarian OpenStreetMap Team</a>',
    maxZoom: 19,
    description: 'Humanitarian OpenStreetMap style highlighting key infrastructure'
  },
  cycling: {
    id: 'cycling',
    name: 'Cycling',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases">CyclOSM</a>',
    maxZoom: 19,
    description: 'Cycling-focused map highlighting bike routes and infrastructure'
  },
  transport: {
    id: 'transport',
    name: 'Transport',
    url: 'https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://www.thunderforest.com/">Thunderforest</a>',
    maxZoom: 18,
    description: 'Public transport focused map (requires API key for heavy usage)'
  }
};

export const DEFAULT_LAYER = 'standard';

export const getMapLayer = (layerId: string): MapTileLayer => {
  return MAP_LAYERS[layerId] || MAP_LAYERS[DEFAULT_LAYER];
};

export const getAvailableLayers = (): MapTileLayer[] => {
  return Object.values(MAP_LAYERS);
};