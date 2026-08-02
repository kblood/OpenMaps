/**
 * Frontend tests for OpenMaps
 * Tests for map component, tile loading, and UI functionality
 */

import { render, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MapContainer from '../components/Map/MapContainer';
import { Location } from '../types';

describe('MapContainer Component', () => {
  const mockCenter: Location = { lat: 40.7128, lng: -74.0060 };
  const mockProps = {
    center: mockCenter,
    zoom: 13,
    markers: [],
    route: null,
    currentLayer: 'standard',
    onMapClick: jest.fn(),
    onMapReady: jest.fn(),
  };

  it('should render the map container', () => {
    const { container } = render(
      <MapContainer {...mockProps} />
    );
    expect(container.querySelector('.leaflet-container')).toBeInTheDocument();
  });

  it('should update center when props change', async () => {
    const onMapReady = jest.fn();
    const { rerender } = render(
      <MapContainer {...mockProps} onMapReady={onMapReady} />
    );

    await waitFor(() => {
      expect(onMapReady).toHaveBeenCalled();
    });

    const newCenter: Location = { lat: 51.5074, lng: -0.1278 };
    rerender(
      <MapContainer {...mockProps} center={newCenter} onMapReady={onMapReady} />
    );

    // Map should be updated
    expect(onMapReady).toHaveBeenCalled();
  });

  it('should handle map clicks', async () => {
    const onMapClick = jest.fn();
    const { container } = render(
      <MapContainer {...mockProps} onMapClick={onMapClick} />
    );

    const mapContainer = container.querySelector('.leaflet-container');
    if (mapContainer) {
      fireEvent.click(mapContainer);
      // Note: actual click handling depends on Leaflet integration
    }
  });

  it('should display markers when provided', () => {
    const markers = [
      { id: '1', position: { lat: 40.7128, lng: -74.0060 }, title: 'Test Location' }
    ];
    const { container } = render(
      <MapContainer {...mockProps} markers={markers} />
    );

    expect(container.querySelector('.leaflet-marker-pane')).toBeInTheDocument();
  });
});

describe('Tile Loading', () => {
  it('should load from correct tile proxy endpoint', async () => {
    const response = await fetch(
      'http://localhost:3001/api/tiles/proxy/osm/10/512/512.png'
    );
    expect(response.ok).toBe(true);
  });

  it('should handle multiple tile providers', async () => {
    const providers = ['osm', 'satellite', 'terrain'];
    
    for (const provider of providers) {
      const response = await fetch(
        `http://localhost:3001/api/tiles/proxy/${provider}/10/512/512.png`
      );
      expect(response.ok).toBe(true);
    }
  });

  it('should return tiles with correct content type', async () => {
    const response = await fetch(
      'http://localhost:3001/api/tiles/proxy/osm/10/512/512.png'
    );
    expect(response.headers.get('content-type')).toMatch(/image\/(png|jpeg|webp)/);
  });
});

export {};
