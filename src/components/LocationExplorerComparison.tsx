// Location Explorer Comparison Component
// Shows traditional vs improved location explorer side by side

import React, { useState } from 'react';
import DynamicLocationExplorer from './DynamicLocationExplorer';
import { ImprovedDynamicLocationExplorer } from './ImprovedDynamicLocationExplorer';
import { DynamicLocationNode } from '../services/dynamicLocationService';

interface LocationExplorerComparisonProps {
  onLocationSelect?: (location: DynamicLocationNode, path: string) => void;
  onLocationDownload?: (location: DynamicLocationNode) => void;
}

export const LocationExplorerComparison: React.FC<LocationExplorerComparisonProps> = ({
  onLocationSelect,
  onLocationDownload
}) => {
  const [selectedTab, setSelectedTab] = useState<'traditional' | 'improved' | 'side-by-side'>('side-by-side');

  const handleLocationSelect = (location: DynamicLocationNode, path: string) => {
    console.log('Location selected:', { location, path });
    onLocationSelect?.(location, path);
  };

  const handleLocationSelectTraditional = (location: DynamicLocationNode) => {
    console.log('Location selected (traditional):', location);
    onLocationSelect?.(location, 'traditional');
  };

  const handleLocationDownload = (location: DynamicLocationNode) => {
    console.log('Location download requested:', location);
    onLocationDownload?.(location);
  };

  return (
    <div className="location-explorer-comparison h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setSelectedTab('traditional')}
          className={`px-4 py-2 text-sm font-medium ${
            selectedTab === 'traditional'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🌳 Traditional Explorer
        </button>
        <button
          onClick={() => setSelectedTab('improved')}
          className={`px-4 py-2 text-sm font-medium ${
            selectedTab === 'improved'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🚀 Improved Explorer
        </button>
        <button
          onClick={() => setSelectedTab('side-by-side')}
          className={`px-4 py-2 text-sm font-medium ${
            selectedTab === 'side-by-side'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📊 Side-by-Side Comparison
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {selectedTab === 'traditional' && (
          <div className="h-full p-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <h3 className="font-semibold text-yellow-800 mb-1">Traditional Tree Explorer</h3>
              <p className="text-sm text-yellow-700">
                Classic tree navigation with separate cache for each branch. 
                Notice slower loading times and redundant API calls when revisiting locations.
              </p>
            </div>
            <DynamicLocationExplorer
              onLocationSelect={handleLocationSelectTraditional}
              onDownload={handleLocationDownload}
              className="h-full"
            />
          </div>
        )}

        {selectedTab === 'improved' && (
          <div className="h-full p-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <h3 className="font-semibold text-green-800 mb-1">Improved Graph-Based Explorer</h3>
              <p className="text-sm text-green-700">
                Advanced explorer with shared cache, intelligent loading, and multiple tree views.
                Experience instant loading for previously accessed locations.
              </p>
            </div>
            <ImprovedDynamicLocationExplorer
              onLocationSelect={handleLocationSelect}
              onLocationDownload={handleLocationDownload}
              enableMultipleViews={true}
              showPerformanceStats={true}
              className="h-full"
            />
          </div>
        )}

        {selectedTab === 'side-by-side' && (
          <div className="h-full flex">
            {/* Traditional Explorer */}
            <div className="flex-1 border-r border-gray-200">
              <div className="bg-yellow-50 border-b border-yellow-200 p-3">
                <h3 className="font-semibold text-yellow-800 mb-1">🌳 Traditional Explorer</h3>
                <p className="text-xs text-yellow-700">
                  Separate cache per branch • Redundant API calls • Slower performance
                </p>
              </div>
              <div className="h-full overflow-auto">
                <DynamicLocationExplorer
                  onLocationSelect={handleLocationSelectTraditional}
                  onDownload={handleLocationDownload}
                />
              </div>
            </div>

            {/* Improved Explorer */}
            <div className="flex-1">
              <div className="bg-green-50 border-b border-green-200 p-3">
                <h3 className="font-semibold text-green-800 mb-1">🚀 Improved Explorer</h3>
                <p className="text-xs text-green-700">
                  Shared cache • Intelligent loading • Performance monitoring
                </p>
              </div>
              <div className="h-full overflow-auto">
                <ImprovedDynamicLocationExplorer
                  onLocationSelect={handleLocationSelect}
                  onLocationDownload={handleLocationDownload}
                  enableMultipleViews={true}
                  showPerformanceStats={true}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border-t border-blue-200 p-3">
        <h4 className="font-semibold text-blue-800 text-sm mb-1">💡 Testing Instructions</h4>
        <div className="text-xs text-blue-700 space-y-1">
          <p>1. Navigate to the same location using both explorers</p>
          <p>2. Notice how the improved version loads instantly on revisit</p>
          <p>3. Use search functionality to see path optimization</p>
          <p>4. Compare performance stats and cache indicators</p>
        </div>
      </div>
    </div>
  );
};

export default LocationExplorerComparison;
