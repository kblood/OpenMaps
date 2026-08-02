import React, { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin, Navigation, Eye, Copy, Plus } from 'lucide-react';
import { SearchResult } from '../../types';
import { geocodeSearch } from '../../services/geocoding';
import { clsx } from 'clsx';

interface SearchBarProps {
  onLocationSelect: (lat: number, lng: number, name: string) => void;
  placeholder?: string;
  className?: string;
  onMapCenter?: (location: { lat: number; lng: number }, zoom?: number) => void;
  showMapOptions?: boolean;
  clipboard?: Array<{ location: { lat: number; lng: number }; name: string; timestamp: Date }>;
  onClipboardSelect?: (item: { location: { lat: number; lng: number }; name: string }) => void;
  onCreateMapPack?: (result: SearchResult) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onLocationSelect,
  placeholder = "Search for places...",
  className,
  onMapCenter,
  showMapOptions = false,
  clipboard = [],
  onClipboardSelect,
  onCreateMapPack
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();
  const searchRef = useRef<HTMLDivElement>(null);

  // Use clipboard directly - debug code removed

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    try {
      const searchResults = await geocodeSearch(searchQuery);
      setResults(searchResults);
      setShowResults(true);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    setShowResults(true);
    // If no query and we have clipboard items, show them immediately
    if (!query.trim() && clipboard.length > 0) {
      setResults([]);
    }
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    // Delay hiding results to allow clicking on them - increased timeout
    setTimeout(() => {
      setShowResults(false);
    }, 500);
  };

  const handleResultSelect = (result: SearchResult) => {
    setQuery(result.display_name);
    setShowResults(false);
    
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    // Always center the map when a location is selected
    if (onMapCenter) {
      onMapCenter({ lat, lng }, 15);
    }
    
    // Also call the location select handler
    onLocationSelect(lat, lng, result.display_name);
  };

  const handleClipboardSelect = (item: { location: { lat: number; lng: number }; name: string }) => {
    setQuery(item.name);
    setShowResults(false);
    
    // Always center the map when a location is selected from clipboard
    if (onMapCenter) {
      onMapCenter(item.location, 15);
    }
    
    if (onClipboardSelect) {
      onClipboardSelect(item);
    } else {
      onLocationSelect(item.location.lat, item.location.lng, item.name);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    // Keep showing results if we have clipboard items and input is focused
    if (clipboard.length > 0 && isFocused) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  return (
    <div ref={searchRef} className={clsx("relative", className)}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-lg"
        />
        {query && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              onClick={clearSearch}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {showResults && (results.length > 0 || isLoading || (clipboard.length > 0 && (!query.trim() || isFocused))) && (
        <div 
          className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-80 overflow-auto"
          onMouseDown={(e) => {
            // Prevent the input blur when clicking inside dropdown
            e.preventDefault();
          }}
        >
          {/* Clipboard Section - Show when focused and no query, or when no search results */}
          {clipboard.length > 0 && !isLoading && ((!query.trim() && isFocused) || (query.trim() && results.length === 0)) && (
            <>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center text-xs font-medium text-gray-600">
                  <Copy className="h-3 w-3 mr-1" />
                  Recent Locations ({clipboard.length} items)
                </div>
              </div>
              {clipboard.slice(0, 5).map((item, index) => (
                <button
                  key={index}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClipboardSelect(item);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100"
                >
                    <div className="flex items-start">
                      <MapPin className="h-4 w-4 text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.name.split(',')[0]}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {item.name}
                        </p>
                      </div>
                    </div>
                  </button>
              ))}
            </>
          )}
          
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500">
              Searching...
            </div>
          ) : (
            results.map((result) => (
              <div key={result.place_id} className="group">
                <div
                  onClick={() => handleResultSelect(result)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {result.display_name.split(',')[0]}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {result.display_name}
                      </p>
                    </div>
                    {showMapOptions && (
                      <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResultSelect(result);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                          title="View on map"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResultSelect(result);
                          }}
                          className="p-1 text-green-600 hover:bg-green-100 rounded"
                          title="Use as destination"
                        >
                          <Navigation className="h-3 w-3" />
                        </button>
                        {onCreateMapPack && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreateMapPack(result);
                            }}
                            className="p-1 text-purple-600 hover:bg-purple-100 rounded"
                            title="Create map pack for this area"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;