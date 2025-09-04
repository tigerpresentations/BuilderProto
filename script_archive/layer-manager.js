// Layer system for image manipulation and rendering

class ImageLayer {
    constructor(image, options = {}) {
        this.id = 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.image = image;
        this.originalWidth = image.width;
        this.originalHeight = image.height;
        
        // Use UV coordinates directly or default to center (0.5, 0.5)
        this.uvX = options.uvX !== undefined ? options.uvX : 0.5;
        this.uvY = options.uvY !== undefined ? options.uvY : 0.5;
        
        // Store scales in UV space
        this.uvScaleX = options.uvScaleX || 1;
        this.uvScaleY = options.uvScaleY || 1;
        this.rotation = options.rotation || 0;
        this.opacity = options.opacity || 1;
        this.visible = options.visible !== false;
        this.selected = false;
        
        // Store initial values for reset functionality
        this.initialUvScaleX = this.uvScaleX;
        this.initialUvScaleY = this.uvScaleY;
        this.initialRotation = this.rotation;
    }
    
    // Get display coordinates (for rendering display canvas)
    getDisplayCoords() {
        return window.coordinateSystem.getDisplayCoords(this);
    }
    
    // Get texture coordinates (for rendering texture canvas)
    getTextureCoords() {
        return window.coordinateSystem.getTextureCoords(this);
    }
    
    // Get transformed bounds for hit testing (display space coordinates)
    getBounds() {
        const displayCoords = this.getDisplayCoords();
        const width = displayCoords.width;
        const height = displayCoords.height;
        
        return {
            left: displayCoords.x - width/2,
            top: displayCoords.y - height/2,
            right: displayCoords.x + width/2,
            bottom: displayCoords.y + height/2,
            width: width,
            height: height,
            centerX: displayCoords.x,
            centerY: displayCoords.y
        };
    }
    
    // Check if point is inside this layer (x,y in display canvas coordinates)
    hitTest(x, y) {
        const bounds = this.getBounds();
        return x >= bounds.left && x <= bounds.right && 
               y >= bounds.top && y <= bounds.bottom;
    }
    
    // Update layer position (accepts display coordinates, converts to UV internally)
    setPosition(displayX, displayY) {
        const uv = window.coordinateSystem.displayToUV(displayX, displayY);
        this.uvX = uv.u;
        this.uvY = uv.v;
    }
    
    // Update layer scale in UV space
    setScale(scaleX, scaleY = scaleX) {
        this.uvScaleX = scaleX;
        this.uvScaleY = scaleY;
    }
    
}

class LayerManager {
    constructor() {
        this.layers = [];
        this.selectedLayer = null;
        this.interactiveEditor = null; // Will be set by main.js
    }
    
    addLayer(layer) {
        this.layers.push(layer);
        this.renderLayers();
        return layer;
    }
    
    removeLayer(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index >= 0) {
            this.layers.splice(index, 1);
            this.renderLayers();
            return true;
        }
        return false;
    }
    
    selectLayer(layerId) {
        // Deselect all layers
        this.layers.forEach(layer => layer.selected = false);
        
        // Select specific layer
        if (layerId) {
            const layer = this.layers.find(l => l.id === layerId);
            if (layer) {
                layer.selected = true;
                this.selectedLayer = layer;
                return layer;
            }
        }
        this.selectedLayer = null;
        return null;
    }
    
    getLayerAt(x, y) {
        // Check layers from top to bottom (reverse order)
        // x,y in display canvas coordinates (512x512)
        for (let i = this.layers.length - 1; i >= 0; i--) {
            if (this.layers[i].visible && this.layers[i].hitTest(x, y)) {
                return this.layers[i];
            }
        }
        return null;
    }
    
    clearLayers() {
        this.layers = [];
        this.selectedLayer = null;
        this.renderLayers();
    }
    
    renderLayers() {
        // Render to display canvas
        if (window.displayCtx) {
            this.renderToCanvas(window.displayCtx, 512);
            
            // Render handles after display canvas rendering
            if (this.interactiveEditor) {
                this.interactiveEditor.renderHandles(window.displayCtx);
            }
        }
        
        // Render to UV texture editor
        if (window.uvTextureEditor) {
            this.renderToUVTexture(window.uvTextureEditor);
        }
    }
    
    renderToCanvas(ctx, size) {
        // Clear canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, size, size);
        
        // Render each layer using coordinate system
        this.layers.forEach(layer => {
            if (!layer.visible) return;
            
            ctx.save();
            ctx.globalAlpha = layer.opacity;
            
            // Use UV coordinates and scale to target canvas size
            const x = layer.uvX * size;
            const y = layer.uvY * size;
            
            // Calculate dimensions scaled to target canvas size
            const width = layer.originalWidth * layer.uvScaleX * (size / window.coordinateSystem.currentTextureSize);
            const height = layer.originalHeight * layer.uvScaleY * (size / window.coordinateSystem.currentTextureSize);
            
            const coords = { x, y, width, height };
            
            // Apply transformations
            ctx.translate(coords.x, coords.y);
            if (layer.rotation) {
                ctx.rotate(layer.rotation);
            }
            
            // Draw image centered at transform origin
            ctx.drawImage(layer.image, -coords.width/2, -coords.height/2, coords.width, coords.height);
            
            // Draw simple selection outline on display canvas only
            if (layer.selected && ctx === window.displayCtx && size === 512) {
                ctx.strokeStyle = '#ff8800';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(-coords.width/2, -coords.height/2, coords.width, coords.height);
                ctx.setLineDash([]);
            }
            
            ctx.restore();
        });
    }
    
    // New UV-based rendering method
    renderToUVTexture(uvEditor) {
        // Clear UV texture
        uvEditor.clear();
        
        // Render each layer using texture coordinates
        this.layers.forEach(layer => {
            if (!layer.visible) return;
            
            // Draw layer using UV coordinates directly
            uvEditor.drawAtUV(layer.uvX, layer.uvY, (ctx, x, y) => {
                ctx.save();
                ctx.globalAlpha = layer.opacity;
                
                // Calculate dimensions scaled to texture size (uvEditor handles the canvas size internally)
                const width = layer.originalWidth * layer.uvScaleX;
                const height = layer.originalHeight * layer.uvScaleY;
                
                // Apply transformations
                ctx.translate(x, y);
                if (layer.rotation) {
                    ctx.rotate(layer.rotation);
                }
                
                // Draw image centered at transform origin
                ctx.drawImage(layer.image, -width/2, -height/2, width, height);
                ctx.restore();
            });
        });
    }
    
    // Selection management methods for interactive editor
    selectLayer(layerId) {
        // Clear previous selection
        if (this.selectedLayer) {
            this.selectedLayer.selected = false;
        }
        
        // Set new selection
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.selected = true;
            this.selectedLayer = layer;
        }
        
        this.renderLayers();
        return layer;
    }
    
    clearSelection() {
        if (this.selectedLayer) {
            this.selectedLayer.selected = false;
            this.selectedLayer = null;
        }
        this.renderLayers();
    }
    
    getSelectedLayer() {
        return this.selectedLayer;
    }
    
    // Add method to render handles after layers
    renderWithHandles() {
        this.renderLayers();
        
        // Render handles if we have an interactive editor
        if (this.interactiveEditor && window.displayCtx) {
            this.interactiveEditor.renderHandles(window.displayCtx);
        }
    }
}

// Export classes
window.ImageLayer = ImageLayer;
window.LayerManager = LayerManager;