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
    
    // Floor controls
    const floorColor = document.getElementById('floor-color');
    if (floorColor && window.floor) {
        floorColor.addEventListener('input', (e) => {
            if (window.floor && window.floor.material) {
                window.floor.material.color.setHex(e.target.value.replace('#', '0x'));
            }
        });
    }
    
    const floorWidth = document.getElementById('floor-width');
    const floorDepth = document.getElementById('floor-depth');
    const floorWidthInput = document.getElementById('floor-width-input');
    const floorDepthInput = document.getElementById('floor-depth-input');
    
    const updateFloorGeometry = () => {
        if (window.floor && window.scene && window.feetToUnits) {
            const widthFeet = parseFloat(floorWidth.value);
            const depthFeet = parseFloat(floorDepth.value);
            const heightFeet = 0.1; // Fixed 1.2 inch thickness
            
            // Convert feet to Three.js units
            const width = window.feetToUnits(widthFeet);
            const depth = window.feetToUnits(depthFeet);
            const height = window.feetToUnits(heightFeet);
            
            // Sync input fields with sliders (only update if different to avoid cursor issues)
            if (floorWidthInput && parseFloat(floorWidthInput.value) !== widthFeet) {
                floorWidthInput.value = widthFeet.toFixed(1);
            }
            if (floorDepthInput && parseFloat(floorDepthInput.value) !== depthFeet) {
                floorDepthInput.value = depthFeet.toFixed(1);
            }
            
            // Dispose old geometry
            if (window.floor.geometry) {
                window.floor.geometry.dispose();
            }
            
            // Create new geometry
            window.floor.geometry = new THREE.BoxGeometry(width, height, depth);
            window.floor.position.y = -height / 2;
            
            console.log(`Floor updated to ${widthFeet} x ${depthFeet} feet`);
        }
    };
    
    const updateFloorFromInput = () => {
        if (window.floor && window.scene && window.feetToUnits) {
            let widthFeet = parseFloat(floorWidthInput.value) || 10;
            let depthFeet = parseFloat(floorDepthInput.value) || 10;
            const heightFeet = 0.1; // Fixed 1.2 inch thickness
            
            // Clamp values to realistic booth range (6-30 feet)
            widthFeet = Math.max(6, Math.min(30, widthFeet));
            depthFeet = Math.max(6, Math.min(30, depthFeet));
            
            // Convert to Three.js units
            const width = window.feetToUnits(widthFeet);
            const depth = window.feetToUnits(depthFeet);
            const height = window.feetToUnits(heightFeet);
            
            // Update sliders (only if different to avoid infinite loops)
            if (floorWidth && parseFloat(floorWidth.value) !== widthFeet) {
                floorWidth.value = widthFeet;
            }
            if (floorDepth && parseFloat(floorDepth.value) !== depthFeet) {
                floorDepth.value = depthFeet;
            }
            
            // Update input fields to clamped values
            floorWidthInput.value = widthFeet.toFixed(1);
            floorDepthInput.value = depthFeet.toFixed(1);
            
            // Dispose old geometry
            if (window.floor.geometry) {
                window.floor.geometry.dispose();
            }
            
            // Create new geometry
            window.floor.geometry = new THREE.BoxGeometry(width, height, depth);
            window.floor.position.y = -height / 2;
            
            console.log(`Floor updated to ${widthFeet} x ${depthFeet} feet`);
        }
    };
    
    // Add event listeners for sliders (immediate feedback while dragging)
    if (floorWidth) floorWidth.addEventListener('input', updateFloorGeometry);
    if (floorDepth) floorDepth.addEventListener('input', updateFloorGeometry);
    
    // Add event listeners for input fields (only on change/blur to avoid interference)
    if (floorWidthInput) {
        floorWidthInput.addEventListener('change', updateFloorFromInput);
        floorWidthInput.addEventListener('blur', updateFloorFromInput);
    }
    if (floorDepthInput) {
        floorDepthInput.addEventListener('change', updateFloorFromInput);
        floorDepthInput.addEventListener('blur', updateFloorFromInput);
    }
    
    // Floor preset buttons (dimensions in feet)
    const setFloorPreset = (widthFeet, depthFeet) => {
        if (window.floor && window.scene && window.feetToUnits) {
            const heightFeet = 0.1; // Fixed 1.2 inch thickness
            
            // Convert to Three.js units
            const width = window.feetToUnits(widthFeet);
            const depth = window.feetToUnits(depthFeet);
            const height = window.feetToUnits(heightFeet);
            
            // Update sliders
            if (floorWidth) floorWidth.value = widthFeet;
            if (floorDepth) floorDepth.value = depthFeet;
            
            // Update input fields
            if (floorWidthInput) floorWidthInput.value = widthFeet.toFixed(1);
            if (floorDepthInput) floorDepthInput.value = depthFeet.toFixed(1);
            
            // Dispose old geometry
            if (window.floor.geometry) {
                window.floor.geometry.dispose();
            }
            
            // Create new geometry
            window.floor.geometry = new THREE.BoxGeometry(width, height, depth);
            window.floor.position.y = -height / 2;
            
            console.log(`Floor preset set to ${widthFeet} x ${depthFeet} feet`);
        }
    };
    
    // Add event listeners for preset buttons
    const floorPreset3x3 = document.getElementById('floor-preset-3x3');
    const floorPreset3x6 = document.getElementById('floor-preset-3x6');
    const floorPreset6x6 = document.getElementById('floor-preset-6x6');
    
    if (floorPreset3x3) {
        floorPreset3x3.addEventListener('click', () => setFloorPreset(10, 10)); // Standard 10x10 booth
    }
    if (floorPreset3x6) {
        floorPreset3x6.addEventListener('click', () => setFloorPreset(20, 10)); // 10ft D x 20ft W
    }
    if (floorPreset6x6) {
        floorPreset6x6.addEventListener('click', () => setFloorPreset(20, 20)); // 20x20 booth
    }
    
    // Grid toggle control
    const gridToggle = document.getElementById('grid-toggle');
    if (gridToggle) {
        gridToggle.addEventListener('change', (e) => {
            if (window.gridHelper) {
                window.gridHelper.visible = e.target.checked;
            }
        });
    }
    
    // Camera toggle control
    const cameraToggle = document.getElementById('camera-toggle');
    if (cameraToggle) {
        cameraToggle.addEventListener('click', () => {
            console.log('🔘 Camera toggle button clicked');
            console.log('📋 Available functions:', {
                toggleCameraMode: !!window.toggleCameraMode,
                camera: !!window.camera,
                perspectiveCamera: !!window.perspectiveCamera,
                orthographicCamera: !!window.orthographicCamera
            });
            
            if (window.toggleCameraMode) {
                console.log('🔄 Calling toggleCameraMode()');
                window.toggleCameraMode();
                
                // Update button text to reflect current camera mode
                if (window.camera && window.camera.isPerspectiveCamera) {
                    cameraToggle.textContent = '📷 Perspective View';
                } else {
                    cameraToggle.textContent = '📐 Orthographic View';
                }
            } else {
                console.log('❌ toggleCameraMode function not available');
            }
        });
    } else {
        console.log('❌ Camera toggle button not found');
    }
    
    // Material controls
    const materialBrightness = document.getElementById('material-brightness');
    const lightingIntensity = document.getElementById('lighting-intensity');
    const materialBrightnessInput = document.getElementById('material-brightness-input');
    const lightingIntensityInput = document.getElementById('lighting-intensity-input');
    
    const updateMaterialProperties = () => {
        if (window.currentModel) {
            const brightness = parseFloat(materialBrightness?.value || 1);
            
            // Sync input field with slider
            if (materialBrightnessInput && parseFloat(materialBrightnessInput.value) !== brightness) {
                materialBrightnessInput.value = brightness.toFixed(2);
            }
            
            // Apply to all materials with "Image" in their name
            window.currentModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        if (mat.name && mat.name.toLowerCase().includes('image')) {
                            // Apply brightness by scaling the material color
                            if (!mat.color) {
                                mat.color = new THREE.Color(1, 1, 1);
                            }
                            mat.color.setScalar(brightness);
                            mat.needsUpdate = true;
                        }
                    });
                }
            });
        }
    };
    
    // Lighting intensity control
    const updateLightingIntensity = () => {
        const intensity = parseFloat(lightingIntensity?.value || 1);
        
        // Sync input field with slider
        if (lightingIntensityInput && parseFloat(lightingIntensityInput.value) !== intensity) {
            lightingIntensityInput.value = intensity.toFixed(2);
        }
        
        // Update all lights in the scene based on the lighting config
        if (window.lightingConfig && window.updateLighting) {
            // Store the base intensities if not already stored
            if (!window.baseLightIntensities) {
                window.baseLightIntensities = {
                    hemisphere: window.lightingConfig.hemisphere.intensity,
                    mainLight: window.lightingConfig.mainLight.intensity,
                    fillLight: window.lightingConfig.fillLight.intensity
                };
            }
            
            // Apply the multiplier
            window.lightingConfig.hemisphere.intensity = window.baseLightIntensities.hemisphere * intensity;
            window.lightingConfig.mainLight.intensity = window.baseLightIntensities.mainLight * intensity;
            window.lightingConfig.fillLight.intensity = window.baseLightIntensities.fillLight * intensity;
            
            // Update the actual lights
            window.updateLighting();
        }
    };
    
    // Input field handlers
    const updateMaterialPropertiesFromInput = () => {
        if (window.currentModel) {
            let brightness = parseFloat(materialBrightnessInput.value) || 1;
            brightness = Math.max(0, Math.min(3, brightness));
            
            if (materialBrightness && parseFloat(materialBrightness.value) !== brightness) {
                materialBrightness.value = brightness;
            }
            
            materialBrightnessInput.value = brightness.toFixed(2);
            
            // Apply to materials
            window.currentModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(mat => {
                        if (mat.name && mat.name.toLowerCase().includes('image')) {
                            if (!mat.color) {
                                mat.color = new THREE.Color(1, 1, 1);
                            }
                            mat.color.setScalar(brightness);
                            mat.needsUpdate = true;
                        }
                    });
                }
            });
        }
    };
    
    const updateLightingIntensityFromInput = () => {
        let intensity = parseFloat(lightingIntensityInput.value) || 1;
        intensity = Math.max(0, Math.min(3, intensity));
        
        if (lightingIntensity && parseFloat(lightingIntensity.value) !== intensity) {
            lightingIntensity.value = intensity;
        }
        
        lightingIntensityInput.value = intensity.toFixed(2);
        
        // Update lighting
        if (window.lightingConfig && window.updateLighting) {
            if (!window.baseLightIntensities) {
                window.baseLightIntensities = {
                    hemisphere: window.lightingConfig.hemisphere.intensity,
                    mainLight: window.lightingConfig.mainLight.intensity,
                    fillLight: window.lightingConfig.fillLight.intensity
                };
            }
            
            window.lightingConfig.hemisphere.intensity = window.baseLightIntensities.hemisphere * intensity;
            window.lightingConfig.mainLight.intensity = window.baseLightIntensities.mainLight * intensity;
            window.lightingConfig.fillLight.intensity = window.baseLightIntensities.fillLight * intensity;
            
            window.updateLighting();
        }
    };
    
    // Unlit mode toggle
    
    // Add event listeners for sliders
    if (materialBrightness) materialBrightness.addEventListener('input', updateMaterialProperties);
    if (lightingIntensity) lightingIntensity.addEventListener('input', updateLightingIntensity);
    
    // Add event listeners for input fields
    if (materialBrightnessInput) {
        materialBrightnessInput.addEventListener('change', updateMaterialPropertiesFromInput);
        materialBrightnessInput.addEventListener('blur', updateMaterialPropertiesFromInput);
    }
    if (lightingIntensityInput) {
        lightingIntensityInput.addEventListener('change', updateLightingIntensityFromInput);
        lightingIntensityInput.addEventListener('blur', updateLightingIntensityFromInput);
    }
    
    // Expose function to apply current settings when a model is loaded
    window.applyCurrentMaterialSettings = () => {
        updateMaterialProperties();
        updateLightingIntensity();
    };
    
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
    
    // Shadow dev console button
    const shadowDevBtn = document.getElementById('shadow-dev-btn');
    if (shadowDevBtn) {
        shadowDevBtn.addEventListener('click', () => {
            if (window.shadowConsole) {
                window.shadowConsole.toggle();
            }
        });
    }
    
    // Admin quality override
    const adminQualityOverride = document.getElementById('admin-quality-override');
    if (adminQualityOverride) {
        adminQualityOverride.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value !== 'auto' && window.canvasQualityManager) {
                const resolution = parseInt(value);
                window.canvasQualityManager.forceResolution(resolution);
                showNotification(`Canvas resolution forced to ${resolution}x${resolution}`, 'info', 3000);
            } else if (value === 'auto' && window.canvasQualityManager) {
                window.canvasQualityManager.setAutoMode();
                showNotification('Canvas resolution set to auto', 'info', 3000);
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

// Shadow Dev Console Class
class ShadowDevConsole {
    constructor() {
        this.isVisible = false;
        this.createPanel();
        this.initializeControls();
    }
    
    createPanel() {
        const panel = document.createElement('div');
        panel.id = 'shadow-dev-console';
        panel.style.cssText = `
            position: fixed; top: 20px; right: 20px; width: 320px; z-index: 1002;
            background: rgba(40, 40, 40, 0.95); border: 1px solid #666;
            border-radius: 8px; padding: 15px; font-family: monospace;
            color: #fff; font-size: 12px; display: none;
            max-height: 80vh; overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;
        
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #555; padding-bottom: 10px;">
                <h3 style="margin: 0; color: #9C27B0;">Shadow Dev Console</h3>
                <button onclick="window.shadowConsole.hide()" style="background: #666; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer;">×</button>
            </div>
            
            <!-- Shadow Map Settings -->
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #E91E63;">Shadow Map</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <label>Size: <select id="shadowMapSize" style="width: 80px; margin-left: 5px;">
                        <option value="512">512</option>
                        <option value="1024">1024</option>
                        <option value="2048" selected>2048</option>
                        <option value="4096">4096</option>
                    </select></label>
                    <label>Type: <select id="shadowMapType" style="width: 80px; margin-left: 5px;">
                        <option value="basic">Basic</option>
                        <option value="pcf">PCF</option>
                        <option value="pcfsoft" selected>PCF Soft</option>
                    </select></label>
                    <label>Enabled: <input type="checkbox" id="shadowsEnabled" checked style="margin-left: 5px;"></label>
                    <label>Auto Update: <input type="checkbox" id="shadowAutoUpdate" checked style="margin-left: 5px;"></label>
                </div>
            </div>
            
            <!-- Shadow Camera -->
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #673AB7;">Shadow Camera</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <label>Size: <input type="range" id="shadowCameraSize" min="1" max="15" step="0.5" value="5" style="width: 80px;"> <span id="shadowCameraSizeValue">5</span></label>
                    <label>Near: <input type="range" id="shadowCameraNear" min="0.01" max="1" step="0.01" value="0.1" style="width: 80px;"> <span id="shadowCameraNearValue">0.1</span></label>
                    <label>Far: <input type="range" id="shadowCameraFar" min="10" max="100" step="5" value="50" style="width: 80px;"> <span id="shadowCameraFarValue">50</span></label>
                </div>
            </div>
            
            <!-- Shadow Quality -->
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #3F51B5;">Shadow Quality</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <label>Bias: <input type="range" id="shadowBiasControl" min="-0.01" max="0.01" step="0.0001" value="-0.0005" style="width: 80px;"> <span id="shadowBiasValue">-0.0005</span></label>
                    <label>Normal Bias: <input type="range" id="shadowNormalBias" min="0" max="0.1" step="0.005" value="0.02" style="width: 80px;"> <span id="shadowNormalBiasValue">0.02</span></label>
                    <label>Radius: <input type="range" id="shadowRadius" min="1" max="25" step="0.5" value="1" style="width: 80px;"> <span id="shadowRadiusValue">1</span></label>
                    <label>Blur Scale: <input type="range" id="shadowBlurScale" min="0.1" max="5" step="0.1" value="1" style="width: 80px;"> <span id="shadowBlurScaleValue">1</span></label>
                    <label>Penumbra: <input type="range" id="shadowPenumbra" min="0" max="1" step="0.05" value="0" style="width: 80px;"> <span id="shadowPenumbraValue">0</span></label>
                </div>
            </div>
            
            <!-- Light Shadow Settings -->
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #FF9800;">Light Settings</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <label>Main Casts Shadow: <input type="checkbox" id="mainLightCastShadow" checked style="margin-left: 5px;"></label>
                    <label>Fill Casts Shadow: <input type="checkbox" id="fillLightCastShadow" style="margin-left: 5px;"></label>
                </div>
            </div>
            
            <!-- Preset Buttons -->
            <div style="margin-top: 15px; border-top: 1px solid #555; padding-top: 10px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button onclick="window.shadowConsole.loadPreset('sharp')" style="background: #F44336; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">Sharp</button>
                    <button onclick="window.shadowConsole.loadPreset('soft')" style="background: #4CAF50; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">Soft</button>
                    <button onclick="window.shadowConsole.loadPreset('ultrasoft')" style="background: #9C27B0; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">Ultra-Soft</button>
                    <button onclick="window.shadowConsole.loadPreset('performance')" style="background: #FF9800; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">Performance</button>
                    <button onclick="window.shadowConsole.loadPreset('quality')" style="background: #2196F3; border: none; color: white; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 10px;">Quality</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.panel = panel;
    }
    
    initializeControls() {
        const controls = [
            'shadowMapSize', 'shadowMapType', 'shadowsEnabled', 'shadowAutoUpdate',
            'shadowCameraSize', 'shadowCameraNear', 'shadowCameraFar',
            'shadowBiasControl', 'shadowNormalBias', 'shadowRadius', 'shadowBlurScale', 'shadowPenumbra',
            'mainLightCastShadow', 'fillLightCastShadow'
        ];
        
        controls.forEach(id => {
            const element = this.panel.querySelector(`#${id}`);
            if (element) {
                element.addEventListener('input', () => {
                    this.updateShadowsFromControls();
                    this.updateValueDisplays();
                });
                element.addEventListener('change', () => {
                    this.updateShadowsFromControls();
                    this.updateValueDisplays();
                });
            }
        });
        
        this.updateValueDisplays();
    }
    
    updateValueDisplays() {
        const updates = [
            ['shadowCameraSize', 'shadowCameraSizeValue'],
            ['shadowCameraNear', 'shadowCameraNearValue'],
            ['shadowCameraFar', 'shadowCameraFarValue'],
            ['shadowBiasControl', 'shadowBiasValue'],
            ['shadowNormalBias', 'shadowNormalBiasValue'],
            ['shadowRadius', 'shadowRadiusValue'],
            ['shadowBlurScale', 'shadowBlurScaleValue'],
            ['shadowPenumbra', 'shadowPenumbraValue']
        ];
        
        updates.forEach(([inputId, displayId]) => {
            const input = this.panel.querySelector(`#${inputId}`);
            const display = this.panel.querySelector(`#${displayId}`);
            if (input && display) {
                display.textContent = input.value;
            }
        });
    }
    
    updateShadowsFromControls() {
        if (!window.lightingConfig || !window.renderer) return;
        
        const config = window.lightingConfig;
        const renderer = window.renderer;
        
        // Update shadow map settings
        const shadowMapSize = parseInt(this.panel.querySelector('#shadowMapSize').value);
        const shadowMapType = this.panel.querySelector('#shadowMapType').value;
        const shadowsEnabled = this.panel.querySelector('#shadowsEnabled').checked;
        const shadowAutoUpdate = this.panel.querySelector('#shadowAutoUpdate').checked;
        
        renderer.shadowMap.enabled = shadowsEnabled;
        renderer.shadowMap.autoUpdate = shadowAutoUpdate;
        
        // Set shadow map type
        const shadowTypes = {
            'basic': THREE.BasicShadowMap,
            'pcf': THREE.PCFShadowMap,
            'pcfsoft': THREE.PCFSoftShadowMap
        };
        if (shadowTypes[shadowMapType]) {
            renderer.shadowMap.type = shadowTypes[shadowMapType];
        }
        
        // Update shadow config
        config.shadows.mapSize = shadowMapSize;
        config.shadows.cameraSize = parseFloat(this.panel.querySelector('#shadowCameraSize').value);
        config.shadows.bias = parseFloat(this.panel.querySelector('#shadowBiasControl').value);
        config.shadows.normalBias = parseFloat(this.panel.querySelector('#shadowNormalBias').value);
        config.shadows.radius = parseFloat(this.panel.querySelector('#shadowRadius').value);
        config.shadows.blurScale = parseFloat(this.panel.querySelector('#shadowBlurScale').value);
        config.shadows.penumbra = parseFloat(this.panel.querySelector('#shadowPenumbra').value);
        
        // Update light shadow casting
        config.mainLight.castShadow = this.panel.querySelector('#mainLightCastShadow').checked;
        config.fillLight.castShadow = this.panel.querySelector('#fillLightCastShadow').checked;
        
        // Apply blur settings directly to lights
        if (window.mainLight && window.mainLight.shadow) {
            window.mainLight.shadow.radius = config.shadows.radius * config.shadows.blurScale;
            window.mainLight.penumbra = config.shadows.penumbra;
        }
        if (window.fillLight && window.fillLight.shadow) {
            window.fillLight.shadow.radius = config.shadows.radius * config.shadows.blurScale;
            window.fillLight.penumbra = config.shadows.penumbra;
        }
        
        // Apply changes to Three.js scene
        if (window.updateLighting) {
            window.updateLighting();
        }
        
        // Force shadow map update
        renderer.shadowMap.needsUpdate = true;
    }
    
    loadPreset(presetName) {
        const presets = {
            sharp: {
                mapSize: 2048,
                type: 'basic',
                enabled: true,
                autoUpdate: true,
                cameraSize: 4,
                cameraNear: 0.1,
                cameraFar: 40,
                bias: -0.0001,
                normalBias: 0.01,
                radius: 1,
                blurScale: 0.5,
                penumbra: 0,
                mainCastShadow: true,
                fillCastShadow: false
            },
            soft: {
                mapSize: 2048,
                type: 'pcfsoft',
                enabled: true,
                autoUpdate: true,
                cameraSize: 8,
                cameraNear: 0.1,
                cameraFar: 60,
                bias: -0.001,
                normalBias: 0.04,
                radius: 15,
                blurScale: 3,
                penumbra: 0.8,
                mainCastShadow: true,
                fillCastShadow: true
            },
            performance: {
                mapSize: 1024,
                type: 'pcf',
                enabled: true,
                autoUpdate: false,
                cameraSize: 5,
                cameraNear: 0.2,
                cameraFar: 30,
                bias: -0.0005,
                normalBias: 0.02,
                radius: 1,
                blurScale: 1,
                penumbra: 0,
                mainCastShadow: true,
                fillCastShadow: false
            },
            quality: {
                mapSize: 4096,
                type: 'pcfsoft',
                enabled: true,
                autoUpdate: true,
                cameraSize: 8,
                cameraNear: 0.05,
                cameraFar: 80,
                bias: -0.0002,
                normalBias: 0.015,
                radius: 5,
                blurScale: 2,
                penumbra: 0.4,
                mainCastShadow: true,
                fillCastShadow: true
            },
            ultrasoft: {
                mapSize: 2048,
                type: 'pcfsoft',
                enabled: true,
                autoUpdate: true,
                cameraSize: 12,
                cameraNear: 0.1,
                cameraFar: 70,
                bias: -0.002,
                normalBias: 0.05,
                radius: 25,
                blurScale: 5,
                penumbra: 1,
                mainCastShadow: true,
                fillCastShadow: true
            }
        };
        
        const preset = presets[presetName];
        if (!preset) return;
        
        // Update controls
        this.panel.querySelector('#shadowMapSize').value = preset.mapSize;
        this.panel.querySelector('#shadowMapType').value = preset.type;
        this.panel.querySelector('#shadowsEnabled').checked = preset.enabled;
        this.panel.querySelector('#shadowAutoUpdate').checked = preset.autoUpdate;
        this.panel.querySelector('#shadowCameraSize').value = preset.cameraSize;
        this.panel.querySelector('#shadowCameraNear').value = preset.cameraNear;
        this.panel.querySelector('#shadowCameraFar').value = preset.cameraFar;
        this.panel.querySelector('#shadowBiasControl').value = preset.bias;
        this.panel.querySelector('#shadowNormalBias').value = preset.normalBias;
        this.panel.querySelector('#shadowRadius').value = preset.radius;
        this.panel.querySelector('#shadowBlurScale').value = preset.blurScale;
        this.panel.querySelector('#shadowPenumbra').value = preset.penumbra;
        this.panel.querySelector('#mainLightCastShadow').checked = preset.mainCastShadow;
        this.panel.querySelector('#fillLightCastShadow').checked = preset.fillCastShadow;
        
        this.updateValueDisplays();
        this.updateShadowsFromControls();
    }
    
    updateControlsFromConfig() {
        const config = window.lightingConfig;
        if (!config) return;
        
        this.panel.querySelector('#shadowMapSize').value = config.shadows.mapSize;
        this.panel.querySelector('#shadowCameraSize').value = config.shadows.cameraSize;
        this.panel.querySelector('#shadowBiasControl').value = config.shadows.bias;
        this.panel.querySelector('#shadowNormalBias').value = config.shadows.normalBias;
        this.panel.querySelector('#mainLightCastShadow').checked = config.mainLight.castShadow;
        this.panel.querySelector('#fillLightCastShadow').checked = config.fillLight.castShadow;
        
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

// Initialize shadow console and add keyboard shortcut
function initializeShadowConsole() {
    window.shadowConsole = new ShadowDevConsole();
    
    // Add keyboard shortcut (Alt+S)
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 's' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            window.shadowConsole.toggle();
        }
    });
    
    console.log('Shadow Dev Console initialized. Press Alt+S to open.');
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

// Model Uploader and Inspector Integration
function setupUploaderAndInspector() {
    // Check if we have all required components
    if (!window.authManager || !window.authManager.supabase) {
        console.warn('Auth manager or Supabase client not available. Retrying in 2 seconds...');
        setTimeout(setupUploaderAndInspector, 2000);
        return;
    }
    
    if (!window.InspectorWorkflow) {
        console.warn('InspectorWorkflow class not available. Retrying in 1 second...');
        setTimeout(setupUploaderAndInspector, 1000);
        return;
    }

    console.log('✅ Initializing uploader and inspector system...');
    
    // Initialize uploader workflow
    let uploaderWorkflow;
    try {
        uploaderWorkflow = new window.InspectorWorkflow(window.authManager.supabase);
        window.uploaderWorkflow = uploaderWorkflow; // Make globally available for debugging
        
        console.log('✅ Uploader workflow created successfully');
    } catch (error) {
        console.error('❌ Failed to create uploader workflow:', error);
        return;
    }
    
    // GLB Upload Input Handler
    const glbUploadInput = document.getElementById('glb-upload-input');
    if (glbUploadInput) {
        glbUploadInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file || !file.name.toLowerCase().endsWith('.glb')) {
                showNotification('Please select a valid GLB file', 'error');
                return;
            }

            // Check admin access
            if (!window.authManager.isAdmin()) {
                showNotification('Admin access required for model uploads', 'error');
                return;
            }

            try {
                // Show progress
                const progressElement = document.getElementById('upload-progress');
                if (progressElement) {
                    progressElement.style.display = 'block';
                    progressElement.textContent = 'Uploading file...';
                }


                // Handle upload and launch inspector
                await uploaderWorkflow.handleFileUpload(file);

                // Hide progress
                if (progressElement) {
                    progressElement.style.display = 'none';
                }

            } catch (error) {
                console.error('Upload failed:', error);
                const progressElement = document.getElementById('upload-progress');
                if (progressElement) {
                    progressElement.style.display = 'none';
                }
                showNotification('Upload failed: ' + error.message, 'error');
            }

            // Reset file input
            event.target.value = '';
        });
    }

    // Inspector Event Handlers
    setupInspectorEventHandlers(uploaderWorkflow);
}

function setupInspectorEventHandlers(uploaderWorkflow) {
    // Preview Scale Button
    const previewButton = document.getElementById('inspector-preview-scale');
    if (previewButton) {
        previewButton.addEventListener('click', () => {
            const workflow = uploaderWorkflow || window.uploaderWorkflow;
            
            if (workflow && workflow.previewScale) {
                workflow.previewScale();
            } else {
                console.error('previewScale method not available');
                showNotification('Error: Inspector not properly initialized', 'error');
            }
        });
    }

    // Reset Scale Button
    const resetButton = document.getElementById('inspector-reset-scale');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            const workflow = uploaderWorkflow || window.uploaderWorkflow;
            if (workflow && workflow.resetScale) {
                workflow.resetScale();
            } else {
                console.error('resetScale method not available');
                showNotification('Error: Inspector not properly initialized', 'error');
            }
        });
    }

    // Save to Database Button
    const saveButton = document.getElementById('inspector-save-database');
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            const workflow = uploaderWorkflow || window.uploaderWorkflow;
            if (workflow && workflow.saveToDatabase) {
                try {
                    await workflow.saveToDatabase();
                } catch (error) {
                    console.error('Save failed:', error);
                }
            } else {
                console.error('saveToDatabase method not available');
                showNotification('Error: Inspector not properly initialized', 'error');
            }
        });
    }

    // Close Inspector Button
    const closeButton = document.getElementById('inspector-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            const workflow = uploaderWorkflow || window.uploaderWorkflow;
            if (workflow && workflow.hideInspectorPanel) {
                workflow.hideInspectorPanel();
            }
        });
    }

    // Reference Objects Toggle
    const referenceToggle = document.getElementById('inspector-show-reference');
    if (referenceToggle) {
        referenceToggle.addEventListener('change', (e) => {
            const workflow = uploaderWorkflow || window.uploaderWorkflow;
            if (workflow && workflow.toggleReference) {
                workflow.toggleReference(e.target.checked);
            }
        });
    }

    // Bounding Box Toggle
    const boundsToggle = document.getElementById('inspector-show-bounds');
    if (boundsToggle) {
        boundsToggle.addEventListener('change', (e) => {
            const workflow = uploaderWorkflow || window.uploaderWorkflow;
            if (workflow && workflow.visualizer && workflow.currentModel) {
                if (e.target.checked) {
                    workflow.visualizer.showBoundingBox(workflow.currentModel);
                } else if (workflow.visualizer.currentBoundingBox) {
                    workflow.visualizer.referenceObjects.remove(workflow.visualizer.currentBoundingBox);
                    workflow.visualizer.currentBoundingBox = null;
                }
            }
        });
    }

    // Real-time scale preview on input changes
    const realValueInput = document.getElementById('inspector-real-value');
    const dimensionSelect = document.getElementById('inspector-dimension-type');
    const unitsSelect = document.getElementById('inspector-units');

    const updateScaleFactor = () => {
        const workflow = uploaderWorkflow || window.uploaderWorkflow;
        if (!workflow || !workflow.inspector) return;
        
        const realValue = parseFloat(realValueInput.value);
        const dimension = dimensionSelect.value;
        const units = unitsSelect.value;
        
        if (realValue > 0) {
            const currentDimension = workflow.inspector.measurements[dimension];
            const scaleFactor = window.ScaleCalculator.calculateScaleFactor(currentDimension, realValue, units);
            
            document.getElementById('inspector-scale-factor').textContent = scaleFactor.toFixed(3);
            
            // Validation
            const validation = window.ScaleCalculator.validateScaleFactor(scaleFactor);
            const messageElement = document.getElementById('inspector-validation-message');
            if (!validation.isValid) {
                messageElement.textContent = 'Scale factor out of range (0.001 - 1000)';
                messageElement.style.color = '#ff6b6b';
            } else if (validation.warning) {
                messageElement.textContent = validation.warning;
                messageElement.style.color = '#ffa500';
            } else {
                messageElement.textContent = '';
            }
        }
    };

    if (realValueInput) realValueInput.addEventListener('input', updateScaleFactor);
    if (dimensionSelect) dimensionSelect.addEventListener('change', updateScaleFactor);
    if (unitsSelect) unitsSelect.addEventListener('change', updateScaleFactor);
    
    // Texture Instance Management buttons
    const copyTextureBtn = document.getElementById('copy-texture-btn');
    if (copyTextureBtn) {
        copyTextureBtn.addEventListener('click', () => {
            if (window.textureInstanceManager) {
                const activeTexture = window.textureInstanceManager.getActiveTexture();
                if (!activeTexture) {
                    showNotification('No texture selected to copy', 'error');
                    return;
                }
                
                // Get all model instances except the active one
                const allInstances = window.textureInstanceManager.getAllInstances();
                const otherInstances = allInstances.filter(inst => inst.instanceId !== activeTexture.instanceId);
                
                if (otherInstances.length === 0) {
                    showNotification('No other models to copy texture to', 'info');
                    return;
                }
                
                // For now, copy to all other models (could be enhanced with a selection UI)
                let copiedCount = 0;
                otherInstances.forEach(targetInstance => {
                    if (window.textureInstanceManager.copyTexture(activeTexture.instanceId, targetInstance.instanceId)) {
                        copiedCount++;
                    }
                });
                
                if (copiedCount > 0) {
                    showNotification(`Copied texture to ${copiedCount} model${copiedCount !== 1 ? 's' : ''}`, 'success');
                } else {
                    showNotification('Failed to copy texture', 'error');
                }
            }
        });
    }
    
    const clearTextureBtn = document.getElementById('clear-texture-btn');
    if (clearTextureBtn) {
        clearTextureBtn.addEventListener('click', () => {
            if (window.textureInstanceManager) {
                const activeTexture = window.textureInstanceManager.getActiveTexture();
                if (!activeTexture) {
                    showNotification('No texture selected to clear', 'error');
                    return;
                }
                
                // Clear the layer manager for this texture
                if (activeTexture.layerManager) {
                    activeTexture.layerManager.clearLayers();
                    showNotification(`Cleared texture for ${activeTexture.modelName}`, 'success');
                }
            }
        });
    }
}

// Export functions
window.setupUISystem = setupUISystem;
window.initializeControls = initializeControls;
window.showColorSquareDialog = showColorSquareDialog;
window.closeColorModal = closeColorModal;
window.insertColorSquare = insertColorSquare;
window.recentColors = recentColors;
window.initializeLightingConsole = initializeLightingConsole;
window.initializeShadowConsole = initializeShadowConsole;
window.setupUploaderAndInspector = setupUploaderAndInspector;
window.showNotification = showNotification;