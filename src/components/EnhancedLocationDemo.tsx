// Enhanced Location Explorer Demo
// Demonstrates the improved polygon-based location system

import React, { useState, useEffect } from 'react';
import { enhancedLocationService, AdministrativeBoundary, ValidationResult, TileCoordinate } from '../services/enhancedLocationService';

interface LocationDemoProps {
  onLocationSelect?: (location: AdministrativeBoundary) => void;
}

interface LocationTestResult {
  location: AdministrativeBoundary;
  validation: ValidationResult;
  tiles: TileCoordinate[];
  issues: string[];
  recommendations: string[];
}

export const EnhancedLocationDemo: React.FC<LocationDemoProps> = ({ onLocationSelect }) => {
  const [countries, setCountries] = useState<AdministrativeBoundary[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<AdministrativeBoundary | null>(null);
  const [states, setStates] = useState<AdministrativeBoundary[]>([]);
  const [selectedState, setSelectedState] = useState<AdministrativeBoundary | null>(null);
  const [cities, setCities] = useState<AdministrativeBoundary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdministrativeBoundary[]>([]);
  const [testResults, setTestResults] = useState<LocationTestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    setIsLoading(true);
    setCurrentTest('Loading countries from Natural Earth...');
    
    try {
      const countryList = await enhancedLocationService.getCountries();
      setCountries(countryList);
      console.log(`✅ Loaded ${countryList.length} countries`);
    } catch (error) {
      console.error('Failed to load countries:', error);
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
  };

  const handleCountrySelect = async (country: AdministrativeBoundary) => {
    setSelectedCountry(country);
    setSelectedState(null);
    setCities([]);
    setIsLoading(true);
    setCurrentTest(`Loading states for ${country.name}...`);
    
    try {
      const stateList = await enhancedLocationService.getStates(country.id);
      setStates(stateList);
      console.log(`✅ Loaded ${stateList.length} states for ${country.name}`);
    } catch (error) {
      console.error(`Failed to load states for ${country.name}:`, error);
      setStates([]);
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
    
    onLocationSelect?.(country);
  };

  const handleStateSelect = async (state: AdministrativeBoundary) => {
    setSelectedState(state);
    setCities([]);
    setIsLoading(true);
    setCurrentTest(`Loading cities for ${state.name}...`);
    
    try {
      const cityList = await enhancedLocationService.getCities(state.id);
      setCities(cityList);
      console.log(`✅ Loaded ${cityList.length} cities for ${state.name}`);
    } catch (error) {
      console.error(`Failed to load cities for ${state.name}:`, error);
      setCities([]);
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
    
    onLocationSelect?.(state);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setCurrentTest(`Searching for "${searchQuery}"...`);
    
    try {
      const results = await enhancedLocationService.searchLocations(searchQuery);
      setSearchResults(results);
      console.log(`🔍 Found ${results.length} results for "${searchQuery}"`);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
      setCurrentTest('');
    }
  };

  const runLocationTests = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    const testLocations = [
      'United States',
      'Denmark',
      'California',
      'Copenhagen',
      'Non-existent Place'
    ];

    for (const locationName of testLocations) {
      setCurrentTest(`Testing ${locationName}...`);
      
      try {
        // Search for the location
        const searchResults = await enhancedLocationService.searchLocations(locationName);
        
        if (searchResults.length > 0) {
          const location = searchResults[0];
          
          // Validate the location
          const validation = await enhancedLocationService.validateLocation(location.id);
          
          // Calculate tiles (small sample)
          const tiles = await enhancedLocationService.calculateTilesForBoundary(location, 1, 5);
          
          const testResult: LocationTestResult = {
            location,
            validation,
            tiles: tiles.slice(0, 100), // Limit for display
            issues: validation.issues,
            recommendations: validation.recommendations
          };
          
          setTestResults(prev => [...prev, testResult]);
        } else {
          // Create a "not found" result
          const notFoundResult: LocationTestResult = {
            location: {
              id: `not_found_${locationName}`,
              name: locationName,
              type: 'place',
              geometry: { type: 'Polygon', coordinates: [] },
              centroid: [0, 0],
              bbox: [0, 0, 0, 0],
              parent: undefined,
              children: [],
              metadata: {
                confidence: 0,
                lastUpdated: Date.now(),
                source: 'Not Found'
              },
              estimatedTiles: 0,
              estimatedSizeMB: 0
            },
            validation: {
              isValid: false,
              exists: false,
              hasValidGeometry: false,
              qualityScore: 0,
              issues: ['Location not found'],
              recommendations: ['Verify spelling or try alternative names']
            },
            tiles: [],
            issues: ['Location not found in any data source'],
            recommendations: ['Verify spelling or try alternative names']
          };
          
          setTestResults(prev => [...prev, notFoundResult]);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Test failed for ${locationName}:`, error);
      }
    }
    
    setIsLoading(false);
    setCurrentTest('');
  };

  const getQualityColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getQualityLabel = (score: number): string => {
    if (score >= 0.8) return 'High Quality';
    if (score >= 0.6) return 'Medium Quality';
    if (score > 0) return 'Low Quality';
    return 'Not Found';
  };

  return (
    <div className="enhanced-location-demo p-6 bg-white rounded-lg shadow-lg">
      <div className="header mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          🌍 Enhanced Location System Demo
        </h2>
        <p className="text-gray-600 text-sm">
          Polygon-based administrative boundaries with quality validation and accurate tile calculation
        </p>
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="loading mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-blue-700">{currentTest}</span>
          </div>
        </div>
      )}

      {/* Search Section */}
      <div className="search-section mb-6">
        <h3 className="text-lg font-semibold mb-3">🔍 Location Search</h3>
        <div className="flex space-x-2 mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search for countries, states, cities..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={isLoading || !searchQuery.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>
        
        {searchResults.length > 0 && (
          <div className="search-results">
            <h4 className="font-medium text-gray-700 mb-2">Search Results:</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="p-2 border border-gray-200 rounded cursor-pointer hover:bg-blue-50"
                  onClick={() => onLocationSelect?.(result)}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{result.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500 capitalize">{result.type}</span>
                      <span className={`text-xs font-medium ${getQualityColor(result.metadata.confidence)}`}>
                        {getQualityLabel(result.metadata.confidence)}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    ~{result.estimatedTiles.toLocaleString()} tiles, {result.estimatedSizeMB}MB
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hierarchical Navigation */}
      <div className="hierarchy-section mb-6">
        <h3 className="text-lg font-semibold mb-3">🗺️ Hierarchical Navigation</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Countries */}
          <div className="country-selector">
            <h4 className="font-medium text-gray-700 mb-2">Countries ({countries.length})</h4>
            <div className="h-40 overflow-y-auto border border-gray-200 rounded-lg">
              {countries.slice(0, 20).map((country) => (
                <div
                  key={country.id}
                  className={`p-2 cursor-pointer hover:bg-blue-50 ${
                    selectedCountry?.id === country.id ? 'bg-blue-100 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => handleCountrySelect(country)}
                >
                  <div className="font-medium text-sm">{country.name}</div>
                  <div className="text-xs text-gray-500">
                    {country.metadata.iso_a3} • {country.estimatedSizeMB}MB
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* States */}
          <div className="state-selector">
            <h4 className="font-medium text-gray-700 mb-2">
              States ({states.length})
              {selectedCountry && <span className="text-sm text-gray-500"> - {selectedCountry.name}</span>}
            </h4>
            <div className="h-40 overflow-y-auto border border-gray-200 rounded-lg">
              {states.map((state) => (
                <div
                  key={state.id}
                  className={`p-2 cursor-pointer hover:bg-blue-50 ${
                    selectedState?.id === state.id ? 'bg-blue-100 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => handleStateSelect(state)}
                >
                  <div className="font-medium text-sm">{state.name}</div>
                  <div className="text-xs text-gray-500">
                    {state.estimatedTiles.toLocaleString()} tiles • {state.estimatedSizeMB}MB
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cities */}
          <div className="city-selector">
            <h4 className="font-medium text-gray-700 mb-2">
              Cities ({cities.length})
              {selectedState && <span className="text-sm text-gray-500"> - {selectedState.name}</span>}
            </h4>
            <div className="h-40 overflow-y-auto border border-gray-200 rounded-lg">
              {cities.map((city) => (
                <div
                  key={city.id}
                  className="p-2 cursor-pointer hover:bg-blue-50"
                  onClick={() => onLocationSelect?.(city)}
                >
                  <div className="font-medium text-sm">{city.name}</div>
                  <div className="text-xs text-gray-500">
                    {city.estimatedTiles.toLocaleString()} tiles • {city.estimatedSizeMB}MB
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quality Testing */}
      <div className="testing-section mb-6">
        <h3 className="text-lg font-semibold mb-3">🧪 Location Quality Testing</h3>
        <button
          onClick={runLocationTests}
          disabled={isLoading}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {isLoading ? '🔄 Running Tests...' : '▶️ Run Location Tests'}
        </button>

        {testResults.length > 0 && (
          <div className="test-results space-y-3">
            {testResults.map((result, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-gray-800">{result.location.name}</h4>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded ${
                      result.validation.isValid 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {result.validation.exists ? '✅ Found' : '❌ Not Found'}
                    </span>
                    <span className={`text-sm font-medium ${getQualityColor(result.validation.qualityScore)}`}>
                      {(result.validation.qualityScore * 100).toFixed(0)}% Quality
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <strong>Type:</strong> {result.location.type}<br/>
                    <strong>Source:</strong> {result.location.metadata.source}<br/>
                    <strong>Tiles:</strong> {result.tiles.length.toLocaleString()}
                  </div>
                  <div>
                    <strong>Geometry:</strong> {result.validation.hasValidGeometry ? '✅ Valid' : '❌ Invalid'}<br/>
                    <strong>Size:</strong> {result.location.estimatedSizeMB}MB<br/>
                    <strong>Confidence:</strong> {(result.location.metadata.confidence * 100).toFixed(0)}%
                  </div>
                  <div>
                    {result.issues.length > 0 && (
                      <>
                        <strong className="text-red-600">Issues:</strong>
                        <ul className="text-red-600 text-xs">
                          {result.issues.map((issue, i) => (
                            <li key={i}>• {issue}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="summary bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">🎯 Enhanced System Benefits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <h4 className="font-medium">Data Quality Improvements:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Polygon-based boundaries vs coordinate points</li>
              <li>Quality validation and confidence scores</li>
              <li>Multiple authoritative data sources</li>
              <li>Proper administrative hierarchy</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium">Technical Enhancements:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Accurate tile calculation from polygons</li>
              <li>Existence validation before download</li>
              <li>Size estimation based on real geometry</li>
              <li>Fallback mechanisms for reliability</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedLocationDemo;
