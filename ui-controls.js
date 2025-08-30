// UI Controls and Panel Management System

// Color square state
let recentColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];

// Three.js Editor-Style UI System
class UIPanel {
    constructor(element) {
        this.element = element;
        this.state = {};
        this.initializeCollapsiblePanels();
        this.initializeResizers();
    }
    
    initializeCollapsiblePanels() {
        const headers = this.element.querySelectorAll('.panel-header');
        headers.forEach(header => {
            header.addEventListener('click', (e) => {
                const panel = header.parentElement;
                const panelId = header.dataset.panel;
                this.togglePanel(panel, panelId);
            });
        });
    }
    
    togglePanel(panel, panelId) {
        const isCollapsed = panel.classList.contains('collapsed');
        panel.classList.toggle('collapsed');
        
        // Store state
        this.state[panelId] = !isCollapsed;
        
        // Update toggle icon
        const toggle = panel.querySelector('.panel-toggle');
        if (toggle) {
            toggle.textContent = isCollapsed ? '▼' : '▶';
        }
        
        // Handle main panel collapse (entire container)
        const header = panel.querySelector('.panel-header');
        const targetId = header?.dataset.target;
        if (targetId) {
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) {
                if (!isCollapsed) {
                    // Collapsing - make panel header-only size
                    targetPanel.classList.add('panel-collapsed');
                } else {
                    // Expanding - restore full panel
                    targetPanel.classList.remove('panel-collapsed');
                }
            }
        }
    }
    
    initializeResizers() {
        const resizers = this.element.querySelectorAll('.ui-resizer');
        resizers.forEach(resizer => {
            this.setupResizer(resizer);
        });
    }
    
    setupResizer(resizer) {
        let isResizing = false;
        let startPointer = { x: 0, y: 0 };
        let startSize = { width: 0, height: 0 };
        
        resizer.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            isResizing = true;
            startPointer = { x: e.clientX, y: e.clientY };
            
            const targetPanel = document.getElementById(resizer.dataset.panel);
            if (targetPanel) {
                const rect = targetPanel.getBoundingClientRect();
                startSize = { width: rect.width, height: rect.height };
                
                resizer.classList.add('resizing');
                resizer.setPointerCapture(e.pointerId);
                document.body.style.cursor = resizer.classList.contains('vertical') ? 'ew-resize' : 'ns-resize';
            }
        });
        
        resizer.addEventListener('pointermove', (e) => {
            if (!isResizing) return;
            
            const targetPanel = document.getElementById(resizer.dataset.panel);
            if (!targetPanel) return;
            
            if (resizer.classList.contains('vertical')) {
                // Horizontal resizing
                const deltaX = startPointer.x - e.clientX;
                const newWidth = Math.max(350, Math.min(window.innerWidth - 50, startSize.width + deltaX));
                targetPanel.style.width = newWidth + 'px';
                
                // Update canvas size
                this.updateCanvasSize(targetPanel);
            }
        });
        
        resizer.addEventListener('pointerup', (e) => {
            if (!isResizing) return;
            
            isResizing = false;
            resizer.classList.remove('resizing');
            resizer.releasePointerCapture(e.pointerId);
            document.body.style.cursor = '';
        });
        
        // Handle pointer cancel (e.g., when pointer leaves window)
        resizer.addEventListener('pointercancel', (e) => {
            isResizing = false;
            resizer.classList.remove('resizing');
            document.body.style.cursor = '';
        });
    }
    
    updateCanvasSize(panel) {
        const displayCanvas = panel.querySelector('#display-canvas');
        if (!displayCanvas) return;
        
        const panelWidth = panel.offsetWidth;
        const availableWidth = panelWidth - 50; // Account for padding and resizer
        displayCanvas.style.maxWidth = Math.min(availableWidth, 512) + 'px';
        
        // Trigger layer re-rendering after size change
        if (window.layerManager) {
            setTimeout(() => {
                window.layerManager.renderLayers();
            }, 50);
        }
    }
}

// Initialize UI System
function setupUISystem() {
    // Initialize controls panel
    const controlsPanel = document.getElementById('controls');
    if (controlsPanel) {
        new UIPanel(controlsPanel);
    }
    
    // Initialize canvas editor panel
    const canvasEditor = document.getElementById('canvas-editor');
    if (canvasEditor) {
        const uiPanel = new UIPanel(canvasEditor);
        
        // Update canvas size on window resize
        window.addEventListener('resize', () => {
            uiPanel.updateCanvasSize(canvasEditor);
        });
        
        // Initial canvas size update
        setTimeout(() => {
            uiPanel.updateCanvasSize(canvasEditor);
        }, 100);
    }
}

// Color modal functions
function showColorSquareDialog() {
    const colorModal = document.getElementById('colorModal');
    if (colorModal) {
        colorModal.style.display = 'flex';
        updateColorPreview();
        displayRecentColors();
        setupColorInputListeners();
    }
}

function closeColorModal() {
    const colorModal = document.getElementById('colorModal');
    if (colorModal) {
        colorModal.style.display = 'none';
    }
}

function setupColorInputListeners() {
    const modalColorPicker = document.getElementById('modalColorPicker');
    const hexInput = document.getElementById('hexInput');
    const redInput = document.getElementById('redInput');
    const greenInput = document.getElementById('greenInput');
    const blueInput = document.getElementById('blueInput');
    const opacitySlider = document.getElementById('opacitySlider');
    
    if (!modalColorPicker) return;
    
    // Remove existing listeners to avoid duplicates
    modalColorPicker.removeEventListener('input', syncFromColorPicker);
    if (hexInput) hexInput.removeEventListener('input', syncFromHex);
    if (redInput) redInput.removeEventListener('input', syncFromRGB);
    if (greenInput) greenInput.removeEventListener('input', syncFromRGB);
    if (blueInput) blueInput.removeEventListener('input', syncFromRGB);
    if (opacitySlider) opacitySlider.removeEventListener('input', updateOpacityValue);
    
    // Add listeners
    modalColorPicker.addEventListener('input', syncFromColorPicker);
    if (hexInput) hexInput.addEventListener('input', syncFromHex);
    if (redInput) redInput.addEventListener('input', syncFromRGB);
    if (greenInput) greenInput.addEventListener('input', syncFromRGB);
    if (blueInput) blueInput.addEventListener('input', syncFromRGB);
    if (opacitySlider) opacitySlider.addEventListener('input', updateOpacityValue);
}

function syncFromColorPicker() {
    const modalColorPicker = document.getElementById('modalColorPicker');
    const hexInput = document.getElementById('hexInput');
    const redInput = document.getElementById('redInput');
    const greenInput = document.getElementById('greenInput');
    const blueInput = document.getElementById('blueInput');
    
    if (!modalColorPicker) return;
    
    const color = modalColorPicker.value;
    const rgb = hexToRgb(color);
    
    if (hexInput) hexInput.value = color;
    if (redInput && rgb) redInput.value = rgb.r;
    if (greenInput && rgb) greenInput.value = rgb.g;
    if (blueInput && rgb) blueInput.value = rgb.b;
    
    updateColorPreview();
}

function syncFromHex() {
    const hexInput = document.getElementById('hexInput');
    const modalColorPicker = document.getElementById('modalColorPicker');
    const redInput = document.getElementById('redInput');
    const greenInput = document.getElementById('greenInput');
    const blueInput = document.getElementById('blueInput');
    
    if (!hexInput) return;
    
    const hex = hexInput.value;
    if (hex.match(/^#[0-9A-F]{6}$/i)) {
        const rgb = hexToRgb(hex);
        
        if (modalColorPicker) modalColorPicker.value = hex;
        if (redInput && rgb) redInput.value = rgb.r;
        if (greenInput && rgb) greenInput.value = rgb.g;
        if (blueInput && rgb) blueInput.value = rgb.b;
        
        updateColorPreview();
    }
}

function syncFromRGB() {
    const redInput = document.getElementById('redInput');
    const greenInput = document.getElementById('greenInput');
    const blueInput = document.getElementById('blueInput');
    const modalColorPicker = document.getElementById('modalColorPicker');
    const hexInput = document.getElementById('hexInput');
    
    if (!redInput || !greenInput || !blueInput) return;
    
    const r = parseInt(redInput.value) || 0;
    const g = parseInt(greenInput.value) || 0;
    const b = parseInt(blueInput.value) || 0;
    
    const hex = rgbToHex(r, g, b);
    
    if (modalColorPicker) modalColorPicker.value = hex;
    if (hexInput) hexInput.value = hex;
    
    updateColorPreview();
}

function updateOpacityValue() {
    const opacitySlider = document.getElementById('opacitySlider');
    const opacityValue = document.getElementById('opacityValue');
    
    if (!opacitySlider || !opacityValue) return;
    
    const opacity = opacitySlider.value;
    opacityValue.textContent = Math.round(opacity * 100) + '%';
    updateColorPreview();
}

function updateColorPreview() {
    const hexInput = document.getElementById('hexInput');
    const opacitySlider = document.getElementById('opacitySlider');
    const preview = document.getElementById('colorPreview');
    
    if (!hexInput || !preview) return;
    
    const hex = hexInput.value;
    const opacity = opacitySlider ? opacitySlider.value : 1;
    
    preview.style.backgroundColor = hex;
    preview.style.opacity = opacity;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function insertColorSquare() {
    const hexInput = document.getElementById('hexInput');
    const opacitySlider = document.getElementById('opacitySlider');
    
    if (!hexInput) return;
    
    const hex = hexInput.value;
    const opacity = opacitySlider ? parseFloat(opacitySlider.value) : 1;
    
    // Add to recent colors
    addToRecentColors(hex);
    
    // Create a canvas with the solid color square
    const squareCanvas = document.createElement('canvas');
    const size = 100; // 100px square
    squareCanvas.width = size;
    squareCanvas.height = size;
    const squareCtx = squareCanvas.getContext('2d');
    
    // Fill with the selected color
    squareCtx.fillStyle = hex;
    squareCtx.fillRect(0, 0, size, size);
    
    // Create image from canvas
    const img = new Image();
    img.onload = () => {
        // Create new layer positioned at center with the specified opacity (display coordinates)
        if (window.ImageLayer && window.layerManager) {
            const layer = new window.ImageLayer(img, {
                x: 256, // Center in display space (512/2)
                y: 256, // Center in display space (512/2)
                scaleX: 0.8,
                scaleY: 0.8,
                opacity: opacity
            });
            
            window.layerManager.addLayer(layer);
            window.layerManager.selectLayer(layer.id);
        }
    };
    img.src = squareCanvas.toDataURL();
    
    closeColorModal();
}

function addToRecentColors(color) {
    // Remove color if it already exists
    const index = recentColors.indexOf(color);
    if (index > -1) {
        recentColors.splice(index, 1);
    }
    
    // Add to beginning
    recentColors.unshift(color);
    
    // Keep only 5 most recent
    if (recentColors.length > 5) {
        recentColors = recentColors.slice(0, 5);
    }
}

function displayRecentColors() {
    // Update modal swatches
    const container = document.getElementById('recentColors');
    if (container) {
        container.innerHTML = '';
        
        recentColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'swatch-preview';
            swatch.style.backgroundColor = color;
            swatch.title = color;
            swatch.onclick = () => useRecentColor(color);
            container.appendChild(swatch);
        });
    }
    
    // Update quick swatches next to button
    displayQuickSwatches();
}

function displayQuickSwatches() {
    const container = document.getElementById('quickSwatches');
    if (!container) return;
    
    container.innerHTML = '';
    
    recentColors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.style.cssText = `
            width: 16px; height: 16px; border: 1px solid #555; border-radius: 2px; 
            cursor: pointer; background-color: ${color}; flex-shrink: 0;
        `;
        swatch.title = `Quick add: ${color}`;
        swatch.onclick = () => quickInsertColor(color);
        container.appendChild(swatch);
    });
}

function quickInsertColor(color) {
    // Add to recent colors (moves to front)
    addToRecentColors(color);
    
    // Create a canvas with the solid color square
    const squareCanvas = document.createElement('canvas');
    const size = 100; // 100px square
    squareCanvas.width = size;
    squareCanvas.height = size;
    const squareCtx = squareCanvas.getContext('2d');
    
    // Fill with the selected color
    squareCtx.fillStyle = color;
    squareCtx.fillRect(0, 0, size, size);
    
    // Create image from canvas
    const img = new Image();
    img.onload = () => {
        // Create new layer positioned at center with full opacity (display coordinates)
        if (window.ImageLayer && window.layerManager) {
            const layer = new window.ImageLayer(img, {
                x: 256, // Center in display space (512/2)
                y: 256, // Center in display space (512/2)
                scaleX: 0.8,
                scaleY: 0.8,
                opacity: 1
            });
            
            window.layerManager.addLayer(layer);
            window.layerManager.selectLayer(layer.id);
        }
    };
    img.src = squareCanvas.toDataURL();
}

function useRecentColor(color) {
    const rgb = hexToRgb(color);
    
    const modalColorPicker = document.getElementById('modalColorPicker');
    const hexInput = document.getElementById('hexInput');
    const redInput = document.getElementById('redInput');
    const greenInput = document.getElementById('greenInput');
    const blueInput = document.getElementById('blueInput');
    
    if (modalColorPicker) modalColorPicker.value = color;
    if (hexInput) hexInput.value = color;
    if (redInput && rgb) redInput.value = rgb.r;
    if (greenInput && rgb) greenInput.value = rgb.g;
    if (blueInput && rgb) blueInput.value = rgb.b;
    
    updateColorPreview();
}

// UI Control Event Handlers
function initializeControls() {
    // Image upload
    const imageUpload = document.getElementById('image-upload');
    if (imageUpload) {
        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const img = new Image();
                img.onload = () => {
                    // Calculate initial scale to fit nicely in canvas
                    const maxSize = Math.min(512 * 0.6, Math.max(img.width, img.height)); // 60% of canvas
                    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                    
                    // Create new layer positioned at center (display coordinates)
                    if (window.ImageLayer && window.layerManager) {
                        const layer = new window.ImageLayer(img, {
                            x: 256, // Center in display space (512/2)
                            y: 256, // Center in display space (512/2)
                            scaleX: scale,
                            scaleY: scale
                        });
                        
                        window.layerManager.addLayer(layer);
                    }
                    
                    // Clean up blob URL
                    URL.revokeObjectURL(img.src);
                };
                img.src = URL.createObjectURL(file);
                
                // Reset file input
                e.target.value = '';
            }
        });
    }
    
    // Background color
    const bgColor = document.getElementById('bg-color');
    if (bgColor && window.scene) {
        bgColor.addEventListener('input', (e) => {
            window.scene.background.setHex(e.target.value.replace('#', '0x'));
        });
    }
    
    // Clear canvas button
    const clearCanvasBtn = document.getElementById('clear-canvas-btn');
    if (clearCanvasBtn) {
        clearCanvasBtn.addEventListener('click', () => {
            if (window.layerManager) {
                window.layerManager.clearLayers();
            }
        });
    }
    
    // Toggle canvas editor button
    const toggleCanvasBtn = document.getElementById('toggle-canvas-btn');
    if (toggleCanvasBtn) {
        toggleCanvasBtn.addEventListener('click', () => {
            const editor = document.getElementById('canvas-editor');
            if (!editor) return;
            
            const isHidden = editor.style.display === 'none' || window.getComputedStyle(editor).display === 'none';
            
            if (isHidden) {
                // Show the editor and ensure it's expanded
                editor.style.display = 'flex';
                editor.classList.remove('panel-collapsed');
                
                // Ensure the main panel is expanded
                const mainPanel = editor.querySelector('.collapsible-panel.main-panel');
                if (mainPanel) {
                    mainPanel.classList.remove('collapsed');
                    const toggle = mainPanel.querySelector('.panel-toggle');
                    if (toggle) toggle.textContent = '▼';
                }
            } else {
                // Hide the editor completely
                editor.style.display = 'none';
            }
        });
    }
    
    // Hide canvas editor button
    const hideCanvasBtn = document.getElementById('hide-canvas-btn');
    if (hideCanvasBtn) {
        hideCanvasBtn.addEventListener('click', () => {
            const editor = document.getElementById('canvas-editor');
            if (editor) {
                editor.style.display = 'none';
            }
        });
    }
    
    // Color modal event handlers
    const colorModal = document.getElementById('colorModal');
    if (colorModal) {
        colorModal.addEventListener('click', (e) => {
            if (e.target.id === 'colorModal') {
                closeColorModal();
            }
        });
    }
    
    document.addEventListener('keydown', (e) => {
        const colorModal = document.getElementById('colorModal');
        if (e.key === 'Escape' && colorModal && colorModal.style.display === 'flex') {
            closeColorModal();
        }
    });
    
    // Initialize quick swatches
    displayQuickSwatches();
}

// Export functions
window.setupUISystem = setupUISystem;
window.initializeControls = initializeControls;
window.showColorSquareDialog = showColorSquareDialog;
window.closeColorModal = closeColorModal;
window.insertColorSquare = insertColorSquare;
window.recentColors = recentColors;