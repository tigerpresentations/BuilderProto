# Canvas Resize Fix Implementation Plan

## Specific Code Changes Required

### 1. Enhanced updateCanvasSize Function (Replace lines 1432-1439)

```javascript
updateCanvasSize(panel) {
    const displayCanvas = panel.querySelector('#display-canvas');
    if (!displayCanvas) return;
    
    const panelWidth = panel.offsetWidth;
    const availableWidth = panelWidth - 50; // Account for padding and resizer
    const newDisplaySize = Math.min(availableWidth, 512);
    
    // Update display canvas size while maintaining 512x512 internal dimensions
    displayCanvas.style.width = newDisplaySize + 'px';
    displayCanvas.style.height = newDisplaySize + 'px';
    
    // Calculate and store coordinate scale factor
    const coordinateScale = 512 / newDisplaySize;
    displayCanvas.dataset.coordinateScale = coordinateScale.toString();
    
    // Store current display size for layer rendering calculations
    displayCanvas.dataset.displaySize = newDisplaySize.toString();
    
    console.log(`Canvas resized: ${newDisplaySize}px display, ${coordinateScale.toFixed(2)}x coordinate scale`);
    
    // Trigger immediate re-render with new scaling
    if (typeof layerManager !== 'undefined') {
        layerManager.renderLayers();
    }
}
```

### 2. Mouse Coordinate Transformation Helper (Add after line 544)

```javascript
// Coordinate transformation helpers
function getCanvasCoordinates(e) {
    const canvas = e.target;
    const scale = parseFloat(canvas.dataset.coordinateScale) || 1;
    return {
        x: e.offsetX * scale,
        y: e.offsetY * scale
    };
}

function displayToTexture(displayCoord) {
    return displayCoord * (currentQuality / 512);
}
```

### 3. Updated Event Handlers (Lines 874-1091)

**Replace all `e.offsetX, e.offsetY` usage with coordinate transformation:**

```javascript
displayCanvas.addEventListener('pointerdown', (e) => {
    const coords = getCanvasCoordinates(e);
    
    if (currentMode === MODES.DRAW) {
        isDrawing = true;
        const color = document.getElementById('brush-color').value;
        
        drawToCanvases((ctx, scale) => {
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(coords.x * scale, coords.y * scale);
        });
    } else if (currentMode === MODES.SELECT) {
        // First check if clicking on a resize handle
        const handle = layerManager.getResizeHandleAt(coords.x, coords.y);
        if (handle) {
            if (handle === 'rotate') {
                // Start rotating
                isRotating = true;
                const layer = layerManager.selectedLayer;
                const bounds = layer.getBounds();
                const centerX = bounds.left + bounds.width / 2;
                const centerY = bounds.top + bounds.height / 2;
                rotationStartAngle = Math.atan2(coords.y - centerY, coords.x - centerX);
                dragStartX = coords.x;
                dragStartY = coords.y;
                displayCanvas.style.cursor = 'grabbing';
            } else {
                // Start resizing
                isResizing = true;
                resizeHandle = handle;
                dragStartX = coords.x;
                dragStartY = coords.y;
                resizeStartBounds = layerManager.selectedLayer.getBounds();
                displayCanvas.style.cursor = HANDLES[handle].cursor;
            }
        } else {
            // Check if clicking on a layer for dragging
            const layer = layerManager.getLayerAt(coords.x, coords.y);
            if (layer) {
                // Start dragging this layer
                isDragging = true;
                dragLayer = layer;
                dragStartX = coords.x;
                dragStartY = coords.y;
                dragStartLayerX = layer.x;
                dragStartLayerY = layer.y;
                
                // Select the layer if not already selected
                layerManager.selectLayer(layer.id);
                layerManager.renderLayers(); // Immediate render to show selection
                displayCanvas.style.cursor = 'move';
            }
        }
    }
});

displayCanvas.addEventListener('pointermove', (e) => {
    const coords = getCanvasCoordinates(e);
    
    if (currentMode === MODES.DRAW && isDrawing) {
        drawToCanvases((ctx, scale) => {
            ctx.lineTo(coords.x * scale, coords.y * scale);
            ctx.stroke();
        });
        throttledTextureUpdate();
    } else if (currentMode === MODES.SELECT) {
        if (isRotating && layerManager.selectedLayer) {
            // Handle rotation
            const layer = layerManager.selectedLayer;
            const bounds = layer.getBounds();
            const centerX = bounds.left + bounds.width / 2;
            const centerY = bounds.top + bounds.height / 2;
            const currentAngle = Math.atan2(coords.y - centerY, coords.x - centerX);
            layer.rotation += currentAngle - rotationStartAngle;
            rotationStartAngle = currentAngle;
            layerManager.renderLayers();
        } else if (isResizing && layerManager.selectedLayer) {
            // Handle resizing with corrected coordinates
            const layer = layerManager.selectedLayer;
            const startBounds = resizeStartBounds;
            
            // Get current mouse position
            const currentX = coords.x;
            const currentY = coords.y;
            
            // ... rest of resize logic remains the same ...
        } else if (isDragging && dragLayer) {
            // Update layer position based on drag
            const deltaX = coords.x - dragStartX;
            const deltaY = coords.y - dragStartY;
            
            dragLayer.x = dragStartLayerX + deltaX;
            dragLayer.y = dragStartLayerY + deltaY;
            
            layerManager.renderLayers();
        } else {
            // Update cursor based on what's under mouse
            const handle = layerManager.getResizeHandleAt(coords.x, coords.y);
            if (handle) {
                displayCanvas.style.cursor = HANDLES[handle].cursor;
            } else {
                const layer = layerManager.getLayerAt(coords.x, coords.y);
                displayCanvas.style.cursor = layer ? 'pointer' : 'default';
            }
        }
    }
});

displayCanvas.addEventListener('pointerup', (e) => {
    const coords = getCanvasCoordinates(e);
    
    if (currentMode === MODES.DRAW) {
        isDrawing = false;
    } else if (currentMode === MODES.SELECT) {
        if (isRotating) {
            isRotating = false;
            displayCanvas.style.cursor = 'default';
        } else if (isResizing) {
            isResizing = false;
            resizeHandle = null;
            resizeStartBounds = null;
            displayCanvas.style.cursor = 'default';
        } else if (isDragging) {
            isDragging = false;
            dragLayer = null;
            displayCanvas.style.cursor = 'default';
        } else {
            // Handle layer selection (only if not dragging)
            const layer = layerManager.getLayerAt(coords.x, coords.y);
            if (layer) {
                layerManager.selectLayer(layer.id);
                console.log('Selected layer:', layer.id);
            } else {
                layerManager.selectLayer(null);
                console.log('Deselected all layers');
            }
            layerManager.renderLayers();
        }
    }
});
```

### 4. Enhanced Selection Handle Scaling (Lines 339-361)

```javascript
// Get resize handles for this layer (8 handles around the bounds)
getResizeHandles() {
    const bounds = this.getBounds();
    const displayCanvas = document.getElementById('display-canvas');
    const displayScale = parseFloat(displayCanvas.dataset.coordinateScale) || 1;
    
    // Scale handle size based on display zoom
    const baseHandleSize = 8;
    const handleSize = Math.max(4, baseHandleSize / Math.sqrt(displayScale)); // Prevent handles from getting too small
    const half = handleSize / 2;
    
    // Scale rotation handle radius and distance
    const baseRotateRadius = 6;
    const rotateRadius = Math.max(3, baseRotateRadius / Math.sqrt(displayScale));
    const rotateDistance = Math.max(15, 25 / displayScale);
    
    return {
        'nw': { x: bounds.left - half, y: bounds.top - half, width: handleSize, height: handleSize },
        'ne': { x: bounds.right - half, y: bounds.top - half, width: handleSize, height: handleSize },
        'sw': { x: bounds.left - half, y: bounds.bottom - half, width: handleSize, height: handleSize },
        'se': { x: bounds.right - half, y: bounds.bottom - half, width: handleSize, height: handleSize },
        'n': { x: bounds.left + bounds.width/2 - half, y: bounds.top - half, width: handleSize, height: handleSize },
        'e': { x: bounds.right - half, y: bounds.top + bounds.height/2 - half, width: handleSize, height: handleSize },
        's': { x: bounds.left + bounds.width/2 - half, y: bounds.bottom - half, width: handleSize, height: handleSize },
        'w': { x: bounds.left - half, y: bounds.top + bounds.height/2 - half, width: handleSize, height: handleSize },
        'rotate': { 
            x: bounds.left + bounds.width/2 - rotateRadius, 
            y: bounds.top - rotateDistance - rotateRadius, 
            width: rotateRadius * 2, 
            height: rotateRadius * 2 
        }
    };
}
```

### 5. Enhanced Layer Rendering with Display Scale Awareness (Lines 452-540)

```javascript
renderToCanvas(ctx, size) {
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    
    // Get display scale for handle rendering
    const displayCanvas = document.getElementById('display-canvas');
    const isDisplayCanvas = (ctx === displayCtx);
    const displayScale = isDisplayCanvas ? parseFloat(displayCanvas.dataset.coordinateScale) || 1 : 1;
    
    // Render each layer
    this.layers.forEach(layer => {
        if (!layer.visible) return;
        
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        
        // Transform for this canvas size
        const scaleRatio = size / 512; // Normalize to display size
        const x = layer.x * scaleRatio;
        const y = layer.y * scaleRatio;
        const width = layer.originalWidth * layer.scaleX * scaleRatio;
        const height = layer.originalHeight * layer.scaleY * scaleRatio;
        
        // Apply transformations
        ctx.translate(x, y);
        if (layer.rotation) {
            ctx.rotate(layer.rotation);
        }
        
        // Draw image centered at transform origin
        ctx.drawImage(layer.image, -width/2, -height/2, width, height);
        
        // Draw selection outline and handles on display canvas only (not on texture)
        if (layer.selected && isDisplayCanvas) {
            ctx.strokeStyle = '#ff8800';
            ctx.lineWidth = Math.max(1, 2 / displayScale); // Scale line width
            ctx.setLineDash([5 / displayScale, 5 / displayScale]); // Scale dash pattern
            ctx.strokeRect(-width/2, -height/2, width, height);
            ctx.setLineDash([]); // Reset line dash
            
            // Draw resize handles with scaled sizes
            ctx.fillStyle = '#ff8800';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(0.5, 1 / displayScale);
            
            const handleSize = Math.max(4, 8 / Math.sqrt(displayScale));
            const half = handleSize / 2;
            
            // Corner and edge handles with scaled sizes
            const handles = [
                // Corner handles
                [-width/2 - half, -height/2 - half], // nw
                [width/2 - half, -height/2 - half],  // ne
                [-width/2 - half, height/2 - half],  // sw
                [width/2 - half, height/2 - half],   // se
                // Edge handles  
                [0 - half, -height/2 - half],       // n
                [width/2 - half, 0 - half],         // e
                [0 - half, height/2 - half],        // s
                [-width/2 - half, 0 - half]         // w
            ];
            
            handles.forEach(([hx, hy]) => {
                ctx.fillRect(hx, hy, handleSize, handleSize);
                ctx.strokeRect(hx, hy, handleSize, handleSize);
            });
            
            // Rotation handle - scaled circle
            const rotateHandleX = 0;
            const rotateHandleY = -height/2 - Math.max(15, 25 / displayScale);
            const rotateRadius = Math.max(3, 6 / Math.sqrt(displayScale));
            
            ctx.fillStyle = '#4488ff';
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(rotateHandleX, rotateHandleY, rotateRadius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            
            // Scaled connection line
            ctx.strokeStyle = '#4488ff';
            ctx.lineWidth = Math.max(0.5, 1 / displayScale);
            ctx.beginPath();
            ctx.moveTo(0, -height/2);
            ctx.lineTo(rotateHandleX, rotateHandleY + rotateRadius);
            ctx.stroke();
        }
        
        ctx.restore();
    });
}
```

### 6. Initialization Update (Line 1462)

```javascript
// Initial canvas size update with coordinate system setup
setTimeout(() => {
    uiPanel.updateCanvasSize(canvasEditor);
    
    // Initialize coordinate scale if not set
    const displayCanvas = canvasEditor.querySelector('#display-canvas');
    if (displayCanvas && !displayCanvas.dataset.coordinateScale) {
        displayCanvas.dataset.coordinateScale = '1.0';
        displayCanvas.dataset.displaySize = '512';
    }
}, 100);
```

## Implementation Priority

1. **High Priority**: Coordinate transformation fixes (prevents all interaction issues)
2. **High Priority**: updateCanvasSize function replacement (core resize functionality)
3. **Medium Priority**: Handle scaling improvements (visual feedback)
4. **Medium Priority**: Enhanced layer rendering (visual consistency)
5. **Low Priority**: Performance optimizations (smooth operation)

## Testing Checklist

- [ ] Canvas resizes correctly when panel width changes
- [ ] Mouse coordinates remain accurate after resize
- [ ] Image selection works at all panel sizes  
- [ ] Drag operations maintain precision
- [ ] Resize handles appear correctly scaled
- [ ] Rotation handles function properly
- [ ] Texture synchronization maintained
- [ ] Performance remains acceptable during resize operations

This implementation addresses all identified coordinate system issues while maintaining the existing dual-canvas architecture.