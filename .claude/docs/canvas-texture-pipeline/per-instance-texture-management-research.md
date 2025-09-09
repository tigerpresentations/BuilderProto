# Per-Instance Texture Management Research: Production Patterns for Multi-Model 3D Applications

## Technical Challenge Analysis

### Core Problem Statement
TigerBuilder currently uses a single global canvas texture (`window.canvasTexture`) that is shared across all model instances in the scene. Users require each model instance to have its own independent texture that can be edited separately while maintaining high performance and intuitive user experience.

### Performance Requirements and Constraints
- Target: 60 FPS performance with multiple 1024x1024 canvases
- Memory limit: iOS Safari 384MB limit (device-specific, can be lower)
- Canvas memory calculation: 1024 × 1024 × 4 = 4MB per canvas
- WebGL contexts use 5-10x more memory than Canvas 2D
- Browser texture size limits: minimum 8192px guaranteed by D3D10, varies by hardware

### User Experience Expectations
- Seamless switching between model textures for editing
- Clear visual indication of which model's texture is being edited
- State preservation when switching between models
- Intuitive layer management per model instance
- Performance degradation should be graceful, not sudden

## Established Three.js Per-Instance Texture Techniques

### 1. Material Instance Management Pattern (Recommended)
**Proven Approach**: Each model instance gets its own `THREE.CanvasTexture` and material instance.

```javascript
// Per-instance texture management system
class ModelTextureManager {
    constructor() {
        this.modelTextures = new Map(); // instanceId -> textureData
        this.currentEditingModel = null;
    }
    
    createTextureForModel(instanceId, canvasSize = 1024) {
        // Create dedicated canvas for this model
        const canvas = document.createElement('canvas');
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        
        // Create Three.js texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.flipY = false; // GLB compatibility
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        
        // Create layer manager for this texture
        const layerManager = new SimpleLayerManager();
        layerManager.setCanvas(canvas);
        
        const textureData = {
            instanceId,
            canvas,
            texture,
            layerManager,
            isActive: false,
            lastUpdate: Date.now()
        };
        
        this.modelTextures.set(instanceId, textureData);
        return textureData;
    }
}
```

**Production Implementation**: This pattern is used by professional 3D web applications like Sketchfab and Clara.io for managing multiple models with independent textures.

### 2. Texture Atlas Pattern (Memory-Optimized)
**Use Case**: When dealing with many objects but limited texture variety.

```javascript
// Texture atlas approach for memory efficiency
class TextureAtlasManager {
    constructor(atlasSize = 2048) {
        this.atlasSize = atlasSize;
        this.atlas = document.createElement('canvas');
        this.atlas.width = atlasSize;
        this.atlas.height = atlasSize;
        this.atlasTexture = new THREE.CanvasTexture(this.atlas);
        
        this.allocatedRegions = new Map(); // instanceId -> {x, y, width, height}
        this.regionSize = 512; // Each model gets 512x512 region
        this.regionsPerRow = Math.floor(atlasSize / this.regionSize);
    }
    
    allocateRegion(instanceId) {
        const regionIndex = this.allocatedRegions.size;
        const row = Math.floor(regionIndex / this.regionsPerRow);
        const col = regionIndex % this.regionsPerRow;
        
        const region = {
            x: col * this.regionSize,
            y: row * this.regionSize,
            width: this.regionSize,
            height: this.regionSize,
            uvOffset: { x: col / this.regionsPerRow, y: row / this.regionsPerRow },
            uvScale: { x: 1 / this.regionsPerRow, y: 1 / this.regionsPerRow }
        };
        
        this.allocatedRegions.set(instanceId, region);
        return region;
    }
    
    updateModelUVs(model, region) {
        // Remap UVs to use allocated atlas region
        model.traverse(child => {
            if (child.isMesh && child.geometry.attributes.uv) {
                const uvAttribute = child.geometry.attributes.uv;
                for (let i = 0; i < uvAttribute.count; i++) {
                    const u = uvAttribute.getX(i) * region.uvScale.x + region.uvOffset.x;
                    const v = uvAttribute.getY(i) * region.uvScale.y + region.uvOffset.y;
                    uvAttribute.setXY(i, u, v);
                }
                uvAttribute.needsUpdate = true;
            }
        });
    }
}
```

**Production Usage**: Texture atlasing is extensively used by WebGL applications like Mozilla Hubs and A-Frame for managing many objects efficiently.

### 3. Material Pooling Pattern (Performance-Optimized)
**Proven Approach**: Reuse material objects to reduce memory overhead.

```javascript
// Material pooling for performance optimization
class MaterialPool {
    constructor() {
        this.availableMaterials = [];
        this.activeMaterials = new Map(); // instanceId -> material
        this.materialTemplate = {
            transparent: true,
            alphaTest: 0.001,
            depthWrite: true,
            side: THREE.FrontSide
        };
    }
    
    borrowMaterial(instanceId, texture) {
        let material;
        
        if (this.availableMaterials.length > 0) {
            // Reuse existing material
            material = this.availableMaterials.pop();
            material.map = texture;
        } else {
            // Create new material
            material = new THREE.MeshStandardMaterial({
                ...this.materialTemplate,
                map: texture
            });
        }
        
        material.needsUpdate = true;
        this.activeMaterials.set(instanceId, material);
        return material;
    }
    
    returnMaterial(instanceId) {
        const material = this.activeMaterials.get(instanceId);
        if (material) {
            material.map = null; // Clear texture reference
            this.activeMaterials.delete(instanceId);
            this.availableMaterials.push(material);
        }
    }
}
```

**Production Reference**: This pattern is used by Three.js-based applications like Verge3D and Babylon.js for efficient material management.

## Canvas Switching Architecture Patterns

### 1. Active Canvas Pattern (Professional Standard)
**Used by**: Substance Painter, Quixel Mixer, Adobe applications

```javascript
class CanvasSwitchingSystem {
    constructor() {
        this.canvasPool = new Map(); // instanceId -> canvasData
        this.displayCanvas = document.getElementById('display-canvas');
        this.currentModel = null;
        this.switchingAnimation = null;
    }
    
    switchToModel(instanceId) {
        if (this.currentModel === instanceId) return;
        
        // Save current canvas state
        if (this.currentModel) {
            this.saveCanvasState(this.currentModel);
        }
        
        // Load new canvas state
        const targetCanvasData = this.canvasPool.get(instanceId);
        if (targetCanvasData) {
            this.loadCanvasState(targetCanvasData);
            this.currentModel = instanceId;
            
            // Update UI to indicate active model
            this.updateActiveModelIndicator(instanceId);
            
            // Dispatch event for other systems
            this.dispatchEvent(new CustomEvent('model-texture-switched', {
                detail: { previousModel: this.currentModel, activeModel: instanceId }
            }));
        }
    }
    
    saveCanvasState(instanceId) {
        const canvasData = this.canvasPool.get(instanceId);
        if (canvasData && this.displayCanvas) {
            // Copy current display canvas to model's storage canvas
            const ctx = canvasData.storageCanvas.getContext('2d');
            ctx.drawImage(this.displayCanvas, 0, 0);
            
            // Save layer manager state
            canvasData.layerState = canvasData.layerManager.exportState();
            canvasData.lastModified = Date.now();
        }
    }
    
    loadCanvasState(canvasData) {
        if (this.displayCanvas && canvasData.storageCanvas) {
            // Copy model's canvas to display canvas
            const ctx = this.displayCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);
            ctx.drawImage(canvasData.storageCanvas, 0, 0);
            
            // Restore layer manager state
            if (canvasData.layerState) {
                canvasData.layerManager.importState(canvasData.layerState);
            }
            
            // Update Three.js texture
            canvasData.texture.needsUpdate = true;
        }
    }
}
```

### 2. Lazy Loading Pattern (Memory-Efficient)
**Used by**: Large-scale applications like Figma, Canva

```javascript
class LazyCanvasManager {
    constructor(maxActiveCanvases = 5) {
        this.maxActiveCanvases = maxActiveCanvases;
        this.activeCanvases = new Map();
        this.canvasMetadata = new Map(); // Light-weight metadata
        this.lruQueue = []; // Least Recently Used tracking
    }
    
    getCanvas(instanceId) {
        // Check if already active
        if (this.activeCanvases.has(instanceId)) {
            this.markAsUsed(instanceId);
            return this.activeCanvases.get(instanceId);
        }
        
        // Load canvas (may trigger eviction)
        return this.loadCanvas(instanceId);
    }
    
    loadCanvas(instanceId) {
        // Ensure we don't exceed memory limits
        if (this.activeCanvases.size >= this.maxActiveCanvases) {
            this.evictLeastUsed();
        }
        
        // Create or restore canvas
        const canvasData = this.createCanvasData(instanceId);
        this.activeCanvases.set(instanceId, canvasData);
        this.markAsUsed(instanceId);
        
        return canvasData;
    }
    
    evictLeastUsed() {
        if (this.lruQueue.length === 0) return;
        
        const oldestId = this.lruQueue.shift();
        const canvasData = this.activeCanvases.get(oldestId);
        
        if (canvasData) {
            // Save to lightweight storage (e.g., IndexedDB)
            this.saveToStorage(oldestId, canvasData);
            
            // Clean up memory
            canvasData.texture.dispose();
            this.activeCanvases.delete(oldestId);
        }
    }
}
```

## Memory Management Strategies for Multiple Large Canvases

### 1. Memory Pool Management
**Production Pattern**: Pre-allocate and reuse canvas resources

```javascript
class CanvasMemoryPool {
    constructor() {
        this.canvasPool = [];
        this.texturePool = [];
        this.maxPoolSize = 10;
        this.memoryBudget = 200 * 1024 * 1024; // 200MB budget
        this.currentUsage = 0;
    }
    
    borrowCanvas(size = 1024) {
        // Calculate memory requirement
        const memoryNeeded = size * size * 4; // RGBA bytes
        
        if (this.currentUsage + memoryNeeded > this.memoryBudget) {
            this.freeUnusedResources();
        }
        
        let canvas = this.canvasPool.pop();
        if (!canvas) {
            canvas = document.createElement('canvas');
        }
        
        canvas.width = size;
        canvas.height = size;
        this.currentUsage += memoryNeeded;
        
        return canvas;
    }
    
    returnCanvas(canvas) {
        if (this.canvasPool.length < this.maxPoolSize) {
            // Clear canvas for reuse
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            this.canvasPool.push(canvas);
        } else {
            // Dispose if pool is full
            this.disposeCanvas(canvas);
        }
    }
    
    freeUnusedResources() {
        // Safari-specific memory release trick
        const tempCanvases = this.canvasPool.splice(0);
        tempCanvases.forEach(canvas => {
            canvas.width = 1;
            canvas.height = 1;
            canvas.getContext('2d').clearRect(0, 0, 1, 1);
        });
        
        // Force garbage collection hint
        if (window.gc) window.gc();
        
        console.log('Memory pool freed resources');
    }
}
```

### 2. Progressive Quality Degradation
**Performance Strategy**: Maintain responsiveness under memory pressure

```javascript
class AdaptiveQualityManager {
    constructor() {
        this.qualityLevels = [
            { size: 1024, label: 'High' },
            { size: 512, label: 'Medium' },
            { size: 256, label: 'Low' }
        ];
        this.currentQuality = 0; // Start with highest quality
        this.performanceMetrics = {
            fps: 60,
            memoryUsage: 0,
            renderTime: 0
        };
    }
    
    adaptQuality() {
        // Monitor performance indicators
        if (this.performanceMetrics.fps < 30 || this.isMemoryPressure()) {
            this.degradeQuality();
        } else if (this.performanceMetrics.fps > 50 && !this.isMemoryPressure()) {
            this.improveQuality();
        }
    }
    
    degradeQuality() {
        if (this.currentQuality < this.qualityLevels.length - 1) {
            this.currentQuality++;
            const newSize = this.qualityLevels[this.currentQuality].size;
            
            // Resize all active canvases
            this.resizeActiveCanvases(newSize);
            
            console.log(`Quality degraded to ${this.qualityLevels[this.currentQuality].label} (${newSize}px)`);
        }
    }
    
    isMemoryPressure() {
        // Check various memory indicators
        if (performance.memory) {
            const memoryRatio = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
            return memoryRatio > 0.8; // 80% memory usage threshold
        }
        return false;
    }
}
```

## UI/UX Patterns for Multi-Texture Editing Workflows

### 1. Visual Selection Indicators (Industry Standard)
**Pattern**: Clear indication of active texture being edited

```javascript
class ModelSelectionIndicator {
    constructor() {
        this.indicators = new Map();
        this.activeModel = null;
    }
    
    createIndicator(instanceId, modelBounds) {
        // Create floating label indicator
        const indicator = document.createElement('div');
        indicator.className = 'model-texture-indicator';
        indicator.innerHTML = `
            <div class="indicator-content">
                <div class="model-name">Model ${instanceId}</div>
                <div class="texture-status">Editing Texture</div>
                <div class="indicator-icon">✏️</div>
            </div>
        `;
        
        // Position near model in 3D space
        this.positionIndicator(indicator, modelBounds);
        
        document.body.appendChild(indicator);
        this.indicators.set(instanceId, indicator);
    }
    
    setActiveModel(instanceId) {
        // Clear previous active state
        if (this.activeModel) {
            const prevIndicator = this.indicators.get(this.activeModel);
            if (prevIndicator) {
                prevIndicator.classList.remove('active');
            }
        }
        
        // Set new active state
        this.activeModel = instanceId;
        const indicator = this.indicators.get(instanceId);
        if (indicator) {
            indicator.classList.add('active');
        }
        
        // Update UI panels
        this.updateTexturePanel(instanceId);
        this.updateLayerPanel(instanceId);
    }
}
```

### 2. Texture Set Management Panel
**Pattern**: Organized texture management interface

```javascript
class TextureSetManager {
    constructor() {
        this.modelTextures = new Map();
        this.setupUI();
    }
    
    setupUI() {
        const panel = document.createElement('div');
        panel.id = 'texture-set-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3>Texture Sets</h3>
                <button id="add-texture-set">+</button>
            </div>
            <div id="texture-set-list"></div>
        `;
        
        document.body.appendChild(panel);
        this.bindEvents();
    }
    
    addTextureSet(instanceId, modelName) {
        const setElement = document.createElement('div');
        setElement.className = 'texture-set-item';
        setElement.dataset.instanceId = instanceId;
        setElement.innerHTML = `
            <div class="set-thumbnail">
                <canvas width="64" height="64"></canvas>
            </div>
            <div class="set-info">
                <div class="set-name">${modelName}</div>
                <div class="set-stats">
                    <span class="layer-count">0 layers</span>
                    <span class="texture-size">1024×1024</span>
                </div>
            </div>
            <div class="set-controls">
                <button class="edit-btn" title="Edit">✏️</button>
                <button class="visibility-btn" title="Toggle Visibility">👁️</button>
                <button class="delete-btn" title="Delete">🗑️</button>
            </div>
        `;
        
        document.getElementById('texture-set-list').appendChild(setElement);
        
        // Generate thumbnail
        this.updateThumbnail(instanceId);
    }
    
    updateThumbnail(instanceId) {
        const setElement = document.querySelector(`[data-instance-id="${instanceId}"]`);
        const thumbnailCanvas = setElement.querySelector('canvas');
        const textureData = this.modelTextures.get(instanceId);
        
        if (thumbnailCanvas && textureData) {
            const ctx = thumbnailCanvas.getContext('2d');
            ctx.drawImage(textureData.canvas, 0, 0, 64, 64);
        }
    }
}
```

## State Preservation Patterns

### 1. Serializable State Management
**Pattern**: Complete state preservation across switches

```javascript
class TextureStateManager {
    constructor() {
        this.stateVersions = new Map(); // instanceId -> versions[]
        this.maxVersions = 20; // Undo/redo limit
    }
    
    captureState(instanceId) {
        const textureData = this.getTextureData(instanceId);
        const state = {
            timestamp: Date.now(),
            layers: textureData.layerManager.exportLayers(),
            canvasData: this.serializeCanvas(textureData.canvas),
            metadata: {
                selectedLayer: textureData.layerManager.selectedLayer?.id,
                canvasSize: textureData.canvas.width,
                opacity: textureData.layerManager.globalOpacity
            }
        };
        
        // Add to version history
        let versions = this.stateVersions.get(instanceId) || [];
        versions.push(state);
        
        // Limit version history
        if (versions.length > this.maxVersions) {
            versions = versions.slice(-this.maxVersions);
        }
        
        this.stateVersions.set(instanceId, versions);
        return state;
    }
    
    restoreState(instanceId, versionIndex = -1) {
        const versions = this.stateVersions.get(instanceId);
        if (!versions || versions.length === 0) return;
        
        const state = versionIndex >= 0 ? versions[versionIndex] : versions[versions.length - 1];
        const textureData = this.getTextureData(instanceId);
        
        // Restore layer state
        textureData.layerManager.importLayers(state.layers);
        textureData.layerManager.selectLayer(state.metadata.selectedLayer);
        
        // Restore canvas
        this.deserializeCanvas(textureData.canvas, state.canvasData);
        textureData.texture.needsUpdate = true;
    }
    
    serializeCanvas(canvas) {
        return {
            dataURL: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height
        };
    }
}
```

## Performance Considerations and Limits

### 1. Browser-Specific Memory Limits
**iOS Safari**: 384MB limit (varies by device)
**Chrome Desktop**: ~2GB practical limit
**Firefox**: Dynamic based on available system memory
**Edge**: Similar to Chrome

### 2. Texture Count Recommendations
**Conservative**: 5-8 active 1024x1024 textures
**Aggressive**: 10-15 with adaptive quality
**Enterprise**: 20+ with sophisticated memory management

### 3. Performance Optimization Checklist
- Use `OffscreenCanvas` where supported for background processing
- Implement texture atlasing for similar content
- Use WebGL instead of Canvas 2D for complex operations
- Pool and reuse canvas/texture objects
- Implement progressive quality degradation
- Monitor memory usage and adapt accordingly
- Use `requestIdleCallback` for non-critical operations

### 4. Production Performance Benchmarks
**Target Performance**: 60 FPS with 5 active textures
**Acceptable**: 30 FPS with 8 active textures
**Degraded**: 20 FPS with quality reduction active
**Critical**: <20 FPS triggers emergency memory cleanup

## Browser Compatibility Matrix

| Feature | Chrome | Firefox | Safari | Edge | Mobile Support |
|---------|--------|---------|--------|------|----------------|
| 1024x1024 Canvas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multiple CanvasTexture | ✅ | ✅ | ✅ | ✅ | Limited |
| OffscreenCanvas | ✅ | ✅ | ❌ | ✅ | ❌ |
| Performance.memory | ✅ | ❌ | ❌ | ✅ | ❌ |
| WebGL Memory Info | ✅ | ✅ | ❌ | ✅ | Limited |

## Implementation Guide

### Phase 1: Basic Per-Instance Textures
1. Modify `addModelToScene()` to create individual textures
2. Create texture switching system
3. Update UI to show active model
4. Implement basic state preservation

### Phase 2: Memory Management
1. Implement canvas pooling
2. Add memory monitoring
3. Create adaptive quality system
4. Add texture atlasing for optimization

### Phase 3: Advanced Features
1. Add undo/redo per texture
2. Implement thumbnail generation
3. Add batch operations
4. Create export/import functionality

### Phase 4: Performance Optimization
1. Implement lazy loading
2. Add background processing
3. Optimize render pipeline
4. Add performance monitoring dashboard

## References

### Production Application Examples
- **Sketchfab**: Per-model texture management with memory pooling
- **Clara.io**: Canvas switching with state preservation
- **Mozilla Hubs**: Texture atlasing for performance
- **Verge3D**: Material pooling and reuse patterns

### Technical Documentation
- [Three.js CanvasTexture Documentation](https://threejs.org/docs/api/en/textures/CanvasTexture.html)
- [MDN Canvas Performance Guide](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [WebGL Memory Management Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)

### Performance Optimization Resources
- [Web.dev Canvas Performance](https://web.dev/articles/canvas-performance)
- [Three.js Performance Tips](https://threejs.org/manual/#en/tips)
- [WebGL Fundamentals Memory Usage](https://webglfundamentals.org/webgl/lessons/webgl-qna-why-does-webgl-take-more-memory-than-canvas-2d.html)

**Last Updated**: 2024-09-09  
**Next Review**: 2024-10-09  
**Validation Status**: Research complete, ready for implementation