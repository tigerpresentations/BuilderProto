# Three.js Research: Scene State Deserialization Fix

## Problem Analysis

The scene state manager suffers from a critical deserialization issue where:

1. **Save works** - JSON contains all modified properties correctly
2. **Reset works** - Scene returns to original state
3. **Load fails** - Scene stays in default state, modifications not restored

### Root Cause Analysis

After analyzing the codebase, the core issue lies in **emissive property interference** between the selection highlighting system and the deserialization process:

**Selection System Impact**:
- When objects are selected, `obj.material.emissive.setHex(0x333333)` is applied
- This creates a persistent emissive highlight that interferes with material restoration
- The selection highlighting overwrites the original emissive values during deserialization

**Deserialization Timing Issues**:
- Material properties are restored, but selection state isn't cleared first
- Emissive values get overwritten by selection highlighting
- Original emissive colors and intensities are lost

## Official Three.js Research Findings

### Material Property Management Best Practices

From Three.js documentation and community resources:

1. **Emissive Properties**: Three materials with emissive properties (MeshStandardMaterial, MeshPhysicalMaterial) store:
   - `material.emissive` - Color object for emissive color
   - `material.emissiveIntensity` - Intensity multiplier (default: 1.0)
   - Both must be preserved and restored independently

2. **Material Updates**: When modifying material properties:
   - Set `material.needsUpdate = true` after property changes
   - Use proper color setters: `material.color.set()` or `material.color.setHex()`
   - Emissive changes require both color and intensity restoration

3. **Selection Highlighting**: Best practice is to:
   - Store original emissive values before highlighting
   - Restore original values when deselecting
   - Never permanently modify material properties for UI state

## Recommended Approach

### 1. Selection State Separation
Implement a clean separation between UI selection state and serialized material properties:

```javascript
// Store original emissive values before selection highlighting
const originalEmissive = {
    color: obj.material.emissive.clone(),
    intensity: obj.material.emissiveIntensity
};
obj.userData.originalEmissive = originalEmissive;
```

### 2. Enhanced Material Serialization
Ensure complete emissive property capture:

```javascript
function serializeMaterial(material) {
    return {
        type: material.type,
        color: material.color ? material.color.getHexString() : null,
        emissive: material.emissive ? material.emissive.getHexString() : null,
        emissiveIntensity: material.emissiveIntensity || 0,
        metalness: material.metalness,
        roughness: material.roughness,
        // Store original emissive before any UI modifications
        originalEmissive: material.userData?.originalEmissive || {
            color: material.emissive.getHexString(),
            intensity: material.emissiveIntensity || 0
        }
    };
}
```

### 3. Proper Deserialization Order
Clear all UI state before restoring materials:

```javascript
function deserializeScene(data) {
    // STEP 1: Clear all selection highlighting
    clearAllSelections();
    
    // STEP 2: Clear and recreate objects
    // ... object removal code ...
    
    // STEP 3: Restore objects with clean materials
    data.objects.forEach(objData => {
        const material = deserializeMaterial(objData.material);
        // Material is restored in clean state without selection interference
    });
}
```

## Implementation Roadmap

### Phase 1: Selection State Management Fix
1. **Add selection state tracking** to prevent emissive interference
2. **Implement `clearAllSelections()`** function to reset UI state
3. **Store original emissive values** in userData before highlighting

### Phase 2: Enhanced Serialization
1. **Expand material serialization** to capture all emissive properties
2. **Add original state preservation** in serialization data
3. **Include material type validation** for proper deserialization

### Phase 3: Deserialization Order Fix
1. **Clear selection state first** before any material restoration
2. **Restore materials in clean state** without UI interference
3. **Apply proper material.needsUpdate** flags after restoration

### Phase 4: Testing and Validation
1. **Test save/load cycle** with various material combinations
2. **Validate emissive property preservation** across serialization
3. **Verify selection highlighting** doesn't interfere with restoration

## Specific Code Fixes

### Fix 1: Enhanced Selection Management
```javascript
function selectObject(obj) {
    // Clear previous selection
    if (selectedObject) {
        restoreOriginalEmissive(selectedObject);
    }
    
    selectedObject = obj;
    if (obj) {
        // Store original emissive before highlighting
        if (!obj.userData.originalEmissive) {
            obj.userData.originalEmissive = {
                color: obj.material.emissive.getHexString(),
                intensity: obj.material.emissiveIntensity || 0
            };
        }
        // Apply selection highlighting
        obj.material.emissive.setHex(0x333333);
        obj.material.needsUpdate = true;
    }
}

function restoreOriginalEmissive(obj) {
    if (obj.userData.originalEmissive) {
        obj.material.emissive.setHex('0x' + obj.userData.originalEmissive.color);
        obj.material.emissiveIntensity = obj.userData.originalEmissive.intensity;
        obj.material.needsUpdate = true;
    } else {
        obj.material.emissive.setHex(0x000000);
        obj.material.emissiveIntensity = 0;
    }
}
```

### Fix 2: Clear Selections Before Load
```javascript
function clearAllSelections() {
    if (selectedObject) {
        restoreOriginalEmissive(selectedObject);
        selectedObject = null;
    }
    document.getElementById('editor-panel').style.display = 'none';
}

function deserializeScene(data) {
    // CRITICAL: Clear selection state before any restoration
    clearAllSelections();
    
    // Continue with existing deserialization...
}
```

### Fix 3: Proper Material Property Restoration
```javascript
function deserializeMaterial(data) {
    const material = new THREE.MeshStandardMaterial();
    
    // Restore all properties in clean state
    if (data.color) material.color.setHex('0x' + data.color);
    if (data.emissive) {
        material.emissive.setHex('0x' + data.emissive);
        material.emissiveIntensity = data.emissiveIntensity || 0;
    }
    if (data.metalness !== undefined) material.metalness = data.metalness;
    if (data.roughness !== undefined) material.roughness = data.roughness;
    
    // Mark for update
    material.needsUpdate = true;
    
    return material;
}
```

## Testing Strategy

### Validation Checklist
1. **Save Operation**: Verify JSON contains correct emissive values
2. **Load Operation**: Verify emissive properties are restored correctly
3. **Selection Highlighting**: Verify selection doesn't interfere with restoration
4. **Multi-Load Cycles**: Test multiple save/load operations
5. **Material Variety**: Test with different material types and emissive configurations

### Edge Cases to Test
1. Objects with emissive materials + selection highlighting
2. Objects with zero emissive values
3. Mixed material types in same scene
4. Save/load while objects are selected

## Performance Considerations

- **Material Updates**: Only call `material.needsUpdate = true` when necessary
- **Selection State**: Store minimal selection metadata in userData
- **Emissive Restoration**: Use efficient color setting methods

## References

- [Three.js MeshStandardMaterial Documentation](https://threejs.org/docs/api/en/materials/MeshStandardMaterial.html)
- [Three.js Materials Best Practices](https://threejsfundamentals.org/threejs/lessons/threejs-materials.html)
- [Emissive Property Handling in Three.js](https://discoverthreejs.com/tips-and-tricks/)

This fix ensures that scene state deserialization works reliably by properly managing the interaction between UI selection highlighting and material property restoration.