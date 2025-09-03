// Object selection system with raycasting
class ObjectSelector {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.selectedObject = null;
        this.selectionOutline = null;
        this.selectableObjects = [];
        
        // Mouse tracking for drag detection
        this.mouseDownPos = new THREE.Vector2();
        this.mouseUpPos = new THREE.Vector2();
        this.isDragging = false;
        this.dragThreshold = 3; // pixels - reduced for better responsiveness
        this.clickProcessed = false;
        this.previousSelectedObject = undefined;
        
        // Camera state tracking to detect OrbitControls usage
        this.cameraStartPos = new THREE.Vector3();
        this.cameraStartRot = new THREE.Euler();
        
        // Outline material for selection indicator
        this.outlineMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            side: THREE.BackSide
        });
        
        // Original materials storage for highlight effect
        this.originalMaterials = new Map();
        this.highlightMaterial = new THREE.MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.3
        });
        
        // Bind event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseClick = this.onMouseClick.bind(this);
        
        // Use click event for selection since mousedown is being blocked by OrbitControls
        this.renderer.domElement.addEventListener('click', this.onMouseClick);
        this.renderer.domElement.addEventListener('mousemove', this.onMouseMove);
        
        // Store reference globally
        window.objectSelector = this;
    }
    
    // Add objects to the selectable list
    addSelectableObject(object) {
        if (object && object.isMesh) {
            this.selectableObjects.push(object);
            // Add custom property to track selection
            object.userData.selectable = true;
            object.userData.selected = false;
        }
    }
    
    // Update selectable objects (call after loading new models)
    updateSelectableObjects() {
        this.selectableObjects = [];
        
        // Find the loaded model root (should be a direct child of scene)
        this.scene.children.forEach(child => {
            // Skip floor, lights, and other non-model objects (intentionally non-selectable)
            if (child === window.floor || child.isLight || child.type === 'HemisphereLight') {
                return;
            }
            
            // If it's a group/model containing meshes, add all its meshes for raycasting
            // but tag them with their root model for selection
            if (child.type === 'Group' || child.type === 'Object3D') {
                child.traverse((node) => {
                    if (node.isMesh) {
                        // Tag each mesh with its root model
                        node.userData.rootModel = child;
                        node.userData.selectable = true;
                        this.selectableObjects.push(node);
                    }
                });
            } else if (child.isMesh) {
                // Single mesh at root level
                child.userData.rootModel = child;
                child.userData.selectable = true;
                this.selectableObjects.push(child);
            }
        });
        
        console.log(`Updated selectable objects: ${this.selectableObjects.length} meshes for raycasting`);
    }
    
    // Handle mouse click for selection
    onMouseClick(event) {
        // Calculate mouse position in normalized device coordinates
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Calculate objects intersecting the picking ray
        const intersects = this.raycaster.intersectObjects(this.selectableObjects, true);
        
        if (intersects.length > 0) {
            // Get the first (closest) intersected object
            const hitMesh = intersects[0].object;
            
            // Get the root model that this mesh belongs to
            const modelToSelect = hitMesh.userData.rootModel || hitMesh;
            
            // Only change selection if clicking a different model
            if (modelToSelect !== this.selectedObject) {
                this.selectObject(modelToSelect);
            }
        } else {
            // Clicked on empty space/background - deselect
            this.deselectObject();
        }
    }
    
    // Handle mouse down - do selection immediately
    onMouseDown(event) {
        // Only handle left mouse button
        if (event.button !== 0) return;
        
        console.log('Mouse down detected');
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouseDownPos.x = event.clientX - rect.left;
        this.mouseDownPos.y = event.clientY - rect.top;
        
        // Store initial state
        this.isDragging = false;
        this.clickProcessed = false;
        
        // Store camera state to detect if OrbitControls moved the camera
        this.cameraStartPos.copy(this.camera.position);
        
        // Process selection IMMEDIATELY on mousedown for better responsiveness
        // We'll validate it wasn't a drag on mouseup
        console.log('Processing selection...');
        this.processSelection(event);
        this.clickProcessed = true;
    }
    
    // Handle mouse up - validate if it was actually a drag
    onMouseUp(event) {
        // Only handle left mouse button
        if (event.button !== 0) return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouseUpX = event.clientX - rect.left;
        const mouseUpY = event.clientY - rect.top;
        
        // Calculate how far mouse moved
        const mouseDistance = Math.sqrt(
            Math.pow(mouseUpX - this.mouseDownPos.x, 2) +
            Math.pow(mouseUpY - this.mouseDownPos.y, 2)
        );
        
        // Check if camera rotated significantly
        const cameraMoved = this.cameraStartPos.distanceTo(this.camera.position) > 0.01;
        
        // Only revert if it was a significant drag or camera movement
        // Use more generous thresholds to avoid reverting valid clicks
        const wasSignificantDrag = mouseDistance > 10; // Increased from 3 to 10
        const wasSignificantCameraMove = cameraMoved && mouseDistance > 5; // Only revert camera moves with some mouse movement
        
        if ((wasSignificantDrag || wasSignificantCameraMove) && this.clickProcessed) {
            // Restore previous selection state if we incorrectly processed a drag as a click
            if (this.previousSelectedObject !== undefined) {
                if (this.previousSelectedObject) {
                    this.selectObject(this.previousSelectedObject);
                } else {
                    this.deselectObject();
                }
            }
        }
        
        this.isDragging = false;
        this.clickProcessed = false;
    }
    
    // Process selection immediately
    processSelection(event) {
        console.log('processSelection called, selectable objects:', this.selectableObjects.length);
        
        // Store previous selection for potential rollback
        this.previousSelectedObject = this.selectedObject;
        
        // Use the MOUSEDOWN position for raycasting
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = (this.mouseDownPos.x / rect.width) * 2 - 1;
        this.mouse.y = -(this.mouseDownPos.y / rect.height) * 2 + 1;
        
        console.log('Mouse coords:', this.mouse.x, this.mouse.y);
        
        // Update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Calculate objects intersecting the picking ray (recursive = true for child meshes)
        const intersects = this.raycaster.intersectObjects(this.selectableObjects, true);
        
        console.log('Intersections found:', intersects.length);
        
        if (intersects.length > 0) {
            // Get the first (closest) intersected object
            const hitMesh = intersects[0].object;
            console.log('Hit mesh:', hitMesh.name);
            
            // Get the root model that this mesh belongs to
            const modelToSelect = hitMesh.userData.rootModel || hitMesh;
            console.log('Model to select:', modelToSelect.name);
            
            // Only change selection if clicking a different model
            if (modelToSelect !== this.selectedObject) {
                console.log('Selecting new model');
                this.selectObject(modelToSelect);
            } else {
                console.log('Same model already selected');
            }
            // Note: We don't deselect when clicking the same object
        } else {
            // Clicked on empty space/background - deselect
            console.log('No intersection - deselecting');
            this.deselectObject();
        }
    }
    
    // Handle mouse movement for hover effects and drag detection
    onMouseMove(event) {
        // Check if we're dragging (mouse is down and moving)
        if (event.buttons === 1) { // Left mouse button is pressed
            const rect = this.renderer.domElement.getBoundingClientRect();
            const currentX = event.clientX - rect.left;
            const currentY = event.clientY - rect.top;
            
            // Calculate distance from mouse down position
            const distance = Math.sqrt(
                Math.pow(currentX - this.mouseDownPos.x, 2) +
                Math.pow(currentY - this.mouseDownPos.y, 2)
            );
            
            // Mark as dragging if moved beyond threshold
            if (distance >= this.dragThreshold) {
                this.isDragging = true;
            }
        }
        
        // Calculate mouse position in normalized device coordinates for hover
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update cursor based on hover state (only when not dragging)
        if (!this.isDragging) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.selectableObjects, false);
            
            if (intersects.length > 0) {
                this.renderer.domElement.style.cursor = 'pointer';
            } else {
                this.renderer.domElement.style.cursor = 'auto';
            }
        }
    }
    
    // Select an object
    selectObject(object) {
        // Deselect previous object
        this.deselectObject();
        
        // Set new selected object
        this.selectedObject = object;
        object.userData.selected = true;
        
        // Method 1: Add outline effect using a scaled clone
        this.addOutlineEffect(object);
        
        // Method 2: Change material emissive property (alternative)
        // this.addEmissiveHighlight(object);
        
        // Dispatch custom event for other modules to listen to
        window.dispatchEvent(new CustomEvent('objectSelected', { 
            detail: { 
                object: object,
                name: object.name || 'Unnamed Object',
                uuid: object.uuid,
                position: object.position.clone(),
                material: object.material
            }
        }));
        
    }
    
    // Deselect the current object
    deselectObject() {
        if (!this.selectedObject) return;
        
        // Remove outline effect
        this.removeOutlineEffect();
        
        // Remove emissive highlight (if using)
        // this.removeEmissiveHighlight();
        
        // Clear selection state
        this.selectedObject.userData.selected = false;
        
        // Dispatch deselection event
        window.dispatchEvent(new CustomEvent('objectDeselected', { 
            detail: { 
                object: this.selectedObject
            }
        }));
        
        this.selectedObject = null;
    }
    
    // Add outline effect to selected object/model
    addOutlineEffect(object) {
        // Remove any existing outline
        this.removeOutlineEffect();
        
        // Create outline group for multi-mesh models
        this.selectionOutline = new THREE.Group();
        
        // If the selected object is a group/model with multiple meshes
        if (object.type === 'Group' || object.type === 'Object3D') {
            object.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    // Create outline for each mesh in the model
                    const outlineMesh = new THREE.Mesh(
                        child.geometry,
                        this.outlineMaterial
                    );
                    
                    // Copy the world transform
                    child.updateMatrixWorld();
                    outlineMesh.matrix.copy(child.matrixWorld);
                    outlineMesh.matrix.decompose(
                        outlineMesh.position,
                        outlineMesh.quaternion,
                        outlineMesh.scale
                    );
                    outlineMesh.scale.multiplyScalar(1.03); // Slightly smaller scale for groups
                    
                    this.selectionOutline.add(outlineMesh);
                }
            });
        } else if (object.isMesh && object.geometry) {
            // Single mesh object
            const outlineMesh = new THREE.Mesh(
                object.geometry,
                this.outlineMaterial
            );
            
            outlineMesh.position.copy(object.position);
            outlineMesh.rotation.copy(object.rotation);
            outlineMesh.scale.copy(object.scale).multiplyScalar(1.05);
            
            this.selectionOutline.add(outlineMesh);
        }
        
        // Add the outline group to the scene
        this.scene.add(this.selectionOutline);
    }
    
    // Remove outline effect
    removeOutlineEffect() {
        if (this.selectionOutline) {
            // Remove from scene
            if (this.selectionOutline.parent) {
                this.selectionOutline.parent.remove(this.selectionOutline);
            }
            
            // Dispose of geometries if it's a group
            if (this.selectionOutline.type === 'Group') {
                this.selectionOutline.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        child.geometry.dispose();
                    }
                });
            } else if (this.selectionOutline.geometry) {
                // Single mesh
                this.selectionOutline.geometry.dispose();
            }
            
            this.selectionOutline = null;
        }
    }
    
    // Alternative: Add emissive highlight to selected object
    addEmissiveHighlight(object) {
        if (object.material) {
            // Store original material
            if (!this.originalMaterials.has(object.uuid)) {
                this.originalMaterials.set(object.uuid, object.material);
            }
            
            // Apply highlight by modifying material properties
            if (object.material.emissive !== undefined) {
                object.material.emissive = new THREE.Color(0x444400);
                object.material.emissiveIntensity = 0.3;
                object.material.needsUpdate = true;
            }
        }
    }
    
    // Remove emissive highlight
    removeEmissiveHighlight() {
        if (this.selectedObject && this.selectedObject.material) {
            // Restore original emissive properties
            if (this.selectedObject.material.emissive !== undefined) {
                this.selectedObject.material.emissive = new THREE.Color(0x000000);
                this.selectedObject.material.emissiveIntensity = 0;
                this.selectedObject.material.needsUpdate = true;
            }
        }
    }
    
    // Get currently selected object
    getSelectedObject() {
        return this.selectedObject;
    }
    
    // Check if an object is selected
    isSelected(object) {
        return object === this.selectedObject;
    }
    
    // Clear selection
    clearSelection() {
        this.deselectObject();
    }
    
    // Dispose of resources
    dispose() {
        this.renderer.domElement.removeEventListener('click', this.onMouseClick);
        this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove);
        this.removeOutlineEffect();
        this.deselectObject();
        this.selectableObjects = [];
        this.originalMaterials.clear();
    }
}

// Export to window global
window.ObjectSelector = ObjectSelector;