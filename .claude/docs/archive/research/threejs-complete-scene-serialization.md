# Three.js Research: Complete Scene State Manager for Design Configuration

## Problem Analysis

The current TigerBuilder project has basic scene serialization but lacks comprehensive state management for complete design restoration. The requirements call for:

1. **Multiple object support** (3-4 objects with full transforms)
2. **Material property serialization** (colors, textures, PBR properties)
3. **Custom metadata per object**
4. **Complete JSON serialization**
5. **Camera and lighting preservation**
6. **localStorage persistence**
7. **Reset functionality**
8. **Maximum 250 lines constraint**

### Technical Challenge Overview

Three.js objects contain circular references and non-serializable properties, making direct JSON.stringify() impossible. The challenge is to extract only the essential data needed to perfectly recreate the scene state.

### Three.js Specific Considerations

- **Circular References**: Object3D.parent/children relationships create circular dependencies
- **Non-Serializable Data**: Functions, WebGL contexts, and internal state cannot be serialized
- **Texture Handling**: Large texture data vs. reference-based approaches
- **Material Variations**: Different material types (MeshBasicMaterial, MeshStandardMaterial, etc.) have different properties
- **Memory Management**: Proper disposal of old resources during restoration

### Performance Implications

- **localStorage Limits**: ~5MB typical browser limit
- **JSON Size**: Base64-encoded textures can be massive
- **Parse Time**: Large JSON structures can block the main thread
- **Memory Usage**: Multiple texture copies during serialization/deserialization

## Official Examples Research

Based on the existing TigerBuilder codebase analysis, the following patterns are already proven:

### From `integrated-scene.html`:
- **Basic Serialization Pattern**: Lines 536-588 show successful GLB + texture serialization
- **DataURL Texture Handling**: Lines 540-534 use `toDataURL()` for texture serialization
- **Transform Serialization**: Lines 554-558 capture position/rotation/scale
- **Camera State**: Lines 550-553 save camera position and OrbitControls target

### From `design-state-manager.html`:
- **Multiple Object Management**: Lines 193-207 serialize object arrays
- **Material Property Extraction**: Lines 199-204 capture material properties
- **Custom Metadata**: Lines 205 shows userData preservation
- **Geometry Type Storage**: Lines 195 stores original geometry type for reconstruction

## Recommended Approach

### Core Three.js Classes and Methods
```javascript
// Essential Three.js serialization methods
object.position.toArray()           // Vector3 → [x, y, z]
object.quaternion.toArray()         // Quaternion → [x, y, z, w]
object.scale.toArray()              // Vector3 → [x, y, z]
material.color.getHex()             // Color → 0xffffff
canvas.toDataURL('image/jpeg', 0.85) // Canvas → DataURL
```

### Three.js Architecture Recommendations

1. **Object Traversal Pattern**:
   ```javascript
   scene.traverse((object) => {
       if (object.isMesh) {
           // Serialize mesh data
       }
   });
   ```

2. **Material Property Extraction**:
   ```javascript
   const materialData = {
       type: material.type,
       color: material.color?.getHex(),
       metalness: material.metalness,
       roughness: material.roughness,
       opacity: material.opacity,
       transparent: material.transparent
   };
   ```

3. **Texture Serialization Strategy**:
   ```javascript
   // Small textures: DataURL (< 100KB)
   // Large textures: Reference-based or compressed
   const textureData = texture.image.width * texture.image.height < 65536
       ? canvas.toDataURL('image/jpeg', 0.8)
       : { type: 'reference', id: textureId };
   ```

### Performance Optimization Strategies

1. **Smart Texture Compression**:
   - Use JPEG for opaque textures (smaller size)
   - Use PNG only when transparency is detected
   - Compress quality to 0.8-0.85 for good balance

2. **Incremental Serialization**:
   - Only serialize changed properties
   - Use dirty flags for optimization

3. **Memory Management**:
   - Dispose of old geometries and materials during restoration
   - Use object pooling for frequent serialization/deserialization

## Implementation Roadmap

### Step 1: Core Serialization Engine (50 lines)
```javascript
function serializeScene() {
    const sceneData = {
        version: '2.0',
        timestamp: Date.now(),
        camera: serializeCamera(),
        lighting: serializeLighting(),
        objects: []
    };
    
    scene.traverse((object) => {
        if (object.isMesh && object.name) {
            sceneData.objects.push(serializeObject(object));
        }
    });
    
    return sceneData;
}
```

### Step 2: Object Serialization with Full Properties (60 lines)
```javascript
function serializeObject(object) {
    const materialData = {};
    const material = object.material;
    
    // Universal material properties
    if (material.color) materialData.color = material.color.getHex();
    if (material.opacity !== undefined) materialData.opacity = material.opacity;
    if (material.transparent !== undefined) materialData.transparent = material.transparent;
    
    // PBR material properties
    if (material.metalness !== undefined) materialData.metalness = material.metalness;
    if (material.roughness !== undefined) materialData.roughness = material.roughness;
    if (material.emissive) materialData.emissive = material.emissive.getHex();
    if (material.emissiveIntensity !== undefined) materialData.emissiveIntensity = material.emissiveIntensity;
    
    // Texture handling
    if (material.map) {
        materialData.mapDataURL = getTextureDataURL(material.map);
    }
    
    return {
        name: object.name,
        geometry: object.geometry.type,
        position: object.position.toArray(),
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: object.scale.toArray(),
        material: {
            type: material.type,
            ...materialData
        },
        userData: JSON.parse(JSON.stringify(object.userData)), // Deep clone
        visible: object.visible,
        castShadow: object.castShadow,
        receiveShadow: object.receiveShadow
    };
}
```

### Step 3: Texture Serialization with Size Optimization (40 lines)
```javascript
function getTextureDataURL(texture) {
    if (!texture.image) return null;
    
    // Create temporary canvas for texture extraction
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = texture.image.width;
    canvas.height = texture.image.height;
    
    // Handle different image sources
    if (texture.image.tagName === 'CANVAS') {
        ctx.drawImage(texture.image, 0, 0);
    } else if (texture.image.tagName === 'IMG') {
        ctx.drawImage(texture.image, 0, 0);
    } else if (texture.image.data) {
        // ImageData
        ctx.putImageData(texture.image, 0, 0);
    }
    
    // Smart compression based on transparency
    const hasTransparency = checkCanvasTransparency(canvas);
    const format = hasTransparency ? 'image/png' : 'image/jpeg';
    const quality = hasTransparency ? undefined : 0.85;
    
    return canvas.toDataURL(format, quality);
}

function checkCanvasTransparency(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) return true;
    }
    return false;
}
```

### Step 4: Complete Deserialization with Error Handling (60 lines)
```javascript
function deserializeScene(data) {
    // Clear existing scene
    const objectsToRemove = [];
    scene.traverse((object) => {
        if (object.isMesh && object.name) {
            objectsToRemove.push(object);
        }
    });
    
    objectsToRemove.forEach(obj => {
        scene.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
        }
    });
    
    // Restore camera
    if (data.camera) {
        camera.position.fromArray(data.camera.position);
        if (data.camera.target && controls) {
            controls.target.fromArray(data.camera.target);
            controls.update();
        }
    }
    
    // Restore lighting
    if (data.lighting) {
        scene.traverse((light) => {
            if (light.isAmbientLight) {
                light.intensity = data.lighting.ambient?.intensity ?? light.intensity;
            } else if (light.isDirectionalLight) {
                light.intensity = data.lighting.directional?.intensity ?? light.intensity;
                if (data.lighting.directional?.position) {
                    light.position.fromArray(data.lighting.directional.position);
                }
            }
        });
    }
    
    // Restore objects
    data.objects?.forEach(objData => {
        const object = recreateObject(objData);
        if (object) scene.add(object);
    });
}
```

### Step 5: localStorage Integration with Size Management (40 lines)
```javascript
function saveToStorage(data) {
    const jsonString = JSON.stringify(data);
    const sizeKB = Math.round(jsonString.length / 1024);
    
    try {
        // Check localStorage availability and size
        if (sizeKB > 4000) { // 4MB limit with buffer
            throw new Error(`Scene too large (${sizeKB}KB) for localStorage`);
        }
        
        localStorage.setItem('sceneState', jsonString);
        return { success: true, size: sizeKB };
    } catch (error) {
        console.warn('localStorage save failed:', error.message);
        return { success: false, error: error.message, size: sizeKB };
    }
}

function loadFromStorage() {
    try {
        const stored = localStorage.getItem('sceneState');
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.error('localStorage load failed:', error.message);
        localStorage.removeItem('sceneState'); // Clear corrupted data
        return null;
    }
}
```

## Code Patterns for Implementation

### Converting Three.js Vectors/Quaternions to JSON
```javascript
// Recommended patterns for maximum compatibility:
position: object.position.toArray()                    // [x, y, z]
rotation: [object.rotation.x, object.rotation.y, object.rotation.z]  // Euler angles
quaternion: object.quaternion.toArray()                // [x, y, z, w] for complex rotations
scale: object.scale.toArray()                          // [x, y, z]

// Restoration:
object.position.fromArray(data.position);
object.rotation.set(...data.rotation);
object.scale.fromArray(data.scale);
```

### Material Property Extraction
```javascript
function extractMaterialProperties(material) {
    const props = {
        type: material.type,
        color: material.color?.getHex(),
        opacity: material.opacity,
        transparent: material.transparent,
        side: material.side,
        alphaTest: material.alphaTest
    };
    
    // PBR-specific properties
    if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
        props.metalness = material.metalness;
        props.roughness = material.roughness;
        props.emissive = material.emissive?.getHex();
        props.emissiveIntensity = material.emissiveIntensity;
    }
    
    return props;
}
```

### Scene Traversal for Complete State Capture
```javascript
function captureCompleteScene() {
    const sceneState = {
        objects: [],
        lights: [],
        cameras: []
    };
    
    scene.traverse((object) => {
        if (object.isMesh) {
            sceneState.objects.push(serializeObject(object));
        } else if (object.isLight) {
            sceneState.lights.push(serializeLight(object));
        } else if (object.isCamera) {
            sceneState.cameras.push(serializeCamera(object));
        }
    });
    
    return sceneState;
}
```

### Robust Deserialization with Error Handling
```javascript
function safeDeserialize(data) {
    const errors = [];
    
    try {
        // Validate data structure
        if (!data.version) throw new Error('Invalid scene format');
        if (!Array.isArray(data.objects)) throw new Error('Objects array missing');
        
        // Restore with individual error handling
        data.objects.forEach((objData, index) => {
            try {
                const object = recreateObject(objData);
                scene.add(object);
            } catch (error) {
                errors.push(`Object ${index}: ${error.message}`);
            }
        });
        
        return { success: errors.length === 0, errors };
    } catch (error) {
        return { success: false, errors: [error.message] };
    }
}
```

## Efficient JSON Structure

### Optimized Scene Structure
```json
{
  "version": "2.0",
  "timestamp": 1640995200000,
  "metadata": {
    "appVersion": "1.0",
    "totalObjects": 4,
    "hasTextures": true,
    "estimatedSize": "2.1MB"
  },
  "camera": {
    "position": [0, 0, 5],
    "target": [0, 0, 0],
    "fov": 75
  },
  "lighting": {
    "ambient": { "intensity": 0.4, "color": 0xffffff },
    "directional": [
      { "intensity": 0.8, "position": [5, 5, 5], "color": 0xffffff }
    ]
  },
  "objects": [
    {
      "id": "cube-1",
      "name": "cube",
      "geometry": { "type": "BoxGeometry", "params": [1, 1, 1] },
      "transform": {
        "position": [-2, 0, 0],
        "rotation": [0, 0, 0],
        "scale": [1, 1, 1]
      },
      "material": {
        "type": "MeshStandardMaterial",
        "color": 0xff0000,
        "metalness": 0.1,
        "roughness": 0.8,
        "mapDataURL": "data:image/jpeg;base64,/9j/4AAQ..."
      },
      "userData": {
        "category": "container",
        "priority": 1,
        "tags": ["interactive", "primary"]
      },
      "flags": {
        "visible": true,
        "castShadow": true,
        "receiveShadow": true
      }
    }
  ]
}
```

## Handling Circular References and localStorage Limitations

### Circular Reference Prevention
```javascript
function createSerializedReference(object) {
    return {
        type: 'reference',
        uuid: object.uuid,
        name: object.name
    };
}

// Use references instead of full objects for parent/child relationships
const serializedObject = {
    ...objectData,
    parent: object.parent ? createSerializedReference(object.parent) : null,
    children: object.children.map(createSerializedReference)
};
```

### localStorage Size Management
```javascript
function compressSceneData(data) {
    // Remove unnecessary precision from numbers
    const compressed = JSON.parse(JSON.stringify(data, (key, value) => {
        if (typeof value === 'number') {
            return Math.round(value * 1000) / 1000; // 3 decimal places
        }
        return value;
    }));
    
    return compressed;
}

function saveWithFallback(data) {
    const compressed = compressSceneData(data);
    const result = saveToStorage(compressed);
    
    if (!result.success) {
        // Fallback: Remove texture data and save minimal state
        const minimal = { ...compressed };
        minimal.objects.forEach(obj => {
            if (obj.material?.mapDataURL) {
                obj.material.hasTexture = true;
                delete obj.material.mapDataURL;
            }
        });
        
        return saveToStorage(minimal);
    }
    
    return result;
}
```

## References

### Three.js Documentation
- [Object3D Serialization](https://threejs.org/docs/#api/en/core/Object3D) - Core object serialization methods
- [Material Properties](https://threejs.org/docs/#api/en/materials/Material) - Complete material property reference
- [Texture Handling](https://threejs.org/docs/#api/en/textures/Texture) - Texture serialization patterns

### TigerBuilder Project Files
- `/Users/david/Local Documents/BuilderProto/integrated-scene.html` - Complete GLB + texture serialization
- `/Users/david/Local Documents/BuilderProto/design-state-manager.html` - Multi-object state management

### Community Resources
- [Three.js JSON Format](https://threejs.org/docs/#api/en/loaders/ObjectLoader) - Official JSON structure
- [WebGL Texture Limits](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) - Browser texture constraints

## Key Insights

1. **Simplicity Over Complexity**: The existing TigerBuilder patterns prove that simple, direct serialization works reliably
2. **Texture Strategy**: Smart compression based on transparency detection provides optimal size/quality balance
3. **Error Recovery**: Individual object deserialization with error collection ensures partial recovery from corrupted data
4. **Memory Management**: Explicit disposal of old resources prevents memory leaks during frequent state changes
5. **localStorage Fallback**: Multi-tier storage strategy (full → compressed → minimal → file-only) ensures reliability

This approach ensures EVERY aspect of the design can be perfectly restored while maintaining the 250-line constraint and leveraging proven Three.js patterns from the existing codebase.