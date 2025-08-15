import { mapPackManager } from '../config/mapPacks';

export function MapPackDebugger() {
  const handleTest = () => {
    console.log('=== MAP PACK DEBUG ===');
    
    // Test getting data
    const installed = mapPackManager.getInstalledPacks();
    const available = mapPackManager.getAvailablePacks();
    const allLayers = mapPackManager.getAllLayers();
    
    console.log('Installed packs:', installed);
    console.log('Available packs:', available);
    console.log('All layers:', allLayers);
    
    // Test localStorage
    try {
      const storedPacks = localStorage.getItem('openmaps_installed_packs');
      console.log('localStorage data:', storedPacks);
    } catch (error) {
      console.error('localStorage error:', error);
    }
    
    // Test installing a pack
    if (available.length > 0) {
      const packToInstall = available[0];
      console.log('Attempting to install pack:', packToInstall.id);
      const result = mapPackManager.installPack(packToInstall.id);
      console.log('Install result:', result);
      
      // Check data after installation
      const installedAfter = mapPackManager.getInstalledPacks();
      const availableAfter = mapPackManager.getAvailablePacks();
      console.log('After install - Installed:', installedAfter);
      console.log('After install - Available:', availableAfter);
    }
  };
  
  return (
    <div style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 10000 }}>
      <button 
        onClick={handleTest}
        style={{ 
          padding: '10px', 
          backgroundColor: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Debug Map Packs
      </button>
    </div>
  );
}
