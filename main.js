// Main application initialization and module coordination

// Performance monitoring
let performanceMonitor = { 
    frameCount: 0, 
    lastTime: performance.now(), 
    averageFPS: 60,
    samples: []
};

// Device capability detection
function detectDeviceCapabilities() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
        console.warn('WebGL not available - falling back to minimal settings');
        return { 
            maxTextureSize: 512, 
            isMobile: true, 
            hardwareConcurrency: 1,
            estimatedVRAM: 128,
            renderer: 'Unknown',
            canHandle1024: false,
            optimalQuality: 256 
        };
    }
    
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const renderer_info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = renderer_info ? gl.getParameter(renderer_info.UNMASKED_RENDERER_WEBGL) : 'Unknown';
    const vendor = renderer_info ? gl.getParameter(renderer_info.UNMASKED_VENDOR_WEBGL) : 'Unknown';
    
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    
    // Estimate VRAM (very rough)
    let estimatedVRAM = 512; // Default assumption
    if (isMobile) {
        estimatedVRAM = 256;
    } else if (renderer.toLowerCase().includes('nvidia') || renderer.toLowerCase().includes('amd')) {
        estimatedVRAM = 2048;
    }
    
    const canHandle1024 = !isMobile && maxTextureSize >= 2048 && estimatedVRAM >= 1024 && hardwareConcurrency >= 4;
    
    return {
        maxTextureSize,
        isMobile,
        hardwareConcurrency,
        estimatedVRAM,
        renderer: renderer_info,
        canHandle1024,
        optimalQuality: canHandle1024 ? 1024 : (isMobile ? 256 : 512)
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
        
        // Update performance display
        const performanceInfo = document.getElementById('performance-info');
        if (performanceInfo) {
            performanceInfo.textContent = `Performance: ${fps} FPS (${window.currentQuality}x${window.currentQuality})`;
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
    
    const previousImageData = window.textureCtx.getImageData(0, 0, window.currentQuality, window.currentQuality);
    initializeCanvas(newQuality);
    
    // Scale and preserve content
    if (previousImageData) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = previousImageData.width;
        tempCanvas.height = previousImageData.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(previousImageData, 0, 0);
        
        window.textureCtx.drawImage(tempCanvas, 0, 0, window.currentQuality, window.currentQuality);
    }
    
    createCanvasTexture();
    
    // Update all materials
    if (window.imageMaterials) {
        window.imageMaterials.forEach(material => {
            material.map = window.canvasTexture;
            material.needsUpdate = true;
        });
    }
}

function createCanvasTexture() {
    if (window.canvasTexture) window.canvasTexture.dispose();
    window.canvasTexture = new THREE.CanvasTexture(window.textureCanvas);
    
    // Aggressive optimization for high-resolution
    window.canvasTexture.format = THREE.RGBFormat; // Save 25% memory
    window.canvasTexture.flipY = false;
    window.canvasTexture.magFilter = THREE.LinearFilter;
    window.canvasTexture.minFilter = THREE.LinearFilter;
    window.canvasTexture.generateMipmaps = false; // Critical performance save
    window.canvasTexture.wrapS = THREE.ClampToEdgeWrapping;
    window.canvasTexture.wrapT = THREE.ClampToEdgeWrapping;
    window.canvasTexture.unpackAlignment = 1;
    window.canvasTexture.needsUpdate = true;
    
    // Apply to existing materials
    if (window.imageMaterials) {
        window.imageMaterials.forEach(material => {
            material.map = window.canvasTexture;
            material.needsUpdate = true;
        });
    }
    
    return window.canvasTexture;
}

// Animation loop with performance monitoring
function animateWithMonitoring() {
    requestAnimationFrame(animateWithMonitoring);
    if (window.controls) window.controls.update();
    if (window.renderer && window.scene && window.camera) {
        window.renderer.render(window.scene, window.camera);
    }
    updatePerformanceMonitor();
}

// Drag and drop GLB loading
function setupDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
    });
    
    document.addEventListener('dragenter', () => dropZone.classList.add('dragging'));
    document.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
    
    document.addEventListener('drop', (e) => {
        dropZone.classList.remove('dragging');
        const file = e.dataTransfer.files[0];
        if (file && file.name.toLowerCase().endsWith('.glb')) {
            dropZone.classList.add('hidden');
            if (window.loadGLBFile && window.scene) {
                window.loadGLBFile(file, window.scene);
            }
        }
    });
}

// Main initialization function
function initializeApplication() {
    console.log('Initializing 3D Texture Editor...');
    
    // 1. Initialize Three.js scene
    const scene = setupScene();
    const camera = setupCamera();
    const renderer = setupRenderer();
    
    // Make globally available for other modules
    window.scene = scene;
    window.camera = camera;
    window.renderer = renderer;
    window.controls = controls; // Available from scene-manager
    
    // 2. Setup canvases and drawing system
    const { displayCanvas, textureCanvas, displayCtx, textureCtx } = setupCanvases();
    
    // 3. Initialize layer management
    const layerManager = new LayerManager();
    window.layerManager = layerManager;
    
    // 4. Detect device capabilities and optimize settings
    const capabilities = detectDeviceCapabilities();
    console.log('Device capabilities:', capabilities);
    
    // Target 1024x1024 but fallback if needed
    const targetQuality = capabilities.canHandle1024 ? 1024 : capabilities.optimalQuality;
    console.log(`Initializing with ${targetQuality}x${targetQuality} canvas texture`);
    
    // 5. Initialize canvas with optimized quality
    window.currentQuality = targetQuality;
    initializeCanvas(targetQuality);
    createCanvasTexture();
    
    // 6. Set initial drawing mode
    setDrawingMode(MODES.SELECT);
    
    // 7. Setup all UI systems
    setupModelControlListeners();
    setupModeEventHandlers();
    setupUISystem();
    initializeControls();
    
    // 8. Setup drag and drop
    setupDragAndDrop();
    
    // 9. Start animation loop
    animateWithMonitoring();
    
    // 10. Load default GLB model
    if (window.loadDefaultGLB) {
        window.loadDefaultGLB('91x91_4.glb', scene);
    }
    
    // 11. Setup memory monitoring
    if (performance.memory) {
        setInterval(() => {
            const memUsed = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
            const memLimit = (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1);
            if (memUsed > memLimit * 0.85) {
                console.warn(`High memory usage: ${memUsed}MB / ${memLimit}MB`);
            }
        }, 10000);
    }
    
    console.log('Application initialized successfully!');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
    initializeApplication();
}