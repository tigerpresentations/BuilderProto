# Three.js Research: Dual-Canvas Coordinate System Architecture

## Problem Analysis

Your texture editor demonstrates a classic dual-canvas coordinate system issue where:

- **Display Canvas**: 512x512 pixels for user interaction and visual feedback
- **Texture Canvas**: Variable resolution (256x256 to 1024x1024) for the actual 3D texture
- **Current Issues**: Handle hit detection misalignment, offset selection boundaries, scaling inconsistencies

### Technical Challenge Overview

The core issue stems from storing layer coordinates in display space (512x512) while rendering to variable texture sizes, creating a coordinate transformation bottleneck. The current approach of scaling coordinates by `scaleRatio = textureSize / 512` during rendering introduces cumulative precision errors and coordinate system confusion.

### Three.js Specific Considerations

Three.js `CanvasTexture` expects consistent coordinate systems and efficient `needsUpdate` cycles. The dual-canvas approach, while performance-optimized, creates coordinate system drift that affects:
- Layer positioning accuracy
- Handle interaction zones
- Selection boundary calculations
- Canvas-to-texture coordinate mapping

## Official Examples Research

### Three.js Canvas Texture Patterns

From the official Three.js manual and examples, key patterns emerge:

1. **Single Canvas Approach**: Most Three.js examples use a single canvas as the texture source
2. **Coordinate Normalization**: UV mapping works in normalized 0-1 space
3. **Transform Consistency**: Canvas transformations should match the intended texture usage
4. **Update Efficiency**: `texture.needsUpdate = true` should be called sparingly for performance

### Relevant Three.js Example Patterns

- **Dynamic Canvas Generation**: Examples show runtime canvas creation with consistent coordinate systems
- **Text Rendering**: Uses `ctx.translate()` and `ctx.scale()` for precise positioning
- **Texture Optimization**: Power-of-2 textures with appropriate filtering settings

## Recommended Approach

### 1. Unified Normalized Coordinate System (Recommended)

**Architecture**: Store all layer coordinates in normalized 0-1 space, independent of canvas dimensions.

```javascript
// Normalized coordinate system (0-1 space)
class NormalizedImageLayer {
    constructor(image, options = {}) {
        // All coordinates in 0-1 normalized space
        this.x = options.x || 0.5;      // 0.5 = center
        this.y = options.y || 0.5;      // 0.5 = center
        this.scaleX = options.scaleX || 0.2;  // Relative to canvas size
        this.scaleY = options.scaleY || 0.2;  // Relative to canvas size
        this.rotation = options.rotation || 0;
    }
    
    // Convert to display coordinates
    toDisplayCoords(displaySize = 512) {
        return {
            x: this.x * displaySize,
            y: this.y * displaySize,
            width: this.image.width * this.scaleX * displaySize,
            height: this.image.height * this.scaleY * displaySize
        };
    }
    
    // Convert to texture coordinates
    toTextureCoords(textureSize) {
        return {
            x: this.x * textureSize,
            y: this.y * textureSize,
            width: this.image.width * this.scaleX * textureSize,
            height: this.image.height * this.scaleY * textureSize
        };
    }
}
```

### 2. Coordinate Transformation Layer

**Architecture**: Create a dedicated coordinate transformation system that handles all conversions.

```javascript
class CoordinateSystem {
    constructor(displaySize = 512) {
        this.displaySize = displaySize;
        this.textureSize = 1024; // Current texture resolution
    }
    
    // Convert display coordinates to normalized space
    displayToNormalized(x, y) {
        return {
            x: x / this.displaySize,
            y: y / this.displaySize
        };
    }
    
    // Convert normalized coordinates to display space
    normalizedToDisplay(x, y) {
        return {
            x: x * this.displaySize,
            y: y * this.displaySize
        };
    }
    
    // Convert normalized coordinates to texture space
    normalizedToTexture(x, y) {
        return {
            x: x * this.textureSize,
            y: y * this.textureSize
        };
    }
    
    // Update texture resolution
    setTextureSize(newSize) {
        this.textureSize = newSize;
    }
}
```

### 3. Three.js Integration Considerations

**Canvas-to-Texture Pipeline Optimization**:

```javascript
// Optimized rendering with consistent coordinates
class DualCanvasRenderer {
    constructor(displayCanvas, textureCanvas) {
        this.displayCanvas = displayCanvas;
        this.textureCanvas = textureCanvas;
        this.coordinateSystem = new CoordinateSystem();
        
        // Three.js texture setup
        this.texture = new THREE.CanvasTexture(textureCanvas);
        this.texture.flipY = false; // GLB compatibility
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
    }
    
    renderLayer(layer) {
        // Render to display canvas
        const displayCoords = layer.toDisplayCoords(this.displayCanvas.width);
        this.drawLayerToCanvas(this.displayCanvas, displayCoords);
        
        // Render to texture canvas
        const textureCoords = layer.toTextureCoords(this.textureCanvas.width);
        this.drawLayerToCanvas(this.textureCanvas, textureCoords);
        
        // Update Three.js texture
        this.texture.needsUpdate = true;
    }
}
```

## Performance Optimization Strategies

### 1. Render Throttling
- Maintain 60fps display updates
- Throttle texture updates to 30fps for performance
- Use `requestAnimationFrame` for smooth interactions

### 2. Memory Management
- Reuse canvas contexts
- Avoid creating new coordinate objects during render loops
- Use object pooling for temporary coordinate calculations

### 3. Hit Detection Optimization
- Pre-calculate handle bounds in display coordinates
- Use spatial indexing for large numbers of layers
- Cache transformed bounds until layer properties change

## Implementation Roadmap

### Phase 1: Coordinate System Foundation
1. **Implement NormalizedImageLayer class** with 0-1 coordinate space
2. **Create CoordinateSystem transformation utility** 
3. **Update layer storage** to use normalized coordinates
4. **Migrate existing layers** to normalized space

### Phase 2: Rendering Architecture
1. **Implement dual-canvas renderer** with coordinate transformations
2. **Update hit detection methods** to use normalized coordinates  
3. **Modify handle positioning** to work in display space
4. **Test coordinate accuracy** across different texture resolutions

### Phase 3: Interaction Updates
1. **Update mouse event handlers** to convert to normalized space
2. **Modify drag and resize logic** to work with normalized coordinates
3. **Update keyboard shortcuts** and double-click handlers
4. **Test all interaction modes** for accuracy

### Phase 4: Optimization & Polish
1. **Implement render throttling** for performance
2. **Add coordinate debugging tools** for development
3. **Performance testing** across different texture sizes
4. **Documentation and code cleanup**

## Code Structure Recommendations

### File Organization
```
coordinate-system.js     // Core coordinate transformation utilities
normalized-layer.js      // Updated layer class with normalized coordinates  
dual-canvas-renderer.js  // Rendering system with coordinate awareness
interaction-manager.js   // Mouse/keyboard event handling with proper transforms
```

### Integration Points
- **canvas-editor.js**: Update to use coordinate system classes
- **layer-manager.js**: Migrate to normalized coordinate storage
- **main.js**: Initialize coordinate system with proper canvas references

## Testing and Validation Strategies

### Unit Tests
1. **Coordinate transformation accuracy** across different resolutions
2. **Hit detection precision** with various layer sizes
3. **Handle positioning correctness** at different scales

### Integration Tests
1. **Canvas switching** between different texture resolutions
2. **Layer persistence** when changing texture quality
3. **Interaction consistency** across coordinate transformations

### Visual Validation
1. **Grid overlay system** to verify coordinate alignment
2. **Debug mode** showing both display and texture coordinates
3. **Handle positioning indicators** for visual verification

## References

- [Three.js Canvas Textures Manual](https://threejs.org/manual/en/canvas-textures.html)
- [Three.js CanvasTexture Documentation](https://threejs.org/docs/api/en/textures/CanvasTexture.html)
- [UV Mapping Fundamentals](https://discoverthreejs.com/book/first-steps/textures-intro/)
- Three.js Examples: css2d_label.html, webgl_math_orientation_transform.html

## Conclusion

The recommended unified normalized coordinate system (0-1 space) provides the most maintainable and scalable solution. This approach eliminates coordinate system drift, ensures precision across different texture resolutions, and aligns with Three.js UV mapping conventions.

The implementation should prioritize simplicity and reliability over advanced features, focusing on creating a solid foundation that can handle future texture resolution changes without requiring coordinate system migrations.