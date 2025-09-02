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
        this.canvas.addEventListener('mousedown', this.boundMouseDown);
        this.canvas.addEventListener('mousemove', this.boundMouseMove);
        this.canvas.addEventListener('mouseup', this.boundMouseUp);
        this.canvas.addEventListener('mouseleave', this.boundMouseUp);
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        this.canvas.addEventListener('dragstart', e => e.preventDefault());
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
        } else {
            this.layerManager.selectLayer(null);
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
            
            // Constrain to canvas bounds
            const halfWidth = this.layerManager.selectedLayer.uvWidth / 2;
            const halfHeight = this.layerManager.selectedLayer.uvHeight / 2;
            
            this.layerManager.selectedLayer.uvX = Math.max(halfWidth, Math.min(1 - halfWidth, this.layerManager.selectedLayer.uvX));
            this.layerManager.selectedLayer.uvY = Math.max(halfHeight, Math.min(1 - halfHeight, this.layerManager.selectedLayer.uvY));
            
            this.layerManager.renderLayers();
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
        
        switch (this.resizeHandle) {
            case 'se': // Southeast (bottom-right)
                newBounds.uvWidth = Math.max(0.05, (coords.u - startBounds.uvX + startBounds.uvWidth/2) * 2);
                newBounds.uvHeight = Math.max(0.05, (coords.v - startBounds.uvY + startBounds.uvHeight/2) * 2);
                break;
            case 'nw': // Northwest (top-left)
                newBounds.uvWidth = Math.max(0.05, (startBounds.uvX + startBounds.uvWidth/2 - coords.u) * 2);
                newBounds.uvHeight = Math.max(0.05, (startBounds.uvY + startBounds.uvHeight/2 - coords.v) * 2);
                newBounds.uvX = startBounds.uvX + startBounds.uvWidth/2 - newBounds.uvWidth/2;
                newBounds.uvY = startBounds.uvY + startBounds.uvHeight/2 - newBounds.uvHeight/2;
                break;
            case 'ne': // Northeast (top-right)
                newBounds.uvWidth = Math.max(0.05, (coords.u - startBounds.uvX + startBounds.uvWidth/2) * 2);
                newBounds.uvHeight = Math.max(0.05, (startBounds.uvY + startBounds.uvHeight/2 - coords.v) * 2);
                newBounds.uvY = startBounds.uvY + startBounds.uvHeight/2 - newBounds.uvHeight/2;
                break;
            case 'sw': // Southwest (bottom-left)
                newBounds.uvWidth = Math.max(0.05, (startBounds.uvX + startBounds.uvWidth/2 - coords.u) * 2);
                newBounds.uvHeight = Math.max(0.05, (coords.v - startBounds.uvY + startBounds.uvHeight/2) * 2);
                newBounds.uvX = startBounds.uvX + startBounds.uvWidth/2 - newBounds.uvWidth/2;
                break;
            // Edge handles
            case 'n':
                newBounds.uvHeight = Math.max(0.05, (startBounds.uvY + startBounds.uvHeight/2 - coords.v) * 2);
                newBounds.uvY = startBounds.uvY + startBounds.uvHeight/2 - newBounds.uvHeight/2;
                break;
            case 's':
                newBounds.uvHeight = Math.max(0.05, (coords.v - startBounds.uvY + startBounds.uvHeight/2) * 2);
                break;
            case 'w':
                newBounds.uvWidth = Math.max(0.05, (startBounds.uvX + startBounds.uvWidth/2 - coords.u) * 2);
                newBounds.uvX = startBounds.uvX + startBounds.uvWidth/2 - newBounds.uvWidth/2;
                break;
            case 'e':
                newBounds.uvWidth = Math.max(0.05, (coords.u - startBounds.uvX + startBounds.uvWidth/2) * 2);
                break;
        }
        
        // Apply bounds and constraints
        newBounds.uvWidth = Math.min(1.0, newBounds.uvWidth);
        newBounds.uvHeight = Math.min(1.0, newBounds.uvHeight);
        
        // Constrain position to keep layer in bounds
        const halfWidth = newBounds.uvWidth / 2;
        const halfHeight = newBounds.uvHeight / 2;
        newBounds.uvX = Math.max(halfWidth, Math.min(1 - halfWidth, newBounds.uvX));
        newBounds.uvY = Math.max(halfHeight, Math.min(1 - halfHeight, newBounds.uvY));
        
        // Update layer
        Object.assign(layer, newBounds);
        this.layerManager.renderLayers();
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