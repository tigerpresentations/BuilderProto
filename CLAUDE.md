# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Three.js-based 3D scene editor prototype that demonstrates real-time texture editing on GLB/GLTF models. The project consists of several HTML experiments that showcase different aspects of the texture pipeline and 3D model manipulation.

## Core Architecture

### Main Components

1. **integrated-scene.html** - Primary application combining all features:
   - GLB/GLTF model loading with automatic "Image" material detection
   - Real-time canvas-to-texture pipeline (256x256 canvas)
   - Image upload and manipulation (scale, position)
   - Object transforms (position, rotation, scale)
   - Scene state serialization/deserialization
   - File-based persistence (works without localStorage)

2. **Experimental Components**:
   - **canvas-texture-pipeline.html** - Demonstrates real-time canvas drawing to 3D texture
   - **surface-detector.html** - Detects and highlights materials with specific naming patterns
   - **design-state-manager.html** - Scene state serialization with file download/upload

### Key Technical Details

- **Texture Orientation**: Canvas textures use `flipY = false` for GLB compatibility
- **Material Detection**: Scans for materials with "Image" in the name (case-insensitive)
- **Memory Management**: Proper disposal of geometries and materials when replacing models
- **Browser Compatibility**: Works with `file://` protocol (no localStorage dependency)

## Development Commands

Since this is a standalone HTML/JavaScript project with no build system:

```bash
# Open any HTML file directly in a browser
open integrated-scene.html  # macOS
# or
start integrated-scene.html  # Windows
# or simply drag the HTML file to your browser

# Test with the included GLB files
# Default model: 91x91.glb (loaded automatically if present)
```

## Testing Workflow

1. Open `integrated-scene.html` in a browser
2. The system will attempt to load `91x91.glb` automatically
3. Upload any GLB/GLTF file to test material detection
4. Materials named "Image" will automatically receive canvas texture
5. Use the canvas editor to draw or upload images
6. Test scene saving/loading with Download/Load Scene buttons

## Important Implementation Notes

### Canvas-to-Texture Pipeline
- Uses `THREE.CanvasTexture` with `needsUpdate` flag for real-time updates
- Texture filters set to `LinearFilter` without mipmaps for performance
- Target 60 FPS with immediate texture updates on canvas changes

### GLB Material Detection
```javascript
// Materials are detected with this pattern:
if (materialName.toLowerCase() === 'image' || materialName.toLowerCase().includes('image')) {
    // Apply canvas texture to this material
}
```

### Scene Serialization Format
- GLB data embedded as base64 DataURL
- Canvas content saved as image DataURL  
- Complete transform and camera state preserved
- JSON format with version field for compatibility

## File Structure

All files are self-contained HTML with embedded JavaScript. No external dependencies except CDN-loaded Three.js libraries:
- Three.js r128
- GLTFLoader
- OrbitControls

## Known Issues and Considerations

- Large GLB files may create large JSON save files due to base64 encoding
- Canvas size fixed at 256x256 for performance
- Browser memory limits may affect very large models
- File API required for save/load functionality
- When communicating with Agents, remind them that simple, clever solutions are preferred over overly complex methods. They should look for standard solutions to problems rather than trying to solve it with novel code. Reinforce that they should focus on the requested topic, and not get distracted by new features and systems unless they are the clear, obvious, and easy solution to the problem. Advanced features are not the end goal here -- this is not a technical excercise to see how advanced we can be; eventually I hope for this to be a usable tool. Stability, maintainability, and reliability should always be an important factor in their recommendations.