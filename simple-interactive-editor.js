// Simple Interactive Editor - No coordinate scaling complexity
// Works entirely in 512x512 canvas space

class SimpleInteractiveEditor {
    constructor(displayCanvas, layerManager) {
        this.canvas = displayCanvas;
        this.layerManager = layerManager;
        
        // Interaction state
        this.isInteracting = false;
        this.interactionType = null; // 'move', 'resize'
        this.selectedLayer = null;
        this.dragStart = { x: 0, y: 0 };
        this.layerStartPosition = { x: 0, y: 0 };
        this.layerStartSize = { width: 0, height: 0 };
        this.resizeHandle = null;
        
        // Handle system
        this.handles = [];
        this.handleSize = 12;
        this.handleTolerance = 15;
        
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
            e.preventDefault();
            this.handlePointerMove(e.touches[0]);
        });
        this.canvas.addEventListener('touchend', (e) => this.handlePointerUp(e));
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    // Convert screen coordinates to canvas coordinates - NO SCALING!
    getCanvasCoordinates(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }
    
    handlePointerDown(event) {
        const coords = this.getCanvasCoordinates(event);
        
        // Check resize handles first
        const handleHit = this.hitTestHandles(coords.x, coords.y);
        if (handleHit) {
            this.startResize(coords, handleHit);
            return;
        }
        
        // Check layer selection
        const hitLayer = this.layerManager.getLayerAt(coords.x, coords.y);
        if (hitLayer) {
            this.startMove(coords, hitLayer);
            return;
        }
        
        // Clear selection if clicking empty area
        this.clearSelection();
    }
    
    handlePointerMove(event) {
        const coords = this.getCanvasCoordinates(event);
        
        if (!this.isInteracting) {
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
    
    handlePointerUp(event) {
        if (this.isInteracting) {
            this.finishInteraction();
        }
        this.isInteracting = false;
        this.interactionType = null;
    }
    
    startMove(coords, layer) {
        this.isInteracting = true;
        this.interactionType = 'move';
        this.selectedLayer = layer;
        this.dragStart = coords;
        this.layerStartPosition = { x: layer.x, y: layer.y };
        
        this.layerManager.selectLayer(layer.id);
        this.updateHandles();
        this.canvas.style.cursor = 'move';
    }
    
    updateMove(coords) {
        if (!this.selectedLayer) return;
        
        // Simple pixel-based movement - no coordinate conversion!
        const deltaX = coords.x - this.dragStart.x;
        const deltaY = coords.y - this.dragStart.y;
        
        // Keep within canvas bounds
        const newX = Math.max(this.selectedLayer.width/2, 
                   Math.min(512 - this.selectedLayer.width/2, 
                           this.layerStartPosition.x + deltaX));
        const newY = Math.max(this.selectedLayer.height/2, 
                   Math.min(512 - this.selectedLayer.height/2, 
                           this.layerStartPosition.y + deltaY));
        
        this.selectedLayer.x = newX;
        this.selectedLayer.y = newY;
        
        this.updateHandles();
        this.layerManager.renderLayers();
    }
    
    startResize(coords, handle) {
        this.isInteracting = true;
        this.interactionType = 'resize';
        this.resizeHandle = handle;
        this.dragStart = coords;
        this.layerStartSize = { 
            width: this.selectedLayer.width, 
            height: this.selectedLayer.height 
        };
        this.layerStartPosition = { 
            x: this.selectedLayer.x, 
            y: this.selectedLayer.y 
        };
        this.canvas.style.cursor = this.getResizeCursor(handle.type, handle.position);
    }
    
    updateResize(coords) {
        if (!this.selectedLayer || !this.resizeHandle) return;
        
        const handle = this.resizeHandle;
        const deltaX = coords.x - this.dragStart.x;
        const deltaY = coords.y - this.dragStart.y;
        
        let newWidth = this.layerStartSize.width;
        let newHeight = this.layerStartSize.height;
        let newX = this.layerStartPosition.x;
        let newY = this.layerStartPosition.y;
        
        if (handle.type === 'corner') {
            // Maintain aspect ratio
            const aspectRatio = this.layerStartSize.width / this.layerStartSize.height;
            
            if (handle.position === 'bottom-right') {
                newWidth = Math.max(20, this.layerStartSize.width + deltaX);
                newHeight = newWidth / aspectRatio;
            } else if (handle.position === 'bottom-left') {
                newWidth = Math.max(20, this.layerStartSize.width - deltaX);
                newHeight = newWidth / aspectRatio;
                newX = this.layerStartPosition.x + deltaX/2;
            } else if (handle.position === 'top-right') {
                newWidth = Math.max(20, this.layerStartSize.width + deltaX);
                newHeight = newWidth / aspectRatio;
                newY = this.layerStartPosition.y + deltaY/2;
            } else if (handle.position === 'top-left') {
                newWidth = Math.max(20, this.layerStartSize.width - deltaX);
                newHeight = newWidth / aspectRatio;
                newX = this.layerStartPosition.x + deltaX/2;
                newY = this.layerStartPosition.y + deltaY/2;
            }
        } else if (handle.type === 'edge') {
            // Single axis scaling
            if (handle.position === 'right') {
                newWidth = Math.max(20, this.layerStartSize.width + deltaX);
            } else if (handle.position === 'left') {
                newWidth = Math.max(20, this.layerStartSize.width - deltaX);
                newX = this.layerStartPosition.x + deltaX/2;
            } else if (handle.position === 'bottom') {
                newHeight = Math.max(20, this.layerStartSize.height + deltaY);
            } else if (handle.position === 'top') {
                newHeight = Math.max(20, this.layerStartSize.height - deltaY);
                newY = this.layerStartPosition.y + deltaY/2;
            }
        }
        
        // Apply new dimensions and position
        this.selectedLayer.width = newWidth;
        this.selectedLayer.height = newHeight;
        this.selectedLayer.x = newX;
        this.selectedLayer.y = newY;
        
        this.updateHandles();
        this.layerManager.renderLayers();
    }
    
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
    
    updateCursor(coords) {
        const handleHit = this.hitTestHandles(coords.x, coords.y);
        if (handleHit) {
            this.canvas.style.cursor = this.getResizeCursor(handleHit.type, handleHit.position);
            return;
        }
        
        const layerHit = this.layerManager.getLayerAt(coords.x, coords.y);
        if (layerHit) {
            this.canvas.style.cursor = 'move';
            return;
        }
        
        this.canvas.style.cursor = 'default';
    }
    
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
    
    clearSelection() {
        this.selectedLayer = null;
        this.handles = [];
        this.layerManager.clearSelection();
        this.canvas.style.cursor = 'default';
    }
    
    finishInteraction() {
        this.layerManager.renderLayers();
    }
    
    renderHandles(ctx) {
        if (!this.selectedLayer || this.handles.length === 0) return;
        
        ctx.save();
        
        this.handles.forEach(handle => {
            const x = handle.x - this.handleSize / 2;
            const y = handle.y - this.handleSize / 2;
            
            // Draw shadow
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

window.SimpleInteractiveEditor = SimpleInteractiveEditor;