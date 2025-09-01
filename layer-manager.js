// Layer system for image manipulation and rendering

class ImageLayer {
    constructor(image, options = {}) {
        this.id = 'layer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.image = image;
        
        // Store coordinates in display space (512x512 pixels)
        this.x = options.x !== undefined ? options.x : 256; // Default to center (256, 256)
        this.y = options.y !== undefined ? options.y : 256; // Default to center (256, 256)
        this.scaleX = options.scaleX || 1;
        this.scaleY = options.scaleY || 1;
        this.rotation = options.rotation || 0;
        this.opacity = options.opacity || 1;
        this.visible = options.visible !== false;
        this.selected = false;
        this.originalWidth = image.width;
        this.originalHeight = image.height;
        
        // Store initial scale for reset functionality
        this.initialScaleX = this.scaleX;
        this.initialScaleY = this.scaleY;
        this.initialRotation = this.rotation;
    }
    
    // Get transformed bounds for hit testing (display space coordinates)
    getBounds() {
        const width = this.originalWidth * this.scaleX;
        const height = this.originalHeight * this.scaleY;
        
        return {
            left: this.x - width/2,
            top: this.y - height/2,
            right: this.x + width/2,
            bottom: this.y + height/2,
            width: width,
            height: height,
            centerX: this.x,
            centerY: this.y
        };
    }
    
    // Check if point is inside this layer (x,y in display canvas coordinates)
    hitTest(x, y) {
        const bounds = this.getBounds();
        return x >= bounds.left && x <= bounds.right && 
               y >= bounds.top && y <= bounds.bottom;
    }
}

class LayerManager {
    constructor() {
        this.layers = [];
        this.selectedLayer = null;
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
        
        // Calculate scaling factor for this canvas size
        const scale = size / 512; // 512 is our base display canvas size
        
        // Render each layer
        this.layers.forEach(layer => {
            if (!layer.visible) return;
            
            ctx.save();
            ctx.globalAlpha = layer.opacity;
            
            // Scale coordinates and dimensions for this canvas size
            const canvasX = layer.x * scale;
            const canvasY = layer.y * scale;
            const width = layer.originalWidth * layer.scaleX * scale;
            const height = layer.originalHeight * layer.scaleY * scale;
            
            // Apply transformations
            ctx.translate(canvasX, canvasY);
            if (layer.rotation) {
                ctx.rotate(layer.rotation);
            }
            
            // Draw image centered at transform origin
            ctx.drawImage(layer.image, -width/2, -height/2, width, height);
            
            // Draw simple selection outline on display canvas only
            if (layer.selected && ctx === window.displayCtx && size === 512) {
                ctx.strokeStyle = '#ff8800';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(-width/2, -height/2, width, height);
                ctx.setLineDash([]);
            }
            
            ctx.restore();
        });
    }
    
    // New UV-based rendering method
    renderToUVTexture(uvEditor) {
        // Clear UV texture
        uvEditor.clear();
        
        // Render each layer in UV space
        this.layers.forEach(layer => {
            if (!layer.visible) return;
            
            // Convert layer coordinates to UV space
            const layerUV = {
                u: layer.x / 512, // Convert display coords to UV
                v: layer.y / 512
            };
            
            // Draw layer at UV coordinates
            uvEditor.drawAtUV(layerUV.u, layerUV.v, (ctx, x, y) => {
                ctx.save();
                ctx.globalAlpha = layer.opacity;
                
                // Calculate scaled dimensions
                const width = layer.originalWidth * layer.scaleX;
                const height = layer.originalHeight * layer.scaleY;
                
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
}

// Export classes
window.ImageLayer = ImageLayer;
window.LayerManager = LayerManager;