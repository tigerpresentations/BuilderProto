# Three.js Research: Advanced Canvas Editing for GLB Scene Editor

## Problem Analysis

The current TigerBuilder canvas system (256x256) needs transformation into a sophisticated image composition tool with:
- Multi-layer image management
- Interactive manipulation controls
- Larger display canvas for desktop users
- Mode switching between drawing and image editing
- Extended canvas with texture boundary visualization
- Color swatch generation system

Current limitations:
- Single-layer drawing only
- Small canvas (256x256) with limited visual workspace
- No image selection/manipulation once placed
- Drawing tools always active (no mode separation)
- No layer management or z-ordering

## Official Examples Research

### Relevant Three.js Examples Analyzed:

1. **webgl_materials_texture_canvas.html**
   - Efficient `CanvasTexture` updates with `needsUpdate = true`
   - Real-time canvas-to-texture pipeline
   - Lightweight drawing interaction patterns

2. **webgl_interactive_voxelpainter.html**
   - Sophisticated raycasting for object selection
   - Mode-based interaction (shift-click vs normal click)
   - Real-time visual feedback systems
   - Clean separation of interaction modes

3. **webgl_interactive_cubes.html**
   - Object selection and highlighting patterns
   - Mouse interaction state management
   - Performance-optimized rendering loops

### Key Patterns Identified:
- **Raycasting**: Essential for precise object selection
- **State Management**: Clean separation of interaction modes
- **Visual Feedback**: Immediate response to user actions
- **Event Throttling**: Performance optimization for real-time updates

## Recommended Approach

### 1. Dual-Canvas Architecture

**Display Canvas (Larger)**: Visual workspace for user interaction
- Size: 512x512 or 768x768 pixels for desktop comfort
- Handles: Mouse events, visual feedback, manipulation controls
- Overlays: Selection handles, boundaries, UI elements

**Texture Canvas (Fixed)**: Internal 1024x1024 for Three.js material
- Size: Maintains 1024x1024 for high-quality textures
- Purpose: Final composite sent to Three.js material
- Updates: Only when composition changes (performance optimized)

```javascript
// Dual canvas setup
const displayCanvas = document.getElementById('displayCanvas'); // 768x768 visible
const textureCanvas = document.createElement('canvas'); // 1024x1024 internal
textureCanvas.width = textureCanvas.height = 1024;
```

### 2. Layer Management System

**Image Layer Structure**:
```javascript
class ImageLayer {
    constructor(image, id) {
        this.image = image;
        this.id = id;
        this.transform = {
            x: 0, y: 0,
            scaleX: 1, scaleY: 1,
            rotation: 0,
            visible: true
        };
        this.bounds = { x: 0, y: 0, width: 0, height: 0 };
        this.selected = false;
    }
    
    render(ctx, scale) {
        ctx.save();
        ctx.translate(this.transform.x * scale, this.transform.y * scale);
        ctx.rotate(this.transform.rotation);
        ctx.scale(this.transform.scaleX, this.transform.scaleY);
        ctx.drawImage(this.image, -this.bounds.width/2, -this.bounds.height/2);
        ctx.restore();
    }
}
```

**Layer Manager**:
```javascript
class LayerManager {
    constructor() {
        this.layers = [];
        this.selectedLayer = null;
        this.nextId = 1;
    }
    
    addLayer(image) {
        const layer = new ImageLayer(image, this.nextId++);
        this.layers.push(layer);
        return layer;
    }
    
    selectLayer(id) {
        this.selectedLayer = this.layers.find(l => l.id === id);
        this.layers.forEach(l => l.selected = (l.id === id));
    }
    
    getLayerAt(x, y) {
        // Hit testing from top layer down
        for (let i = this.layers.length - 1; i >= 0; i--) {
            if (this.isPointInLayer(x, y, this.layers[i])) {
                return this.layers[i];
            }
        }
        return null;
    }
}
```

### 3. Mode Management System

**Mode Types**:
- `DRAW`: Traditional drawing tools active
- `SELECT`: Image selection and manipulation
- `NAVIGATE`: View-only mode for canvas panning/zooming

```javascript
class ModeManager {
    constructor() {
        this.currentMode = 'SELECT';
        this.modes = {
            DRAW: new DrawMode(),
            SELECT: new SelectMode(),
            NAVIGATE: new NavigateMode()
        };
    }
    
    setMode(modeName) {
        this.modes[this.currentMode].deactivate();
        this.currentMode = modeName;
        this.modes[this.currentMode].activate();
        this.updateUI();
    }
    
    handleEvent(event) {
        return this.modes[this.currentMode].handleEvent(event);
    }
}
```

### 4. Interactive Manipulation Controls

**Selection Handles System**:
```javascript
class SelectionHandles {
    constructor(layer) {
        this.layer = layer;
        this.handles = [
            'top-left', 'top-right', 'bottom-left', 'bottom-right',
            'top', 'bottom', 'left', 'right', 'rotate'
        ];
    }
    
    render(ctx, scale) {
        if (!this.layer.selected) return;
        
        const bounds = this.getScaledBounds(scale);
        this.drawBoundingBox(ctx, bounds);
        this.drawHandles(ctx, bounds);
        this.drawRotationHandle(ctx, bounds);
    }
    
    getHandleAt(x, y, scale) {
        const bounds = this.getScaledBounds(scale);
        const handleSize = 8;
        
        for (const handle of this.handles) {
            const pos = this.getHandlePosition(handle, bounds);
            if (this.isPointInHandle(x, y, pos, handleSize)) {
                return handle;
            }
        }
        return null;
    }
}
```

**Drag Operations**:
```javascript
class DragOperation {
    constructor(layer, handle, startPos) {
        this.layer = layer;
        this.handle = handle;
        this.startPos = startPos;
        this.startTransform = { ...layer.transform };
    }
    
    update(currentPos) {
        const deltaX = currentPos.x - this.startPos.x;
        const deltaY = currentPos.y - this.startPos.y;
        
        switch(this.handle) {
            case 'move':
                this.updatePosition(deltaX, deltaY);
                break;
            case 'top-left':
                this.updateCornerResize(deltaX, deltaY, -1, -1);
                break;
            case 'rotate':
                this.updateRotation(currentPos);
                break;
        }
    }
}
```

### 5. Extended Canvas with Active Area

**Viewport Management**:
```javascript
class CanvasViewport {
    constructor(displaySize, textureSize) {
        this.displaySize = displaySize; // e.g., 768x768
        this.textureSize = textureSize; // e.g., 1024x1024
        this.scale = displaySize / textureSize;
        this.offset = { x: 0, y: 0 };
        this.activeArea = { x: 0, y: 0, width: textureSize, height: textureSize };
    }
    
    renderActiveAreaBounds(ctx) {
        ctx.save();
        ctx.strokeStyle = '#007bff';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        
        const bounds = this.getActiveAreaBounds();
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        
        // Add corner markers
        this.renderCornerMarkers(ctx, bounds);
        ctx.restore();
    }
    
    isInActiveArea(x, y) {
        const textureCoords = this.displayToTextureCoords(x, y);
        return textureCoords.x >= 0 && textureCoords.x <= this.textureSize &&
               textureCoords.y >= 0 && textureCoords.y <= this.textureSize;
    }
}
```

### 6. Color Swatch Generator

**Swatch Creation System**:
```javascript
class ColorSwatchGenerator {
    constructor() {
        this.swatchSize = { width: 100, height: 100 };
    }
    
    generateSwatch(color, size = this.swatchSize) {
        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Convert to image for layer system
        return new Promise(resolve => {
            canvas.toBlob(blob => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = URL.createObjectURL(blob);
            });
        });
    }
    
    async createSwatchFromPicker(colorValue) {
        const swatch = await this.generateSwatch(colorValue);
        return layerManager.addLayer(swatch);
    }
}
```

## Implementation Roadmap

### Phase 1: Dual Canvas Setup (2-3 hours)
1. Create larger display canvas (768x768)
2. Implement internal texture canvas (1024x1024)
3. Set up coordinate transformation between canvases
4. Maintain existing Three.js texture pipeline

**Key Implementation:**
```javascript
function initDualCanvas() {
    // Create display canvas
    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = displayCanvas.height = 768;
    
    // Keep existing texture canvas at 1024x1024
    textureCanvas.width = textureCanvas.height = 1024;
    
    // Set up coordinate scaling
    const scale = 768 / 1024;
    
    // Replace current canvas in UI
    const parent = drawCanvas.parentNode;
    parent.replaceChild(displayCanvas, drawCanvas);
}
```

### Phase 2: Mode Management (3-4 hours)
1. Create mode switching UI (tabs or toggle buttons)
2. Implement DrawMode class for existing drawing functionality
3. Implement SelectMode class for image manipulation
4. Add mode-specific cursor changes and UI feedback

**UI Integration:**
```html
<div class="mode-selector">
    <button class="mode-btn active" data-mode="SELECT">Select</button>
    <button class="mode-btn" data-mode="DRAW">Draw</button>
</div>
```

### Phase 3: Layer System Implementation (4-5 hours)
1. Create ImageLayer class with transform properties
2. Implement LayerManager for z-ordering and selection
3. Add layer list UI component
4. Integrate with existing image upload functionality

**Layer List UI:**
```html
<div class="layer-panel">
    <h4>Layers</h4>
    <div id="layerList" class="layer-list">
        <!-- Dynamic layer items -->
    </div>
</div>
```

### Phase 4: Interactive Manipulation (5-6 hours)
1. Implement selection handles rendering
2. Create drag operation classes
3. Add resize, rotate, and move functionality
4. Implement hit testing for layer selection

**Event Handler Integration:**
```javascript
displayCanvas.addEventListener('mousedown', (e) => {
    const coords = getCanvasCoords(e);
    
    if (modeManager.currentMode === 'SELECT') {
        const layer = layerManager.getLayerAt(coords.x, coords.y);
        if (layer) {
            layerManager.selectLayer(layer.id);
            startDragOperation(layer, coords);
        }
    }
});
```

### Phase 5: Extended Canvas Features (2-3 hours)
1. Implement viewport management for extended canvas
2. Add active area boundary visualization
3. Create preview system for out-of-bounds content
4. Add visual feedback for texture boundaries

### Phase 6: Color Swatch System (2 hours)
1. Create ColorSwatchGenerator class
2. Integrate with color picker UI
3. Add drag-and-drop swatch creation
4. Connect to layer management system

### Phase 7: Performance Optimization (2-3 hours)
1. Implement canvas update throttling
2. Add layer visibility culling
3. Optimize texture canvas updates
4. Add memory management for disposed layers

## Technical Considerations

### Performance Strategies
1. **Throttled Updates**: Limit texture updates to 30fps during manipulation
2. **Dirty Region Tracking**: Only update changed canvas areas
3. **Layer Culling**: Skip rendering invisible or out-of-bounds layers
4. **Memory Management**: Proper disposal of canvas resources

### Canvas2D vs WebGL Approaches
**Recommended: Canvas2D for simplicity**
- Easier image manipulation and compositing
- Built-in text rendering and vector graphics
- Simpler event handling and hit testing
- Better compatibility with existing codebase

**WebGL consideration**: Only if performance becomes critical with 10+ layers

### Memory Management
```javascript
class LayerManager {
    removeLayer(id) {
        const layer = this.layers.find(l => l.id === id);
        if (layer) {
            // Clean up image resources
            if (layer.image.src.startsWith('blob:')) {
                URL.revokeObjectURL(layer.image.src);
            }
            this.layers = this.layers.filter(l => l.id !== id);
            this.updateComposite();
        }
    }
}
```

### Event Handling Best Practices
```javascript
class EventManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.throttledUpdate = this.throttle(this.updateTexture.bind(this), 33); // 30fps
    }
    
    throttle(func, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
}
```

## Integration with Existing Codebase

### Maintaining Compatibility
1. Keep existing `drawCanvas` variable name for texture updates
2. Preserve current Three.js texture pipeline
3. Maintain scene serialization format compatibility
4. Keep existing material detection logic

### Migration Strategy
1. Wrap existing drawing functionality in DrawMode class
2. Replace canvas UI gradually (display first, then functionality)
3. Add feature flags for progressive enhancement
4. Maintain fallback to original system if needed

## References

- [Three.js CanvasTexture Documentation](https://threejs.org/docs/#api/en/textures/CanvasTexture)
- [Three.js Interactive Examples](https://threejs.org/examples/#webgl_interactive_cubes)
- [Canvas Texture Example](https://threejs.org/examples/webgl_materials_texture_canvas.html)
- [Voxel Painter Interaction Patterns](https://threejs.org/examples/webgl_interactive_voxelpainter.html)
- [Canvas 2D API - Hit Testing](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Hit_regions_and_accessibility)