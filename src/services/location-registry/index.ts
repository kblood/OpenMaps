// Location Registry Index - Export all registry components

export * from './types';
export * from './LoadingCoordinator';
export * from './LocationRegistryService';
export * from './RegistryIntegrationService';

// Main exports for easy import
export { locationRegistry } from './LocationRegistryService';
export { registryIntegration } from './RegistryIntegrationService';
export { loadingCoordinator } from './LoadingCoordinator';
