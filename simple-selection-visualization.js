// Simple Selection Visualization using standard Three.js
// No post-processing dependencies, better performance on all devices

class SimpleSelectionVisualization {
    constructor(scene, resourceManager = window.resourceManager) {
        this.scene = scene;
        this.resourceManager = resourceManager;
        this.selectionHelper = null;
        this.originalMaterials = new Map();
        
        // Create materials - fallback to direct Three.js if resourceManager not available
        if (this.resourceManager && this.resourceManager.createBasicMaterial) {
            this.selectionMaterial = this.resourceManager.createBasicMaterial({
                color: 0x00ff00,
                wireframe: true,
                wireframeLinewidth: 2,
                transparent: true,
                opacity: 1.0,
                depthTest: true,
                depthWrite: false
            });
            
            this.edgeMaterial = this.resourceManager.createLineMaterial({
                color: 0x00ff00,
                linewidth: 2,
                transparent: true,
                opacity: 0.8
            });
            
            console.log('✅ Simple selection visualization initialized with ResourceManager');
        } else {
            // Fallback: create materials directly
            this.selectionMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                wireframe: true,
                wireframeLinewidth: 2,
                transparent: true,
                opacity: 1.0,
                depthTest: true,
                depthWrite: false
            });
            
            this.edgeMaterial = new THREE.LineBasicMaterial({
                color: 0x00ff00,
                linewidth: 2,
                transparent: true,
                opacity: 0.8
            });
            
            console.log('✅ Simple selection visualization initialized (fallback mode)');
        }
    }
    
    // Apply selection visualization to an object
    applySelection(object) {
        if (!object) return;
        
        console.log('🎨 Applying simple selection to:', object.name);
        
        // Clear any previous selection
        this.clearSelection();
        
        // Method 1: Simple wireframe overlay
        this.createWireframeOverlay(object);
        
        // Store reference
        this.selectedObject = object;
    }
    
    // Create a wireframe overlay for selection
    createWireframeOverlay(object) {
        // Create a group to hold selection helpers
        this.selectionHelper = new THREE.Group();
        this.selectionHelper.name = 'SelectionHelper';
        
        // Register with resource manager if available
        if (this.resourceManager && this.resourceManager.registerGroup) {
            this.resourceManager.registerGroup(this.selectionHelper);
        }
        
        // Traverse object and create wireframe for each mesh
        object.traverse((child) => {
            if (child.isMesh) {
                // Create wireframe geometry
                let wireframeGeometry;
                if (this.resourceManager && this.resourceManager.createWireframeGeometry) {
                    wireframeGeometry = this.resourceManager.createWireframeGeometry(child.geometry);
                } else {
                    wireframeGeometry = new THREE.WireframeGeometry(child.geometry);
                }
                
                const wireframe = new THREE.LineSegments(wireframeGeometry, this.edgeMaterial);
                
                // Register the wireframe mesh if resource manager available
                if (this.resourceManager && this.resourceManager.registerMesh) {
                    this.resourceManager.registerMesh(wireframe);
                }
                
                // Match the transform of the original mesh
                wireframe.position.copy(child.position);
                wireframe.rotation.copy(child.rotation);
                wireframe.scale.copy(child.scale);
                
                // Update matrices
                child.updateMatrixWorld(true);
                wireframe.matrixWorld.copy(child.matrixWorld);
                
                this.selectionHelper.add(wireframe);
            }
        });
        
        // Match the parent object's transform
        object.updateMatrixWorld(true);
        this.selectionHelper.matrixWorld.copy(object.matrixWorld);
        
        // Add to scene
        this.scene.add(this.selectionHelper);
    }
    
    // Alternative: Create bounding box visualization
    createBoundingBoxSelection(object) {
        // Calculate bounding box
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Create box geometry and edges using resource manager
        const geometry = this.resourceManager.registerGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));
        const edges = this.resourceManager.createEdgesGeometry(geometry);
        const boxHelper = new THREE.LineSegments(edges, this.edgeMaterial);
        
        // Register with resource manager
        this.resourceManager.registerMesh(boxHelper);
        
        boxHelper.position.copy(center);
        boxHelper.name = 'SelectionBox';
        
        this.selectionHelper = boxHelper;
        this.scene.add(this.selectionHelper);
    }
    
    // Alternative: Material swapping method (changes object appearance)
    applyMaterialSelection(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                // Store original material
                this.originalMaterials.set(child, child.material);
                
                // Apply selection material
                child.material = this.selectionMaterial;
            }
        });
    }
    
    // Clear material selection
    clearMaterialSelection() {
        this.originalMaterials.forEach((material, mesh) => {
            mesh.material = material;
        });
        this.originalMaterials.clear();
    }
    
    // Clear selection visualization
    clearSelection() {
        if (this.selectionHelper) {
            // Use resource manager if available, otherwise manual cleanup
            if (this.resourceManager && this.resourceManager.disposeGroup) {
                if (this.selectionHelper.isGroup) {
                    this.resourceManager.disposeGroup(this.selectionHelper);
                } else {
                    this.resourceManager.disposeMesh(this.selectionHelper);
                }
            } else {
                // Manual cleanup fallback
                this.scene.remove(this.selectionHelper);
                this.selectionHelper.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                });
            }
            
            this.selectionHelper = null;
        }
        
        // Clear material selections if any
        if (this.originalMaterials.size > 0) {
            this.clearMaterialSelection();
        }
        
        this.selectedObject = null;
    }
    
    // Update selection if object moves
    updateSelection() {
        if (this.selectedObject && this.selectionHelper) {
            // Update helper position to match object
            this.selectedObject.updateMatrixWorld(true);
            this.selectionHelper.matrixWorld.copy(this.selectedObject.matrixWorld);
        }
    }
    
    // Dispose of resources using standard Three.js pattern
    dispose() {
        this.clearSelection();
        
        // Materials will be disposed by resource manager
        // No need to manually dispose here
        
        console.log('🗑️ Simple selection visualization disposed');
    }
}

// Export to global scope
window.SimpleSelectionVisualization = SimpleSelectionVisualization;