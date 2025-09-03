// Object Manipulation System
// Handles XZ plane movement and Y-axis rotation for selected objects

class ObjectManipulator {
    constructor(scene, camera, renderer, objectSelector) {
        console.log('🏗️ ObjectManipulator constructor called');
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.objectSelector = objectSelector;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Manipulation state
        this.isManipulating = false;
        this.manipulationMode = null; // 'move' or 'rotate'
        this.selectedObject = null;
        
        // Movement variables
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.startPosition = new THREE.Vector3();
        this.startMousePosition = new THREE.Vector3();
        this.currentMousePosition = new THREE.Vector3();
        
        // Rotation variables
        this.startRotation = 0;
        this.startMouseAngle = 0;
        this.rotationHandle = null;
        this.rotationHandleMaterial = null;
        
        // Visual helpers
        this.manipulationHelpers = new THREE.Group();
        this.manipulationHelpers.userData.isManipulationHelper = true;
        this.scene.add(this.manipulationHelpers);
        
        // Bind event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Listen for object selection changes
        window.addEventListener('objectSelected', this.onObjectSelected.bind(this));
        window.addEventListener('objectDeselected', this.onObjectDeselected.bind(this));
        
        // Store reference globally
        window.objectManipulator = this;
    }
    
    setupEventListeners() {
        console.log('🔧 Setting up ObjectManipulator event listeners...');
        
        try {
            // Override OrbitControls by intercepting their domElement directly
            const originalDomElement = this.renderer.domElement;
            console.log('📺 Renderer domElement:', originalDomElement?.tagName);
            
            if (!originalDomElement) {
                console.error('❌ No renderer domElement found!');
                return;
            }
            
            // Add our own listeners with immediate capture and non-passive
            originalDomElement.addEventListener('mousedown', this.onMouseDown, { capture: true, passive: false });
            originalDomElement.addEventListener('mousemove', this.onMouseMove, { capture: true, passive: false });  
            originalDomElement.addEventListener('mouseup', this.onMouseUp, { capture: true, passive: false });
            
            console.log('🎧 ObjectManipulator event listeners added to renderer domElement with capture');
        } catch (error) {
            console.error('❌ Error setting up ObjectManipulator event listeners:', error);
        }
    }
    
    onObjectSelected(event) {
        this.selectedObject = event.detail.object;
        console.log('🎯 ObjectManipulator: Object selected, creating helpers...', this.selectedObject.name);
        this.createManipulationHelpers();
    }
    
    onObjectDeselected(event) {
        console.log('🎯 ObjectManipulator: Object deselected, clearing helpers');
        this.selectedObject = null;
        this.clearManipulationHelpers();
    }
    
    createManipulationHelpers() {
        if (!this.selectedObject) return;
        
        this.clearManipulationHelpers();
        
        // Create rotation handle (circular ring around the object)
        this.createRotationHandle();
    }
    
    createRotationHandle() {
        if (!this.selectedObject) return;
        
        // Get bounding box to determine handle size and position
        const bbox = new THREE.Box3().setFromObject(this.selectedObject);
        const size = bbox.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.z);
        const handleRadius = maxDimension * 0.7; // Ring around object
        const ringThickness = Math.max(0.2, maxDimension * 0.1); // Thicker ring, minimum 0.2 units
        
        console.log('🎯 Creating rotation handle:', {
            objectName: this.selectedObject.name,
            boundingBox: size,
            maxDimension,
            handleRadius,
            ringThickness
        });
        
        // Create ring geometry for rotation handle - much thicker for easier clicking
        const ringGeometry = new THREE.RingGeometry(handleRadius, handleRadius + ringThickness, 32);
        
        // Create material that's always visible
        this.rotationHandleMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.6,
            depthTest: false, // Always render on top
            side: THREE.DoubleSide
        });
        
        this.rotationHandle = new THREE.Mesh(ringGeometry, this.rotationHandleMaterial);
        
        // Position the handle at the top of the object's bounding box
        this.rotationHandle.position.copy(this.selectedObject.position);
        this.rotationHandle.position.y = bbox.max.y + 0.1; // At top of object + small offset
        this.rotationHandle.rotation.x = -Math.PI / 2; // Lay flat (horizontal)
        
        // Mark as manipulation helper
        this.rotationHandle.userData.isRotationHandle = true;
        this.rotationHandle.userData.isManipulationHelper = true;
        
        console.log('🎯 Rotation handle positioned at:', this.rotationHandle.position);
        
        this.manipulationHelpers.add(this.rotationHandle);
    }
    
    clearManipulationHelpers() {
        // Remove all helper objects
        while (this.manipulationHelpers.children.length > 0) {
            const child = this.manipulationHelpers.children[0];
            this.manipulationHelpers.remove(child);
            
            // Dispose of geometry and material
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
        
        this.rotationHandle = null;
        this.rotationHandleMaterial = null;
    }
    
    onMouseDown(event) {
        // This should fire on EVERY click over the canvas
        console.log('🖱️ ObjectManipulator: Raw mouse down event received', {
            hasSelectedObject: !!this.selectedObject,
            selectedObjectName: this.selectedObject?.name,
            button: event.button,
            clientX: event.clientX,
            clientY: event.clientY,
            target: event.target?.tagName,
            currentTarget: event.currentTarget?.tagName || 'unknown'
        });
        
        if (event.button !== 0) return; // Only handle left mouse button
        
        if (!this.selectedObject) {
            console.log('❌ No object selected, skipping manipulation check');
            return;
        }
        
        // Check if click is over the canvas area
        const canvasRect = this.renderer.domElement.getBoundingClientRect();
        const isOverCanvas = event.clientX >= canvasRect.left && 
                           event.clientX <= canvasRect.right &&
                           event.clientY >= canvasRect.top && 
                           event.clientY <= canvasRect.bottom;
                           
        if (!isOverCanvas) {
            return; // Click is outside canvas area
        }
        
        console.log('🖱️ ObjectManipulator: Mouse down detected over canvas');
        
        // Update mouse coordinates
        this.updateMouseCoordinates(event);
        
        // Check what we're clicking on
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Check if clicking on rotation handle FIRST (highest priority)
        const rotationHandleIntersect = this.rotationHandle ? 
            this.raycaster.intersectObject(this.rotationHandle) : [];
            
        console.log('🔍 Intersection check:', {
            rotationHandleHits: rotationHandleIntersect.length,
            mouseCoords: this.mouse,
            hasRotationHandle: !!this.rotationHandle,
            canvasRect: canvasRect
        });
            
        if (rotationHandleIntersect.length > 0) {
            console.log('🎯 Clicked on rotation handle - starting rotation');
            // IMMEDIATELY stop event propagation to prevent OrbitControls
            event.stopImmediatePropagation();
            event.preventDefault();
            // Start rotation mode
            this.startRotationManipulation(event);
            return;
        }
        
        // Check if clicking on the selected object for movement
        const objectIntersect = this.raycaster.intersectObject(this.selectedObject, true);
        console.log('🔍 Object intersection check:', {
            objectHits: objectIntersect.length,
            objectName: this.selectedObject.name
        });
        
        if (objectIntersect.length > 0) {
            console.log('🎯 Clicked on selected object - starting movement');
            // IMMEDIATELY stop event propagation to prevent OrbitControls
            event.stopImmediatePropagation();
            event.preventDefault();
            this.startMovementManipulation(event);
            return;
        }
        
        console.log('❌ No manipulation target found - allowing camera controls');
    }
    
    startMovementManipulation(event) {
        this.manipulationMode = 'move';
        this.isManipulating = true;
        
        // IMMEDIATELY disable orbit controls during manipulation
        if (window.controls) {
            console.log('🚫 Disabling OrbitControls for movement');
            window.controls.enabled = false;
        }
        
        // Store starting positions
        this.startPosition.copy(this.selectedObject.position);
        
        // Get intersection point on ground plane
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersection = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.groundPlane, intersection);
        this.startMousePosition.copy(intersection);
        
        // Change cursor
        this.renderer.domElement.style.cursor = 'move';
        
        console.log('✅ Started movement manipulation at:', {
            startPosition: this.startPosition,
            startMousePosition: this.startMousePosition
        });
    }
    
    startRotationManipulation(event) {
        this.manipulationMode = 'rotate';
        this.isManipulating = true;
        
        // IMMEDIATELY disable orbit controls during manipulation
        if (window.controls) {
            console.log('🚫 Disabling OrbitControls for rotation');
            window.controls.enabled = false;
        }
        
        // Store starting rotation
        this.startRotation = this.selectedObject.rotation.y;
        
        // Calculate starting mouse angle relative to object
        const objectPos = this.selectedObject.position.clone();
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersection = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.groundPlane, intersection);
        
        const mouseRelative = intersection.clone().sub(objectPos);
        this.startMouseAngle = Math.atan2(mouseRelative.z, mouseRelative.x);
        
        // Change cursor and handle color
        this.renderer.domElement.style.cursor = 'grab';
        if (this.rotationHandleMaterial) {
            this.rotationHandleMaterial.color.setHex(0xff8800); // Orange when active
            this.rotationHandleMaterial.opacity = 0.8;
        }
        
        console.log('✅ Started rotation manipulation at:', {
            startRotation: this.startRotation * (180/Math.PI),
            startMouseAngle: this.startMouseAngle * (180/Math.PI)
        });
    }
    
    onMouseMove(event) {
        if (!this.selectedObject) return;
        
        // Check if mouse is over canvas for hover effects
        const canvasRect = this.renderer.domElement.getBoundingClientRect();
        const isOverCanvas = event.clientX >= canvasRect.left && 
                           event.clientX <= canvasRect.right &&
                           event.clientY >= canvasRect.top && 
                           event.clientY <= canvasRect.bottom;
        
        this.updateMouseCoordinates(event);
        
        if (this.isManipulating) {
            // Stop event propagation during manipulation to prevent camera movement
            event.stopImmediatePropagation();
            event.preventDefault();
            
            if (this.manipulationMode === 'move') {
                this.updateMovement();
            } else if (this.manipulationMode === 'rotate') {
                this.updateRotation();
            }
        } else if (isOverCanvas) {
            // Handle hover effects for manipulation handles only when over canvas
            this.updateHoverEffects();
        }
    }
    
    updateMovement() {
        // Get current mouse position on ground plane
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersection = new THREE.Vector3();
        
        if (this.raycaster.ray.intersectPlane(this.groundPlane, intersection)) {
            // Calculate movement delta
            const movement = intersection.clone().sub(this.startMousePosition);
            
            // Apply movement to object (only in XZ plane)
            const newPosition = this.startPosition.clone().add(movement);
            newPosition.y = this.selectedObject.position.y; // Maintain Y position
            
            console.log('📍 Moving object:', {
                objectName: this.selectedObject.name,
                movement: movement,
                newPosition: newPosition
            });
            
            this.selectedObject.position.copy(newPosition);
            
            // Update rotation handle position (keep it at top of object)
            if (this.rotationHandle) {
                const bbox = new THREE.Box3().setFromObject(this.selectedObject);
                this.rotationHandle.position.copy(newPosition);
                this.rotationHandle.position.y = bbox.max.y + 0.1;
            }
        }
    }
    
    updateRotation() {
        // Get current mouse position on ground plane
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersection = new THREE.Vector3();
        
        if (this.raycaster.ray.intersectPlane(this.groundPlane, intersection)) {
            // Calculate current mouse angle relative to object
            const objectPos = this.selectedObject.position.clone();
            const mouseRelative = intersection.clone().sub(objectPos);
            const currentMouseAngle = Math.atan2(mouseRelative.z, mouseRelative.x);
            
            // Calculate rotation delta
            const rotationDelta = currentMouseAngle - this.startMouseAngle;
            const newRotation = this.startRotation + rotationDelta;
            
            console.log('🔄 Rotating object:', {
                objectName: this.selectedObject.name,
                currentMouseAngle: currentMouseAngle * (180/Math.PI),
                startMouseAngle: this.startMouseAngle * (180/Math.PI),
                rotationDelta: rotationDelta * (180/Math.PI),
                newRotation: newRotation * (180/Math.PI)
            });
            
            // Apply rotation (only around Y axis)
            this.selectedObject.rotation.y = newRotation;
        }
    }
    
    updateHoverEffects() {
        // Check if hovering over rotation handle
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const rotationHandleIntersect = this.rotationHandle ? 
            this.raycaster.intersectObject(this.rotationHandle) : [];
            
        if (rotationHandleIntersect.length > 0) {
            // Hovering over rotation handle
            this.renderer.domElement.style.cursor = 'grab';
            if (this.rotationHandleMaterial && !this.isManipulating) {
                this.rotationHandleMaterial.opacity = 0.8;
            }
        } else {
            // Check if hovering over selected object
            const objectIntersect = this.selectedObject ? 
                this.raycaster.intersectObject(this.selectedObject, true) : [];
                
            if (objectIntersect.length > 0) {
                this.renderer.domElement.style.cursor = 'move';
            } else {
                this.renderer.domElement.style.cursor = 'auto';
            }
            
            // Reset rotation handle opacity when not hovering
            if (this.rotationHandleMaterial && !this.isManipulating) {
                this.rotationHandleMaterial.opacity = 0.6;
            }
        }
    }
    
    onMouseUp(event) {
        if (this.isManipulating) {
            // Stop event propagation during manipulation cleanup
            event.stopImmediatePropagation();
            event.preventDefault();
            this.stopManipulation();
        }
    }
    
    stopManipulation() {
        console.log('🔄 Stopping manipulation, re-enabling OrbitControls');
        
        this.isManipulating = false;
        this.manipulationMode = null;
        
        // Re-enable orbit controls
        if (window.controls) {
            window.controls.enabled = true;
            console.log('✅ OrbitControls re-enabled');
        }
        
        // Reset cursor
        this.renderer.domElement.style.cursor = 'auto';
        
        // Reset rotation handle color
        if (this.rotationHandleMaterial) {
            this.rotationHandleMaterial.color.setHex(0x00ff00); // Back to green
            this.rotationHandleMaterial.opacity = 0.6;
        }
        
        console.log('✅ Manipulation stopped successfully');
    }
    
    updateMouseCoordinates(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    // Update helpers when object position changes externally
    updateHelperPositions() {
        if (this.selectedObject && this.rotationHandle) {
            this.rotationHandle.position.copy(this.selectedObject.position);
            this.rotationHandle.position.y = 0.01;
        }
    }
    
    // Dispose of resources
    dispose() {
        // Remove from renderer element
        this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown, { capture: true });
        this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove, { capture: true });
        this.renderer.domElement.removeEventListener('mouseup', this.onMouseUp, { capture: true });
        
        window.removeEventListener('objectSelected', this.onObjectSelected);
        window.removeEventListener('objectDeselected', this.onObjectDeselected);
        
        this.clearManipulationHelpers();
        
        if (this.manipulationHelpers.parent) {
            this.manipulationHelpers.parent.remove(this.manipulationHelpers);
        }
    }
}

// Initialize object manipulation when DOM is ready
function setupObjectManipulation() {
    console.log('🔧 Attempting to setup object manipulation system...');
    console.log('Dependencies check:', {
        scene: !!window.scene,
        camera: !!window.camera,
        renderer: !!window.renderer,
        objectSelector: !!window.objectSelector
    });
    
    // Wait for other systems to be ready
    if (window.scene && window.camera && window.renderer && window.objectSelector) {
        const manipulator = new ObjectManipulator(
            window.scene, 
            window.camera, 
            window.renderer, 
            window.objectSelector
        );
        
        console.log('✅ Object manipulation system initialized successfully');
        return manipulator;
    } else {
        console.warn('⏳ Object manipulation system waiting for dependencies...');
        // Retry after a short delay
        setTimeout(setupObjectManipulation, 500);
    }
}

// Export to global scope
window.ObjectManipulator = ObjectManipulator;
window.setupObjectManipulation = setupObjectManipulation;