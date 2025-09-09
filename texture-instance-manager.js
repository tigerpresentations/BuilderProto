// Texture Instance Manager - Manages per-model canvas textures
// Each model instance gets its own independent canvas and texture

class TextureInstanceManager {
    constructor() {
        this.textureInstances = new Map(); // Map<instanceId, TextureData>
        this.activeInstanceId = null;
        this.defaultCanvasSize = 1024;
    }
    
    // Create a new texture instance for a model
    createTextureInstance(instanceId, modelName = 'Unnamed Model') {
        console.log(`🎨 Creating texture instance for: ${instanceId} (${modelName})`);
        
        // Create off-screen canvas for this model
        const canvas = document.createElement('canvas');
        canvas.width = this.defaultCanvasSize;
        canvas.height = this.defaultCanvasSize;
        canvas.id = `texture-canvas-${instanceId}`;
        
        // Initialize with white background
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Create Three.js texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.flipY = false; // GLB compatibility
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        
        // Create layer manager instance for this texture
        const layerManager = new SimpleLayerManager();
        layerManager.textureCanvas = canvas; // Store reference to this model's canvas
        layerManager.instanceId = instanceId;
        
        // Store texture data
        const textureData = {
            instanceId,
            modelName,
            canvas,
            texture,
            layerManager,
            materials: [], // Materials using this texture
            createdAt: new Date(),
            lastModified: new Date()
        };
        
        this.textureInstances.set(instanceId, textureData);
        
        console.log(`✅ Texture instance created for ${instanceId}`, {
            canvasSize: `${canvas.width}x${canvas.height}`,
            textureId: texture.id
        });
        
        return textureData;
    }
    
    // Get texture data for a model instance
    getTextureInstance(instanceId) {
        return this.textureInstances.get(instanceId);
    }
    
    // Switch to editing a different model's texture
    switchToTexture(instanceId) {
        const textureData = this.textureInstances.get(instanceId);
        if (!textureData) {
            console.warn(`No texture instance found for: ${instanceId}`);
            return false;
        }
        
        console.log(`🔄 Switching to texture: ${instanceId} (${textureData.modelName})`);
        
        // Save current layer state if switching from another texture
        if (this.activeInstanceId && this.activeInstanceId !== instanceId) {
            const currentData = this.textureInstances.get(this.activeInstanceId);
            if (currentData) {
                this.saveLayerState(currentData);
            }
        }
        
        // Set as active
        this.activeInstanceId = instanceId;
        
        // Update the display canvas to show this texture's canvas
        const displayCanvas = document.getElementById('display-canvas');
        if (displayCanvas) {
            const ctx = displayCanvas.getContext('2d');
            
            // Copy the model's canvas to the display canvas
            ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
            ctx.drawImage(textureData.canvas, 0, 0);
            
            // Switch the layer manager to this texture's layer manager
            if (window.layerManager) {
                // Save current layers before switching
                if (window.layerManager.instanceId !== instanceId) {
                    this.saveLayerState({ 
                        instanceId: window.layerManager.instanceId,
                        layerManager: window.layerManager 
                    });
                }
                
                // Restore this texture's layers
                this.restoreLayerState(textureData);
            }
        }
        
        // Update UI to show which texture is being edited
        this.updateUIIndicators(textureData);
        
        console.log(`✅ Switched to texture: ${instanceId}`);
        return true;
    }
    
    // Save layer state for a texture instance
    saveLayerState(textureData) {
        if (!textureData.layerManager) return;
        
        // The layer manager already maintains its state internally
        // Just mark as saved
        textureData.lastModified = new Date();
        console.log(`💾 Saved layer state for: ${textureData.instanceId}`);
    }
    
    // Restore layer state for a texture instance
    restoreLayerState(textureData) {
        if (!textureData.layerManager) return;
        
        // Point the global layer manager to this texture's layer manager
        window.layerManager = textureData.layerManager;
        
        // Update the display canvas
        const displayCanvas = document.getElementById('display-canvas');
        if (displayCanvas && textureData.canvas) {
            const ctx = displayCanvas.getContext('2d');
            ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
            ctx.drawImage(textureData.canvas, 0, 0);
        }
        
        // Re-render layers
        textureData.layerManager.renderLayers();
        textureData.layerManager.updateLayerList();
        
        console.log(`♻️ Restored layer state for: ${textureData.instanceId}`);
    }
    
    // Update canvas and trigger texture update
    updateTexture(instanceId) {
        const textureData = this.textureInstances.get(instanceId);
        if (!textureData) return;
        
        // Mark texture for update
        textureData.texture.needsUpdate = true;
        textureData.lastModified = new Date();
        
        // If this is the active texture, update display canvas
        if (instanceId === this.activeInstanceId) {
            const displayCanvas = document.getElementById('display-canvas');
            if (displayCanvas && textureData.canvas) {
                const ctx = displayCanvas.getContext('2d');
                ctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
                ctx.drawImage(textureData.canvas, 0, 0);
            }
        }
    }
    
    // Update UI to show which texture is being edited
    updateUIIndicators(textureData) {
        // Update status text
        const statusElement = document.getElementById('status');
        if (statusElement) {
            const currentText = statusElement.textContent;
            const parts = currentText.split(' • ');
            const baseText = parts[0] || 'Ready';
            const authText = parts.find(part => part.includes('@') || part.includes('✓'));
            
            const editingText = `Editing: ${textureData.modelName}`;
            const newStatus = authText ? `${baseText} • ${editingText} • ${authText}` : `${baseText} • ${editingText}`;
            
            statusElement.textContent = newStatus;
            statusElement.style.color = '#28a745';
        }
        
        // Update canvas editor panel header
        const canvasPanel = document.querySelector('#canvas-editor h3');
        if (canvasPanel) {
            canvasPanel.innerHTML = `Canvas Texture Editor <span style="color: #28a745; font-size: 11px;">[${textureData.modelName}]</span>`;
        }
        
        // Update active texture info
        const activeTextureInfo = document.getElementById('active-texture-info');
        if (activeTextureInfo) {
            const materialCount = textureData.materials.length;
            activeTextureInfo.innerHTML = `
                <strong style="color: #28a745;">Editing: ${textureData.modelName}</strong><br>
                <span style="color: #999; font-size: 10px;">${materialCount} material${materialCount !== 1 ? 's' : ''} • Last modified: ${textureData.lastModified.toLocaleTimeString()}</span>
            `;
        }
        
        // Show texture actions
        const textureActions = document.getElementById('texture-actions');
        if (textureActions) {
            textureActions.style.display = 'block';
        }
    }
    
    // Apply texture to model materials
    applyTextureToMaterials(instanceId, materials) {
        const textureData = this.textureInstances.get(instanceId);
        if (!textureData) return 0;
        
        let appliedCount = 0;
        materials.forEach(material => {
            material.map = textureData.texture;
            material.needsUpdate = true;
            
            // Track which materials use this texture
            if (!textureData.materials.includes(material)) {
                textureData.materials.push(material);
            }
            appliedCount++;
        });
        
        console.log(`🎯 Applied texture to ${appliedCount} materials for: ${instanceId}`);
        return appliedCount;
    }
    
    // Remove texture instance when model is deleted
    removeTextureInstance(instanceId) {
        const textureData = this.textureInstances.get(instanceId);
        if (!textureData) return false;
        
        console.log(`🗑️ Removing texture instance: ${instanceId}`);
        
        // Dispose Three.js texture
        if (textureData.texture) {
            textureData.texture.dispose();
        }
        
        // Clear canvas
        if (textureData.canvas) {
            const ctx = textureData.canvas.getContext('2d');
            ctx.clearRect(0, 0, textureData.canvas.width, textureData.canvas.height);
        }
        
        // Clear layer manager
        if (textureData.layerManager) {
            textureData.layerManager.clearLayers();
        }
        
        // Remove from map
        this.textureInstances.delete(instanceId);
        
        // If this was the active texture, clear active
        if (this.activeInstanceId === instanceId) {
            this.activeInstanceId = null;
            
            // Clear UI indicators
            const canvasPanel = document.querySelector('#canvas-editor h3');
            if (canvasPanel) {
                canvasPanel.innerHTML = 'Canvas Editor';
            }
        }
        
        console.log(`✅ Texture instance removed: ${instanceId}`);
        return true;
    }
    
    // Get all texture instances
    getAllInstances() {
        return Array.from(this.textureInstances.values());
    }
    
    // Get active texture data
    getActiveTexture() {
        return this.activeInstanceId ? this.textureInstances.get(this.activeInstanceId) : null;
    }
    
    // Copy texture from one model to another
    copyTexture(sourceInstanceId, targetInstanceId) {
        const sourceData = this.textureInstances.get(sourceInstanceId);
        const targetData = this.textureInstances.get(targetInstanceId);
        
        if (!sourceData || !targetData) {
            console.warn('Cannot copy texture: source or target not found');
            return false;
        }
        
        console.log(`📋 Copying texture from ${sourceInstanceId} to ${targetInstanceId}`);
        
        // Copy canvas content
        const targetCtx = targetData.canvas.getContext('2d');
        targetCtx.clearRect(0, 0, targetData.canvas.width, targetData.canvas.height);
        targetCtx.drawImage(sourceData.canvas, 0, 0);
        
        // Copy layers
        targetData.layerManager.clearLayers();
        sourceData.layerManager.layerOrder.forEach(layerId => {
            const sourceLayer = sourceData.layerManager.layers.get(layerId);
            if (sourceLayer) {
                // Clone the layer
                const newLayer = new ImageLayer(sourceLayer.image);
                newLayer.uvX = sourceLayer.uvX;
                newLayer.uvY = sourceLayer.uvY;
                newLayer.uvWidth = sourceLayer.uvWidth;
                newLayer.uvHeight = sourceLayer.uvHeight;
                newLayer.rotation = sourceLayer.rotation;
                newLayer.opacity = sourceLayer.opacity;
                newLayer.visible = sourceLayer.visible;
                
                targetData.layerManager.layers.set(newLayer.id, newLayer);
                targetData.layerManager.layerOrder.push(newLayer.id);
            }
        });
        
        // Update texture
        targetData.texture.needsUpdate = true;
        targetData.lastModified = new Date();
        
        console.log(`✅ Texture copied successfully`);
        return true;
    }
}

// Create global instance
window.textureInstanceManager = new TextureInstanceManager();

// Export for module usage
window.TextureInstanceManager = TextureInstanceManager;