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
        
        // Don't add to scene initially - will be added only when selecting objects
        
        // Setup OrbitControls integration
        this.setupOrbitControlsIntegration();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Currently selected object
        this.selectedObject = null;
        
        // Will be connected to SelectionManager events after SelectionManager is initialized
        
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
        this.transformControls.setSize(1.2); // Reasonable size for precise interaction
        
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
        const keyboardHandler = (event) => {
            console.log('🎹 Keyboard event detected:', {
                key: event.key,
                target: event.target.tagName,
                selectedObject: !!this.selectedObject,
                hasGlobalSelection: !!window.optimizedSelectionSystem?.primarySelection
            });
            
            // Check if we have a selection (either local or global)
            const hasSelection = this.selectedObject || window.optimizedSelectionSystem?.primarySelection;
            if (!hasSelection) {
                console.log('🎹 No selection - skipping keyboard shortcut');
                return;
            }
            
            // Prevent shortcuts during text input
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                console.log('🎹 Input field active - skipping keyboard shortcut');
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
                    // Force update the controls to show rotation handles
                    this.transformControls.updateMatrixWorld();
                    modeChanged = true;
                    console.log('🎮 Switched to ROTATE mode (R key) - Y-axis only');
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
                    
                case 'escape': // Deselect - delegate to OptimizedSelectionSystem
                    if (window.optimizedSelectionSystem) {
                        window.optimizedSelectionSystem.deselectObject();
                        console.log('🎮 Object deselected via OptimizedSelectionSystem (Escape key)');
                    }
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
        };
        
        document.addEventListener('keydown', keyboardHandler);
        
        console.log('⌨️ Keyboard shortcuts enabled: G (move), R (rotate), S (scale), ESC (deselect)');
    }
    
    onObjectSelected(data) {
        const object = data.object;
        console.log('🎯 TransformControlsManager: Object selected', object.name);
        
        this.selectedObject = object;
        
        // Note: TransformControls is already attached by SelectionManager
        // Just reset to translate mode when selecting a new object
        this.transformControls.setMode('translate');
        this.transformControls.showX = true;
        this.transformControls.showY = false; // Keep objects on ground
        this.transformControls.showZ = true;
        
        console.log('✅ TransformControls mode reset for new selection');
    }
    
    onObjectDeselected(data) {
        console.log('🎯 TransformControlsManager: Object deselected');
        
        this.selectedObject = null;
        
        // Note: TransformControls is already detached by SelectionManager
        console.log('✅ TransformControls selection cleared');
    }
    
    // Selection is now handled by SelectionManager
    // These methods are kept for backwards compatibility but delegate to SelectionManager
    selectObject(object) {
        console.log('🔄 TransformControlsManager.selectObject() - delegating to SelectionManager');
        if (window.selectionManager && object) {
            window.selectionManager.select(object);
        }
    }
    
    deselectObject() {
        console.log('🔄 TransformControlsManager.deselectObject() - delegating to SelectionManager');
        if (window.selectionManager) {
            window.selectionManager.deselect();
        }
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
            
            // Force update the controls display
            this.transformControls.updateMatrixWorld();
            
            console.log(`🎮 Mode set to: ${mode.toUpperCase()} - handles should be visible`);
        }
    }
    
    // Dispose of resources
    dispose() {
        // Remove from scene
        if (this.transformControls.parent) {
            this.transformControls.parent.remove(this.transformControls);
        }
        
        // Event listeners are now managed by SelectionManager connection
        
        // Dispose of TransformControls
        this.transformControls.dispose();
        
        console.log('🗑️ TransformControlsManager disposed');
    }
}

// Legacy initialization function - kept for backwards compatibility
// New code should use SystemInitializer instead
function setupTransformControls() {
    console.warn('⚠️ setupTransformControls is deprecated. Use SystemInitializer.initializeTransformControls() instead');
    
    // Only initialize if all dependencies are ready
    if (window.scene && window.camera && window.renderer && window.controls) {
        const transformManager = new TransformControlsManager(
            window.scene, 
            window.camera, 
            window.renderer, 
            window.controls
        );
        
        // Connect to OptimizedSelectionSystem if available
        if (window.optimizedSelectionSystem) {
            window.optimizedSelectionSystem.connectTransformControls(transformManager.transformControls);
            console.log('🔗 Connected TransformControls to OptimizedSelectionSystem');
        }
        
        console.log('✅ TransformControls system initialized (via legacy function)');
        return transformManager;
    } else {
        console.error('❌ Dependencies not ready for TransformControls');
        return null;
    }
}

// Export to global scope
window.TransformControlsManager = TransformControlsManager;
window.setupTransformControls = setupTransformControls;