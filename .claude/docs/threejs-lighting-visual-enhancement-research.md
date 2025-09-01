# Three.js Research: Lighting and Visual Enhancement for TigerBuilder

## Problem Analysis

The TigerBuilder 3D scene currently suffers from a "flat" appearance with the following issues:
- **Low contrast and depth perception**: Models lack visual depth and appear flat
- **Insufficient shadow quality**: Despite shadows being enabled, they may not be providing enough visual information
- **Basic lighting setup**: Current ambient (0.6) + directional (0.8) lighting is functional but lacks realism
- **Missing environmental lighting**: No environment mapping or Image-Based Lighting (IBL) for realistic reflections
- **Performance vs. quality balance**: Need to enhance visuals while maintaining 60fps target

### Current Lighting Setup Analysis

From `scene-manager.js`:
```javascript
// Current setup (basic but functional)
ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 10, 5);
// Shadows enabled with PCFSoftShadowMap
```

**Issues Identified:**
1. Single directional light creates harsh shadows and flat surfaces
2. High ambient light (0.6) washes out contrast
3. No fill lighting or rim lighting effects
4. Shadow camera frustum may be too large (±10 units) reducing shadow resolution
5. Missing environment mapping for realistic material appearance

## Official Examples Research

### Key Three.js Examples Analyzed:

1. **webgl_lights_hemisphere**: Shows hemisphere lighting for natural sky/ground illumination
2. **webgl_shadowmap**: Demonstrates optimal shadow mapping configurations
3. **webgl_lights_physical**: Shows realistic lighting for PBR materials
4. **webgl_materials_envmaps**: Environment mapping for realistic reflections

### Proven Patterns Identified:

#### 1. Multi-Light Setup Pattern
```javascript
// Hemisphere light for natural ambient
const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x8B4513, 0.4);

// Main directional light (sun)
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);

// Fill light (softer, opposite direction)
const fillLight = new THREE.DirectionalLight(0x404040, 0.3);
```

#### 2. Optimized Shadow Configuration
```javascript
// From official examples - better shadow quality
directionalLight.shadow.mapSize.setScalar(2048); // Higher resolution
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 20; // Tighter frustum
directionalLight.shadow.camera.left = -5;
directionalLight.shadow.camera.right = 5;
directionalLight.shadow.camera.top = 5;
directionalLight.shadow.camera.bottom = -5;
directionalLight.shadow.bias = -0.0005; // Reduce shadow acne
```

#### 3. Enhanced Material Properties
```javascript
// Better material setup for GLB models
material.envMapIntensity = 0.5; // Add subtle reflections
material.roughness = 0.7; // More realistic surface
material.metalness = 0.1; // Slight metallic sheen
```

## Recommended Approach

### Phase 1: Enhanced Multi-Light Setup (Low Risk)

**Replace single-light system with proven three-light setup:**

1. **Main Light (Sun)**: Primary directional light with shadows
   - Intensity: 0.8-1.0
   - Position: (8, 12, 6) - higher and more angled
   - Tight shadow camera frustum for better resolution

2. **Fill Light**: Secondary directional light for contrast
   - Intensity: 0.2-0.3
   - Position: (-4, 8, -4) - opposite side, softer
   - No shadows (performance optimization)

3. **Hemisphere Light**: Replace ambient with hemisphere
   - Sky color: Light blue (0x87CEEB)
   - Ground color: Warm brown (0x8B4513)
   - Intensity: 0.3-0.4 (lower than current ambient)

### Phase 2: Shadow Quality Improvements (Medium Risk)

**Optimize existing shadow system:**

1. **Tighter Shadow Frustum**: Reduce from ±10 to ±5 units
2. **Higher Resolution**: Increase shadow map to 2048 (device permitting)
3. **Shadow Bias**: Add -0.0005 bias to reduce shadow acne
4. **Dynamic Shadow Updates**: Enable auto-update only when needed

### Phase 3: Material Enhancement (Low Risk)

**Improve GLB material appearance without breaking compatibility:**

1. **Environment Map**: Add simple cube map for subtle reflections
2. **Enhanced PBR Properties**: Adjust roughness/metalness for realism
3. **Tone Mapping**: Fine-tune ACES tone mapping exposure

### Phase 4: Optional Post-Processing (High Risk - Optional)

**Simple post-processing for depth and contrast:**

1. **SSAO (Screen Space Ambient Occlusion)**: Add subtle ambient occlusion
2. **Tone Mapping Enhancement**: Adjust exposure and contrast
3. **Anti-aliasing**: FXAA for smoother edges

## Performance Considerations

### Three.js r128 Specific Optimizations:

1. **Shadow Performance**:
   - Limit to 1-2 shadow-casting lights maximum
   - Use `shadowMap.autoUpdate = false` and manual updates
   - Device-based shadow resolution scaling (current code already does this)

2. **Light Performance**:
   - Maximum 3-4 lights total (current budget allows this)
   - Hemisphere lights are cheaper than multiple directional lights
   - No point lights or spot lights (more expensive for GLB scenes)

3. **Memory Management**:
   - Reuse light objects when switching models
   - Proper disposal of environment maps if used
   - Monitor texture memory usage

### Performance Targets:
- **60fps maintained** on target devices
- **Memory usage increase < 20MB** for lighting enhancements
- **Render time increase < 2ms** per frame

## Implementation Roadmap

### Step 1: Lighting System Refactor
1. Replace `AmbientLight` with `HemisphereLight`
2. Add fill light (second directional light)
3. Optimize main directional light position and intensity
4. Test performance impact

### Step 2: Shadow Quality Enhancement
1. Implement tighter shadow camera frustum
2. Add shadow bias configuration
3. Increase shadow map resolution conditionally
4. Add shadow quality controls to UI

### Step 3: Material Enhancement Integration
1. Detect and enhance GLB material properties
2. Add simple environment mapping
3. Fine-tune PBR material parameters
4. Ensure canvas texture compatibility

### Step 4: Visual Validation and Optimization
1. Compare before/after visual quality
2. Performance benchmarking across devices
3. Shadow and lighting quality validation
4. User feedback integration

## Code Implementation Examples

### Enhanced Lighting Setup (scene-manager.js)
```javascript
function setupLighting() {
    // Replace ambient with hemisphere light for natural illumination
    const hemisphereLight = new THREE.HemisphereLight(
        0x87CEEB, // Sky color (light blue)
        0x8B4513, // Ground color (warm brown)
        0.4       // Reduced intensity for better contrast
    );
    hemisphereLight.position.set(0, 20, 0);
    scene.add(hemisphereLight);
    
    // Main directional light (sun) - optimized position
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.9);
    mainLight.position.set(8, 12, 6); // Higher, more angled
    mainLight.castShadow = true;
    
    // Optimized shadow settings
    mainLight.shadow.mapSize.setScalar(Math.min(2048, renderer.capabilities.maxTextureSize / 2));
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 20; // Tighter frustum
    mainLight.shadow.camera.left = -5;
    mainLight.shadow.camera.right = 5;
    mainLight.shadow.camera.top = 5;
    mainLight.shadow.camera.bottom = -5;
    mainLight.shadow.bias = -0.0005; // Reduce shadow acne
    scene.add(mainLight);
    
    // Fill light for contrast (no shadows for performance)
    const fillLight = new THREE.DirectionalLight(0x404040, 0.3);
    fillLight.position.set(-4, 8, -4); // Opposite side
    scene.add(fillLight);
}
```

### Enhanced Material Properties (for GLB materials)
```javascript
function enhanceGLBMaterials(gltf) {
    gltf.scene.traverse((child) => {
        if (child.isMesh && child.material) {
            const material = child.material;
            
            // Enhance PBR properties for realism
            if (material.isMeshStandardMaterial) {
                material.roughness = Math.max(0.3, material.roughness || 0.7);
                material.metalness = Math.min(0.3, material.metalness || 0.1);
                
                // Add subtle environment mapping if available
                if (envMap) {
                    material.envMap = envMap;
                    material.envMapIntensity = 0.3;
                }
            }
            
            material.needsUpdate = true;
        }
    });
}
```

## Testing and Validation Strategy

### Visual Quality Tests:
1. **Shadow Definition**: Verify shadows provide clear object separation
2. **Material Realism**: Check for natural surface appearance
3. **Depth Perception**: Ensure models have clear 3D dimensionality
4. **Color Balance**: Validate natural color reproduction

### Performance Tests:
1. **Frame Rate Monitoring**: Maintain 60fps on target devices
2. **Memory Usage**: Track GPU memory consumption
3. **Render Time**: Measure per-frame render cost
4. **Device Scaling**: Test across different hardware capabilities

### Compatibility Tests:
1. **GLB Loading**: Ensure all existing GLB files render correctly
2. **Canvas Texture**: Verify canvas-to-texture pipeline still works
3. **UI Responsiveness**: Check control panel performance
4. **Save/Load**: Validate scene serialization includes lighting

## References

### Three.js r128 Documentation:
- [HemisphereLight](https://threejs.org/docs/index.html#api/en/lights/HemisphereLight) - Natural ambient lighting
- [DirectionalLightShadow](https://threejs.org/docs/index.html#api/en/lights/shadows/DirectionalLightShadow) - Shadow configuration
- [WebGLRenderer Shadow Maps](https://threejs.org/docs/index.html#api/en/renderers/WebGLRenderer) - Shadow mapping types

### Official Examples:
- [webgl_lights_hemisphere](https://threejs.org/examples/webgl_lights_hemisphere.html) - Multi-light setup
- [webgl_shadowmap](https://threejs.org/examples/webgl_shadowmap.html) - Shadow optimization
- [webgl_materials_physical](https://threejs.org/examples/webgl_materials_physical.html) - PBR materials

### Performance Resources:
- [Three.js Performance Tips](https://threejs.org/manual/#en/tips) - Official optimization guide
- [WebGL Shadow Performance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) - Browser optimization

This research provides a comprehensive, battle-tested approach to significantly improving TigerBuilder's visual quality while maintaining its performance and simplicity goals. The recommendations are based on proven Three.js patterns and can be implemented incrementally with minimal risk to the existing codebase.