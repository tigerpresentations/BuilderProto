# Three.js Scaling and Unit Conventions Research

## Problem Analysis

Three.js operates in unitless 3D space, while TigerBuilder deals with real-world trade show displays that have specific physical dimensions. Without proper scale correlation, models appear at arbitrary sizes, camera positioning becomes unintuitive, and lighting behaves unrealistically.

## Established Unit Convention Patterns

### **Industry Standard Approaches**

**Architectural/CAD Applications**: Typically use 1 Three.js unit = 1 foot for building-scale objects. This provides intuitive scale for human-sized environments while maintaining reasonable precision.

**Product Visualization**: Often use 1 Three.js unit = 1 meter for optimal precision with typical camera distances and lighting calculations.

**Game Development**: Commonly uses 1 unit = 1 meter, following Unreal Engine conventions.

### **Recommended Convention for TigerBuilder**

**Primary Scale**: 1 Three.js unit = 1 foot
- Trade show booths typically range from 8×8 to 20×20 feet
- Human eye level (5.5 feet) becomes 5.5 units - easy to work with
- Camera positioning remains intuitive
- Lighting distances scale naturally

**Conversion Functions**:
```javascript
const SCALE = {
    FEET_PER_UNIT: 1,
    INCHES_TO_UNITS: 1/12,
    METERS_TO_UNITS: 3.28084
};

function inchesToUnits(inches) { return inches * SCALE.INCHES_TO_UNITS; }
function feetToUnits(feet) { return feet * SCALE.FEET_PER_UNIT; }
function metersToUnits(meters) { return meters * SCALE.METERS_TO_UNITS; }
```

## Implementation Strategy

### **Scene Setup with Realistic Scale**
```javascript
// Camera positioned for human perspective in trade show environment
camera.position.set(
    feetToUnits(8),     // 8 feet from booth
    feetToUnits(5.5),   // Eye level
    feetToUnits(6)      // Slight angle
);

// Floor representing 10×10 foot booth space
const floorGeometry = new THREE.PlaneGeometry(
    feetToUnits(10), 
    feetToUnits(10)
);

// Lighting positioned realistically
directionalLight.position.set(
    feetToUnits(15),    // 15 feet away
    feetToUnits(12),    // 12 feet high
    feetToUnits(10)     // Side angle
);
```

### **Model Scaling Workflow**
```javascript
function applyRealWorldScale(model, realHeightInches) {
    // Calculate current model height in Three.js units
    const bbox = new THREE.Box3().setFromObject(model);
    const currentHeight = bbox.max.y - bbox.min.y;
    
    // Convert real-world height to Three.js units
    const targetHeight = inchesToUnits(realHeightInches);
    
    // Apply uniform scale
    const scaleFactor = targetHeight / currentHeight;
    model.scale.setScalar(scaleFactor);
    
    return scaleFactor;
}
```

## Performance Considerations

### **Floating Point Precision**
With 1 unit = 1 foot scale:
- Minimum meaningful precision: ~0.01 units (0.12 inches)
- Avoids floating-point precision issues at extreme scales
- Camera near/far planes remain reasonable (0.1 to 1000 units)

### **Lighting Calculations**
Real-world scale affects lighting behavior:
- Light attenuation follows inverse square law realistically
- Shadow map sizes need adjustment for larger scenes
- Ambient lighting levels should match real-world expectations

## Browser Compatibility

All modern browsers handle the recommended scale range without precision issues. WebGL implementations remain stable with:
- Object sizes: 0.1 to 100 units (1.2 inches to 100 feet)
- Camera distances: 1 to 500 units (1 to 500 feet)
- Light ranges: 10 to 200 units (10 to 200 feet)

## Integration with GLB Loading

### **Scale Detection and Application**
```javascript
async function loadModelWithScale(url, realDimensions) {
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    
    if (realDimensions?.height) {
        const scaleFactor = applyRealWorldScale(model, realDimensions.height);
        
        // Store scale information for persistence
        model.userData.realWorldScale = {
            factor: scaleFactor,
            originalHeight: realDimensions.height,
            units: 'inches'
        };
    }
    
    return model;
}
```

### **Validation and Error Handling**
- Check for reasonable scale factors (0.001 to 1000)
- Warn users if models appear extremely large or small
- Provide visual reference objects (human figure, furniture) for scale validation

## References

- Three.js documentation on coordinate systems and units
- WebGL specification regarding floating-point precision
- Architectural visualization best practices for 3D web applications
- CAD software unit conversion standards