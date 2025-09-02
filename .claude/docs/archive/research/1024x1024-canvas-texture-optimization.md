# Three.js Research: 1024x1024 Canvas Texture Performance Optimization

## Problem Analysis

The current GLB scene editor uses 256x256 canvas textures which appear grainy for production use. Upgrading to 1024x1024 presents significant challenges:

- **Memory Impact**: 1024x1024 = 16x memory usage vs 256x256 (4MB vs 256KB per texture)
- **Real-time Performance**: Canvas drawing and texture updates at high resolution strain 60fps target
- **Mobile Limitations**: Memory constraints on mobile devices are more severe
- **Multiple Textures**: Supporting multiple GLB models with canvas textures compounds memory usage

Current implementation analysis reveals:
- Uses `THREE.CanvasTexture` with immediate `needsUpdate = true` on canvas changes
- Canvas-to-texture pipeline updates every frame when drawing occurs
- Memory disposal is properly handled but high-resolution textures stress GPU memory limits

## Official Examples Research

### Three.js Canvas Texture Pattern
From `webgl_materials_texture_canvas.html`:
```javascript
// Standard pattern for canvas textures
material.map = new THREE.CanvasTexture(drawingCanvas);
material.map.needsUpdate = true;
```

### Key Findings from Three.js Community
- **Memory Issue**: "You allocate a new ~4MB texture on each click. At some point your context runs out of memory" - confirmed 1024x1024 texture memory issues
- **Size Optimization**: "Reduce your textures down to match what they are on screen" - critical for performance
- **Disposal Pattern**: Manual cleanup required for geometry, materials, and textures to prevent memory leaks

## Recommended Approach

### 1. Aggressive Canvas Texture Optimization

```javascript
// Optimized 1024x1024 CanvasTexture setup
function setupOptimizedCanvasTexture() {
    canvasTexture = new THREE.CanvasTexture(drawCanvas);
    
    // Critical optimizations for 1024x1024
    canvasTexture.generateMipmaps = false;  // Disable for performance - saves 30% memory
    canvasTexture.minFilter = THREE.LinearFilter;  // No mipmap filtering
    canvasTexture.magFilter = THREE.LinearFilter;
    canvasTexture.flipY = false;
    canvasTexture.format = THREE.RGBFormat;  // Use RGB instead of RGBA where possible
    canvasTexture.type = THREE.UnsignedByteType;
    canvasTexture.anisotropy = 1;  // Disable anisotropic filtering for performance
    canvasTexture.wrapS = THREE.ClampToEdgeWrapping;
    canvasTexture.wrapT = THREE.ClampToEdgeWrapping;
}
```

### 2. Throttled Texture Updates

```javascript
// Implement update throttling to maintain 60fps
let textureUpdateThrottle = false;
const TEXTURE_UPDATE_INTERVAL = 16; // ~60fps

function requestTextureUpdate() {
    if (textureUpdateThrottle) return;
    textureUpdateThrottle = true;
    
    setTimeout(() => {
        if (canvasTexture) {
            canvasTexture.needsUpdate = true;
            markNeedsRender();
        }
        textureUpdateThrottle = false;
    }, TEXTURE_UPDATE_INTERVAL);
}
```

### 3. Canvas Drawing Optimization

```javascript
// Optimized canvas context settings for 1024x1024
function setupOptimizedCanvas() {
    const drawCanvas = document.getElementById('drawCanvas');
    drawCanvas.width = 1024;
    drawCanvas.height = 1024;
    
    const ctx = drawCanvas.getContext('2d', {
        alpha: false,  // Disable alpha channel if not needed
        desynchronized: true,  // Allow asynchronous rendering
        willReadFrequently: false  // Optimize for write-heavy operations
    });
    
    // Optimize drawing operations
    ctx.imageSmoothingEnabled = false;  // Disable smoothing for pixel-perfect drawing
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}
```

### 4. Memory Management Strategy

```javascript
// Enhanced cleanup for 1024x1024 textures
function cleanupHighResTexture() {
    if (canvasTexture) {
        canvasTexture.dispose();
        canvasTexture = null;
    }
    
    // Force garbage collection hint
    if (window.gc) window.gc();
}

// Memory usage monitoring
function checkMemoryUsage() {
    if (performance.memory) {
        const memInfo = performance.memory;
        const memUsageMB = memInfo.usedJSHeapSize / (1024 * 1024);
        
        // Alert if memory usage exceeds threshold (adjust based on device)
        if (memUsageMB > 500) {  // 500MB threshold
            console.warn('High memory usage detected:', memUsageMB, 'MB');
        }
    }
}
```

### 5. Device Capability Detection

```javascript
// Detect device capabilities for 1024x1024 textures
function detectTextureCapabilities() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) return { supported: false };
    
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxMemory = performance.memory ? performance.memory.jsHeapSizeLimit : 0;
    
    // Check if device can reasonably handle 1024x1024 textures
    const canHandle1024 = maxTextureSize >= 1024 && 
                         (maxMemory === 0 || maxMemory > 100 * 1024 * 1024); // 100MB min
    
    return {
        supported: true,
        maxTextureSize,
        recommendResolution: canHandle1024 ? 1024 : 512,
        memoryAvailable: maxMemory
    };
}
```

## Advanced Performance Techniques

### 1. OffscreenCanvas for Drawing Operations

```javascript
// Use OffscreenCanvas for complex drawing operations
function createOffscreenDrawingCanvas() {
    if (typeof OffscreenCanvas !== 'undefined') {
        const offscreenCanvas = new OffscreenCanvas(1024, 1024);
        const offscreenCtx = offscreenCanvas.getContext('2d', {
            alpha: false,
            desynchronized: true
        });
        
        return { canvas: offscreenCanvas, ctx: offscreenCtx };
    }
    
    // Fallback to regular canvas
    return null;
}
```

### 2. Chunked Canvas Updates

```javascript
// Update canvas in chunks to spread CPU load
function updateCanvasInChunks(imageData, chunkSize = 256) {
    const chunks = [];
    for (let y = 0; y < 1024; y += chunkSize) {
        for (let x = 0; x < 1024; x += chunkSize) {
            chunks.push({ x, y, width: chunkSize, height: chunkSize });
        }
    }
    
    let chunkIndex = 0;
    function processNextChunk() {
        if (chunkIndex >= chunks.length) {
            canvasTexture.needsUpdate = true;
            return;
        }
        
        const chunk = chunks[chunkIndex++];
        // Process chunk
        ctx.putImageData(imageData, chunk.x, chunk.y, 
                        chunk.x, chunk.y, chunk.width, chunk.height);
        
        requestAnimationFrame(processNextChunk);
    }
    
    processNextChunk();
}
```

### 3. Texture Compression Strategy

```javascript
// Use texture compression where available
function setupCompressedTexture() {
    const gl = renderer.getContext();
    const extensions = {
        s3tc: gl.getExtension('WEBGL_compressed_texture_s3tc'),
        etc1: gl.getExtension('WEBGL_compressed_texture_etc1'),
        pvrtc: gl.getExtension('WEBGL_compressed_texture_pvrtc')
    };
    
    // Use compressed format if available
    if (extensions.s3tc) {
        canvasTexture.format = THREE.RGBFormat;
        canvasTexture.type = extensions.s3tc.COMPRESSED_RGB_S3TC_DXT1_EXT;
    }
}
```

## Implementation Roadmap

### Phase 1: Core 1024x1024 Implementation
1. Update canvas dimensions to 1024x1024
2. Implement optimized CanvasTexture settings (no mipmaps, RGB format)
3. Add throttled texture update system
4. Implement enhanced memory cleanup

### Phase 2: Performance Optimization
1. Add device capability detection
2. Implement OffscreenCanvas support with fallback
3. Add memory usage monitoring
4. Optimize canvas context settings

### Phase 3: Advanced Features
1. Implement chunked canvas updates for large operations
2. Add texture compression support where available
3. Implement smart resolution scaling based on viewport size
4. Add performance metrics and automatic quality adjustment

### Testing Strategy
1. Test on various devices (desktop, tablet, mobile)
2. Monitor memory usage patterns during extended use
3. Measure frame rates during real-time drawing operations
4. Test with multiple GLB models loaded simultaneously

## Browser Compatibility and Fallbacks

### Automatic Quality Scaling
```javascript
function getOptimalCanvasSize() {
    const capabilities = detectTextureCapabilities();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (capabilities.recommendResolution >= 1024 && !isMobile) {
        return 1024;
    } else if (capabilities.recommendResolution >= 512) {
        return 512;
    }
    return 256;  // Fallback
}
```

## Performance Validation Metrics

- **Target Frame Rate**: Maintain 60fps during drawing operations
- **Memory Usage**: Stay under 500MB total heap usage
- **Texture Update Latency**: < 16ms for real-time updates
- **Mobile Compatibility**: Functional on devices with 2GB+ RAM

## References

- [Three.js CanvasTexture Documentation](https://threejs.org/docs/#api/en/textures/CanvasTexture)
- [WebGL Best Practices - Mozilla](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- [OffscreenCanvas Performance Guide](https://web.dev/articles/offscreen-canvas)
- [Three.js Memory Management Patterns](https://discoverthreejs.com/tips-and-tricks/)
- [Canvas API Performance Optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)

## Conclusion

Implementing 1024x1024 canvas textures requires aggressive optimization but is achievable with the recommended approach. The key is combining multiple optimization strategies: disabled mipmaps, throttled updates, optimized canvas contexts, robust memory management, and device-aware capability detection. The implementation should prioritize stability and performance over visual quality, with automatic fallbacks ensuring broad device compatibility.