# Three.js Research: GLB/GLTF Asset Inspector Implementation

## Problem Analysis

The goal is to create a lightweight GLB/GLTF asset inspector that can detect and highlight editable surfaces within a single HTML file. Key technical challenges include:

- **Material Detection**: Scanning loaded GLB models for materials with specific naming patterns ("Image", "Backer")
- **Surface Visualization**: Creating colored wireframe overlays to highlight detected surfaces
- **Interactive Selection**: Implementing click-to-select functionality with raycasting
- **Surface Analysis**: Calculating surface area and detecting UV mapping presence
- **Performance**: Keeping the implementation under 200 lines while maintaining 60fps interaction

## Official Examples Research

Based on research of Three.js examples and community implementations:

### GLTFLoader with Drag-and-Drop Pattern
- **Reference**: Don McCurdy's three-gltf-viewer (github.com/donmccurdy/three-gltf-viewer)
- **Key Pattern**: Use `FileReader.readAsArrayBuffer()` with `GLTFLoader.parse()`
- **Implementation**: Wrap in Promise for async handling

### Material Detection and Mesh Traversal
- **Three.js Method**: `object.traverse()` to walk the scene graph
- **Pattern**: Check `mesh.material.name` for string patterns
- **Reference**: Three.js Mesh documentation and material system

### Wireframe Overlay Technique
- **Approach**: Use `EdgesGeometry` or `WireframeGeometry` for clean highlighting
- **Anti-Z-Fighting**: Apply `polygonOffset` to prevent rendering conflicts
- **Reference**: Three.js issue #885 and community solutions

### Raycasting for Click Selection
- **Standard Pattern**: Mouse position → Raycaster → intersectObjects()
- **Material Filtering**: Filter intersections by material name
- **Reference**: Three.js Raycaster documentation and SBCode tutorials

## Recommended Approach

### Core Three.js Components
- **Version**: Three.js r128 (compatible with project requirements)
- **Required Loaders**: GLTFLoader from examples/jsm/loaders/
- **Controls**: OrbitControls for scene navigation
- **Core Classes**: Raycaster, EdgesGeometry, LineBasicMaterial

### Architecture Pattern

```javascript
// 1. Drag-and-Drop GLB Loading
function setupDragDrop() {
    // FileReader.readAsArrayBuffer() + GLTFLoader.parse()
}

// 2. Material Detection
function scanForEditableSurfaces(gltf) {
    const editableSurfaces = [];
    gltf.scene.traverse((child) => {
        if (child.isMesh && child.material) {
            const materialName = child.material.name.toLowerCase();
            if (materialName.includes('image') || materialName.includes('backer')) {
                editableSurfaces.push({
                    mesh: child,
                    material: child.material,
                    surfaceArea: calculateSurfaceArea(child.geometry),
                    hasUVMapping: hasUVMapping(child.geometry)
                });
            }
        }
    });
    return editableSurfaces;
}

// 3. Wireframe Highlighting
function createWireframeOverlay(mesh, color) {
    const edges = new THREE.EdgesGeometry(mesh.geometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({ color: color });
    const wireframe = new THREE.LineSegments(edges, wireframeMaterial);
    wireframe.renderOrder = 1; // Render on top
    return wireframe;
}

// 4. Surface Area Calculation
function calculateSurfaceArea(geometry) {
    // Sum triangle areas using cross product
    let area = 0;
    const positions = geometry.attributes.position;
    const indices = geometry.index;
    // Iterate through triangles and calculate area
    return area;
}

// 5. UV Mapping Detection
function hasUVMapping(geometry) {
    return geometry.attributes.uv !== undefined;
}

// 6. Raycasting Selection
function onMouseClick(event) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(editableMeshes);
    // Filter by material name and select
}
```

## Implementation Roadmap

### Step 1: Basic Scene Setup (30 lines)
- Initialize Three.js scene, camera, renderer
- Add OrbitControls for navigation
- Set up lighting for material visibility

### Step 2: Drag-and-Drop GLB Loading (40 lines)
- Implement drag-and-drop event handlers
- Use FileReader.readAsArrayBuffer() for file processing
- Load GLB with GLTFLoader.parse() method
- Clear previous models and add new ones to scene

### Step 3: Material Detection System (50 lines)
- Traverse loaded GLB scene graph
- Identify materials with "Image" or "Backer" in name (case-insensitive)
- Create data structure with material info, surface area, UV status
- Update UI list with detected surfaces

### Step 4: Wireframe Highlighting (40 lines)
- Create EdgesGeometry wireframes for detected surfaces
- Use orange color for "Image" materials, different color for "Backer"
- Apply polygonOffset to prevent z-fighting
- Toggle visibility on selection

### Step 5: Click Selection with Raycasting (30 lines)
- Set up mouse event handlers
- Implement raycasting from camera through mouse position
- Filter intersections by detected editable materials only
- Highlight selected surface and update UI

### Step 6: Surface Analysis Utilities (10 lines)
- Calculate surface area by summing triangle areas
- Check for UV mapping presence in geometry attributes
- Display results in surface list

## Performance Optimization Strategies

### Memory Management
- Dispose of geometries and materials when loading new models
- Use single wireframe material instances with different colors
- Limit raycasting to detected editable meshes only

### Rendering Efficiency
- Use `renderOrder` to control wireframe overlay rendering
- Implement frustum culling for large models
- Use `EdgesGeometry` instead of full `WireframeGeometry` for cleaner highlights

### Interaction Optimization
- Throttle raycasting to avoid excessive calculations
- Cache surface area calculations
- Use efficient material name matching (string.includes())

## Code Structure Recommendations

### HTML Structure
```html
<!DOCTYPE html>
<html>
<head>
    <title>GLB Asset Inspector</title>
    <style>/* Minimal styling for drag-drop and UI */</style>
</head>
<body>
    <div id="container">
        <div id="viewport"></div>
        <div id="inspector">
            <h3>Detected Surfaces</h3>
            <ul id="surface-list"></ul>
        </div>
    </div>
    <script src="https://unpkg.com/three@0.128.0/build/three.min.js"></script>
    <script src="https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
    <script src="https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <script>/* Implementation code */</script>
</body>
</html>
```

### Key Implementation Details

#### Material Detection Pattern
```javascript
const materialName = mesh.material.name.toLowerCase();
const isEditable = materialName.includes('image') || materialName.includes('backer');
const highlightColor = materialName.includes('image') ? 0xff8800 : 0x0088ff;
```

#### Surface Area Calculation
```javascript
function calculateSurfaceArea(geometry) {
    let area = 0;
    const pos = geometry.attributes.position;
    const idx = geometry.index;
    
    for (let i = 0; i < idx.count; i += 3) {
        // Get triangle vertices and calculate area using cross product
        const v1 = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i));
        const v2 = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 1));
        const v3 = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(i + 2));
        
        const cross = v2.sub(v1).cross(v3.sub(v1));
        area += cross.length() * 0.5;
    }
    return area;
}
```

#### Drag-and-Drop Implementation
```javascript
function setupDragDrop(element) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    element.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const file = e.dataTransfer.files[0];
        if (file && file.name.toLowerCase().endsWith('.glb')) {
            loadGLBFile(file);
        }
    });
}

function loadGLBFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const loader = new THREE.GLTFLoader();
        loader.parse(e.target.result, '', (gltf) => {
            clearScene();
            scene.add(gltf.scene);
            const surfaces = scanForEditableSurfaces(gltf);
            updateUI(surfaces);
        });
    };
    reader.readAsArrayBuffer(file);
}
```

## Testing and Validation Strategies

### Testing Materials
- Create test GLB files with materials named "Image", "Backer", "ImageTexture", etc.
- Test with materials that should NOT be detected
- Verify case-insensitive matching works correctly

### Performance Testing
- Test with large GLB files (>10MB)
- Verify wireframe performance with high polygon counts
- Test raycasting responsiveness with multiple detected surfaces

### Browser Compatibility
- Test drag-and-drop in different browsers
- Verify Three.js r128 compatibility
- Test file:// protocol loading (no localhost required)

## References

### Three.js Documentation
- [GLTFLoader Documentation](https://threejs.org/docs/#examples/en/loaders/GLTFLoader)
- [Raycaster Documentation](https://threejs.org/docs/api/en/core/Raycaster.html)
- [EdgesGeometry Documentation](https://threejs.org/docs/api/en/geometries/EdgesGeometry.html)
- [Object3D.traverse() Method](https://threejs.org/docs/api/en/core/Object3D.html#traverse)

### Community Resources
- [Don McCurdy's GLTF Viewer](https://github.com/donmccurdy/three-gltf-viewer)
- [SBCode Three.js Tutorials - Raycasting](https://sbcode.net/threejs/raycaster/)
- [Three.js Forum - Drag and Drop GLB](https://discourse.threejs.org/t/drag-and-drop-glb-file-using-html/37242)

### Performance Libraries
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) - For advanced raycasting optimization
- [Three.js Examples](https://threejs.org/examples/) - Official example implementations

This research provides a comprehensive foundation for implementing a lightweight, efficient GLB/GLTF asset inspector that meets all specified requirements while maintaining optimal performance and code simplicity.