// Canvas editor variables and state
let displayCanvas, textureCanvas;
let displayCtx, textureCtx;
let canvas, ctx; // Legacy compatibility references
let isDrawing = false;
let targetQuality = 1024;
let currentQuality = 1024;
let lastTextureUpdate = 0;
const UPDATE_THROTTLE = 16; // Max 60fps texture updates

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
    // Dual-canvas setup: display (512x512) + texture (1024x1024)
    displayCanvas = document.getElementById('display-canvas');
    textureCanvas = document.getElementById('texture-canvas');
    
    displayCtx = displayCanvas.getContext('2d', {
        alpha: false,
        desynchronized: true,
        willReadFrequently: false
    });
    
    textureCtx = textureCanvas.getContext('2d', {
        alpha: false,
        desynchronized: true, 
        willReadFrequently: false
    });
    
    // Legacy compatibility - keep existing canvas reference for texture generation
    canvas = textureCanvas;
    ctx = textureCtx;
    
    // Make globally available
    window.displayCanvas = displayCanvas;
    window.textureCanvas = textureCanvas;
    window.displayCtx = displayCtx;
    window.textureCtx = textureCtx;
    window.canvas = canvas;
    window.ctx = ctx;
    
    // Setup drawing event handlers
    setupDrawingEventHandlers();
    
    return { displayCanvas, textureCanvas, displayCtx, textureCtx };
}

function initializeCanvas(size = currentQuality) {
    currentQuality = size;
    
    // Initialize texture canvas (for Three.js)
    textureCanvas.width = size;
    textureCanvas.height = size;
    
    // Initialize display canvas (for user interaction)
    displayCanvas.width = 512;
    displayCanvas.height = 512;
    
    // Initialize both canvases with white background
    textureCtx.fillStyle = 'white';
    textureCtx.fillRect(0, 0, size, size);
    textureCtx.lineWidth = Math.max(4, size / 170);
    textureCtx.lineCap = 'round';
    textureCtx.lineJoin = 'round';
    textureCtx.imageSmoothingEnabled = true;
    textureCtx.imageSmoothingQuality = 'high';
    
    displayCtx.fillStyle = 'white';
    displayCtx.fillRect(0, 0, 512, 512);
    displayCtx.lineWidth = Math.max(3, 512 / 170); // Scale for display
    displayCtx.lineCap = 'round';
    displayCtx.lineJoin = 'round';
    displayCtx.imageSmoothingEnabled = true;
    displayCtx.imageSmoothingQuality = 'high';
    
    // Update info display
    const memoryEstimate = ((size * size * 3) / 1024).toFixed(0); // RGB format
    const qualityInfo = document.getElementById('quality-info');
    if (qualityInfo) {
        qualityInfo.textContent = `Resolution: ${size}x${size} (${memoryEstimate}KB)`;
    }
}

function throttledTextureUpdate() {
    const now = performance.now();
    if (now - lastTextureUpdate > UPDATE_THROTTLE) {
        if (window.canvasTexture) {
            window.canvasTexture.needsUpdate = true;
        }
        lastTextureUpdate = now;
    }
}

// Coordinate transformation helpers
function displayToTexture(displayCoord) {
    return displayCoord * (currentQuality / 512);
}

function drawToCanvases(drawOperation) {
    // Draw on display canvas for immediate visual feedback
    drawOperation(displayCtx, 1.0); // 1:1 scale for display
    
    // Mirror to texture canvas with coordinate scaling
    const scale = currentQuality / 512;
    drawOperation(textureCtx, scale);
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

function setupDrawingEventHandlers() {
    // Canvas drawing events - only active in DRAW mode
    displayCanvas.addEventListener('pointerdown', (e) => {
        if (currentMode === MODES.DRAW) {
            isDrawing = true;
            const brushColor = document.getElementById('brush-color');
            const color = brushColor ? brushColor.value : '#ff0000';
            
            drawToCanvases((ctx, scale) => {
                ctx.strokeStyle = color;
                ctx.beginPath();
                ctx.moveTo(e.offsetX * scale, e.offsetY * scale);
            });
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
        if (currentMode === MODES.DRAW && isDrawing) {
            drawToCanvases((ctx, scale) => {
                ctx.lineTo(e.offsetX * scale, e.offsetY * scale);
                ctx.stroke();
            });
            throttledTextureUpdate();
        } else if (currentMode === MODES.SELECT) {
            if (isDragging && dragLayer) {
                // Update layer position based on drag (simple display space)
                const deltaX = e.offsetX - dragStartX;
                const deltaY = e.offsetY - dragStartY;
                
                dragLayer.x = dragStartLayerX + deltaX;
                dragLayer.y = dragStartLayerY + deltaY;
                
                // Re-render with new position
                if (window.layerManager) window.layerManager.renderLayers();
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

// Export functions
window.setupCanvases = setupCanvases;
window.setDrawingMode = setDrawingMode;
window.getCanvasCoordinates = getCanvasCoordinates;
window.displayToNormalized = displayToNormalized;
window.normalizedToDisplay = normalizedToDisplay;
window.initializeCanvas = initializeCanvas;
window.throttledTextureUpdate = throttledTextureUpdate;
window.displayToTexture = displayToTexture;
window.drawToCanvases = drawToCanvases;
window.setupModeEventHandlers = setupModeEventHandlers;
window.MODES = MODES;
window.currentMode = currentMode;