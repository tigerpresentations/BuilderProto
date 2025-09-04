// Clean Selection System - Promise-based, no fallbacks needed
// Uses standard Three.js patterns exclusively

class CleanSelectionSystem extends THREE.EventDispatcher {
    constructor(scene, camera, renderer, orbitControls) {
        super();
        
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.orbitControls = orbitControls;
        
        // Selection state
        this.selectedObject = null;
        this.selectableObjects = [];
        
        // Selection visualization (simple wireframe)
        this.selectionHelper = null;
        this.selectionMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2
        });
        
        // Raycasting
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Setup events
        this.setupEventHandlers();
        
        console.log('✅ CleanSelectionSystem initialized');
    }
    
    setupEventHandlers() {
        // Mouse interaction
        this.handleMouseDown = (event) => {
            console.log('🖱️ Mouse click detected:', {
                button: event.button, 
                targetId: event.target.id,
                targetTag: event.target.tagName,
                isThreeCanvas: event.target === this.renderer.domElement
            });
            
            if (event.button !== 0) return; // Left click only
            if (event.target !== this.renderer.domElement) {
                console.log('🖱️ Not Three.js canvas, ignoring');
                return;
            }
            
            // Calculate mouse coordinates
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            // Raycast
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children, true);
            
            console.log('🎯 Raycast results:', intersects.length, 'intersects');
            console.log('🎯 Selectable objects:', this.selectableObjects.length);
            
            if (intersects.length === 0) {
                console.log('🎯 No intersects - deselecting');
                this.deselectObject();
                return;
            }
            
            // Find selectable parent
            const hit = intersects[0].object;
            const selectableParent = this.findSelectableParent(hit);
            
            if (selectableParent && selectableParent !== this.selectedObject) {
                this.selectObject(selectableParent);
            } else if (!selectableParent) {
                this.deselectObject();
            }
        };
        
        // Keyboard shortcuts
        this.handleKeyDown = (event) => {
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
            
            switch(event.key) {
                case 'Escape':
                    this.deselectObject();
                    break;
                case 'Delete':
                    if (this.selectedObject) this.deleteSelectedObject();
                    break;
            }
        };
        
        // Add event listeners with capture to ensure we get events first
        console.log('🎧 Adding event listeners to:', this.renderer.domElement);
        console.log('🎧 Canvas ID:', this.renderer.domElement.id);
        console.log('🎧 Canvas classes:', this.renderer.domElement.className);
        
        // Use capture phase to get events before other handlers
        this.renderer.domElement.addEventListener('mousedown', this.handleMouseDown, true);
        document.addEventListener('keydown', this.handleKeyDown, false);
        
        // Add a simple test event listener to verify the canvas is working
        const testHandler = (e) => {
            console.log('✅ TEST: Canvas click detected!', e.type, e.target);
        };
        this.renderer.domElement.addEventListener('click', testHandler);
        
        // Also test on document to see if ANY events work
        document.addEventListener('click', (e) => {
            console.log('✅ TEST: Document click detected!', e.target.tagName, e.target.id || 'no-id');
        });
    }
    
    findSelectableParent(object) {
        let current = object;
        while (current) {
            // Check if this object is in our selectable list
            if (this.selectableObjects.includes(current)) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }
    
    selectObject(object) {
        if (object === this.selectedObject) return;
        
        // Clear previous selection
        this.deselectObject();
        
        // Set new selection
        this.selectedObject = object;
        
        // Create simple wireframe visualization
        this.createSelectionWireframe(object);
        
        // Dispatch event
        this.dispatchEvent({ type: 'object-selected', object });
        
        console.log('🎯 Selected:', object.name);
    }
    
    deselectObject() {
        if (!this.selectedObject) return;
        
        const object = this.selectedObject;
        this.selectedObject = null;
        
        // Remove visualization
        this.clearSelectionWireframe();
        
        // Dispatch event
        this.dispatchEvent({ type: 'object-deselected', object });
        
        console.log('🎯 Deselected:', object.name);
    }
    
    createSelectionWireframe(object) {
        this.selectionHelper = new THREE.Group();
        this.selectionHelper.name = 'SelectionHelper';
        
        object.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const wireframe = new THREE.WireframeGeometry(child.geometry);
                const line = new THREE.LineSegments(wireframe, this.selectionMaterial);
                
                // Copy transform
                line.position.copy(child.position);
                line.rotation.copy(child.rotation);
                line.scale.copy(child.scale);
                
                this.selectionHelper.add(line);
            }
        });
        
        // Match object transform
        this.selectionHelper.position.copy(object.position);
        this.selectionHelper.rotation.copy(object.rotation);
        this.selectionHelper.scale.copy(object.scale);
        
        this.scene.add(this.selectionHelper);
    }
    
    clearSelectionWireframe() {
        if (this.selectionHelper) {
            this.scene.remove(this.selectionHelper);
            
            // Dispose geometries
            this.selectionHelper.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
            });
            
            this.selectionHelper = null;
        }
    }
    
    deleteSelectedObject() {
        if (!this.selectedObject) return;
        
        const object = this.selectedObject;
        this.deselectObject();
        
        // Remove from scene
        if (object.parent) {
            object.parent.remove(object);
        }
        
        // Dispose resources
        object.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        
        // Update selectable objects
        this.updateSelectableObjects();
        
        this.dispatchEvent({ type: 'object-deleted', object });
    }
    
    updateSelectableObjects() {
        this.selectableObjects = [];
        
        this.scene.children.forEach(child => {
            // Skip infrastructure objects
            if (child.isLight || child.type.includes('Helper') || child.type.includes('Light')) {
                return;
            }
            
            // Add groups that contain meshes
            if (child.type === 'Group' && this.containsMeshes(child)) {
                this.selectableObjects.push(child);
            }
        });
        
        console.log(`🔍 Found ${this.selectableObjects.length} selectable objects`);
    }
    
    containsMeshes(object) {
        for (const child of object.children) {
            if (child.isMesh) return true;
            if (child.children.length > 0 && this.containsMeshes(child)) return true;
        }
        return false;
    }
    
    // Connect to TransformControls
    connectTransformControls(transformControls) {
        this.transformControls = transformControls;
        
        // Add to scene when selecting
        this.addEventListener('object-selected', (event) => {
            if (this.transformControls) {
                this.scene.add(this.transformControls);
                this.transformControls.attach(event.object);
            }
        });
        
        // Remove from scene when deselecting
        this.addEventListener('object-deselected', () => {
            if (this.transformControls) {
                this.transformControls.detach();
                this.scene.remove(this.transformControls);
            }
        });
        
        // Coordinate with OrbitControls
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.orbitControls.enabled = !event.value;
        });
        
        console.log('🔗 TransformControls connected');
    }
    
    // Standard Three.js dispose pattern
    dispose() {
        // Remove event listeners
        this.renderer.domElement.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // Clear selection
        this.deselectObject();
        
        // Dispose material
        this.selectionMaterial.dispose();
        
        console.log('🗑️ CleanSelectionSystem disposed');
    }
}

// Simple initializer using Promises
async function initializeCleanSelectionSystem() {
    // Wait for dependencies
    const waitFor = (getter, name) => {
        return new Promise((resolve, reject) => {
            const check = () => {
                const value = getter();
                if (value) {
                    resolve(value);
                } else {
                    requestAnimationFrame(check);
                }
            };
            check();
        });
    };
    
    console.log('🚀 Initializing clean selection system...');
    
    const [scene, camera, renderer, controls] = await Promise.all([
        waitFor(() => window.scene, 'scene'),
        waitFor(() => window.camera, 'camera'), 
        waitFor(() => window.renderer, 'renderer'),
        waitFor(() => window.controls, 'controls')
    ]);
    
    // Create selection system
    const selectionSystem = new CleanSelectionSystem(scene, camera, renderer, controls);
    
    // Wait for transform controls and connect
    try {
        const transformControls = await waitFor(() => window.transformControlsManager?.transformControls, 'transformControls');
        selectionSystem.connectTransformControls(transformControls);
    } catch (error) {
        console.log('Transform controls not available, continuing without them');
    }
    
    // Update selectable objects
    selectionSystem.updateSelectableObjects();
    
    // Store globally
    window.cleanSelectionSystem = selectionSystem;
    
    // Setup UI listeners
    selectionSystem.addEventListener('object-selected', (event) => {
        const info = document.getElementById('selection-info');
        if (info) {
            info.style.display = 'block';
            document.getElementById('selected-name').textContent = event.object.name || 'Unnamed';
        }
    });
    
    selectionSystem.addEventListener('object-deselected', () => {
        const info = document.getElementById('selection-info');
        if (info) info.style.display = 'none';
    });
    
    console.log('✅ Clean selection system ready');
    return selectionSystem;
}

// Auto-initialize
initializeCleanSelectionSystem().catch(console.error);

window.CleanSelectionSystem = CleanSelectionSystem;
window.initializeCleanSelectionSystem = initializeCleanSelectionSystem;