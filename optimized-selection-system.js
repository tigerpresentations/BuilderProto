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
        
        // Selection state - supports multiple objects
        this.selectedObjects = new Set(); // Multiple selected objects
        this.primarySelection = null; // Primary object for TransformControls
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
        
        // Use standard pointerdown events (Three.js official pattern)
        this.renderer.domElement.addEventListener('pointerdown', this.handleMouseInteraction, false);
        
        // Keyboard shortcuts - delegate to TransformControls when possible
        this.handleKeyboard = this.handleKeyboard.bind(this);
        document.addEventListener('keydown', this.handleKeyboard);
        
        console.log('✅ Event system optimized for minimal overhead');
    }
    
    handleMouseInteraction(event) {
        // Standard Three.js selection pattern based on official examples
        console.log('🖱️ Standard Three.js selection pattern triggered');
        
        // Only handle primary pointer events (prevent multi-touch conflicts)
        if (event.isPrimary === false) return;
        
        // Only handle left mouse button
        if (event.button !== 0) return;
        
        // Only handle canvas clicks (ignore UI elements)
        if (event.target !== this.renderer.domElement) return;
        
        // Skip when TransformControls is actively dragging
        if (this.transformControls?.dragging === true) {
            console.log('🔧 TransformControls actively dragging - skipping');
            return;
        }
        
        // Standard Three.js coordinate conversion
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Setup raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Raycast against selectable objects only (standard pattern)
        const intersects = this.raycaster.intersectObjects(this.selectableObjects, true);
        
        // Filter out TransformControls gizmo objects
        const validHits = intersects.filter(hit => 
            !this.transformControlsObjects.has(hit.object)
        );
        
        // Detect modifier keys for multi-selection
        const isCtrlHeld = event.ctrlKey || event.metaKey; // Ctrl on Windows/Linux, Cmd on Mac
        const isShiftHeld = event.shiftKey;
        
        console.log('🎯 Selection raycast:', {
            validHits: validHits.length,
            firstHit: validHits[0]?.object?.name || 'none',
            selectedCount: this.selectedObjects.size,
            primarySelection: this.primarySelection?.name || 'none',
            modifiers: { ctrl: isCtrlHeld, shift: isShiftHeld }
        });
        
        if (validHits.length > 0) {
            // Hit a selectable object - find the top-level selectable parent
            const hit = validHits[0].object;
            const selectableParent = this.findSelectableParent(hit);
            
            if (selectableParent) {
                if (isCtrlHeld) {
                    // Ctrl+Click: Add/remove from selection
                    this.toggleObjectSelection(selectableParent);
                } else if (isShiftHeld && this.primarySelection) {
                    // Shift+Click: Select range (if we have selectable objects list)
                    this.selectRange(this.primarySelection, selectableParent);
                } else {
                    // Regular click: Replace selection
                    this.selectObject(selectableParent, true); // true = replace existing
                }
            }
        } else {
            // No valid hits - deselect all (standard Three.js pattern)
            if (!isCtrlHeld && !isShiftHeld) {
                console.log('🎯 No valid hits - deselecting all');
                this.deselectAll();
            } else {
                console.log('🎯 No valid hits with modifier - keeping selection');
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
                this.deselectAll();
                event.preventDefault();
                break;
            case 'delete':
                if (this.selectedObjects.size > 0 && event.key === 'Delete') {
                    this.deleteSelectedObjects();
                    event.preventDefault();
                }
                break;
            case 'tab':
                this.cycleSelection(event.shiftKey ? -1 : 1);
                event.preventDefault();
                break;
            case 'a':
                if (event.ctrlKey || event.metaKey) {
                    this.selectAll();
                    event.preventDefault();
                }
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
    
    // Multi-selection methods
    selectObject(object, replaceSelection = false) {
        if (!object) return;
        
        if (replaceSelection) {
            this.deselectAll();
        }
        
        if (this.selectedObjects.has(object)) {
            console.log('🎯 Object already selected:', object.name);
            return;
        }
        
        console.log('🎯 Selecting object:', object.name);
        
        // Add to selection set
        this.selectedObjects.add(object);
        object.userData.selected = true;
        
        // Set as primary selection (for TransformControls)
        this.primarySelection = object;
        
        // Apply selection visualization
        this.applySelectionVisualization(object);
        
        // Update TransformControls
        this.updateTransformControls();
        
        // Show keyboard shortcuts if first selection
        if (this.selectedObjects.size === 1) {
            this.showKeyboardShortcuts();
        }
        
        // Dispatch event
        this.dispatchEvent({ 
            type: 'object-selected', 
            object: object, 
            selectedObjects: Array.from(this.selectedObjects),
            primarySelection: this.primarySelection
        });
        
        console.log(`✅ Object selected (${this.selectedObjects.size} total selected)`);
    }
    
    toggleObjectSelection(object) {
        if (!object) return;
        
        if (this.selectedObjects.has(object)) {
            this.deselectObject(object);
        } else {
            this.selectObject(object, false); // Don't replace selection
        }
    }
    
    selectRange(startObject, endObject) {
        if (!startObject || !endObject) return;
        
        const startIndex = this.selectableObjects.indexOf(startObject);
        const endIndex = this.selectableObjects.indexOf(endObject);
        
        if (startIndex === -1 || endIndex === -1) {
            console.warn('⚠️ Range selection failed - objects not in selectable list');
            return;
        }
        
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        
        console.log(`🎯 Selecting range from ${startObject.name} to ${endObject.name}`);
        
        // Clear current selection
        this.deselectAll();
        
        // Select all objects in range
        for (let i = minIndex; i <= maxIndex; i++) {
            this.selectObject(this.selectableObjects[i], false);
        }
    }
    
    deselectObject(object) {
        // If no specific object provided, deselect primary selection
        if (!object) {
            object = this.primarySelection;
        }
        
        if (!object || !this.selectedObjects.has(object)) {
            console.log('🎯 Deselect called but object not selected');
            return;
        }
        
        console.log('🎯 Deselecting object:', object.name);
        
        // Remove from selection set
        this.selectedObjects.delete(object);
        object.userData.selected = false;
        
        // Clear visualization for this object
        this.clearSelectionVisualization(object);
        
        // Update primary selection
        if (this.primarySelection === object) {
            // Set new primary selection to first remaining object
            this.primarySelection = this.selectedObjects.size > 0 
                ? this.selectedObjects.values().next().value 
                : null;
        }
        
        // Update TransformControls
        this.updateTransformControls();
        
        // Hide shortcuts if no selection
        if (this.selectedObjects.size === 0) {
            this.hideKeyboardShortcuts();
        }
        
        // Dispatch event
        this.dispatchEvent({ 
            type: 'object-deselected', 
            object: object,
            selectedObjects: Array.from(this.selectedObjects),
            primarySelection: this.primarySelection
        });
        
        console.log(`✅ Object deselected (${this.selectedObjects.size} remaining selected)`);
    }
    
    deselectAll() {
        if (this.selectedObjects.size === 0) {
            console.log('🎯 Deselect all called - no objects selected');
            return;
        }
        
        console.log(`🎯 Deselecting all objects (${this.selectedObjects.size} selected)`);
        
        // Clear all selections
        const objectsToDeselect = Array.from(this.selectedObjects);
        
        objectsToDeselect.forEach(object => {
            object.userData.selected = false;
            this.clearSelectionVisualization(object);
        });
        
        // Clear state
        this.selectedObjects.clear();
        this.primarySelection = null;
        
        // Update TransformControls
        this.updateTransformControls();
        
        // Hide shortcuts
        this.hideKeyboardShortcuts();
        
        // Dispatch event
        this.dispatchEvent({ 
            type: 'selection-cleared',
            deselectedObjects: objectsToDeselect
        });
        
        console.log('✅ All objects deselected');
    }
    
    deleteSelectedObjects() {
        if (this.selectedObjects.size === 0) return;
        
        const objectsToDelete = Array.from(this.selectedObjects);
        console.log(`🗑️ Deleting ${objectsToDelete.length} selected objects`);
        
        // Deselect all first
        this.deselectAll();
        
        // Delete each object
        objectsToDelete.forEach(object => {
            // Remove from scene
            if (object.parent) {
                object.parent.remove(object);
            }
            
            // Dispose of resources
            object.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });
        
        // Update selectable objects
        this.updateSelectableObjects();
        
        // Dispatch event
        this.dispatchEvent({ 
            type: 'objects-deleted', 
            deletedObjects: objectsToDelete 
        });
    }
    
    selectAll() {
        console.log('🎯 Selecting all objects');
        this.selectableObjects.forEach(object => {
            this.selectObject(object, false);
        });
    }
    
    // Visualization helper methods
    applySelectionVisualization(object) {
        if (this.selectionVisualization) {
            this.selectionVisualization.applySelection(object);
        } else {
            this.createEdgesSelection(object);
        }
    }
    
    clearSelectionVisualization(object) {
        if (this.selectionVisualization) {
            this.selectionVisualization.clearSelection(object);
        } else {
            this.removeEdgesSelection(object);
        }
    }
    
    // TransformControls integration for multi-selection
    updateTransformControls() {
        if (!this.transformControls) return;
        
        if (this.primarySelection) {
            // Attach TransformControls to primary selection
            console.log('🔧 Attaching TransformControls to primary selection:', this.primarySelection.name);
            if (this.scene && this.transformControls.parent !== this.scene) {
                this.scene.add(this.transformControls);
            }
            this.transformControls.attach(this.primarySelection);
        } else {
            // No selection - detach and remove TransformControls
            console.log('🔧 No primary selection - detaching TransformControls');
            this.transformControls.detach();
            if (this.scene && this.transformControls.parent === this.scene) {
                this.scene.remove(this.transformControls);
            }
        }
    }
    
    cycleSelection(direction = 1) {
        if (this.selectableObjects.length === 0) return;
        
        let currentIndex = -1;
        if (this.primarySelection) {
            currentIndex = this.selectableObjects.indexOf(this.primarySelection);
        }
        
        let nextIndex = currentIndex + direction;
        if (nextIndex >= this.selectableObjects.length) {
            nextIndex = 0;
        } else if (nextIndex < 0) {
            nextIndex = this.selectableObjects.length - 1;
        }
        
        this.selectObject(this.selectableObjects[nextIndex], true); // Replace selection
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
        
        // If we have a primary selection, attach it
        if (this.primarySelection) {
            this.transformControls.attach(this.primarySelection);
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
    
    // Public API methods (updated for multi-selection)
    getSelectedObjects() { return Array.from(this.selectedObjects); }
    getPrimarySelection() { return this.primarySelection; }
    getSelectedObject() { return this.primarySelection; } // Legacy compatibility
    isSelected(object) { return this.selectedObjects.has(object); }
    hasSelection() { return this.selectedObjects.size > 0; }
    getSelectionCount() { return this.selectedObjects.size; }
    
    // Cleanup
    dispose() {
        console.log('🗑️ Disposing OptimizedSelectionSystem...');
        
        // Deselect all objects
        this.deselectAll();
        
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