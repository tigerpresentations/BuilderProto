// Simple Layer Manager - No coordinate scaling complexity
// Works entirely in 512x512 space, scales only at render time

class SimpleLayerManager {
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
        // Clear previous selection
        if (this.selectedLayer) {
            this.selectedLayer.selected = false;
        }
        
        // Set new selection
        const layer = this.layers.find(l => l.id === layerId);
        if (layer) {
            layer.selected = true;
            this.selectedLayer = layer;
        } else {
            this.selectedLayer = null;
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
    
    getLayerAt(x, y) {
        // Check layers from top to bottom (reverse order)
        // x,y already in 512x512 canvas coordinates - no conversion needed!
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
        // Render to 512x512 display canvas
        if (window.displayCtx) {
            this.renderToCanvas(window.displayCtx, 512);
            
            // Render handles after display canvas rendering
            if (this.interactiveEditor) {
                this.interactiveEditor.renderHandles(window.displayCtx);
            }
        }
        
        // Render to UV texture editor at current texture size
        if (window.uvTextureEditor && window.currentQuality) {
            this.renderToTextureEditor(window.currentQuality);
        }
    }
    
    renderToCanvas(ctx, targetSize) {
        // Clear canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, targetSize, targetSize);
        
        // Render each layer - they handle their own scaling
        this.layers.forEach(layer => {
            if (layer.visible) {
                layer.renderTo(ctx, targetSize);
            }
        });
    }
    
    renderToTextureEditor(textureSize) {
        // Get the texture canvas from UV editor
        const textureCanvas = window.uvTextureEditor.canvas;
        const textureCtx = textureCanvas.getContext('2d');
        
        // Clear texture canvas
        textureCtx.fillStyle = 'white';
        textureCtx.fillRect(0, 0, textureSize, textureSize);
        
        // Render each layer at texture resolution
        this.layers.forEach(layer => {
            if (layer.visible) {
                layer.renderTo(textureCtx, textureSize);
            }
        });
        
        // Update the Three.js texture
        if (window.uvTextureEditor.texture) {
            window.uvTextureEditor.texture.needsUpdate = true;
        }
    }
}

window.SimpleLayerManager = SimpleLayerManager;