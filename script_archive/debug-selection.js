// Debug Selection System - Add to console for testing
function debugSelection() {
    console.log('🔍 Debug Selection System Status:');
    console.log('- OptimizedSelectionSystem:', !!window.optimizedSelectionSystem);
    console.log('- SimpleSelectionVisualization:', !!window.SimpleSelectionVisualization);
    console.log('- ResourceManager:', !!window.resourceManager);
    console.log('- SystemInitializer:', !!window.systemInitializer);
    
    if (window.optimizedSelectionSystem) {
        console.log('- Selection system initialized');
        console.log('- Selectable objects count:', window.optimizedSelectionSystem.selectableObjects?.length || 0);
        console.log('- Scene children count:', window.scene?.children?.length || 0);
        
        if (window.scene) {
            console.log('- Scene children types:');
            window.scene.children.forEach((child, index) => {
                console.log(`  ${index}: ${child.name || 'unnamed'} (${child.type}) - selectable: ${child.userData?.selectable !== false}`);
            });
        }
        
        // Try to manually update selectable objects
        console.log('- Manually updating selectable objects...');
        window.optimizedSelectionSystem.updateSelectableObjects();
    } else {
        console.log('- Selection system NOT initialized');
    }
}

// Add to window for console access
window.debugSelection = debugSelection;

console.log('🔧 Debug functions added. Run debugSelection() in console to diagnose issues.');