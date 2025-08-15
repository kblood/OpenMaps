// Global Hierarchical Map Data System
export interface GlobalMapNode {
  id: string;
  name: string;
  level: 'world' | 'continent' | 'country' | 'state' | 'region' | 'city' | 'section' | 'custom';
  parentId?: string;
  children?: string[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  center: {
    lat: number;
    lng: number;
  };
  population?: number;
  area?: number; // km²
  isCapital?: boolean;
  isPreloaded: boolean; // Available offline
  estimatedTiles: number;
  estimatedSizeMB: number;
  isDownloaded: boolean;
  downloadProgress?: number;
  priority: number;
  tags: string[];
  metadata: {
    countryCode?: string;
    timezone?: string;
    language?: string;
    currency?: string;
  };
}

export interface SearchableLocation {
  id: string;
  name: string;
  level: string;
  parentPath: string[]; // Full hierarchy path
  searchTokens: string[]; // For fuzzy search
  population?: number;
  isCapital?: boolean;
}

// Preloaded global hierarchy data (available offline)
export const GLOBAL_HIERARCHY: GlobalMapNode[] = [
  // WORLD
  {
    id: 'world',
    name: 'World',
    level: 'world',
    bounds: { north: 85, south: -85, east: 180, west: -180 },
    center: { lat: 0, lng: 0 },
    children: ['north_america', 'south_america', 'europe', 'africa', 'asia', 'oceania', 'antarctica'],
    isPreloaded: true,
    estimatedTiles: 1000000,
    estimatedSizeMB: 20000,
    isDownloaded: false,
    priority: 1,
    tags: ['global'],
    metadata: {}
  },

  // CONTINENTS
  {
    id: 'north_america',
    name: 'North America',
    level: 'continent',
    parentId: 'world',
    bounds: { north: 83.11, south: 5.5, east: -12.2, west: -168.0 },
    center: { lat: 54.5, lng: -105.0 },
    children: ['usa', 'canada', 'mexico', 'guatemala', 'belize', 'costa_rica', 'honduras', 'nicaragua', 'panama', 'el_salvador'],
    isPreloaded: true,
    estimatedTiles: 150000,
    estimatedSizeMB: 3000,
    isDownloaded: false,
    priority: 2,
    tags: ['continent'],
    metadata: {}
  },
  {
    id: 'europe',
    name: 'Europe',
    level: 'continent',
    parentId: 'world',
    bounds: { north: 81.85, south: 27.64, east: 69.07, west: -31.27 },
    center: { lat: 54.0, lng: 15.0 },
    children: ['uk', 'france', 'germany', 'italy', 'spain', 'netherlands', 'norway', 'sweden', 'finland', 'poland'],
    isPreloaded: true,
    estimatedTiles: 100000,
    estimatedSizeMB: 2000,
    isDownloaded: false,
    priority: 2,
    tags: ['continent'],
    metadata: {}
  },
  {
    id: 'asia',
    name: 'Asia',
    level: 'continent',
    parentId: 'world',
    bounds: { north: 77.7, south: -11.0, east: 180.0, west: 26.04 },
    center: { lat: 29.84, lng: 89.3 },
    children: ['china', 'india', 'japan', 'south_korea', 'thailand', 'vietnam', 'indonesia', 'russia', 'turkey', 'iran'],
    isPreloaded: true,
    estimatedTiles: 200000,
    estimatedSizeMB: 4000,
    isDownloaded: false,
    priority: 2,
    tags: ['continent'],
    metadata: {}
  },

  // MAJOR COUNTRIES
  {
    id: 'usa',
    name: 'United States',
    level: 'country',
    parentId: 'north_america',
    bounds: { north: 71.4, south: 18.9, east: -66.9, west: -179.1 },
    center: { lat: 39.8, lng: -98.5 },
    children: ['california', 'texas', 'florida', 'new_york_state', 'illinois', 'pennsylvania', 'ohio', 'georgia', 'north_carolina', 'michigan'],
    population: 331000000,
    area: 9833517,
    isPreloaded: true,
    estimatedTiles: 80000,
    estimatedSizeMB: 1600,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'US', timezone: 'Multiple', language: 'English', currency: 'USD' }
  },
  {
    id: 'uk',
    name: 'United Kingdom',
    level: 'country',
    parentId: 'europe',
    bounds: { north: 60.85, south: 49.96, east: 1.77, west: -8.18 },
    center: { lat: 55.38, lng: -3.44 },
    children: ['england', 'scotland', 'wales', 'northern_ireland'],
    population: 67000000,
    area: 243610,
    isPreloaded: true,
    estimatedTiles: 25000,
    estimatedSizeMB: 500,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'GB', timezone: 'GMT', language: 'English', currency: 'GBP' }
  },
  {
    id: 'china',
    name: 'China',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 53.56, south: 18.16, east: 134.77, west: 73.5 },
    center: { lat: 35.86, lng: 104.19 },
    children: ['beijing_region', 'shanghai_region', 'guangdong', 'sichuan', 'henan', 'shandong', 'hunan', 'anhui', 'hubei', 'zhejiang'],
    population: 1440000000,
    area: 9596960,
    isPreloaded: true,
    estimatedTiles: 75000,
    estimatedSizeMB: 1500,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'CN', timezone: 'CST', language: 'Chinese', currency: 'CNY' }
  },

  // STATES/REGIONS
  {
    id: 'california',
    name: 'California',
    level: 'state',
    parentId: 'usa',
    bounds: { north: 42.0, south: 32.53, east: -114.13, west: -124.48 },
    center: { lat: 36.78, lng: -119.42 },
    children: ['los_angeles', 'san_francisco', 'san_diego', 'sacramento', 'fresno', 'oakland', 'bakersfield', 'anaheim', 'santa_ana', 'riverside'],
    population: 39500000,
    area: 423970,
    isPreloaded: true,
    estimatedTiles: 15000,
    estimatedSizeMB: 300,
    isDownloaded: false,
    priority: 4,
    tags: ['state', 'major'],
    metadata: { countryCode: 'US' }
  },
  {
    id: 'england',
    name: 'England',
    level: 'state',
    parentId: 'uk',
    bounds: { north: 55.81, south: 49.96, east: 1.77, west: -6.42 },
    center: { lat: 52.36, lng: -1.17 },
    children: ['london', 'birmingham', 'manchester', 'liverpool', 'leeds', 'sheffield', 'bristol', 'nottingham', 'leicester', 'coventry'],
    population: 56000000,
    area: 130279,
    isPreloaded: true,
    estimatedTiles: 20000,
    estimatedSizeMB: 400,
    isDownloaded: false,
    priority: 4,
    tags: ['state', 'major'],
    metadata: { countryCode: 'GB' }
  },

  // MAJOR CITIES (TOP 100 GLOBAL)
  {
    id: 'london',
    name: 'London',
    level: 'city',
    parentId: 'england',
    bounds: { north: 51.69, south: 51.28, east: 0.35, west: -0.51 },
    center: { lat: 51.51, lng: -0.13 },
    children: ['central_london', 'westminster', 'camden', 'islington', 'hackney', 'tower_hamlets', 'greenwich', 'lewisham', 'southwark', 'lambeth'],
    population: 9000000,
    area: 1572,
    isCapital: true,
    isPreloaded: true,
    estimatedTiles: 8000,
    estimatedSizeMB: 160,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'major'],
    metadata: { countryCode: 'GB', timezone: 'GMT', language: 'English', currency: 'GBP' }
  },
  {
    id: 'new_york',
    name: 'New York City',
    level: 'city',
    parentId: 'new_york_state',
    bounds: { north: 40.92, south: 40.48, east: -73.70, west: -74.26 },
    center: { lat: 40.71, lng: -74.01 },
    children: ['manhattan', 'brooklyn', 'queens', 'bronx', 'staten_island'],
    population: 8400000,
    area: 783,
    isPreloaded: true,
    estimatedTiles: 12000,
    estimatedSizeMB: 240,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'major'],
    metadata: { countryCode: 'US', timezone: 'EST', language: 'English', currency: 'USD' }
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    level: 'city',
    parentId: 'japan',
    bounds: { north: 35.90, south: 35.53, east: 139.95, west: 139.56 },
    center: { lat: 35.68, lng: 139.69 },
    children: ['shibuya', 'shinjuku', 'harajuku', 'ginza', 'akihabara', 'roppongi', 'asakusa', 'ueno', 'ikebukuro', 'odaiba'],
    population: 37400000,
    area: 2194,
    isCapital: true,
    isPreloaded: true,
    estimatedTiles: 15000,
    estimatedSizeMB: 300,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'major'],
    metadata: { countryCode: 'JP', timezone: 'JST', language: 'Japanese', currency: 'JPY' }
  },
  {
    id: 'paris',
    name: 'Paris',
    level: 'city',
    parentId: 'france',
    bounds: { north: 48.90, south: 48.82, east: 2.42, west: 2.22 },
    center: { lat: 48.86, lng: 2.35 },
    children: ['1st_arrondissement', '2nd_arrondissement', '3rd_arrondissement', '4th_arrondissement', '5th_arrondissement', '6th_arrondissement', '7th_arrondissement', '8th_arrondissement', '9th_arrondissement', '10th_arrondissement'],
    population: 11000000,
    area: 105,
    isCapital: true,
    isPreloaded: true,
    estimatedTiles: 6000,
    estimatedSizeMB: 120,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'major'],
    metadata: { countryCode: 'FR', timezone: 'CET', language: 'French', currency: 'EUR' }
  },

  // CITY SECTIONS (Examples)
  {
    id: 'manhattan',
    name: 'Manhattan',
    level: 'section',
    parentId: 'new_york',
    bounds: { north: 40.88, south: 40.70, east: -73.91, west: -74.02 },
    center: { lat: 40.78, lng: -73.97 },
    population: 1600000,
    area: 60,
    isPreloaded: true,
    estimatedTiles: 3000,
    estimatedSizeMB: 60,
    isDownloaded: false,
    priority: 6,
    tags: ['section', 'urban'],
    metadata: { countryCode: 'US' }
  },
  {
    id: 'central_london',
    name: 'Central London',
    level: 'section',
    parentId: 'london',
    bounds: { north: 51.53, south: 51.49, east: -0.07, west: -0.20 },
    center: { lat: 51.51, lng: -0.13 },
    population: 300000,
    area: 8,
    isPreloaded: true,
    estimatedTiles: 2000,
    estimatedSizeMB: 40,
    isDownloaded: false,
    priority: 6,
    tags: ['section', 'historic', 'business'],
    metadata: { countryCode: 'GB' }
  }
];

// Build searchable index
export const buildSearchIndex = (nodes: GlobalMapNode[]): SearchableLocation[] => {
  const searchIndex: SearchableLocation[] = [];
  
  // Create lookup map for building paths
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  
  const getParentPath = (nodeId: string): string[] => {
    const path: string[] = [];
    let current = nodeMap.get(nodeId);
    
    while (current?.parentId) {
      const parent = nodeMap.get(current.parentId);
      if (parent) {
        path.unshift(parent.name);
        current = parent;
      } else {
        break;
      }
    }
    
    return path;
  };
  
  nodes.forEach(node => {
    if (node.level !== 'world') { // Skip world node in search
      const parentPath = getParentPath(node.id);
      const searchTokens = [
        node.name.toLowerCase(),
        ...node.name.toLowerCase().split(/[\s,.-]+/),
        ...parentPath.map(p => p.toLowerCase()),
        ...node.tags,
        node.metadata.countryCode?.toLowerCase() || ''
      ].filter(token => token.length > 0);
      
      searchIndex.push({
        id: node.id,
        name: node.name,
        level: node.level,
        parentPath,
        searchTokens,
        population: node.population,
        isCapital: node.isCapital
      });
    }
  });
  
  return searchIndex;
};

// Search functionality
export const searchLocations = (query: string, searchIndex: SearchableLocation[], maxResults: number = 50): SearchableLocation[] => {
  if (!query.trim()) return [];
  
  const queryTokens = query.toLowerCase().trim().split(/\s+/);
  const results: { location: SearchableLocation; score: number }[] = [];
  
  searchIndex.forEach(location => {
    let score = 0;
    
    // Exact name match gets highest score
    if (location.name.toLowerCase() === query.toLowerCase()) {
      score += 1000;
    }
    
    // Name starts with query
    else if (location.name.toLowerCase().startsWith(query.toLowerCase())) {
      score += 500;
    }
    
    // Name contains query
    else if (location.name.toLowerCase().includes(query.toLowerCase())) {
      score += 100;
    }
    
    // Token matching
    queryTokens.forEach(queryToken => {
      location.searchTokens.forEach(locationToken => {
        if (locationToken === queryToken) {
          score += 50;
        } else if (locationToken.startsWith(queryToken)) {
          score += 25;
        } else if (locationToken.includes(queryToken)) {
          score += 10;
        }
      });
    });
    
    // Boost capitals and major cities
    if (location.isCapital) score += 25;
    if (location.population && location.population > 1000000) score += 15;
    if (location.population && location.population > 100000) score += 5;
    
    // Level-based scoring (cities > regions > countries > continents)
    const levelScores = { section: 15, city: 10, region: 5, state: 3, country: 2, continent: 1 };
    score += levelScores[location.level as keyof typeof levelScores] || 0;
    
    if (score > 0) {
      results.push({ location, score });
    }
  });
  
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(result => result.location);
};

// Navigation helpers
export const getNodeById = (id: string, nodes: GlobalMapNode[]): GlobalMapNode | undefined => {
  return nodes.find(node => node.id === id);
};

export const getChildNodes = (parentId: string, nodes: GlobalMapNode[]): GlobalMapNode[] => {
  return nodes.filter(node => node.parentId === parentId);
};

export const getNodePath = (nodeId: string, nodes: GlobalMapNode[]): GlobalMapNode[] => {
  const path: GlobalMapNode[] = [];
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  
  let current = nodeMap.get(nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? nodeMap.get(current.parentId) : undefined;
  }
  
  return path;
};

// Level definitions
export const HIERARCHY_LEVELS = [
  { id: 'world', name: 'World', icon: '🌍' },
  { id: 'continent', name: 'Continents', icon: '🌎' },
  { id: 'country', name: 'Countries', icon: '🏴' },
  { id: 'state', name: 'States/Regions', icon: '🏞️' },
  { id: 'city', name: 'Cities', icon: '🏙️' },
  { id: 'section', name: 'City Sections', icon: '🏘️' },
  { id: 'custom', name: 'Custom Areas', icon: '⚡' }
];

// Built-in search index
export const SEARCH_INDEX = buildSearchIndex(GLOBAL_HIERARCHY);
