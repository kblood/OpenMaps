import React, { useState, useEffect } from 'react';
import { CustomMapPack } from '../services/globalMapPackSystem';

interface CopyMapPackModalProps {
  originalPack: CustomMapPack;
  availableLayers: { id: string; name: string }[];
  onCopy: (options: {
    name: string;
    description: string;
    zoomLevels: number[];
    layerIds: string[];
  }) => void;
  onCancel: () => void;
}

const CopyMapPackModal: React.FC<CopyMapPackModalProps> = ({
  originalPack,
  availableLayers,
  onCopy,
  onCancel
}) => {
  const [copyForm, setCopyForm] = useState({
    name: `${originalPack.name} (Copy)`,
    description: `Copy of ${originalPack.description}`,
    zoomLevels: [...originalPack.zoomLevels],
    layerIds: [...originalPack.layerIds]
  });

  const [estimatedTiles, setEstimatedTiles] = useState(0);
  const [estimatedSizeMB, setEstimatedSizeMB] = useState(0);

  // Calculate estimates when zoom levels or layers change
  useEffect(() => {
    // Simple estimation based on original pack
    const zoomRatio = copyForm.zoomLevels.length / originalPack.zoomLevels.length;
    const layerRatio = copyForm.layerIds.length / originalPack.layerIds.length;
    const newEstimatedTiles = Math.round(originalPack.estimatedTiles * zoomRatio * layerRatio);
    const newEstimatedSizeMB = Math.round(newEstimatedTiles * 0.02);
    
    setEstimatedTiles(newEstimatedTiles);
    setEstimatedSizeMB(newEstimatedSizeMB);
  }, [copyForm.zoomLevels, copyForm.layerIds, originalPack]);

  const handleZoomLevelToggle = (zoom: number) => {
    setCopyForm(prev => ({
      ...prev,
      zoomLevels: prev.zoomLevels.includes(zoom)
        ? prev.zoomLevels.filter(z => z !== zoom)
        : [...prev.zoomLevels, zoom].sort((a, b) => a - b)
    }));
  };

  const handleLayerToggle = (layerId: string) => {
    setCopyForm(prev => ({
      ...prev,
      layerIds: prev.layerIds.includes(layerId)
        ? prev.layerIds.filter(id => id !== layerId)
        : [...prev.layerIds, layerId]
    }));
  };

  const handleSubmit = () => {
    if (!copyForm.name.trim()) {
      alert('Please enter a name for the copied pack');
      return;
    }
    if (copyForm.zoomLevels.length === 0) {
      alert('Please select at least one zoom level');
      return;
    }
    if (copyForm.layerIds.length === 0) {
      alert('Please select at least one layer');
      return;
    }

    onCopy(copyForm);
  };

  const allZoomLevels = Array.from({length: 18}, (_, i) => i + 1);

  return (
    <div className="p-6 space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Copy Name
          </label>
          <input
            type="text"
            value={copyForm.name}
            onChange={(e) => setCopyForm(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter name for the copied pack"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={copyForm.description}
            onChange={(e) => setCopyForm(prev => ({ ...prev, description: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            placeholder="Enter description for the copied pack"
          />
        </div>
      </div>

      {/* Original Pack Info */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Original Pack Details</h4>
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium">Area:</span> {originalPack.estimatedSizeMB} MB
          </div>
          <div>
            <span className="font-medium">Tiles:</span> {originalPack.estimatedTiles.toLocaleString()}
          </div>
          <div>
            <span className="font-medium">Zoom Levels:</span> {originalPack.zoomLevels.join(', ')}
          </div>
          <div>
            <span className="font-medium">Layers:</span> {originalPack.layerIds.length}
          </div>
        </div>
      </div>

      {/* Layer Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Layers ({copyForm.layerIds.length} selected)
        </label>
        <div className="grid grid-cols-2 gap-2">
          {availableLayers.map(layer => (
            <label
              key={layer.id}
              className={`flex items-center p-3 border rounded cursor-pointer transition-colors ${
                copyForm.layerIds.includes(layer.id)
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="checkbox"
                checked={copyForm.layerIds.includes(layer.id)}
                onChange={() => handleLayerToggle(layer.id)}
                className="mr-2"
              />
              <span className="text-sm font-medium">{layer.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Zoom Level Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Zoom Levels ({copyForm.zoomLevels.length} selected)
        </label>
        <div className="space-y-3">
          {/* Quick Selection Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCopyForm(prev => ({ ...prev, zoomLevels: [1,2,3,4,5,6,7,8,9,10] }))}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              Low (1-10)
            </button>
            <button
              onClick={() => setCopyForm(prev => ({ ...prev, zoomLevels: [8,9,10,11,12,13,14,15] }))}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              Medium (8-15)
            </button>
            <button
              onClick={() => setCopyForm(prev => ({ ...prev, zoomLevels: [12,13,14,15,16,17,18] }))}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              High (12-18)
            </button>
            <button
              onClick={() => setCopyForm(prev => ({ ...prev, zoomLevels: allZoomLevels }))}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
            >
              All Levels
            </button>
            <button
              onClick={() => setCopyForm(prev => ({ ...prev, zoomLevels: [] }))}
              className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
            >
              Clear All
            </button>
          </div>

          {/* Individual Zoom Level Checkboxes */}
          <div className="grid grid-cols-6 gap-2">
            {allZoomLevels.map(zoom => (
              <label
                key={zoom}
                className={`flex items-center justify-center p-2 border rounded cursor-pointer transition-colors ${
                  copyForm.zoomLevels.includes(zoom)
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={copyForm.zoomLevels.includes(zoom)}
                  onChange={() => handleZoomLevelToggle(zoom)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{zoom}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Estimation */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Copy Estimation</h4>
        <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <span className="font-medium">Estimated Size:</span> {estimatedSizeMB} MB
          </div>
          <div>
            <span className="font-medium">Estimated Tiles:</span> {estimatedTiles.toLocaleString()}
          </div>
        </div>
        {estimatedSizeMB > 500 && (
          <div className="mt-2 text-sm text-amber-600">
            ⚠️ Large download size. Consider reducing zoom levels or layers.
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!copyForm.name.trim() || copyForm.zoomLevels.length === 0 || copyForm.layerIds.length === 0}
          className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 disabled:bg-gray-400 flex items-center space-x-2"
        >
          <span>📋</span>
          <span>Create Copy</span>
        </button>
      </div>
    </div>
  );
};

export default CopyMapPackModal;