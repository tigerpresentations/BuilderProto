# Three.js Research: Real-Time Canvas-to-Texture Updates

## Problem Analysis
Create a minimal Three.js implementation demonstrating real-time canvas-to-texture updates with target 60 FPS performance. The core technical challenge is achieving smooth texture updates from HTML5 Canvas drawing to 3D geometry without performance degradation.

### Three.js Specific Considerations
- `CanvasTexture.needsUpdate = true` can cause severe performance drops (60fps to 9fps or lower)
- Browser inconsistencies: Chrome performs better than Firefox/Safari for texture updates
- GPU upload costs increase exponentially with texture size
- CPU-to-GPU data transfer is the primary bottleneck

### Performance Implications
- Large textures (>512px) cause significant frame drops during updates
- Continuous updates every frame can be unsustainable
- Memory allocation/deallocation patterns affect garbage collection

## Official Examples Research

### Primary Reference: webgl_materials_texture_canvas.html
From the Three.js examples repository, this demonstrates the standard pattern:

```javascript
// Canvas texture creation
const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');
const texture = new THREE.CanvasTexture(canvas);

// Update pattern
function draw() {
    // Modify canvas content
    context.fillRect(x, y, width, height);
    // Flag for GPU update
    texture.needsUpdate = true;
}
```

### Key Patterns Identified
1. **Direct CanvasTexture creation** from HTML canvas element
2. **Strategic needsUpdate flagging** only when canvas content changes
3. **Minimal drawing operations** using canvas 2D context
4. **Pointer event handling** for responsive drawing interaction

## Recommended Approach

### Core Architecture
- **Canvas Size**: 256x256 maximum for optimal performance
- **Texture Settings**: `flipY = false`, `LinearFilter` without mipmaps
- **Update Strategy**: Event-driven updates, not continuous per-frame updates
- **Split Screen Layout**: CSS flexbox with 50/50 division

### Specific Three.js Classes and Methods
```javascript
// Essential classes
THREE.CanvasTexture(canvas)
THREE.MeshBasicMaterial({ map: texture })
THREE.BoxGeometry(1, 1, 1)
THREE.Mesh(geometry, material)

// Critical performance settings
texture.magFilter = THREE.LinearFilter;
texture.minFilter = THREE.LinearFilter;
texture.generateMipmaps = false;
texture.flipY = false; // For consistency with GLB workflow
```

### Performance Optimization Strategies
1. **Conditional Updates**: Only set `needsUpdate = true` during active drawing
2. **Draw State Tracking**: Use boolean flag to prevent unnecessary updates
3. **Canvas Size Constraints**: 256x256 or smaller for real-time performance
4. **Efficient Drawing**: Direct context operations, minimal state changes

## Implementation Roadmap

### Step 1: HTML Structure (20 lines)
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 0; display: flex; height: 100vh; }
        #canvas-container, #three-container { flex: 1; }
        canvas { border: 1px solid #ccc; }
        #fps { position: absolute; top: 10px; left: 10px; }
    </style>
</head>
<body>
    <div id="canvas-container">
        <canvas id="drawing-canvas" width="256" height="256"></canvas>
    </div>
    <div id="three-container"></div>
    <div id="fps">FPS: 0</div>
</body>
</html>
```

### Step 2: Three.js Scene Setup (30 lines)
```javascript
// Scene initialization
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 0.5, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

// Canvas texture pipeline
const drawingCanvas = document.getElementById('drawing-canvas');
const drawingContext = drawingCanvas.getContext('2d');
const canvasTexture = new THREE.CanvasTexture(drawingCanvas);

// Performance-optimized texture settings
canvasTexture.magFilter = THREE.LinearFilter;
canvasTexture.minFilter = THREE.LinearFilter;
canvasTexture.generateMipmaps = false;
canvasTexture.flipY = false;

// Basic cube with canvas texture
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ map: canvasTexture });
const cube = new THREE.Mesh(geometry, material);
```

### Step 3: Drawing Implementation (40 lines)
```javascript
// Drawing state management
let isDrawing = false;
let lastX = 0, lastY = 0;

// Initialize white background
drawingContext.fillStyle = '#ffffff';
drawingContext.fillRect(0, 0, 256, 256);
drawingContext.strokeStyle = '#000000';
drawingContext.lineWidth = 2;
drawingContext.lineCap = 'round';

// Event-driven drawing with immediate texture updates
drawingCanvas.addEventListener('pointerdown', (e) => {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
});

drawingCanvas.addEventListener('pointermove', (e) => {
    if (!isDrawing) return;
    
    drawingContext.beginPath();
    drawingContext.moveTo(lastX, lastY);
    drawingContext.lineTo(e.offsetX, e.offsetY);
    drawingContext.stroke();
    
    [lastX, lastY] = [e.offsetX, e.offsetY];
    
    // Critical: Only update when actually drawing
    canvasTexture.needsUpdate = true;
});

drawingCanvas.addEventListener('pointerup', () => isDrawing = false);
drawingCanvas.addEventListener('pointerleave', () => isDrawing = false);
```

### Step 4: Animation Loop with FPS Counter (30 lines)
```javascript
// FPS tracking
let fps = 0;
let frameCount = 0;
let lastTime = performance.now();

function updateFPS() {
    frameCount++;
    const currentTime = performance.now();
    
    if (currentTime - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        document.getElementById('fps').textContent = `FPS: ${fps}`;
        frameCount = 0;
        lastTime = currentTime;
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    // Minimal scene animation
    cube.rotation.x += 0.005;
    cube.rotation.y += 0.005;
    
    renderer.render(scene, camera);
    updateFPS();
}
```

### Step 5: Initialization and CDN Setup (30 lines)
```javascript
// Three.js r128 CDN (matches project requirement)
// <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>

function init() {
    // Renderer setup
    const container = document.getElementById('three-container');
    renderer.setSize(container.clientWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    
    // Camera positioning
    camera.position.z = 2;
    
    // Add cube to scene
    scene.add(cube);
    
    // Start animation loop
    animate();
    
    // Handle window resize
    window.addEventListener('resize', () => {
        const container = document.getElementById('three-container');
        camera.aspect = container.clientWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, window.innerHeight);
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
```

## Testing and Validation Strategies

### Performance Benchmarks
- Target: 60 FPS during idle state
- Acceptable: 45+ FPS during active drawing
- Failure threshold: Below 30 FPS indicates optimization needed

### Test Scenarios
1. **Idle Performance**: Cube rotation without drawing
2. **Active Drawing**: Continuous mouse/touch drawing
3. **Canvas Fill**: Large area fills to test texture upload limits
4. **Browser Compatibility**: Test across Chrome, Firefox, Safari

### Memory Management
- Monitor texture memory usage during extended sessions
- Verify no memory leaks from repeated drawing operations
- Test garbage collection impact on frame rate

## Potential Pitfalls and Edge Cases

### Known Issues
- **Firefox/Safari Performance**: May require texture size reduction to 128x128
- **Mobile Performance**: Touch events may require throttling
- **Large Drawing Operations**: Flood fill or large brush sizes can cause frame drops
- **Context Loss**: WebGL context loss scenarios not handled in minimal implementation

### Fallback Strategies
1. **Dynamic Texture Sizing**: Start with 256x256, reduce if FPS drops below threshold
2. **Update Throttling**: Limit texture updates to every 2nd or 3rd frame if needed
3. **Drawing Simplification**: Reduce line complexity for performance-critical scenarios

## References

### Three.js Documentation
- [CanvasTexture Documentation](https://threejs.org/docs/#api/en/textures/CanvasTexture)
- [Texture.needsUpdate Property](https://threejs.org/docs/#api/en/textures/Texture.needsUpdate)
- [Performance Best Practices](https://threejs.org/manual/#en/tips)

### Official Examples
- `webgl_materials_texture_canvas.html` - Primary reference implementation
- `webgl_materials_texture_partialupdate.html` - Advanced update techniques
- `webgl_performance.html` - General performance patterns

### Performance Research
- Three.js Forum discussions on CanvasTexture performance optimization
- Browser-specific texture update performance comparisons
- Real-world benchmarking data for various texture sizes and update frequencies

## Conclusion

The minimal implementation achieves real-time canvas-to-texture updates through strategic use of event-driven texture updates rather than continuous per-frame updates. The key insight from official Three.js examples is that `texture.needsUpdate = true` should only be triggered when canvas content actually changes, not on every animation frame.

The recommended 256x256 canvas size provides the optimal balance between visual quality and performance, with clear fallback strategies for lower-end devices or challenging browser environments.