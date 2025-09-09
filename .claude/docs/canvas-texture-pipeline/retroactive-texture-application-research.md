# Retroactive Texture Application Research for Multi-Model Scenes

## Technical Challenge Analysis

### Problem Definition
When new models are added to an existing scene, they may not receive the current shared canvas texture due to timing issues or bypassed initialization processes. This creates inconsistent visual states where some models display the texture while others show default materials.

### Current System Analysis
- **Working Path**: `placeModelOnFloor()` → material detection → texture application
- **Broken Path**: `addModelToScene()` → missing material processing → no texture applied
- **Global State**: `window.canvasTexture` exists but isn't applied to new materials
- **Registry Issue**: `window.imageMaterials` array doesn't get updated for new models

### Use Cases for Retroactive Application
1. **Scene Loading**: Restoring texture state when loading saved scenes
2. **Dynamic Model Addition**: Adding models to existing scenes with active textures
3. **System Recovery**: Fixing texture state after errors or system resets
4. **Hot Reloading**: Development scenarios where models are replaced

## Established Retroactive Application Techniques

### Pattern 1: Scene Traversal with Material Discovery (Three.js Standard)

**Source**: Three.js documentation, established 3D web applications

**Approach**: Scan entire scene to find and update materials retroactively.

```javascript
// Proven scene traversal pattern for retroactive updates
class RetroactiveMaterialProcessor {
    constructor() {
        this.processedMaterials = new Set();
        this.targetMaterialPattern = /image/i; // Case-insensitive "image" match
    }
    
    // Main entry point for retroactive texture application
    applyTextureToScene(scene, texture, targetPattern = null) {
        if (!scene || !texture) {
            console.warn('Scene or texture not provided');
            return { processed: 0, errors: 0 };
        }
        
        this.processedMaterials.clear();
        const pattern = targetPattern || this.targetMaterialPattern;
        
        let processedCount = 0;
        let errorCount = 0;
        
        scene.traverse((object) => {
            try {
                const result = this.processObject(object, texture, pattern);
                processedCount += result.processed;
                errorCount += result.errors;
            } catch (error) {
                console.error('Error processing object:', object.name, error);
                errorCount++;
            }
        });
        
        console.log(`Retroactive texture application: ${processedCount} materials processed, ${errorCount} errors`);
        
        return {
            processed: processedCount,
            errors: errorCount,
            totalMaterials: this.processedMaterials.size
        };
    }
    
    processObject(object, texture, pattern) {
        let processed = 0;
        let errors = 0;
        
        if (!object.isMesh || !object.material) {
            return { processed, errors };
        }
        
        // Handle both single materials and material arrays
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        
        materials.forEach(material => {
            try {
                if (this.shouldProcessMaterial(material, pattern)) {
                    this.applyTextureToMaterial(material, texture);
                    processed++;
                    
                    // Track in global registry for compatibility
                    this.updateGlobalRegistry(material);
                }
            } catch (error) {
                console.error('Error processing material:', material.name, error);
                errors++;
            }
        });
        
        return { processed, errors };
    }
    
    shouldProcessMaterial(material, pattern) {
        // Skip if already processed (avoid duplicates)
        if (this.processedMaterials.has(material.uuid)) {
            return false;
        }
        
        this.processedMaterials.add(material.uuid);
        
        // Check material name against pattern
        const materialName = material.name || '';
        return pattern.test(materialName);
    }
    
    applyTextureToMaterial(material, texture) {
        // Apply texture
        material.map = texture;
        
        // Configure material for texture editing (from existing system)
        material.transparent = true;
        material.alphaTest = 0.001;
        material.depthWrite = true;
        material.side = THREE.FrontSide;
        
        // Initialize missing properties
        if (!material.color) {
            material.color = new THREE.Color(1, 1, 1);
        }
        if (!material.emissive) {
            material.emissive = new THREE.Color(0x000000);
        }
        
        material.needsUpdate = true;
    }
    
    updateGlobalRegistry(material) {
        // Add to legacy global array for compatibility
        if (window.imageMaterials && Array.isArray(window.imageMaterials)) {
            if (!window.imageMaterials.includes(material)) {
                window.imageMaterials.push(material);
            }
        }
    }
    
    // Get statistics about processed materials
    getProcessingStats() {
        return {
            uniqueMaterialsProcessed: this.processedMaterials.size,
            globalRegistrySize: window.imageMaterials ? window.imageMaterials.length : 0
        };
    }
}
```

### Pattern 2: Selective Object Processing with Filtering

**Source**: Game engines, real-time 3D applications

**Benefits**: More efficient than full scene traversal, targets specific objects.

```javascript
// Selective retroactive processing for specific objects
class SelectiveTextureProcessor {
    constructor() {
        this.filters = {
            selectable: (obj) => obj.userData && obj.userData.selectable,
            multiModel: (obj) => obj.userData && obj.userData.isMultiModelInstance,
            byName: (obj, pattern) => obj.name && pattern.test(obj.name),
            byInstanceId: (obj, instanceId) => obj.userData && obj.userData.instanceId === instanceId
        };
    }
    
    // Apply texture to specific model instances
    applyTextureToModelInstance(scene, instanceId, texture) {
        let processed = 0;
        
        scene.traverse((object) => {
            if (this.filters.byInstanceId(object, instanceId)) {
                const result = this.processObjectMaterials(object, texture);
                processed += result.processed;
                
                // Also process all children
                object.traverse((child) => {
                    if (child !== object && child.isMesh) {
                        const childResult = this.processObjectMaterials(child, texture);
                        processed += childResult.processed;
                    }
                });
            }
        });
        
        return { processed };
    }
    
    // Apply texture to all selectable objects
    applyTextureToSelectableObjects(scene, texture) {
        let processed = 0;
        
        scene.traverse((object) => {
            if (this.filters.selectable(object) && object.isMesh) {
                const result = this.processObjectMaterials(object, texture);
                processed += result.processed;
            }
        });
        
        return { processed };
    }
    
    processObjectMaterials(object, texture) {
        let processed = 0;
        
        if (!object.material) return { processed };
        
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        const processedUUIDs = new Set();
        
        materials.forEach(material => {
            if (!processedUUIDs.has(material.uuid) && this.isImageMaterial(material)) {
                processedUUIDs.add(material.uuid);
                
                material.map = texture;
                this.configureMaterial(material);
                processed++;
                
                // Update global registry
                this.addToGlobalRegistry(material);
            }
        });
        
        return { processed };
    }
    
    isImageMaterial(material) {
        const materialName = material.name || '';
        return materialName.toLowerCase().includes('image');
    }
    
    configureMaterial(material) {
        material.transparent = true;
        material.alphaTest = 0.001;
        material.depthWrite = true;
        material.side = THREE.FrontSide;
        material.needsUpdate = true;
        
        if (!material.color) material.color = new THREE.Color(1, 1, 1);
        if (!material.emissive) material.emissive = new THREE.Color(0x000000);
    }
    
    addToGlobalRegistry(material) {
        if (window.imageMaterials && !window.imageMaterials.includes(material)) {
            window.imageMaterials.push(material);
        }
    }
}
```

### Pattern 3: State Recovery System (Error Recovery)

**Source**: Robust 3D applications, production systems with error handling

**Use Case**: Recover from broken states, reinitialize texture system.

```javascript
// State recovery system for texture application
class TextureStateRecovery {
    constructor() {
        this.recoveryMethods = [
            this.recoverFromCanvasTexture.bind(this),
            this.recoverFromUVEditor.bind(this),
            this.initializeFromScratch.bind(this)
        ];
    }
    
    // Main recovery function - tries multiple methods
    async recoverTextureState(scene) {
        console.log('Starting texture state recovery...');
        
        for (const method of this.recoveryMethods) {
            try {
                const result = await method(scene);
                if (result.success) {
                    console.log(`Recovery successful using ${method.name}:`, result);
                    return result;
                }
            } catch (error) {
                console.warn(`Recovery method ${method.name} failed:`, error);
            }
        }
        
        console.error('All recovery methods failed');
        return { success: false, error: 'All recovery methods failed' };
    }
    
    // Method 1: Use existing canvas texture
    async recoverFromCanvasTexture(scene) {
        if (!window.canvasTexture) {
            return { success: false, reason: 'No canvas texture available' };
        }
        
        const processor = new RetroactiveMaterialProcessor();
        const result = processor.applyTextureToScene(scene, window.canvasTexture);
        
        return {
            success: result.processed > 0,
            method: 'canvasTexture',
            materialsProcessed: result.processed,
            errors: result.errors
        };
    }
    
    // Method 2: Regenerate from UV editor
    async recoverFromUVEditor(scene) {
        if (!window.uvTextureEditor) {
            return { success: false, reason: 'No UV texture editor available' };
        }
        
        const texture = window.uvTextureEditor.getTexture();
        if (!texture) {
            return { success: false, reason: 'UV editor has no texture' };
        }
        
        const processor = new RetroactiveMaterialProcessor();
        const result = processor.applyTextureToScene(scene, texture);
        
        // Update global reference
        window.canvasTexture = texture;
        
        return {
            success: result.processed > 0,
            method: 'uvEditor',
            materialsProcessed: result.processed,
            errors: result.errors
        };
    }
    
    // Method 3: Initialize from scratch
    async initializeFromScratch(scene) {
        try {
            // Create new texture from canvas
            const canvas = document.getElementById('display-canvas');
            if (!canvas) {
                return { success: false, reason: 'No display canvas available' };
            }
            
            const texture = new THREE.CanvasTexture(canvas);
            texture.flipY = false;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            window.canvasTexture = texture;
            
            const processor = new RetroactiveMaterialProcessor();
            const result = processor.applyTextureToScene(scene, texture);
            
            return {
                success: result.processed > 0,
                method: 'fromScratch',
                materialsProcessed: result.processed,
                errors: result.errors
            };
        } catch (error) {
            return { success: false, reason: 'Failed to initialize from scratch', error };
        }
    }
    
    // Validate current texture state
    validateTextureState(scene) {
        const issues = [];
        
        // Check global texture
        if (!window.canvasTexture) {
            issues.push('Missing window.canvasTexture');
        }
        
        // Check material registry
        if (!window.imageMaterials || !Array.isArray(window.imageMaterials)) {
            issues.push('Missing or invalid window.imageMaterials array');
        }
        
        // Check UV editor
        if (!window.uvTextureEditor) {
            issues.push('Missing window.uvTextureEditor');
        }
        
        // Check for materials without textures
        let materialsWithoutTexture = 0;
        scene.traverse((object) => {
            if (object.isMesh && object.material) {
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach(material => {
                    const materialName = material.name || '';
                    if (materialName.toLowerCase().includes('image') && !material.map) {
                        materialsWithoutTexture++;
                    }
                });
            }
        });
        
        if (materialsWithoutTexture > 0) {
            issues.push(`${materialsWithoutTexture} image materials without texture`);
        }
        
        return {
            isValid: issues.length === 0,
            issues,
            materialsWithoutTexture
        };
    }
}
```

### Pattern 4: Batch Processing for Large Scenes

**Source**: Large-scale 3D applications, CAD software

**Benefits**: Handles scenes with many models efficiently.

```javascript
// Batch processing for large scenes
class BatchTextureProcessor {
    constructor() {
        this.batchSize = 50; // Process materials in batches
        this.delayBetweenBatches = 10; // 10ms delay between batches
    }
    
    async applyTextureToBatches(scene, texture, progressCallback = null) {
        const allMaterials = this.collectAllMaterials(scene);
        const imageMaterials = allMaterials.filter(mat => this.isImageMaterial(mat.material));
        
        console.log(`Processing ${imageMaterials.length} image materials in batches of ${this.batchSize}`);
        
        let processed = 0;
        const batches = this.createBatches(imageMaterials, this.batchSize);
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            
            // Process batch
            batch.forEach(({ material }) => {
                this.applyTextureToMaterial(material, texture);
                processed++;
            });
            
            // Report progress
            if (progressCallback) {
                progressCallback({
                    processed,
                    total: imageMaterials.length,
                    batchIndex: i + 1,
                    totalBatches: batches.length
                });
            }
            
            // Delay between batches to prevent blocking
            if (i < batches.length - 1) {
                await this.delay(this.delayBetweenBatches);
            }
        }
        
        return { processed, total: imageMaterials.length };
    }
    
    collectAllMaterials(scene) {
        const materials = [];
        const processedUUIDs = new Set();
        
        scene.traverse((object) => {
            if (object.isMesh && object.material) {
                const mats = Array.isArray(object.material) ? object.material : [object.material];
                
                mats.forEach(material => {
                    if (!processedUUIDs.has(material.uuid)) {
                        processedUUIDs.add(material.uuid);
                        materials.push({ material, object });
                    }
                });
            }
        });
        
        return materials;
    }
    
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    
    applyTextureToMaterial(material, texture) {
        material.map = texture;
        material.transparent = true;
        material.alphaTest = 0.001;
        material.depthWrite = true;
        material.side = THREE.FrontSide;
        material.needsUpdate = true;
        
        if (!material.color) material.color = new THREE.Color(1, 1, 1);
        if (!material.emissive) material.emissive = new THREE.Color(0x000000);
        
        // Update global registry
        if (window.imageMaterials && !window.imageMaterials.includes(material)) {
            window.imageMaterials.push(material);
        }
    }
    
    isImageMaterial(material) {
        const materialName = material.name || '';
        return materialName.toLowerCase().includes('image');
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

## Implementation Strategies for TigerBuilder

### Strategy 1: Quick Fix - Scene Scan Function

**Implementation**: Add a simple function to scan and fix existing scene.

```javascript
// Simple retroactive fix for TigerBuilder
function applyTextureToExistingModels() {
    if (!window.scene || !window.canvasTexture) {
        console.warn('Scene or canvas texture not available');
        return false;
    }
    
    const processedMaterials = new Set();
    let appliedCount = 0;
    
    window.scene.traverse((object) => {
        if (object.isMesh && object.material && object.userData.selectable) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            
            materials.forEach(material => {
                if (!processedMaterials.has(material.uuid)) {
                    processedMaterials.add(material.uuid);
                    
                    const matName = material.name || '';
                    if (matName.toLowerCase().includes('image')) {
                        // Check if material already has the texture
                        if (material.map !== window.canvasTexture) {
                            material.map = window.canvasTexture;
                            material.needsUpdate = true;
                            appliedCount++;
                            
                            // Add to global registry if not present
                            if (window.imageMaterials && !window.imageMaterials.includes(material)) {
                                window.imageMaterials.push(material);
                            }
                        }
                    }
                }
            });
        }
    });
    
    console.log(`Applied texture to ${appliedCount} existing materials`);
    return appliedCount > 0;
}
```

### Strategy 2: Automatic Retroactive Application

**Implementation**: Hook into model loading to automatically apply textures.

```javascript
// Enhanced addModelToScene with retroactive support
function addModelToSceneWithTexture(model, scene, options = {}) {
    // Original addModelToScene logic
    const instanceId = window.addModelToScene(model, scene, options);
    
    // Immediately apply texture to new model
    if (window.canvasTexture && instanceId) {
        const modelData = window.getModelInstance(instanceId);
        if (modelData) {
            applyTextureToModel(modelData.model, window.canvasTexture);
        }
    }
    
    return instanceId;
}

function applyTextureToModel(model, texture) {
    const processedMaterials = new Set();
    let appliedCount = 0;
    
    model.traverse((child) => {
        if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            
            materials.forEach(material => {
                if (!processedMaterials.has(material.uuid)) {
                    processedMaterials.add(material.uuid);
                    
                    const matName = material.name || '';
                    if (matName.toLowerCase().includes('image')) {
                        material.map = texture;
                        material.transparent = true;
                        material.alphaTest = 0.001;
                        material.depthWrite = true;
                        material.side = THREE.FrontSide;
                        material.needsUpdate = true;
                        
                        if (!material.color) {
                            material.color = new THREE.Color(1, 1, 1);
                        }
                        if (!material.emissive) {
                            material.emissive = new THREE.Color(0x000000);
                        }
                        
                        // Add to global registry
                        if (window.imageMaterials && !window.imageMaterials.includes(material)) {
                            window.imageMaterials.push(material);
                        }
                        
                        appliedCount++;
                    }
                }
            });
        }
    });
    
    console.log(`Applied texture to ${appliedCount} materials in model`);
    return appliedCount;
}
```

### Strategy 3: Comprehensive Recovery System

**Implementation**: Full state management with recovery capabilities.

```javascript
// Comprehensive retroactive texture system for TigerBuilder
class TigerBuilderTextureRecovery {
    constructor() {
        this.processor = new RetroactiveMaterialProcessor();
        this.recovery = new TextureStateRecovery();
        this.selector = new SelectiveTextureProcessor();
    }
    
    // Main public interface for TigerBuilder
    async ensureAllModelsHaveTexture() {
        if (!window.scene) {
            console.warn('No scene available for texture application');
            return false;
        }
        
        // First, validate current state
        const validation = this.recovery.validateTextureState(window.scene);
        
        if (validation.isValid) {
            console.log('Texture state is already valid');
            return true;
        }
        
        console.warn('Texture state issues found:', validation.issues);
        
        // Attempt recovery
        const recoveryResult = await this.recovery.recoverTextureState(window.scene);
        
        if (recoveryResult.success) {
            console.log('Texture state recovered successfully');
            return true;
        }
        
        console.error('Failed to recover texture state');
        return false;
    }
    
    // Apply texture to specific model instance
    applyToModelInstance(instanceId) {
        if (!window.scene || !window.canvasTexture) return false;
        
        const result = this.selector.applyTextureToModelInstance(
            window.scene, 
            instanceId, 
            window.canvasTexture
        );
        
        console.log(`Applied texture to ${result.processed} materials in instance ${instanceId}`);
        return result.processed > 0;
    }
    
    // Apply texture to all selectable objects
    applyToAllSelectableObjects() {
        if (!window.scene || !window.canvasTexture) return false;
        
        const result = this.selector.applyTextureToSelectableObjects(
            window.scene, 
            window.canvasTexture
        );
        
        console.log(`Applied texture to ${result.processed} materials in selectable objects`);
        return result.processed > 0;
    }
    
    // Get diagnostic information
    getDiagnosticInfo() {
        if (!window.scene) return null;
        
        const validation = this.recovery.validateTextureState(window.scene);
        const stats = this.processor.getProcessingStats();
        
        return {
            validation,
            stats,
            globalTextureExists: !!window.canvasTexture,
            globalMaterialsCount: window.imageMaterials ? window.imageMaterials.length : 0,
            uvEditorExists: !!window.uvTextureEditor
        };
    }
}

// Initialize global recovery system
window.textureRecoverySystem = new TigerBuilderTextureRecovery();
```

## Performance Considerations for Retroactive Processing

### Memory Management
- Use `Set` for tracking processed materials to avoid duplicates
- Clean up temporary collections after processing
- Monitor memory usage during large batch operations

### Processing Efficiency
- Process materials in batches to prevent UI blocking
- Use `requestAnimationFrame` for smooth updates
- Skip materials that already have correct textures

### Error Handling
- Graceful handling of disposed or invalid materials
- Recovery from partial processing failures
- Logging for debugging texture application issues

## Integration Recommendations

### Immediate Implementation (Quick Fix)
1. Add `applyTextureToExistingModels()` function
2. Call it after loading new models
3. Hook into existing material update system

### Comprehensive Implementation (Recommended)
1. Implement `TigerBuilderTextureRecovery` system
2. Add validation and diagnostic capabilities
3. Integrate with model loading workflow
4. Add user-facing recovery button

### Testing Strategy
1. Test with various scene configurations
2. Validate performance with large model counts
3. Test error recovery scenarios
4. Verify memory usage patterns

## References

- [Three.js Object3D.traverse Documentation](https://threejs.org/docs/#api/en/core/Object3D.traverse)
- [Three.js Material System](https://threejs.org/docs/#api/en/materials/Material)
- [JavaScript Set Performance](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)
- [Async/Await Best Practices](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)