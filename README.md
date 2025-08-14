# OpenMaps

A comprehensive open-source Google Maps alternative built with modern web technologies.

## Features

- 🗺️ Interactive maps with OpenStreetMap data
- 🔍 Advanced address search and geocoding with autocomplete
- 🧭 Enhanced multi-modal routing and navigation
  - 🚗 **Driving** routes with OSRM (fastest performance)
  - 🚶 **Walking** routes with enhanced footway/sidewalk support
  - 🏃 **Running** routes with path and trail support
  - 🚴 **Cycling** routes with bike lane and path coverage
  - 🥾 **Hiking** trails with difficulty ratings
  - 🚵 **Mountain biking** trails and off-road paths
  - 🏁 **Racing bike** road cycling optimized for speed
- 📱 Responsive design for mobile and desktop
- 🎯 Current location detection with geolocation
- 📍 Interactive click-to-add markers with map integration
- 🛣️ Multiple route alternatives with intelligent service selection
- 🏪 Places and points of interest search with categories
- 📋 **Recent locations clipboard** with quick access dropdown
- 🗂️ Route history and saved routes functionality
- 🎨 Modern UI with Tailwind CSS and intuitive controls

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Leaflet** for interactive maps
- **Tailwind CSS** for styling
- **Vite** for build tooling

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **Redis** for caching
- **Axios** for HTTP requests

### Data Sources
- **OpenStreetMap** for map tiles and comprehensive map data
- **Nominatim** for forward and reverse geocoding
- **OSRM** for high-performance driving routes
- **Valhalla** for pedestrian and cycling routes with superior path coverage
- **GraphHopper** for specialized routing profiles (fallback)
- **Overpass API** for places and points of interest data

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Docker and Docker Compose (optional)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/openmaps.git
   cd openmaps
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Set up environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit the .env file with your configuration
   ```

5. **Start the development servers**
   
   **Option 1: Using npm scripts**
   ```bash
   # Terminal 1 - Frontend
   npm run dev
   
   # Terminal 2 - Backend
   cd backend
   npm run dev
   ```
   
   **Option 2: Using Docker Compose**
   ```bash
   docker-compose up --build
   ```

6. **Open your browser**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

### Production Deployment

1. **Build the applications**
   ```bash
   # Frontend
   npm run build
   
   # Backend
   cd backend
   npm run build
   ```

2. **Deploy using Docker**
   ```bash
   docker-compose -f docker-compose.prod.yml up --build -d
   ```

## API Endpoints

### Geocoding
- `GET /api/geocoding/search?q={query}` - Forward geocoding
- `GET /api/geocoding/reverse?lat={lat}&lon={lon}` - Reverse geocoding
- `GET /api/geocoding/autocomplete?q={query}` - Search suggestions

### Routing
- `GET /api/routing/directions?start={lat,lng}&end={lat,lng}&profile={mode}` - Get route with mode selection
- `GET /api/routing/alternatives?start={lat,lng}&end={lat,lng}&profile={mode}` - Get route alternatives
- `POST /api/routing/matrix` - Get route matrix for multiple points

**Supported Profiles**: `driving`, `walking`, `running`, `cycling`, `hiking`, `mountain_biking`, `racing_bike`

### Places
- `GET /api/places/search?q={query}` - Search places
- `GET /api/places/{id}` - Get place details
- `GET /api/places/nearby/{category}?lat={lat}&lon={lon}` - Find nearby places

## Configuration

### Environment Variables

**Backend (.env)**
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
CACHE_TTL=300

# Routing Services
OSRM_BASE_URL=https://router.project-osrm.org/route/v1
VALHALLA_BASE_URL=https://valhalla1.openstreetmap.de
GRAPHHOPPER_BASE_URL=https://graphhopper.com/api/1/route
# GRAPHHOPPER_API_KEY=your_api_key_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Frontend**
```env
VITE_API_URL=http://localhost:3001/api
```

## Key Features Deep Dive

### Enhanced Multi-Modal Routing

OpenMaps uses intelligent routing service selection to provide the best routes for different transportation modes:

- **OSRM** for driving routes - optimized for speed and performance
- **Valhalla** for pedestrian and cycling routes - superior coverage of footways, bike paths, and trails
- **Automatic fallback** to ensure routing always works

### Recent Locations Clipboard

The application maintains a clipboard of recently accessed locations:
- Automatically saves locations from searches and map clicks
- Quick access dropdown in routing search fields  
- Persistent storage using localStorage
- Click any recent location to instantly populate route fields

### Advanced UI Components

- **SearchBar** with autocomplete and recent locations dropdown
- **RoutePanel** with comprehensive mode selection and options
- **Interactive Map** with click-to-route functionality
- **Route Analytics** with detailed metrics and alternatives

## Troubleshooting

### Recent Addresses Dropdown Issues

If the recent addresses dropdown isn't working:

1. **Check Browser Console**: Look for JavaScript errors or network issues
2. **Clear localStorage**: Recent locations are stored in browser localStorage
3. **Verify API Connection**: Ensure the backend is running and accessible
4. **Try Different Browser**: Rule out browser-specific issues

### Routing Issues

If routes aren't calculating properly:

1. **Check Network**: Verify connection to routing services
2. **Try Different Profiles**: Some profiles may not be available in all regions  
3. **Check Coordinates**: Ensure start/end points are valid coordinates
4. **Review Logs**: Check browser console and server logs for errors

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenStreetMap contributors for comprehensive map data
- Nominatim for reliable geocoding services
- OSRM for high-performance driving routing
- Valhalla for advanced pedestrian and cycling routing
- GraphHopper for specialized routing profiles
- Leaflet for the excellent mapping library
- Tailwind CSS for modern styling capabilities

## Roadmap

### Completed ✅
- [x] Multi-modal routing with intelligent service selection
- [x] Recent locations clipboard with persistent storage
- [x] Enhanced pedestrian and cycling route coverage
- [x] Comprehensive UI improvements and bug fixes
- [x] Route history and saved routes functionality

### In Progress 🚧
- [ ] Advanced route optimization algorithms
- [ ] Enhanced error handling and user feedback
- [ ] Performance optimizations for large datasets

### Planned 📋
- [ ] Offline map support with tile caching
- [ ] Public transit routing integration
- [ ] Real-time traffic data overlay
- [ ] Street view integration
- [ ] Advanced place categories and filtering
- [ ] User accounts with cloud sync
- [ ] Mobile app versions (React Native)
- [ ] Voice-guided navigation
- [ ] Route sharing and social features