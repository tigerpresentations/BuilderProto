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
                
                // Get the mesh's transform relative to the selected object (not world)
                const meshWorldMatrix = new THREE.Matrix4();
                const objectWorldMatrix = new THREE.Matrix4();
                const relativeMatrix = new THREE.Matrix4();
                
                child.updateMatrixWorld(true);
                object.updateMatrixWorld(true);
                
                meshWorldMatrix.copy(child.matrixWorld);
                objectWorldMatrix.copy(object.matrixWorld);
                
                // Calculate relative transform: mesh transform relative to object
                relativeMatrix.copy(meshWorldMatrix).premultiply(objectWorldMatrix.invert());
                
                // Apply the relative transform to wireframe
                wireframe.matrix.copy(relativeMatrix);
                wireframe.matrixAutoUpdate = false;
                
                console.log(`🔧 Wireframe for ${child.name || 'mesh'}: relative transform applied`);
                
                this.selectionHelper.add(wireframe);
            }
        });
        
        // CRITICAL: Add wireframe as child of the selected object
        // This ensures it automatically inherits all transformations
        object.add(this.selectionHelper);
        
        console.log('✅ Wireframe added as child of selected object - will follow all transforms');
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
        if (this.selectionHelper && this.selectedObject) {
            // Remove wireframe from its parent object
            if (this.selectionHelper.parent) {
                this.selectionHelper.parent.remove(this.selectionHelper);
            }
            
            // Clean up resources
            if (this.resourceManager && this.resourceManager.disposeGroup) {
                this.resourceManager.disposeGroup(this.selectionHelper);
            } else {
                // Manual cleanup fallback
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
    
    // Update selection if object moves (not needed anymore since wireframe is a child)
    updateSelection() {
        // Since wireframe is now a child of the selected object,
        // it automatically inherits all transforms - no manual update needed
        if (this.selectedObject && this.selectionHelper) {
            // Force matrix updates to ensure wireframe follows immediately
            this.selectedObject.updateMatrixWorld(true);
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