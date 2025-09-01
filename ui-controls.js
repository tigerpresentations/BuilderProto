// UI Controls and Panel Management System

// Color square state
let recentColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];

// Authentication integration helpers
function showNotification(message, type = 'info', duration = 3000) {
    // Simple notification for auth feedback
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 1000;
        padding: 12px 20px; border-radius: 4px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
        color: white; font-size: 12px; max-width: 300px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => document.body.removeChild(notification), 300);
    }, duration);
}

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
        // Create new layer positioned at center with simple 512x512 coordinates
        if (window.SimpleImageLayer && window.layerManager) {
            const layer = new window.SimpleImageLayer(img, {
                x: 256, // Center in 512x512 space
                y: 256, // Center in 512x512 space
                width: size * 0.8,
                height: size * 0.8,
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
        recentColors.splice(5);
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
        // Create new layer positioned at center with simple 512x512 coordinates
        if (window.SimpleImageLayer && window.layerManager) {
            const layer = new window.SimpleImageLayer(img, {
                x: 256, // Center in 512x512 space
                y: 256, // Center in 512x512 space
                width: size * 0.8,
                height: size * 0.8,
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
                    const maxSize = Math.min(512 * 0.85, Math.max(img.width, img.height)); // 85% of canvas
                    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                    
                    // Create new layer positioned at center using simple 512x512 coordinates
                    if (window.SimpleImageLayer && window.layerManager) {
                        const layer = new window.SimpleImageLayer(img, {
                            x: 256, // Center in 512x512 space
                            y: 256, // Center in 512x512 space
                            width: img.width * scale,
                            height: img.height * scale
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
    
    // Lighting dev console button
    const lightingDevBtn = document.getElementById('lighting-dev-btn');
    if (lightingDevBtn) {
        lightingDevBtn.addEventListener('click', () => {
            if (window.lightingConsole) {
                window.lightingConsole.toggle();
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

// Lighting Developer Console
class LightingDevConsole {
    constructor() {
        this.isVisible = false;
        this.createPanel();
        this.initializeControls();
    }
    
    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'lighting-dev-console';
        panel.style.cssText = `
            position: fixed; top: 20px; left: 20px; width: 320px; z-index: 1001;
            background: rgba(40, 40, 40, 0.95); border: 1px solid #666;
            border-radius: 8px; padding: 15px; font-family: monospace;
            color: #fff; font-size: 12px; display: none;
            max-height: 80vh; overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #555; padding-bottom: 10px;">
                <h3 style="margin: 0; color: #4CAF50;">Lighting Dev Console</h3>
                <button onclick="window.lightingConsole.hide()" style="background: #666; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer;">×</button>
            </div>
            
            <!-- Hemisphere Light -->
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #2196F3;">Hemisphere Light</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <label>Sky Color: <input type="color" id="skyColor" value="#87ceeb" style="width: 40px; margin-left: 5px;"></label>
                    <label>Ground Color: <input type="color" id="groundColor" value="#362f28" style="width: 40px; margin-left: 5px;"></label>
                    <label>Intensity: <input type="range" id="hemisphereIntensity" min="0" max="1" step="0.05" value="0.4" style="width: 80px;"> <span id="hemisphereValue">0.4</span></label>
                </div>
            </div>
            
            <!-- Main Light -->
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #FF9800;">Main Light</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <label>Color: <input type="color" id="mainColor" value="#ffffff" style="width: 40px; margin-left: 5px;"></label>
                    <label>Intensity: <input type="range" id="mainIntensity" min="0" max="2" step="0.1" value="1.2" style="width: 80px;"> <span id="mainValue">1.2</span></label>
                    <label>X: <input type="range" id="mainX" min="-15" max="15" step="0.5" value="8" style="width: 60px;"> <span id="mainXValue">8</span></label>
                    <label>Y: <input type="range" id="mainY" min="5" max="20" step="0.5" value="12" style="width: 60px;"> <span id="mainYValue">12</span></label>
                    <label>Z: <input type="range" id="mainZ" min="-15" max="15" step="0.5" value="6" style="width: 60px;"> <span id="mainZValue">6</span></label>
                </div>
            </div>
            
            <!-- Fill Light -->
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #9C27B0;">Fill Light</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <label>Color: <input type="color" id="fillColor" value="#ffffff" style="width: 40px; margin-left: 5px;"></label>
                    <label>Intensity: <input type="range" id="fillIntensity" min="0" max="1" step="0.05" value="0.3" style="width: 80px;"> <span id="fillValue">0.3</span></label>
                    <label>X: <input type="range" id="fillX" min="-15" max="15" step="0.5" value="-5" style="width: 60px;"> <span id="fillXValue">-5</span></label>
                    <label>Y: <input type="range" id="fillY" min="5" max="20" step="0.5" value="8" style="width: 60px;"> <span id="fillYValue">8</span></label>
                    <label>Z: <input type="range" id="fillZ" min="-15" max="15" step="0.5" value="-3" style="width: 60px;"> <span id="fillZValue">-3</span></label>
                </div>
            </div>
            
            <!-- Shadow Settings -->
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #F44336;">Shadow Settings</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <label>Camera Size: <input type="range" id="shadowSize" min="2" max="10" step="0.5" value="5" style="width: 60px;"> <span id="shadowSizeValue">5</span></label>
                    <label>Bias: <input type="range" id="shadowBias" min="-0.002" max="0.002" step="0.0001" value="-0.0005" style="width: 60px;"> <span id="shadowBiasValue">-0.0005</span></label>
                    <label>Normal Bias: <input type="range" id="normalBias" min="0" max="0.1" step="0.005" value="0.02" style="width: 60px;"> <span id="normalBiasValue">0.02</span></label>
                </div>
            </div>
            
            <!-- Tone Mapping -->
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #4CAF50;">Tone Mapping</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <label>Exposure: <input type="range" id="exposure" min="0.1" max="3" step="0.1" value="1.0" style="width: 80px;"> <span id="exposureValue">1.0</span></label>
                </div>
            </div>
            
            <!-- Preset Buttons -->
            <div style="margin-top: 15px; border-top: 1px solid #555; padding-top: 10px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button onclick="window.lightingConsole.loadPreset('studio')" style="background: #2196F3; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">Studio</button>
                    <button onclick="window.lightingConsole.loadPreset('outdoor')" style="background: #4CAF50; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">Outdoor</button>
                    <button onclick="window.lightingConsole.loadPreset('soft')" style="background: #FF9800; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">Soft</button>
                    <button onclick="window.lightingConsole.loadPreset('dramatic')" style="background: #F44336; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">Dramatic</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.panel = panel;
    }
    
    initializeControls() {
        // Add change listeners to all controls
        const controls = [
            'skyColor', 'groundColor', 'hemisphereIntensity',
            'mainColor', 'mainIntensity', 'mainX', 'mainY', 'mainZ',
            'fillColor', 'fillIntensity', 'fillX', 'fillY', 'fillZ',
            'shadowSize', 'shadowBias', 'normalBias', 'exposure'
        ];
        
        controls.forEach(id => {
            const element = this.panel.querySelector(`#${id}`);
            if (element) {
                element.addEventListener('input', () => {
                    this.updateLightingFromControls();
                    this.updateValueDisplays();
                });
            }
        });
        
        // Initial value display update
        this.updateValueDisplays();
    }
    
    updateValueDisplays() {
        const updates = [
            ['hemisphereIntensity', 'hemisphereValue'],
            ['mainIntensity', 'mainValue'],
            ['mainX', 'mainXValue'],
            ['mainY', 'mainYValue'],
            ['mainZ', 'mainZValue'],
            ['fillIntensity', 'fillValue'],
            ['fillX', 'fillXValue'],
            ['fillY', 'fillYValue'],
            ['fillZ', 'fillZValue'],
            ['shadowSize', 'shadowSizeValue'],
            ['shadowBias', 'shadowBiasValue'],
            ['normalBias', 'normalBiasValue'],
            ['exposure', 'exposureValue']
        ];
        
        updates.forEach(([inputId, displayId]) => {
            const input = this.panel.querySelector(`#${inputId}`);
            const display = this.panel.querySelector(`#${displayId}`);
            if (input && display) {
                display.textContent = input.value;
            }
        });
    }
    
    updateLightingFromControls() {
        if (!window.lightingConfig) return;
        
        const config = window.lightingConfig;
        
        // Update hemisphere light
        config.hemisphere.skyColor = parseInt(this.panel.querySelector('#skyColor').value.replace('#', ''), 16);
        config.hemisphere.groundColor = parseInt(this.panel.querySelector('#groundColor').value.replace('#', ''), 16);
        config.hemisphere.intensity = parseFloat(this.panel.querySelector('#hemisphereIntensity').value);
        
        // Update main light
        config.mainLight.color = parseInt(this.panel.querySelector('#mainColor').value.replace('#', ''), 16);
        config.mainLight.intensity = parseFloat(this.panel.querySelector('#mainIntensity').value);
        config.mainLight.position.x = parseFloat(this.panel.querySelector('#mainX').value);
        config.mainLight.position.y = parseFloat(this.panel.querySelector('#mainY').value);
        config.mainLight.position.z = parseFloat(this.panel.querySelector('#mainZ').value);
        
        // Update fill light
        config.fillLight.color = parseInt(this.panel.querySelector('#fillColor').value.replace('#', ''), 16);
        config.fillLight.intensity = parseFloat(this.panel.querySelector('#fillIntensity').value);
        config.fillLight.position.x = parseFloat(this.panel.querySelector('#fillX').value);
        config.fillLight.position.y = parseFloat(this.panel.querySelector('#fillY').value);
        config.fillLight.position.z = parseFloat(this.panel.querySelector('#fillZ').value);
        
        // Update shadow settings
        config.shadows.cameraSize = parseFloat(this.panel.querySelector('#shadowSize').value);
        config.shadows.bias = parseFloat(this.panel.querySelector('#shadowBias').value);
        config.shadows.normalBias = parseFloat(this.panel.querySelector('#normalBias').value);
        
        // Update tone mapping
        config.toneMappingExposure = parseFloat(this.panel.querySelector('#exposure').value);
        
        // Apply changes to Three.js scene
        if (window.updateLighting) {
            window.updateLighting();
        }
    }
    
    loadPreset(presetName) {
        const presets = {
            studio: {
                hemisphere: { skyColor: 0x87ceeb, groundColor: 0x362f28, intensity: 0.4 },
                mainLight: { color: 0xffffff, intensity: 1.2, position: { x: 8, y: 12, z: 6 } },
                fillLight: { color: 0xffffff, intensity: 0.3, position: { x: -5, y: 8, z: -3 } },
                shadows: { cameraSize: 5, bias: -0.0005, normalBias: 0.02 },
                toneMappingExposure: 1.0
            },
            outdoor: {
                hemisphere: { skyColor: 0x74c0fc, groundColor: 0x495057, intensity: 0.6 },
                mainLight: { color: 0xfff3e0, intensity: 1.5, position: { x: 10, y: 15, z: 8 } },
                fillLight: { color: 0x74c0fc, intensity: 0.2, position: { x: -8, y: 10, z: -5 } },
                shadows: { cameraSize: 6, bias: -0.0003, normalBias: 0.015 },
                toneMappingExposure: 1.2
            },
            soft: {
                hemisphere: { skyColor: 0xffffff, groundColor: 0xc8c8c8, intensity: 0.5 },
                mainLight: { color: 0xffffff, intensity: 0.8, position: { x: 6, y: 10, z: 4 } },
                fillLight: { color: 0xffffff, intensity: 0.5, position: { x: -4, y: 6, z: -2 } },
                shadows: { cameraSize: 4, bias: -0.0008, normalBias: 0.025 },
                toneMappingExposure: 0.8
            },
            dramatic: {
                hemisphere: { skyColor: 0x1a1a1a, groundColor: 0x0a0a0a, intensity: 0.2 },
                mainLight: { color: 0xffffff, intensity: 2.0, position: { x: 12, y: 15, z: 10 } },
                fillLight: { color: 0x444488, intensity: 0.15, position: { x: -10, y: 5, z: -8 } },
                shadows: { cameraSize: 3, bias: -0.0002, normalBias: 0.01 },
                toneMappingExposure: 1.5
            }
        };
        
        const preset = presets[presetName];
        if (!preset) return;
        
        // Update global config
        Object.assign(window.lightingConfig, preset);
        
        // Update UI controls
        this.updateControlsFromConfig();
        
        // Apply to scene
        if (window.updateLighting) {
            window.updateLighting();
        }
    }
    
    updateControlsFromConfig() {
        const config = window.lightingConfig;
        
        // Update hemisphere
        this.panel.querySelector('#skyColor').value = '#' + config.hemisphere.skyColor.toString(16).padStart(6, '0');
        this.panel.querySelector('#groundColor').value = '#' + config.hemisphere.groundColor.toString(16).padStart(6, '0');
        this.panel.querySelector('#hemisphereIntensity').value = config.hemisphere.intensity;
        
        // Update main light
        this.panel.querySelector('#mainColor').value = '#' + config.mainLight.color.toString(16).padStart(6, '0');
        this.panel.querySelector('#mainIntensity').value = config.mainLight.intensity;
        this.panel.querySelector('#mainX').value = config.mainLight.position.x;
        this.panel.querySelector('#mainY').value = config.mainLight.position.y;
        this.panel.querySelector('#mainZ').value = config.mainLight.position.z;
        
        // Update fill light
        this.panel.querySelector('#fillColor').value = '#' + config.fillLight.color.toString(16).padStart(6, '0');
        this.panel.querySelector('#fillIntensity').value = config.fillLight.intensity;
        this.panel.querySelector('#fillX').value = config.fillLight.position.x;
        this.panel.querySelector('#fillY').value = config.fillLight.position.y;
        this.panel.querySelector('#fillZ').value = config.fillLight.position.z;
        
        // Update shadows
        this.panel.querySelector('#shadowSize').value = config.shadows.cameraSize;
        this.panel.querySelector('#shadowBias').value = config.shadows.bias;
        this.panel.querySelector('#normalBias').value = config.shadows.normalBias;
        
        // Update tone mapping
        this.panel.querySelector('#exposure').value = config.toneMappingExposure;
        
        this.updateValueDisplays();
    }
    
    show() {
        this.panel.style.display = 'block';
        this.isVisible = true;
        this.updateControlsFromConfig();
    }
    
    hide() {
        this.panel.style.display = 'none';
        this.isVisible = false;
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}

// Initialize lighting console and add keyboard shortcut
function initializeLightingConsole() {
    window.lightingConsole = new LightingDevConsole();
    
    // Add keyboard shortcut (Alt+L)
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'l' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            window.lightingConsole.toggle();
        }
    });
    
    console.log('Lighting Dev Console initialized. Press Alt+L to open.');
}

// Export functions
window.setupUISystem = setupUISystem;
window.initializeControls = initializeControls;
window.showColorSquareDialog = showColorSquareDialog;
window.closeColorModal = closeColorModal;
window.insertColorSquare = insertColorSquare;
window.recentColors = recentColors;
window.initializeLightingConsole = initializeLightingConsole;