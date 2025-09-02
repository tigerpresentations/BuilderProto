// Image Interactive Editor - UV-based coordinate system
// Works with UV coordinates (0-1) for resolution independence

class SimpleInteractiveEditor {
    constructor(canvas, layerManager) {
        this.canvas = canvas;
        this.layerManager = layerManager;
        this.isDragging = false;
        this.isResizing = false;
        this.dragStartPos = null;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        
        // Bind methods to preserve 'this' context
        this.boundMouseDown = this.onMouseDown.bind(this);
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundMouseUp = this.onMouseUp.bind(this);
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Only mousedown starts on canvas - move and up will be promoted to document during active operations
        this.canvas.addEventListener('mousedown', this.boundMouseDown);
        this.canvas.addEventListener('mousemove', this.boundMouseMove);  // For hover effects when not dragging
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('dragstart', e => e.preventDefault());
        
        // Add keyboard support for clearing selection
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.layerManager.clearSelectionAndRenderClean();
            }
        });
    }
    
    // Promote mouse events to document level during active drag/resize operations
    promoteToGlobalEvents() {
        // Remove canvas events to prevent conflicts
        this.canvas.removeEventListener('mousemove', this.boundMouseMove);
        
        // Add document-level events that work anywhere on the page
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);
        
        // Prevent text selection during drag operations
        document.body.style.userSelect = 'none';
        document.body.style.cursor = this.canvas.style.cursor;
    }
    
    // Return to canvas-only events when operation completes
    demoteToCanvasEvents() {
        // Remove document events
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);
        
        // Restore canvas events
        this.canvas.addEventListener('mousemove', this.boundMouseMove);
        
        // Restore normal cursor and text selection
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        this.canvas.style.cursor = 'default';
    }
    
    // Convert screen pixel coordinates to UV coordinates (0-1)
    pixelToUV(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;
        
        return {
            u: canvasX / this.canvas.width,
            v: canvasY / this.canvas.height
        };
    }
    
    onMouseDown(event) {
        const coords = this.pixelToUV(event.clientX, event.clientY);
        
        // Check for handle interaction first
        if (this.layerManager.selectedLayer) {
            const handles = this.layerManager.selectedLayer.getHandles(this.canvas.width);
            for (const [handleName, handle] of Object.entries(handles)) {
                const handleUV = {
                    u: handle.x / this.canvas.width,
                    v: handle.y / this.canvas.height
                };
                
                const distance = Math.sqrt(
                    Math.pow(coords.u - handleUV.u, 2) + 
                    Math.pow(coords.v - handleUV.v, 2)
                );
                
                if (distance < 0.02) { // Handle hit tolerance in UV space
                    this.isResizing = true;
                    this.resizeHandle = handleName;
                    this.resizeStartBounds = {
                        uvX: this.layerManager.selectedLayer.uvX,
                        uvY: this.layerManager.selectedLayer.uvY,
                        uvWidth: this.layerManager.selectedLayer.uvWidth,
                        uvHeight: this.layerManager.selectedLayer.uvHeight
                    };
                    this.canvas.style.cursor = handle.cursor;
                    this.promoteToGlobalEvents(); // Enable mouse tracking outside canvas
                    return;
                }
            }
        }
        
        // Check for layer selection/drag
        const hitLayer = this.layerManager.getLayerAt(coords.u, coords.v);
        if (hitLayer) {
            this.layerManager.selectLayer(hitLayer.id);
            this.isDragging = true;
            this.dragStartPos = {
                u: coords.u,
                v: coords.v,
                layerU: hitLayer.uvX,
                layerV: hitLayer.uvY
            };
            this.canvas.style.cursor = 'move';
            this.promoteToGlobalEvents(); // Enable mouse tracking outside canvas
        } else {
            // Clear selection and render clean when clicking empty space
            this.layerManager.clearSelectionAndRenderClean();
        }
        
        event.preventDefault();
    }
    
    onMouseMove(event) {
        const coords = this.pixelToUV(event.clientX, event.clientY);
        
        if (this.isResizing && this.layerManager.selectedLayer) {
            this.handleResize(coords);
            return;
        }
        
        if (this.isDragging && this.layerManager.selectedLayer) {
            const deltaU = coords.u - this.dragStartPos.u;
            const deltaV = coords.v - this.dragStartPos.v;
            
            this.layerManager.selectedLayer.uvX = this.dragStartPos.layerU + deltaU;
            this.layerManager.selectedLayer.uvY = this.dragStartPos.layerV + deltaV;
            
            // Constrain to prevent complete disappearance - allow 80% overhang
            const layer = this.layerManager.selectedLayer;
            const overflowMargin = 0.2; // Allow 80% of image to go off-screen
            
            const minX = -layer.uvWidth * (1 - overflowMargin);
            const maxX = 1 + layer.uvWidth * (1 - overflowMargin);
            const minY = -layer.uvHeight * (1 - overflowMargin);
            const maxY = 1 + layer.uvHeight * (1 - overflowMargin);
            
            layer.uvX = Math.max(minX, Math.min(maxX, layer.uvX));
            layer.uvY = Math.max(minY, Math.min(maxY, layer.uvY));
            
            this.layerManager.renderWithSelection(); // Show selection during drag
            this.layerManager.updateLayerList();
            return;
        }
        
        // Update cursor based on what's under mouse
        this.updateCursor(coords);
    }
    
    onMouseUp(event) {
        this.isDragging = false;
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        this.dragStartPos = null;
        this.canvas.style.cursor = 'default';
        
        // Return to canvas-only event handling
        this.demoteToCanvasEvents();
        
        // Update Three.js texture
        if (window.uvTextureEditor) {
            window.uvTextureEditor.updateTexture();
        }
    }
    
    handleResize(coords) {
        if (!this.layerManager.selectedLayer || !this.resizeHandle || !this.resizeStartBounds) return;
        
        const layer = this.layerManager.selectedLayer;
        const startBounds = this.resizeStartBounds;
        
        // Calculate new bounds based on handle
        let newBounds = { ...startBounds };
        
        // Get the center point for consistent scaling
        const centerX = startBounds.uvX;
        const centerY = startBounds.uvY;
        
        switch (this.resizeHandle) {
            case 'se': // Southeast (bottom-right)
                newBounds.uvWidth = Math.abs((coords.u - centerX) * 2);
                newBounds.uvHeight = Math.abs((coords.v - centerY) * 2);
                break;
            case 'nw': // Northwest (top-left)
                newBounds.uvWidth = Math.abs((centerX - coords.u) * 2);
                newBounds.uvHeight = Math.abs((centerY - coords.v) * 2);
                break;
            case 'ne': // Northeast (top-right)
                newBounds.uvWidth = Math.abs((coords.u - centerX) * 2);
                newBounds.uvHeight = Math.abs((centerY - coords.v) * 2);
                break;
            case 'sw': // Southwest (bottom-left)
                newBounds.uvWidth = Math.abs((centerX - coords.u) * 2);
                newBounds.uvHeight = Math.abs((coords.v - centerY) * 2);
                break;
            // Edge handles - maintain aspect ratio center
            case 'n':
                newBounds.uvHeight = Math.abs((centerY - coords.v) * 2);
                break;
            case 's':
                newBounds.uvHeight = Math.abs((coords.v - centerY) * 2);
                break;
            case 'w':
                newBounds.uvWidth = Math.abs((centerX - coords.u) * 2);
                break;
            case 'e':
                newBounds.uvWidth = Math.abs((coords.u - centerX) * 2);
                break;
        }
        
        // Apply smooth constraints with softer minimums and progressive scaling
        const minSize = 0.02; // Smaller minimum for more precise control
        const maxSize = 0.95;  // Slightly smaller max to prevent edge issues
        
        // Smooth size constraints with generous maximums to allow large scaling
        newBounds.uvWidth = Math.max(minSize, Math.min(3.0, newBounds.uvWidth));  // Allow up to 3x canvas size
        newBounds.uvHeight = Math.max(minSize, Math.min(3.0, newBounds.uvHeight));
        
        // During resize, don't constrain position - allow images to extend beyond canvas
        // This enables continuous scaling even when touching edges
        // Position constraints are only applied during dragging, not resizing
        
        // Update layer
        Object.assign(layer, newBounds);
        this.layerManager.renderWithSelection(); // Show selection during resize
        this.layerManager.updateLayerList();
    }
    
    updateCursor(coords) {
        if (this.layerManager.selectedLayer) {
            const handles = this.layerManager.selectedLayer.getHandles(this.canvas.width);
            for (const [handleName, handle] of Object.entries(handles)) {
                const handleUV = {
                    u: handle.x / this.canvas.width,
                    v: handle.y / this.canvas.height
                };
                
                const distance = Math.sqrt(
                    Math.pow(coords.u - handleUV.u, 2) + 
                    Math.pow(coords.v - handleUV.v, 2)
                );
                
                if (distance < 0.02) {
                    this.canvas.style.cursor = handle.cursor;
                    return;
                }
            }
        }
        
        // Check if over a layer
        const hitLayer = this.layerManager.getLayerAt(coords.u, coords.v);
        if (hitLayer) {
            this.canvas.style.cursor = 'move';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }
    
    renderHandles(ctx) {
        // Handles are now rendered directly by the layer manager
        // This method can be removed or used for additional visual feedback
    }
}

window.SimpleInteractiveEditor = SimpleInteractiveEditor;