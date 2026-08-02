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

  // ==================== CONTINENTS ====================
  {
    id: 'north_america',
    name: 'North America',
    level: 'continent',
    parentId: 'world',
    bounds: { north: 83.11, south: 5.5, east: -12.2, west: -168.0 },
    center: { lat: 54.5, lng: -105.0 },
    children: ['usa', 'canada', 'mexico', 'guatemala', 'belize', 'costa_rica', 'honduras', 'nicaragua', 'panama', 'el_salvador', 'cuba', 'jamaica', 'haiti', 'dominican_republic'],
    isPreloaded: true,
    estimatedTiles: 150000,
    estimatedSizeMB: 3000,
    isDownloaded: false,
    priority: 2,
    tags: ['continent'],
    metadata: {}
  },
  {
    id: 'south_america',
    name: 'South America',
    level: 'continent',
    parentId: 'world',
    bounds: { north: 15.25, south: -59.44, east: -26.87, west: -91.66 },
    center: { lat: -8.78, lng: -55.49 },
    children: ['brazil', 'argentina', 'colombia', 'peru', 'venezuela', 'chile', 'ecuador', 'bolivia', 'paraguay', 'uruguay', 'guyana', 'suriname'],
    isPreloaded: true,
    estimatedTiles: 120000,
    estimatedSizeMB: 2400,
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
    children: ['russia', 'germany', 'uk', 'france', 'italy', 'spain', 'ukraine', 'poland', 'romania', 'netherlands', 'belgium', 'greece', 'portugal', 'czech_republic', 'hungary', 'sweden', 'belarus', 'austria', 'serbia', 'switzerland', 'bulgaria', 'slovakia', 'denmark', 'finland', 'norway', 'ireland', 'croatia', 'bosnia_herzegovina', 'albania', 'lithuania', 'slovenia', 'latvia', 'estonia', 'macedonia', 'moldova', 'luxembourg', 'malta', 'iceland'],
    isPreloaded: true,
    estimatedTiles: 100000,
    estimatedSizeMB: 2000,
    isDownloaded: false,
    priority: 2,
    tags: ['continent'],
    metadata: {}
  },
  {
    id: 'africa',
    name: 'Africa',
    level: 'continent',
    parentId: 'world',
    bounds: { north: 37.35, south: -34.83, east: 51.27, west: -17.54 },
    center: { lat: -8.78, lng: 34.51 },
    children: ['nigeria', 'ethiopia', 'egypt', 'south_africa', 'kenya', 'uganda', 'algeria', 'sudan', 'morocco', 'angola', 'ghana', 'mozambique', 'madagascar', 'cameroon', 'cote_divoire', 'niger', 'burkina_faso', 'mali', 'malawi', 'zambia', 'senegal', 'somalia', 'chad', 'zimbabwe', 'guinea', 'rwanda', 'benin', 'tunisia', 'burundi', 'south_sudan', 'togo', 'sierra_leone', 'libya', 'liberia', 'central_african_republic', 'mauritania', 'eritrea', 'gambia', 'botswana', 'namibia', 'gabon', 'lesotho', 'guinea_bissau', 'equatorial_guinea', 'mauritius', 'eswatini', 'djibouti', 'comoros', 'cape_verde', 'sao_tome_and_principe', 'seychelles'],
    isPreloaded: true,
    estimatedTiles: 140000,
    estimatedSizeMB: 2800,
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
    children: ['china', 'india', 'indonesia', 'pakistan', 'bangladesh', 'japan', 'philippines', 'vietnam', 'turkey', 'iran', 'thailand', 'myanmar', 'south_korea', 'iraq', 'afghanistan', 'saudi_arabia', 'uzbekistan', 'malaysia', 'nepal', 'yemen', 'north_korea', 'sri_lanka', 'kazakhstan', 'syria', 'cambodia', 'jordan', 'azerbaijan', 'united_arab_emirates', 'tajikistan', 'israel', 'laos', 'singapore', 'oman', 'kuwait', 'georgia', 'mongolia', 'armenia', 'qatar', 'bahrain', 'east_timor', 'maldives', 'brunei', 'bhutan'],
    isPreloaded: true,
    estimatedTiles: 200000,
    estimatedSizeMB: 4000,
    isDownloaded: false,
    priority: 2,
    tags: ['continent'],
    metadata: {}
  },
  {
    id: 'oceania',
    name: 'Oceania',
    level: 'continent',
    parentId: 'world',
    bounds: { north: 38.24, south: -55.91, east: -109.22, west: 110.95 },
    center: { lat: -18.31, lng: 138.52 },
    children: ['australia', 'papua_new_guinea', 'new_zealand', 'fiji', 'solomon_islands', 'vanuatu', 'samoa', 'micronesia', 'tonga', 'kiribati', 'palau', 'marshall_islands', 'tuvalu', 'nauru'],
    isPreloaded: true,
    estimatedTiles: 80000,
    estimatedSizeMB: 1600,
    isDownloaded: false,
    priority: 2,
    tags: ['continent'],
    metadata: {}
  },
  {
    id: 'antarctica',
    name: 'Antarctica',
    level: 'continent',
    parentId: 'world',
    bounds: { north: -60.0, south: -89.9, east: 180.0, west: -180.0 },
    center: { lat: -82.86, lng: 135.0 },
    children: [],
    isPreloaded: true,
    estimatedTiles: 50000,
    estimatedSizeMB: 1000,
    isDownloaded: false,
    priority: 2,
    tags: ['continent'],
    metadata: {}
  },

  // ==================== MAJOR COUNTRIES ====================
  
  // NORTH AMERICA
  {
    id: 'usa',
    name: 'United States',
    level: 'country',
    parentId: 'north_america',
    bounds: { north: 71.4, south: 18.9, east: -66.9, west: -179.1 },
    center: { lat: 39.8, lng: -98.5 },
    children: ['california', 'texas', 'florida', 'new_york_state', 'illinois', 'pennsylvania', 'ohio', 'georgia', 'north_carolina', 'michigan', 'washington_state', 'arizona', 'tennessee', 'massachusetts', 'indiana', 'maryland', 'missouri', 'wisconsin', 'colorado', 'minnesota'],
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
    id: 'canada',
    name: 'Canada',
    level: 'country',
    parentId: 'north_america',
    bounds: { north: 83.11, south: 41.68, east: -52.65, west: -141.0 },
    center: { lat: 56.13, lng: -106.35 },
    children: ['ontario', 'quebec', 'british_columbia', 'alberta', 'manitoba', 'saskatchewan', 'nova_scotia', 'new_brunswick', 'newfoundland_labrador', 'northwest_territories', 'yukon', 'nunavut'],
    population: 38000000,
    area: 9984670,
    isPreloaded: true,
    estimatedTiles: 60000,
    estimatedSizeMB: 1200,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'CA', timezone: 'Multiple', language: 'English/French', currency: 'CAD' }
  },
  {
    id: 'mexico',
    name: 'Mexico',
    level: 'country',
    parentId: 'north_america',
    bounds: { north: 32.72, south: 14.53, east: -86.74, west: -118.45 },
    center: { lat: 23.63, lng: -102.55 },
    children: ['mexico_city_region', 'jalisco', 'nuevo_leon', 'puebla', 'guanajuato', 'veracruz', 'chihuahua', 'baja_california', 'michoacan', 'oaxaca'],
    population: 128000000,
    area: 1964375,
    isPreloaded: true,
    estimatedTiles: 45000,
    estimatedSizeMB: 900,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'MX', timezone: 'Multiple', language: 'Spanish', currency: 'MXN' }
  },

  // SOUTH AMERICA
  {
    id: 'brazil',
    name: 'Brazil',
    level: 'country',
    parentId: 'south_america',
    bounds: { north: 5.27, south: -33.75, east: -28.84, west: -73.99 },
    center: { lat: -14.24, lng: -51.93 },
    children: ['sao_paulo_state', 'rio_de_janeiro_state', 'minas_gerais', 'bahia', 'parana', 'rio_grande_do_sul', 'pernambuco', 'ceara', 'para', 'santa_catarina'],
    population: 215000000,
    area: 8514877,
    isPreloaded: true,
    estimatedTiles: 70000,
    estimatedSizeMB: 1400,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'BR', timezone: 'Multiple', language: 'Portuguese', currency: 'BRL' }
  },
  {
    id: 'argentina',
    name: 'Argentina',
    level: 'country',
    parentId: 'south_america',
    bounds: { north: -21.78, south: -55.25, east: -53.59, west: -73.42 },
    center: { lat: -38.42, lng: -63.62 },
    children: ['buenos_aires_province', 'cordoba', 'santa_fe', 'mendoza', 'tucuman', 'entre_rios', 'salta', 'chaco', 'corrientes', 'santiago_del_estero'],
    population: 45000000,
    area: 2780400,
    isPreloaded: true,
    estimatedTiles: 35000,
    estimatedSizeMB: 700,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'AR', timezone: 'ART', language: 'Spanish', currency: 'ARS' }
  },

  // EUROPE
  {
    id: 'russia',
    name: 'Russia',
    level: 'country',
    parentId: 'europe',
    bounds: { north: 81.86, south: 41.19, east: -169.05, west: 19.64 },
    center: { lat: 61.52, lng: 105.32 },
    children: ['moscow_region', 'saint_petersburg_region', 'novosibirsk_region', 'yekaterinburg_region', 'nizhny_novgorod_region', 'kazan_region', 'chelyabinsk_region', 'omsk_region', 'samara_region', 'rostov_region'],
    population: 146000000,
    area: 17098242,
    isPreloaded: true,
    estimatedTiles: 120000,
    estimatedSizeMB: 2400,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'RU', timezone: 'Multiple', language: 'Russian', currency: 'RUB' }
  },
  {
    id: 'germany',
    name: 'Germany',
    level: 'country',
    parentId: 'europe',
    bounds: { north: 55.06, south: 47.27, east: 15.04, west: 5.87 },
    center: { lat: 51.17, lng: 10.45 },
    children: ['north_rhine_westphalia', 'bavaria', 'baden_wurttemberg', 'lower_saxony', 'hesse', 'saxony', 'rhineland_palatinate', 'schleswig_holstein', 'brandenburg', 'saxony_anhalt'],
    population: 83000000,
    area: 357114,
    isPreloaded: true,
    estimatedTiles: 30000,
    estimatedSizeMB: 600,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'DE', timezone: 'CET', language: 'German', currency: 'EUR' }
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
    id: 'france',
    name: 'France',
    level: 'country',
    parentId: 'europe',
    bounds: { north: 51.09, south: 41.33, east: 9.56, west: -5.14 },
    center: { lat: 46.23, lng: 2.21 },
    children: ['ile_de_france', 'auvergne_rhone_alpes', 'nouvelle_aquitaine', 'occitanie', 'hauts_de_france', 'grand_est', 'provence_alpes_cote_azur', 'pays_de_la_loire', 'brittany', 'normandy'],
    population: 68000000,
    area: 643801,
    isPreloaded: true,
    estimatedTiles: 28000,
    estimatedSizeMB: 560,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'FR', timezone: 'CET', language: 'French', currency: 'EUR' }
  },
  {
    id: 'italy',
    name: 'Italy',
    level: 'country',
    parentId: 'europe',
    bounds: { north: 47.09, south: 35.49, east: 18.79, west: 6.63 },
    center: { lat: 41.87, lng: 12.57 },
    children: ['lombardy', 'lazio', 'campania', 'sicily', 'veneto', 'emilia_romagna', 'piedmont', 'apulia', 'tuscany', 'calabria'],
    population: 60000000,
    area: 301340,
    isPreloaded: true,
    estimatedTiles: 25000,
    estimatedSizeMB: 500,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'IT', timezone: 'CET', language: 'Italian', currency: 'EUR' }
  },
  {
    id: 'spain',
    name: 'Spain',
    level: 'country',
    parentId: 'europe',
    bounds: { north: 43.79, south: 27.64, east: 4.33, west: -18.17 },
    center: { lat: 40.46, lng: -3.75 },
    children: ['andalusia', 'catalonia', 'madrid_region', 'valencia', 'galicia', 'castile_leon', 'basque_country', 'canary_islands', 'castile_la_mancha', 'murcia'],
    population: 47000000,
    area: 505992,
    isPreloaded: true,
    estimatedTiles: 27000,
    estimatedSizeMB: 540,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'ES', timezone: 'CET', language: 'Spanish', currency: 'EUR' }
  },
  {
    id: 'denmark',
    name: 'Denmark',
    level: 'country',
    parentId: 'europe',
    bounds: { north: 57.75, south: 54.56, east: 15.19, west: 8.08 },
    center: { lat: 56.26, lng: 9.50 },
    children: ['capital_region', 'central_jutland', 'north_jutland', 'zealand', 'south_denmark'],
    population: 5900000,
    area: 42933,
    isPreloaded: true,
    estimatedTiles: 5000,
    estimatedSizeMB: 100,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'DK', timezone: 'CET', language: 'Danish', currency: 'DKK' }
  },

  // ASIA
  {
    id: 'china',
    name: 'China',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 53.56, south: 18.16, east: 134.77, west: 73.5 },
    center: { lat: 35.86, lng: 104.19 },
    children: ['beijing_municipality', 'shanghai_municipality', 'guangdong', 'shandong', 'henan', 'sichuan', 'jiangsu', 'hebei', 'hunan', 'anhui', 'hubei', 'zhejiang', 'guangxi', 'yunnan', 'jiangxi', 'liaoning', 'fujian', 'shaanxi', 'heilongjiang', 'shanxi'],
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
  {
    id: 'india',
    name: 'India',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 35.51, south: 6.75, east: 97.40, west: 68.18 },
    center: { lat: 20.59, lng: 78.96 },
    children: ['uttar_pradesh', 'maharashtra', 'bihar', 'west_bengal', 'madhya_pradesh', 'tamil_nadu', 'rajasthan', 'karnataka', 'gujarat', 'andhra_pradesh', 'odisha', 'telangana', 'kerala', 'jharkhand', 'assam', 'punjab', 'chhattisgarh', 'haryana', 'delhi', 'jammu_kashmir'],
    population: 1380000000,
    area: 3287263,
    isPreloaded: true,
    estimatedTiles: 65000,
    estimatedSizeMB: 1300,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'IN', timezone: 'IST', language: 'Hindi/English', currency: 'INR' }
  },
  {
    id: 'indonesia',
    name: 'Indonesia',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 6.21, south: -11.01, east: 141.02, west: 95.29 },
    center: { lat: -0.79, lng: 113.92 },
    children: ['java', 'sumatra', 'kalimantan', 'sulawesi', 'papua'],
    population: 273000000,
    area: 1904569,
    isPreloaded: true,
    estimatedTiles: 40000,
    estimatedSizeMB: 800,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'ID', timezone: 'Multiple', language: 'Indonesian', currency: 'IDR' }
  },
  {
    id: 'pakistan',
    name: 'Pakistan',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 37.10, south: 23.69, east: 77.84, west: 60.87 },
    center: { lat: 30.38, lng: 69.35 },
    children: ['punjab_pk', 'sindh', 'khyber_pakhtunkhwa', 'balochistan'],
    population: 225000000,
    area: 881913,
    isPreloaded: true,
    estimatedTiles: 30000,
    estimatedSizeMB: 600,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'PK', timezone: 'PKT', language: 'Urdu/English', currency: 'PKR' }
  },
  {
    id: 'bangladesh',
    name: 'Bangladesh',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 26.63, south: 20.74, east: 92.67, west: 88.01 },
    center: { lat: 23.68, lng: 90.35 },
    children: ['dhaka_division', 'chittagong_division', 'sylhet_division', 'rajshahi_division'],
    population: 165000000,
    area: 147570,
    isPreloaded: true,
    estimatedTiles: 20000,
    estimatedSizeMB: 400,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'BD', timezone: 'BST', language: 'Bengali', currency: 'BDT' }
  },
  {
    id: 'japan',
    name: 'Japan',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 45.55, south: 20.42, east: 153.99, west: 122.93 },
    center: { lat: 36.20, lng: 138.25 },
    children: ['tokyo_prefecture', 'osaka_prefecture', 'kanagawa', 'aichi', 'saitama', 'chiba', 'hyogo', 'hokkaido', 'fukuoka', 'shizuoka'],
    population: 125000000,
    area: 377975,
    isPreloaded: true,
    estimatedTiles: 35000,
    estimatedSizeMB: 700,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'JP', timezone: 'JST', language: 'Japanese', currency: 'JPY' }
  },
  {
    id: 'philippines',
    name: 'Philippines',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 21.12, south: 4.23, east: 126.54, west: 116.93 },
    center: { lat: 12.88, lng: 121.77 },
    children: ['luzon', 'visayas', 'mindanao'],
    population: 110000000,
    area: 300000,
    isPreloaded: true,
    estimatedTiles: 25000,
    estimatedSizeMB: 500,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'PH', timezone: 'PHT', language: 'Filipino/English', currency: 'PHP' }
  },
  {
    id: 'vietnam',
    name: 'Vietnam',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 23.39, south: 8.18, east: 109.46, west: 102.14 },
    center: { lat: 14.06, lng: 108.28 },
    children: ['north_vietnam', 'central_vietnam', 'south_vietnam'],
    population: 98000000,
    area: 331212,
    isPreloaded: true,
    estimatedTiles: 22000,
    estimatedSizeMB: 440,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'VN', timezone: 'ICT', language: 'Vietnamese', currency: 'VND' }
  },
  {
    id: 'turkey',
    name: 'Turkey',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 42.11, south: 35.82, east: 44.79, west: 25.67 },
    center: { lat: 38.96, lng: 35.24 },
    children: ['istanbul_region', 'ankara_region', 'izmir_region', 'antalya_region'],
    population: 84000000,
    area: 783562,
    isPreloaded: true,
    estimatedTiles: 30000,
    estimatedSizeMB: 600,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'TR', timezone: 'TRT', language: 'Turkish', currency: 'TRY' }
  },
  {
    id: 'iran',
    name: 'Iran',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 39.78, south: 25.06, east: 63.32, west: 44.03 },
    center: { lat: 32.43, lng: 53.69 },
    children: ['tehran_province', 'isfahan_province', 'shiraz_province', 'mashhad_province'],
    population: 84000000,
    area: 1648195,
    isPreloaded: true,
    estimatedTiles: 28000,
    estimatedSizeMB: 560,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'IR', timezone: 'IRST', language: 'Persian', currency: 'IRR' }
  },
  {
    id: 'thailand',
    name: 'Thailand',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 20.46, south: 5.61, east: 105.64, west: 97.34 },
    center: { lat: 15.87, lng: 100.99 },
    children: ['central_thailand', 'northern_thailand', 'southern_thailand', 'northeastern_thailand'],
    population: 70000000,
    area: 513120,
    isPreloaded: true,
    estimatedTiles: 20000,
    estimatedSizeMB: 400,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'TH', timezone: 'ICT', language: 'Thai', currency: 'THB' }
  },
  {
    id: 'myanmar',
    name: 'Myanmar',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 28.55, south: 9.78, east: 101.18, west: 92.19 },
    center: { lat: 21.91, lng: 95.96 },
    children: ['yangon_region', 'mandalay_region', 'bagan_region'],
    population: 54000000,
    area: 676578,
    isPreloaded: true,
    estimatedTiles: 18000,
    estimatedSizeMB: 360,
    isDownloaded: false,
    priority: 3,
    tags: ['country'],
    metadata: { countryCode: 'MM', timezone: 'MMT', language: 'Burmese', currency: 'MMK' }
  },
  {
    id: 'south_korea',
    name: 'South Korea',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 38.61, south: 33.19, east: 131.87, west: 124.61 },
    center: { lat: 35.91, lng: 127.77 },
    children: ['seoul_region', 'busan_region', 'incheon_region', 'daegu_region'],
    population: 52000000,
    area: 100210,
    isPreloaded: true,
    estimatedTiles: 15000,
    estimatedSizeMB: 300,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'KR', timezone: 'KST', language: 'Korean', currency: 'KRW' }
  },
  {
    id: 'saudi_arabia',
    name: 'Saudi Arabia',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 32.16, south: 16.38, east: 55.67, west: 34.50 },
    center: { lat: 23.89, lng: 45.08 },
    children: ['riyadh_region', 'mecca_region', 'medina_region', 'eastern_province'],
    population: 35000000,
    area: 2149690,
    isPreloaded: true,
    estimatedTiles: 25000,
    estimatedSizeMB: 500,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'SA', timezone: 'AST', language: 'Arabic', currency: 'SAR' }
  },
  {
    id: 'malaysia',
    name: 'Malaysia',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 7.36, south: 0.85, east: 119.27, west: 99.64 },
    center: { lat: 4.21, lng: 101.98 },
    children: ['peninsular_malaysia', 'sabah', 'sarawak'],
    population: 33000000,
    area: 329847,
    isPreloaded: true,
    estimatedTiles: 18000,
    estimatedSizeMB: 360,
    isDownloaded: false,
    priority: 3,
    tags: ['country'],
    metadata: { countryCode: 'MY', timezone: 'MYT', language: 'Malay', currency: 'MYR' }
  },
  {
    id: 'uzbekistan',
    name: 'Uzbekistan',
    level: 'country',
    parentId: 'asia',
    bounds: { north: 45.59, south: 37.18, east: 73.14, west: 55.99 },
    center: { lat: 41.38, lng: 64.59 },
    children: ['tashkent_region', 'samarkand_region', 'bukhara_region'],
    population: 34000000,
    area: 447400,
    isPreloaded: true,
    estimatedTiles: 15000,
    estimatedSizeMB: 300,
    isDownloaded: false,
    priority: 3,
    tags: ['country'],
    metadata: { countryCode: 'UZ', timezone: 'UZT', language: 'Uzbek', currency: 'UZS' }
  },

  // AFRICA
  {
    id: 'nigeria',
    name: 'Nigeria',
    level: 'country',
    parentId: 'africa',
    bounds: { north: 13.89, south: 4.24, east: 14.68, west: 2.69 },
    center: { lat: 9.08, lng: 8.68 },
    children: ['lagos_state', 'kano_state', 'rivers_state', 'kaduna_state'],
    population: 218000000,
    area: 923768,
    isPreloaded: true,
    estimatedTiles: 30000,
    estimatedSizeMB: 600,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'NG', timezone: 'WAT', language: 'English', currency: 'NGN' }
  },
  {
    id: 'ethiopia',
    name: 'Ethiopia',
    level: 'country',
    parentId: 'africa',
    bounds: { north: 14.90, south: 3.40, east: 47.99, west: 32.99 },
    center: { lat: 9.15, lng: 40.49 },
    children: ['addis_ababa_region', 'oromia_region', 'amhara_region', 'tigray_region'],
    population: 118000000,
    area: 1104300,
    isPreloaded: true,
    estimatedTiles: 25000,
    estimatedSizeMB: 500,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'ET', timezone: 'EAT', language: 'Amharic', currency: 'ETB' }
  },
  {
    id: 'egypt',
    name: 'Egypt',
    level: 'country',
    parentId: 'africa',
    bounds: { north: 31.67, south: 21.72, east: 36.90, west: 24.70 },
    center: { lat: 26.82, lng: 30.80 },
    children: ['cairo_governorate', 'alexandria_governorate', 'giza_governorate', 'luxor_governorate'],
    population: 104000000,
    area: 1001450,
    isPreloaded: true,
    estimatedTiles: 25000,
    estimatedSizeMB: 500,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'EG', timezone: 'EET', language: 'Arabic', currency: 'EGP' }
  },
  {
    id: 'south_africa',
    name: 'South Africa',
    level: 'country',
    parentId: 'africa',
    bounds: { north: -22.13, south: -34.84, east: 32.89, west: 16.45 },
    center: { lat: -30.56, lng: 22.94 },
    children: ['gauteng', 'western_cape', 'kwazulu_natal', 'eastern_cape'],
    population: 60000000,
    area: 1221037,
    isPreloaded: true,
    estimatedTiles: 25000,
    estimatedSizeMB: 500,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'ZA', timezone: 'SAST', language: 'Multiple', currency: 'ZAR' }
  },
  {
    id: 'kenya',
    name: 'Kenya',
    level: 'country',
    parentId: 'africa',
    bounds: { north: 5.03, south: -4.68, east: 41.91, west: 33.91 },
    center: { lat: -0.02, lng: 37.91 },
    children: ['nairobi_county', 'mombasa_county', 'nakuru_county', 'eldoret_region'],
    population: 54000000,
    area: 580367,
    isPreloaded: true,
    estimatedTiles: 20000,
    estimatedSizeMB: 400,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'KE', timezone: 'EAT', language: 'English/Swahili', currency: 'KES' }
  },

  // OCEANIA  
  {
    id: 'australia',
    name: 'Australia',
    level: 'country',
    parentId: 'oceania',
    bounds: { north: -9.22, south: -54.78, east: 159.11, west: 112.92 },
    center: { lat: -25.27, lng: 133.77 },
    children: ['new_south_wales', 'victoria', 'queensland', 'western_australia', 'south_australia', 'tasmania'],
    population: 26000000,
    area: 7692024,
    isPreloaded: true,
    estimatedTiles: 40000,
    estimatedSizeMB: 800,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'AU', timezone: 'Multiple', language: 'English', currency: 'AUD' }
  },
  {
    id: 'new_zealand',
    name: 'New Zealand',
    level: 'country',
    parentId: 'oceania',
    bounds: { north: -34.13, south: -47.29, east: 178.58, west: 166.51 },
    center: { lat: -40.90, lng: 174.89 },
    children: ['north_island', 'south_island'],
    population: 5000000,
    area: 268838,
    isPreloaded: true,
    estimatedTiles: 15000,
    estimatedSizeMB: 300,
    isDownloaded: false,
    priority: 3,
    tags: ['country', 'major'],
    metadata: { countryCode: 'NZ', timezone: 'NZST', language: 'English', currency: 'NZD' }
  },

  // ==================== STATES/REGIONS ====================
  {
    id: 'california',
    name: 'California',
    level: 'state',
    parentId: 'usa',
    bounds: { north: 42.0, south: 32.53, east: -114.13, west: -124.48 },
    center: { lat: 36.78, lng: -119.42 },
    children: ['los_angeles', 'san_francisco', 'san_diego', 'sacramento', 'fresno', 'oakland'],
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
    children: ['london', 'birmingham', 'manchester', 'liverpool'],
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

  // Denmark Regions
  {
    id: 'capital_region',
    name: 'Capital Region',
    level: 'region',
    parentId: 'denmark',
    bounds: { north: 56.13, south: 55.52, east: 12.77, west: 12.05 },
    center: { lat: 55.88, lng: 12.57 },
    children: ['copenhagen'],
    population: 1850000,
    area: 2561,
    isPreloaded: true,
    estimatedTiles: 3000,
    estimatedSizeMB: 60,
    isDownloaded: false,
    priority: 4,
    tags: ['region'],
    metadata: { countryCode: 'DK' }
  },
  {
    id: 'north_jutland',
    name: 'North Jutland',
    level: 'region',
    parentId: 'denmark',
    bounds: { north: 57.75, south: 56.45, east: 10.90, west: 8.60 },
    center: { lat: 57.05, lng: 9.92 },
    children: ['aalborg'],
    population: 590000,
    area: 7927,
    isPreloaded: true,
    estimatedTiles: 4000,
    estimatedSizeMB: 80,
    isDownloaded: false,
    priority: 4,
    tags: ['region'],
    metadata: { countryCode: 'DK' }
  },
  {
    id: 'central_jutland',
    name: 'Central Jutland',
    level: 'region',
    parentId: 'denmark',
    bounds: { north: 57.00, south: 55.50, east: 11.00, west: 8.50 },
    center: { lat: 56.15, lng: 9.56 },
    children: ['aarhus'],
    population: 1330000,
    area: 13142,
    isPreloaded: true,
    estimatedTiles: 5000,
    estimatedSizeMB: 100,
    isDownloaded: false,
    priority: 4,
    tags: ['region'],
    metadata: { countryCode: 'DK' }
  },
  {
    id: 'zealand',
    name: 'Zealand',
    level: 'region',
    parentId: 'denmark',
    bounds: { north: 56.13, south: 54.96, east: 12.69, west: 11.00 },
    center: { lat: 55.46, lng: 11.73 },
    children: [],
    population: 840000,
    area: 7273,
    isPreloaded: true,
    estimatedTiles: 3500,
    estimatedSizeMB: 70,
    isDownloaded: false,
    priority: 4,
    tags: ['region'],
    metadata: { countryCode: 'DK' }
  },
  {
    id: 'south_denmark',
    name: 'Southern Denmark',
    level: 'region',
    parentId: 'denmark',
    bounds: { north: 56.00, south: 54.80, east: 10.90, west: 8.50 },
    center: { lat: 55.40, lng: 9.40 },
    children: ['odense'],
    population: 1220000,
    area: 12191,
    isPreloaded: true,
    estimatedTiles: 4500,
    estimatedSizeMB: 90,
    isDownloaded: false,
    priority: 4,
    tags: ['region'],
    metadata: { countryCode: 'DK' }
  },

  // ==================== MAJOR CITIES & CAPITALS ====================
  
  // WORLD CAPITALS (TOP 50)
  {
    id: 'washington_dc',
    name: 'Washington, D.C.',
    level: 'city',
    parentId: 'usa',
    bounds: { north: 38.99, south: 38.80, east: -76.91, west: -77.12 },
    center: { lat: 38.91, lng: -77.04 },
    children: ['downtown_dc', 'georgetown', 'dupont_circle', 'adams_morgan'],
    population: 700000,
    area: 177,
    isCapital: true,
    isPreloaded: true,
    estimatedTiles: 3000,
    estimatedSizeMB: 60,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'major'],
    metadata: { countryCode: 'US', timezone: 'EST', language: 'English', currency: 'USD' }
  },
  {
    id: 'ottawa',
    name: 'Ottawa',
    level: 'city',
    parentId: 'ontario',
    bounds: { north: 45.54, south: 45.25, east: -75.48, west: -76.35 },
    center: { lat: 45.42, lng: -75.70 },
    children: ['downtown_ottawa', 'byward_market', 'westboro', 'kanata'],
    population: 1000000,
    area: 2790,
    isCapital: true,
    isPreloaded: true,
    estimatedTiles: 4000,
    estimatedSizeMB: 80,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'major'],
    metadata: { countryCode: 'CA', timezone: 'EST', language: 'English/French', currency: 'CAD' }
  },
  {
    id: 'london',
    name: 'London',
    level: 'city',
    parentId: 'england',
    bounds: { north: 51.69, south: 51.28, east: 0.35, west: -0.51 },
    center: { lat: 51.51, lng: -0.13 },
    children: ['central_london', 'westminster', 'camden', 'greenwich'],
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
    id: 'paris',
    name: 'Paris',
    level: 'city',
    parentId: 'ile_de_france',
    bounds: { north: 48.90, south: 48.82, east: 2.42, west: 2.22 },
    center: { lat: 48.86, lng: 2.35 },
    children: ['1st_arrondissement', '4th_arrondissement', '7th_arrondissement', '16th_arrondissement'],
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
  {
    id: 'berlin',
    name: 'Berlin',
    level: 'city',
    parentId: 'germany',
    bounds: { north: 52.67, south: 52.34, east: 13.76, west: 13.09 },
    center: { lat: 52.52, lng: 13.40 },
    children: ['mitte', 'charlottenburg', 'kreuzberg', 'prenzlauer_berg'],
    population: 3700000,
    area: 892,
    isCapital: true,
    isPreloaded: true,
    estimatedTiles: 5000,
    estimatedSizeMB: 100,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'major'],
    metadata: { countryCode: 'DE', timezone: 'CET', language: 'German', currency: 'EUR' }
  },
  {
    id: 'rome',
    name: 'Rome',
    level: 'city',
    parentId: 'lazio',
    bounds: { north: 42.05, south: 41.77, east: 12.66, west: 12.23 },
    center: { lat: 41.90, lng: 12.50 },
    children: ['centro_storico', 'trastevere', 'vatican_city', 'testaccio'],
    population: 2900000,
    area: 1285,
    isCapital: true,
    isPreloaded: true,
    estimatedTiles: 4500,
    estimatedSizeMB: 90,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'major'],
    metadata: { countryCode: 'IT', timezone: 'CET', language: 'Italian', currency: 'EUR' }
  },
  {
    id: 'madrid',
    name: 'Madrid',
    level: 'city',
    parentId: 'madrid_region',
    bounds: { north: 40.56, south: 40.31, east: -3.52, west: -3.84 },
    center: { lat: 40.42, lng: -3.70 },
    children: ['centro', 'salamanca', 'retiro', 'chamartin'],
    population: 6700000,
    area: 604,
    isCapital: true,
    isPreloaded: true,
    estimatedTiles: 4000,
    estimatedSizeMB: 80,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'major'],
    metadata: { countryCode: 'ES', timezone: 'CET', language: 'Spanish', currency: 'EUR' }
  },
  {
    id: 'copenhagen',
    name: 'Copenhagen',
    level: 'city',
    parentId: 'capital_region',
    bounds: { north: 55.73, south: 55.61, east: 12.65, west: 12.45 },
    center: { lat: 55.68, lng: 12.57 },
    children: ['copenhagen_city_center', 'nørrebro', 'vesterbro', 'østerbro'],
    population: 1350000,
    area: 179,
    isCapital: true,
    isPreloaded: true,
    estimatedTiles: 4000,
    estimatedSizeMB: 80,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'major'],
    metadata: { countryCode: 'DK', timezone: 'CET', language: 'Danish', currency: 'DKK' }
  },
  {
    id: 'aalborg',
    name: 'Aalborg',
    level: 'city',
    parentId: 'north_jutland',
    bounds: { north: 57.08, south: 56.95, east: 10.03, west: 9.85 },
    center: { lat: 57.05, lng: 9.92 },
    children: ['aalborg_center', 'nørresundby', 'aalborg_east', 'aalborg_west'],
    population: 220000,
    area: 139,
    isCapital: false,
    isPreloaded: true,
    estimatedTiles: 2500,
    estimatedSizeMB: 50,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'major'],
    metadata: { countryCode: 'DK', timezone: 'CET', language: 'Danish', currency: 'DKK' }
  },
  {
    id: 'aarhus',
    name: 'Aarhus',
    level: 'city',
    parentId: 'central_jutland',
    bounds: { north: 56.20, south: 56.10, east: 10.25, west: 10.10 },
    center: { lat: 56.15, lng: 10.21 },
    children: ['aarhus_center', 'aarhus_north', 'aarhus_south'],
    population: 350000,
    area: 91,
    isCapital: false,
    isPreloaded: true,
    estimatedTiles: 2800,
    estimatedSizeMB: 56,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'major'],
    metadata: { countryCode: 'DK', timezone: 'CET', language: 'Danish', currency: 'DKK' }
  },
  {
    id: 'odense',
    name: 'Odense',
    level: 'city',
    parentId: 'south_denmark',
    bounds: { north: 55.43, south: 55.35, east: 10.43, west: 10.33 },
    center: { lat: 55.40, lng: 10.40 },
    children: ['odense_center'],
    population: 180000,
    area: 304,
    isCapital: false,
    isPreloaded: true,
    estimatedTiles: 2200,
    estimatedSizeMB: 44,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'major'],
    metadata: { countryCode: 'DK', timezone: 'CET', language: 'Danish', currency: 'DKK' }
  },
  {
    id: 'moscow',
    name: 'Moscow',
    level: 'city',
    parentId: 'moscow_region',
    bounds: { north: 56.01, south: 55.57, east: 37.97, west: 37.32 },
    center: { lat: 55.76, lng: 37.62 },
    children: ['red_square_area', 'tverskoy', 'arbat', 'sokolniki'],
    population: 12500000,
    area: 2511,
    isCapital: true,
    isPreloaded: true,
    estimatedTiles: 7000,
    estimatedSizeMB: 140,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'major'],
    metadata: { countryCode: 'RU', timezone: 'MSK', language: 'Russian', currency: 'RUB' }
  },
  {
    id: 'beijing',
    name: 'Beijing',
    level: 'city',
    parentId: 'beijing_municipality',
    bounds: { north: 40.37, south: 39.44, east: 117.51, west: 115.42 },
    center: { lat: 39.90, lng: 116.40 },
    children: ['forbidden_city_area', 'chaoyang', 'haidian', 'dongcheng'],
    population: 21500000,
    area: 16410,
    isCapital: true,
    isPreloaded: true,
    estimatedTiles: 10000,
    estimatedSizeMB: 200,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'major'],
    metadata: { countryCode: 'CN', timezone: 'CST', language: 'Chinese', currency: 'CNY' }
  },
  {
    id: 'new_delhi',
    name: 'New Delhi',
    level: 'city',
    parentId: 'delhi',
    bounds: { north: 28.88, south: 28.40, east: 77.35, west: 76.84 },
    center: { lat: 28.61, lng: 77.23 },
    children: ['connaught_place', 'old_delhi', 'south_delhi', 'dwarka'],
    population: 32900000,
    area: 1484,
    isCapital: true,
    isPreloaded: true,
    estimatedTiles: 12000,
    estimatedSizeMB: 240,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'capital', 'major'],
    metadata: { countryCode: 'IN', timezone: 'IST', language: 'Hindi/English', currency: 'INR' }
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    level: 'city',
    parentId: 'tokyo_prefecture',
    bounds: { north: 35.90, south: 35.53, east: 139.95, west: 139.56 },
    center: { lat: 35.68, lng: 139.69 },
    children: ['shibuya', 'shinjuku', 'ginza', 'harajuku'],
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

  // MAJOR NON-CAPITAL CITIES (TOP 30)
  {
    id: 'new_york',
    name: 'New York City',
    level: 'city',
    parentId: 'new_york_state',
    bounds: { north: 40.92, south: 40.48, east: -73.70, west: -74.26 },
    center: { lat: 40.71, lng: -74.01 },
    children: ['manhattan', 'brooklyn', 'queens', 'bronx'],
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
    id: 'los_angeles',
    name: 'Los Angeles',
    level: 'city',
    parentId: 'california',
    bounds: { north: 34.34, south: 33.70, east: -117.65, west: -118.67 },
    center: { lat: 34.05, lng: -118.24 },
    children: ['downtown_la', 'hollywood', 'beverly_hills', 'santa_monica'],
    population: 13200000,
    area: 1302,
    isPreloaded: true,
    estimatedTiles: 10000,
    estimatedSizeMB: 200,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'major'],
    metadata: { countryCode: 'US', timezone: 'PST', language: 'English', currency: 'USD' }
  },
  {
    id: 'chicago',
    name: 'Chicago',
    level: 'city',
    parentId: 'illinois',
    bounds: { north: 42.02, south: 41.64, east: -87.52, west: -87.94 },
    center: { lat: 41.88, lng: -87.63 },
    children: ['downtown_chicago', 'north_side', 'south_side', 'west_side'],
    population: 9500000,
    area: 606,
    isPreloaded: true,
    estimatedTiles: 8000,
    estimatedSizeMB: 160,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'major'],
    metadata: { countryCode: 'US', timezone: 'CST', language: 'English', currency: 'USD' }
  },
  {
    id: 'toronto',
    name: 'Toronto',
    level: 'city',
    parentId: 'ontario',
    bounds: { north: 43.86, south: 43.58, east: -79.12, west: -79.64 },
    center: { lat: 43.65, lng: -79.38 },
    children: ['downtown_toronto', 'north_york', 'scarborough', 'etobicoke'],
    population: 6200000,
    area: 630,
    isPreloaded: true,
    estimatedTiles: 6000,
    estimatedSizeMB: 120,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'major'],
    metadata: { countryCode: 'CA', timezone: 'EST', language: 'English', currency: 'CAD' }
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    level: 'city',
    parentId: 'maharashtra',
    bounds: { north: 19.27, south: 18.89, east: 72.97, west: 72.78 },
    center: { lat: 19.08, lng: 72.88 },
    children: ['south_mumbai', 'bandra', 'andheri', 'borivali'],
    population: 20700000,
    area: 603,
    isPreloaded: true,
    estimatedTiles: 8000,
    estimatedSizeMB: 160,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'major'],
    metadata: { countryCode: 'IN', timezone: 'IST', language: 'Hindi/English', currency: 'INR' }
  },
  {
    id: 'shanghai',
    name: 'Shanghai',
    level: 'city',
    parentId: 'shanghai_municipality',
    bounds: { north: 31.89, south: 30.68, east: 122.12, west: 120.86 },
    center: { lat: 31.23, lng: 121.47 },
    children: ['pudong', 'puxi', 'hongkou', 'yangpu'],
    population: 28500000,
    area: 6341,
    isPreloaded: true,
    estimatedTiles: 12000,
    estimatedSizeMB: 240,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'major'],
    metadata: { countryCode: 'CN', timezone: 'CST', language: 'Chinese', currency: 'CNY' }
  },
  {
    id: 'sao_paulo',
    name: 'São Paulo',
    level: 'city',
    parentId: 'sao_paulo_state',
    bounds: { north: -23.36, south: -23.84, east: -46.37, west: -46.83 },
    center: { lat: -23.55, lng: -46.64 },
    children: ['centro', 'zona_sul', 'zona_norte', 'zona_oeste'],
    population: 22400000,
    area: 1521,
    isPreloaded: true,
    estimatedTiles: 10000,
    estimatedSizeMB: 200,
    isDownloaded: false,
    priority: 5,
    tags: ['city', 'major'],
    metadata: { countryCode: 'BR', timezone: 'BRT', language: 'Portuguese', currency: 'BRL' }
  },

  // ==================== CITY SECTIONS ====================
  {
    id: 'manhattan',
    name: 'Manhattan',
    level: 'section',
    parentId: 'new_york',
    bounds: { north: 40.88, south: 40.70, east: -73.91, west: -74.02 },
    center: { lat: 40.78, lng: -73.97 },
    children: [],
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
    children: [],
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
