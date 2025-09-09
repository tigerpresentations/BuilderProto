// Image Layer Manager - UV-based coordinate system
// Stores layers in UV space (0-1) for resolution independence

class ImageLayer {
    constructor(image, id = null) {
        this.id = id || 'layer_' + Math.random().toString(36).substr(2, 9);
        this.image = image;
        this.uvX = 0.5;           // Center position (0-1 UV space)
        this.uvY = 0.5;
        this.uvWidth = Math.min(0.75, image.width / 1024);   // Size in UV space
        this.uvHeight = Math.min(0.75, image.height / 1024);
        this.rotation = 0;
        this.opacity = 1;
        this.visible = true;
        this.selected = false;
        this.name = this.extractName(image);
    }
    
    extractName(image) {
        if (image.src) {
            return image.src.split('/').pop().split('.')[0];
        }
        return 'Image ' + this.id.substr(-4);
    }
    
    // Get pixel coordinates for target canvas size
    getPixelBounds(canvasSize) {
        return {
            x: (this.uvX - this.uvWidth/2) * canvasSize,
            y: (this.uvY - this.uvHeight/2) * canvasSize,
            width: this.uvWidth * canvasSize,
            height: this.uvHeight * canvasSize
        };
    }
    
    // Check if point intersects this layer (point should be in UV space 0-1)
    hitTest(uvX, uvY) {
        const halfWidth = this.uvWidth / 2;
        const halfHeight = this.uvHeight / 2;
        
        return uvX >= (this.uvX - halfWidth) && 
               uvX <= (this.uvX + halfWidth) && 
               uvY >= (this.uvY - halfHeight) && 
               uvY <= (this.uvY + halfHeight);
    }
    
    // Get handle positions for resize operations
    getHandles(canvasSize) {
        const bounds = this.getPixelBounds(canvasSize);
        const handleSize = 8;
        
        return {
            nw: { x: bounds.x - handleSize/2, y: bounds.y - handleSize/2, cursor: 'nw-resize' },
            ne: { x: bounds.x + bounds.width - handleSize/2, y: bounds.y - handleSize/2, cursor: 'ne-resize' },
            sw: { x: bounds.x - handleSize/2, y: bounds.y + bounds.height - handleSize/2, cursor: 'sw-resize' },
            se: { x: bounds.x + bounds.width - handleSize/2, y: bounds.y + bounds.height - handleSize/2, cursor: 'se-resize' },
            n: { x: bounds.x + bounds.width/2 - handleSize/2, y: bounds.y - handleSize/2, cursor: 'n-resize' },
            s: { x: bounds.x + bounds.width/2 - handleSize/2, y: bounds.y + bounds.height - handleSize/2, cursor: 's-resize' },
            w: { x: bounds.x - handleSize/2, y: bounds.y + bounds.height/2 - handleSize/2, cursor: 'w-resize' },
            e: { x: bounds.x + bounds.width - handleSize/2, y: bounds.y + bounds.height/2 - handleSize/2, cursor: 'e-resize' }
        };
    }
    
    // Render to target canvas at target size
    renderTo(ctx, canvasSize) {
        const bounds = this.getPixelBounds(canvasSize);
        
        ctx.save();
        ctx.globalAlpha = this.opacity;
        
        // Apply transformations
        ctx.translate(bounds.x + bounds.width/2, bounds.y + bounds.height/2);
        ctx.rotate(this.rotation);
        
        // Draw image
        ctx.drawImage(
            this.image,
            -bounds.width/2,
            -bounds.height/2,
            bounds.width,
            bounds.height
        );
        
        ctx.restore();
    }
}

class SimpleLayerManager {
    constructor() {
        this.layers = new Map();
        this.layerOrder = []; // Z-order array
        this.selectedLayer = null;
        this.interactiveEditor = null; // Will be set by main.js
    }
    
    addImage(image) {
        const layer = new ImageLayer(image);
        this.layers.set(layer.id, layer);
        this.layerOrder.push(layer.id);
        this.selectLayer(layer.id);
        this.renderLayers();
        this.updateLayerList();
        return layer;
    }
    
    removeLayer(layerId) {
        this.layers.delete(layerId);
        this.layerOrder = this.layerOrder.filter(id => id !== layerId);
        
        if (this.selectedLayer && this.selectedLayer.id === layerId) {
            this.selectedLayer = null;
        }
        
        this.renderLayers();
        this.updateLayerList();
        return true;
    }
    
    selectLayer(layerId) {
        // Clear previous selection
        if (this.selectedLayer) {
            this.selectedLayer.selected = false;
        }
        
        // Set new selection
        if (layerId && this.layers.has(layerId)) {
            this.selectedLayer = this.layers.get(layerId);
            this.selectedLayer.selected = true;
        } else {
            this.selectedLayer = null;
        }
        
        // Show selection UI when selecting a layer
        if (this.selectedLayer) {
            this.renderWithSelection();
        } else {
            this.renderLayers();
        }
        this.updateLayerList();
        return this.selectedLayer;
    }
    
    clearSelection() {
        if (this.selectedLayer) {
            this.selectedLayer.selected = false;
            this.selectedLayer = null;
        }
        this.renderLayers();
        this.updateLayerList();
    }
    
    // Clear selection and render without UI elements for clean texture
    clearSelectionAndRenderClean() {
        if (this.selectedLayer) {
            this.selectedLayer.selected = false;
            this.selectedLayer = null;
        }
        this.renderLayers(); // This renders clean without selection
        this.updateLayerList();
    }
    
    getSelectedLayer() {
        return this.selectedLayer;
    }
    
    // Get layer at UV coordinates (0-1)
    getLayerAt(uvX, uvY) {
        // Check layers from top to bottom (reverse order)
        for (let i = this.layerOrder.length - 1; i >= 0; i--) {
            const layerId = this.layerOrder[i];
            const layer = this.layers.get(layerId);
            if (layer && layer.visible && layer.hitTest(uvX, uvY)) {
                return layer;
            }
        }
        return null;
    }
    
    clearLayers() {
        this.layers.clear();
        this.layerOrder = [];
        this.selectedLayer = null;
        this.renderLayers();
        this.updateLayerList();
    }
    
    moveLayerUp(layerId) {
        const index = this.layerOrder.indexOf(layerId);
        if (index > -1 && index < this.layerOrder.length - 1) {
            [this.layerOrder[index], this.layerOrder[index + 1]] = 
            [this.layerOrder[index + 1], this.layerOrder[index]];
            this.renderLayers();
            this.updateLayerList();
        }
    }
    
    moveLayerDown(layerId) {
        const index = this.layerOrder.indexOf(layerId);
        if (index > 0) {
            [this.layerOrder[index], this.layerOrder[index - 1]] = 
            [this.layerOrder[index - 1], this.layerOrder[index]];
            this.renderLayers();
            this.updateLayerList();
        }
    }
    
    renderLayers() {
        // Check if we have a texture-specific canvas
        let targetCanvas = null;
        let targetCtx = null;
        
        if (this.textureCanvas) {
            // Use the model's specific texture canvas
            targetCanvas = this.textureCanvas;
            targetCtx = targetCanvas.getContext('2d');
        }
        
        // Also render to display canvas for UI
        const displayCanvas = document.getElementById('display-canvas');
        if (!displayCanvas) return;
        
        const displayCtx = displayCanvas.getContext('2d');
        const canvasSize = displayCanvas.width;
        
        // Clear both canvases with white background
        displayCtx.fillStyle = 'white';
        displayCtx.fillRect(0, 0, canvasSize, canvasSize);
        
        if (targetCtx && targetCanvas) {
            targetCtx.fillStyle = 'white';
            targetCtx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
        }
        
        // Render layers in order (bottom to top)
        for (const layerId of this.layerOrder) {
            const layer = this.layers.get(layerId);
            if (layer && layer.visible) {
                // Render to display canvas
                layer.renderTo(displayCtx, canvasSize);
                
                // Also render to texture canvas if available
                if (targetCtx && targetCanvas) {
                    layer.renderTo(targetCtx, targetCanvas.width);
                }
            }
        }
        
        // Update the model's texture
        if (this.instanceId && window.textureInstanceManager) {
            window.textureInstanceManager.updateTexture(this.instanceId);
        } else {
            // Fallback to global texture update
            if (window.uvTextureEditor) {
                window.uvTextureEditor.updateTexture();
            }
            
            if (window.canvasTexture) {
                window.canvasTexture.needsUpdate = true;
            }
        }
    }
    
    // Render selection UI separately (call this for UI display only)
    renderWithSelection() {
        // First render clean layers
        this.renderLayers();
        
        // Then add selection overlay on same canvas for UI display only  
        const displayCanvas = document.getElementById('display-canvas');
        if (displayCanvas && this.selectedLayer) {
            const ctx = displayCanvas.getContext('2d');
            this.drawSelection(ctx, displayCanvas.width);
        }
    }
    
    drawSelection(ctx, canvasSize) {
        const layer = this.selectedLayer;
        const bounds = layer.getPixelBounds(canvasSize);
        
        // Selection outline
        ctx.strokeStyle = '#0084ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.setLineDash([]);
        
        // Resize handles
        const handles = layer.getHandles(canvasSize);
        ctx.fillStyle = '#0084ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        
        for (const handle of Object.values(handles)) {
            ctx.fillRect(handle.x, handle.y, 8, 8);
            ctx.strokeRect(handle.x, handle.y, 8, 8);
        }
    }
    
    updateLayerList() {
        const layerList = document.getElementById('layer-list');
        if (!layerList) return;
        
        if (this.layers.size === 0) {
            layerList.innerHTML = `
                <div style="padding: 12px; text-align: center; color: #666; font-size: 11px;">
                    No images added yet
                </div>
            `;
            return;
        }
        
        let html = '';
        // Show layers from top to bottom (reverse order)
        for (let i = this.layerOrder.length - 1; i >= 0; i--) {
            const layerId = this.layerOrder[i];
            const layer = this.layers.get(layerId);
            if (!layer) continue;
            
            const isSelected = this.selectedLayer && this.selectedLayer.id === layerId;
            
            html += `
                <div class="layer-item ${isSelected ? 'selected' : ''}" data-layer-id="${layerId}">
                    <div class="layer-info">
                        <div>${layer.name}</div>
                        <div style="opacity: 0.7;">${Math.round(layer.uvWidth * 100)}% × ${Math.round(layer.uvHeight * 100)}%</div>
                    </div>
                    <div class="layer-controls">
                        <button onclick="window.layerManager.moveLayerUp('${layerId}')">↑</button>
                        <button onclick="window.layerManager.moveLayerDown('${layerId}')">↓</button>
                        <button onclick="window.layerManager.removeLayer('${layerId}')" class="danger">×</button>
                    </div>
                </div>
            `;
        }
        
        layerList.innerHTML = html;
        
        // Add click handlers for layer selection
        layerList.querySelectorAll('.layer-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    const layerId = item.dataset.layerId;
                    this.selectLayer(layerId);
                }
            });
        });
    }
}

window.SimpleLayerManager = SimpleLayerManager;