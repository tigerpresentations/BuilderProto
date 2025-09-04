// Main application initialization and module coordination

// Performance monitoring
let performanceMonitor = { 
    frameCount: 0, 
    lastTime: performance.now(), 
    averageFPS: 60,
    samples: []
};

// Device capability detection
function detectDeviceCapabilities(renderer) {
    // Use Three.js built-in capabilities if renderer is available
    if (!renderer) {
        console.warn('Renderer not available - using fallback capabilities');
        return {
            maxTextureSize: 512,
            maxAnisotropy: 1,
            canHandle1024: false,
            optimalQuality: 256,
            pixelRatio: 1
        };
    }
    
    const capabilities = renderer.capabilities;
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Use Three.js built-in capability detection
    const maxTextureSize = capabilities.maxTextureSize;
    const maxAnisotropy = renderer.getMaxAnisotropy();
    const precision = capabilities.precision;
    const maxAttributes = capabilities.maxAttributes;
    const maxVertexUniforms = capabilities.maxVertexUniforms;
    
    // Three.js informed quality assessment
    const hasHighPerformance = !isMobile && 
                              maxTextureSize >= 2048 && 
                              maxAnisotropy >= 4 && 
                              precision === 'highp';
    
    const canHandle1024 = hasHighPerformance && (navigator.hardwareConcurrency || 4) >= 4;
    
    // Use Three.js recommended pixel ratio clamping
    const optimalPixelRatio = Math.min(window.devicePixelRatio, 2);
    
    return {
        maxTextureSize,
        maxAnisotropy,
        precision,
        maxAttributes,
        maxVertexUniforms,
        canHandle1024,
        optimalQuality: canHandle1024 ? 1024 : (isMobile ? 256 : 512),
        pixelRatio: optimalPixelRatio,
        isMobile,
        renderer: capabilities
    };
}

function updatePerformanceMonitor() {
    performanceMonitor.frameCount++;
    const currentTime = performance.now();
    
    if (currentTime >= performanceMonitor.lastTime + 1000) {
        const fps = Math.round(
            (performanceMonitor.frameCount * 1000) / (currentTime - performanceMonitor.lastTime)
        );
        performanceMonitor.averageFPS = fps;
        performanceMonitor.frameCount = 0;
        performanceMonitor.lastTime = currentTime;
        
        // Update performance display with Three.js renderer info
        const performanceInfo = document.getElementById('performance-info');
        if (performanceInfo && window.renderer) {
            const info = window.renderer.info;
            performanceInfo.textContent = `Performance: ${fps} FPS | Calls: ${info.render.calls} | Triangles: ${info.render.triangles} (${window.currentQuality}x${window.currentQuality})`;
        }
        
        // Auto-fallback if severe performance issues
        if (fps < 30 && window.currentQuality > 512) {
            console.warn('Performance critical, reducing to 512x512');
            fallbackToLowerQuality(512);
        } else if (fps < 20 && window.currentQuality > 256) {
            console.warn('Performance critical, reducing to 256x256');
            fallbackToLowerQuality(256);
        }
    }
}

function fallbackToLowerQuality(newQuality) {
    if (newQuality >= window.currentQuality) return;
    
    console.log(`Auto-scaling from ${window.currentQuality}x${window.currentQuality} to ${newQuality}x${newQuality}`);
    
    // Update global quality setting
    window.currentQuality = newQuality;
    
    // Update canvas size and re-render layers
    const displayCanvas = document.getElementById('display-canvas');
    if (displayCanvas) {
        displayCanvas.width = newQuality;
        displayCanvas.height = newQuality;
        
        // Re-render layers at new quality
        if (window.layerManager) {
            window.layerManager.renderLayers();
        }
    }
    
    // Update all materials with new texture
    updateMaterialTextures();
}

// Apply canvas texture to materials
function updateMaterialTextures() {
    if (window.uvTextureEditor && window.imageMaterials) {
        const texture = window.uvTextureEditor.getTexture();
        window.imageMaterials.forEach(material => {
            material.map = texture;
            material.needsUpdate = true;
        });
    }
}

// Animation loop with performance monitoring and OptimizedSelectionSystem
function animateWithMonitoring() {
    requestAnimationFrame(animateWithMonitoring);
    if (window.controls) window.controls.update();
    
    // Use optimized selection system render if available, otherwise fallback to regular render
    if (window.optimizedSelectionSystem) {
        window.optimizedSelectionSystem.render();
    } else if (window.renderer && window.scene && window.camera) {
        window.renderer.render(window.scene, window.camera);
    }
    
    updatePerformanceMonitor();
}

// Drag and drop for image files only
function setupDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
    });
    
    document.addEventListener('drop', (e) => {
        // Handle image files only (GLB loading now via library)
        const files = Array.from(e.dataTransfer.files);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        imageFiles.forEach(file => {
            const img = new Image();
            img.onload = () => {
                if (window.layerManager) {
                    window.layerManager.addImage(img);
                }
                URL.revokeObjectURL(img.src);
            };
            img.src = URL.createObjectURL(file);
        });
    });
}

// Image-focused application initialization
function initializeApplication() {
    console.log('Initializing Image Texture Editor...');
    
    // 1. Initialize Three.js scene
    const scene = setupScene();
    const camera = setupCamera();
    const renderer = setupRenderer();
    
    // Make globally available for other modules
    window.scene = scene;
    window.camera = camera;
    window.renderer = renderer;
    window.controls = window.getControls(); // Get controls from scene-manager
    
    // 2. Initialize image layer management system
    const layerManager = new SimpleLayerManager();
    window.layerManager = layerManager;
    
    // 3. Get the display canvas (now 1024x1024)
    const displayCanvas = document.getElementById('display-canvas');
    if (!displayCanvas) {
        console.error('Display canvas not found');
        return;
    }
    
    // 4. Initialize interactive editor for drag/resize operations
    const interactiveEditor = new SimpleInteractiveEditor(displayCanvas, layerManager);
    window.interactiveEditor = interactiveEditor;
    
    // 5. Initialize UV texture editor for Three.js integration
    const uvTextureEditor = new UVTextureEditor();
    window.uvTextureEditor = uvTextureEditor;
    
    // 5b. Selection system and UI listeners will be initialized by SystemInitializer
    
    // 6. Detect device capabilities
    const capabilities = detectDeviceCapabilities(renderer);
    console.log('Device capabilities:', capabilities);
    
    // Apply optimizations based on capabilities
    renderer.setPixelRatio(capabilities.pixelRatio);
    
    // Target 1024x1024 but fallback if needed
    const targetQuality = capabilities.canHandle1024 ? 1024 : capabilities.optimalQuality;
    window.currentQuality = targetQuality;
    
    // Update canvas size if needed
    if (displayCanvas.width !== targetQuality) {
        displayCanvas.width = targetQuality;
        displayCanvas.height = targetQuality;
    }
    
    console.log(`Initialized with ${targetQuality}x${targetQuality} texture quality`);
    
    // 7. Setup UI event handlers
    setupImageToolEventHandlers();
    
    // Setup model control listeners if function exists
    if (typeof setupModelControlListeners === 'function') {
        setupModelControlListeners();
    }
    
    // 9b. Setup double-click camera centering
    if (typeof window.setupModelDoubleClickHandler === 'function') {
        window.setupModelDoubleClickHandler();
    }
    
    // Setup UI system if function exists
    if (typeof setupUISystem === 'function') {
        setupUISystem();
    }
    
    // 8. Setup drag and drop for both GLB and images
    setupDragAndDrop();
    
    // 9. Start animation loop
    animateWithMonitoring();
    
    // 10. Initialize UI controls
    if (typeof initializeControls === 'function') {
        initializeControls();
    }
    
    // 10.5. Initialize uploader, inspector, and model library (wait for auth system)
    setTimeout(() => {
        if (typeof setupUploaderAndInspector === 'function') {
            setupUploaderAndInspector();
        } else {
            console.warn('setupUploaderAndInspector function not available');
        }
        
        if (typeof setupModelLibrary === 'function') {
            setupModelLibrary();
        } else {
            console.warn('setupModelLibrary function not available');
        }
    }, 2000); // Wait longer for auth to fully initialize
    
    // 11. Initialize lighting console if available
    if (typeof initializeLightingConsole === 'function') {
        initializeLightingConsole();
    }
    
    // 12. Initialize shadow console if available
    if (typeof initializeShadowConsole === 'function') {
        initializeShadowConsole();
    }
    
    // 13. Initialize selection and transform systems using Promise-based approach
    if (window.systemInitializer) {
        console.log('🎬 Starting promise-based system initialization...');
        window.systemInitializer.initialize().then(() => {
            console.log('✅ All systems initialized successfully');
        }).catch(error => {
            console.error('❌ System initialization failed:', error);
        });
    } else {
        console.error('❌ SystemInitializer not found!');
    }
    
    // 15. Setup memory monitoring
    if (performance.memory) {
        setInterval(() => {
            const memUsed = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
            const memLimit = (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1);
            if (memUsed > memLimit * 0.85) {
                console.warn(`High memory usage: ${memUsed}MB / ${memLimit}MB`);
            }
        }, 10000);
    }
    
    console.log('Image Texture Editor initialized successfully!');
}

// Setup image tool event handlers
function setupImageToolEventHandlers() {
    // GLB file upload is now handled by uploader system
    
    // Image upload
    const imageUpload = document.getElementById('image-upload');
    if (imageUpload) {
        imageUpload.addEventListener('change', handleImageUpload);
    }
    
    // Layer controls
    const deleteSelected = document.getElementById('delete-selected');
    if (deleteSelected) {
        deleteSelected.addEventListener('click', () => {
            if (window.layerManager.selectedLayer) {
                window.layerManager.removeLayer(window.layerManager.selectedLayer.id);
            }
        });
    }
    
    const clearSelection = document.getElementById('clear-selection');
    if (clearSelection) {
        clearSelection.addEventListener('click', () => {
            window.layerManager.clearSelectionAndRenderClean();
        });
    }
    
    const clearAll = document.getElementById('clear-all');
    if (clearAll) {
        clearAll.addEventListener('click', () => {
            if (confirm('Clear all images?')) {
                window.layerManager.clearLayers();
            }
        });
    }
    
    const bringForward = document.getElementById('bring-forward');
    if (bringForward) {
        bringForward.addEventListener('click', () => {
            if (window.layerManager.selectedLayer) {
                window.layerManager.moveLayerUp(window.layerManager.selectedLayer.id);
            }
        });
    }
    
    const sendBackward = document.getElementById('send-backward');
    if (sendBackward) {
        sendBackward.addEventListener('click', () => {
            if (window.layerManager.selectedLayer) {
                window.layerManager.moveLayerDown(window.layerManager.selectedLayer.id);
            }
        });
    }
    
    // Quality selector
    const qualitySelector = document.getElementById('quality-selector');
    if (qualitySelector) {
        qualitySelector.addEventListener('change', (e) => {
            const newQuality = parseInt(e.target.value);
            setTextureQuality(newQuality);
        });
    }
}

// Handle multiple image uploads
function handleImageUpload(event) {
    const files = Array.from(event.target.files);
    
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const img = new Image();
            img.onload = () => {
                window.layerManager.addImage(img);
                URL.revokeObjectURL(img.src); // Clean up memory
            };
            img.src = URL.createObjectURL(file);
        }
    });
    
    // Reset file input
    event.target.value = '';
}

// Set texture quality
function setTextureQuality(quality) {
    if (quality === window.currentQuality) return;
    
    console.log(`Changing quality from ${window.currentQuality}x${window.currentQuality} to ${quality}x${quality}`);
    
    const displayCanvas = document.getElementById('display-canvas');
    if (displayCanvas) {
        displayCanvas.width = quality;
        displayCanvas.height = quality;
        
        window.currentQuality = quality;
        
        // Re-render layers at new quality
        if (window.layerManager) {
            window.layerManager.renderLayers();
        }
        
        // Update Three.js texture
        if (window.uvTextureEditor) {
            window.uvTextureEditor.updateTexture();
        }
        
        // Update quality info display
        const qualityInfo = document.getElementById('quality-info');
        if (qualityInfo) {
            qualityInfo.textContent = `Resolution: ${quality}x${quality}`;
        }
    }
}

// Canvas Quality Manager for Admin Panel
window.canvasQualityManager = {
    forceResolution: function(resolution) {
        setTextureQuality(resolution);
        // Store the forced mode
        this.autoMode = false;
        this.forcedResolution = resolution;
    },
    setAutoMode: function() {
        this.autoMode = true;
        this.forcedResolution = null;
        // Reset to optimal quality based on capabilities
        const capabilities = window.deviceCapabilities || { optimalQuality: 1024 };
        setTextureQuality(capabilities.optimalQuality);
    },
    autoMode: true,
    forcedResolution: null
};

// Simple UV Texture Editor for Three.js integration
class UVTextureEditor {
    constructor() {
        this.canvas = document.getElementById('display-canvas');
        if (!this.canvas) {
            console.error('Display canvas not found');
            return;
        }
        
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.flipY = false; // Important for GLB compatibility
        this.texture.wrapS = THREE.ClampToEdgeWrapping;
        this.texture.wrapT = THREE.ClampToEdgeWrapping;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        
        // Store reference globally
        window.canvasTexture = this.texture;
    }
    
    updateTexture() {
        if (this.texture) {
            this.texture.needsUpdate = true;
        }
    }
    
    getTexture() {
        return this.texture;
    }
}

// Load default model from library
async function loadDefaultLibraryModel() {
    try {
        console.log('🏠 Loading default model from library...');
        
        // Fetch models from library
        await window.libraryBrowser.library.fetchModels();
        
        // Find the TigerBrite 91x91 model
        const tigerbriteModel = window.libraryBrowser.library.models.find(model => 
            model.name && model.name.toLowerCase().includes('tigerbrite') && 
            model.name.toLowerCase().includes('91x91')
        );
        
        if (tigerbriteModel) {
            console.log('✅ Found TigerBrite 91x91 model, loading...', tigerbriteModel.name);
            
            // Set it as selected and load it
            window.libraryBrowser.selectedModelId = tigerbriteModel.id;
            await window.libraryBrowser.loadSelectedModel();
            
            console.log('✅ Default library model loaded successfully');
        } else {
            console.warn('⚠️ TigerBrite 91x91 model not found in library - library-only loading system');
        }
    } catch (error) {
        console.error('❌ Failed to load default library model:', error);
        // Library-only loading system - no fallback needed
        console.log('🏠 Library system error - no fallback GLB loading');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
    initializeApplication();
}