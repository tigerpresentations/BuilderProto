// UV-based canvas editor variables and state
let uvTextureEditor;
let displayCanvas;
let displayCtx;
let isDrawing = false;
let currentQuality = 1024;

// Interaction state for layer manipulation
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragLayer = null;
let dragStartLayerX = 0;
let dragStartLayerY = 0;


// Mode management
let currentMode = 'SELECT'; // DRAW, SELECT - default to SELECT
const MODES = { DRAW: 'DRAW', SELECT: 'SELECT' };

function setupCanvases() {
    // UV-based single canvas setup - Three.js standard approach
    displayCanvas = document.getElementById('display-canvas');
    
    // Create UV texture editor
    uvTextureEditor = new UVTextureEditor(currentQuality);
    
    // Display canvas for UI interaction
    displayCtx = displayCanvas.getContext('2d', {
        alpha: true,
        desynchronized: true,
        willReadFrequently: false,
        colorSpace: 'srgb'
    });
    
    // Make globally available
    window.displayCanvas = displayCanvas;
    window.uvTextureEditor = uvTextureEditor;
    window.displayCtx = displayCtx;
    window.canvasTexture = uvTextureEditor.getTexture();
    
    // Setup drawing event handlers
    setupDrawingEventHandlers();
    
    return { displayCanvas, uvTextureEditor, displayCtx };
}

function initializeCanvas(size = currentQuality) {
    currentQuality = size;
    
    // Three.js optimized canvas initialization
    const displaySize = 512; // Keep display consistent
    const textureSize = Math.max(256, Math.min(size, 2048)); // Clamp to safe range
    currentQuality = textureSize;
    
    // Recreate UV editor with new size if needed
    if (uvTextureEditor) {
        uvTextureEditor.dispose();
    }
    uvTextureEditor = new UVTextureEditor(textureSize);
    
    // Update global references
    window.canvasTexture = uvTextureEditor.getTexture();
    window.uvTextureEditor = uvTextureEditor;
    
    // Initialize display canvas (for user interaction)
    displayCanvas.width = displaySize;
    displayCanvas.height = displaySize;
    
    // Initialize display canvas with white background
    displayCtx.fillStyle = 'white';
    displayCtx.fillRect(0, 0, displaySize, displaySize);
    displayCtx.lineWidth = Math.max(3, displaySize / 170);
    displayCtx.lineCap = 'round';
    displayCtx.lineJoin = 'round';
    displayCtx.imageSmoothingEnabled = true;
    displayCtx.imageSmoothingQuality = 'high';
    
    // Update info display
    const memoryEstimate = ((textureSize * textureSize * 4) / 1024).toFixed(0); // RGBA format
    const qualityInfo = document.getElementById('quality-info');
    if (qualityInfo) {
        qualityInfo.textContent = `Resolution: ${textureSize}x${textureSize} (${memoryEstimate}KB)`;
    }
}

// Three.js UV-based texture editor - modern approach
class UVTextureEditor {
    constructor(size = 1024) {
        this.size = size;
        
        // Single canvas approach - more memory efficient
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvas.height = size;
        this.ctx = this.canvas.getContext('2d', {
            alpha: true,
            desynchronized: true,
            willReadFrequently: false,
            colorSpace: 'srgb'
        });
        
        // Create Three.js texture with proper settings
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.texture.format = THREE.RGBAFormat;
        this.texture.type = THREE.UnsignedByteType;
        this.texture.flipY = false; // Important for GLB compatibility
        this.texture.generateMipmaps = false;
        this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
        this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
        
        // Initialize with white background
        this.clear();
        
        // Update batching
        this.pendingUpdate = false;
    }
    
    // Clear canvas to white background
    clear(color = 'white') {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.size, this.size);
        this.requestUpdate();
    }
    
    // Draw at UV coordinates (0-1 space)
    drawAtUV(u, v, operation) {
        const x = u * this.size;
        const y = v * this.size;
        
        this.ctx.save();
        operation(this.ctx, x, y);
        this.ctx.restore();
        
        this.requestUpdate();
    }
    
    // Draw line between UV coordinates
    drawLineUV(u1, v1, u2, v2, color = '#ff0000', width = 4) {
        this.drawAtUV(0, 0, (ctx) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(u1 * this.size, v1 * this.size);
            ctx.lineTo(u2 * this.size, v2 * this.size);
            ctx.stroke();
        });
    }
    
    // Batch texture updates using requestAnimationFrame
    requestUpdate() {
        if (!this.pendingUpdate) {
            this.pendingUpdate = true;
            requestAnimationFrame(() => {
                if (this.texture) {
                    this.texture.needsUpdate = true;
                }
                this.pendingUpdate = false;
            });
        }
    }
    
    // Get the Three.js texture
    getTexture() {
        return this.texture;
    }
    
    // Dispose resources
    dispose() {
        if (this.texture) {
            this.texture.dispose();
            this.texture = null;
        }
    }
}

// Legacy texture update manager for backward compatibility
class TextureUpdateManager {
    constructor() {
        this.pendingUpdates = new Set();
        this.isUpdating = false;
    }
    
    requestUpdate(texture) {
        if (!texture) return;
        
        this.pendingUpdates.add(texture);
        
        if (!this.isUpdating) {
            this.isUpdating = true;
            requestAnimationFrame(() => this.processUpdates());
        }
    }
    
    processUpdates() {
        this.pendingUpdates.forEach(texture => {
            texture.needsUpdate = true;
        });
        this.pendingUpdates.clear();
        this.isUpdating = false;
    }
}

// Global texture update manager
const textureUpdateManager = new TextureUpdateManager();

// Legacy compatibility function
function throttledTextureUpdate() {
    textureUpdateManager.requestUpdate(window.canvasTexture);
}

// Coordinate transformation helpers
function displayToTexture(displayCoord) {
    return displayCoord * (currentQuality / 512);
}

// Pure UV-based drawing - simpler approach
function drawToCanvases(drawOperation) {
    // Draw on display canvas for immediate visual feedback
    displayCtx.save();
    drawOperation(displayCtx, 1.0);
    displayCtx.restore();
    
    // Draw on UV texture with coordinate conversion
    uvTextureEditor.ctx.save();
    drawOperation(uvTextureEditor.ctx, currentQuality / 512);
    uvTextureEditor.ctx.restore();
    uvTextureEditor.requestUpdate();
}

// New UV-based drawing functions
function drawLineInUV(startU, startV, endU, endV, color = '#ff0000', width = 4) {
    uvTextureEditor.drawLineUV(startU, startV, endU, endV, color, width);
    
    // Mirror on display canvas
    const startDisplay = uvToDisplay(startU, startV);
    const endDisplay = uvToDisplay(endU, endV);
    
    displayCtx.save();
    displayCtx.strokeStyle = color;
    displayCtx.lineWidth = width * (512 / currentQuality);
    displayCtx.lineCap = 'round';
    displayCtx.beginPath();
    displayCtx.moveTo(startDisplay.x, startDisplay.y);
    displayCtx.lineTo(endDisplay.x, endDisplay.y);
    displayCtx.stroke();
    displayCtx.restore();
}

function drawAtUV(u, v, operation) {
    uvTextureEditor.drawAtUV(u, v, operation);
    
    // Mirror on display canvas
    const display = uvToDisplay(u, v);
    displayCtx.save();
    operation(displayCtx, display.x, display.y);
    displayCtx.restore();
}

function getCanvasCoordinates(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        scaleX: scaleX,
        scaleY: scaleY
    };
}

// Convert display canvas coordinates to normalized 0-1 coordinates
function displayToNormalized(x, y, canvasSize = 512) {
    return {
        x: x / canvasSize,
        y: y / canvasSize
    };
}

// Convert normalized coordinates to display canvas coordinates
function normalizedToDisplay(normalizedX, normalizedY, canvasSize = 512) {
    return {
        x: normalizedX * canvasSize,
        y: normalizedY * canvasSize
    };
}

// Three.js UV-space utilities (for future improvements)
function displayToUV(x, y, displaySize = 512) {
    return {
        u: x / displaySize,
        v: y / displaySize
    };
}

function uvToDisplay(u, v, displaySize = 512) {
    return {
        x: u * displaySize,
        y: v * displaySize
    };
}

function uvToTexture(u, v, textureSize = currentQuality) {
    return {
        x: u * textureSize,
        y: v * textureSize
    };
}

function setDrawingMode(newMode) {
    currentMode = newMode;
    
    // Update UI
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    
    if (newMode === MODES.DRAW) {
        const drawModeBtn = document.getElementById('draw-mode-btn');
        if (drawModeBtn) drawModeBtn.classList.add('active');
        displayCanvas.style.cursor = 'crosshair';
        const drawTools = document.getElementById('draw-tools');
        if (drawTools) drawTools.style.display = 'block';
    } else if (newMode === MODES.SELECT) {
        const selectModeBtn = document.getElementById('select-mode-btn');
        if (selectModeBtn) selectModeBtn.classList.add('active');
        displayCanvas.style.cursor = 'default';
        const drawTools = document.getElementById('draw-tools');
        if (drawTools) drawTools.style.display = 'none';
    }
    
    // Image tools always visible
    const imageTools = document.getElementById('image-tools');
    if (imageTools) imageTools.style.display = 'block';
}

// Store drawing state for UV-based drawing
let lastDrawUV = null;

function setupDrawingEventHandlers() {
    // UV-based drawing events
    displayCanvas.addEventListener('pointerdown', (e) => {
        if (currentMode === MODES.DRAW) {
            isDrawing = true;
            const brushColor = document.getElementById('brush-color');
            const color = brushColor ? brushColor.value : '#ff0000';
            
            // Convert to UV coordinates
            const uv = displayToUV(e.offsetX, e.offsetY);
            lastDrawUV = uv;
            
            // Start drawing path in UV space
            uvTextureEditor.drawAtUV(uv.u, uv.v, (ctx) => {
                ctx.strokeStyle = color;
                ctx.lineWidth = Math.max(4, currentQuality / 170);
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(uv.u * currentQuality, uv.v * currentQuality);
            });
            
            // Mirror on display
            displayCtx.save();
            displayCtx.strokeStyle = color;
            displayCtx.lineWidth = Math.max(3, 512 / 170);
            displayCtx.lineCap = 'round';
            displayCtx.lineJoin = 'round';
            displayCtx.beginPath();
            displayCtx.moveTo(e.offsetX, e.offsetY);
            displayCtx.restore();
            
        } else if (currentMode === MODES.SELECT) {
            // Check if clicking on a layer for dragging
            const layer = window.layerManager ? window.layerManager.getLayerAt(e.offsetX, e.offsetY) : null;
            if (layer) {
                // Start dragging this layer
                isDragging = true;
                dragLayer = layer;
                dragStartX = e.offsetX;
                dragStartY = e.offsetY;
                dragStartLayerX = layer.x; // Display coordinates
                dragStartLayerY = layer.y; // Display coordinates
                
                // Select the layer if not already selected
                window.layerManager.selectLayer(layer.id);
                window.layerManager.renderLayers(); // Immediate render to show selection
                displayCanvas.style.cursor = 'move';
            }
        }
    });
    
    displayCanvas.addEventListener('pointermove', (e) => {
        if (currentMode === MODES.DRAW && isDrawing && lastDrawUV) {
            const uv = displayToUV(e.offsetX, e.offsetY);
            
            // Draw line in UV space
            uvTextureEditor.drawLineUV(lastDrawUV.u, lastDrawUV.v, uv.u, uv.v, 
                document.getElementById('brush-color')?.value || '#ff0000',
                Math.max(4, currentQuality / 170)
            );
            
            // Draw on display canvas
            displayCtx.save();
            displayCtx.strokeStyle = document.getElementById('brush-color')?.value || '#ff0000';
            displayCtx.lineWidth = Math.max(3, 512 / 170);
            displayCtx.lineCap = 'round';
            displayCtx.lineTo(e.offsetX, e.offsetY);
            displayCtx.stroke();
            displayCtx.restore();
            
            lastDrawUV = uv;
        } else if (currentMode === MODES.SELECT) {
            if (isDragging && dragLayer) {
                // Update layer position based on drag (simple display space)
                const deltaX = e.offsetX - dragStartX;
                const deltaY = e.offsetY - dragStartY;
                
                dragLayer.x = dragStartLayerX + deltaX;
                dragLayer.y = dragStartLayerY + deltaY;
                
                // Re-render with new position and batch texture update
                if (window.layerManager) {
                    window.layerManager.renderLayers();
                    textureUpdateManager.requestUpdate(window.canvasTexture);
                }
            } else {
                // Update cursor based on what's under mouse
                const layer = window.layerManager ? window.layerManager.getLayerAt(e.offsetX, e.offsetY) : null;
                displayCanvas.style.cursor = layer ? 'pointer' : 'default';
            }
        }
    });
    
    displayCanvas.addEventListener('pointerup', (e) => {
        if (currentMode === MODES.DRAW) {
            isDrawing = false;
            lastDrawUV = null;
        } else if (currentMode === MODES.SELECT) {
            if (isDragging) {
                // End dragging
                isDragging = false;
                dragLayer = null;
                displayCanvas.style.cursor = 'default';
            } else {
                // Handle layer selection
                const layer = window.layerManager ? window.layerManager.getLayerAt(e.offsetX, e.offsetY) : null;
                if (layer && window.layerManager) {
                    window.layerManager.selectLayer(layer.id);
                    console.log('Selected layer:', layer.id);
                } else if (window.layerManager) {
                    window.layerManager.selectLayer(null);
                    console.log('Deselected all layers');
                }
                // Re-render to show selection state
                if (window.layerManager) window.layerManager.renderLayers();
            }
        }
    });
    
    // Double-click to reset scale and rotation
    displayCanvas.addEventListener('dblclick', (e) => {
        if (currentMode === MODES.SELECT && window.layerManager) {
            const layer = window.layerManager.getLayerAt(e.offsetX, e.offsetY);
            if (layer) {
                // Reset scale and rotation to initial values
                layer.scaleX = layer.initialScaleX || 1;
                layer.scaleY = layer.initialScaleY || 1;
                layer.rotation = layer.initialRotation || 0;
                window.layerManager.renderLayers();
                console.log('Reset scale and rotation for layer:', layer.id);
            }
        }
    });
    
    displayCanvas.addEventListener('pointerleave', () => {
        if (currentMode === MODES.DRAW) {
            isDrawing = false;
            lastDrawUV = null;
        } else if (currentMode === MODES.SELECT) {
            // Stop dragging if pointer leaves canvas
            if (isDragging) {
                isDragging = false;
                dragLayer = null;
            }
            displayCanvas.style.cursor = 'default';
        }
    });
    
    // Deselect when clicking outside canvas
    document.addEventListener('click', (e) => {
        // Check if click is outside the display canvas
        if (currentMode === MODES.SELECT && !displayCanvas.contains(e.target)) {
            // Don't deselect if clicking on mode buttons or other controls
            const isControl = e.target.closest('.mode-selector, #image-upload, button, input, select');
            if (!isControl && window.layerManager && window.layerManager.selectedLayer) {
                window.layerManager.selectLayer(null);
                window.layerManager.renderLayers();
            }
        }
    });
    
    // Keyboard shortcuts for reset functionality
    document.addEventListener('keydown', (e) => {
        if (currentMode === MODES.SELECT && window.layerManager && window.layerManager.selectedLayer) {
            const layer = window.layerManager.selectedLayer;
            
            if (e.key === 'r' || e.key === 'R') {
                // Reset rotation to initial value
                layer.rotation = layer.initialRotation || 0;
                window.layerManager.renderLayers();
                console.log('Reset rotation for selected layer');
                e.preventDefault();
            } else if (e.key === 's' || e.key === 'S') {
                // Reset scale to initial values
                layer.scaleX = layer.initialScaleX || 1;
                layer.scaleY = layer.initialScaleY || 1;
                window.layerManager.renderLayers();
                console.log('Reset scale for selected layer');
                e.preventDefault();
            } else if (e.key === 'Escape') {
                // Reset both scale and rotation to initial values
                layer.scaleX = layer.initialScaleX || 1;
                layer.scaleY = layer.initialScaleY || 1;
                layer.rotation = layer.initialRotation || 0;
                window.layerManager.renderLayers();
                console.log('Reset scale and rotation for selected layer');
                e.preventDefault();
            }
        }
    });
}

function getCurrentMode() {
    return currentMode;
}

function setupModeEventHandlers() {
    // Mode toggle event handlers
    const drawModeBtn = document.getElementById('draw-mode-btn');
    if (drawModeBtn) {
        drawModeBtn.addEventListener('click', () => {
            setDrawingMode(MODES.DRAW);
        });
    }
    
    const selectModeBtn = document.getElementById('select-mode-btn');
    if (selectModeBtn) {
        selectModeBtn.addEventListener('click', () => {
            setDrawingMode(MODES.SELECT);
        });
    }
}

// Export functions for UV-based canvas system
window.setupCanvases = setupCanvases;
window.setDrawingMode = setDrawingMode;
window.getCanvasCoordinates = getCanvasCoordinates;
window.displayToUV = displayToUV;
window.uvToDisplay = uvToDisplay;
window.uvToTexture = uvToTexture;
window.initializeCanvas = initializeCanvas;
window.drawToCanvases = drawToCanvases;
window.drawLineInUV = drawLineInUV;
window.drawAtUV = drawAtUV;
window.setupModeEventHandlers = setupModeEventHandlers;
window.UVTextureEditor = UVTextureEditor;
window.MODES = MODES;