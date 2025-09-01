// Interactive Image Editor - Drag, Drop, and Resize for TigerBuilder
// Based on research from proven canvas manipulation patterns

class InteractiveImageEditor {
    constructor(displayCanvas, layerManager, coordinateSystem) {
        this.canvas = displayCanvas;
        this.layerManager = layerManager;
        this.coordinateSystem = coordinateSystem;
        
        // Interaction state
        this.isInteracting = false;
        this.interactionType = null; // 'move', 'resize'
        this.selectedLayer = null;
        this.dragStart = { x: 0, y: 0 };
        this.layerStartPosition = { uvX: 0, uvY: 0 };
        this.layerStartScale = { uvScaleX: 1, uvScaleY: 1 };
        this.resizeHandle = null;
        
        // Handle system
        this.handles = [];
        this.handleSize = 12; // 12px handles (larger for easier clicking)
        this.handleTolerance = 15; // 15px click tolerance (more forgiving)
        
        // Performance optimization
        this.lastUpdateTime = 0;
        this.updateThrottle = 16; // ~60fps
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handlePointerUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handlePointerUp(e));
        
        // Touch events for mobile support
        this.canvas.addEventListener('touchstart', (e) => this.handlePointerDown(e.touches[0]));
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling
            this.handlePointerMove(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => this.handlePointerUp(e));
        
        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    // Convert screen coordinates to canvas coordinates
    getCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }
    
    // Handle pointer down (mouse or touch)
    handlePointerDown(event) {
        const coords = this.getCanvasCoordinates(event);
        
        // First check if clicking on a resize handle
        const handleHit = this.hitTestHandles(coords.x, coords.y);
        if (handleHit) {
            this.startResize(coords, handleHit);
            return;
        }
        
        // Check if clicking on a layer for movement
        const hitLayer = this.hitTestLayers(coords.x, coords.y);
        if (hitLayer) {
            this.startMove(coords, hitLayer);
            return;
        }
        
        // Clear selection if clicking empty area
        this.clearSelection();
    }
    
    // Handle pointer move
    handlePointerMove(event) {
        const coords = this.getCanvasCoordinates(event);
        
        if (!this.isInteracting) {
            // Update cursor based on hover state
            this.updateCursor(coords);
            return;
        }
        
        // Throttle updates for performance
        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateThrottle) {
            return;
        }
        this.lastUpdateTime = now;
        
        if (this.interactionType === 'move') {
            this.updateMove(coords);
        } else if (this.interactionType === 'resize') {
            this.updateResize(coords);
        }
    }
    
    // Handle pointer up
    handlePointerUp(event) {
        if (this.isInteracting) {
            this.finishInteraction();
        }
        this.isInteracting = false;
        this.interactionType = null;
    }
    
    // Start moving a layer
    startMove(coords, layer) {
        this.isInteracting = true;
        this.interactionType = 'move';
        this.selectedLayer = layer;
        this.dragStart = coords;
        this.layerStartPosition = { uvX: layer.uvX, uvY: layer.uvY };
        
        // Select the layer in layer manager
        this.layerManager.selectLayer(layer.id);
        this.updateHandles();
        this.canvas.style.cursor = 'move';
    }
    
    // Update move operation
    updateMove(coords) {
        if (!this.selectedLayer) return;
        
        // Calculate movement in display space
        const deltaX = coords.x - this.dragStart.x;
        const deltaY = coords.y - this.dragStart.y;
        
        // Convert to UV space
        const uvDeltaX = deltaX / 512; // 512 is display canvas size
        const uvDeltaY = deltaY / 512;
        
        // Update layer position with bounds checking
        const newUvX = Math.max(0, Math.min(1, this.layerStartPosition.uvX + uvDeltaX));
        const newUvY = Math.max(0, Math.min(1, this.layerStartPosition.uvY + uvDeltaY));
        
        this.selectedLayer.uvX = newUvX;
        this.selectedLayer.uvY = newUvY;
        
        // Update handles and re-render
        this.updateHandles();
        this.layerManager.renderLayers();
    }
    
    // Start resizing operation
    startResize(coords, handle) {
        this.isInteracting = true;
        this.interactionType = 'resize';
        this.resizeHandle = handle;
        this.dragStart = coords;
        this.layerStartScale = { 
            uvScaleX: this.selectedLayer.uvScaleX, 
            uvScaleY: this.selectedLayer.uvScaleY 
        };
        this.canvas.style.cursor = this.getResizeCursor(handle.type, handle.position);
    }
    
    // Update resize operation
    updateResize(coords) {
        if (!this.selectedLayer || !this.resizeHandle) return;
        
        const bounds = this.selectedLayer.getBounds();
        const handle = this.resizeHandle;
        
        // Calculate distance from scaling origin (opposite corner/edge)
        let originX, originY;
        
        // Determine scaling origin based on handle position
        if (handle.type === 'corner') {
            // Scaling origin is opposite corner
            if (handle.position === 'top-left') { originX = bounds.right; originY = bounds.bottom; }
            else if (handle.position === 'top-right') { originX = bounds.left; originY = bounds.bottom; }
            else if (handle.position === 'bottom-left') { originX = bounds.right; originY = bounds.top; }
            else if (handle.position === 'bottom-right') { originX = bounds.left; originY = bounds.top; }
        } else if (handle.type === 'edge') {
            // Scaling origin is opposite edge center
            if (handle.position === 'top') { originX = bounds.centerX; originY = bounds.bottom; }
            else if (handle.position === 'bottom') { originX = bounds.centerX; originY = bounds.top; }
            else if (handle.position === 'left') { originX = bounds.right; originY = bounds.centerY; }
            else if (handle.position === 'right') { originX = bounds.left; originY = bounds.centerY; }
        }
        
        // Calculate current distance from origin to cursor
        const currentDistX = Math.abs(coords.x - originX);
        const currentDistY = Math.abs(coords.y - originY);
        
        // Calculate original distance from origin to handle
        const originalDistX = Math.abs(this.dragStart.x - originX);
        const originalDistY = Math.abs(this.dragStart.y - originY);
        
        let newScaleX = this.layerStartScale.uvScaleX;
        let newScaleY = this.layerStartScale.uvScaleY;
        
        if (handle.type === 'corner') {
            // Corner handles maintain aspect ratio
            // Use the larger change to determine scale
            const scaleFactorX = originalDistX > 0 ? currentDistX / originalDistX : 1;
            const scaleFactorY = originalDistY > 0 ? currentDistY / originalDistY : 1;
            const scaleFactor = Math.max(scaleFactorX, scaleFactorY);
            
            newScaleX = Math.max(0.1, this.layerStartScale.uvScaleX * scaleFactor);
            newScaleY = Math.max(0.1, this.layerStartScale.uvScaleY * scaleFactor);
        } else if (handle.type === 'edge') {
            // Edge handles scale single axis
            if (handle.position === 'left' || handle.position === 'right') {
                const scaleFactorX = originalDistX > 0 ? currentDistX / originalDistX : 1;
                newScaleX = Math.max(0.1, this.layerStartScale.uvScaleX * scaleFactorX);
            } else {
                const scaleFactorY = originalDistY > 0 ? currentDistY / originalDistY : 1;
                newScaleY = Math.max(0.1, this.layerStartScale.uvScaleY * scaleFactorY);
            }
        }
        
        // Apply new scale
        this.selectedLayer.uvScaleX = newScaleX;
        this.selectedLayer.uvScaleY = newScaleY;
        
        // Adjust position to maintain scaling origin
        if (handle.type === 'corner' || handle.type === 'edge') {
            // Calculate how much the bounds have changed
            const newBounds = this.selectedLayer.getBounds();
            
            // Adjust position to keep the scaling origin in the same place
            const boundsShiftX = (newBounds.right - bounds.right + newBounds.left - bounds.left) / 2;
            const boundsShiftY = (newBounds.bottom - bounds.bottom + newBounds.top - bounds.top) / 2;
            
            // Convert shift to UV coordinates and apply
            const uvShiftX = boundsShiftX / 512;
            const uvShiftY = boundsShiftY / 512;
            
            this.selectedLayer.uvX -= uvShiftX;
            this.selectedLayer.uvY -= uvShiftY;
        }
        
        // Update handles and re-render
        this.updateHandles();
        this.layerManager.renderLayers();
    }
    
    // Hit test layers to find which one was clicked
    hitTestLayers(x, y) {
        // Test layers in reverse order (top to bottom)
        for (let i = this.layerManager.layers.length - 1; i >= 0; i--) {
            const layer = this.layerManager.layers[i];
            if (layer.visible && layer.hitTest(x, y)) {
                return layer;
            }
        }
        return null;
    }
    
    // Hit test resize handles
    hitTestHandles(x, y) {
        for (const handle of this.handles) {
            const distance = Math.sqrt(
                Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2)
            );
            if (distance <= this.handleTolerance) {
                return handle;
            }
        }
        return null;
    }
    
    // Update cursor based on hover state
    updateCursor(coords) {
        const handleHit = this.hitTestHandles(coords.x, coords.y);
        if (handleHit) {
            this.canvas.style.cursor = this.getResizeCursor(handleHit.type, handleHit.position);
            return;
        }
        
        const layerHit = this.hitTestLayers(coords.x, coords.y);
        if (layerHit) {
            this.canvas.style.cursor = 'move';
            return;
        }
        
        this.canvas.style.cursor = 'default';
    }
    
    // Get appropriate cursor for resize handle
    getResizeCursor(type, position) {
        if (type === 'corner') {
            if (position === 'top-left' || position === 'bottom-right') return 'nw-resize';
            if (position === 'top-right' || position === 'bottom-left') return 'ne-resize';
        } else if (type === 'edge') {
            if (position === 'top' || position === 'bottom') return 'ns-resize';
            if (position === 'left' || position === 'right') return 'ew-resize';
        }
        return 'default';
    }
    
    // Update resize handles for selected layer
    updateHandles() {
        this.handles = [];
        
        if (!this.selectedLayer) return;
        
        const bounds = this.selectedLayer.getBounds();
        
        // Corner handles
        this.handles.push(
            { type: 'corner', position: 'top-left', x: bounds.left, y: bounds.top },
            { type: 'corner', position: 'top-right', x: bounds.right, y: bounds.top },
            { type: 'corner', position: 'bottom-left', x: bounds.left, y: bounds.bottom },
            { type: 'corner', position: 'bottom-right', x: bounds.right, y: bounds.bottom }
        );
        
        // Edge handles
        this.handles.push(
            { type: 'edge', position: 'top', x: bounds.centerX, y: bounds.top },
            { type: 'edge', position: 'bottom', x: bounds.centerX, y: bounds.bottom },
            { type: 'edge', position: 'left', x: bounds.left, y: bounds.centerY },
            { type: 'edge', position: 'right', x: bounds.right, y: bounds.centerY }
        );
        
    }
    
    // Clear current selection
    clearSelection() {
        this.selectedLayer = null;
        this.handles = [];
        this.layerManager.clearSelection();
        this.layerManager.renderLayers();
        this.canvas.style.cursor = 'default';
    }
    
    // Finish interaction and update texture
    finishInteraction() {
        // Force layer manager to re-render everything
        this.layerManager.renderLayers();
    }
    
    // Render resize handles (called after layer rendering)
    renderHandles(ctx) {
        if (!this.selectedLayer || this.handles.length === 0) return;
        
        ctx.save();
        
        // Draw handles with better visibility
        this.handles.forEach(handle => {
            const x = handle.x - this.handleSize / 2;
            const y = handle.y - this.handleSize / 2;
            
            // Draw shadow for better visibility
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(x + 1, y + 1, this.handleSize, this.handleSize);
            
            // Draw white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, y, this.handleSize, this.handleSize);
            
            // Draw blue border
            ctx.strokeStyle = '#007bff';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, this.handleSize, this.handleSize);
            
            // Draw inner dot for corner handles
            if (handle.type === 'corner') {
                ctx.fillStyle = '#007bff';
                ctx.fillRect(x + 4, y + 4, 4, 4);
            }
        });
        
        ctx.restore();
    }
}

// Export the class
window.InteractiveImageEditor = InteractiveImageEditor;