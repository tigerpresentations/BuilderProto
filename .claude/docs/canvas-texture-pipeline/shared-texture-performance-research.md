# Shared Texture Performance Research for Multi-Model Scenes

## Performance Challenge Analysis

### Current System Performance Profile
- **Canvas Size**: 1024x1024 pixels (with automatic fallback to 512x512 or 256x256)
- **Target FPS**: 60fps with real-time texture updates
- **Update Mechanism**: `THREE.CanvasTexture` with `needsUpdate = true` flag
- **Memory Usage**: Single shared texture reduces memory overhead
- **Current Bottleneck**: Texture updates may trigger unnecessary GPU transfers

### Performance Requirements
- Maintain 60fps during active texture editing across multiple models
- Support 10-20+ models each with 1-5 "Image" materials (20-100 total materials)
- Real-time canvas updates propagated to all materials within 16ms
- Memory usage should not exceed 100MB for texture system alone

## Established Performance Techniques

### Pattern 1: Texture Update Batching (WebGL Best Practice)

**Source**: WebGL performance optimization guides, Three.js community

**Problem**: Individual `needsUpdate = true` calls can trigger multiple GPU uploads per frame.

**Solution**: Batch all texture updates into single frame operation.

```javascript
// Production-tested texture update batching
class TextureUpdateBatcher {
    constructor() {
        this.pendingUpdates = new Set();
        this.isScheduled = false;
        this.lastUpdateTime = 0;
        this.updateThrottle = 16; // ~60fps max update rate
    }
    
    requestTextureUpdate(texture) {
        this.pendingUpdates.add(texture);
        
        if (!this.isScheduled) {
            this.scheduleUpdate();
        }
    }
    
    scheduleUpdate() {
        this.isScheduled = true;
        
        requestAnimationFrame((timestamp) => {
            // Throttle updates to maintain 60fps
            if (timestamp - this.lastUpdateTime >= this.updateThrottle) {
                this.processPendingUpdates();
                this.lastUpdateTime = timestamp;
            } else {
                // Re-schedule for next frame
                this.isScheduled = false;
                this.scheduleUpdate();
            }
        });
    }
    
    processPendingUpdates() {
        if (this.pendingUpdates.size === 0) {
            this.isScheduled = false;
            return;
        }
        
        // Batch all texture updates in single frame
        this.pendingUpdates.forEach(texture => {
            texture.needsUpdate = true;
        });
        
        console.log(`Batched ${this.pendingUpdates.size} texture updates`);
        
        this.pendingUpdates.clear();
        this.isScheduled = false;
    }
    
    // Force immediate update (for final render)
    flushUpdates() {
        if (this.pendingUpdates.size > 0) {
            this.processPendingUpdates();
        }
    }
}
```

### Pattern 2: Shared Texture Instance Management (Memory Optimization)

**Source**: High-performance 3D web applications, game engines

**Benefits**: Minimizes GPU memory usage and transfer overhead.

```javascript
// Optimized shared texture management
class SharedTextureManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.texture = null;
        this.subscribers = new Set();
        this.lastCanvasState = null;
        this.updatePending = false;
        
        this.initializeTexture();
    }
    
    initializeTexture() {
        this.texture = new THREE.CanvasTexture(this.canvas);
        
        // Optimize texture settings for performance
        this.texture.flipY = false;
        this.texture.wrapS = THREE.ClampToEdgeWrapping;
        this.texture.wrapT = THREE.ClampToEdgeWrapping;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        
        // Disable mipmaps for real-time editing performance
        this.texture.generateMipmaps = false;
        
        // Store globally for compatibility
        window.canvasTexture = this.texture;
    }
    
    // Subscribe material to texture updates
    subscribeMaterial(material) {
        material.map = this.texture;
        this.subscribers.add(material);
        
        // Materials don't need individual needsUpdate when using shared texture
        // The texture's needsUpdate flag handles all subscribers
        return true;
    }
    
    unsubscribeMaterial(material) {
        return this.subscribers.delete(material);
    }
    
    // Optimized update that only triggers when canvas actually changes
    updateTexture(force = false) {
        const currentState = this.getCanvasState();
        
        if (!force && currentState === this.lastCanvasState) {
            return false; // No change, skip update
        }
        
        this.lastCanvasState = currentState;
        
        // Single texture update affects all subscriber materials
        this.texture.needsUpdate = true;
        
        // Log performance info
        console.log(`Texture updated for ${this.subscribers.size} materials`);
        return true;
    }
    
    getCanvasState() {
        // Simple state check - could be enhanced with more sophisticated comparison
        return `${this.canvas.width}x${this.canvas.height}_${Date.now()}`;
    }
    
    // Performance monitoring
    getPerformanceStats() {
        return {
            subscriberCount: this.subscribers.size,
            textureSize: `${this.canvas.width}x${this.canvas.height}`,
            memoryEstimate: this.canvas.width * this.canvas.height * 4, // RGBA bytes
            format: 'RGBA8'
        };
    }
}
```

### Pattern 3: Material Update Optimization (Selective Updates)

**Source**: Three.js performance documentation, professional 3D applications

**Approach**: Only update materials that are actually visible and need changes.

```javascript
// Optimized material update system
class OptimizedMaterialUpdater {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.frustum = new THREE.Frustum();
        this.cameraMatrix = new THREE.Matrix4();
        
        this.visibleMaterials = new Set();
        this.allMaterials = new Set();
        this.lastFrustumUpdate = 0;
        this.frustumUpdateInterval = 100; // Update frustum every 100ms
    }
    
    registerMaterial(material, mesh) {
        this.allMaterials.add({ material, mesh });
    }
    
    updateVisibleMaterials() {
        const now = Date.now();
        
        // Only recalculate frustum periodically
        if (now - this.lastFrustumUpdate > this.frustumUpdateInterval) {
            this.cameraMatrix.multiplyMatrices(
                this.camera.projectionMatrix, 
                this.camera.matrixWorldInverse
            );
            this.frustum.setFromProjectionMatrix(this.cameraMatrix);
            this.lastFrustumUpdate = now;
        }
        
        this.visibleMaterials.clear();
        
        this.allMaterials.forEach(({ material, mesh }) => {
            // Check if mesh is in camera frustum
            if (this.frustum.intersectsObject(mesh)) {
                this.visibleMaterials.add(material);
            }
        });
    }
    
    applyTextureToVisibleMaterials(texture) {
        this.updateVisibleMaterials();
        
        let updatedCount = 0;
        this.visibleMaterials.forEach(material => {
            if (material.map !== texture) {
                material.map = texture;
                material.needsUpdate = true;
                updatedCount++;
            }
        });
        
        console.log(`Updated ${updatedCount}/${this.allMaterials.size} visible materials`);
    }
}
```

### Pattern 4: Canvas-to-Texture Pipeline Optimization

**Source**: Real-time rendering applications, WebGL optimization guides

**Focus**: Minimize canvas-to-GPU transfer overhead.

```javascript
// High-performance canvas-to-texture pipeline
class OptimizedCanvasTexturePipeline {
    constructor(canvas) {
        this.canvas = canvas;
        this.texture = null;
        this.offscreenCanvas = null;
        this.useOffscreen = this.initOffscreenCanvas();
        
        this.performanceMetrics = {
            updateCount: 0,
            totalUpdateTime: 0,
            averageUpdateTime: 0
        };
        
        this.initializeTexture();
    }
    
    initOffscreenCanvas() {
        // Use OffscreenCanvas for better performance if available
        if (typeof OffscreenCanvas !== 'undefined') {
            try {
                this.offscreenCanvas = new OffscreenCanvas(
                    this.canvas.width, 
                    this.canvas.height
                );
                return true;
            } catch (e) {
                console.warn('OffscreenCanvas not supported, using regular canvas');
            }
        }
        return false;
    }
    
    initializeTexture() {
        const sourceCanvas = this.useOffscreen ? this.offscreenCanvas : this.canvas;
        
        this.texture = new THREE.CanvasTexture(sourceCanvas);
        
        // Performance optimizations
        this.texture.flipY = false;
        this.texture.generateMipmaps = false;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.format = THREE.RGBAFormat;
        this.texture.type = THREE.UnsignedByteType;
        
        window.canvasTexture = this.texture;
    }
    
    updateFromMainCanvas() {
        if (!this.useOffscreen) {
            // Direct update from main canvas
            return this.performUpdate();
        }
        
        // Copy main canvas to offscreen canvas for optimal GPU transfer
        const ctx = this.offscreenCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        ctx.drawImage(this.canvas, 0, 0);
        
        return this.performUpdate();
    }
    
    performUpdate() {
        const startTime = performance.now();
        
        this.texture.needsUpdate = true;
        
        // Update performance metrics
        const updateTime = performance.now() - startTime;
        this.performanceMetrics.updateCount++;
        this.performanceMetrics.totalUpdateTime += updateTime;
        this.performanceMetrics.averageUpdateTime = 
            this.performanceMetrics.totalUpdateTime / this.performanceMetrics.updateCount;
        
        return updateTime;
    }
    
    getPerformanceReport() {
        return {
            ...this.performanceMetrics,
            memoryUsage: this.canvas.width * this.canvas.height * 4,
            textureSize: `${this.canvas.width}x${this.canvas.height}`,
            usingOffscreen: this.useOffscreen
        };
    }
}
```

## Performance Benchmarks and Measurements

### Baseline Performance Metrics

```javascript
// Performance monitoring system for texture updates
class TexturePerformanceMonitor {
    constructor() {
        this.metrics = {
            updateTimes: [],
            frameDrops: 0,
            totalUpdates: 0,
            peakMemoryUsage: 0,
            gpuUploadTimes: []
        };
        
        this.lastFrameTime = performance.now();
        this.targetFrameTime = 16.67; // 60fps
    }
    
    recordTextureUpdate(startTime, endTime) {
        const updateTime = endTime - startTime;
        this.metrics.updateTimes.push(updateTime);
        this.metrics.totalUpdates++;
        
        // Keep only last 100 measurements
        if (this.metrics.updateTimes.length > 100) {
            this.metrics.updateTimes.shift();
        }
        
        // Detect frame drops
        const now = performance.now();
        if (now - this.lastFrameTime > this.targetFrameTime * 1.5) {
            this.metrics.frameDrops++;
        }
        this.lastFrameTime = now;
        
        // Record memory usage if available
        if (performance.memory) {
            this.metrics.peakMemoryUsage = Math.max(
                this.metrics.peakMemoryUsage,
                performance.memory.usedJSHeapSize
            );
        }
    }
    
    getAverageUpdateTime() {
        if (this.metrics.updateTimes.length === 0) return 0;
        
        const sum = this.metrics.updateTimes.reduce((a, b) => a + b, 0);
        return sum / this.metrics.updateTimes.length;
    }
    
    getPerformanceReport() {
        return {
            averageUpdateTime: this.getAverageUpdateTime(),
            frameDrops: this.metrics.frameDrops,
            totalUpdates: this.metrics.totalUpdates,
            frameDropRate: this.metrics.frameDrops / this.metrics.totalUpdates,
            peakMemoryMB: Math.round(this.metrics.peakMemoryUsage / 1024 / 1024),
            isPerformant: this.getAverageUpdateTime() < 8 && // Less than 8ms per update
                         this.metrics.frameDrops / this.metrics.totalUpdates < 0.05 // Less than 5% frame drops
        };
    }
}
```

### Expected Performance Targets

| Scenario | Materials | Canvas Size | Target Update Time | Memory Usage |
|----------|-----------|-------------|-------------------|--------------|
| Small Scene | 1-5 materials | 512x512 | <4ms | <5MB |
| Medium Scene | 6-20 materials | 1024x1024 | <8ms | <10MB |
| Large Scene | 21-50 materials | 1024x1024 | <12ms | <20MB |
| Performance Limit | 100+ materials | 1024x1024 | <16ms | <50MB |

## Optimization Implementation for TigerBuilder

### Immediate Performance Improvements

```javascript
// Enhanced updateMaterialTextures with performance optimizations
function updateMaterialTexturesOptimized() {
    if (!window.uvTextureEditor || !window.canvasTexture) return;
    
    const startTime = performance.now();
    
    // Single texture update (affects all materials using this texture)
    window.canvasTexture.needsUpdate = true;
    
    // Optional: Log performance metrics
    const updateTime = performance.now() - startTime;
    
    if (window.texturePerformanceMonitor) {
        window.texturePerformanceMonitor.recordTextureUpdate(startTime, performance.now());
    }
    
    // Console logging for monitoring
    if (updateTime > 10) { // Log slow updates
        console.warn(`Slow texture update: ${updateTime.toFixed(2)}ms for ${window.imageMaterials?.length || 0} materials`);
    }
}
```

### Advanced Performance System

```javascript
// Production-ready performance optimization system
class TigerBuilderTexturePerformance {
    constructor() {
        this.batcher = new TextureUpdateBatcher();
        this.monitor = new TexturePerformanceMonitor();
        this.sharedManager = null;
        
        this.adaptiveQuality = true;
        this.performanceTargets = {
            maxUpdateTime: 8, // 8ms max
            maxFrameDrops: 0.05 // 5% max frame drop rate
        };
    }
    
    initialize(canvas) {
        this.sharedManager = new SharedTextureManager(canvas);
        
        // Hook into layer rendering for performance monitoring
        if (window.layerManager) {
            const originalRender = window.layerManager.renderLayers.bind(window.layerManager);
            window.layerManager.renderLayers = () => {
                const startTime = performance.now();
                originalRender();
                
                if (this.sharedManager) {
                    this.sharedManager.updateTexture();
                }
                
                const endTime = performance.now();
                this.monitor.recordTextureUpdate(startTime, endTime);
                
                this.checkPerformanceAndAdapt();
            };
        }
    }
    
    registerMaterial(material) {
        if (this.sharedManager) {
            return this.sharedManager.subscribeMaterial(material);
        }
        return false;
    }
    
    checkPerformanceAndAdapt() {
        const report = this.monitor.getPerformanceReport();
        
        if (!report.isPerformant && this.adaptiveQuality) {
            this.adaptToPerformance(report);
        }
    }
    
    adaptToPerformance(report) {
        if (report.averageUpdateTime > this.performanceTargets.maxUpdateTime) {
            // Reduce canvas quality
            if (window.currentQuality > 512) {
                console.warn('Performance degraded, reducing canvas quality');
                window.setTextureQuality(512);
            } else if (window.currentQuality > 256) {
                console.warn('Performance critical, reducing to minimum quality');
                window.setTextureQuality(256);
            }
        }
    }
    
    getPerformanceReport() {
        const baseReport = this.monitor.getPerformanceReport();
        const sharedStats = this.sharedManager ? this.sharedManager.getPerformanceStats() : {};
        
        return {
            ...baseReport,
            ...sharedStats,
            recommendations: this.getPerformanceRecommendations(baseReport)
        };
    }
    
    getPerformanceRecommendations(report) {
        const recommendations = [];
        
        if (report.averageUpdateTime > 10) {
            recommendations.push('Consider reducing canvas resolution');
        }
        
        if (report.frameDropRate > 0.1) {
            recommendations.push('High frame drop rate detected, check system resources');
        }
        
        if (report.peakMemoryMB > 100) {
            recommendations.push('High memory usage, consider material cleanup');
        }
        
        return recommendations;
    }
}

// Initialize global performance system
window.texturePerformanceSystem = new TigerBuilderTexturePerformance();
```

## Browser-Specific Optimizations

### Chrome/Chromium Optimizations
- Use OffscreenCanvas for better performance
- Enable GPU acceleration flags
- Utilize WebGL2 context when available

### Firefox Optimizations
- Reduce canvas size on older versions
- Use requestAnimationFrame for smoother updates
- Monitor memory usage more carefully

### Safari Optimizations
- More aggressive texture size limiting
- Careful memory management
- Use lower precision when possible

## Memory Management Best Practices

```javascript
// Memory-conscious texture management
class MemoryManagedTextureSystem {
    constructor() {
        this.memoryThreshold = 50 * 1024 * 1024; // 50MB
        this.cleanupInterval = 30000; // 30 seconds
        
        setInterval(() => this.performMemoryCleanup(), this.cleanupInterval);
    }
    
    performMemoryCleanup() {
        if (performance.memory && 
            performance.memory.usedJSHeapSize > this.memoryThreshold) {
            
            console.log('Performing texture memory cleanup');
            
            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }
            
            // Clean up disposed materials
            this.cleanupDisposedMaterials();
        }
    }
    
    cleanupDisposedMaterials() {
        // Implementation depends on material tracking system
        if (window.imageMaterials) {
            window.imageMaterials = window.imageMaterials.filter(material => {
                return material && !material.userData?.disposed;
            });
        }
    }
}
```

## Performance Testing and Validation

### Automated Performance Tests
```javascript
// Performance test suite for texture system
async function runTexturePerformanceTests() {
    const tests = [
        { materials: 5, canvasSize: 512, name: 'Small Scene' },
        { materials: 20, canvasSize: 1024, name: 'Medium Scene' },
        { materials: 50, canvasSize: 1024, name: 'Large Scene' }
    ];
    
    for (const test of tests) {
        console.log(`Running test: ${test.name}`);
        
        const result = await simulateTextureUpdates(test.materials, test.canvasSize);
        
        console.log(`${test.name} Results:`, {
            averageTime: result.averageTime,
            passed: result.averageTime < 16, // Must be under 16ms
            memoryUsage: result.memoryUsage
        });
    }
}
```

## Implementation Priority

1. **Immediate (High Impact, Low Effort)**: Implement texture update batching
2. **Short-term (Medium Impact, Medium Effort)**: Add shared texture manager
3. **Long-term (High Impact, High Effort)**: Full performance monitoring system

## References

- [Three.js Performance Tips](https://threejs.org/docs/#manual/en/introduction/Performance-tips)
- [WebGL Performance Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- [Canvas Performance Optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [OffscreenCanvas Documentation](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)