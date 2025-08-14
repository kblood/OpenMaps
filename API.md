# OpenMaps API Documentation

## Base URL
```
http://localhost:3001/api
```

## Authentication
Currently, the API does not require authentication. All endpoints are publicly accessible with rate limiting applied.

## Rate Limiting
- **Limit**: 100 requests per 15 minutes per IP address
- **Headers**: Rate limit information is included in response headers
- **Exceeded**: Returns `429 Too Many Requests` when limit is exceeded

## Response Format
All API responses follow a consistent JSON format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": { ... }
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

## Endpoints

### Health Check

#### GET /health
Check the API service health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "uptime": 3600.123
}
```

---

## Geocoding Endpoints

### Forward Geocoding

#### GET /api/geocoding/search
Convert an address or place name to coordinates.

**Parameters:**
- `q` (string, required) - Search query (address, place name, or coordinates)
- `limit` (number, optional) - Maximum number of results (default: 10, max: 50)
- `countrycodes` (string, optional) - Comma-separated ISO country codes to limit search
- `format` (string, optional) - Response format: "json" or "geojson" (default: "json")

**Example Request:**
```
GET /api/geocoding/search?q=Empire State Building&limit=5
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "place_id": "12345",
        "display_name": "Empire State Building, 350 5th Ave, New York, NY 10118, USA",
        "lat": "40.7484405",
        "lon": "-73.9878584",
        "type": "building",
        "importance": 0.9,
        "boundingbox": ["40.7481", "40.7488", "-73.9882", "-73.9875"],
        "address": {
          "building": "Empire State Building",
          "house_number": "350",
          "road": "5th Avenue",
          "city": "New York",
          "state": "New York",
          "postcode": "10118",
          "country": "United States"
        }
      }
    ],
    "query": "Empire State Building",
    "total": 1
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

### Reverse Geocoding

#### GET /api/geocoding/reverse
Convert coordinates to an address.

**Parameters:**
- `lat` (number, required) - Latitude (-90 to 90)
- `lon` (number, required) - Longitude (-180 to 180)
- `zoom` (number, optional) - Level of detail (1-18, default: 18)
- `format` (string, optional) - Response format: "json" or "geojson" (default: "json")

**Example Request:**
```
GET /api/geocoding/reverse?lat=40.7484405&lon=-73.9878584&zoom=18
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "place_id": "12345",
    "display_name": "350 5th Avenue, Midtown South, Manhattan, New York County, New York, 10118, United States",
    "lat": "40.7484405",
    "lon": "-73.9878584",
    "address": {
      "house_number": "350",
      "road": "5th Avenue",
      "suburb": "Midtown South",
      "city_district": "Manhattan",
      "county": "New York County",
      "state": "New York",
      "postcode": "10118",
      "country": "United States",
      "country_code": "us"
    }
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

### Autocomplete

#### GET /api/geocoding/autocomplete
Get search suggestions for partial queries.

**Parameters:**
- `q` (string, required) - Partial search query (minimum 3 characters)
- `limit` (number, optional) - Maximum number of suggestions (default: 5, max: 20)
- `countrycodes` (string, optional) - Comma-separated ISO country codes

**Example Request:**
```
GET /api/geocoding/autocomplete?q=empire&limit=5
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "display_name": "Empire State Building, New York, NY, USA",
        "lat": "40.7484405",
        "lon": "-73.9878584",
        "type": "building"
      },
      {
        "display_name": "Empire, NY, USA",
        "lat": "43.3312",
        "lon": "-76.0352",
        "type": "city"
      }
    ],
    "query": "empire"
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

---

## Routing Endpoints

### Calculate Route

#### GET /api/routing/directions
Calculate a route between two or more points.

**Parameters:**
- `start` (string, required) - Start coordinates in format "lat,lng"
- `end` (string, required) - End coordinates in format "lat,lng"
- `waypoints` (string, optional) - Intermediate points in format "lat1,lng1;lat2,lng2"
- `profile` (string, optional) - Routing profile: "driving", "walking", "cycling" (default: "driving")
- `alternatives` (boolean, optional) - Include alternative routes (default: false)
- `steps` (boolean, optional) - Include turn-by-turn instructions (default: true)
- `geometries` (string, optional) - Geometry format: "geojson", "polyline", "polyline6" (default: "geojson")

**Example Request:**
```
GET /api/routing/directions?start=40.7484405,-73.9878584&end=40.7589,-73.9851&profile=driving&alternatives=true&steps=true
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "routes": [
      {
        "distance": 1250.5,
        "duration": 180.2,
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [-73.9878584, 40.7484405],
            [-73.9875, 40.7490],
            [-73.9851, 40.7589]
          ]
        },
        "legs": [
          {
            "distance": 1250.5,
            "duration": 180.2,
            "steps": [
              {
                "distance": 150.2,
                "duration": 25.1,
                "instruction": "Head north on 5th Avenue",
                "maneuver": {
                  "type": "depart",
                  "location": [-73.9878584, 40.7484405]
                }
              },
              {
                "distance": 300.8,
                "duration": 45.3,
                "instruction": "Turn right onto East 42nd Street",
                "maneuver": {
                  "type": "turn",
                  "modifier": "right",
                  "location": [-73.9875, 40.7490]
                }
              }
            ]
          }
        ]
      }
    ],
    "waypoints": [
      {
        "name": "5th Avenue",
        "location": [-73.9878584, 40.7484405]
      },
      {
        "name": "Central Park South",
        "location": [-73.9851, 40.7589]
      }
    ]
  },
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

### Route Alternatives

#### GET /api/routing/alternatives
Get multiple route options between two points.

**Parameters:**
- `start` (string, required) - Start coordinates in format "lat,lng"
- `end` (string, required) - End coordinates in format "lat,lng"
- `profile` (string, optional) - Routing profile (default: "driving")
- `number` (number, optional) - Number of alternatives (1-3, default: 3)

**Example Response:**
```json
{
  "success": true,
  "data": {
    "routes": [
      {
        "id": "route_1",
        "distance": 1250.5,
        "duration": 180.2,
        "description": "Fastest route via 5th Avenue",
        "geometry": { ... }
      },
      {
        "id": "route_2",
        "distance": 1380.7,
        "duration": 195.8,
        "description": "Alternative via Park Avenue",
        "geometry": { ... }
      }
    ]
  }
}
```

### Route Matrix

#### POST /api/routing/matrix
Calculate travel times and distances between multiple points.

**Request Body:**
```json
{
  "sources": [
    {"lat": 40.7484405, "lng": -73.9878584},
    {"lat": 40.7589, "lng": -73.9851}
  ],
  "destinations": [
    {"lat": 40.7614, "lng": -73.9776},
    {"lat": 40.7505, "lng": -73.9934}
  ],
  "profile": "driving"
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "durations": [
      [120.5, 340.2],
      [180.1, 250.8]
    ],
    "distances": [
      [850.3, 2100.7],
      [1200.5, 1750.2]
    ],
    "sources": [
      {"lat": 40.7484405, "lng": -73.9878584},
      {"lat": 40.7589, "lng": -73.9851}
    ],
    "destinations": [
      {"lat": 40.7614, "lng": -73.9776},
      {"lat": 40.7505, "lng": -73.9934}
    ]
  }
}
```

---

## Places Endpoints

### Search Places

#### GET /api/places/search
Search for places, points of interest, and businesses.

**Parameters:**
- `q` (string, required) - Search query
- `lat` (number, optional) - Latitude for proximity search
- `lon` (number, optional) - Longitude for proximity search
- `radius` (number, optional) - Search radius in meters (default: 5000, max: 50000)
- `category` (string, optional) - Place category filter
- `limit` (number, optional) - Maximum results (default: 20, max: 100)

**Example Request:**
```
GET /api/places/search?q=coffee&lat=40.7484405&lon=-73.9878584&radius=1000&limit=10
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "places": [
      {
        "id": "place_12345",
        "name": "Starbucks Coffee",
        "category": "cafe",
        "lat": 40.7490,
        "lon": -73.9870,
        "address": "350 5th Ave, New York, NY 10118",
        "distance": 85.2,
        "rating": 4.2,
        "opening_hours": "06:00-22:00",
        "phone": "+1-212-555-0123",
        "website": "https://starbucks.com",
        "amenities": ["wifi", "takeaway", "wheelchair_accessible"]
      }
    ],
    "total": 15,
    "query": "coffee"
  }
}
```

### Get Place Details

#### GET /api/places/{id}
Get detailed information about a specific place.

**Parameters:**
- `id` (string, required) - Place ID

**Example Response:**
```json
{
  "success": true,
  "data": {
    "place": {
      "id": "place_12345",
      "name": "Empire State Building",
      "category": "tourist_attraction",
      "lat": 40.7484405,
      "lon": -73.9878584,
      "address": {
        "full": "350 5th Ave, New York, NY 10118, USA",
        "street": "350 5th Avenue",
        "city": "New York",
        "state": "NY",
        "postal_code": "10118",
        "country": "USA"
      },
      "contact": {
        "phone": "+1-212-736-3100",
        "website": "https://www.esbnyc.com",
        "email": "info@esbnyc.com"
      },
      "details": {
        "description": "Iconic Art Deco skyscraper and tourist attraction",
        "opening_hours": {
          "monday": "08:00-02:00",
          "tuesday": "08:00-02:00",
          "wednesday": "08:00-02:00",
          "thursday": "08:00-02:00",
          "friday": "08:00-02:00",
          "saturday": "08:00-02:00",
          "sunday": "08:00-02:00"
        },
        "price_level": 3,
        "rating": 4.5,
        "reviews_count": 45230
      },
      "amenities": [
        "elevator",
        "gift_shop",
        "restaurant",
        "observation_deck",
        "wheelchair_accessible"
      ]
    }
  }
}
```

### Nearby Places

#### GET /api/places/nearby/{category}
Find places of a specific category near a location.

**Parameters:**
- `category` (string, required) - Place category (e.g., "restaurant", "hotel", "hospital")
- `lat` (number, required) - Latitude
- `lon` (number, required) - Longitude
- `radius` (number, optional) - Search radius in meters (default: 1000, max: 10000)
- `limit` (number, optional) - Maximum results (default: 20, max: 50)

**Available Categories:**
- `restaurant`, `cafe`, `bar`, `food`
- `hotel`, `accommodation`
- `hospital`, `pharmacy`, `doctor`
- `bank`, `atm`
- `gas_station`, `parking`
- `tourist_attraction`, `museum`
- `shopping`, `supermarket`
- `school`, `university`, `library`

**Example Request:**
```
GET /api/places/nearby/restaurant?lat=40.7484405&lon=-73.9878584&radius=500&limit=10
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_COORDINATES` | Invalid latitude or longitude values |
| `MISSING_PARAMETERS` | Required parameters are missing |
| `INVALID_PARAMETERS` | Parameter values are invalid |
| `GEOCODING_ERROR` | External geocoding service error |
| `ROUTING_ERROR` | External routing service error |
| `PLACES_ERROR` | External places service error |
| `CACHE_ERROR` | Cache service unavailable |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |
| `SERVICE_UNAVAILABLE` | External service unavailable |

## Response Headers

All API responses include these headers:
- `X-RateLimit-Limit` - Request limit per window
- `X-RateLimit-Remaining` - Remaining requests in current window
- `X-RateLimit-Reset` - Time when the rate limit resets
- `X-Response-Time` - Request processing time in milliseconds
- `Cache-Control` - Caching directives

## SDKs and Examples

### JavaScript/TypeScript
```typescript
// Example geocoding request
const response = await fetch('/api/geocoding/search?q=Central Park');
const data = await response.json();

if (data.success) {
  const location = data.data.results[0];
  console.log(`Found: ${location.display_name} at ${location.lat}, ${location.lon}`);
}
```

### Python
```python
import requests

# Example routing request
response = requests.get(
    'http://localhost:3001/api/routing/directions',
    params={
        'start': '40.7484405,-73.9878584',
        'end': '40.7589,-73.9851',
        'profile': 'walking'
    }
)

data = response.json()
if data['success']:
    route = data['data']['routes'][0]
    print(f"Distance: {route['distance']}m, Duration: {route['duration']}s")
```

## Changelog

### v1.0.0 (Current)
- Initial API release
- Geocoding endpoints
- Routing endpoints
- Places search endpoints
- Rate limiting
- Redis caching

### Future Versions
- Authentication and API keys
- Webhooks for real-time updates
- Bulk operations
- Extended place categories
- Traffic-aware routing
