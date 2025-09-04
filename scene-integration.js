// Scene Integration - Connects Three.js native serialization with existing UI
// Replaces custom serialization components with Three.js ObjectLoader system

class SceneIntegration {
    constructor() {
        this.serializationManager = null;
        this.isInitialized = false;
        this.setupComplete = false;
        
        this.initializeWhenReady();
    }
    
    async initializeWhenReady() {
        console.log('🔄 Waiting for dependencies...');
        
        // Wait for all required systems
        await this.waitForDependencies();
        
        // Initialize the serialization manager
        this.serializationManager = new SceneSerializationManager();
        
        // Replace existing save/load functions
        this.replaceExistingFunctions();
        
        // Setup UI integration
        this.setupUIIntegration();
        
        // Coordinate with selection system
        this.setupSelectionSystemCoordination();
        
        this.isInitialized = true;
        console.log('✅ Scene Integration initialized with Three.js native serialization');
    }
    
    async waitForDependencies() {
        const dependencies = [
            { name: 'scene', getter: () => window.scene },
            { name: 'camera', getter: () => window.camera },
            { name: 'renderer', getter: () => window.renderer },
            { name: 'SceneSerializationManager', getter: () => window.SceneSerializationManager },
            { name: 'optimizedSelectionSystem', getter: () => window.optimizedSelectionSystem }
        ];
        
        for (const dep of dependencies) {
            console.log(`⏳ Waiting for ${dep.name}...`);
            try {
                await this.waitFor(dep.getter);
                console.log(`✅ ${dep.name} ready`);
            } catch (error) {
                console.error(`❌ ${dep.name} timeout:`, error);
                throw error;
            }
        }
        
        console.log('✅ All dependencies ready');
    }
    
    waitFor(getter, maxWait = 10000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = () => {
                const value = getter();
                if (value) {
                    resolve(value);
                } else if (Date.now() - start > maxWait) {
                    reject(new Error('Dependency timeout'));
                } else {
                    requestAnimationFrame(check);
                }
            };
            check();
        });
    }
    
    replaceExistingFunctions() {
        console.log('🔄 Replacing custom serialization with Three.js native...');
        
        // Replace global save/load functions
        if (window.downloadScene) {
            console.log('⚠️ Replacing custom downloadScene with native implementation');
        }
        
        // Override with Three.js native versions
        window.downloadScene = this.saveSceneNative.bind(this);
        window.loadScene = this.loadSceneNative.bind(this);
        window.clearScene = this.clearSceneNative.bind(this);
        
        // Legacy compatibility aliases
        window.saveScene = this.saveSceneNative.bind(this);
        window.restoreScene = this.loadSceneNative.bind(this);
        
        console.log('✅ Scene functions replaced with Three.js native implementations');
    }
    
    async saveSceneNative(sceneName) {
        if (!this.serializationManager) {
            console.error('❌ SerializationManager not initialized');
            return null;
        }
        
        try {
            const name = sceneName || this.generateSceneName();
            console.log(`💾 Saving scene using Three.js native: ${name}`);
            
            const result = await this.serializationManager.saveScene(name);
            
            // Show success notification
            this.showNotification(`Scene "${name}" saved successfully`, 'success');
            
            return result;
        } catch (error) {
            console.error('❌ Native scene save failed:', error);
            this.showNotification('Failed to save scene', 'error');
            throw error;
        }
    }
    
    async loadSceneNative(sceneData) {
        if (!this.serializationManager) {
            console.error('❌ SerializationManager not initialized');
            return false;
        }
        
        try {
            let data = sceneData;
            
            // Handle file input
            if (sceneData instanceof File) {
                console.log('📂 Loading scene from file...');
                data = await this.serializationManager.loadFromFile(sceneData);
            }
            
            // Ensure proper format
            if (!data || !data.threeJS) {
                throw new Error('Invalid scene data format');
            }
            
            console.log(`📂 Loading scene using Three.js native: ${data.name || 'Unknown'}`);
            
            const result = await this.serializationManager.loadScene(data);
            
            if (result) {
                this.showNotification(`Scene "${data.name || 'Unknown'}" loaded successfully`, 'success');
                
                // Update UI state
                this.updateUIAfterLoad();
            }
            
            return result;
        } catch (error) {
            console.error('❌ Native scene load failed:', error);
            this.showNotification('Failed to load scene', 'error');
            throw error;
        }
    }
    
    async clearSceneNative() {
        if (!this.serializationManager) {
            console.error('❌ SerializationManager not initialized');
            return;
        }
        
        try {
            console.log('🗑️ Clearing scene using Three.js native disposal...');
            
            await this.serializationManager.clearCurrentScene();
            
            // Update UI state
            this.updateUIAfterClear();
            
            this.showNotification('Scene cleared', 'info');
            
            console.log('✅ Scene cleared using proper Three.js disposal');
        } catch (error) {
            console.error('❌ Scene clear failed:', error);
            this.showNotification('Failed to clear scene', 'error');
        }
    }
    
    setupUIIntegration() {
        console.log('🔄 Setting up UI integration...');
        
        // File input handler for scene loading
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.scene.json,.json';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    await this.loadSceneNative(file);
                } catch (error) {
                    console.error('File load error:', error);
                }
                // Reset input
                fileInput.value = '';
            }
        });
        document.body.appendChild(fileInput);
        
        // Make file input accessible globally
        window.sceneFileInput = fileInput;
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S = Save Scene
            if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
                e.preventDefault();
                this.saveSceneNative();
            }
            
            // Ctrl/Cmd + O = Open Scene
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                fileInput.click();
            }
            
            // Ctrl/Cmd + Shift + N = New Scene (Clear)
            if ((e.ctrlKey || e.metaKey) && e.key === 'n' && e.shiftKey) {
                e.preventDefault();
                if (confirm('Clear current scene? Unsaved changes will be lost.')) {
                    this.clearSceneNative();
                }
            }
        });
        
        console.log('✅ UI integration setup complete');
        console.log('⌨️ Keyboard shortcuts: Ctrl+S (Save), Ctrl+O (Open), Ctrl+Shift+N (New)');
    }
    
    setupSelectionSystemCoordination() {
        if (!window.optimizedSelectionSystem) return;
        
        console.log('🔄 Setting up selection system coordination...');
        
        // Listen for scene clear events to ensure selection system is properly reset
        const originalClearScene = this.clearSceneNative.bind(this);
        this.clearSceneNative = async () => {
            // Clear selections before scene clearing
            if (window.optimizedSelectionSystem.hasSelection()) {
                console.log('🎯 Clearing selections before scene clear...');
                window.optimizedSelectionSystem.deselectAll();
            }
            
            // Proceed with normal clearing
            await originalClearScene();
            
            // Ensure selectable objects are updated
            setTimeout(() => {
                window.optimizedSelectionSystem.updateSelectableObjects();
            }, 100);
        };
        
        console.log('✅ Selection system coordination setup');
    }
    
    updateUIAfterLoad() {
        // Update model controls if they exist
        if (window.updateModelControls) {
            window.updateModelControls();
        }
        
        // Update performance info
        if (window.performanceMonitor) {
            window.performanceMonitor.update();
        }
        
        // Force render
        if (window.renderer && window.scene && window.camera) {
            window.renderer.render(window.scene, window.camera);
        }
        
        console.log('🔄 UI updated after scene load');
    }
    
    updateUIAfterClear() {
        // Hide model controls
        const modelControls = document.getElementById('model-controls');
        if (modelControls) {
            modelControls.style.display = 'none';
        }
        
        // Update performance info
        if (window.performanceMonitor) {
            window.performanceMonitor.update();
        }
        
        console.log('🔄 UI updated after scene clear');
    }
    
    generateSceneName() {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
        return `Scene_${dateStr}_${timeStr}`;
    }
    
    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (window.showNotification) {
            window.showNotification(message, type);
            return;
        }
        
        // Fallback notification
        console.log(`${type.toUpperCase()}: ${message}`);
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            padding: 12px 20px; border-radius: 6px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
            color: white; font-size: 14px; max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transform: translateX(100%); transition: transform 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Animate in
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });
        
        // Auto-remove
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // Public API methods
    isReady() {
        return this.isInitialized && this.serializationManager !== null;
    }
    
    getSerializationManager() {
        return this.serializationManager;
    }
    
    dispose() {
        if (this.serializationManager) {
            this.serializationManager.dispose();
        }
        
        // Remove file input
        if (window.sceneFileInput) {
            window.sceneFileInput.remove();
            delete window.sceneFileInput;
        }
        
        console.log('✅ SceneIntegration disposed');
    }
}

// Auto-initialize when dependencies are ready (DISABLED for testing)
// window.addEventListener('load', () => {
//     // Small delay to ensure all other systems are loaded
//     setTimeout(() => {
//         window.sceneIntegration = new SceneIntegration();
//     }, 1000);
// });

// Export globally
window.SceneIntegration = SceneIntegration;

console.log('✅ SceneIntegration module loaded');