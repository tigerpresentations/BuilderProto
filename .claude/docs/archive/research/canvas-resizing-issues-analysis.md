# Canvas Editor Resizing Issues Analysis

## Problem Overview

The dual-canvas system in `glb-scene-editor-1024.html` has several critical issues that cause image resizing problems when the panel width changes. The system uses:
- Display canvas: 512x512 for user interaction
- Texture canvas: 1024x1024 (or currentQuality) for Three.js texture generation

## Critical Issues Identified

### 1. **Incomplete Canvas Dimension Updates (Lines 1432-1439)**

**Issue**: The `updateCanvasSize()` function only changes the display canvas's CSS `max-width`, but doesn't update the actual canvas dimensions or coordinate system.

```javascript
updateCanvasSize(panel) {
    const displayCanvas = panel.querySelector('#display-canvas');
    if (!displayCanvas) return;
    
    const panelWidth = panel.offsetWidth;
    const availableWidth = panelWidth - 50; // Account for padding and resizer
    displayCanvas.style.maxWidth = Math.min(availableWidth, 512) + 'px';  // Only CSS styling!
}
```

**Problems**:
- Canvas internal dimensions remain 512x512 while visual size changes
- Creates coordinate system mismatch between mouse events and actual canvas pixels
- `e.offsetX/offsetY` values become incorrect when canvas is visually scaled

**Fix**: Update both CSS display size AND coordinate scaling factor:

```javascript
updateCanvasSize(panel) {
    const displayCanvas = panel.querySelector('#display-canvas');
    if (!displayCanvas) return;
    
    const panelWidth = panel.offsetWidth;
    const availableWidth = panelWidth - 50;
    const newDisplaySize = Math.min(availableWidth, 512);
    
    // Update display size
    displayCanvas.style.width = newDisplaySize + 'px';
    displayCanvas.style.height = newDisplaySize + 'px';
    
    // Update coordinate scaling factor for mouse events
    const coordinateScale = 512 / newDisplaySize;
    displayCanvas.dataset.coordinateScale = coordinateScale.toString();
    
    // Re-render layers to match new display size
    layerManager.renderLayers();
}
```

### 2. **Mouse Coordinate Transformation Missing (Lines 874-1091)**

**Issue**: All mouse event handlers use `e.offsetX/offsetY` directly without accounting for canvas display scaling.

```javascript
// Current problematic code
const handle = layerManager.getResizeHandleAt(e.offsetX, e.offsetY);
const layer = layerManager.getLayerAt(e.offsetX, e.offsetY);
```

**Problems**:
- When canvas is scaled smaller than 512px, mouse coordinates are compressed
- Hit testing for layers and handles becomes inaccurate
- Drag operations have incorrect coordinate calculations

**Fix**: Add coordinate normalization function:

```javascript
function getCanvasCoordinates(e) {
    const canvas = e.target;
    const scale = parseFloat(canvas.dataset.coordinateScale) || 1;
    return {
        x: e.offsetX * scale,
        y: e.offsetY * scale
    };
}

// Usage in event handlers:
displayCanvas.addEventListener('pointerdown', (e) => {
    const coords = getCanvasCoordinates(e);
    const handle = layerManager.getResizeHandleAt(coords.x, coords.y);
    // ... rest of handler
});
```

### 3. **Layer Coordinate System Inconsistency (Lines 465-469)**

**Issue**: Layer coordinates are stored in display canvas space (512x512) but scaling calculations assume fixed display size.

```javascript
// Current renderToCanvas scaling
const scaleRatio = size / 512; // Assumes display canvas is always 512px
const x = layer.x * scaleRatio;
const y = layer.y * scaleRatio;
```

**Problems**:
- Layer positions become incorrect when display canvas is resized
- Image scaling and positioning calculations break
- Selection handles appear in wrong locations

**Fix**: Maintain layer coordinates in normalized space (0-1) or always use texture canvas space:

```javascript
// Store coordinates in texture space, scale down for display
const displayScaleRatio = 512 / currentDisplaySize;  // New variable needed
const textureScaleRatio = size / currentQuality;     // For texture canvas

const displayX = (layer.textureX * textureScaleRatio) * displayScaleRatio;
const displayY = (layer.textureY * textureScaleRatio) * displayScaleRatio;
```

### 4. **No Re-rendering After Resize Operations (Line 1411)**

**Issue**: Canvas resizing doesn't trigger layer re-rendering, causing visual desynchronization.

**Fix**: Add immediate re-render after size updates:

```javascript
updateCanvasSize(panel) {
    // ... size update code ...
    
    // Force immediate re-render with new dimensions
    layerManager.renderLayers();
    
    // Update Three.js texture if needed
    throttledTextureUpdate();
}
```

### 5. **Selection Handle Scaling Issues (Lines 340-361, 488-536)**

**Issue**: Handle sizes and positions are calculated in display canvas coordinates but don't account for canvas scaling.

**Problems**:
- Handles appear too large or small when canvas is resized
- Handle hit testing becomes inaccurate
- Visual feedback doesn't match interaction areas

**Fix**: Scale handle sizes and positions based on current display size:

```javascript
getResizeHandles() {
    const bounds = this.getBounds();
    const canvas = document.getElementById('display-canvas');
    const displayScale = parseFloat(canvas.dataset.coordinateScale) || 1;
    const handleSize = 8 * displayScale; // Scale handle size
    
    // ... rest of handle calculations with scaled positions
}
```

### 6. **Missing Texture Update Synchronization**

**Issue**: When display canvas is resized, texture canvas rendering may desynchronize.

**Fix**: Ensure texture updates after resize:

```javascript
// In updateCanvasSize function
setTimeout(() => {
    layerManager.renderLayers();
    if (canvasTexture) {
        canvasTexture.needsUpdate = true;
    }
}, 0); // Next frame update
```

## Immediate Action Items

1. **Replace `updateCanvasSize()` function** with coordinate-aware version
2. **Add `getCanvasCoordinates()` helper** for all mouse event handlers  
3. **Update layer coordinate system** to use consistent space
4. **Add resize event triggers** for layer re-rendering
5. **Scale selection handles** based on display size
6. **Test coordinate accuracy** after panel resize operations

## Performance Considerations

- Minimize re-rendering frequency during resize drag operations
- Cache coordinate scale factors to avoid recalculation
- Use requestAnimationFrame for smooth resize updates
- Consider throttling resize operations similar to texture updates

## Testing Strategy

1. **Resize panel while images are loaded** - verify coordinates stay accurate
2. **Test hit detection** on small and large canvas sizes
3. **Verify handle positioning** across different panel sizes
4. **Check texture synchronization** during resize operations
5. **Test drag operations** with various canvas display sizes

The core issue is that the current implementation treats canvas resizing as purely a CSS operation, but canvas coordinate systems require explicit handling when the display size changes relative to the internal canvas dimensions.