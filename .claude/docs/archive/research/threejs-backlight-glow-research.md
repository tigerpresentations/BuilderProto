# Three.js Research: Simple Backlight/Glow Effects for GLB Scene Editor

## Problem Analysis

The TigerBuilder project needs a simple "Backlight" toggle for GLB models with "Image" materials that receive canvas textures. The goal is to create a subtle glow effect that makes textures appear backlit without complex post-processing that could impact performance.

**Technical Challenge:**
- Work with existing MeshStandardMaterial canvas texture pipeline
- Simple on/off toggle in Model Controls section  
- No performance impact on 1024x1024 textures
- Maintain compatibility with current lighting setup

**Three.js Specific Considerations:**
- GLB models use MeshStandardMaterial by default
- Canvas textures already applied to "Image" materials
- Scene uses multiple directional lights + ambient + hemisphere lighting
- Target: immediate visual feedback with simple material property changes

## Official Examples Research

**WebGPU Bloom Emissive Example:**
- Uses Multiple Render Target (MRT) with bloom post-processing
- Too complex for simple toggle requirement
- Requires WebGPU renderer (project uses WebGL)

**MeshStandardMaterial Documentation:**
- Built-in `emissive` property for glow color
- `emissiveIntensity` controls glow strength
- `emissiveMap` applies texture-based selective glowing
- Works without post-processing in WebGL

**Community Examples:**
- Emissive properties create "always visible" glow regardless of lighting
- `emissive` + `emissiveIntensity` provides simple backlight effect
- Can use same canvas texture as `emissiveMap` for texture-based glow

## Recommended Approach

**Simplest Solution: Emissive Material Properties**

The most elegant approach is to leverage MeshStandardMaterial's built-in emissive properties:

1. **Use existing material** - Modify the current MeshStandardMaterial rather than creating new material
2. **Emissive texture approach** - Set `emissiveMap` to the same canvas texture as the base map
3. **Simple property toggle** - Control via `emissive` color and `emissiveIntensity`

**Why This Approach:**
- No post-processing complexity
- Works with existing WebGL renderer  
- Immediate performance (just material property changes)
- Compatible with current lighting setup
- Uses proven Three.js patterns

## Implementation Roadmap

### Step 1: Modify Material Setup Function

Update the `setupCanvasTexture()` function to prepare emissive properties:

```javascript
function setupCanvasTexture() {
    if (imageMaterial) {
        // Existing texture setup
        canvasTexture = new THREE.CanvasTexture(drawCanvas);
        canvasTexture.generateMipmaps = true;
        canvasTexture.minFilter = THREE.LinearMipmapLinearFilter;
        canvasTexture.magFilter = THREE.LinearFilter;
        canvasTexture.flipY = false;
        canvasTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        canvasTexture.wrapS = THREE.ClampToEdgeWrapping;
        canvasTexture.wrapT = THREE.ClampToEdgeWrapping;
        
        // Apply to diffuse map
        imageMaterial.map = canvasTexture;
        
        // NEW: Prepare emissive properties for backlight toggle
        imageMaterial.emissive = new THREE.Color(0x000000); // Black by default (off)
        imageMaterial.emissiveIntensity = 0.0; // Disabled by default
        // Note: emissiveMap will be set when backlight is enabled
        
        imageMaterial.needsUpdate = true;
        needsTextureUpdate = true;
        markNeedsRender();
    }
}
```

### Step 2: Add UI Toggle

Add backlight toggle to the Model Controls section (after Object Transform):

```html
<div class="control-group">
    <h4>Model Controls</h4>
    <label>
        <input type="checkbox" id="backlightToggle" onchange="toggleBacklight()">
        Backlight Effect
    </label>
</div>
```

### Step 3: Implement Toggle Function

```javascript
function toggleBacklight() {
    if (!imageMaterial || !canvasTexture) {
        showNotification('No image material found', 'warning', 2000);
        return;
    }
    
    const backlightEnabled = document.getElementById('backlightToggle').checked;
    
    if (backlightEnabled) {
        // Enable backlight effect
        imageMaterial.emissive = new THREE.Color(0xffffff); // White emissive
        imageMaterial.emissiveIntensity = 0.3; // Subtle glow
        imageMaterial.emissiveMap = canvasTexture; // Same texture as base
    } else {
        // Disable backlight effect  
        imageMaterial.emissive = new THREE.Color(0x000000); // Black (no glow)
        imageMaterial.emissiveIntensity = 0.0;
        imageMaterial.emissiveMap = null; // Remove emissive texture
    }
    
    imageMaterial.needsUpdate = true;
    markNeedsRender();
    
    showNotification(
        backlightEnabled ? 'Backlight enabled' : 'Backlight disabled', 
        'info', 
        1500
    );
}
```

### Step 4: Update Scene Serialization

Add backlight state to scene save/load:

```javascript
// In saveScene() function, add to texture object:
texture: {
    canvasData: canvasDataURL,
    hasImageMaterial: !!imageMaterial,
    compressionUsed: !canvasHasTransparency(drawCanvas),
    backlightEnabled: imageMaterial ? imageMaterial.emissiveIntensity > 0 : false
}

// In loadScene() function, restore backlight state:
if (sceneData.texture && sceneData.texture.backlightEnabled) {
    document.getElementById('backlightToggle').checked = true;
    toggleBacklight();
}
```

## Optimal Settings for Your Scene

**Recommended Emissive Values:**
- `emissive`: `0xffffff` (white) - works well with any canvas texture color
- `emissiveIntensity`: `0.2-0.4` - subtle but noticeable against light grey background
- `emissiveMap`: Same `canvasTexture` used for base map

**Why These Settings:**
- White emissive color lets the texture colors shine through naturally
- Low intensity (0.2-0.4) prevents overwhelming the base texture
- Using same texture for emissiveMap creates realistic backlit effect
- Works well with current ambient + directional lighting setup

## Alternative Approaches Considered

**Bloom Post-Processing:**
- Pros: True glow with light bleeding
- Cons: Complex setup, performance impact, requires post-processing pipeline
- Verdict: Overkill for simple toggle requirement

**Custom Shader:**
- Pros: Maximum control over glow appearance  
- Cons: Complexity, maintenance overhead, breaks GLB material compatibility
- Verdict: Unnecessary for this use case

**Separate Glow Material:**
- Pros: Isolation from base material
- Cons: Material switching complexity, potential texture conflicts
- Verdict: Emissive properties on existing material is simpler

## Performance Considerations

**Memory Impact:**
- Zero additional memory (reuses existing canvas texture)
- No additional render targets or textures

**Render Performance:**
- Negligible impact (just additional material property evaluation)
- No additional draw calls or passes
- Works efficiently with existing lighting

**1024x1024 Texture Compatibility:**
- Emissive properties work at any texture resolution
- No additional texture processing required
- Same performance as base texture rendering

## Testing and Validation Strategy

### Visual Testing Checklist:
1. **Toggle Functionality**: Backlight turns on/off immediately
2. **Texture Visibility**: Base canvas texture remains clearly visible
3. **Glow Appearance**: Subtle backlight effect without overpowering
4. **Background Compatibility**: Works well against light grey background
5. **Content Variety**: Test with both drawn content and uploaded images

### Technical Testing:
1. **Performance**: No FPS drop with backlight enabled
2. **Memory**: No memory leaks during toggle operations
3. **Serialization**: Backlight state saves and restores correctly
4. **Material Integrity**: GLB materials remain functional

### Edge Cases:
- No model loaded (should show warning)
- No "Image" material found (should show warning)
- Multiple models with "Image" materials (affects all)
- Canvas cleared while backlight enabled (should maintain effect)

## References

- [MeshStandardMaterial Documentation](https://threejs.org/docs/api/en/materials/MeshStandardMaterial.html)
- [Three.js Emissive Materials Tutorial](https://dustinpfister.github.io/2021/06/22/threejs-emissive-map/)
- [Three.js Forum: Emissive Effects](https://discourse.threejs.org/t/glowing-effect-on-emissive-map-and-not-on-color-map/56252)
- [Three.js Standard Material Guide](https://discoverthreejs.com/book/first-steps/physically-based-rendering/)

## Key Implementation Files

**Primary File to Modify:**
- `/Users/david/Local Documents/BuilderProto/integrated-scene.html`

**Functions to Update:**
- `setupCanvasTexture()` - Add emissive property initialization
- `findImageMaterial()` - Ensure emissive properties are set
- `saveScene()` / `loadScene()` - Add backlight state serialization  
- Add `toggleBacklight()` function
- Update HTML to include toggle in Model Controls section

**Implementation Philosophy:**
- **Simple over complex**: Use built-in emissive properties rather than custom shaders
- **Elegant over impressive**: Subtle backlight effect that enhances rather than dominates
- **Compatible over novel**: Work with existing material and texture pipeline
- **Immediate over gradual**: Toggle provides instant visual feedback