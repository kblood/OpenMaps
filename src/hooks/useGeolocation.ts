import { useState, useEffect } from 'react';
import { Location } from '../types';

interface GeolocationState {
  location: Location | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
}

export const useGeolocation = (options: UseGeolocationOptions = {}) => {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 300000, // 5 minutes
    watch = false
  } = options;

  const [state, setState] = useState<GeolocationState>({
    location: null,
    accuracy: null,
    error: null,
    loading: false
  });

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by this browser',
        loading: false
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      loading: true,
      error: null
    }));

    const handleSuccess = (position: GeolocationPosition) => {
      setState({
        location: {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        },
        accuracy: position.coords.accuracy,
        error: null,
        loading: false
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      let errorMessage = 'An error occurred while retrieving location';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location access denied by user';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information unavailable';
          break;
        case error.TIMEOUT:
          errorMessage = 'Location request timed out';
          break;
      }

      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false
      }));
    };

    const positionOptions: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge
    };

    if (watch) {
      const watchId = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        positionOptions
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        handleError,
        positionOptions
      );
    }
  };

  useEffect(() => {
    if (watch) {
      const cleanup = getCurrentLocation();
      return cleanup;
    }
  }, [watch, enableHighAccuracy, timeout, maximumAge]);

  return {
    ...state,
    getCurrentLocation
  };
};
