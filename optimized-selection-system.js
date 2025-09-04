// Optimized Selection System - Phase 1 Performance Implementation
// Follows Three.js best practices for maximum performance
// Now using native THREE.EventDispatcher for event handling

class OptimizedSelectionSystem extends THREE.EventDispatcher {
    constructor(scene, camera, renderer, orbitControls) {
        super(); // Call THREE.EventDispatcher constructor
        console.log('🚀 OptimizedSelectionSystem initializing (with THREE.EventDispatcher)...');
        
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.orbitControls = orbitControls;
        
        // Selection state - single source of truth
        this.selectedObject = null;
        this.selectableObjects = [];
        
        // Simple selection visualization setup
        this.setupSelectionVisualization();
        
        // TransformControls integration
        this.transformControls = null;
        this.isTransformControlsActive = false;
        this.transformControlsObjects = new Set(); // Cache of all TransformControls gizmo objects
        
        // Optimized raycasting
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Setup optimized event handling
        this.setupEventSystem();
        
        console.log('✅ OptimizedSelectionSystem initialized with simple visualization');
    }
    
    setupSelectionVisualization() {
        console.log('🎨 Setting up simplified selection visualization...');
        
        // Use the new simple selection visualization
        if (window.SimpleSelectionVisualization) {
            try {
                this.selectionVisualization = new window.SimpleSelectionVisualization(this.scene);
                console.log('✅ Simple selection visualization ready');
            } catch (error) {
                console.warn('⚠️ Failed to create SimpleSelectionVisualization, using fallback:', error);
                this.selectionVisualization = null;
                this.selectionHelpers = new Map();
            }
        } else {
            console.warn('⚠️ SimpleSelectionVisualization not available, creating fallback');
            // Fallback: create inline simple visualization
            this.selectionVisualization = null;
            this.selectionHelpers = new Map();
        }
    }
    
    setupEventSystem() {
        console.log('🎧 Setting up optimized event system...');
        
        // Single mouse handler to eliminate conflicts
        this.handleMouseInteraction = this.handleMouseInteraction.bind(this);
        
        // Use standard pointerdown events
        this.renderer.domElement.addEventListener('pointerdown', this.handleMouseInteraction, {
            capture: false,
            passive: false
        });
        
        // Keyboard shortcuts - delegate to TransformControls when possible
        this.handleKeyboard = this.handleKeyboard.bind(this);
        document.addEventListener('keydown', this.handleKeyboard);
        
        console.log('✅ Event system optimized for minimal overhead');
    }
    
    handleMouseInteraction(event) {
        console.log('🖱️ Mouse interaction detected:', {
            button: event.button,
            target: event.target === this.renderer.domElement ? 'canvas' : 'other',
            transformControlsDragging: this.transformControls?.dragging,
            selectableObjectsCount: this.selectableObjects.length
        });
        
        // Prevent deselection when clicking UI elements
        if (event.target !== this.renderer.domElement) {
            console.log('🖱️ Click on UI element - ignoring');
            return;
        }
        
        // Skip right-click and other buttons
        if (event.button !== 0) {
            console.log('🖱️ Skipping - not left mouse button');
            return;
        }
        
        // Skip ALL interaction when TransformControls is active (dragging)
        if (this.isTransformControlsActive) {
            console.log('🖱️ Skipping - TransformControls is actively dragging');
            return;
        }
        
        // Skip if we have a selected object and TransformControls exist (let them handle interaction)
        if (this.selectedObject && this.transformControls && this.transformControls.visible) {
            console.log('🖱️ TransformControls available - letting them handle interaction');
            return;
        }
        
        // Setup raycaster with proper coordinates
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Force camera matrix update to prevent stale matrices
        this.camera.updateMatrixWorld(true);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Single raycast against ALL scene objects, then filter out excluded objects
        const allIntersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        // Filter out objects marked to exclude from raycasting (like grid)
        const intersects = allIntersects.filter(hit => {
            return !hit.object.userData.excludeFromRaycast;
        });
        
        // Enhanced debugging for intermittent selection issues
        console.log('🎯 Detailed click analysis:', {
            intersectCount: intersects.length,
            firstHit: intersects[0] ? {
                objectName: intersects[0].object.name || 'unnamed',
                objectType: intersects[0].object.type,
                distance: intersects[0].distance.toFixed(2),
                hasUserData: !!intersects[0].object.userData,
                selectableFlag: intersects[0].object.userData?.selectable,
                parentName: intersects[0].object.parent?.name || 'no parent'
            } : null,
            mouseCoords: { x: this.mouse.x.toFixed(3), y: this.mouse.y.toFixed(3) },
            currentSelection: this.selectedObject?.name || 'none',
            transformControlsVisible: this.transformControls?.visible || false,
            sceneChildren: this.scene.children.length,
            selectableObjectsCount: this.selectableObjects?.length || 0,
            cameraMatrixValid: this.camera && this.camera.matrixWorldInverse && !isNaN(this.camera.matrixWorldInverse.elements[0]),
            raycasterReady: this.raycaster && this.raycaster.ray && !isNaN(this.raycaster.ray.origin.x)
        });
        
        // If no intersects but we expect some, debug further
        if (intersects.length === 0 && this.selectableObjects?.length > 0) {
            console.log('🚨 Zero intersects but selectables exist - debugging raycaster:');
            console.log('🔧 Raycaster details:', {
                origin: `${this.raycaster.ray.origin.x.toFixed(2)}, ${this.raycaster.ray.origin.y.toFixed(2)}, ${this.raycaster.ray.origin.z.toFixed(2)}`,
                direction: `${this.raycaster.ray.direction.x.toFixed(2)}, ${this.raycaster.ray.direction.y.toFixed(2)}, ${this.raycaster.ray.direction.z.toFixed(2)}`,
                near: this.raycaster.near,
                far: this.raycaster.far
            });
            console.log('🔧 Scene debug:', {
                totalChildren: this.scene.children.length,
                childrenTypes: this.scene.children.map(child => `${child.name || 'unnamed'}(${child.type})`),
                selectableObjects: this.selectableObjects.map(obj => `${obj.name || 'unnamed'}(${obj.type})`)
            });
        }
        
        if (intersects.length === 0) {
            // User clicked on background/empty space
            if (this.selectedObject) {
                console.log('🎯 Clicked background - deselecting');
                this.deselectObject();
            } else {
                console.log('🎯 Clicked background - nothing to deselect');
            }
            return;
        }
        
        // O(1) TransformControls detection using cached Set
        const hit = intersects[0].object;
        
        if (this.transformControlsObjects.has(hit) && this.selectedObject) {
            console.log('🎮 Hit TransformControls - ignoring');
            return; // Let TransformControls work
        }
        
        // Check if we only hit non-selectable infrastructure (treat as background click)
        const isInfrastructure = !this.isObjectSelectable(hit);
        
        if (isInfrastructure && this.selectedObject) {
            console.log('🎯 Clicked non-selectable infrastructure - deselecting:', {
                entityName: hit.name || 'unnamed',
                entityType: hit.type,
                isLight: hit.isLight,
                userData: hit.userData,
                parentName: hit.parent?.name || 'no parent',
                position: `${hit.position?.x?.toFixed(2) || 'N/A'}, ${hit.position?.y?.toFixed(2) || 'N/A'}, ${hit.position?.z?.toFixed(2) || 'N/A'}`
            });
            this.deselectObject();
            return;
        }
        
        // Check if hit object is selectable
        const isSelectable = this.isObjectSelectable(hit);
        console.log('🔍 Selectability check:', {
            hitObjectName: hit.name || 'unnamed',
            hitObjectType: hit.type,
            isSelectable: isSelectable,
            userDataSelectable: hit.userData?.selectable,
            parentChain: this.getParentChain(hit),
            hitPosition: `${hit.position?.x?.toFixed(2) || 'N/A'}, ${hit.position?.y?.toFixed(2) || 'N/A'}, ${hit.position?.z?.toFixed(2) || 'N/A'}`,
            isLight: hit.isLight,
            isMesh: hit.isMesh,
            geometry: hit.geometry?.type || 'no geometry',
            material: hit.material?.type || 'no material'
        });
        
        if (isSelectable) {
            const selectableParent = this.findSelectableParent(hit);
            console.log('🔍 Found selectable parent:', selectableParent?.name || 'none');
            
            if (selectableParent && selectableParent !== this.selectedObject) {
                console.log('🎯 Selecting object:', selectableParent.name);
                this.selectObject(selectableParent);
            } else if (selectableParent === this.selectedObject) {
                console.log('🎯 Same object clicked - no action needed');
            } else {
                console.log('⚠️ Object marked selectable but no parent found');
            }
        } else {
            // Hit non-selectable object (like floor)
            if (this.selectedObject) {
                console.log('🎯 Hit non-selectable object - deselecting');
                this.deselectObject();
            } else {
                console.log('🎯 Hit non-selectable object - nothing to deselect');
            }
        }
    }
    
    handleKeyboard(event) {
        // Only handle keys when we have focus and no input active
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch(event.key.toLowerCase()) {
            case 'escape':
                this.deselectObject();
                event.preventDefault();
                break;
            case 'delete':
                if (this.selectedObject && event.key === 'Delete') {
                    this.deleteSelectedObject();
                    event.preventDefault();
                }
                break;
            case 'tab':
                this.cycleSelection(event.shiftKey ? -1 : 1);
                event.preventDefault();
                break;
        }
    }
    
    getParentChain(object, maxDepth = 3) {
        const chain = [];
        let current = object;
        let depth = 0;
        
        while (current && depth < maxDepth) {
            chain.push({
                name: current.name || 'unnamed',
                type: current.type,
                selectable: current.userData?.selectable
            });
            current = current.parent;
            depth++;
        }
        
        return chain;
    }
    
    isObjectSelectable(object) {
        // Walk up the parent chain to find an object with userData.selectable flag
        let current = object;
        while (current) {
            if (current.userData.hasOwnProperty('selectable')) {
                return current.userData.selectable === true;
            }
            current = current.parent;
        }
        // Default to false for objects without the flag (safer approach)
        return false;
    }
    
    findSelectableParent(object) {
        let current = object;
        while (current) {
            if (this.selectableObjects.includes(current)) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }
    
    // Optimized selection methods
    selectObject(object) {
        if (!object || object === this.selectedObject) {
            return;
        }
        
        console.log('🎯 Selecting object:', object.name);
        
        // Clear previous selection
        if (this.selectedObject) {
            this.deselectObject();
        }
        
        // Set new selection
        this.selectedObject = object;
        object.userData.selected = true;
        
        // Apply simple selection visualization
        if (this.selectionVisualization) {
            this.selectionVisualization.applySelection(object);
        } else {
            // Fallback to basic edges
            this.createEdgesSelection(object);
        }
        
        // Add TransformControls back to scene and attach
        if (this.transformControls) {
            console.log('🔧 Adding TransformControls to scene and attaching');
            console.log('🔧 TransformControls parent before adding:', this.transformControls.parent?.type || 'no parent');
            if (this.scene && this.transformControls.parent !== this.scene) {
                this.scene.add(this.transformControls);
                console.log('✅ TransformControls added to scene');
            } else {
                console.log('⚠️ TransformControls already in scene or no scene reference');
            }
            this.transformControls.attach(object);
        }
        
        // Show keyboard shortcuts overlay
        this.showKeyboardShortcuts();
        
        // Dispatch Three.js native event
        this.dispatchEvent({ type: 'object-selected', object: object });
        
        console.log('✅ Object selected with simple visualization');
    }
    
    deselectObject() {
        if (!this.selectedObject) {
            console.log('🎯 Deselect called but no object selected');
            return;
        }
        
        console.log('🎯 Deselecting object:', this.selectedObject.name);
        
        const object = this.selectedObject;
        object.userData.selected = false;
        
        // Clear selection visualization
        if (this.selectionVisualization) {
            console.log('🎨 Clearing simple selection');
            this.selectionVisualization.clearSelection();
        } else {
            console.log('🎨 Removing EdgesGeometry selection');
            this.removeEdgesSelection(object);
        }
        
        // Detach and remove TransformControls from scene
        if (this.transformControls) {
            console.log('🔧 Detaching and removing TransformControls from scene');
            console.log('🔧 TransformControls parent before removal:', this.transformControls.parent?.type || 'no parent');
            this.transformControls.detach();
            if (this.scene && this.transformControls.parent === this.scene) {
                this.scene.remove(this.transformControls);
                console.log('✅ TransformControls removed from scene');
            } else {
                console.log('⚠️ TransformControls not in scene or no scene reference');
            }
        } else {
            console.log('⚠️ No TransformControls to detach');
        }
        
        // Clear selection
        this.selectedObject = null;
        
        // Hide keyboard shortcuts overlay
        this.hideKeyboardShortcuts();
        
        // Dispatch Three.js native event
        this.dispatchEvent({ type: 'object-deselected', object: object });
        
        console.log('✅ Object deselected - controls should be hidden');
    }
    
    deleteSelectedObject() {
        if (!this.selectedObject) return;
        
        const objectToDelete = this.selectedObject;
        console.log('🗑️ Deleting selected object:', objectToDelete.name);
        
        // Deselect first
        this.deselectObject();
        
        // Remove from scene
        if (objectToDelete.parent) {
            objectToDelete.parent.remove(objectToDelete);
        }
        
        // Dispose of resources
        objectToDelete.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        
        // Update selectable objects
        this.updateSelectableObjects();
        
        // Dispatch Three.js native event
        this.dispatchEvent({ type: 'object-deleted', object: objectToDelete });
    }
    
    cycleSelection(direction = 1) {
        if (this.selectableObjects.length === 0) return;
        
        let currentIndex = -1;
        if (this.selectedObject) {
            currentIndex = this.selectableObjects.indexOf(this.selectedObject);
        }
        
        let nextIndex = currentIndex + direction;
        if (nextIndex >= this.selectableObjects.length) {
            nextIndex = 0;
        } else if (nextIndex < 0) {
            nextIndex = this.selectableObjects.length - 1;
        }
        
        this.selectObject(this.selectableObjects[nextIndex]);
    }
    
    // Connect TransformControls
    connectTransformControls(transformControls) {
        if (!transformControls) {
            console.error('❌ Cannot connect null TransformControls');
            return;
        }
        
        this.transformControls = transformControls;
        console.log('🔗 TransformControls connected');
        
        // Cache all TransformControls gizmo objects for instant lookup
        this.cacheTransformControlsObjects();
        
        // If we have a selected object, attach it
        if (this.selectedObject) {
            this.transformControls.attach(this.selectedObject);
        }
        
        // Setup TransformControls event handling - CRITICAL for performance and click detection
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.isTransformControlsActive = event.value;
            console.log(`🔧 TransformControls dragging: ${event.value ? 'STARTED' : 'STOPPED'}`);
            
            // Coordinate with OrbitControls
            if (this.orbitControls) {
                this.orbitControls.enabled = !event.value;
            }
        });
    }
    
    // Cache all TransformControls gizmo objects for instant O(1) lookup
    cacheTransformControlsObjects() {
        this.transformControlsObjects.clear();
        
        if (this.transformControls) {
            this.transformControls.traverse(child => {
                if (child.isMesh || child.isLine || child.type.includes('TransformControls')) {
                    this.transformControlsObjects.add(child);
                }
            });
            console.log(`✅ Cached ${this.transformControlsObjects.size} TransformControls objects`);
        }
    }
    
    // Optimized object list update
    updateSelectableObjects() {
        console.log('🔍 Updating selectable objects...');
        this.selectableObjects = [];
        
        // Efficient scene traversal - only check direct children
        this.scene.children.forEach(child => {
            // Skip lights, helpers, and other non-selectable objects
            if (child === window.floor || 
                child.isLight || 
                child.type === 'HemisphereLight' ||
                child.type === 'DirectionalLight' ||
                child.type === 'GridHelper') {
                return;
            }
            
            // Check if object is marked as selectable (defaults to true if not set)
            const isSelectable = child.userData.selectable !== false;
            
            // Only add objects that contain meshes AND are marked as selectable
            if (child.type === 'Group' && this.containsMeshes(child) && isSelectable) {
                this.selectableObjects.push(child);
                console.log(`✅ Added selectable object: ${child.name} (selectable: ${isSelectable})`);
            } else if (child.type === 'Group' && this.containsMeshes(child) && !isSelectable) {
                console.log(`⚠️ Skipped non-selectable object: ${child.name} (selectable: ${isSelectable})`);
            }
        });
        
        console.log(`✅ Found ${this.selectableObjects.length} selectable objects`);
    }
    
    containsMeshes(object) {
        for (const child of object.children) {
            if (child.isMesh) return true;
            if (child.children.length > 0 && this.containsMeshes(child)) return true;
        }
        return false;
    }
    
    // Legacy EdgesGeometry methods (kept as fallback)
    createEdgesSelection(object) {
        console.log('🎨 Creating EdgesGeometry selection for:', object.name);
        
        // Remove any existing helper first
        this.removeEdgesSelection(object);
        
        // Create selection helper group
        const helper = new THREE.Group();
        helper.name = `SelectionHelper_${object.name}`;
        
        // Traverse the object to create edges for all meshes
        object.traverse((child) => {
            if (child.isMesh && child.geometry) {
                const edges = new THREE.EdgesGeometry(child.geometry);
                const lineMaterial = new THREE.LineBasicMaterial({ 
                    color: 0x00ff00,
                    linewidth: 2,
                    transparent: true,
                    opacity: 0.8
                });
                const wireframe = new THREE.LineSegments(edges, lineMaterial);
                
                // Use world matrix to get exact positioning
                child.updateMatrixWorld(true);
                wireframe.matrixWorld.copy(child.matrixWorld);
                wireframe.matrix.copy(child.matrix);
                wireframe.matrixAutoUpdate = false; // Prevent Three.js from overriding our matrix
                
                helper.add(wireframe);
            }
        });
        
        // Position the helper group to match the object's world position
        object.updateMatrixWorld(true);
        helper.matrixWorld.copy(object.matrixWorld);
        helper.matrix.copy(object.matrix);
        helper.matrixAutoUpdate = false;
        
        // Add to scene and store reference
        this.scene.add(helper);
        this.selectionHelpers.set(object, helper);
        
        console.log('✅ EdgesGeometry selection helper created with world matrix');
    }
    
    removeEdgesSelection(object) {
        const helper = this.selectionHelpers.get(object);
        if (helper) {
            console.log('🗑️ Removing EdgesGeometry selection for:', object.name);
            
            // Dispose of geometries and materials
            helper.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            
            // Remove from scene
            this.scene.remove(helper);
            this.selectionHelpers.delete(object);
        }
    }
    
    // Simple rendering without post-processing
    render() {
        // Update selection visualization if needed
        if (this.selectionVisualization && this.selectedObject) {
            this.selectionVisualization.updateSelection();
        }
        
        // Regular rendering - no post-processing needed
        this.renderer.render(this.scene, this.camera);
    }
    
    // Legacy event system methods for backwards compatibility
    // These now delegate to THREE.EventDispatcher methods
    on(event, callback) {
        console.warn('⚠️ Legacy .on() method - please use addEventListener()');
        this.addEventListener(event, callback);
    }
    
    off(event, callback) {
        console.warn('⚠️ Legacy .off() method - please use removeEventListener()');
        this.removeEventListener(event, callback);
    }
    
    emit(event, data) {
        console.warn('⚠️ Legacy .emit() method - please use dispatchEvent()');
        this.dispatchEvent({ type: event, ...data });
    }
    
    // Keyboard shortcuts overlay management
    showKeyboardShortcuts() {
        const overlay = document.getElementById('keyboard-shortcuts-overlay');
        if (overlay) {
            overlay.classList.add('visible');
            console.log('⌨️ Keyboard shortcuts overlay shown');
        }
    }
    
    hideKeyboardShortcuts() {
        const overlay = document.getElementById('keyboard-shortcuts-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            console.log('⌨️ Keyboard shortcuts overlay hidden');
        }
    }
    
    // Public API methods
    getSelectedObject() { return this.selectedObject; }
    isSelected(object) { return this.selectedObject === object; }
    hasSelection() { return this.selectedObject !== null; }
    
    // Cleanup
    dispose() {
        console.log('🗑️ Disposing OptimizedSelectionSystem...');
        
        // Deselect current object
        this.deselectObject();
        
        // Remove event listeners
        this.renderer.domElement.removeEventListener('pointerdown', this.handleMouseInteraction);
        document.removeEventListener('keydown', this.handleKeyboard);
        
        // Clear all selection helpers
        this.selectionHelpers.forEach((helper, object) => {
            this.removeEdgesSelection(object);
        });
        this.selectionHelpers.clear();
        
        // Dispose of selection visualization
        if (this.selectionVisualization) {
            this.selectionVisualization.dispose();
        }
        
        console.log('✅ OptimizedSelectionSystem disposed');
    }
}

// Legacy initialization function - kept for backwards compatibility
// New code should use SystemInitializer instead
function setupOptimizedSelectionSystem() {
    console.warn('⚠️ setupOptimizedSelectionSystem is deprecated. Use SystemInitializer.initializeSelectionSystem() instead');
    
    // Check for required dependencies
    const dependencies = {
        scene: window.scene,
        camera: window.camera,
        renderer: window.renderer,
        orbitControls: window.controls
    };
    
    // Only initialize if all dependencies are ready
    if (Object.values(dependencies).every(dep => dep)) {
        const selectionSystem = new OptimizedSelectionSystem(
            dependencies.scene,
            dependencies.camera,
            dependencies.renderer,
            dependencies.orbitControls
        );
        
        // Store globally
        window.optimizedSelectionSystem = selectionSystem;
        
        // Update selectable objects
        selectionSystem.updateSelectableObjects();
        
        console.log('✅ OptimizedSelectionSystem ready (via legacy function)');
        return selectionSystem;
    } else {
        console.error('❌ Dependencies not ready for OptimizedSelectionSystem');
        return null;
    }
}

// Export to global scope
window.OptimizedSelectionSystem = OptimizedSelectionSystem;
window.setupOptimizedSelectionSystem = setupOptimizedSelectionSystem;