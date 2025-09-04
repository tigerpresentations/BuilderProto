# Three.js Research: Scene Serialization, Clearing, and Restoration Systems

## Problem Analysis

The BuilderProto application faces critical issues with scene state management during serialization and restoration:

### Technical Challenges
- **Memory Management**: Incomplete resource disposal causing memory leaks during scene transitions
- **GLB Model Loading**: Issues with proper loading/restoration of GLB models from saved designs
- **State Conflicts**: Selection system and TransformControls state conflicts during scene changes
- **Resource Tracking**: Lack of comprehensive tracking for geometries, materials, textures, and canvas textures
- **Scene Graph Integrity**: Problems maintaining proper parent-child relationships during restoration

### Three.js Specific Considerations
- Manual resource disposal required (geometry, materials, textures)
- Complex object hierarchies in GLB models requiring recursive traversal
- Canvas texture lifecycle management with Three.js integration
- TransformControls state coordination during scene transitions
- OrbitControls camera state preservation

### Performance Implications
- Unmanaged memory growth during multiple save/load cycles
- GPU memory not released without proper dispose() calls
- Large JSON serialization overhead for complex scenes
- Potential browser crashes with repeated scene loading without cleanup

## Official Examples Research

### Three.js Native ObjectLoader Pattern
Based on official Three.js documentation and examples:

```javascript
// Official Three.js serialization approach
const loader = new THREE.ObjectLoader();

// Serialize scene to JSON
const serializedScene = scene.toJSON();

// Restore from JSON
const restoredObject = loader.parse(serializedScene);
scene.add(restoredObject);
```

**Key Features from Official Examples:**
- Native `toJSON()` method on Three.js objects following ECMA-262 standard
- ObjectLoader for parsing JSON back to Three.js objects
- Support for geometries, materials, textures, animations, and cameras
- UUID-based object identification for referencing
- Handles circular references properly (unlike JSON.stringify)

### JSON Object/Scene Format 4.3 Specification
Official Three.js JSON format includes:

```json
{
  "metadata": {
    "version": 4.3,
    "type": "Object",
    "generator": "ObjectExporter"
  },
  "geometries": [/* BufferGeometry definitions */],
  "materials": [/* Material definitions */],
  "textures": [/* Texture definitions */], 
  "images": [/* Image definitions */],
  "object": {/* Root scene object */}
}
```

### Resource Management from Three.js Manual
Official cleanup patterns from threejs.org/manual:

```javascript
// ResourceTracker pattern from official documentation
class ResourceTracker {
  constructor() {
    this.resources = new Set();
  }
  
  track(resource) {
    if (!resource) return resource;
    
    // Special handling for Object3D hierarchies
    if (resource instanceof THREE.Object3D) {
      this.track(resource.geometry);
      this.track(resource.material);
      if (resource.children) {
        resource.children.forEach(child => this.track(child));
      }
    }
    
    // Track disposable resources
    if (resource.dispose || resource instanceof THREE.Object3D) {
      this.resources.add(resource);
    }
    return resource;
  }
  
  untrack(resource) {
    this.resources.delete(resource);
  }
  
  dispose() {
    for (const resource of this.resources) {
      if (resource instanceof THREE.Object3D) {
        if (resource.parent) {
          resource.parent.remove(resource);
        }
      }
      if (resource.dispose) {
        resource.dispose();
      }
    }
    this.resources.clear();
  }
}
```

### GLTFLoader Memory Management
Official patterns for GLTF cleanup:

```javascript
// Proper GLTF disposal pattern
function disposeGLTF(gltf) {
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      // Dispose geometry
      if (child.geometry) {
        child.geometry.dispose();
      }
      
      // Dispose materials (can be array or single material)
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => disposeMaterial(material));
        } else {
          disposeMaterial(child.material);
        }
      }
    }
  });
}

function disposeMaterial(material) {
  // Dispose all material textures
  Object.keys(material).forEach(prop => {
    const value = material[prop];
    if (value && typeof value === 'object' && value.isTexture) {
      value.dispose();
    }
  });
  
  material.dispose();
}
```

## Recommended Approach

### 1. Hybrid Serialization Strategy
Combine Three.js native ObjectLoader with custom metadata for BuilderProto-specific features:

**Core Architecture:**
- Use Three.js `toJSON()` for standard objects (meshes, materials, geometries)  
- Custom serialization for canvas textures, library model references, and selection states
- ResourceTracker integration for complete lifecycle management

### 2. Three.js Classes and Methods to Use

**Scene Serialization:**
- `THREE.ObjectLoader()` - Primary loader for JSON scenes
- `scene.toJSON()` - Native serialization method
- `loader.parse(json)` - JSON to Three.js object conversion

**Resource Management:**
- Custom ResourceTracker implementation
- `geometry.dispose()` - Geometry cleanup
- `material.dispose()` - Material cleanup  
- `texture.dispose()` - Texture cleanup
- `scene.remove(object)` - Scene graph cleanup

**State Management:**
- `TransformControls.detach()` - Clear transform controls
- `controls.target.copy()` - Camera state preservation
- `camera.updateProjectionMatrix()` - Camera restoration

### 3. Performance Optimization Strategies

**Memory Management:**
- Implement ResourceTracker per scene load
- Dispose resources before scene transitions
- Use WeakMap for object metadata to prevent memory leaks
- Monitor performance.memory API for cleanup verification

**Serialization Efficiency:**
- Separate large assets (GLB files) from scene JSON
- Use asset references instead of inline geometry data
- Compress texture data or store separately
- Implement progressive loading for large scenes

**GPU Resource Handling:**
- Ensure WebGL cleanup via dispose() calls
- Batch geometry updates to reduce draw calls
- Reuse materials and textures where possible
- Clear renderer info between scene loads

### 4. Integration Considerations

**BuilderProto Architecture:**
- Maintain existing canvas-to-texture pipeline
- Preserve material detection system ("Image" named materials)
- Keep selection system coordination
- Support library model loading workflow

**Canvas Texture Management:**
```javascript
// Recommended canvas texture restoration
async restoreCanvasTexture(canvasData) {
  const canvas = document.getElementById('display-canvas');
  const texture = window.canvasTexture;
  
  if (canvas && texture && canvasData) {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      texture.needsUpdate = true;
      
      // Update all materials using this texture
      if (window.imageMaterials) {
        window.imageMaterials.forEach(material => {
          material.needsUpdate = true;
        });
      }
    };
    img.src = canvasData;
  }
}
```

## Implementation Roadmap

### Phase 1: Resource Management Foundation
1. **Implement ResourceTracker System**
   - Create comprehensive resource tracking
   - Add automatic disposal for all Three.js objects
   - Integrate with existing model loading

2. **Scene Clearing Implementation**
   - Implement safe scene clearing using ResourceTracker
   - Preserve infrastructure objects (lights, camera, floor)
   - Clear selection states and TransformControls

3. **Memory Leak Detection**
   - Add performance monitoring
   - Implement resource counting
   - Add cleanup verification

### Phase 2: Native Three.js Serialization
1. **Replace Custom Serialization**
   - Use Three.js `toJSON()` for standard objects
   - Keep custom serialization only for BuilderProto-specific data
   - Implement ObjectLoader-based restoration

2. **GLB Model Handling**
   - Improve GLTF disposal patterns
   - Track all loaded model resources
   - Implement proper parent-child relationship restoration

3. **Canvas Texture Integration**
   - Separate canvas texture serialization
   - Implement reliable texture restoration
   - Coordinate with material update system

### Phase 3: State Management Coordination
1. **Selection System Integration**
   - Clear selection during scene transitions
   - Rebuild selectable object lists after restoration
   - Coordinate with TransformControls state

2. **Camera and Controls State**
   - Preserve camera position and orientation
   - Maintain OrbitControls target
   - Handle smooth transitions between scenes

3. **Error Recovery**
   - Implement robust error handling
   - Add fallback for failed restorations  
   - Provide user feedback for errors

### Testing and Validation Strategies

**Memory Testing:**
- Load/save cycles with memory monitoring
- Verify complete resource disposal
- Test with large models and textures

**Functional Testing:**
- Scene restoration accuracy
- Model positioning and transformation
- Material and texture integrity
- Selection system functionality

**Performance Testing:**
- Serialization/deserialization timing
- Memory usage patterns
- GPU resource utilization
- Browser stability under load

## References

### Three.js Documentation
- [ObjectLoader API](https://threejs.org/docs/api/en/loaders/ObjectLoader.html)
- [Three.js Cleanup Manual](https://threejs.org/manual/en/cleanup.html)
- [JSON Object/Scene Format 4](https://github.com/mrdoob/three.js/wiki/JSON-Object-Scene-format-4)

### Official Examples
- Three.js Examples Repository: https://github.com/mrdoob/three.js/tree/master/examples
- ObjectLoader Source: https://github.com/mrdoob/three.js/blob/master/src/loaders/ObjectLoader.js
- ResourceTracker Pattern: https://threejsfundamentals.org/threejs/lessons/threejs-cleanup.html

### Community Resources
- Three.js Forum Discussions on Scene Management
- Memory Management Best Practices
- GLTFLoader Resource Disposal Patterns

### Performance References
- WebGL Memory Management
- Three.js Performance Optimization
- Browser Memory Monitoring APIs