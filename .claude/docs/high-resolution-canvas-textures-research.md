# Three.js Research: High-Resolution Canvas Textures for GLB Scene Editor

## Problem Analysis

The current TigerBuilder implementation uses 256x256 canvas textures for real-time texture editing on GLB models. This research investigates the feasibility of higher resolutions (512x512, 1024x1024, 2048x2048) while maintaining 60fps performance and identifying optimization strategies.

### Current Implementation Analysis
- **Canvas Size**: Fixed 256x256 pixels
- **Texture Settings**: `flipY = false`, `generateMipmaps = true`, `LinearMipmapLinearFilter`
- **Update Method**: `canvasTexture.needsUpdate = true` on canvas changes
- **Performance**: Targets 60fps with smart rendering (frame interval limiting)

## Official Examples Research

### 1. webgl_materials_texture_canvas.html
- Uses 128x128 canvas for real-time drawing
- Demonstrates `THREE.CanvasTexture` with immediate updates
- Sets `material.map.needsUpdate = true` for texture synchronization
- Simple, efficient approach for small textures

### 2. webgl_materials_texture_partialupdate.html  
- Uses 32x32 DataTexture for optimal performance
- Key optimization: `generateMipmaps = false` and `LinearFilter`
- Employs `renderer.copyTextureToTexture()` for region updates
- Demonstrates that smaller textures significantly improve performance

### 3. Performance Patterns from Examples
- Smaller texture sizes (32x32 to 256x256) preferred for real-time updates
- Mipmap generation disabled for dynamic textures
- Linear filtering without mipmaps for best performance

## GPU Memory and Browser Limitations

### Memory Usage by Resolution (RGBA format)
- **256x256**: ~256KB GPU memory
- **512x512**: ~1MB GPU memory  
- **1024x1024**: ~4MB GPU memory
- **2048x2048**: ~16MB GPU memory

### Browser Texture Size Limits
- **WebGL 1.0**: Minimum 2048x2048 guaranteed
- **WebGL 2.0**: Minimum 2048x2048, often 4096x4096+
- **Mobile devices**: Often limited to 2048x2048
- **Desktop**: Usually supports 8192x8192 or higher

### Power-of-Two Requirements
All textures should use power-of-two dimensions (256, 512, 1024, 2048) for:
- Optimal GPU memory allocation
- Mipmap support when needed
- Better performance across all devices

## Performance Scaling Analysis

### Texture Update Performance Impact
Based on research and Three.js community findings:

1. **Setting `needsUpdate = true` Performance**
   - Can cause significant FPS drops on large textures
   - Impact scales quadratically with texture size
   - 2048x2048 textures can drop FPS from 60 to 20-30

2. **Canvas Drawing Performance**
   - HTML5 Canvas operations scale well with size
   - 256x256 to 1024x1024: minimal performance difference
   - 2048x2048: noticeable impact on complex drawing operations

3. **GPU Upload Performance**
   - Initial texture creation: one-time cost
   - Runtime updates: major bottleneck for large textures
   - `texSubImage2D` calls become expensive at high resolutions

## Recommended Optimization Strategies

### 1. Dynamic Resolution Scaling
```javascript
// Detect device capabilities
const maxTextureSize = renderer.capabilities.maxTextureSize;
const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Choose resolution based on device
const optimalResolution = isMobile ? 512 : Math.min(1024, maxTextureSize);
```

### 2. Performance-Optimized Texture Settings
```javascript
canvasTexture.generateMipmaps = false;  // Disable for real-time updates
canvasTexture.minFilter = THREE.LinearFilter;
canvasTexture.magFilter = THREE.LinearFilter;
canvasTexture.flipY = false;  // Better for GLB compatibility
canvasTexture.format = THREE.RGBAFormat;
canvasTexture.type = THREE.UnsignedByteType;
```

### 3. Smart Update Frequency
```javascript
// Throttle texture updates to maintain performance
let updateTimer;
function scheduleTextureUpdate() {
    if (updateTimer) return;
    updateTimer = requestAnimationFrame(() => {
        if (canvasTexture) {
            canvasTexture.needsUpdate = true;
        }
        updateTimer = null;
    });
}
```

### 4. Level of Detail (LOD) System
- Use 256x256 for distant objects
- Switch to 512x512 for medium distance
- Reserve 1024x1024+ for close-up detail work
- Implement based on camera distance to model

## Implementation Roadmap

### Phase 1: Dynamic Resolution Detection
1. Detect device capabilities (`maxTextureSize`, GPU memory estimates)
2. Implement resolution selection based on device class
3. Add user preference override option

### Phase 2: Performance Monitoring
1. Add FPS monitoring during texture updates
2. Implement automatic quality scaling if FPS drops below threshold
3. Add texture memory usage tracking

### Phase 3: Optimized Texture Pipeline
1. Replace current texture settings with performance-optimized configuration
2. Implement smart update scheduling
3. Add fallback mechanisms for low-end devices

### Phase 4: Advanced Features (Optional)
1. Implement texture compression for WebGL 2.0 devices
2. Add LOD system based on camera distance
3. Explore WebGPU migration for better texture performance

## Recommended Resolution Ranges

### Conservative Approach (Broad Compatibility)
- **Desktop**: 512x512 default, 1024x1024 optional
- **Mobile**: 256x256 default, 512x512 maximum
- **Low-end devices**: Fixed 256x256

### Performance-Oriented Approach  
- **Desktop**: 1024x1024 default, 2048x2048 for detail work
- **Mobile**: 512x512 default with automatic scaling
- **Fallback**: Automatic reduction if FPS < 45

### High-End Approach (Latest Hardware)
- **Desktop**: 2048x2048 for professional use
- **Mobile**: 1024x1024 on recent devices
- **Requires**: Robust performance monitoring and fallbacks

## Testing and Validation Strategy

### Performance Benchmarks
1. Measure FPS during continuous canvas drawing
2. Test texture update frequency limits
3. Monitor GPU memory usage across resolutions
4. Validate on mobile devices and older hardware

### Quality Assessment  
1. Compare visual quality at different resolutions
2. Test with various GLB model complexities
3. Evaluate texture clarity at different camera distances
4. User testing for perceived quality vs. performance trade-offs

## Fallback Strategies

### Automatic Quality Scaling
```javascript
class AdaptiveCanvasTexture {
    constructor(initialSize = 512) {
        this.currentSize = initialSize;
        this.performanceHistory = [];
        this.canvas = this.createCanvas(initialSize);
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.setupOptimalSettings();
    }
    
    checkPerformanceAndScale() {
        const avgFPS = this.getAverageFPS();
        if (avgFPS < 45 && this.currentSize > 256) {
            this.scaleDown();
        } else if (avgFPS > 55 && this.currentSize < 1024) {
            this.scaleUp();
        }
    }
}
```

### Device-Specific Profiles
- **High-end desktop**: Start with 1024x1024
- **Mid-range desktop**: Start with 512x512  
- **Mobile devices**: Start with 256x256, scale up if performance allows
- **Fallback mode**: Always use 256x256 if other sizes fail

## Code Patterns for Implementation

### Dynamic Canvas Creation
```javascript
function createOptimalCanvas() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const isMobile = window.innerWidth < 768;
    const maxTextureSize = renderer.capabilities.maxTextureSize;
    
    let targetSize = isMobile ? 512 : 1024;
    targetSize = Math.min(targetSize, maxTextureSize);
    
    const canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    
    return canvas;
}
```

### Performance Monitoring Integration
```javascript
class TexturePerformanceMonitor {
    constructor() {
        this.frameTimes = [];
        this.textureUpdateTimes = [];
    }
    
    measureTextureUpdate(updateFunction) {
        const start = performance.now();
        updateFunction();
        const end = performance.now();
        
        this.textureUpdateTimes.push(end - start);
        if (this.textureUpdateTimes.length > 60) {
            this.textureUpdateTimes.shift();
        }
        
        return this.getAverageUpdateTime() < 16.67; // 60fps threshold
    }
}
```

## References

- [Three.js Texture Documentation](https://threejs.org/docs/#api/en/textures/Texture)
- [WebGL Canvas Texture Example](https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_texture_canvas.html)
- [Three.js Performance Guide](https://discoverthreejs.com/tips-and-tricks/)
- [WebGL Texture Size Limits](https://webglstats.com/)
- [Canvas Texture Partial Updates](https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_texture_partialupdate.html)

## Key Takeaways

1. **Start Simple**: 512x512 provides excellent quality-to-performance ratio
2. **Monitor Performance**: Always implement FPS monitoring for texture updates
3. **Device-Aware**: Use different resolutions based on device capabilities
4. **Optimize Settings**: Disable mipmaps and use linear filtering for real-time updates
5. **Fallback Ready**: Always provide 256x256 fallback for compatibility
6. **Test Extensively**: Validate performance across device types and use cases

The research indicates that moving beyond 256x256 is definitely feasible, with 512x512 being the sweet spot for most use cases, and 1024x1024 being viable for desktop applications with proper performance monitoring and fallback mechanisms.