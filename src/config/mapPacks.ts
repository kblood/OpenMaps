// Map Packs System - Extensible map layer collections
export interface MapPack {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  layers: MapPackLayer[];
  thumbnail?: string;
  license?: string;
  website?: string;
}

export interface MapPackLayer {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  minZoom?: number;
  subdomains?: string[];
  type: 'raster' | 'vector' | 'wms';
  format?: string;
  overlay?: boolean;
}

// Core map pack - included by default
export const CORE_MAP_PACK: MapPack = {
  id: 'core',
  name: 'Core Maps',
  description: 'Essential map layers for basic functionality',
  version: '1.0.0',
  author: 'OpenMaps Team',
  layers: [
    {
      id: 'standard',
      name: 'Standard',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      type: 'raster'
    },
    {
      id: 'satellite',
      name: 'Satellite',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
      maxZoom: 19,
      type: 'raster'
    },
    {
      id: 'terrain',
      name: 'Terrain',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
      maxZoom: 17,
      type: 'raster'
    }
  ]
};

// Specialized map packs
export const SPECIALTY_MAP_PACKS: MapPack[] = [
  {
    id: 'humanitarian',
    name: 'Humanitarian Maps',
    description: 'Maps optimized for crisis response and humanitarian work',
    version: '1.0.0',
    author: 'Humanitarian OpenStreetMap Team',
    layers: [
      {
        id: 'humanitarian',
        name: 'Humanitarian',
        url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team',
        maxZoom: 19,
        type: 'raster'
      }
    ]
  },
  {
    id: 'cycling',
    name: 'Cycling Maps',
    description: 'Maps with cycling routes and infrastructure',
    version: '1.0.0',
    author: 'CyclOSM Team',
    layers: [
      {
        id: 'cycling',
        name: 'Cycling Routes',
        url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors, CyclOSM',
        maxZoom: 19,
        type: 'raster'
      }
    ]
  },
  {
    id: 'transport',
    name: 'Transport Maps',
    description: 'Public transport and infrastructure focused maps',
    version: '1.0.0',
    author: 'OpenStreetMap',
    layers: [
      {
        id: 'transport',
        name: 'Transport',
        url: 'https://{s}.tile.memomaps.de/tilegen/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors, MemoMaps',
        maxZoom: 18,
        type: 'raster'
      }
    ]
  },
  {
    id: 'dark-theme',
    name: 'Dark Theme Maps',
    description: 'Dark-themed maps for night viewing',
    version: '1.0.0',
    author: 'CartoDB',
    layers: [
      {
        id: 'dark',
        name: 'Dark Mode',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap contributors, CartoDB',
        maxZoom: 19,
        type: 'raster'
      }
    ]
  }
];

// Map pack management functions
export class MapPackManager {
  private installedPacks: Map<string, MapPack> = new Map();
  
  constructor() {
    // Always include core pack
    this.installedPacks.set(CORE_MAP_PACK.id, CORE_MAP_PACK);
    this.loadInstalledPacks();
  }

  private loadInstalledPacks() {
    try {
      const stored = localStorage.getItem('openmaps_installed_packs');
      if (stored) {
        const packIds = JSON.parse(stored);
        packIds.forEach((id: string) => {
          const pack = SPECIALTY_MAP_PACKS.find(p => p.id === id);
          if (pack) {
            this.installedPacks.set(id, pack);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load installed map packs:', error);
    }
  }

  private saveInstalledPacks() {
    try {
      const packIds = Array.from(this.installedPacks.keys()).filter(id => id !== 'core');
      localStorage.setItem('openmaps_installed_packs', JSON.stringify(packIds));
    } catch (error) {
      console.warn('Failed to save installed map packs:', error);
    }
  }

  getInstalledPacks(): MapPack[] {
    return Array.from(this.installedPacks.values());
  }

  getAvailablePacks(): MapPack[] {
    return SPECIALTY_MAP_PACKS.filter(pack => !this.installedPacks.has(pack.id));
  }

  getAllLayers(): MapPackLayer[] {
    const layers: MapPackLayer[] = [];
    this.installedPacks.forEach(pack => {
      layers.push(...pack.layers);
    });
    return layers;
  }

  installPack(packId: string): boolean {
    const pack = SPECIALTY_MAP_PACKS.find(p => p.id === packId);
    if (pack && !this.installedPacks.has(packId)) {
      this.installedPacks.set(packId, pack);
      this.saveInstalledPacks();
      return true;
    }
    return false;
  }

  uninstallPack(packId: string): boolean {
    if (packId === 'core') return false; // Cannot uninstall core pack
    
    if (this.installedPacks.has(packId)) {
      this.installedPacks.delete(packId);
      this.saveInstalledPacks();
      return true;
    }
    return false;
  }

  getPackInfo(packId: string): MapPack | undefined {
    return this.installedPacks.get(packId) || SPECIALTY_MAP_PACKS.find(p => p.id === packId);
  }
}

// Singleton instance
export const mapPackManager = new MapPackManager();