# Three.js Research: GLB Scene Placement System

## Problem Analysis

The requirement is to build a comprehensive GLB loading system with automatic floor placement, camera controls, and optional editing capabilities. This represents a common 3D web application pattern that needs to balance simplicity with functionality.

**Technical Challenges:**
- GLB bounding box calculation for automatic floor placement
- Drag-and-drop file handling with FileReader + GLTFLoader integration
- Material detection for "Image" materials in complex GLB hierarchies
- Real-time canvas-to-texture pipeline for texture editing
- Object manipulation (transform controls vs simple drag)
- Memory management for multiple GLB loads
- Background color integration

**Three.js Specific Considerations:**
- GLTFLoader requires async handling and proper resource disposal
- Canvas textures need `flipY = false` for GLB compatibility
- OrbitControls damping affects responsiveness vs smoothness
- Transform vs Drag controls have different UX implications

## Official Examples Research

**Key Three.js Examples Analyzed:**

1. **webgl_loader_gltf.html** - Shows standard GLTFLoader patterns:
   ```javascript
   const loader = new GLTFLoader().setPath('models/gltf/');
   loader.load('model.gltf', async function(gltf) {
       await renderer.compileAsync(model, camera, scene);
       scene.add(gltf.scene);
   });
   ```

2. **misc_controls_orbit.html** - OrbitControls best practices:
   ```javascript
   controls.enableDamping = true;
   controls.dampingFactor = 0.05;
   controls.minDistance = 2;
   controls.maxDistance = 10;
   ```

3. **three-gltf-viewer** (donmccurdy) - Production drag-and-drop GLB viewer
4. **threejs-cookbook drag-file-to-scene** - FileReader integration patterns

**Bounding Box Calculation Research:**
From Three.js forum discussions, the standard pattern is:
```javascript
const box = new THREE.Box3().setFromObject(gltf.scene);
gltf.scene.updateMatrixWorld(true); // Critical for accuracy
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());
```

## Recommended Approach

### Core Architecture

**1. Scene Setup & Floor Plane**
```javascript
// Floor plane that objects sit "on"
const floorGeometry = new THREE.PlaneGeometry(20, 20);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; // Horizontal
floor.position.y = -0.1; // Slightly below origin
scene.add(floor);
```

**2. Drag-and-Drop GLB Loading**
```javascript
// Drag and drop setup
function setupDragDrop() {
    const dropZone = renderer.domElement;
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.opacity = '0.8';
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.opacity = '1';
        
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
            loadGLBFromFile(file);
        }
    });
}

function loadGLBFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        loader.parse(arrayBuffer, '', (gltf) => {
            placeModelOnFloor(gltf.scene);
            findImageMaterials(gltf.scene);
        });
    };
    reader.readAsArrayBuffer(file);
}
```

**3. Automatic Floor Placement**
```javascript
function placeModelOnFloor(model) {
    // Ensure matrices are updated for accurate bounds
    model.updateMatrixWorld(true);
    
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Position model so its bottom sits on floor plane
    model.position.x = -center.x;
    model.position.y = -box.min.y; // Bottom of model at y=0 (floor level)
    model.position.z = -center.z;
    
    // Auto-scale if model is too large
    const maxDimension = Math.max(size.x, size.z);
    if (maxDimension > 5) {
        const scale = 5 / maxDimension;
        model.scale.setScalar(scale);
    }
    
    scene.add(model);
}
```

**4. OrbitControls Configuration**
```javascript
function setupControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05; // Balanced feel
    controls.minDistance = 1;
    controls.maxDistance = 50;
    controls.maxPolarAngle = Math.PI * 0.8; // Prevent going below floor
    controls.target.set(0, 0, 0); // Look at floor center
    controls.update();
}
```

### Nice-to-Have Features Implementation

**5. Material Detection for Canvas Textures**
```javascript
function findImageMaterials(model) {
    const imageMaterials = [];
    
    model.traverse((child) => {
        if (child.isMesh && child.material) {
            const material = child.material;
            const name = (material.name || '').toLowerCase();
            
            // Flexible material detection
            if (name === 'image' || name.includes('image') || 
                name.includes('texture') || name.includes('paint')) {
                imageMaterials.push(material);
            }
        }
    });
    
    return imageMaterials;
}
```

**6. Canvas-to-Texture Pipeline**
```javascript
function setupCanvasTexture(materials) {
    const canvas = document.getElementById('textureCanvas');
    const canvasTexture = new THREE.CanvasTexture(canvas);
    
    // Optimize for GLB compatibility
    canvasTexture.flipY = false;
    canvasTexture.generateMipmaps = false;
    canvasTexture.minFilter = THREE.LinearFilter;
    canvasTexture.magFilter = THREE.LinearFilter;
    canvasTexture.wrapS = THREE.ClampToEdgeWrapping;
    canvasTexture.wrapT = THREE.ClampToEdgeWrapping;
    
    // Apply to all image materials
    materials.forEach(material => {
        material.map = canvasTexture;
        material.needsUpdate = true;
    });
    
    return canvasTexture;
}

// Real-time updates
function updateTexture() {
    if (canvasTexture) {
        canvasTexture.needsUpdate = true;
    }
}
```

**7. Object Movement - Simple Drag Approach**
```javascript
// Simpler than TransformControls for basic movement
function setupObjectDrag() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDragging = false;
    let dragOffset = new THREE.Vector3();
    
    renderer.domElement.addEventListener('mousedown', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);
        
        if (intersects.length > 0 && intersects[0].object.parent === currentModel) {
            isDragging = true;
            controls.enabled = false; // Disable orbit while dragging
            
            // Calculate offset for smooth dragging
            const intersection = intersects[0];
            dragOffset.copy(intersection.point).sub(currentModel.position);
        }
    });
}
```

**8. Background Color Integration**
```javascript
function setupBackgroundControls() {
    const colorPicker = document.getElementById('bgColorPicker');
    colorPicker.addEventListener('change', (e) => {
        scene.background = new THREE.Color(e.target.value);
    });
    
    // Support for both color and texture backgrounds
    scene.background = new THREE.Color(0xf0f0f0); // Default neutral gray
}
```

## Performance Optimization Strategies

**Memory Management:**
```javascript
function cleanupModel(model) {
    model.traverse((child) => {
        if (child.geometry) {
            child.geometry.dispose();
        }
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                    if (mat.map) mat.map.dispose();
                    mat.dispose();
                });
            } else {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        }
    });
    scene.remove(model);
}
```

**Smart Rendering:**
```javascript
let needsRender = true;
function markNeedsRender() { needsRender = true; }

function animate() {
    requestAnimationFrame(animate);
    
    if (controls.update()) markNeedsRender(); // Camera moved
    
    if (needsRender) {
        renderer.render(scene, camera);
        needsRender = false;
    }
}
```

## Implementation Roadmap

### Phase 1: Core Functionality (High Priority)
1. **Basic Scene Setup**
   - Three.js scene with floor plane
   - Perspective camera with proper FOV
   - Basic lighting setup (ambient + directional)

2. **GLB Loading System**
   - Drag-and-drop event handlers
   - FileReader + GLTFLoader integration
   - Basic error handling and user feedback

3. **Automatic Placement**
   - Bounding box calculation
   - Floor placement logic
   - Auto-scaling for oversized models

4. **Camera Controls**
   - OrbitControls with damping
   - Constrained polar angle (no underground view)
   - Reasonable distance limits

### Phase 2: Enhanced Features (Medium Priority)
5. **Material Detection**
   - Traverse GLB hierarchy for "Image" materials
   - Flexible naming patterns (image, texture, paint)
   - User feedback on material detection

6. **Canvas Texture System**
   - 256x256 canvas with drawing tools
   - Real-time texture updates
   - Memory-efficient texture management

### Phase 3: Advanced Features (Lower Priority)
7. **Image Upload Integration**
   - JPG/PNG drag-and-drop to canvas
   - Image scaling and positioning tools
   - Canvas composition capabilities

8. **Object Manipulation**
   - Simple drag interaction (recommended over TransformControls)
   - Conflict management with OrbitControls
   - Visual feedback during manipulation

9. **Scene Customization**
   - Background color picker
   - Lighting adjustment controls
   - Export/import scene configurations

### Testing and Validation Strategy

**Browser Testing:**
- Chrome, Firefox, Safari compatibility
- Mobile device responsiveness
- WebGL capability detection

**Performance Testing:**
- Large GLB file handling (>50MB)
- Multiple texture updates per second
- Memory leak detection during multiple loads

**User Experience Testing:**
- Drag-and-drop intuitiveness
- Camera control responsiveness
- Error state handling

## Feasibility Assessment

### Core Requirements (100% Feasible)
✅ **Drag-and-drop GLB loading** - Standard web APIs, well-documented patterns
✅ **Floor plane positioning** - Simple Three.js geometry + placement math
✅ **OrbitControls** - Mature Three.js controls with extensive examples
✅ **Automatic GLB positioning** - Bounding box calculation is reliable

### Nice-to-Have Features (85% Feasible)
✅ **GLB movement (drag)** - Simpler than TransformControls, good UX
✅ **Canvas texture application** - Proven pattern in existing codebase
✅ **Image upload to canvas** - Standard File API + Canvas API
⚠️ **Background color** - Simple but may affect lighting/material appearance

### Implementation Complexity Assessment
- **Low Complexity:** GLB loading, floor placement, OrbitControls setup
- **Medium Complexity:** Material detection, canvas-to-texture pipeline
- **Higher Complexity:** Object drag interaction, multiple GLB management

### Recommended Approach Priority
1. **Start with drag-and-drop GLB loading** - Core functionality
2. **Add automatic floor placement** - Essential UX feature  
3. **Implement basic camera controls** - Required for any 3D viewer
4. **Add canvas texture system** - Leverages existing codebase patterns
5. **Consider object movement** - Only if drag interaction feels natural

This approach prioritizes working functionality over advanced features, ensuring a stable foundation that can be enhanced incrementally.

## References

- **Three.js GLTFLoader Documentation**: https://threejs.org/docs/#examples/en/loaders/GLTFLoader
- **OrbitControls Documentation**: https://threejs.org/docs/#examples/en/controls/OrbitControls
- **Three.js Official Examples**: https://github.com/mrdoob/three.js/tree/master/examples
- **Don McCurdy's GLTF Viewer**: https://github.com/donmccurdy/three-gltf-viewer
- **Three.js Forum Discussions**: https://discourse.threejs.org/
- **Existing TigerBuilder Canvas-to-Texture Implementation**: `/integrated-scene.html`