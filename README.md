# OpenMaps

A comprehensive open-source Google Maps alternative built with modern web technologies.

## Features

- 🗺️ Interactive maps with OpenStreetMap data
- 🔍 Address search and geocoding
- 🧭 Turn-by-turn routing and navigation
- 📱 Responsive design for mobile and desktop
- 🎯 Current location detection
- 📍 Click-to-add markers
- 🛣️ Multiple route alternatives
- 🏪 Places and points of interest search

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
- **OpenStreetMap** for map tiles and data
- **Nominatim** for geocoding
- **OSRM** for routing
- **Overpass API** for places data

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
- `GET /api/routing/directions?start={lat,lng}&end={lat,lng}` - Get route
- `GET /api/routing/alternatives?start={lat,lng}&end={lat,lng}` - Get route alternatives
- `POST /api/routing/matrix` - Get route matrix

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
```

**Frontend**
```env
VITE_API_URL=http://localhost:3001/api
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OpenStreetMap contributors for map data
- Nominatim for geocoding services
- OSRM for routing capabilities
- Leaflet for the mapping library

## Roadmap

- [ ] Offline map support
- [ ] Public transit routing
- [ ] Real-time traffic data
- [ ] Street view integration
- [ ] Advanced place categories
- [ ] User accounts and saved places
- [ ] Mobile app versions