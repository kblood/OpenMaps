# OpenMaps Quick Start Guide

## 🚀 One-Command Setup

### Windows
```cmd
setup.bat
```

### Linux/Mac
```bash
./setup.sh
```

## 📋 What the Setup Script Does

1. **Checks Dependencies** - Verifies Node.js 18+ and npm are installed
2. **Installs Packages** - Downloads all frontend and backend dependencies
3. **Configures Environment** - Sets up `.env` files and builds the backend
4. **Launches Services** - Starts both frontend (port 3000) and backend (port 3001)
5. **Opens Browser** - Automatically opens http://localhost:3000

## 🛠️ Available Commands

### Setup Options
- `./setup.sh` - Full setup and launch
- `./setup.sh --setup-only` - Install dependencies only
- `./setup.sh --launch-only` - Launch (after setup)
- `./setup.sh --docker` - Use Docker Compose
- `./setup.sh --help` - Show all options

### Manual Commands
```bash
# Frontend development
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # Check code style
npm run typecheck    # Verify TypeScript

# Backend development
cd backend
npm run dev          # Start dev server
npm run build        # Build TypeScript
npm start           # Run production build
```

## 🌐 Application URLs

After setup completes, access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## 📱 Features Available

✅ **Interactive Map** - Pan, zoom, click to place markers
✅ **Address Search** - Type any address or place name
✅ **Current Location** - Click location button to find yourself
✅ **Turn-by-turn Directions** - Get routes between any two points
✅ **Responsive Design** - Works on desktop, tablet, and mobile

## 🐳 Docker Alternative

If you prefer Docker:
```bash
docker-compose up --build
```

## 🔧 Troubleshooting

**Port conflicts**: If ports 3000/3001 are in use, stop other services or modify the ports in `package.json` and `backend/.env`

**Permission errors**: On Linux/Mac, ensure the script is executable: `chmod +x setup.sh`

**Node.js version**: Requires Node.js 18+. Download from https://nodejs.org

**Internet required**: The app uses OpenStreetMap tiles and geocoding services

## 📂 Project Structure

```
OpenMaps/
├── src/                    # React frontend
├── backend/               # Node.js API
├── setup.sh / setup.bat   # Setup scripts
├── docker-compose.yml     # Container setup
└── logs/                  # Application logs
```

That's it! 🎉 OpenMaps should now be running at http://localhost:3000