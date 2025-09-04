// Transform Controls Manager - Professional Three.js object manipulation
// Replaces the custom ObjectManipulator with Three.js built-in TransformControls

class TransformControlsManager {
    constructor(scene, camera, renderer, orbitControls) {
        console.log('🔧 TransformControlsManager constructor called');
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.orbitControls = orbitControls;
        
        // Create TransformControls instance
        this.transformControls = new THREE.TransformControls(camera, renderer.domElement);
        
        // Configure for XZ-plane movement (disable Y-axis)
        this.setupTransformControls();
        
        // Add to scene
        scene.add(this.transformControls);
        
        // Setup OrbitControls integration
        this.setupOrbitControlsIntegration();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Currently selected object
        this.selectedObject = null;
        
        // Listen for object selection events
        window.addEventListener('objectSelected', this.onObjectSelected.bind(this));
        window.addEventListener('objectDeselected', this.onObjectDeselected.bind(this));
        
        // Store reference globally
        window.transformControlsManager = this;
        
        console.log('✅ TransformControlsManager initialized successfully');
    }
    
    setupTransformControls() {
        // Start with translate mode
        this.transformControls.setMode('translate');
        
        // Configure axes for XZ-plane movement
        this.transformControls.showX = true;  // Allow X-axis movement
        this.transformControls.showY = false; // Disable Y-axis movement (keep objects on ground)
        this.transformControls.showZ = true;  // Allow Z-axis movement
        
        // Visual settings
        this.transformControls.setSize(1.5); // Make handles larger for easier clicking
        
        console.log('🎮 TransformControls configured for XZ-plane movement');
    }
    
    setupOrbitControlsIntegration() {
        // Auto-disable OrbitControls during manipulation
        this.transformControls.addEventListener('dragging-changed', (event) => {
            if (this.orbitControls) {
                this.orbitControls.enabled = !event.value;
                console.log(`🔄 OrbitControls ${event.value ? 'disabled' : 'enabled'} (dragging: ${event.value})`);
            }
        });
        
        // Handle object change events
        this.transformControls.addEventListener('objectChange', (event) => {
            // Object has been transformed
            if (this.selectedObject) {
                console.log('📍 Object transformed:', {
                    objectName: this.selectedObject.name,
                    position: this.selectedObject.position,
                    rotation: this.selectedObject.rotation
                });
            }
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Only process shortcuts when an object is selected
            if (!this.selectedObject) return;
            
            // Prevent shortcuts during text input
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }
            
            const key = event.key.toLowerCase();
            let modeChanged = false;
            
            switch(key) {
                case 'g': // Grab/Move (Blender-style)
                    this.transformControls.setMode('translate');
                    modeChanged = true;
                    console.log('🎮 Switched to TRANSLATE mode (G key)');
                    break;
                    
                case 'r': // Rotate
                    this.transformControls.setMode('rotate');
                    // For rotation, we only want Y-axis rotation (around vertical)
                    this.transformControls.showX = false;
                    this.transformControls.showY = true;
                    this.transformControls.showZ = false;
                    modeChanged = true;
                    console.log('🎮 Switched to ROTATE mode (R key)');
                    break;
                    
                case 's': // Scale (optional)
                    this.transformControls.setMode('scale');
                    // Allow uniform scaling
                    this.transformControls.showX = true;
                    this.transformControls.showY = true;
                    this.transformControls.showZ = true;
                    modeChanged = true;
                    console.log('🎮 Switched to SCALE mode (S key)');
                    break;
                    
                case 'escape': // Deselect
                    this.deselectObject();
                    console.log('🎮 Object deselected (Escape key)');
                    break;
            }
            
            if (modeChanged) {
                event.preventDefault();
                
                // Reset axes for translate mode
                if (key === 'g') {
                    this.transformControls.showX = true;
                    this.transformControls.showY = false; // Keep Y disabled for ground constraint
                    this.transformControls.showZ = true;
                }
            }
        });
        
        console.log('⌨️ Keyboard shortcuts enabled: G (move), R (rotate), S (scale), ESC (deselect)');
    }
    
    onObjectSelected(event) {
        const object = event.detail.object;
        console.log('🎯 TransformControlsManager: Object selected', object.name);
        
        this.selectedObject = object;
        
        // Attach TransformControls to the selected object
        this.transformControls.attach(object);
        
        // Reset to translate mode when selecting a new object
        this.transformControls.setMode('translate');
        this.transformControls.showX = true;
        this.transformControls.showY = false; // Keep objects on ground
        this.transformControls.showZ = true;
        
        console.log('✅ TransformControls attached to object');
    }
    
    onObjectDeselected(event) {
        console.log('🎯 TransformControlsManager: Object deselected');
        
        this.selectedObject = null;
        
        // Detach TransformControls
        this.transformControls.detach();
        
        console.log('✅ TransformControls detached');
    }
    
    // Public method for manual object selection
    selectObject(object) {
        if (object) {
            this.selectedObject = object;
            this.transformControls.attach(object);
            console.log('✅ Manually selected object for transformation:', object.name);
        }
    }
    
    // Public method for deselection
    deselectObject() {
        this.selectedObject = null;
        this.transformControls.detach();
        
        // Fire deselection event for other systems
        const event = new CustomEvent('objectDeselected', {
            detail: { source: 'TransformControlsManager' }
        });
        window.dispatchEvent(event);
    }
    
    // Get current manipulation mode
    getCurrentMode() {
        return this.transformControls.getMode();
    }
    
    // Set manipulation mode programmatically
    setMode(mode) {
        if (['translate', 'rotate', 'scale'].includes(mode)) {
            this.transformControls.setMode(mode);
            
            // Apply appropriate axis constraints
            if (mode === 'translate') {
                this.transformControls.showX = true;
                this.transformControls.showY = false; // Ground constraint
                this.transformControls.showZ = true;
            } else if (mode === 'rotate') {
                this.transformControls.showX = false;
                this.transformControls.showY = true; // Only Y-axis rotation
                this.transformControls.showZ = false;
            } else if (mode === 'scale') {
                this.transformControls.showX = true;
                this.transformControls.showY = true;
                this.transformControls.showZ = true;
            }
            
            console.log(`🎮 Mode set to: ${mode.toUpperCase()}`);
        }
    }
    
    // Dispose of resources
    dispose() {
        // Remove from scene
        if (this.transformControls.parent) {
            this.transformControls.parent.remove(this.transformControls);
        }
        
        // Remove event listeners
        window.removeEventListener('objectSelected', this.onObjectSelected);
        window.removeEventListener('objectDeselected', this.onObjectDeselected);
        
        // Dispose of TransformControls
        this.transformControls.dispose();
        
        console.log('🗑️ TransformControlsManager disposed');
    }
}

// Initialize TransformControls when DOM is ready
function setupTransformControls() {
    console.log('🔧 Attempting to setup TransformControls system...');
    console.log('Dependencies check:', {
        scene: !!window.scene,
        camera: !!window.camera,
        renderer: !!window.renderer,
        controls: !!window.controls
    });
    
    // Wait for other systems to be ready
    if (window.scene && window.camera && window.renderer && window.controls) {
        const transformManager = new TransformControlsManager(
            window.scene, 
            window.camera, 
            window.renderer, 
            window.controls
        );
        
        console.log('✅ TransformControls system initialized successfully');
        return transformManager;
    } else {
        console.warn('⏳ TransformControls system waiting for dependencies...');
        // Retry after a short delay
        setTimeout(setupTransformControls, 500);
    }
}

// Export to global scope
window.TransformControlsManager = TransformControlsManager;
window.setupTransformControls = setupTransformControls;