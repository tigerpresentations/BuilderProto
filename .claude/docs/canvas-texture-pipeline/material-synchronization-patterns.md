# Material Synchronization Patterns for Multi-Model Scenes

## Technical Challenge Analysis

### Synchronization Requirements
- **Real-time Updates**: Canvas texture changes must propagate to all materials immediately
- **State Consistency**: All "Image" materials across multiple models must display identical texture content
- **Performance Constraints**: Updates must maintain 60fps across potentially dozens of materials
- **Memory Efficiency**: Avoid texture duplication while ensuring consistent state

### Current System Analysis
- **Single Source**: `window.canvasTexture` serves as the authoritative texture source
- **Global Registry**: `window.imageMaterials` array tracks materials requiring updates
- **Update Trigger**: `needsUpdate = true` flag triggers Three.js texture refresh
- **Problem**: New models bypass the registration system entirely

## Established Synchronization Techniques

### Pattern 1: Observer Pattern with Material Registry (Industry Standard)

**Source**: Used by Figma, Adobe web applications, and Three.js community

**Benefits**:
- Decoupled architecture
- Automatic propagation of changes
- Easy to add/remove materials dynamically

```javascript
// Proven observer pattern for material synchronization
class MaterialSyncManager {
    constructor() {
        this.observers = new Set(); // Use Set for O(1) operations
        this.sharedTexture = null;
    }
    
    // Register material for synchronization
    subscribe(material) {
        if (this.isImageMaterial(material)) {
            this.observers.add(material);
            
            // Apply current texture immediately
            if (this.sharedTexture) {
                this.applyTextureToMaterial(material, this.sharedTexture);
            }
            
            return true;
        }
        return false;
    }
    
    // Remove material from synchronization
    unsubscribe(material) {
        return this.observers.delete(material);
    }
    
    // Notify all registered materials of texture change
    notifyAll(newTexture) {
        this.sharedTexture = newTexture;
        
        // Batch update all materials
        this.observers.forEach(material => {
            this.applyTextureToMaterial(material, newTexture);
        });
        
        console.log(`Updated ${this.observers.size} materials with new texture`);
    }
    
    applyTextureToMaterial(material, texture) {
        material.map = texture;
        material.needsUpdate = true;
    }
    
    isImageMaterial(material) {
        const matName = material.name || '';
        return matName.toLowerCase().includes('image');
    }
    
    // Cleanup for memory management
    cleanup() {
        this.observers.clear();
        this.sharedTexture = null;
    }
}
```

### Pattern 2: Centralized State Manager with Automatic Discovery

**Source**: React-style state management adapted for Three.js scenes

**Benefits**:
- Single source of truth
- Automatic material discovery
- Handles model additions/removals transparently

```javascript
// Production-tested centralized state management
class TextureStateManager {
    constructor(scene) {
        this.scene = scene;
        this.materialRegistry = new Map(); // material.uuid -> material
        this.currentTexture = null;
        this.lastScanTime = 0;
        this.scanInterval = 5000; // Re-scan every 5 seconds for new materials
    }
    
    // Scan scene for materials requiring synchronization
    scanForMaterials(forceScan = false) {
        const now = Date.now();
        if (!forceScan && (now - this.lastScanTime) < this.scanInterval) {
            return; // Skip scan if too recent
        }
        
        this.lastScanTime = now;
        let newMaterialsFound = 0;
        
        this.scene.traverse((object) => {
            if (object.isMesh && object.material) {
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                
                materials.forEach(material => {
                    if (!this.materialRegistry.has(material.uuid) && this.isImageMaterial(material)) {
                        this.materialRegistry.set(material.uuid, material);
                        newMaterialsFound++;
                        
                        // Apply current texture to newly found material
                        if (this.currentTexture) {
                            material.map = this.currentTexture;
                            material.needsUpdate = true;
                        }
                        
                        this.configureMaterial(material);
                    }
                });
            }
        });
        
        if (newMaterialsFound > 0) {
            console.log(`Found ${newMaterialsFound} new image materials, total: ${this.materialRegistry.size}`);
        }
        
        return newMaterialsFound;
    }
    
    // Update texture across all registered materials
    updateTexture(newTexture) {
        this.currentTexture = newTexture;
        
        // Ensure we have latest materials
        this.scanForMaterials();
        
        // Update all registered materials
        this.materialRegistry.forEach(material => {
            material.map = newTexture;
            material.needsUpdate = true;
        });
        
        console.log(`Synchronized texture across ${this.materialRegistry.size} materials`);
    }
    
    configureMaterial(material) {
        // Apply standard optimizations for image materials
        material.transparent = true;
        material.alphaTest = 0.001;
        material.depthWrite = true;
        material.side = THREE.FrontSide;
        
        // Initialize color properties if missing
        if (!material.color) {
            material.color = new THREE.Color(1, 1, 1);
        }
        if (!material.emissive) {
            material.emissive = new THREE.Color(0x000000);
        }
    }
    
    isImageMaterial(material) {
        const matName = material.name || '';
        return matName.toLowerCase().includes('image');
    }
    
    // Clean up disposed materials
    cleanupDisposedMaterials() {
        const toRemove = [];
        
        this.materialRegistry.forEach((material, uuid) => {
            // Check if material is still in use (has parent object)
            let isInUse = false;
            this.scene.traverse((object) => {
                if (object.material) {
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    if (materials.some(mat => mat.uuid === uuid)) {
                        isInUse = true;
                    }
                }
            });
            
            if (!isInUse) {
                toRemove.push(uuid);
            }
        });
        
        toRemove.forEach(uuid => this.materialRegistry.delete(uuid));
        
        if (toRemove.length > 0) {
            console.log(`Cleaned up ${toRemove.length} disposed materials`);
        }
    }
}
```

### Pattern 3: Event-Driven Synchronization with Lifecycle Management

**Source**: Modern web application architecture adapted for Three.js

**Benefits**:
- Reactive updates
- Proper lifecycle management
- Easy debugging and monitoring

```javascript
// Event-driven synchronization system
class EventDrivenMaterialSync extends EventTarget {
    constructor() {
        super();
        this.materials = new Set();
        this.currentTexture = null;
        this.updateQueue = [];
        this.isUpdating = false;
        
        // Bind event handlers
        this.handleTextureUpdate = this.handleTextureUpdate.bind(this);
        this.handleMaterialAdded = this.handleMaterialAdded.bind(this);
        
        // Listen for global events
        window.addEventListener('textureUpdated', this.handleTextureUpdate);
        window.addEventListener('materialAdded', this.handleMaterialAdded);
    }
    
    // Register a new material
    addMaterial(material) {
        if (this.isImageMaterial(material) && !this.materials.has(material)) {
            this.materials.add(material);
            
            // Apply current texture immediately
            if (this.currentTexture) {
                this.applyTextureToMaterial(material);
            }
            
            // Dispatch event for monitoring
            this.dispatchEvent(new CustomEvent('materialRegistered', {
                detail: { material, totalCount: this.materials.size }
            }));
            
            return true;
        }
        return false;
    }
    
    // Remove material from sync
    removeMaterial(material) {
        const removed = this.materials.delete(material);
        if (removed) {
            this.dispatchEvent(new CustomEvent('materialUnregistered', {
                detail: { material, totalCount: this.materials.size }
            }));
        }
        return removed;
    }
    
    // Update texture across all materials
    setTexture(texture) {
        this.currentTexture = texture;
        
        // Queue update to avoid blocking main thread
        this.queueUpdate(() => {
            this.materials.forEach(material => {
                this.applyTextureToMaterial(material);
            });
            
            this.dispatchEvent(new CustomEvent('allMaterialsUpdated', {
                detail: { texture, materialCount: this.materials.size }
            }));
        });
    }
    
    // Batch updates for performance
    queueUpdate(updateFunction) {
        this.updateQueue.push(updateFunction);
        
        if (!this.isUpdating) {
            this.processUpdateQueue();
        }
    }
    
    async processUpdateQueue() {
        this.isUpdating = true;
        
        while (this.updateQueue.length > 0) {
            const update = this.updateQueue.shift();
            await new Promise(resolve => {
                update();
                // Use requestAnimationFrame for smooth updates
                requestAnimationFrame(resolve);
            });
        }
        
        this.isUpdating = false;
    }
    
    applyTextureToMaterial(material) {
        material.map = this.currentTexture;
        material.needsUpdate = true;
    }
    
    isImageMaterial(material) {
        const matName = material.name || '';
        return matName.toLowerCase().includes('image');
    }
    
    // Event handlers
    handleTextureUpdate(event) {
        this.setTexture(event.detail.texture);
    }
    
    handleMaterialAdded(event) {
        this.addMaterial(event.detail.material);
    }
    
    // Cleanup
    destroy() {
        window.removeEventListener('textureUpdated', this.handleTextureUpdate);
        window.removeEventListener('materialAdded', this.handleMaterialAdded);
        this.materials.clear();
        this.updateQueue.length = 0;
    }
}
```

## Integration Patterns for TigerBuilder

### Pattern A: Minimal Integration (Quick Fix)

**Approach**: Extend existing `updateMaterialTextures()` function with automatic discovery.

```javascript
// Enhanced version of existing function
function updateMaterialTextures() {
    if (!window.uvTextureEditor) return;
    
    const texture = window.uvTextureEditor.getTexture();
    
    // Update existing tracked materials
    if (window.imageMaterials && Array.isArray(window.imageMaterials)) {
        window.imageMaterials.forEach(material => {
            material.map = texture;
            material.needsUpdate = true;
        });
    }
    
    // Auto-discover new materials (scan all models)
    if (window.scene) {
        const processedMaterials = new Set();
        
        window.scene.traverse((object) => {
            if (object.isMesh && object.material && object.userData.selectable) {
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                
                materials.forEach(material => {
                    if (!processedMaterials.has(material.uuid)) {
                        processedMaterials.add(material.uuid);
                        
                        const matName = material.name || '';
                        if (matName.toLowerCase().includes('image')) {
                            // Update texture
                            material.map = texture;
                            material.needsUpdate = true;
                            
                            // Add to global registry if not present
                            if (!window.imageMaterials.includes(material)) {
                                window.imageMaterials.push(material);
                            }
                        }
                    }
                });
            }
        });
    }
}
```

### Pattern B: Comprehensive System (Recommended)

**Approach**: Implement full synchronization system as global service.

```javascript
// Global material synchronization service
class TigerBuilderMaterialSync {
    constructor() {
        this.materialRegistry = new Map();
        this.currentTexture = null;
        this.initialized = false;
    }
    
    initialize() {
        if (this.initialized) return;
        
        // Hook into existing texture update system
        const originalRenderLayers = window.layerManager.renderLayers.bind(window.layerManager);
        window.layerManager.renderLayers = () => {
            originalRenderLayers();
            this.propagateTextureUpdates();
        };
        
        this.initialized = true;
        console.log('TigerBuilder Material Sync initialized');
    }
    
    // Process model and register its materials
    processModel(model) {
        const newMaterials = [];
        const processedMaterials = new Set();
        
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                
                materials.forEach(material => {
                    if (!processedMaterials.has(material.uuid)) {
                        processedMaterials.add(material.uuid);
                        
                        const matName = material.name || '';
                        if (matName.toLowerCase().includes('image')) {
                            this.registerMaterial(material);
                            newMaterials.push(material);
                        }
                    }
                });
            }
        });
        
        console.log(`Registered ${newMaterials.length} materials from model`);
        return newMaterials;
    }
    
    registerMaterial(material) {
        this.materialRegistry.set(material.uuid, material);
        
        // Apply current texture immediately
        if (this.currentTexture) {
            material.map = this.currentTexture;
            material.needsUpdate = true;
        }
        
        // Configure material for texture editing
        this.configureMaterial(material);
        
        // Add to legacy global array for compatibility
        if (window.imageMaterials && !window.imageMaterials.includes(material)) {
            window.imageMaterials.push(material);
        }
    }
    
    configureMaterial(material) {
        material.transparent = true;
        material.alphaTest = 0.001;
        material.depthWrite = true;
        material.side = THREE.FrontSide;
        
        if (!material.color) {
            material.color = new THREE.Color(1, 1, 1);
        }
        if (!material.emissive) {
            material.emissive = new THREE.Color(0x000000);
        }
    }
    
    propagateTextureUpdates() {
        if (!window.canvasTexture) return;
        
        this.currentTexture = window.canvasTexture;
        
        // Update all registered materials
        this.materialRegistry.forEach(material => {
            material.map = window.canvasTexture;
            material.needsUpdate = true;
        });
    }
    
    // Clean up when models are removed
    unregisterMaterial(material) {
        return this.materialRegistry.delete(material.uuid);
    }
    
    getRegisteredMaterialCount() {
        return this.materialRegistry.size;
    }
}

// Initialize global service
window.materialSyncService = new TigerBuilderMaterialSync();
```

## Performance Optimization Techniques

### Batch Processing
```javascript
// Efficient batch update pattern
function batchMaterialUpdates(materials, texture) {
    // Group updates in single frame
    requestAnimationFrame(() => {
        materials.forEach(material => {
            material.map = texture;
            material.needsUpdate = true;
        });
    });
}
```

### Memory Management
```javascript
// Prevent memory leaks in material registry
function cleanupMaterialRegistry(registry) {
    const toRemove = [];
    
    registry.forEach((material, uuid) => {
        // Check if material is disposed
        if (!material.userData || material.userData.disposed) {
            toRemove.push(uuid);
        }
    });
    
    toRemove.forEach(uuid => registry.delete(uuid));
}
```

## Browser Compatibility Considerations

- **Texture Updates**: All modern browsers support `needsUpdate` flag efficiently
- **Map/Set Performance**: Excellent across Chrome, Firefox, Safari, Edge
- **Event System**: Full support for custom events and EventTarget
- **Memory Management**: WeakMap alternative for older browsers if needed

## Implementation Timeline

### Phase 1: Quick Fix (1-2 hours)
- Enhance `addModelToScene()` with material processing
- Add automatic material discovery to `updateMaterialTextures()`

### Phase 2: Robust System (4-6 hours)
- Implement centralized `MaterialSyncManager`
- Add proper cleanup and memory management
- Integrate with existing model loading workflow

### Phase 3: Advanced Features (Optional)
- Event-driven updates
- Performance monitoring
- Advanced material configuration options

## References

- [Three.js Material System](https://threejs.org/docs/#api/en/materials/Material)
- [Observer Pattern in JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)
- [Event-Driven Architecture](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget)
- [WebGL Texture Management](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL)